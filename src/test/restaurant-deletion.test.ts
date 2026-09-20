import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { Restaurant, RestaurantVisit } from '@/lib/restaurantDomain';
import { createRestaurantDeletionService, RestaurantDeletionError } from '@/lib/restaurantDeletion';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';

function restaurant(id: string, name = 'Bistro', userId = alice): Restaurant {
  return { id, name, user_id: userId, category: 'restaurant', city_id: null, lat: null, lng: null,
    address: null, google_place_id: null, created_at: '2026-09-20T00:00:00Z' };
}

function visit(id: string, placeId: string, photos: string[] = [], userId = alice): RestaurantVisit {
  return { id, place_id: placeId, date: '2026-09-20', user_id: userId, moment_id: null, note: null,
    what_i_ate: null, rating: null, photos, created_at: '2026-09-20T00:00:00Z' };
}

function fixture() {
  const restaurants = [restaurant('first'), restaurant('second'), restaurant('foreign', 'Bistro', bob)];
  const visits: RestaurantVisit[] = [];
  const objects = new Set<string>();
  let storageError = false;
  let databaseError = false;
  const storage = { remove: vi.fn(async (paths: string[]) => {
    if (storageError) {
      objects.delete(paths[0]); // Simulate an API error after a partial server-side cleanup.
      return { error: { message: 'partial cleanup' } };
    }
    paths.forEach(path => objects.delete(path));
    return { error: null };
  }) };
  const db = { storage: { from: vi.fn(() => storage) } } as unknown as SupabaseClient<Database>;
  const restaurantApi = {
    get: vi.fn(async (userId: string, id: string) => restaurants.find(row => row.user_id === userId && row.id === id) ?? null),
    delete: vi.fn(async (userId: string, id: string) => {
      if (databaseError) throw new Error('DB failed');
      const index = restaurants.findIndex(row => row.user_id === userId && row.id === id);
      if (index < 0) throw new Error('not found');
      restaurants.splice(index, 1);
      for (let i = visits.length - 1; i >= 0; i--) {
        if (visits[i].user_id === userId && visits[i].place_id === id) visits.splice(i, 1);
      }
    }),
  };
  const visitApi = { list: vi.fn(async (userId: string, placeId: string) => {
    if (!restaurants.some(row => row.user_id === userId && row.id === placeId)) throw new Error('not found');
    return visits.filter(row => row.user_id === userId && row.place_id === placeId);
  }) };
  const service = createRestaurantDeletionService(db, restaurantApi, visitApi);
  return { restaurants, visits, objects, storage, restaurantApi, visitApi, service,
    failStorage: () => { storageError = true; }, failDatabase: () => { databaseError = true; } };
}

describe('Safe restaurant deletion', () => {
  it('deletes a restaurant without visits without touching Storage', async () => {
    const f = fixture();
    await f.service.delete(alice, 'first');
    expect(f.storage.remove).not.toHaveBeenCalled();
    expect(f.restaurants.map(row => row.id)).toEqual(['second', 'foreign']);
    expect(f.restaurantApi.delete).toHaveBeenCalledWith(alice, 'first');
  });

  it.each([1, 3])('deletes a restaurant with %i visit(s) and every owned photo', async count => {
    const f = fixture();
    for (let index = 0; index < count; index++) {
      const id = `visit-${index}`;
      const paths = [`${alice}/restaurants/${id}/one.jpg`, `${alice}/restaurants/${id}/two.jpg`];
      f.visits.push(visit(id, 'first', paths));
      paths.forEach(path => f.objects.add(path));
    }
    const otherPath = `${alice}/restaurants/other-visit/kept.jpg`;
    f.visits.push(visit('other-visit', 'second', [otherPath]));
    f.objects.add(otherPath);

    await f.service.delete(alice, 'first');

    expect(f.storage.remove).toHaveBeenCalledWith(expect.arrayContaining(
      Array.from({ length: count }, (_, index) => `${alice}/restaurants/visit-${index}/one.jpg`)));
    expect(f.visits.map(row => row.id)).toEqual(['other-visit']);
    expect(f.restaurants.map(row => row.id)).toEqual(['second', 'foreign']);
    expect(f.objects).toEqual(new Set([otherPath]));
  });

  it('ignores noncanonical, foreign and wrong-visit paths instead of deleting them', async () => {
    const f = fixture();
    const owned = `${alice}/restaurants/visit-1/owned.jpg`;
    const unsafe = [`${bob}/restaurants/visit-1/foreign.jpg`, `${alice}/restaurants/other/wrong.jpg`, 'data:image/png;base64,AA'];
    f.visits.push(visit('visit-1', 'first', [owned, ...unsafe]));
    [owned, ...unsafe].forEach(path => f.objects.add(path));

    await f.service.delete(alice, 'first');

    expect(f.storage.remove).toHaveBeenCalledWith([owned]);
    expect(f.objects).toEqual(new Set(unsafe));
  });

  it('refuses another owner and never reads visits, Storage, or deletes records', async () => {
    const f = fixture();
    await expect(f.service.delete(alice, 'foreign')).rejects.toMatchObject({ stage: 'database' });
    expect(f.visitApi.list).not.toHaveBeenCalled();
    expect(f.storage.remove).not.toHaveBeenCalled();
    expect(f.restaurantApi.delete).not.toHaveBeenCalled();
    expect(f.restaurants).toHaveLength(3);
  });

  it('stops before database deletion and reports possible partial Storage cleanup', async () => {
    const f = fixture();
    const paths = [`${alice}/restaurants/visit-1/one.jpg`, `${alice}/restaurants/visit-1/two.jpg`];
    f.visits.push(visit('visit-1', 'first', paths));
    paths.forEach(path => f.objects.add(path));
    f.failStorage();

    await expect(f.service.delete(alice, 'first')).rejects.toMatchObject({
      stage: 'storage', affectedPaths: paths,
      message: expect.stringContaining('dio fotografija možda je već uklonjen'),
    });
    expect(f.restaurantApi.delete).not.toHaveBeenCalled();
    expect(f.restaurants).toHaveLength(3);
    expect(f.visits).toHaveLength(1);
  });

  it('reports when photos are gone but the database delete fails', async () => {
    const f = fixture();
    const path = `${alice}/restaurants/visit-1/one.jpg`;
    f.visits.push(visit('visit-1', 'first', [path]));
    f.objects.add(path);
    f.failDatabase();

    await expect(f.service.delete(alice, 'first')).rejects.toMatchObject({
      name: RestaurantDeletionError.name,
      stage: 'database', message: expect.stringContaining('Fotografije su uklonjene'),
    });
    expect(f.objects).toEqual(new Set());
    expect(f.restaurants).toHaveLength(3);
    expect(f.visits).toHaveLength(1);
  });
});

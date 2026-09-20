import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/integrations/supabase/types';
import { RestaurantServiceError } from '@/lib/restaurantDomain';
import { createRestaurantService } from '@/lib/restaurants';
import { createRestaurantVisitService } from '@/lib/restaurantVisits';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';

function fakeDatabase() {
  const places: Tables<'places'>[] = [];
  const visits: Tables<'visits'>[] = [];
  let sequence = 0;
  let nextError: { message: string } | null = null;

  const db = {
    from(table: 'places' | 'visits') {
      const rows = (table === 'places' ? places : visits) as Record<string, unknown>[];
      let action: 'read' | 'insert' | 'update' | 'delete' = 'read';
      let payload: Record<string, unknown> = {};
      const filters: Array<[string, unknown]> = [];
      let orderColumn: string | null = null;
      let ascending = true;

      const execute = (single: boolean) => {
        if (nextError) {
          const error = nextError;
          nextError = null;
          return { data: null, error };
        }
        const matching = rows.filter(row => filters.every(([key, value]) =>
          row[key] === value));
        let result: Record<string, unknown>[] = matching;
        if (action === 'insert') {
          if (table === 'places' && payload.city_id != null && payload.city_id !== `city-${payload.user_id}`) {
            return { data: null, error: { message: 'place and city ownership mismatch' } };
          }
          const row = { id: `record-${++sequence}`, created_at: '2026-09-19T00:00:00Z', ...payload };
          rows.push(row);
          result = [row];
        } else if (action === 'update') {
          if (table === 'places' && payload.city_id != null &&
              matching.some(row => payload.city_id !== `city-${row.user_id}`)) {
            return { data: null, error: { message: 'place and city ownership mismatch' } };
          }
          matching.forEach(row => Object.assign(row, payload));
        } else if (action === 'delete') {
          matching.forEach(row => rows.splice(rows.indexOf(row), 1));
        } else if (orderColumn) {
          result = [...matching].sort((a, b) =>
            String(a[orderColumn!]).localeCompare(String(b[orderColumn!])) * (ascending ? 1 : -1));
        }
        return { data: single ? result[0] ?? null : result, error: null };
      };

      const query = {
        select: (_columns?: string) => query,
        insert: (value: Record<string, unknown>) => { action = 'insert' as const; payload = value; return query; },
        update: (value: Record<string, unknown>) => { action = 'update' as const; payload = value; return query; },
        delete: () => { action = 'delete' as const; return query; },
        eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
        order: (key: string, options: { ascending: boolean }) => {
          orderColumn = key; ascending = options.ascending; return query;
        },
        maybeSingle: async () => execute(true),
        single: async () => execute(true),
        then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(resolve(execute(false))),
      };
      return query;
    },
  };
  return {
    client: db as unknown as SupabaseClient<Database>,
    places,
    visits,
    failOnce(message: string) { nextError = { message }; },
  };
}

async function restaurantFor(db: ReturnType<typeof fakeDatabase>, userId = alice, name = 'Bistro') {
  return createRestaurantService(db.client).create(userId, {
    name, city_id: `city-${userId}`, lat: 45.8, lng: 16,
  });
}

describe('Restaurant and RestaurantVisit services', () => {
  it('creates a name-only restaurant with null location and preserves located places', async () => {
    const db = fakeDatabase();
    const service = createRestaurantService(db.client);
    const nameOnly = await service.create(alice, { name: '  Bistro  ' });
    const located = await restaurantFor(db);

    expect(nameOnly).toMatchObject({
      name: 'Bistro', category: 'restaurant', user_id: alice,
      city_id: null, lat: null, lng: null,
    });
    expect(located).toMatchObject({ city_id: `city-${alice}`, lat: 45.8, lng: 16 });
    expect((await service.get(alice, nameOnly.id))?.id).toBe(nameOnly.id);
    expect((await service.list(alice)).map(item => item.id)).toContain(located.id);
  });

  it('rejects linking a restaurant to another user’s city', async () => {
    const db = fakeDatabase();
    const service = createRestaurantService(db.client);
    await expect(service.create(alice, { name: 'Bistro', city_id: `city-${bob}` }))
      .rejects.toMatchObject({ code: 'database' });
    const restaurant = await service.create(alice, { name: 'Bistro' });
    await expect(service.update(alice, restaurant.id, { city_id: `city-${bob}` }))
      .rejects.toMatchObject({ code: 'database' });
    expect((await service.get(alice, restaurant.id))?.city_id).toBeNull();
  });

  it('keeps restaurants with the same name separate by ID and owner', async () => {
    const db = fakeDatabase();
    const service = createRestaurantService(db.client);
    const first = await restaurantFor(db);
    const second = await restaurantFor(db);
    const other = await restaurantFor(db, bob);

    expect(new Set([first.id, second.id, other.id]).size).toBe(3);
    expect(new Set((await service.list(alice)).map(item => item.id))).toEqual(new Set([first.id, second.id]));
    expect(await service.get(alice, other.id)).toBeNull();
    expect((await service.update(alice, first.id, { name: 'Renamed' })).name).toBe('Renamed');
    expect((await service.get(alice, second.id))?.name).toBe('Bistro');
    await expect(service.update(alice, other.id, { name: 'No' })).rejects.toMatchObject({ code: 'not_found' });
    expect(db.places.every(place => place.category === 'restaurant')).toBe(true);
  });

  it('deletes only the owned restaurant selected by ID', async () => {
    const db = fakeDatabase();
    const service = createRestaurantService(db.client);
    const first = await restaurantFor(db);
    const second = await restaurantFor(db);
    const foreign = await restaurantFor(db, bob);

    await service.delete(alice, first.id);
    expect(db.places.map(place => place.id)).toEqual([second.id, foreign.id]);
    await expect(service.delete(alice, foreign.id)).rejects.toMatchObject({ code: 'not_found' });
    expect(db.places.map(place => place.id)).toEqual([second.id, foreign.id]);
  });

  it('creates two independent visits for the same restaurant without a Moment and supports CRUD', async () => {
    const db = fakeDatabase();
    const restaurant = await restaurantFor(db);
    const service = createRestaurantVisitService(db.client);
    const first = await service.create(alice, {
      place_id: restaurant.id, date: '2026-09-19', what_i_ate: 'Rižoto',
      note: 'Odlično', rating: null, photos: [`${alice}/photo-1.jpg`, `${alice}/photo-2.jpg`],
    });
    const second = await service.create(alice, { place_id: restaurant.id, date: '2026-09-20', rating: 5 });

    expect(first.moment_id).toBeNull();
    expect(second.moment_id).toBeNull();
    expect(first.what_i_ate).toBe('Rižoto');
    expect(first.rating).toBeNull();
    expect(first.photos).toHaveLength(2);
    expect((await service.list(alice, restaurant.id)).map(visit => visit.id)).toEqual([second.id, first.id]);

    const updated = await service.update(alice, first.id, { what_i_ate: 'Riba', rating: 3, date: '2026-09-21' });
    expect(updated.what_i_ate).toBe('Riba');
    expect(updated.rating).toBe(3);
    expect(updated.date).toBe('2026-09-21');
    await service.delete(alice, first.id);
    expect(await service.get(alice, first.id)).toBeNull();
    expect((await service.list(alice, restaurant.id)).map(visit => visit.id)).toEqual([second.id]);
  });

  it('rejects another user’s restaurant and visit', async () => {
    const db = fakeDatabase();
    const restaurant = await restaurantFor(db, bob);
    const service = createRestaurantVisitService(db.client);
    await expect(service.create(alice, { place_id: restaurant.id, date: '2026-09-19' }))
      .rejects.toMatchObject({ code: 'not_found' });
    const visit = await service.create(bob, { place_id: restaurant.id, date: '2026-09-19' });
    expect(await service.get(alice, visit.id)).toBeNull();
    await expect(service.update(alice, visit.id, { note: 'No' })).rejects.toMatchObject({ code: 'not_found' });
    await expect(service.delete(alice, visit.id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejects invalid ratings, dates and noncanonical photos before writing', async () => {
    const db = fakeDatabase();
    const restaurant = await restaurantFor(db);
    const service = createRestaurantVisitService(db.client);
    for (const rating of [0, 6, 2.5]) {
      await expect(service.create(alice, { place_id: restaurant.id, date: '2026-09-19', rating }))
        .rejects.toMatchObject({ code: 'invalid_input' });
    }
    await expect(service.create(alice, { place_id: restaurant.id, date: '2026-02-30' }))
      .rejects.toMatchObject({ code: 'invalid_input' });
    for (const photo of ['data:image/png;base64,AA', 'https://example.com/signed.jpg?token=x', `${bob}/photo.jpg`]) {
      await expect(service.create(alice, { place_id: restaurant.id, date: '2026-09-19', photos: [photo] }))
        .rejects.toMatchObject({ code: 'invalid_input' });
    }
    expect(db.visits).toHaveLength(0);
    const visit = await service.create(alice, { place_id: restaurant.id, date: '2026-09-19' });
    await expect(service.update(alice, visit.id, { photos: ['data:image/jpeg;base64,AA'] }))
      .rejects.toMatchObject({ code: 'invalid_input' });
    expect(db.visits[0].photos).toEqual([]);
  });

  it('reads legacy photo values but forwards database errors', async () => {
    const db = fakeDatabase();
    const restaurant = await restaurantFor(db);
    const service = createRestaurantVisitService(db.client);
    const visit = await service.create(alice, { place_id: restaurant.id, date: '2026-09-19' });
    db.visits[0].photos = ['data:image/png;base64,OLD'];
    expect((await service.get(alice, visit.id))?.photos).toEqual(['data:image/png;base64,OLD']);
    db.failOnce('database unavailable');
    await expect(service.list(alice, restaurant.id)).rejects.toBeInstanceOf(RestaurantServiceError);
  });
});

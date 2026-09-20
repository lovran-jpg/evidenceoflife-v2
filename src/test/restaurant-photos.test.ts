import { describe, expect, it, vi } from 'vitest';
import type { RestaurantVisit } from '@/lib/restaurantDomain';
import { createRestaurantVisitPhotoService, VisitPhotoError } from '@/lib/restaurantVisitPhotos';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { requireCanonicalPhotos } from '@/lib/restaurantDomain';
import { createRestaurantVisitService } from '@/lib/restaurantVisits';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const file = (name = 'one.jpg') => new File(['image'], name, { type: 'image/jpeg' });

function fixture() {
  const rows: RestaurantVisit[] = [];
  const objects = new Set<string>();
  let uploadNumber = 0;
  let failUploadAt = 0;
  let failWrite = false;
  let failRemove = false;
  const storage = {
    upload: vi.fn(async (path: string) => {
      uploadNumber++;
      if (uploadNumber === failUploadAt) return { error: { message: 'upload failed' } };
      objects.add(path);
      return { error: null };
    }),
    remove: vi.fn(async (paths: string[]) => {
      if (failRemove) return { error: { message: 'remove failed' } };
      paths.forEach(path => objects.delete(path));
      return { error: null };
    }),
    createSignedUrl: vi.fn(async (path: string) => objects.has(path)
      ? { data: { signedUrl: `https://example.test/signed/${path}` }, error: null }
      : { data: null, error: { message: 'not found' } }),
  };
  const db = { storage: { from: () => storage } } as unknown as SupabaseClient<Database>;
  const visits = {
    get: vi.fn(async (userId: string, id: string) => rows.find(row => row.user_id === userId && row.id === id) ?? null),
    create: vi.fn(async (userId: string, input: Partial<RestaurantVisit>) => {
      if (failWrite) throw new Error('DB failed');
      const row = { ...input, user_id: userId, created_at: '', moment_id: null } as RestaurantVisit;
      rows.push(row);
      return row;
    }),
    update: vi.fn(async (userId: string, id: string, changes: Partial<RestaurantVisit>) => {
      if (failWrite) throw new Error('DB failed');
      const row = rows.find(item => item.user_id === userId && item.id === id);
      if (!row) throw new Error('not found');
      Object.assign(row, changes);
      return row;
    }),
    delete: vi.fn(async (userId: string, id: string) => {
      if (failWrite) throw new Error('DB failed');
      const index = rows.findIndex(item => item.user_id === userId && item.id === id);
      if (index < 0) throw new Error('not found');
      rows.splice(index, 1);
    }),
  };
  const service = createRestaurantVisitPhotoService(db, visits as unknown as ReturnType<typeof createRestaurantVisitService>);
  return { rows, objects, storage, visits, service,
    failUploadAt: (at: number) => { failUploadAt = at; },
    failWrite: () => { failWrite = true; },
    failRemove: () => { failRemove = true; },
  };
}

const input = { place_id: 'restaurant-1', date: '2026-09-19' };

describe('RestaurantVisit private photos', () => {
  it('supports zero, one and multiple photos, storing only visit-scoped paths', async () => {
    const f = fixture();
    const empty = await f.service.create(alice, input, []);
    expect(empty.photos).toEqual([]);
    const one = await f.service.create(alice, input, [file()]);
    const many = await f.service.create(alice, input, [file(), file('two.jpg')]);
    expect(one.photos).toHaveLength(1);
    expect(many.photos).toHaveLength(2);
    expect(new Set([empty.id, one.id, many.id]).size).toBe(3);
    for (const visit of [one, many]) for (const path of visit.photos) {
      expect(path.startsWith(`${alice}/restaurants/${visit.id}/`)).toBe(true);
      expect(path.endsWith('.jpg')).toBe(true);
      expect(path).not.toMatch(/^(https?:|data:|blob:)/);
      expect(f.objects.has(path)).toBe(true);
    }
  });

  it('adds new photos and removes one after DB update, leaving others intact', async () => {
    const f = fixture();
    const visit = await f.service.create(alice, input, [file(), file('two.jpg')]);
    const [removed, kept] = visit.photos;
    const updated = await f.service.update(alice, visit.id, { note: 'Tasty' }, [kept], [file('three.jpg')]);
    expect(updated.photos).toHaveLength(2);
    expect(updated.photos[0]).toBe(kept);
    expect(f.objects.has(removed)).toBe(false);
    expect(f.objects.has(kept)).toBe(true);
    expect(f.objects.has(updated.photos[1])).toBe(true);
  });

  it('rolls back new objects when DB insert fails', async () => {
    const f = fixture();
    f.failWrite();
    await expect(f.service.create(alice, input, [file(), file('two.jpg')])).rejects.toThrow('Posjet nije spremljen');
    expect(f.rows).toHaveLength(0);
    expect(f.objects.size).toBe(0);
  });

  it('rolls back uploaded objects on partial batch failure', async () => {
    const f = fixture();
    f.failUploadAt(2);
    await expect(f.service.create(alice, input, [file(), file('two.jpg')])).rejects.toThrow('Posjet nije spremljen');
    expect(f.rows).toHaveLength(0);
    expect(f.objects.size).toBe(0);
  });

  it('does not delete old photos when an update fails', async () => {
    const f = fixture();
    const visit = await f.service.create(alice, input, [file()]);
    const old = visit.photos[0];
    f.failWrite();
    await expect(f.service.update(alice, visit.id, {}, [], [file('new.jpg')])).rejects.toThrow('Posjet nije spremljen');
    expect(f.objects.size).toBe(1);
    expect(f.objects.has(old)).toBe(true);
    expect(visit.photos).toEqual([old]);
  });

  it('deletes a visit and its owned objects, and surfaces failed cleanup', async () => {
    const f = fixture();
    const visit = await f.service.create(alice, input, [file()]);
    await f.service.delete(alice, visit.id);
    expect(f.rows).toHaveLength(0);
    expect(f.objects.size).toBe(0);
    const another = await f.service.create(alice, input, [file()]);
    f.failRemove();
    await expect(f.service.delete(alice, another.id)).rejects.toMatchObject({ committed: true, orphanedPaths: another.photos });
  });

  it('reports an orphan after a committed photo removal without rolling the DB record back', async () => {
    const f = fixture();
    const visit = await f.service.create(alice, input, [file()]);
    const oldPaths = [...visit.photos];
    f.failRemove();
    await expect(f.service.update(alice, visit.id, {}, [], [])).rejects.toMatchObject({ committed: true, orphanedPaths: oldPaths });
    expect(f.rows[0].photos).toEqual([]);
    expect(f.objects.size).toBe(1);
  });

  it('signs only the owner path for display without changing the stored value', async () => {
    const f = fixture();
    const visit = await f.service.create(alice, input, [file()]);
    const signed = await f.service.signedUrl(alice, visit.photos[0]);
    expect(signed).toContain('/signed/');
    expect(visit.photos[0]).toMatch(new RegExp(`^${alice}/restaurants/`));
    expect(visit.photos[0]).not.toBe(signed);
  });

  it('denies another user signed URLs, deletion and attaching foreign paths', async () => {
    const f = fixture();
    const visit = await f.service.create(alice, input, [file()]);
    await expect(f.service.signedUrl(bob, visit.photos[0])).rejects.toThrow();
    await expect(f.service.delete(bob, visit.id)).rejects.toThrow();
    await expect(f.service.update(bob, visit.id, {}, [], [])).rejects.toThrow();
    expect(f.storage.remove).not.toHaveBeenCalled();
    expect(f.storage.createSignedUrl).not.toHaveBeenCalled();
    expect(() => requireCanonicalPhotos(bob, visit.photos)).toThrow();
  });

  it('allows read-only legacy data: photos without attempting Storage signing', async () => {
    const f = fixture();
    const legacy = 'data:image/png;base64,AA==';
    expect(await f.service.signedUrl(alice, legacy)).toBe(legacy);
    expect(f.storage.createSignedUrl).not.toHaveBeenCalled();
    await expect(f.service.create(alice, { ...input, photos: [legacy] }, [])).rejects.toThrow();
  });
});

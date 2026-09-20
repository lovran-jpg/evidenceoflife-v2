import { describe, expect, it, vi } from 'vitest';
import type { Restaurant, RestaurantVisit } from '@/lib/restaurantDomain';
import { createRestaurantMapService } from '@/lib/restaurantMap';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';

function restaurant(id: string, name: string, lat: number | null, lng: number | null, userId = alice, googlePlaceId: string | null = null): Restaurant {
  return { id, name, user_id: userId, category: 'restaurant', city_id: null, lat, lng,
    address: null, google_place_id: googlePlaceId, created_at: '2026-09-20T00:00:00Z' };
}

function visit(id: string, placeId: string, date: string): RestaurantVisit {
  return { id, place_id: placeId, date, user_id: alice, moment_id: null, note: null,
    what_i_ate: null, rating: null, photos: [], created_at: '2026-09-20T00:00:00Z' };
}

describe('Restaurant map domain', () => {
  it('includes own located restaurants, retains duplicate names by ID and summarizes visits', async () => {
    const rows = [restaurant('a', 'Bistro', 45.81, 15.98), restaurant('b', 'Bistro', 45.82, 15.99),
      restaurant('none', 'Bez lokacije', null, null), restaurant('foreign', 'Tuđi', 46, 16, bob)];
    const visits = [visit('v1', 'a', '2026-09-01'), visit('v2', 'a', '2026-09-19'), visit('v3', 'b', '2026-08-20')];
    const list = vi.fn(async (userId: string) => rows.filter(row => row.user_id === userId));
    const listVisits = vi.fn(async (_userId: string, id: string) => visits.filter(row => row.place_id === id));
    const service = createRestaurantMapService({ list }, { list: listVisits });
    const result = await service.list(alice);
    expect(result.map(item => item.restaurant.id)).toEqual(['a', 'b']);
    expect(result.map(item => item.restaurant.name)).toEqual(['Bistro', 'Bistro']);
    expect(result[0]).toMatchObject({ visitCount: 2, lastVisit: '2026-09-19' });
    expect(listVisits).not.toHaveBeenCalledWith(alice, 'none');
    expect(listVisits).not.toHaveBeenCalledWith(alice, 'foreign');
  });

  it('resolves a Google Place ID only in memory and keeps the stored row without coordinates', async () => {
    const row = restaurant('linked', 'Moj restoran', null, null, alice, 'google-123');
    const resolver = vi.fn(async () => ({ lat: 45.8, lng: 15.9 }));
    const service = createRestaurantMapService({ list: async () => [row] }, { list: async () => [] });
    const result = await service.list(alice, resolver);
    expect(resolver).toHaveBeenCalledWith('google-123');
    expect(result[0]).toMatchObject({ lat: 45.8, lng: 15.9, visitCount: 0, lastVisit: null });
    expect(row.lat).toBeNull();
    expect(row.lng).toBeNull();
  });

  it('ignores invalid or missing coordinates and handles an empty map', async () => {
    const rows = [restaurant('none', 'Bez lokacije', null, null), restaurant('partial', 'Pola', 45, null),
      restaurant('invalid', 'Krivo', 91, 16)];
    const service = createRestaurantMapService({ list: async () => rows }, { list: async () => [] });
    expect(await service.list(alice)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@/integrations/supabase/types';
import { createRestaurantCalendarService, dateKey, localTodayKey, monthCells, monthRange, shiftMonth } from '@/lib/restaurantCalendar';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';

function fakeDatabase() {
  const visits: Tables<'visits'>[] = [];
  const places: Array<Pick<Tables<'places'>, 'id' | 'name' | 'user_id' | 'category'>> = [];
  const queries: Array<{ table: string; filters: string[] }> = [];
  let fail: 'visits' | 'places' | null = null;
  const db = {
    from(table: 'visits' | 'places') {
      const filters: Array<(row: Record<string, unknown>) => boolean> = [];
      const record = { table, filters: [] as string[] };
      queries.push(record);
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { record.filters.push(`eq:${key}:${value}`); filters.push(row => row[key] === value); return query; },
        gte: (key: string, value: string) => { record.filters.push(`gte:${key}:${value}`); filters.push(row => String(row[key]) >= value); return query; },
        lt: (key: string, value: string) => { record.filters.push(`lt:${key}:${value}`); filters.push(row => String(row[key]) < value); return query; },
        in: (key: string, values: string[]) => { record.filters.push(`in:${key}:${values.join(',')}`); filters.push(row => values.includes(String(row[key]))); return query; },
        order: () => query,
        then: (resolve: (result: { data: unknown[] | null; error: { message: string } | null }) => unknown) => {
          const data = fail === table ? null : (table === 'visits' ? visits : places)
            .filter(row => filters.every(filter => filter(row as unknown as Record<string, unknown>)));
          return Promise.resolve(resolve({ data, error: fail === table ? { message: 'query failed' } : null }));
        },
      };
      return query;
    },
  } as unknown as SupabaseClient<Database>;
  return { visits, places, queries, service: createRestaurantCalendarService(db), fail: (table: 'visits' | 'places') => { fail = table; } };
}

function visit(id: string, placeId: string, date: string, userId = alice): Tables<'visits'> {
  return { id, place_id: placeId, date, user_id: userId, moment_id: null, note: null, what_i_ate: null,
    rating: null, photos: [], created_at: '2026-09-19T00:00:00Z' };
}

describe('Restaurant Calendar dates and ownership', () => {
  it('builds Monday-first month cells with first and last day intact', () => {
    const cells = monthCells({ year: 2026, month: 9 });
    expect(cells[0]).toBeNull(); // Monday before Tuesday 1 September.
    expect(cells[1]).toBe('2026-09-01');
    expect(cells).toContain('2026-09-30');
    expect(cells.length % 7).toBe(0);
    expect(monthRange({ year: 2026, month: 9 })).toEqual({ start: '2026-09-01', end: '2026-10-01' });
  });

  it('moves cleanly across December and January without UTC parsing shifts', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
    expect(monthRange({ year: 2026, month: 12 })).toEqual({ start: '2026-12-01', end: '2027-01-01' });
    expect(dateKey(2026, 9, 1)).toBe('2026-09-01');
    expect(localTodayKey(new Date(2026, 8, 1, 0, 30))).toBe('2026-09-01');
  });

  it('returns all own visits in the month, including repeated restaurant IDs and names', async () => {
    const f = fakeDatabase();
    f.places.push(
      { id: 'a', name: 'Bistro', user_id: alice, category: 'restaurant' },
      { id: 'b', name: 'Bistro', user_id: alice, category: 'restaurant' },
      { id: 'park', name: 'Park', user_id: alice, category: 'park' },
      { id: 'foreign', name: 'Private', user_id: bob, category: 'restaurant' },
    );
    f.visits.push(
      visit('first', 'a', '2026-09-01'), visit('same-place', 'a', '2026-09-01'),
      visit('same-name', 'b', '2026-09-01'), visit('later', 'a', '2026-09-30'),
      visit('before', 'a', '2026-08-31'), visit('after', 'a', '2026-10-01'),
      visit('legacy', 'park', '2026-09-10'), visit('other-user', 'foreign', '2026-09-01', bob),
    );
    const result = await f.service.listMonth(alice, { year: 2026, month: 9 });
    expect(result.map(item => item.visit.id)).toEqual(['first', 'same-place', 'same-name', 'later']);
    expect(result.map(item => item.restaurant.id)).toEqual(['a', 'a', 'b', 'a']);
    expect(f.queries[0].filters).toContain(`eq:user_id:${alice}`);
    expect(f.queries[0].filters).toContain('gte:date:2026-09-01');
    expect(f.queries[0].filters).toContain('lt:date:2026-10-01');
    expect(f.queries[1].filters).toContain(`eq:user_id:${alice}`);
    expect(f.queries[1].filters).toContain('eq:category:restaurant');
  });

  it('handles an empty month and surfaces query errors', async () => {
    const empty = fakeDatabase();
    expect(await empty.service.listMonth(alice, { year: 2026, month: 9 })).toEqual([]);
    expect(empty.queries).toHaveLength(1);
    const broken = fakeDatabase();
    broken.fail('visits');
    await expect(broken.service.listMonth(alice, { year: 2026, month: 9 }))
      .rejects.toThrow('Podaci trenutačno nisu dostupni');
    const missingNames = fakeDatabase();
    missingNames.visits.push(visit('one', 'restaurant', '2026-09-19'));
    missingNames.fail('places');
    await expect(missingNames.service.listMonth(alice, { year: 2026, month: 9 }))
      .rejects.toThrow('Podaci trenutačno nisu dostupni');
  });
});

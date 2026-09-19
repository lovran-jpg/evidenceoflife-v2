import { supabase } from '@/integrations/supabase/client';
import { databaseError } from '@/lib/restaurantDomain';
import type { RestaurantVisit } from '@/lib/restaurantDomain';

export interface CalendarVisit {
  visit: RestaurantVisit;
  restaurant: { id: string; name: string };
}

export interface CalendarMonth {
  year: number;
  month: number; // 1–12
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function localTodayKey(now: Date = new Date()): string {
  return dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function shiftMonth({ year, month }: CalendarMonth, offset: number): CalendarMonth {
  const zeroBased = year * 12 + month - 1 + offset;
  return { year: Math.floor(zeroBased / 12), month: ((zeroBased % 12) + 12) % 12 + 1 };
}

export function monthRange(month: CalendarMonth): { start: string; end: string } {
  const next = shiftMonth(month, 1);
  return { start: dateKey(month.year, month.month, 1), end: dateKey(next.year, next.month, 1) };
}

/** Monday-first cells; null values are leading/trailing blank days. UTC is only used for weekday arithmetic. */
export function monthCells({ year, month }: CalendarMonth): Array<string | null> {
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = Array(firstWeekday).fill(null);
  for (let day = 1; day <= dayCount; day++) cells.push(dateKey(year, month, day));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function createRestaurantCalendarService(db: typeof supabase = supabase) {
  return {
    async listMonth(userId: string, month: CalendarMonth): Promise<CalendarVisit[]> {
      const { start, end } = monthRange(month);
      const { data: visits, error: visitError } = await db.from('visits').select('*')
        .eq('user_id', userId).gte('date', start).lt('date', end).order('date', { ascending: true });
      if (visitError) throw databaseError('Could not load calendar visits', visitError);
      if (!visits?.length) return [];

      const placeIds = [...new Set(visits.map(visit => visit.place_id))];
      const { data: places, error: placeError } = await db.from('places').select('id,name')
        .eq('user_id', userId).eq('category', 'restaurant').in('id', placeIds);
      if (placeError) throw databaseError('Could not load calendar restaurants', placeError);
      const byId = new Map((places ?? []).map(place => [place.id, place]));
      return visits.flatMap(visit => {
        const restaurant = byId.get(visit.place_id);
        return restaurant ? [{ visit, restaurant }] : [];
      });
    },
  };
}

export const restaurantCalendar = createRestaurantCalendarService();

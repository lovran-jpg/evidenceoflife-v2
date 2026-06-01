import type { Moment } from '@/types';

export type MemoryHorizon = 'week' | 'month' | 'year';

export interface HorizonDigest {
  horizon: MemoryHorizon;
  startKey: string;
  endKey: string;
  activeDays: number;
  focusMinutes: number;
  moments: number;
  photos: number;
  places: number;
  // Moments the person explicitly marked as worth keeping.
  special: number;
  // Kept reflections in range — the "small wins" narrative (Progress Principle).
  kept: { dateStr: string; text: string }[];
}

function ymdKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Monday-based week start.
function startOfIsoWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

// Inclusive [startKey, endKey] range for the horizon containing selectedDate.
export function horizonRange(selectedDate: Date, horizon: MemoryHorizon): { startKey: string; endKey: string } {
  if (horizon === 'week') {
    const start = startOfIsoWeek(selectedDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { startKey: ymdKey(start), endKey: ymdKey(end) };
  }
  if (horizon === 'month') {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    return { startKey: ymdKey(new Date(y, m, 1)), endKey: ymdKey(new Date(y, m + 1, 0)) };
  }
  // year
  const y = selectedDate.getFullYear();
  return { startKey: ymdKey(new Date(y, 0, 1)), endKey: ymdKey(new Date(y, 11, 31)) };
}

/**
 * Aggregate the period (week / month / year) containing `selectedDate` into a
 * single digest. This is the "zoom out" half of the Revisit loop: the same
 * lived evidence, viewed at four layers of memory (day handled elsewhere).
 * Pure and deterministic so it can be unit-tested independently of rendering.
 */
export function buildHorizonDigest(
  moments: Moment[],
  selectedDate: Date,
  horizon: MemoryHorizon,
): HorizonDigest {
  const safeMoments = Array.isArray(moments) ? moments : [];
  const { startKey, endKey } = horizonRange(selectedDate, horizon);

  const activeDaySet = new Set<string>();
  const places = new Set<string>();
  const kept: { dateStr: string; text: string }[] = [];
  let focusSeconds = 0;
  let momentCount = 0;
  let photos = 0;
  let special = 0;

  for (const m of safeMoments) {
    if (!m.date || m.date < startKey || m.date > endKey) continue;
    activeDaySet.add(m.date);
    momentCount += 1;
    if (m.timer_seconds && m.timer_seconds > 0) focusSeconds += m.timer_seconds;
    if (m.photos?.length) photos += m.photos.length;
    if (m.location?.name) places.add(m.location.name);
    if (m.isSpecial) special += 1;
    if (m.tags?.includes('daily-reflection') && m.text?.trim()) {
      kept.push({ dateStr: m.date, text: m.text.trim() });
    }
  }

  kept.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  return {
    horizon,
    startKey,
    endKey,
    activeDays: activeDaySet.size,
    focusMinutes: Math.round(focusSeconds / 60),
    moments: momentCount,
    photos,
    places: places.size,
    special,
    kept,
  };
}

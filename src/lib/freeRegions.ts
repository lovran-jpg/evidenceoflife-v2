// Free-time (blank/gap) regions on the day timeline.
//
// The timeline paints scheduled blocks; the *empty* stretches between them are
// where new tasks can actually go. This computes those gaps as first-class
// intervals so the UI can (a) render them as visible "breathing room" bands and
// (b) feed them to the auto-scheduler as placement candidates — instead of the
// gap math living inline in one render branch.

export interface OccupiedInterval {
  startMin: number;
  endMin: number;
}

export interface FreeRegion {
  startMin: number;
  endMin: number;
  minutes: number;
  /** The live "now" marker falls inside this region (only meaningful on today).
   *  The UI uses this to avoid double-labelling the stretch the "left today"
   *  pill already describes. */
  containsNow: boolean;
}

export interface FreeRegionsOptions {
  /** Start of the usable day window (wall-clock minutes, e.g. wake time). */
  dayStart: number;
  /** End of the usable day window (wall-clock minutes, e.g. bedtime). */
  dayEnd: number;
  /** Drop gaps shorter than this. Default 5. */
  minGapMin?: number;
  /** Live "now" in minutes; when provided, regions get a containsNow flag and
   *  the region under `now` is trimmed to start at `now` (past time isn't free).
   *  Omit for past/future days. */
  nowMin?: number;
}

/**
 * Compute the free (unoccupied) intervals within [dayStart, dayEnd].
 *
 * Occupied intervals are merged first (overlapping/parallel blocks collapse to
 * their union), then the complement inside the window is returned. Fragments
 * shorter than `minGapMin` are dropped. When `nowMin` is given, any part of the
 * window before `now` is treated as already spent, so the current region starts
 * at `now`.
 */
export function computeFreeRegions(
  occupied: OccupiedInterval[],
  opts: FreeRegionsOptions,
): FreeRegion[] {
  const { dayStart, dayEnd, minGapMin = 5, nowMin } = opts;
  if (dayEnd <= dayStart) return [];

  // The earliest free time can't be in the past.
  const windowStart = nowMin != null ? Math.max(dayStart, nowMin) : dayStart;
  if (dayEnd <= windowStart) return [];

  // Clamp + keep only intervals that actually intersect the window.
  const clamped = occupied
    .map(o => ({
      startMin: Math.max(dayStart, Math.min(o.startMin, o.endMin)),
      endMin: Math.min(dayEnd, Math.max(o.startMin, o.endMin)),
    }))
    .filter(o => o.endMin > o.startMin)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Merge overlapping / touching occupied intervals into their union.
  const merged: OccupiedInterval[] = [];
  for (const iv of clamped) {
    const last = merged[merged.length - 1];
    if (last && iv.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, iv.endMin);
    } else {
      merged.push({ ...iv });
    }
  }

  // Walk the window, emitting the gaps between merged occupied intervals.
  const regions: FreeRegion[] = [];
  let cursor = windowStart;
  const pushRegion = (start: number, end: number) => {
    const s = Math.max(start, windowStart);
    if (end - s >= minGapMin) {
      regions.push({
        startMin: s,
        endMin: end,
        minutes: end - s,
        containsNow: nowMin != null && nowMin >= s && nowMin < end,
      });
    }
  };

  for (const iv of merged) {
    if (iv.startMin > cursor) pushRegion(cursor, iv.startMin);
    cursor = Math.max(cursor, iv.endMin);
    if (cursor >= dayEnd) break;
  }
  if (cursor < dayEnd) pushRegion(cursor, dayEnd);

  return regions;
}

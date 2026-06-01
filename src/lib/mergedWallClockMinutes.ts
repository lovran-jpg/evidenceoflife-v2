/**
 * Merge overlapping wall-clock intervals (epoch ms) and return total length in minutes.
 *
 * Used for "how long was I focused today?" style metrics. Naively summing each
 * task/moment duration double-counts when two timers overlap or when the same
 * span exists twice (e.g. logged on both todo and focus-session moment).
 */
export function mergedWallClockFocusMinutes(intervalsMs: ReadonlyArray<{ start: number; end: number }>): number {
  const valid = intervalsMs.filter(
    ({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end > start
  );
  if (valid.length === 0) return 0;

  valid.sort((a, b) => a.start - b.start || a.end - b.end);

  let accMs = 0;
  let curS = valid[0].start;
  let curE = valid[0].end;

  for (let i = 1; i < valid.length; i++) {
    const { start, end } = valid[i];
    if (start <= curE) {
      curE = Math.max(curE, end);
    } else {
      accMs += curE - curS;
      curS = start;
      curE = end;
    }
  }
  accMs += curE - curS;
  return accMs / 60000;
}

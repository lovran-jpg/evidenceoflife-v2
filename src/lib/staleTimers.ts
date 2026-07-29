// A focus timer is meant for a bounded work session, not all-day tracking, so a
// timer that has been "running" for many hours is often one the user forgot to
// stop. Keep the threshold high enough to allow intentional long cross-day
// sessions (e.g. 34h) while still catching truly abandoned runaways.
export const STALE_TIMER_HOURS = 36;

// No genuine focus session banks anywhere near a full day of seconds. A row
// whose accumulated timer_seconds exceeds this cap is corrupt — e.g. a runaway
// wall-clock elapsed that got saved, or a timer that counted across a huge gap.
// Such values (thousands of hours) are reset to zero rather than trusted.
export const MAX_BANKED_TIMER_SECONDS = 24 * 60 * 60;

export interface RunningTimerRow {
  id: string;
  timer_started_at: string | null;
}

/**
 * Split still-running cross-day timers into the ones to keep live vs. the ones
 * to auto-stop.
 *
 * - `toPull`: elapsed is within a plausible session length → keep it running
 *   and surface it on today as a live timer.
 * - `toStop`: elapsed exceeds `maxHours`, or the start timestamp is unusable →
 *   the user forgot to stop it; stop the timer (the caller discards the bogus
 *   span and keeps the task) so it doesn't dominate today's view.
 */
export function partitionRunningTimers(
  rows: RunningTimerRow[],
  nowMs: number,
  maxHours: number = STALE_TIMER_HOURS,
): { toPull: string[]; toStop: string[] } {
  const limitMs = maxHours * 60 * 60 * 1000;
  const toPull: string[] = [];
  const toStop: string[] = [];
  for (const r of rows) {
    if (!r.timer_started_at) continue;
    const started = new Date(r.timer_started_at).getTime();
    if (!Number.isFinite(started)) {
      toStop.push(r.id); // corrupt timestamp — can't trust it, stop it
      continue;
    }
    const elapsedMs = nowMs - started;
    if (elapsedMs >= limitMs) toStop.push(r.id);
    else toPull.push(r.id);
  }
  return { toPull, toStop };
}

/**
 * Pick rows whose banked timer_seconds is implausibly large — corrupt values
 * that should be reset to zero (keeping the task and its progress). Guards
 * against a runaway wall-clock elapsed getting saved as thousands of hours.
 */
export function selectCorruptTimerIds(
  rows: { id: string; timer_seconds: number | null }[],
  maxSeconds: number = MAX_BANKED_TIMER_SECONDS,
): string[] {
  return rows
    .filter(r => (r.timer_seconds ?? 0) > maxSeconds)
    .map(r => r.id);
}

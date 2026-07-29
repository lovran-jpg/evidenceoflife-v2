import { describe, expect, it } from 'vitest';
import { partitionRunningTimers, selectCorruptTimerIds, STALE_TIMER_HOURS, MAX_BANKED_TIMER_SECONDS } from '@/lib/staleTimers';

const HOUR = 60 * 60 * 1000;
const now = Date.parse('2026-07-08T16:00:00.000Z');
const ago = (hours: number) => new Date(now - hours * HOUR).toISOString();

describe('partitionRunningTimers', () => {
  it('keeps a short-running cross-day timer live (pull to today)', () => {
    const rows = [{ id: 'fresh', timer_started_at: ago(3) }];
    const { toPull, toStop } = partitionRunningTimers(rows, now);
    expect(toPull).toEqual(['fresh']);
    expect(toStop).toEqual([]);
  });

  it('auto-stops a timer running longer than the threshold (forgot to stop)', () => {
    const rows = [{ id: 'zombie', timer_started_at: ago(40) }];
    const { toPull, toStop } = partitionRunningTimers(rows, now);
    expect(toPull).toEqual([]);
    expect(toStop).toEqual(['zombie']);
  });

  it('keeps a 34h cross-day timer running under the default threshold', () => {
    const rows = [{ id: 'long', timer_started_at: ago(34) }];
    const { toPull, toStop } = partitionRunningTimers(rows, now);
    expect(toPull).toEqual(['long']);
    expect(toStop).toEqual([]);
  });

  it('treats exactly the threshold as stale (>= boundary)', () => {
    const rows = [{ id: 'edge', timer_started_at: ago(STALE_TIMER_HOURS) }];
    const { toStop } = partitionRunningTimers(rows, now);
    expect(toStop).toEqual(['edge']);
  });

  it('keeps a timer just under the threshold live', () => {
    const rows = [{ id: 'justunder', timer_started_at: ago(STALE_TIMER_HOURS - 0.1) }];
    const { toPull } = partitionRunningTimers(rows, now);
    expect(toPull).toEqual(['justunder']);
  });

  it('splits a mixed batch correctly', () => {
    const rows = [
      { id: 'a', timer_started_at: ago(1) },
      { id: 'b', timer_started_at: ago(30) },
      { id: 'c', timer_started_at: ago(2) },
      { id: 'd', timer_started_at: ago(48) },
    ];
    const { toPull, toStop } = partitionRunningTimers(rows, now);
    expect(toPull.sort()).toEqual(['a', 'b', 'c']);
    expect(toStop.sort()).toEqual(['d']);
  });

  it('stops rows with a corrupt/unusable start timestamp', () => {
    const rows = [{ id: 'bad', timer_started_at: 'not-a-date' }];
    const { toPull, toStop } = partitionRunningTimers(rows, now);
    expect(toPull).toEqual([]);
    expect(toStop).toEqual(['bad']);
  });

  it('ignores rows without a start timestamp entirely', () => {
    const rows = [{ id: 'none', timer_started_at: null }];
    const { toPull, toStop } = partitionRunningTimers(rows, now);
    expect(toPull).toEqual([]);
    expect(toStop).toEqual([]);
  });

  it('respects a custom maxHours override', () => {
    const rows = [{ id: 'x', timer_started_at: ago(5) }];
    expect(partitionRunningTimers(rows, now, 4).toStop).toEqual(['x']);
    expect(partitionRunningTimers(rows, now, 6).toPull).toEqual(['x']);
  });
});

describe('selectCorruptTimerIds', () => {
  it('flags banked timer_seconds beyond the sane cap (thousands of hours)', () => {
    const rows = [
      { id: 'corrupt', timer_seconds: 2290 * 3600 }, // 2290:07:10-ish
      { id: 'alsoCorrupt', timer_seconds: 66 * 3600 }, // 66 hours
    ];
    expect(selectCorruptTimerIds(rows).sort()).toEqual(['alsoCorrupt', 'corrupt']);
  });

  it('leaves a plausible multi-hour session alone', () => {
    const rows = [
      { id: 'real', timer_seconds: 3 * 3600 }, // 3 hours — fine
      { id: 'edgeOk', timer_seconds: MAX_BANKED_TIMER_SECONDS }, // exactly the cap — kept
    ];
    expect(selectCorruptTimerIds(rows)).toEqual([]);
  });

  it('treats just over the cap as corrupt', () => {
    const rows = [{ id: 'over', timer_seconds: MAX_BANKED_TIMER_SECONDS + 1 }];
    expect(selectCorruptTimerIds(rows)).toEqual(['over']);
  });

  it('ignores null / zero timer_seconds', () => {
    const rows = [
      { id: 'nil', timer_seconds: null },
      { id: 'zero', timer_seconds: 0 },
    ];
    expect(selectCorruptTimerIds(rows)).toEqual([]);
  });

  it('respects a custom maxSeconds override', () => {
    const rows = [{ id: 'y', timer_seconds: 2 * 3600 }];
    expect(selectCorruptTimerIds(rows, 3600)).toEqual(['y']);
    expect(selectCorruptTimerIds(rows, 4 * 3600)).toEqual([]);
  });
});

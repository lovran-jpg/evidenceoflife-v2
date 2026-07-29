import { describe, expect, it } from 'vitest';
import {
  autoSchedule,
  estimateDurationMin,
  segmentWindow,
  inferLane,
  type SchedulableTodo,
  type DurationHistoryRow,
} from '@/lib/autoSchedule';
import { computeFreeRegions } from '@/lib/freeRegions';
import { buildSchedulingProfile } from '@/lib/schedulingProfile';

const DAY = { dayStart: 360, dayEnd: 1410 }; // 06:00 – 23:30

describe('segmentWindow', () => {
  it('maps segments to bounded windows intersected with the day', () => {
    expect(segmentWindow('morning', 360, 1410)).toEqual([360, 720]);
    expect(segmentWindow('afternoon', 360, 1410)).toEqual([720, 1080]);
    expect(segmentWindow('evening', 360, 1410)).toEqual([1080, 1410]);
  });

  it('treats anytime / unknown / null as the whole day', () => {
    expect(segmentWindow('anytime', 360, 1410)).toEqual([360, 1410]);
    expect(segmentWindow(null, 360, 1410)).toEqual([360, 1410]);
    expect(segmentWindow('nonsense', 360, 1410)).toEqual([360, 1410]);
  });
});

describe('estimateDurationMin', () => {
  const todo: SchedulableTodo = { id: 't', title: 'Leetcode', tags: ['study'] };

  it('falls back to getSmartDuration when there is no history', () => {
    // study → 60 per getSmartDuration
    expect(estimateDurationMin(todo, [])).toBe(60);
  });

  it('uses the median of real durations for the same tag+title', () => {
    const history: DurationHistoryRow[] = [
      { title: 'Leetcode', tags: ['study'], timer_seconds: 30 * 60 },
      { title: 'Leetcode', tags: ['study'], timer_seconds: 40 * 60 },
      { title: 'Leetcode', tags: ['study'], timer_seconds: 50 * 60 },
    ];
    expect(estimateDurationMin(todo, history)).toBe(40);
  });

  it('ignores sub-minute noise rows', () => {
    const history: DurationHistoryRow[] = [
      { title: 'Leetcode', tags: ['study'], timer_seconds: 5 }, // noise
      { title: 'Leetcode', tags: ['study'], timer_seconds: 20 * 60 },
    ];
    expect(estimateDurationMin(todo, history)).toBe(20);
  });

  it('falls back to same-tag median when title has no exact history (>=3 samples)', () => {
    const history: DurationHistoryRow[] = [
      { title: 'Other study A', tags: ['study'], timer_seconds: 10 * 60 },
      { title: 'Other study B', tags: ['study'], timer_seconds: 20 * 60 },
      { title: 'Other study C', tags: ['study'], timer_seconds: 30 * 60 },
    ];
    expect(estimateDurationMin(todo, history)).toBe(20);
  });
});

describe('inferLane', () => {
  it('marks deep work as focus (exclusive)', () => {
    expect(inferLane({ id: '1', title: 'Leetcode', tags: ['study'] })).toBe('focus');
    expect(inferLane({ id: '2', title: 'Write essay', tags: ['study'] })).toBe('focus');
  });

  it('marks errands and recovery as background (overlappable)', () => {
    expect(inferLane({ id: '3', title: 'buy groceries', tags: ['shopping'] })).toBe('background');
    expect(inferLane({ id: '4', title: 'take a nap' })).toBe('background');
  });
});

describe('autoSchedule', () => {
  it('places a focus task into the first fitting free region', () => {
    const free = computeFreeRegions([], DAY);
    const todos: SchedulableTodo[] = [
      { id: 'a', title: 'Leetcode', tags: ['study'], time_segment: 'anytime' },
    ];
    const s = autoSchedule(todos, free, DAY);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ todoId: 'a', startMin: 360, endMin: 420, lane: 'focus' });
  });

  it('does not let two focus tasks overlap — the second consumes remaining space', () => {
    const free = computeFreeRegions([], DAY);
    const todos: SchedulableTodo[] = [
      { id: 'a', title: 'Leetcode', tags: ['study'], time_segment: 'anytime' },
      { id: 'b', title: 'Write essay', tags: ['study'], time_segment: 'anytime' },
    ];
    const s = autoSchedule(todos, free, DAY);
    expect(s[0].endMin).toBeLessThanOrEqual(s[1].startMin);
  });

  it('respects the preferred time_segment window', () => {
    const free = computeFreeRegions([], DAY);
    const todos: SchedulableTodo[] = [
      { id: 'a', title: 'Leetcode', tags: ['study'], time_segment: 'evening' },
    ];
    const s = autoSchedule(todos, free, DAY);
    expect(s[0].startMin).toBeGreaterThanOrEqual(1080); // 18:00
  });

  it('allows a background task to overlap an occupied block', () => {
    // Whole afternoon is occupied by a focus block; a background errand should
    // still be scheduled (it overlaps), because bg ignores free-space budget.
    const occupied = [{ startMin: 720, endMin: 1080 }]; // 12:00-18:00 busy
    const free = computeFreeRegions(occupied, DAY);
    const todos: SchedulableTodo[] = [
      { id: 'bg', title: 'buy groceries', tags: ['shopping'], time_segment: 'afternoon' },
    ];
    const s = autoSchedule(todos, free, DAY);
    expect(s).toHaveLength(1);
    expect(s[0].lane).toBe('background');
    expect(s[0].startMin).toBeGreaterThanOrEqual(720);
    expect(s[0].startMin).toBeLessThan(1080); // inside the busy afternoon
  });

  it('staggers multiple background tasks so they do not share a minute', () => {
    const free = computeFreeRegions([], DAY);
    const todos: SchedulableTodo[] = [
      { id: 'b1', title: 'buy groceries', tags: ['shopping'], time_segment: 'morning' },
      { id: 'b2', title: 'buy coffee', tags: ['shopping'], time_segment: 'morning' },
    ];
    const s = autoSchedule(todos, free, DAY);
    expect(s).toHaveLength(2);
    expect(s[0].endMin).toBeLessThanOrEqual(s[1].startMin);
  });

  it('skips a task that cannot fit anywhere rather than forcing it', () => {
    // Only a tiny 10-min free slot exists, but a study task needs 60.
    const occupied = [
      { startMin: 360, endMin: 700 },
      { startMin: 710, endMin: 1410 },
    ];
    const free = computeFreeRegions(occupied, DAY);
    const todos: SchedulableTodo[] = [
      { id: 'a', title: 'Leetcode', tags: ['study'], time_segment: 'anytime' },
    ];
    expect(autoSchedule(todos, free, DAY)).toEqual([]);
  });

  it('uses learned duration to size the placement', () => {
    const free = computeFreeRegions([], DAY);
    const history: DurationHistoryRow[] = [
      { title: 'Leetcode', tags: ['study'], timer_seconds: 25 * 60 },
      { title: 'Leetcode', tags: ['study'], timer_seconds: 25 * 60 },
    ];
    const todos: SchedulableTodo[] = [
      { id: 'a', title: 'Leetcode', tags: ['study'], time_segment: 'anytime' },
    ];
    const s = autoSchedule(todos, free, { ...DAY, history });
    expect(s[0].endMin - s[0].startMin).toBe(25);
  });

  it('honours a lane override to flip a focus task into a background one', () => {
    const free = computeFreeRegions([{ startMin: 360, endMin: 1410 }], DAY); // fully busy
    const todos: SchedulableTodo[] = [
      { id: 'a', title: 'Leetcode', tags: ['study'], time_segment: 'anytime' },
    ];
    // As focus it can't fit (no free space) → skipped.
    expect(autoSchedule(todos, free, DAY)).toEqual([]);
    // Overridden to background it may overlap the busy day → scheduled.
    const s = autoSchedule(todos, free, { ...DAY, laneOverrides: { a: 'background' } });
    expect(s).toHaveLength(1);
    expect(s[0].lane).toBe('background');
  });

  it('steers an anytime task into the learned segment via a profile', () => {
    const free = computeFreeRegions([], DAY); // whole day open
    // History shows this deep-work task is always done in the evening.
    const profile = buildSchedulingProfile([
      { title: 'leetcode', tags: ['study'], startedHour: 20 },
      { title: 'leetcode', tags: ['study'], startedHour: 21 },
      { title: 'leetcode', tags: ['study'], startedHour: 22 },
    ]);
    const todos: SchedulableTodo[] = [
      { id: 'a', title: 'leetcode', tags: ['study'], time_segment: 'anytime' },
    ];
    // Without a profile it lands at the very start of the whole day (06:00).
    const noProfile = autoSchedule(todos, free, DAY);
    expect(noProfile[0].startMin).toBe(360);
    // With the profile it aims for the evening window (>= 18:00 = 1080).
    const withProfile = autoSchedule(todos, free, { ...DAY, profile });
    expect(withProfile[0].startMin).toBeGreaterThanOrEqual(1080);
    expect(withProfile[0].reason).toContain('you usually');
  });
});

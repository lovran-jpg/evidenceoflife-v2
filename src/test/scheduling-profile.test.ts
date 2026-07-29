import { describe, expect, it } from 'vitest';
import {
  hourToSegment,
  buildSchedulingProfile,
  resolveSegment,
  type HistoryEvent,
} from '@/lib/schedulingProfile';

describe('hourToSegment', () => {
  it('buckets hours into morning / afternoon / evening', () => {
    expect(hourToSegment(0)).toBe('morning');
    expect(hourToSegment(8)).toBe('morning');
    expect(hourToSegment(11)).toBe('morning');
    expect(hourToSegment(12)).toBe('afternoon');
    expect(hourToSegment(17)).toBe('afternoon');
    expect(hourToSegment(18)).toBe('evening');
    expect(hourToSegment(23)).toBe('evening');
  });
});

describe('buildSchedulingProfile', () => {
  it('learns a preferred segment when the plurality is clear', () => {
    // "leetcode" classifies as deep work; done in the morning 4/5 times.
    const events: HistoryEvent[] = [
      { title: 'leetcode', tags: ['study'], startedHour: 8 },
      { title: 'leetcode', tags: ['study'], startedHour: 9 },
      { title: 'leetcode', tags: ['study'], startedHour: 10 },
      { title: 'leetcode', tags: ['study'], startedHour: 7 },
      { title: 'leetcode', tags: ['study'], startedHour: 20 },
    ];
    const profile = buildSchedulingProfile(events);
    expect(profile.preferredSegmentByWorkType.deep).toBe('morning');
    expect(profile.sampleCount).toBe(5);
  });

  it('learns nothing below the minimum sample count', () => {
    const events: HistoryEvent[] = [
      { title: 'leetcode', tags: ['study'], startedHour: 8 },
      { title: 'leetcode', tags: ['study'], startedHour: 9 },
    ];
    const profile = buildSchedulingProfile(events); // minSamples default 3
    expect(profile.preferredSegmentByWorkType.deep).toBeUndefined();
  });

  it('learns nothing when no segment reaches the plurality threshold', () => {
    // Even 3-way split: 2/2/2 → winner is 33%, below 0.5 → no preference.
    const events: HistoryEvent[] = [
      { title: 'leetcode', tags: ['study'], startedHour: 8 },
      { title: 'leetcode', tags: ['study'], startedHour: 9 },
      { title: 'leetcode', tags: ['study'], startedHour: 13 },
      { title: 'leetcode', tags: ['study'], startedHour: 14 },
      { title: 'leetcode', tags: ['study'], startedHour: 19 },
      { title: 'leetcode', tags: ['study'], startedHour: 20 },
    ];
    const profile = buildSchedulingProfile(events);
    expect(profile.preferredSegmentByWorkType.deep).toBeUndefined();
  });

  it('ignores events without a usable tracked hour', () => {
    const events: HistoryEvent[] = [
      { title: 'leetcode', tags: ['study'], startedHour: null },
      { title: 'leetcode', tags: ['study'], startedHour: undefined },
      { title: 'leetcode', tags: ['study'], startedHour: 99 },
      { title: 'leetcode', tags: ['study'], startedHour: -1 },
    ];
    const profile = buildSchedulingProfile(events);
    expect(profile.sampleCount).toBe(0);
    expect(profile.preferredSegmentByWorkType.deep).toBeUndefined();
  });

  it('learns separate preferences for different work types', () => {
    const events: HistoryEvent[] = [
      // deep work: mornings
      { title: 'leetcode', tags: ['study'], startedHour: 8 },
      { title: 'leetcode', tags: ['study'], startedHour: 9 },
      { title: 'leetcode', tags: ['study'], startedHour: 10 },
      // recovery: evenings
      { title: 'take a nap', tags: ['health'], startedHour: 21 },
      { title: 'take a nap', tags: ['health'], startedHour: 22 },
      { title: 'take a nap', tags: ['health'], startedHour: 20 },
    ];
    const profile = buildSchedulingProfile(events);
    expect(profile.preferredSegmentByWorkType.deep).toBe('morning');
    expect(profile.preferredSegmentByWorkType.recovery).toBe('evening');
  });

  it('honours a custom threshold', () => {
    const events: HistoryEvent[] = [
      { title: 'leetcode', tags: ['study'], startedHour: 8 },
      { title: 'leetcode', tags: ['study'], startedHour: 9 },
      { title: 'leetcode', tags: ['study'], startedHour: 13 },
      { title: 'leetcode', tags: ['study'], startedHour: 14 },
      { title: 'leetcode', tags: ['study'], startedHour: 10 },
    ];
    // morning 3/5 = 0.6 ≥ 0.6 threshold → learned.
    const profile = buildSchedulingProfile(events, { pluralityThreshold: 0.6 });
    expect(profile.preferredSegmentByWorkType.deep).toBe('morning');
    // Raise the bar past 0.6 → no longer confident.
    const strict = buildSchedulingProfile(events, { pluralityThreshold: 0.7 });
    expect(strict.preferredSegmentByWorkType.deep).toBeUndefined();
  });
});

describe('resolveSegment', () => {
  const profile = buildSchedulingProfile([
    { title: 'leetcode', tags: ['study'], startedHour: 8 },
    { title: 'leetcode', tags: ['study'], startedHour: 9 },
    { title: 'leetcode', tags: ['study'], startedHour: 10 },
  ]);

  it('always honours an explicit time_segment', () => {
    expect(
      resolveSegment({ title: 'leetcode', tags: ['study'], time_segment: 'evening' }, profile),
    ).toBe('evening');
  });

  it('falls back to the learned preference when the task is anytime', () => {
    expect(
      resolveSegment({ title: 'leetcode', tags: ['study'], time_segment: 'anytime' }, profile),
    ).toBe('morning');
    expect(
      resolveSegment({ title: 'leetcode', tags: ['study'], time_segment: null }, profile),
    ).toBe('morning');
  });

  it('returns null when there is no learned preference and no explicit segment', () => {
    expect(
      resolveSegment({ title: 'buy groceries', tags: ['shopping'], time_segment: null }, profile),
    ).toBeNull();
  });

  it('returns null when no profile is supplied', () => {
    expect(
      resolveSegment({ title: 'leetcode', tags: ['study'], time_segment: null }, undefined),
    ).toBeNull();
  });
});

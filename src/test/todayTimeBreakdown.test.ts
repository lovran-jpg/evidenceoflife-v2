import { describe, expect, it } from 'vitest';
import { buildTodayWorkTypeBreakdown } from '@/lib/todayTimeBreakdown';

describe('buildTodayWorkTypeBreakdown', () => {
  it('aggregates minutes by work type and sorts descending', () => {
    const result = buildTodayWorkTypeBreakdown([
      { workType: 'deep', durationMin: 60 },
      { workType: 'admin', durationMin: 20 },
      { workType: 'deep', durationMin: 30 },
      { workType: 'recovery', durationMin: 10 },
      { workType: 'shallow', durationMin: 30 },
    ]);

    expect(result).toEqual([
      { type: 'deep', min: 90, pct: 60 },
      { type: 'shallow', min: 30, pct: 20 },
      { type: 'admin', min: 20, pct: 13 },
      { type: 'recovery', min: 10, pct: 7 },
    ]);
  });

  it('ignores non-positive and non-finite durations', () => {
    const result = buildTodayWorkTypeBreakdown([
      { workType: 'deep', durationMin: 0 },
      { workType: 'admin', durationMin: -5 },
      { workType: 'errand', durationMin: Number.NaN },
      { workType: 'recovery', durationMin: 25 },
    ]);

    expect(result).toEqual([{ type: 'recovery', min: 25, pct: 100 }]);
  });

  it('returns empty when there is no valid duration', () => {
    const result = buildTodayWorkTypeBreakdown([
      { workType: 'deep', durationMin: 0 },
      { workType: 'shallow', durationMin: -1 },
    ]);

    expect(result).toEqual([]);
  });
});

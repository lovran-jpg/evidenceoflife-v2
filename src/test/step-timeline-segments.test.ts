import { describe, it, expect } from 'vitest';
import {
  buildStepSegmentsByParent,
  type StepSessionMomentInput,
} from '@/lib/stepTimelineSegments';

// Helper: build a step-session moment for parent `p`, starting at HH:MM local
// for `mins` minutes on 2026-07-08.
function sess(
  id: string,
  parentId: string,
  startHHMM: string,
  mins: number,
  title = id,
): StepSessionMomentInput {
  const [h, m] = startHHMM.split(':').map(Number);
  const start = new Date(2026, 6, 8, h, m, 0);
  const end = new Date(start.getTime() + mins * 60000);
  return {
    id,
    text: title,
    tags: ['focus-session', 'step-session', `todo-session:${parentId}`],
    timer_started_at: start.toISOString(),
    timer_ended_at: end.toISOString(),
    timer_seconds: mins * 60,
  };
}

const DAY = '2026-07-08';

describe('buildStepSegmentsByParent', () => {
  it('groups sessions under their parent task', () => {
    const map = buildStepSegmentsByParent(
      [sess('a', 'RA', '09:00', 30), sess('b', 'RA', '10:00', 20), sess('c', 'other', '09:00', 15)],
      DAY,
    );
    expect(map.get('RA')?.segments).toHaveLength(2);
    expect(map.get('other')?.segments).toHaveLength(1);
  });

  it('positions a session at its real wall-clock window', () => {
    const map = buildStepSegmentsByParent([sess('a', 'RA', '09:00', 30)], DAY);
    const seg = map.get('RA')!.segments[0];
    expect(seg.startMin).toBe(9 * 60);
    expect(seg.endMin).toBe(9 * 60 + 30);
  });

  it('ignores moments without the step-session tag', () => {
    const generic: StepSessionMomentInput = {
      id: 'g',
      tags: ['focus-session', 'todo-session:RA'],
      timer_started_at: new Date(2026, 6, 8, 9, 0).toISOString(),
      timer_ended_at: new Date(2026, 6, 8, 9, 30).toISOString(),
    };
    const map = buildStepSegmentsByParent([generic], DAY);
    expect(map.size).toBe(0);
  });

  it('drops sessions from a different day', () => {
    const other = sess('a', 'RA', '09:00', 30);
    const map = buildStepSegmentsByParent([other], '2026-07-09');
    expect(map.size).toBe(0);
  });

  it('keeps the post-midnight slice on the next day for cross-day sessions', () => {
    const start = new Date(2026, 6, 8, 23, 30, 0);
    const end = new Date(2026, 6, 9, 1, 10, 0);
    const cross: StepSessionMomentInput = {
      id: 'cross-1',
      text: 'night step',
      tags: ['focus-session', 'step-session', 'todo-session:RA'],
      timer_started_at: start.toISOString(),
      timer_ended_at: end.toISOString(),
      timer_seconds: 100 * 60,
    };

    const nextDay = buildStepSegmentsByParent([cross], '2026-07-09');
    const seg = nextDay.get('RA')?.segments[0];
    expect(seg).toBeTruthy();
    expect(seg!.startMin).toBe(0);
    expect(seg!.endMin).toBe(70);
  });

  it('clips the first-day slice at midnight for cross-day sessions', () => {
    const start = new Date(2026, 6, 8, 23, 30, 0);
    const end = new Date(2026, 6, 9, 1, 10, 0);
    const cross: StepSessionMomentInput = {
      id: 'cross-2',
      text: 'night step',
      tags: ['focus-session', 'step-session', 'todo-session:RA'],
      timer_started_at: start.toISOString(),
      timer_ended_at: end.toISOString(),
      timer_seconds: 100 * 60,
    };

    const firstDay = buildStepSegmentsByParent([cross], '2026-07-08');
    const seg = firstDay.get('RA')?.segments[0];
    expect(seg).toBeTruthy();
    expect(seg!.startMin).toBe(23 * 60 + 30);
    expect(seg!.endMin).toBe(24 * 60);
  });

  it('gives non-overlapping sessions a single column each', () => {
    const map = buildStepSegmentsByParent(
      [sess('a', 'RA', '09:00', 30), sess('b', 'RA', '10:00', 20)],
      DAY,
    );
    for (const seg of map.get('RA')!.segments) {
      expect(seg.col).toBe(0);
      expect(seg.totalCols).toBe(1);
    }
  });

  it('lays overlapping (simultaneous) sessions side-by-side', () => {
    // Two steps worked at the same time → 2 columns.
    const map = buildStepSegmentsByParent(
      [sess('a', 'RA', '09:00', 60), sess('b', 'RA', '09:15', 30)],
      DAY,
    );
    const segs = map.get('RA')!.segments;
    expect(segs.every(s => s.totalCols === 2)).toBe(true);
    expect(new Set(segs.map(s => s.col))).toEqual(new Set([0, 1]));
  });

  it('reuses a freed column after an overlap cluster ends', () => {
    // a+b overlap (2 cols); c starts after both end → new cluster, back to 1 col.
    const map = buildStepSegmentsByParent(
      [sess('a', 'RA', '09:00', 30), sess('b', 'RA', '09:10', 30), sess('c', 'RA', '11:00', 20)],
      DAY,
    );
    const segs = map.get('RA')!.segments;
    const c = segs.find(s => s.id === 'step-seg-c')!;
    expect(c.col).toBe(0);
    expect(c.totalCols).toBe(1);
  });

  it('computes the union extent spanning all sessions', () => {
    const map = buildStepSegmentsByParent(
      [sess('a', 'RA', '09:00', 30), sess('b', 'RA', '10:30', 20)],
      DAY,
    );
    const grp = map.get('RA')!;
    expect(grp.unionStartMin).toBe(9 * 60);
    expect(grp.unionEndMin).toBe(10 * 60 + 50);
  });

  it('falls back to timer_seconds when no end timestamp', () => {
    const m: StepSessionMomentInput = {
      id: 'a',
      text: 'spot check',
      tags: ['step-session', 'todo-session:RA'],
      timer_started_at: new Date(2026, 6, 8, 9, 0).toISOString(),
      timer_ended_at: null,
      timer_seconds: 15 * 60,
    };
    const seg = buildStepSegmentsByParent([m], DAY).get('RA')!.segments[0];
    expect(seg.endMin).toBe(9 * 60 + 15);
  });

  it('enforces a minimum visible sliver for near-zero sessions', () => {
    const seg = buildStepSegmentsByParent([sess('a', 'RA', '09:00', 1)], DAY).get('RA')!.segments[0];
    expect(seg.endMin - seg.startMin).toBeGreaterThanOrEqual(4);
  });
});

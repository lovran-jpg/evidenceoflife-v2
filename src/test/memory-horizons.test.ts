import { describe, expect, it } from 'vitest';
import { buildHorizonDigest, horizonRange } from '@/lib/memoryHorizons';
import { Moment } from '@/types';

function moment(partial: Partial<Moment>): Moment {
  return {
    id: Math.random().toString(36).slice(2),
    date: '2026-05-04',
    photos: [],
    createdAt: '2026-05-04T08:00:00.000Z',
    ...partial,
  };
}

describe('horizonRange', () => {
  it('uses a Monday-based week', () => {
    // 2026-05-06 is a Wednesday.
    expect(horizonRange(new Date(2026, 4, 6), 'week')).toEqual({
      startKey: '2026-05-04',
      endKey: '2026-05-10',
    });
  });

  it('spans the full calendar month', () => {
    expect(horizonRange(new Date(2026, 4, 15), 'month')).toEqual({
      startKey: '2026-05-01',
      endKey: '2026-05-31',
    });
  });

  it('spans the full calendar year', () => {
    expect(horizonRange(new Date(2026, 6, 1), 'year')).toEqual({
      startKey: '2026-01-01',
      endKey: '2026-12-31',
    });
  });
});

describe('buildHorizonDigest', () => {
  const sel = new Date(2026, 4, 6); // Wed 2026-05-06

  it('only counts moments inside the week window', () => {
    const d = buildHorizonDigest(
      [
        moment({ date: '2026-05-03' }), // Sunday before the Monday-based week
        moment({ date: '2026-05-04' }), // in week
        moment({ date: '2026-05-10' }), // in week
        moment({ date: '2026-05-11' }), // next week
      ],
      sel,
      'week',
    );
    expect(d.moments).toBe(2);
    expect(d.activeDays).toBe(2);
  });

  it('aggregates focus minutes, photos, unique places and special marks for the month', () => {
    const d = buildHorizonDigest(
      [
        moment({ date: '2026-05-01', timer_seconds: 1800, photos: ['a', 'b'], location: { name: 'Park', lat: 1, lng: 2 } }),
        moment({ date: '2026-05-20', timer_seconds: 1800, photos: ['c'], location: { name: 'Park', lat: 1, lng: 2 }, isSpecial: true }),
        moment({ date: '2026-06-01' }), // out of month
      ],
      sel,
      'month',
    );
    expect(d.moments).toBe(2);
    expect(d.focusMinutes).toBe(60);
    expect(d.photos).toBe(3);
    expect(d.places).toBe(1);
    expect(d.special).toBe(1);
  });

  it('collects kept reflections chronologically for the year', () => {
    const d = buildHorizonDigest(
      [
        moment({ date: '2026-09-02', tags: ['daily-reflection'], text: 'later' }),
        moment({ date: '2026-02-01', tags: ['daily-reflection'], text: 'earlier' }),
        moment({ date: '2026-03-01', tags: ['daily-reflection'], text: '  ' }), // blank ignored
      ],
      sel,
      'year',
    );
    expect(d.kept.map(k => k.text)).toEqual(['earlier', 'later']);
  });

  it('is resilient to malformed input', () => {
    const d = buildHorizonDigest(null as unknown as Moment[], sel, 'week');
    expect(d.moments).toBe(0);
    expect(d.kept).toEqual([]);
  });
});

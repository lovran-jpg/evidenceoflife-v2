import { describe, expect, it } from 'vitest';
import { buildWeeklyDigest } from '@/components/views/today/WeeklyDigestCard';
import type { Moment } from '@/types';

function moment(partial: Partial<Moment> & { id: string; date: string }): Moment {
  return {
    photos: [],
    createdAt: `${partial.date}T09:00:00.000Z`,
    ...partial,
  } as Moment;
}

describe('buildWeeklyDigest', () => {
  // 2026-06-01 is a Monday; its ISO week is 2026-06-01 .. 2026-06-07.
  const inWeek = new Date(2026, 5, 3); // Wed 2026-06-03

  it('computes week bounds as Monday through Sunday', () => {
    const d = buildWeeklyDigest([], inWeek);
    expect(d.weekStartKey).toBe('2026-06-01');
    expect(d.weekEndKey).toBe('2026-06-07');
  });

  it('aggregates only moments within the week', () => {
    const d = buildWeeklyDigest(
      [
        moment({ id: 'a', date: '2026-06-01', timer_seconds: 1800, photos: ['p1.jpg'], location: { name: 'Park', lat: 0, lng: 0, category: 'park' } }),
        moment({ id: 'b', date: '2026-06-03', timer_seconds: 600, photos: ['p2.jpg', 'p3.jpg'] }),
        moment({ id: 'c', date: '2026-06-03' }),
        // Outside the week — must be ignored.
        moment({ id: 'x', date: '2026-05-31', photos: ['z.jpg'] }),
        moment({ id: 'y', date: '2026-06-08' }),
      ],
      inWeek,
    );
    expect(d.activeDays).toBe(2); // 06-01 and 06-03
    expect(d.moments).toBe(3);
    expect(d.focusMinutes).toBe(40); // (1800 + 600) / 60
    expect(d.photos).toBe(3);
    expect(d.places).toBe(1);
  });

  it('collects kept reflections in chronological order', () => {
    const d = buildWeeklyDigest(
      [
        moment({ id: 'r2', date: '2026-06-05', tags: ['daily-reflection'], text: 'second' }),
        moment({ id: 'r1', date: '2026-06-02', tags: ['daily-reflection'], text: 'first' }),
        moment({ id: 'r3', date: '2026-06-03', tags: ['daily-reflection'], text: '   ' }),
      ],
      inWeek,
    );
    expect(d.kept.map(k => k.text)).toEqual(['first', 'second']);
  });

  it('counts unique places only', () => {
    const d = buildWeeklyDigest(
      [
        moment({ id: 'a', date: '2026-06-01', location: { name: 'Cafe', lat: 0, lng: 0, category: 'coffee' } }),
        moment({ id: 'b', date: '2026-06-02', location: { name: 'Cafe', lat: 0, lng: 0, category: 'coffee' } }),
        moment({ id: 'c', date: '2026-06-03', location: { name: 'Library', lat: 0, lng: 0, category: 'other' } }),
      ],
      inWeek,
    );
    expect(d.places).toBe(2);
  });
});

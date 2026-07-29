import { describe, expect, it } from 'vitest';
import { computeFreeRegions } from '@/lib/freeRegions';

const win = { dayStart: 360, dayEnd: 1410 }; // 06:00 – 23:30

describe('computeFreeRegions', () => {
  it('returns the whole window as one region when nothing is occupied', () => {
    const r = computeFreeRegions([], win);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ startMin: 360, endMin: 1410, minutes: 1050 });
  });

  it('returns the gaps between occupied blocks', () => {
    const r = computeFreeRegions(
      [
        { startMin: 540, endMin: 600 }, // 09:00-10:00
        { startMin: 720, endMin: 780 }, // 12:00-13:00
      ],
      win,
    );
    // free: 06:00-09:00, 10:00-12:00, 13:00-23:30
    expect(r.map(x => [x.startMin, x.endMin])).toEqual([
      [360, 540],
      [600, 720],
      [780, 1410],
    ]);
  });

  it('merges overlapping / parallel occupied blocks before taking the complement', () => {
    const r = computeFreeRegions(
      [
        { startMin: 540, endMin: 660 }, // 09:00-11:00
        { startMin: 600, endMin: 720 }, // 10:00-12:00 (overlaps prev)
      ],
      win,
    );
    // occupied union 09:00-12:00 → free 06:00-09:00 and 12:00-23:30
    expect(r.map(x => [x.startMin, x.endMin])).toEqual([
      [360, 540],
      [720, 1410],
    ]);
  });

  it('merges back-to-back (touching) blocks', () => {
    const r = computeFreeRegions(
      [
        { startMin: 540, endMin: 600 },
        { startMin: 600, endMin: 660 }, // touches previous end
      ],
      win,
    );
    expect(r.map(x => [x.startMin, x.endMin])).toEqual([
      [360, 540],
      [660, 1410],
    ]);
  });

  it('drops gaps shorter than minGapMin', () => {
    const r = computeFreeRegions(
      [
        { startMin: 540, endMin: 600 },
        { startMin: 603, endMin: 660 }, // only a 3-min gap before it
      ],
      { ...win, minGapMin: 5 },
    );
    // the 3-min gap 600-603 is dropped
    expect(r.map(x => [x.startMin, x.endMin])).toEqual([
      [360, 540],
      [660, 1410],
    ]);
  });

  it('clamps occupied intervals to the window', () => {
    const r = computeFreeRegions(
      [
        { startMin: 0, endMin: 420 }, // 00:00-07:00, spills before wake
        { startMin: 1380, endMin: 1600 }, // spills past bedtime
      ],
      win,
    );
    // free 07:00-23:00
    expect(r.map(x => [x.startMin, x.endMin])).toEqual([[420, 1380]]);
  });

  it('starts the free window at now and flags the region containing now', () => {
    const r = computeFreeRegions(
      [{ startMin: 540, endMin: 600 }], // 09:00-10:00
      { ...win, nowMin: 660 }, // now = 11:00
    );
    // past (06:00-09:00 and 09:00-10:00) is gone; free starts at 11:00
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ startMin: 660, endMin: 1410, containsNow: true });
  });

  it('trims the current region to now when now sits inside a gap', () => {
    const r = computeFreeRegions(
      [
        { startMin: 540, endMin: 600 }, // 09:00-10:00
        { startMin: 780, endMin: 840 }, // 13:00-14:00
      ],
      { ...win, nowMin: 660 }, // now 11:00 — inside the 10:00-13:00 gap
    );
    // free from now(11:00)-13:00 and 14:00-23:30
    expect(r.map(x => [x.startMin, x.endMin])).toEqual([
      [660, 780],
      [840, 1410],
    ]);
    expect(r[0].containsNow).toBe(true);
    expect(r[1].containsNow).toBe(false);
  });

  it('returns nothing when the window is fully occupied', () => {
    const r = computeFreeRegions([{ startMin: 360, endMin: 1410 }], win);
    expect(r).toEqual([]);
  });

  it('returns nothing for an inverted or empty window', () => {
    expect(computeFreeRegions([], { dayStart: 1000, dayEnd: 1000 })).toEqual([]);
    expect(computeFreeRegions([], { dayStart: 1000, dayEnd: 500 })).toEqual([]);
  });

  it('returns nothing when now is at or past the day end', () => {
    expect(computeFreeRegions([], { ...win, nowMin: 1410 })).toEqual([]);
    expect(computeFreeRegions([], { ...win, nowMin: 1500 })).toEqual([]);
  });
});

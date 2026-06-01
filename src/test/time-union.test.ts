import { describe, expect, it } from 'vitest';
import { mergedWallClockFocusMinutes } from '@/lib/mergedWallClockMinutes';
import { unionMinutesInWindow } from '@/lib/dayMinuteIntervals';

describe('wall-clock time union helpers', () => {
  it('does not double-count overlapping focused intervals', () => {
    const minute = 60_000;
    expect(
      mergedWallClockFocusMinutes([
        { start: 0, end: 60 * minute },
        { start: 30 * minute, end: 90 * minute },
      ]),
    ).toBe(90);
  });

  it('does not overfill execution chart buckets when tasks overlap', () => {
    expect(
      unionMinutesInWindow(
        [
          { startMin: 14 * 60, endMin: 15 * 60 },
          { startMin: 14 * 60 + 15, endMin: 15 * 60 + 15 },
        ],
        14 * 60,
        14 * 60 + 30,
      ),
    ).toBe(30);
  });
});

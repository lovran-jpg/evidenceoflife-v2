import { describe, expect, it } from 'vitest';
import { pickOnThisDayMemory } from '@/components/views/today/OnThisDayCard';
import type { Moment } from '@/types';

function moment(partial: Partial<Moment> & { id: string; date: string }): Moment {
  return {
    photos: [],
    createdAt: `${partial.date}T09:00:00.000Z`,
    ...partial,
  } as Moment;
}

describe('pickOnThisDayMemory', () => {
  const selected = new Date(2026, 5, 1); // 2026-06-01

  it('returns null when there is no past history', () => {
    expect(pickOnThisDayMemory([], selected)).toBeNull();
    expect(
      pickOnThisDayMemory([moment({ id: 'a', date: '2026-06-01', text: 'today' })], selected),
    ).toBeNull();
  });

  it('prefers the same month/day in a previous year', () => {
    const result = pickOnThisDayMemory(
      [
        moment({ id: 'y1', date: '2025-06-01', text: 'one year ago' }),
        moment({ id: 'm1', date: '2026-05-01', text: 'last month' }),
        moment({ id: 'd1', date: '2026-05-10', text: 'days ago', isSpecial: true }),
      ],
      selected,
    );
    expect(result?.kind).toBe('year');
    expect(result?.amount).toBe(1);
    expect(result?.dateStr).toBe('2025-06-01');
  });

  it('falls back to same day-of-month last month', () => {
    const result = pickOnThisDayMemory(
      [
        moment({ id: 'm1', date: '2026-05-01', text: 'last month' }),
        moment({ id: 'd1', date: '2026-05-10', text: 'days ago', isSpecial: true }),
      ],
      selected,
    );
    expect(result?.kind).toBe('month');
    expect(result?.dateStr).toBe('2026-05-01');
  });

  it('falls back to a memorable day at least 14 days back', () => {
    const result = pickOnThisDayMemory(
      [
        moment({ id: 'recent', date: '2026-05-28', text: 'too recent' }),
        moment({ id: 'old', date: '2026-05-10', text: 'memorable', photos: ['p.jpg'] }),
      ],
      selected,
    );
    expect(result?.kind).toBe('days');
    expect(result?.dateStr).toBe('2026-05-10');
    expect(result?.amount).toBe(22);
  });

  it('ignores recent non-memorable days', () => {
    const result = pickOnThisDayMemory(
      [moment({ id: 'recent', date: '2026-05-30', text: 'just text' })],
      selected,
    );
    expect(result).toBeNull();
  });
});

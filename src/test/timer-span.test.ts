import { describe, expect, it } from 'vitest';
import { buildTimerSpanISO } from '@/components/views/today/todayHelpers';

const localKey = (iso: string) => {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
const localHM = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

describe('buildTimerSpanISO', () => {
  it('keeps a normal same-day span on the fallback date', () => {
    const span = buildTimerSpanISO('09:00', '10:30', { fallbackDateStr: '2026-06-02' });
    expect(span).not.toBeNull();
    expect(localKey(span!.startISO)).toBe('2026-06-02');
    expect(localKey(span!.endISO)).toBe('2026-06-02');
    expect(span!.seconds).toBe(90 * 60);
  });

  it('rolls an overnight end to the next day (the forgotten-timer bug)', () => {
    // Started yesterday 23:30, stopped this morning 09:30.
    const span = buildTimerSpanISO('23:30', '09:30', {
      anchorISO: '2026-06-01T23:30:00',
      fallbackDateStr: '2026-06-02',
    });
    expect(span).not.toBeNull();
    // Start stays on the anchor's day, end rolls to the following day.
    expect(localKey(span!.startISO)).toBe('2026-06-01');
    expect(localKey(span!.endISO)).toBe('2026-06-02');
    expect(localHM(span!.startISO)).toBe('23:30');
    expect(localHM(span!.endISO)).toBe('09:30');
    expect(span!.seconds).toBe(10 * 60 * 60); // 10 hours, not negative
  });

  it('anchors the start date to an existing timestamp, ignoring the fallback day', () => {
    const span = buildTimerSpanISO('08:00', '09:00', {
      anchorISO: '2026-05-20T08:00:00',
      fallbackDateStr: '2026-06-02',
    });
    expect(span).not.toBeNull();
    expect(localKey(span!.startISO)).toBe('2026-05-20');
    expect(localKey(span!.endISO)).toBe('2026-05-20');
    expect(span!.seconds).toBe(60 * 60);
  });

  it('treats equal start and end as a zero-length span (no 24h roll)', () => {
    const span = buildTimerSpanISO('09:00', '09:00', { fallbackDateStr: '2026-06-02' });
    expect(span).not.toBeNull();
    expect(localKey(span!.endISO)).toBe('2026-06-02');
    expect(span!.seconds).toBe(0);
  });

  it('returns null for malformed time strings', () => {
    expect(buildTimerSpanISO('9:00', '10:00', { fallbackDateStr: '2026-06-02' })).toBeNull();
    expect(buildTimerSpanISO('09:00', 'noon', { fallbackDateStr: '2026-06-02' })).toBeNull();
  });
});

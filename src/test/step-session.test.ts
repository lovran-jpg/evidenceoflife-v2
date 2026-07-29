import { describe, expect, it } from 'vitest';
import { computeStepSession } from '@/lib/stepSession';

describe('computeStepSession', () => {
  const start = '2026-07-08T22:00:00.000Z';
  const startMs = new Date(start).getTime();

  it('returns the session window for a running step', () => {
    const now = startMs + 7 * 60 * 1000 + 11 * 1000; // 7m11s later
    const session = computeStepSession({ timer_started_at: start }, now);
    expect(session).not.toBeNull();
    expect(session!.startISO).toBe(start);
    expect(session!.endISO).toBe(new Date(now).toISOString());
    expect(session!.seconds).toBe(7 * 60 + 11);
  });

  it('returns null when the step is not running', () => {
    expect(computeStepSession({ timer_started_at: null }, startMs + 60000)).toBeNull();
    expect(computeStepSession({ timer_started_at: undefined }, startMs + 60000)).toBeNull();
  });

  it('returns null for an unparseable start timestamp', () => {
    expect(computeStepSession({ timer_started_at: 'not-a-date' }, startMs + 60000)).toBeNull();
  });

  it('returns null when elapsed is zero or negative (clock skew)', () => {
    expect(computeStepSession({ timer_started_at: start }, startMs)).toBeNull();
    expect(computeStepSession({ timer_started_at: start }, startMs - 5000)).toBeNull();
  });

  it('returns null for sub-threshold accidental taps', () => {
    const now = startMs + 500; // 0.5s
    expect(computeStepSession({ timer_started_at: start }, now)).toBeNull();
    // custom minSeconds
    expect(computeStepSession({ timer_started_at: start }, startMs + 3000, 5)).toBeNull();
    expect(computeStepSession({ timer_started_at: start }, startMs + 6000, 5)).not.toBeNull();
  });

  it('returns null for a forgotten/corrupt timer beyond 24h', () => {
    const now = startMs + 25 * 60 * 60 * 1000; // 25h
    expect(computeStepSession({ timer_started_at: start }, now)).toBeNull();
  });

  it('accepts a session just under the 24h cap', () => {
    const now = startMs + (24 * 60 * 60 * 1000 - 1000); // 23h59m59s
    const session = computeStepSession({ timer_started_at: start }, now);
    expect(session).not.toBeNull();
    expect(session!.seconds).toBe(24 * 60 * 60 - 1);
  });

  it('preserves a cross-midnight window as-is (start before, end after 00:00)', () => {
    const s = '2026-07-08T23:40:00.000Z';
    const sMs = new Date(s).getTime();
    const now = sMs + 40 * 60 * 1000; // 00:20 next day
    const session = computeStepSession({ timer_started_at: s }, now);
    expect(session!.startISO).toBe(s);
    expect(session!.seconds).toBe(40 * 60);
  });
});

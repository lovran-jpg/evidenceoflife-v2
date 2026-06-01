import { describe, expect, it } from 'vitest';
import { parseDateFromText } from '@/lib/parseDateFromText';

const currentYear = new Date().getFullYear();

describe('parseDateFromText', () => {
  it('returns null for text without a date', () => {
    const result = parseDateFromText('buy milk');
    expect(result.parsedDate).toBeNull();
    expect(result.hasTime).toBe(false);
    expect(result.cleanTitle).toBe('buy milk');
  });

  it('parses an English "Month day" date with explicit year and time', () => {
    const result = parseDateFromText('Submit essay Apr 22, 2026 11:59 PM');
    expect(result.parsedDate).toBe('2026-04-22T23:59');
    expect(result.hasTime).toBe(true);
    expect(result.cleanTitle).toBe('Submit essay');
  });

  it('parses a "day Month" date and strips it from the title', () => {
    const result = parseDateFromText('5th March 16:00 dentist');
    expect(result.parsedDate).toBe(`${currentYear}-03-05T16:00`);
    expect(result.hasTime).toBe(true);
    expect(result.cleanTitle).toBe('dentist');
  });

  it('defaults to the current year when none is provided', () => {
    const result = parseDateFromText('pay rent March 5');
    expect(result.parsedDate).toBe(`${currentYear}-03-05T00:00`);
    expect(result.hasTime).toBe(false);
  });

  it('parses numeric dates with a full year', () => {
    const result = parseDateFromText('meeting 2025/3/13 11:59 PM');
    expect(result.parsedDate).toBe('2025-03-13T23:59');
    expect(result.hasTime).toBe(true);
    expect(result.cleanTitle).toBe('meeting');
  });

  it('parses short numeric dates without a year', () => {
    const result = parseDateFromText('3.13 12:00 review');
    expect(result.parsedDate).toBe(`${currentYear}-03-13T12:00`);
    expect(result.hasTime).toBe(true);
  });

  it('parses numeric dates with lowercase am/pm', () => {
    const result = parseDateFromText('call mom 3/13 9:30 am');
    expect(result.parsedDate).toBe(`${currentYear}-03-13T09:30`);
    expect(result.hasTime).toBe(true);
    expect(result.cleanTitle).toBe('call mom');
  });

  it('rejects out-of-range months and days', () => {
    expect(parseDateFromText('99/99').parsedDate).toBeNull();
  });
});

/**
 * Shared date parser: extracts date/time from a text string.
 * Reused by Dues (deadline parsing) and Calendar (quick event creation).
 */

const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const TIME_FRAGMENT = '(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?|\\d{1,2}:\\d{2})';

function parseTimeValue(rawTime?: string): { hour: number; minute: number; hasTime: boolean } {
  if (!rawTime) return { hour: 0, minute: 0, hasTime: false };

  const normalized = rawTime.trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return { hour: 0, minute: 0, hasTime: false };

  let hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  const meridiem = match[3];

  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) {
    return { hour: 0, minute: 0, hasTime: false };
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) return { hour: 0, minute: 0, hasTime: false };
    if (meridiem === 'am') {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
  }

  return { hour, minute, hasTime: true };
}

// Pattern 1: English dates like "5th March 16:00", "March 5 16:00", "Apr 22, 2026 11:59 PM"
const ENGLISH_DATE_REGEX = new RegExp(
  '(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\s+)?' +
  '(?:' +
    '(\\d{1,2})(?:st|nd|rd|th)?\\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)' +
    '|(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\\s+(\\d{1,2})(?:st|nd|rd|th)?' +
  ')' +
  '(?:\\s*[,，]?\\s*(\\d{4}))?' +
  '(?:\\s*[,，]?\\s*' + TIME_FRAGMENT + ')?',
  'i'
);

// Variant: allow comma (ASCII or Chinese) between day and time, e.g. "March 16,23:59" / "March 16，23:59"
const ENGLISH_DATE_WITH_COMMA_REGEX = new RegExp(
  '(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\s+)?' +
  '(?:' +
    '(\\d{1,2})(?:st|nd|rd|th)?\\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)' +
    '|(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\\s+(\\d{1,2})(?:st|nd|rd|th)?' +
  ')' +
  '(?:\\s*[,，]?\\s*(\\d{4}))?' +
  '(?:\\s*[,，]\\s*' + TIME_FRAGMENT + ')?',
  'i'
);

// Pattern 2: Numeric dates like "3.13 12:00", "3/13", "2025.3.13", "2025/3/13 11:59 PM"
const NUMERIC_DATE_REGEX = /(\d{4}[./-]\d{1,2}[./-]\d{1,2}(?:\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)?|\d{1,2}[./-]\d{1,2}(?:\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)?)/;

export interface ParsedDateResult {
  cleanTitle: string;
  parsedDate: string | null;   // ISO-like "yyyy-MM-ddTHH:mm"
  hasTime: boolean;            // whether time was explicitly provided
}

export function parseDateFromText(raw: string): ParsedDateResult {
  const now = new Date();
  const currentYear = now.getFullYear();

  let year = currentYear, month = 0, day = 0, hour = 0, minute = 0;
  let matched = '';
  let hasTime = false;
  let yearExplicit = false;

  // Try English date first (plain space version, then comma variant)
  const engMatch = raw.match(ENGLISH_DATE_REGEX) || raw.match(ENGLISH_DATE_WITH_COMMA_REGEX);
  if (engMatch) {
    matched = engMatch[0];
    if (engMatch[1] && engMatch[2]) {
      day = parseInt(engMatch[1]);
      month = MONTH_NAMES[engMatch[2].toLowerCase()] || 0;
    } else if (engMatch[3] && engMatch[4]) {
      month = MONTH_NAMES[engMatch[3].toLowerCase()] || 0;
      day = parseInt(engMatch[4]);
    }
    if (engMatch[5]) { year = parseInt(engMatch[5]); yearExplicit = true; }
    const parsedTime = parseTimeValue(engMatch[6]);
    hour = parsedTime.hour;
    minute = parsedTime.minute;
    hasTime = parsedTime.hasTime;
  } else {
    // Try numeric date
    const numMatch = raw.match(NUMERIC_DATE_REGEX);
    if (!numMatch) return { cleanTitle: raw, parsedDate: null, hasTime: false };

    matched = numMatch[0];
    const parts = matched.split(/\s+/);
    const datePart = parts[0];
    const timePart = parts.slice(1).join(' ');
    const dateNums = datePart.split(/[./]/).map(Number);

    if (dateNums.length === 3) {
      [year, month, day] = dateNums;
      yearExplicit = true;
    } else if (dateNums.length === 2) {
      [month, day] = dateNums;
    }
    if (timePart) {
      const parsedTime = parseTimeValue(timePart);
      hour = parsedTime.hour;
      minute = parsedTime.minute;
      hasTime = parsedTime.hasTime;
    }
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { cleanTitle: raw, parsedDate: null, hasTime: false };
  }

  // If year was not explicitly provided, always use current calendar year
  // （用户没写年份就按“本年”来）
  if (!yearExplicit) {
    year = currentYear;
  }

  const parsedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const cleanTitle = raw
    .replace(matched, '')
    .replace(/\s*[,，]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { cleanTitle, parsedDate, hasTime };
}

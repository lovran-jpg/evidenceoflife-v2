/** Wall-clock bounds for the plan timeline rail — keep all “time left in day” UIs on the same definition */

export const PLAN_TIMELINE_WAKE_HOUR = 6;
export const PLAN_TIMELINE_BEDTIME_HOUR = 23;
export const PLAN_TIMELINE_BEDTIME_MINUTE = 30;

export const PLAN_TIMELINE_WAKE_TOTAL_MIN = PLAN_TIMELINE_WAKE_HOUR * 60;
export const PLAN_TIMELINE_BED_TOTAL_MIN =
  PLAN_TIMELINE_BEDTIME_HOUR * 60 + PLAN_TIMELINE_BEDTIME_MINUTE;

/** The timeline axis spans a single calendar day: 00:00 -> 24:00.
 *  Post-midnight activity belongs to the NEXT calendar day (rendered at that
 *  day's top / early morning) instead of being appended to the bottom of the
 *  current day. A session that crosses midnight is shown up to 00:00 on the day
 *  it started, and its remainder appears as an early-morning "tail" on the next
 *  day. */
export const PLAN_TIMELINE_AXIS_START_HOUR = 0;
export const PLAN_TIMELINE_AXIS_START_MIN = 0;
export const PLAN_TIMELINE_END_HOUR_CONTINUOUS = 24; // midnight (00:00 next day)
export const PLAN_TIMELINE_END_TOTAL_MIN = PLAN_TIMELINE_END_HOUR_CONTINUOUS * 60; // 1440

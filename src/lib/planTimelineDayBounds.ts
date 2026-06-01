/** Wall-clock bounds for the plan timeline rail — keep all “time left in day” UIs on the same definition */

export const PLAN_TIMELINE_WAKE_HOUR = 6;
export const PLAN_TIMELINE_BEDTIME_HOUR = 23;
export const PLAN_TIMELINE_BEDTIME_MINUTE = 30;

export const PLAN_TIMELINE_WAKE_TOTAL_MIN = PLAN_TIMELINE_WAKE_HOUR * 60;
export const PLAN_TIMELINE_BED_TOTAL_MIN =
  PLAN_TIMELINE_BEDTIME_HOUR * 60 + PLAN_TIMELINE_BEDTIME_MINUTE;

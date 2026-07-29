import type { WorkType } from '@/lib/workType';

export interface TodayWorkTypeRow {
  workType: WorkType;
  durationMin: number;
}

export interface TodayWorkTypeBreakdownItem {
  type: WorkType;
  min: number;
  pct: number;
}

/**
 * Aggregate today's recorded minutes by work type.
 *
 * Input rows are expected to be already scoped to one day and already converted
 * into duration minutes. Non-positive durations are ignored.
 */
export function buildTodayWorkTypeBreakdown(rows: TodayWorkTypeRow[]): TodayWorkTypeBreakdownItem[] {
  const totals: Record<WorkType, number> = {
    deep: 0,
    shallow: 0,
    admin: 0,
    errand: 0,
    recovery: 0,
  };

  for (const row of rows) {
    if (!Number.isFinite(row.durationMin) || row.durationMin <= 0) continue;
    totals[row.workType] += row.durationMin;
  }

  const totalMin = Object.values(totals).reduce((sum, min) => sum + min, 0);
  if (totalMin <= 0) return [];

  return (Object.entries(totals) as Array<[WorkType, number]>)
    .filter(([, min]) => min > 0)
    .map(([type, min]) => ({
      type,
      min,
      pct: Math.round((min / totalMin) * 100),
    }))
    .sort((a, b) => b.min - a.min);
}

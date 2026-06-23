import { useState, useEffect, useMemo } from 'react';
import { format, differenceInMinutes, parseISO, subDays, startOfDay, isSameDay } from 'date-fns';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { DueWithStats } from '@/hooks/useDues';

export function getTimeLeft(due: string, t: (key: string) => string, isCompleted?: boolean) {
  const dueDate = parseISO(due);
  if (isCompleted) return { text: t('dues.completedLabel'), urgent: false, overdue: false };
  const now = new Date();
  const totalMins = differenceInMinutes(dueDate, now);
  if (totalMins < 0) {
    const absMins = Math.abs(totalMins);
    const days = Math.floor(absMins / (60 * 24));
    const hrs = Math.floor((absMins % (60 * 24)) / 60);
    const mins = absMins % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0 && days === 0) parts.push(`${mins}m`);
    return { text: `${parts.join(' ')} ${t('dues.overdue')}`, urgent: true, overdue: true };
  }
  const days = Math.floor(totalMins / (60 * 24));
  const hrs = Math.floor((totalMins % (60 * 24)) / 60);
  const mins = totalMins % 60;
  if (days === 0 && hrs === 0) return { text: `${mins}m ${t('dues.left')}`, urgent: true, overdue: false };
  if (days === 0) return { text: `${hrs}h ${mins}m ${t('dues.left')}`, urgent: true, overdue: false };
  if (days <= 3) {
    const parts = [`${days}d`];
    if (hrs > 0) parts.push(`${hrs}h`);
    return { text: `${parts.join(' ')} ${t('dues.left')}`, urgent: true, overdue: false };
  }
  return { text: `${days}d ${hrs}h ${t('dues.left')}`, urgent: false, overdue: false };
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

/**
 * 28-day grid used inside the full DueCard. Each cell is a tiny dot showing
 * whether that day's habit count was met. Today gets a ring; past days fill in.
 */
export function HabitPunchCard({ dueId, totalCount }: { dueId: string; totalCount: number }) {
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  useEffect(() => {
    supabase.from('todos').select('date').eq('parent_due_id', dueId).eq('is_completed', true)
      .then(({ data }) => { if (data) setCompletedDates(data.map(d => d.date)); });
  }, [dueId, totalCount]);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 28 }, (_, i) => {
      const d = subDays(today, 27 - i);
      return { date: d, done: completedDates.includes(format(d, 'yyyy-MM-dd')) };
    });
  }, [completedDates]);

  const doneCount = useMemo(() => days.filter(d => d.done).length, [days]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap" style={{ height: 36 }}>
        {days.map((day, i) => (
          <div key={i} title={format(day.date, 'MM/dd')} className={cn(
            "rounded-[2px] transition-colors",
            day.done ? "bg-primary/80" : isSameDay(day.date, new Date()) ? "bg-primary/20 border border-primary/30" : "bg-secondary/60"
          )} style={{ width: 8, height: 8, gap: 6 }} />
        ))}
      </div>
      {doneCount > 0 && <span className="text-[12px] font-medium text-muted-foreground">{doneCount} / 28 days</span>}
    </div>
  );
}

/**
 * Compact streak strip — 14 days, current day on the right.
 * Lives inline on CompactHabitCard so the user sees momentum at a glance.
 */
function CompactStreakStrip({ dueId, refreshKey }: { dueId: string; refreshKey: number }) {
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    supabase.from('todos').select('date').eq('parent_due_id', dueId).eq('is_completed', true)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setCompletedDates(new Set(data.map(d => d.date)));
      });
    return () => { cancelled = true; };
  }, [dueId, refreshKey]);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, i) => {
      const d = subDays(today, 13 - i);
      const isToday = isSameDay(d, new Date());
      return {
        key: format(d, 'yyyy-MM-dd'),
        done: completedDates.has(format(d, 'yyyy-MM-dd')),
        isToday,
      };
    });
  }, [completedDates]);

  return (
    <div className="flex items-center gap-[3px]">
      {days.map(d => (
        <span
          key={d.key}
          title={d.key}
          aria-hidden
          className={cn(
            'h-2.5 w-[5px] rounded-[2px] transition-colors',
            d.done
              ? 'bg-[hsl(var(--habit))]'
              : d.isToday
                ? 'border border-[hsl(var(--habit)/0.45)] bg-[hsl(var(--habit)/0.08)]'
                : 'bg-[hsl(var(--surface-soft-hover))]',
          )}
        />
      ))}
    </div>
  );
}

/**
 * Circular check-in button with progress ring.
 * Tap to increment toward target. Fills as you progress; flips to a checkmark when met.
 */
function CheckinRing({
  count,
  target,
  onIncrement,
  size = 44,
  ariaLabel,
}: {
  count: number;
  target: number;
  onIncrement: () => void;
  size?: number;
  ariaLabel?: string;
}) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const ratio = Math.min(1, count / Math.max(1, target));
  const met = count >= target;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onIncrement(); }}
      aria-label={ariaLabel || `Check in (${count} of ${target})`}
      className={cn(
        'group/checkin relative flex flex-shrink-0 items-center justify-center rounded-full transition-transform',
        'hover:scale-[1.05] active:scale-[0.96]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--habit)/0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="hsl(var(--surface-soft-hover))"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="hsl(var(--habit))"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-[12px] font-semibold tabular-nums leading-none transition-colors',
          met ? 'text-[hsl(var(--habit))]' : 'text-foreground/80',
        )}
      >
        {met ? <Check size={16} strokeWidth={2.6} /> : `${count}/${target}`}
      </span>
    </button>
  );
}

export function CompactHabitCard({
  due,
  onIncrement,
  onToggleExpand,
  expanded,
}: {
  due: DueWithStats;
  onIncrement: () => void;
  onToggleExpand: () => void;
  expanded: boolean;
}) {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayCount = due.dailyCounts?.[todayKey] || 0;
  const targetCount = Math.max(1, due.targetCount || 1);
  const links = due.links || [];
  const hasLinks = links.length > 0;

  return (
    <div
      id={`habit-compact-${due.id}`}
      role="button"
      tabIndex={0}
      onClick={onToggleExpand}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpand();
        }
      }}
      className={cn(
        'rounded-2xl border bg-card px-3.5 py-3 shadow-[0_4px_10px_hsl(var(--foreground)/0.03)] transition-colors',
        expanded
          ? 'border-[hsl(var(--habit)/0.45)] bg-[hsl(var(--habit)/0.05)]'
          : 'border-border/70 hover:bg-[hsl(var(--surface-soft-hover))]',
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14px] font-semibold leading-tight text-foreground">{due.title}</p>
            {hasLinks && (
              <span
                aria-label={`${links.length} linked actions`}
                title={`${links.length} linked actions`}
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--habit)/0.14)] px-1 text-[10px] font-semibold leading-none text-[hsl(var(--habit))]"
              >
                {links.length}
              </span>
            )}
          </div>
          <div className="mt-2">
            <CompactStreakStrip dueId={due.id} refreshKey={todayCount} />
          </div>
        </div>

        <CheckinRing
          count={todayCount}
          target={targetCount}
          onIncrement={onIncrement}
          ariaLabel={`Check in: ${due.title}`}
        />
      </div>
    </div>
  );
}

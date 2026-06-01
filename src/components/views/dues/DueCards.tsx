import { useState, useEffect, useMemo } from 'react';
import { format, differenceInMinutes, parseISO, subDays, startOfDay, isSameDay } from 'date-fns';
import { ChevronDown, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { DueWithStats, DueLink } from '@/hooks/useDues';
import { CompactHabitLinkThumb } from '@/components/views/dues/DueLinkItems';

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

/* ── Habit Punch Card ── */
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

export function CompactHabitCard({
  due,
  onIncrement,
  onManage,
  onToggleExpand,
  onUpdateLinks,
  expanded,
}: {
  due: DueWithStats;
  onIncrement: () => void;
  onManage: () => void;
  onToggleExpand: () => void;
  onUpdateLinks: (links: DueLink[]) => void;
  expanded: boolean;
}) {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayCount = due.dailyCounts?.[todayKey] || 0;
  const targetCount = Math.max(1, due.targetCount || 1);
  const accentColor = '#2dd4bf';
  const links = due.links || [];

  const incrementLinkCount = (index: number) => {
    onUpdateLinks(links.map((l, i) => i === index ? { ...l, count: (l.count || 0) + 1 } : l));
  };

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
        "rounded-[16px] border border-border/70 bg-card px-3 py-2.5 shadow-[0_4px_10px_hsl(var(--foreground)/0.03)] transition-colors",
        expanded ? "border-[#2dd4bf]/45 bg-[rgba(45,212,191,0.05)]" : "hover:bg-[hsl(var(--surface-soft-hover))]"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-1 h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold leading-tight text-foreground">{due.title}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/75">
                <span>{todayCount}/{targetCount} Today</span>
              </div>
            </div>
            <ChevronDown
              size={14}
              className={cn("flex-shrink-0 mt-0.5 text-muted-foreground/40 transition-transform duration-200", expanded && "rotate-180")}
            />
          </div>

          {/* Links as primary content — shown directly on compact card */}
          {links.length > 0 ? (
            <div className="mt-2 space-y-1.5" onClick={e => e.stopPropagation()}>
              {links.map((link, i) => (
                <div key={`${link.url}-${i}`} className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/40 px-2.5 py-1.5">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex-1 min-w-0 flex items-center gap-1.5"
                  >
                    <CompactHabitLinkThumb link={link} />
                    <span className="truncate text-[12px] font-medium text-foreground">{link.label || link.title || link.url}</span>
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); incrementLinkCount(i); }}
                    className="flex-shrink-0 h-6 px-2 rounded-lg border border-[rgba(45,212,191,0.28)] bg-[rgba(45,212,191,0.08)] text-[11px] font-semibold text-[#149d8d] hover:bg-[rgba(45,212,191,0.16)] transition-colors whitespace-nowrap"
                  >
                    +1 · {link.count || 0}×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onIncrement(); }}
                className="inline-flex items-center rounded-full border border-[rgba(45,212,191,0.28)] bg-[rgba(45,212,191,0.08)] px-2.5 py-1.25 text-[11px] font-semibold leading-none text-[#149d8d] transition-colors hover:bg-[rgba(45,212,191,0.14)]"
              >
                + Check in
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onManage(); }}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1.25 text-[11px] font-medium leading-none text-[hsl(var(--text-soft))] transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Pencil size={10} />Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

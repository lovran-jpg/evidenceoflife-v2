import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { addDays, format, parseISO, startOfWeek, subDays } from 'date-fns';
import { EyeOff, Eye, Pencil, Check, X, CheckCircle2, ChevronUp, ChevronDown, Timer, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { Moment, TodayMode } from '@/types';
import { Todo } from '@/hooks/useTodos';
import { ImportedEvent } from '@/hooks/useImportedEvents';
import { DueLink, DueWithStats } from '@/hooks/useDues';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  localTimeOnDateISO,
  durationSeconds,
  getImportedEventEffectiveStart,
  getImportedEventEffectiveEnd,
  parseSubtitleDetail,
  buildLocalLifeReplay,
} from './todayHelpers';

export const recapTimeInputClassName = "min-h-8 w-[64px] rounded-lg border border-border/35 bg-[hsl(var(--surface-soft))] px-2 py-1 text-center font-mono text-[15px] tabular-nums tracking-[-0.03em] text-foreground shadow-[inset_0_1px_0_hsl(var(--surface-contrast)/0.65)] focus:outline-none focus:ring-1 focus:ring-primary/35";

function getTimeDisplayVisible(): boolean {
  const stored = localStorage.getItem('time-display-style');
  if (stored === 'hidden') return false;
  const oldVal = localStorage.getItem('show-time-display');
  if (oldVal === 'false') return false;
  return true;
}

export function DayTimeDisplay({ mode, todosDone, todosTotal, timeRecordedPct, bedtimeHour, bedtimeMinute, wakeHour, wakeMinute, onWakeChange, onBedtimeChange, selectedDate, compact }: { mode?: TodayMode; todosDone?: number; todosTotal?: number; timeRecordedPct?: number; bedtimeHour: number; bedtimeMinute: number; wakeHour: number; wakeMinute: number; onWakeChange?: (h: number, m: number) => void; onBedtimeChange?: (h: number, m: number) => void; selectedDate?: Date; compact?: boolean }) {
  const { t } = useLanguage();
  const [now, setNow] = useState(new Date());
  const [visible, setVisible] = useState(getTimeDisplayVisible());
  const [editingWake, setEditingWake] = useState(false);
  const [editingBed, setEditingBed] = useState(false);
  const [editWakeVal, setEditWakeVal] = useState('');
  const [editBedVal, setEditBedVal] = useState('');
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isEditingTime = editingWake || editingBed;

  const toggleVisible = () => {
    const next = !visible;
    setVisible(next);
    localStorage.setItem('time-display-style', next ? 'digits' : 'hidden');
  };

  // Determine day relation to avoid syncing all dates with "today"
  const dayRelation = useMemo<'past' | 'today' | 'future'>(() => {
    if (!selectedDate) return 'today';
    const now = new Date();
    const selected = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (selected.getTime() < current.getTime()) return 'past';
    if (selected.getTime() > current.getTime()) return 'future';
    return 'today';
  }, [selectedDate]);
  const isToday = dayRelation === 'today';

  useEffect(() => {
    if (!isToday || !visible) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isToday, visible]);

  // Click outside progress bar to save & close editing
  useEffect(() => {
    if (!isEditingTime) return;
    const handler = (e: MouseEvent) => {
      if (progressBarRef.current && !progressBarRef.current.contains(e.target as Node)) {
        const [wh, wm] = editWakeVal.split(':').map(Number);
        if (!isNaN(wh) && !isNaN(wm)) onWakeChange?.(wh, wm);
        const [bh, bm] = editBedVal.split(':').map(Number);
        if (!isNaN(bh) && !isNaN(bm)) onBedtimeChange?.(bh, bm);
        setEditingWake(false);
        setEditingBed(false);
      }
    };
    const tmr = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(tmr); document.removeEventListener('mousedown', handler); };
  }, [isEditingTime, editWakeVal, editBedVal, onWakeChange, onBedtimeChange]);

  if (!visible) {
    return (
      <div>
        <button onClick={toggleVisible} className="p-1 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors" title={mode === 'plan' ? t('today.leftToday') : t('today.hoursPassed')}>
          <EyeOff size={14} />
        </button>
      </div>
    );
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  const handleTimeEdit = () => {
    setEditWakeVal(`${pad(wakeHour)}:${pad(wakeMinute)}`);
    setEditBedVal(`${pad(bedtimeHour)}:${pad(bedtimeMinute)}`);
    setEditingWake(true);
    setEditingBed(true);
  };
  const saveAllTime = () => {
    const [wh, wm] = editWakeVal.split(':').map(Number);
    if (!isNaN(wh) && !isNaN(wm)) onWakeChange?.(wh, wm);
    const [bh, bm] = editBedVal.split(':').map(Number);
    if (!isNaN(bh) && !isNaN(bm)) onBedtimeChange?.(bh, bm);
    setEditingWake(false);
    setEditingBed(false);
  };
  const cancelTimeEdit = () => {
    setEditingWake(false);
    setEditingBed(false);
  };

  // Progress bar calculations (supports cross-midnight sleep windows)
  const MINUTES_IN_DAY = 24 * 60;
  const wakeMin = wakeHour * 60 + wakeMinute;
  const bedMin = bedtimeHour * 60 + bedtimeMinute;
  const totalAwake = (() => {
    const diff = (bedMin - wakeMin + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return diff;
  })();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const elapsedTodayMin = totalAwake > 0
    ? Math.min((nowMin - wakeMin + MINUTES_IN_DAY) % MINUTES_IN_DAY, totalAwake)
    : 0;
  const elapsed = dayRelation === 'today'
    ? elapsedTodayMin
    : dayRelation === 'past'
      ? totalAwake
      : 0;
  const pct = totalAwake > 0 ? (elapsed / totalAwake) * 100 : 0;

  const TimeParts = ({ h, m, s, color }: { h: string; m: string; s: string; color?: string }) => (
    <span className="font-mono font-light tabular-nums tracking-wider select-none" style={color ? { color } : undefined}>
      <span className={cn(compact ? 'text-[34px] sm:text-[44px]' : 'text-4xl sm:text-5xl')}>{h}:{m}</span>
      <span className={cn(compact ? 'text-[24px] sm:text-[32px]' : 'text-3xl sm:text-4xl')}>:{s}</span>
    </span>
  );

  const TimeLabel = ({ text }: { text: string }) => (
    <div className={cn('flex items-center', compact ? 'gap-1 mb-0' : 'gap-1.5 mb-0.5')}>
      <p className={cn('text-muted-foreground/70', compact ? 'text-[11px] font-medium' : 'text-sm font-medium')}>{text}</p>
      <button onClick={toggleVisible} className="text-muted-foreground/25 hover:text-muted-foreground/50 transition-colors">
        <Eye size={11} />
      </button>
    </div>
  );

  const PlanHeader = ({ h, m, s, color }: { h: string; m: string; s: string; color?: string }) => (
    <div className={cn('flex items-start justify-between gap-3', compact ? 'mb-1' : 'mb-1.5')}>
      <TimeLabel text={t('today.leftToday')} />
      <div className="text-right leading-none">
        <TimeParts h={h} m={m} s={s} color={color} />
      </div>
    </div>
  );

  const ProgressBar = () => (
    <div ref={progressBarRef} className={cn('flex items-center gap-1', compact ? 'mt-1' : 'mt-1.5')}>
      {isEditingTime ? (
        <input autoFocus type="time" value={editWakeVal} onChange={e => setEditWakeVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveAllTime(); if (e.key === 'Escape') cancelTimeEdit(); }}
          className={cn('w-[58px] text-[9px] font-mono bg-transparent border-b border-primary/40 focus:outline-none text-muted-foreground', compact ? 'w-[54px]' : '')} />
      ) : null}
      <div className="relative h-1 bg-muted rounded-full flex-1">
        {mode === 'plan' ? (
          <div className="absolute inset-y-0 right-0 bg-accent/40 rounded-full transition-all duration-1000" style={{ width: `${Math.max(0, 100 - pct)}%` }} />
        ) : (
          <div className="absolute inset-y-0 left-0 bg-accent/40 rounded-full transition-all duration-1000" style={{ width: `${Math.min(pct, 100)}%` }} />
        )}
        {isToday && pct > 0 && pct < 100 && (
          <div className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary border border-background z-10" style={{ left: `${pct}%`, marginLeft: -2 }} />
        )}
      </div>
      {isEditingTime ? (
        <input type="time" value={editBedVal} onChange={e => setEditBedVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveAllTime(); if (e.key === 'Escape') cancelTimeEdit(); }}
          className={cn('w-[58px] text-[9px] font-mono bg-transparent border-b border-primary/40 focus:outline-none text-muted-foreground', compact ? 'w-[54px]' : '')} />
      ) : (
        <button onClick={handleTimeEdit} className={cn('flex items-center justify-center w-4 h-4 rounded-full bg-muted/50 hover:bg-primary/20 transition-colors flex-shrink-0', compact ? 'w-3.5 h-3.5' : '')} title={t('today.editTime')}>
          <Pencil size={8} className="text-muted-foreground/50" />
        </button>
      )}
    </div>
  );

  if (mode === 'plan') {
    // Past date: day already over; Future date: day not started yet
    if (dayRelation === 'past') {
      return (
        <div>
          <PlanHeader h="00" m="00" s="00" />
          <ProgressBar />
        </div>
      );
    }
    if (dayRelation === 'future') {
      const totalMs = Math.max(totalAwake, 0) * 60 * 1000;
      const hours = pad(Math.floor(totalMs / (1000 * 60 * 60)));
      const minutes = pad(Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60)));
      return (
        <div>
          <PlanHeader h={hours} m={minutes} s="00" color="hsl(var(--accent))" />
          <ProgressBar />
        </div>
      );
    }
    const bedtime = new Date(now);
    bedtime.setHours(bedtimeHour, bedtimeMinute, 0, 0);
    if (bedtimeHour * 60 + bedtimeMinute <= wakeHour * 60 + wakeMinute) {
      bedtime.setDate(bedtime.getDate() + 1);
    }
    const diffMs = bedtime.getTime() - now.getTime();
    if (diffMs <= 0) {
      return (
        <div>
          <PlanHeader h="00" m="00" s="00" />
          <ProgressBar />
        </div>
      );
    }
    const hours = pad(Math.floor(diffMs / (1000 * 60 * 60)));
    const minutes = pad(Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
    const seconds = pad(Math.floor((diffMs % (1000 * 60)) / 1000));
    return (
      <div>
        <PlanHeader h={hours} m={minutes} s={seconds} color="hsl(var(--accent))" />
        <ProgressBar />
      </div>
    );
  }

  // Recap mode: show elapsed time since wake
  // For past dates: freeze at total awake time (bedtime - wake)
  let passedMs: number;
  if (dayRelation === 'today') {
    passedMs = elapsedTodayMin * 60 * 1000;
  } else if (dayRelation === 'past') {
    passedMs = Math.max(totalAwake, 0) * 60 * 1000; // past day is complete
  } else {
    passedMs = 0; // future day not started
  }
  const hours = pad(Math.floor(passedMs / (1000 * 60 * 60)));
  const minutes = pad(Math.floor((passedMs % (1000 * 60 * 60)) / (1000 * 60)));
  const seconds = pad(Math.floor((passedMs % (1000 * 60)) / 1000));
  const recapPct = timeRecordedPct || 0;

  return (
    <div>
      <TimeLabel text={t('today.hoursPassed')} />
      <div className="relative inline-block select-none">
        <span className="font-mono font-light text-foreground/15 tabular-nums tracking-wider">
          <span className={cn(compact ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl')}>{hours}:{minutes}</span>
          <span className={cn(compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl')}>:{seconds}</span>
        </span>
        {recapPct > 0 && (
          <span
            className="absolute inset-0 font-mono font-light tabular-nums tracking-wider overflow-hidden"
            style={{ color: 'hsl(var(--accent))', clipPath: `inset(${100 - recapPct}% 0 0 0)` }}
            aria-hidden
          >
            <span className={cn(compact ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl')}>{hours}:{minutes}</span>
            <span className={cn(compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl')}>:{seconds}</span>
          </span>
        )}
      </div>
      <ProgressBar />
      <div className={cn('flex items-center gap-1', compact ? 'mt-1 text-[11px]' : 'mt-1.5 text-xs')}>
        {(todosDone || 0) > 0 && <span className="text-muted-foreground/60">{todosDone}{t('today.thingsDone')}</span>}
        {(todosDone || 0) > 0 && recapPct > 0 && <div className="w-px h-3 bg-border" />}
        {recapPct > 0 && <span className="text-accent">{recapPct}% {t('today.timeRecorded')}</span>}
      </div>
    </div>
  );
}

export function DailyHabitTracker({
  habits,
  selectedDateStr,
  onIncrement,
  onSetCount,
  onUpdateHabit,
  onAddHabit,
}: {
  habits: DueWithStats[];
  selectedDateStr: string;
  onIncrement: (habitId: string, dateStr: string) => void;
  onSetCount: (habitId: string, nextCount: number, dateStr: string) => void;
  onUpdateHabit: (habitId: string, updates: { title?: string; progress?: number; show_in_recap_daily?: boolean; links?: DueLink[] }) => void;
  onAddHabit: (title: string) => void;
}) {
  const [titleEditingId, setTitleEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const summary = useMemo(() => {
    const done = habits.filter(h => (h.dailyCounts[selectedDateStr] || 0) >= h.targetCount).length;
    const bestStreak = habits.reduce((max, habit) => Math.max(max, habit.currentStreak), 0);
    return { done, total: habits.length, bestStreak };
  }, [habits, selectedDateStr]);

  const handleAddHabit = () => {
    const nextTitle = newHabitTitle.trim();
    if (!nextTitle) return;
    onAddHabit(nextTitle);
    setNewHabitTitle('');
  };

  const handleOpenHabitLink = (habit: DueWithStats, linkIndex: number) => {
    const link = habit.links?.[linkIndex];
    if (!link?.url) return;
    onIncrement(habit.id, selectedDateStr);
    onUpdateHabit(habit.id, {
      links: (habit.links || []).map((item, index) =>
        index === linkIndex ? { ...item, count: (item.count || 0) + 1 } : item
      ),
    });
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  const historyWeeks = useMemo(() => {
    const start = startOfWeek(subDays(new Date(selectedDateStr), 83), { weekStartsOn: 0 });
    return Array.from({ length: 12 }, (_, weekIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) => addDays(start, weekIndex * 7 + dayIndex))
    );
  }, [selectedDateStr]);

  return (
    <aside className="min-w-0 lg:sticky lg:top-4">
      <div className="rounded-[24px] border border-border/70 bg-[hsl(var(--surface-soft))] px-3.5 py-3.5 shadow-[0_10px_24px_hsl(var(--foreground)/0.05)]">
        <div className="rounded-[20px] border border-border/60 bg-background/55 px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/55">Daily Tracker</p>
            {habits.length > 0 && (
              <button
                onClick={() => setShowHistory(true)}
                className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                History
              </button>
            )}
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[22px] font-semibold text-foreground">{summary.done}/{summary.total}</p>
              <p className="text-[11px] text-muted-foreground/70">must-do habits done today</p>
            </div>
            <div className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              {summary.bestStreak > 0 ? `🔥 ${summary.bestStreak} day streak` : 'Start your streak'}
            </div>
          </div>
        </div>

        <div className="mt-3.5 space-y-2.5">
          {habits.length === 0 && (
            <div className="rounded-[20px] border border-dashed border-border/70 px-3.5 py-4 text-center">
              <p className="text-[11px] text-muted-foreground/65">
                Add your first daily habit here. It will sync with Habits automatically.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={newHabitTitle}
                  onChange={e => setNewHabitTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddHabit();
                  }}
                  placeholder="Add a daily habit"
                  className="h-9 min-w-0 flex-1 rounded-full border border-border/70 bg-background/60 px-3.5 text-[12px] text-foreground placeholder:text-[11px] placeholder:text-muted-foreground/55 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleAddHabit}
                  className="h-9 rounded-full bg-primary px-3.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {habits.map(habit => {
            const count = habit.dailyCounts[selectedDateStr] || 0;
            const isComplete = count >= habit.targetCount;

            return (
              <div
                key={habit.id}
                className={cn(
                  "rounded-[20px] border px-3.5 py-2.5 transition-colors",
                  isComplete ? "border-primary/30 bg-primary/6" : "border-border/70 bg-background/45"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-2 w-2 rounded-full bg-primary/75 flex-shrink-0" />
                  {/* Title */}
                  <div className="min-w-0 flex-1">
                    {titleEditingId === habit.id ? (
                      <input
                        value={titleDraft}
                        onChange={e => setTitleDraft(e.target.value)}
                        onBlur={() => {
                          const nextTitle = titleDraft.trim();
                          if (nextTitle && nextTitle !== habit.title) onUpdateHabit(habit.id, { title: nextTitle });
                          setTitleEditingId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const nextTitle = titleDraft.trim();
                            if (nextTitle && nextTitle !== habit.title) onUpdateHabit(habit.id, { title: nextTitle });
                            setTitleEditingId(null);
                          }
                          if (e.key === 'Escape') { setTitleDraft(habit.title); setTitleEditingId(null); }
                        }}
                        className="w-full border-b border-primary/40 bg-transparent text-[13px] font-semibold text-foreground focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => { setTitleEditingId(habit.id); setTitleDraft(habit.title); }}
                        className="truncate text-left text-[13px] font-semibold text-foreground transition-opacity hover:opacity-75"
                      >
                        {habit.title}
                      </button>
                    )}
                  </div>
                  {/* Streak */}
                  <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap flex-shrink-0">
                    {habit.currentStreak > 0 ? `${habit.currentStreak}d streak` : 'new'}
                  </span>
                  {/* Checkboxes */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {Array.from({ length: habit.targetCount }).map((_, index) => {
                      const checked = index < count;
                      return (
                        <button
                          key={`${habit.id}-check-${index}`}
                          onClick={() => onSetCount(habit.id, checked ? index : index + 1, selectedDateStr)}
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                            checked ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background/55 text-transparent hover:border-primary/40"
                          )}
                        >
                          <Check size={11} strokeWidth={2.8} />
                        </button>
                      );
                    })}
                  </div>
                  {/* Links inline */}
                  {habit.links && habit.links.length > 0 && (
                    <button
                      onClick={() => handleOpenHabitLink(habit, 0)}
                      className="flex-shrink-0 text-[10px] text-primary/60 hover:text-primary transition-colors truncate max-w-[80px]"
                    >
                      {habit.links[0].label || habit.links[0].title || 'open'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {habits.length > 0 && (
            <div className="rounded-[20px] border border-border/60 bg-background/35 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <input
                  value={newHabitTitle}
                  onChange={e => setNewHabitTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddHabit();
                  }}
                  placeholder="Add another daily habit"
                  className="h-8 min-w-0 flex-1 rounded-full border border-border/70 bg-background/60 px-3.5 text-[12px] text-foreground placeholder:text-[11px] placeholder:text-muted-foreground/55 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleAddHabit}
                  className="h-8 rounded-full bg-primary/12 px-3 text-[11px] font-medium text-primary transition-colors hover:bg-primary/18"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl rounded-[28px] border border-border/70 bg-background/95 p-0 shadow-[0_24px_80px_hsl(var(--foreground)/0.16)]">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <DialogTitle className="text-[18px] font-semibold text-foreground">Habit consistency</DialogTitle>
            <p className="text-[12px] text-muted-foreground">Last 12 weeks. Darker squares mean more completed.</p>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
            {habits.map((habit) => (
              <div key={`${habit.id}-history`} className="rounded-[22px] border border-border/60 bg-[hsl(var(--surface-soft))] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-foreground">{habit.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {habit.currentStreak > 0 ? `${habit.currentStreak} day streak` : 'No streak yet'} · target {habit.targetCount}/day
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {(habit.dailyCounts[selectedDateStr] || 0)}/{habit.targetCount} today
                  </span>
                </div>
                <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
                  {historyWeeks.map((week, weekIndex) => (
                    <div key={`${habit.id}-week-${weekIndex}`} className="grid grid-rows-7 gap-1.5">
                      {week.map((day) => {
                        const key = format(day, 'yyyy-MM-dd');
                        const dayCount = habit.dailyCounts[key] || 0;
                        const intensity = dayCount >= habit.targetCount ? 2 : dayCount > 0 ? 1 : 0;
                        return (
                          <div
                            key={`${habit.id}-${key}`}
                            title={`${format(day, 'MMM d')}: ${dayCount}/${habit.targetCount}`}
                            className={cn(
                              "h-3.5 w-3.5 rounded-[4px] border",
                              intensity === 2
                                ? "border-primary/30 bg-primary"
                                : intensity === 1
                                  ? "border-primary/20 bg-primary/35"
                                  : "border-border/60 bg-background"
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

/* ── Editable completed todo in recap ── */
export function EditableCompletedTodo({ todo, onUpdate }: { todo: Todo; onUpdate: (updates: Partial<Todo>) => void }) {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const hasProgress = todo.progress > 0 && todo.progress < 100;

  const handleSave = () => {
    if (editTitle.trim() && editTitle.trim() !== todo.title) onUpdate({ title: editTitle.trim() });
    else setEditTitle(todo.title);
    setIsEditing(false);
  };

  const handleStartEditTime = () => {
    const now = format(new Date(), 'HH:mm');
    const start = todo.timer_started_at ? format(parseISO(todo.timer_started_at), 'HH:mm') : now;
    const end = todo.timer_ended_at ? format(parseISO(todo.timer_ended_at), 'HH:mm') : now;
    setEditStart(start);
    setEditEnd(end);
    setIsEditingTime(true);
  };

  const handleSaveTime = () => {
    const dateStr = todo.date || format(parseISO(todo.created_at), 'yyyy-MM-dd');
    const startISO = localTimeOnDateISO(dateStr, editStart);
    const endISO = localTimeOnDateISO(dateStr, editEnd);
    if (!startISO || !endISO) return;
    const diffSec = durationSeconds(startISO, endISO);
    onUpdate({ timer_started_at: startISO, timer_ended_at: endISO, timer_seconds: diffSec });
    setIsEditingTime(false);
  };

  return (
    <div className="group space-y-0.5">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={14} className="text-primary flex-shrink-0" />
        {isEditing ? (
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditTitle(todo.title); setIsEditing(false); } }}
            className="text-sm w-full bg-transparent border-b border-primary/30 focus:outline-none focus:border-primary py-0.5"
            autoFocus
          />
        ) : (
          <span
            className="text-sm text-muted-foreground truncate cursor-pointer"
            onDoubleClick={() => { setEditTitle(todo.title); setIsEditing(true); }}
          >
            {todo.title}
          </span>
        )}
        {!isEditing && (
          <button onClick={() => { setEditTitle(todo.title); setIsEditing(true); }} className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-opacity">
            <Pencil size={10} />
          </button>
        )}
      </div>
      {/* Progress */}
      {hasProgress && (
        <div className="flex items-center gap-1.5 ml-[22px]">
          <div className="w-12 h-1 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary/50 rounded-full" style={{ width: `${todo.progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground/60">{todo.progress}%</span>
        </div>
      )}
      {/* Time */}
      {isEditingTime ? (
        <div className="flex items-center gap-1.5 ml-[22px]">
          <input inputMode="numeric" pattern="[0-9:]*" value={editStart} onChange={e => setEditStart(e.target.value)} className={recapTimeInputClassName} placeholder="12:07" />
          <span className="text-muted-foreground text-xs">→</span>
          <input inputMode="numeric" pattern="[0-9:]*" value={editEnd} onChange={e => setEditEnd(e.target.value)} className={recapTimeInputClassName} placeholder="12:09" />
          <button onClick={handleSaveTime} className="text-primary hover:text-primary/80"><Check size={12} /></button>
          <button onClick={() => setIsEditingTime(false)} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
        </div>
      ) : (
        <div className="ml-[22px]">
          {todo.timer_started_at && todo.timer_ended_at ? (
            <span
              className="text-sm font-mono tabular-nums text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={handleStartEditTime}
            >
              🕐 {format(parseISO(todo.timer_started_at), 'HH:mm')} → {format(parseISO(todo.timer_ended_at), 'HH:mm')}
              {todo.timer_seconds != null && todo.timer_seconds > 0 && ` (${Math.floor(todo.timer_seconds / 60)}m)`}
            </span>
          ) : (
            <span
              className="text-sm font-mono tabular-nums text-muted-foreground/60 cursor-pointer hover:text-foreground transition-colors"
              onClick={handleStartEditTime}
            >
              🕐 {format(parseISO(todo.created_at), 'HH:mm')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}


/* ── Moment Timer Summary ── */
export function MomentTimerSummary({ title, elapsed, startedAt, onConfirm, onCancel }: {
  title: string;
  elapsed: number;
  startedAt: string;
  onConfirm: (data: { startTime: string; endTime: string }) => void;
  onCancel: () => void;
}) {
  const startDate = new Date(startedAt);
  const endDate = new Date();
  const [startTime, setStartTime] = useState(format(startDate, 'HH:mm'));
  const [endTime, setEndTime] = useState(format(endDate, 'HH:mm'));
  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className="w-[320px] bg-card border border-border rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground/60 tracking-[0.2em] uppercase">Session complete</p>
          <p className="text-base font-medium text-foreground">{title}</p>
        </div>
        <div className="text-center">
          <span className="text-3xl font-mono font-light text-foreground/40 tabular-nums">
            {hrs > 0 ? `${pad(hrs)}:` : ''}{pad(mins)}:{pad(secs)}
          </span>
        </div>
        <div className="flex items-center justify-center gap-3">
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-secondary rounded-lg px-2 py-1 text-sm font-mono text-center w-24 focus:outline-none focus:ring-1 focus:ring-primary" />
          <span className="text-muted-foreground text-sm">→</span>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-secondary rounded-lg px-2 py-1 text-sm font-mono text-center w-24 focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="flex items-center gap-3 justify-center pt-1">
          <button onClick={onCancel} className="w-12 h-12 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"><X size={20} /></button>
          <button onClick={() => onConfirm({ startTime, endTime })} className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"><Check size={20} /></button>
        </div>
      </div>
    </div>
  );
}

/* ── Moment time editor (start/end times) ── */
export function MomentTimeEditor({ moment, onEditMoment }: { moment: Moment; onEditMoment?: (id: string, data: Partial<Moment>) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  const handleStartEdit = () => {
    const now = format(new Date(), 'HH:mm');
    const start = moment.timer_started_at ? format(parseISO(moment.timer_started_at), 'HH:mm') : now;
    const end = moment.timer_ended_at ? format(parseISO(moment.timer_ended_at), 'HH:mm') : now;
    setEditStart(start);
    setEditEnd(end);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!onEditMoment) return;
    const dateStr = format(parseISO(moment.date || moment.createdAt), 'yyyy-MM-dd');
    const startISO = localTimeOnDateISO(dateStr, editStart);
    const endISO = localTimeOnDateISO(dateStr, editEnd);
    if (!startISO || !endISO) return;
    const diffSec = durationSeconds(startISO, endISO);
    onEditMoment(moment.id, { timer_started_at: startISO, timer_ended_at: endISO, timer_seconds: diffSec } as Partial<Moment>);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        <input inputMode="numeric" pattern="[0-9:]*" value={editStart} onChange={e => setEditStart(e.target.value)} className={recapTimeInputClassName} placeholder="12:07" />
        <span className="text-muted-foreground text-xs">→</span>
        <input inputMode="numeric" pattern="[0-9:]*" value={editEnd} onChange={e => setEditEnd(e.target.value)} className={recapTimeInputClassName} placeholder="12:09" />
        <button onClick={handleSave} className="text-primary hover:text-primary/80"><Check size={12} /></button>
        <button onClick={() => setIsEditing(false)} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
      </div>
    );
  }

  if (moment.timer_started_at && moment.timer_ended_at) {
    return (
      <span
        className="inline-flex items-center text-sm font-mono tabular-nums text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={handleStartEdit}
      >
        🕐 {format(parseISO(moment.timer_started_at), 'HH:mm')} → {format(parseISO(moment.timer_ended_at), 'HH:mm')}
        {moment.timer_seconds != null && moment.timer_seconds > 0 && ` (${Math.floor(moment.timer_seconds / 60)}m)`}
      </span>
    );
  }

  if (moment.timer_started_at && !moment.timer_ended_at) {
    return (
      <span
        className="inline-flex items-center text-sm font-mono tabular-nums text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
        onClick={handleStartEdit}
      >
        🕐 {format(parseISO(moment.timer_started_at), 'HH:mm')}
      </span>
    );
  }

  return null;
}

export function ImportedEventTimeEditor({ event, onUpdate }: { event: ImportedEvent; onUpdate?: (id: string, data: Partial<ImportedEvent>) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const start = parseISO(getImportedEventEffectiveStart(event));
  const endIso = getImportedEventEffectiveEnd(event);
  const end = endIso ? parseISO(endIso) : null;

  const handleStartEdit = () => {
    setEditStart(format(start, 'HH:mm'));
    setEditEnd(end ? format(end, 'HH:mm') : format(start, 'HH:mm'));
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!onUpdate) return;
    const dateStr = format(start, 'yyyy-MM-dd');
    const startISO = localTimeOnDateISO(dateStr, editStart);
    const endISO = localTimeOnDateISO(dateStr, editEnd);
    if (!startISO || !endISO) return;
    const hasTimerOverride = Boolean(event.timer_started_at || event.timer_ended_at || (event.timer_seconds ?? 0) > 0);
    if (hasTimerOverride) {
      onUpdate(event.id, {
        timer_started_at: startISO,
        timer_ended_at: endISO,
        timer_seconds: durationSeconds(startISO, endISO),
      });
    } else {
      onUpdate(event.id, { start_time: startISO, end_time: endISO });
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        <input inputMode="numeric" pattern="[0-9:]*" value={editStart} onChange={e => setEditStart(e.target.value)} className={recapTimeInputClassName} placeholder="12:07" />
        <span className="text-muted-foreground text-xs">→</span>
        <input inputMode="numeric" pattern="[0-9:]*" value={editEnd} onChange={e => setEditEnd(e.target.value)} className={recapTimeInputClassName} placeholder="12:09" />
        <button onClick={handleSave} className="text-primary hover:text-primary/80"><Check size={12} /></button>
        <button onClick={() => setIsEditing(false)} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
      </div>
    );
  }

  return (
    <button
      className="font-mono tabular-nums text-muted-foreground/45 hover:text-muted-foreground transition-colors"
      style={{ fontSize: '12px' }}
      onClick={handleStartEdit}
      title="Edit event time"
    >
      {format(start, 'HH:mm')}{end ? ` → ${format(end, 'HH:mm')}` : ''}
    </button>
  );
}

/* ── Moment Display with subtitle/detail support ── */
export function MomentDisplay({ moment, index, onStartEdit, onStartTimer, onLightbox, onEditMoment }: {
  moment: Moment; index: number; onStartEdit: () => void; onStartTimer: () => void;
  onLightbox: (photos: string[], index: number) => void;
  onEditMoment?: (id: string, data: Partial<Moment>) => void;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const { subtitle, detail } = parseSubtitleDetail(moment.text);

  return (
    <div className="flex flex-col gap-2">
      {/* 上半部分：编号 + 文本 + 右侧大图 */}
      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <span className="text-xs text-muted-foreground/50 font-mono w-4 text-right">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="leading-relaxed text-[19px] sm:text-[22px] font-normal cursor-pointer hover:text-primary/80 transition-colors"
            onClick={onStartEdit}
          >
            {moment.emoji && <span className="mr-1">{moment.emoji}</span>}
            {subtitle}
          </p>
          {detail && (
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="flex items-center gap-0.5 text-sm text-muted-foreground/55 hover:text-muted-foreground mt-1 transition-colors"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              <span>{expanded ? t('recap.hideDetail') : t('recap.viewDetail')}</span>
            </button>
          )}
          {expanded && detail && (
            <div
              className="mt-2 ml-0.5 border-l-2 border-border/40 pl-3 cursor-pointer max-h-48 overflow-y-auto rounded-r"
              onClick={onStartEdit}
            >
              <p className="text-[13px] text-muted-foreground/70 whitespace-pre-wrap leading-relaxed">
                {detail}
              </p>
            </div>
          )}
        </div>

        {/* 右侧：大一点的图片区域 */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[88px]">
          {moment.photos.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {moment.photos.slice(0, 4).map((photo, i) => {
                const manyPhotos = moment.photos.length >= 3;
                return (
                  <img
                    key={i}
                    src={photo}
                    alt=""
                    className={cn(
                      "object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-85 transition-opacity",
                      manyPhotos ? "w-16 h-16 sm:w-[72px] sm:h-[72px]" : "w-20 h-20 sm:w-24 sm:h-24"
                    )}
                    onClick={() => onLightbox(moment.photos, i)}
                  />
                );
              })}
              {moment.photos.length > 4 && (
                <button
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-muted/60 text-[10px] text-muted-foreground/70 flex items-center justify-center hover:bg-muted/80 transition-colors"
                  onClick={() => onLightbox(moment.photos, 0)}
                >
                  +{moment.photos.length - 4}
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {moment.tags && moment.tags.length > 0 && moment.tags.map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary hidden sm:inline">
                {tag}
              </span>
            ))}
            <span className="text-sm font-mono tabular-nums text-muted-foreground/72">
              {format(parseISO(moment.createdAt), 'HH:mm')}
            </span>
            <button onClick={onStartTimer} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Start focusing">
              <Timer size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 下方：时间 + 定位（保持不变） */}
      <div className="flex items-center justify-between ml-6">
        <MomentTimeEditor moment={moment} onEditMoment={onEditMoment} />
        {moment.location && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin size={10} />
            <span className="max-w-[140px] truncate">{moment.location.name}</span>
          </span>
        )}
      </div>
      {/* Mobile tags */}
      {moment.tags && moment.tags.length > 0 && (
        <div className="flex gap-1 ml-6 sm:hidden">
          {moment.tags.map((tag, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Life Replay: AI-generated daily narrative ── */
export function LifeReplay({ items, lang, dateKey }: { items: { type: string; time: Date; endTime?: Date; data: any }[]; lang: string; dateKey: string }) {
  const { t } = useLanguage();
  const [story, setStory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const lastDateKey = useRef(dateKey);
  const autoTriggered = useRef(false);

  // Reset story when switching dates
  useEffect(() => {
    if (dateKey !== lastDateKey.current) {
      setStory(null);
      setError(false);
      autoTriggered.current = false;
      lastDateKey.current = dateKey;
    }
  }, [dateKey]);

  const events = useMemo(() => {
    return items.filter(i => !(i as any).isPlanOutline).map(item => {
      const title = item.type === 'todo'
        ? item.data.title
        : item.type === 'imported'
          ? item.data.title
        : (parseSubtitleDetail(item.data.text).subtitle || item.data.emoji || 'Moment');
      const timeStr = format(item.time, 'HH:mm');
      let duration: string | undefined;
      if (item.endTime) {
        const durMin = Math.round((item.endTime.getTime() - item.time.getTime()) / 60000);
        if (durMin > 0) duration = `${durMin}m`;
      }
      return { time: timeStr, title, duration };
    });
  }, [items]);

  const generate = useCallback(async () => {
    if (events.length < 3 || loading) return;
    setLoading(true);
    setError(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('life-replay', {
        body: { events, lang },
      });
      if (fnError) throw fnError;
      setStory(data?.story || buildLocalLifeReplay(events, lang));
    } catch {
      const fallbackStory = buildLocalLifeReplay(events, lang);
      if (fallbackStory) {
        setStory(fallbackStory);
        setError(false);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [events, lang, loading]);

  // Auto-generate when there are enough events
  useEffect(() => {
    if (events.length >= 3 && !story && !loading && !error && !autoTriggered.current) {
      autoTriggered.current = true;
      generate();
    }
  }, [events.length, story, loading, error]);

  if (events.length < 3) return null;

  return (
    <div className="mb-4 rounded-[20px] border border-primary/10 bg-gradient-to-br from-primary/[0.04] to-primary/[0.08] px-3.5 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px]">✨</span>
          <p className="text-[11px] font-medium tracking-wide text-primary/70">{t('recap.lifeReplay')}</p>
        </div>
        {story && !loading && (
          <button onClick={generate} className="rounded px-1 py-0.5 text-[10px] text-muted-foreground/40 transition-colors hover:bg-secondary/50 hover:text-muted-foreground">
            ↻ {lang === 'zh' ? '重新生成' : 'Regenerate'}
          </button>
        )}
      </div>
      {loading && (
        <div className="flex items-center gap-2 py-1.5">
          <div className="h-3 w-3 rounded-full border-2 border-primary/20 border-t-primary/60 animate-spin" />
          <span className="text-[11px] italic text-muted-foreground/50">
            {lang === 'zh' ? '正在回放你的一天...' : 'Replaying your day...'}
          </span>
        </div>
      )}
      {story && !loading && (
        <p className="text-[12px] leading-[1.55] text-foreground/80 font-light">
          {story}
        </p>
      )}
      {error && !loading && (
        <div className="flex items-center gap-2">
          <p className="text-[11px] text-muted-foreground/40">{t('recap.generateFailed')}</p>
          <button onClick={generate} className="text-[10px] text-primary/60 hover:text-primary">
            {lang === 'zh' ? '重试' : 'Retry'}
          </button>
        </div>
      )}
    </div>
  );
}

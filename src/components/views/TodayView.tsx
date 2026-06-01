import { useMemo, useState, useRef, useCallback, useEffect, ChangeEvent } from 'react';
import { autoClassifyTag } from '@/lib/autoTag';
import { addDays, format, parseISO, startOfWeek, subDays } from 'date-fns';
import { useDateLocale } from '@/hooks/useDateLocale';
import { classifyMood } from '@/lib/moodClassifier';
import { MapPin, Image, Send, X, Smile, Pencil, Trash2, Sparkles, CheckCircle2, Check, Timer, Pause, Play, Square, Mic, Clock, ArrowUp, ChevronDown, ChevronUp, Eye, EyeOff, Loader2 } from 'lucide-react';
import { InputPlusMenu, detectAutoTags } from '@/components/InputPlusMenu';
import { useReminders } from '@/hooks/useReminders';
import { Button } from '@/components/ui/button';
import { Moment, MomentLinkPreview, TodayMode } from '@/types';
import { Todo } from '@/hooks/useTodos';
import { ImportedEvent } from '@/hooks/useImportedEvents';
import { cn, isImeComposing } from '@/lib/utils';
import { normalizeUrl, extractFirstUrl } from '@/lib/linkUtils';
import { validatePhotoFile, canAddMorePhotos } from '@/lib/photoValidation';
import { LocationPopover } from '@/components/LocationPopover';
import { EmojiGrid } from '@/components/today/EmojiGrid';
import { LinkPreviewCard } from '@/components/LinkPreviewCard';

import { supabase } from '@/integrations/supabase/client';
// MiniTimeline removed from recap sidebar
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import monetPainting from '@/assets/monet-impression-sunrise.jpg';
import dailyPainting from '@/assets/daily-painting.jpg';
import { WeekDateBar } from '@/components/WeekDateBar';
import { useLanguage } from '@/hooks/useLanguage';
import { mergedWallClockFocusMinutes } from '@/lib/mergedWallClockMinutes';
import { useCustomOptions } from '@/hooks/useCustomOptions';
import { DueLink, DueWithStats, useDues } from '@/hooks/useDues';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';
import { getActivityAccentColor, getActivityTagIcon } from '@/lib/activityColors';
import { useWorkTypes } from '@/hooks/useWorkTypes';
import { WORK_TYPE_META } from '@/lib/workType';
import { toast } from 'sonner';

const DETAIL_SEPARATOR = '\n---DETAIL---\n';
type MomentEditUpdates = Partial<Omit<Moment, 'location'>> & {
  location?: Moment['location'] | null;
};

function uniquePhotoList(photos: string[]): string[] {
  return Array.from(new Set(photos.filter(photo => typeof photo === 'string' && photo.trim().length > 0)));
}

function moveIsoToDateKeepingLocalTime(isoString: string | null | undefined, newDate: string): string | null {
  if (!isoString) return null;
  const original = new Date(isoString);
  if (Number.isNaN(original.getTime())) return null;
  const hh = String(original.getHours()).padStart(2, '0');
  const mm = String(original.getMinutes()).padStart(2, '0');
  const ss = String(original.getSeconds()).padStart(2, '0');
  return new Date(`${newDate}T${hh}:${mm}:${ss}`).toISOString();
}

function localTimeOnDateISO(dateStr: string, timeStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) return null;
  const next = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isFinite(next.getTime()) ? next.toISOString() : null;
}

function durationSeconds(startISO: string, endISO: string): number {
  return Math.max(0, Math.floor((new Date(endISO).getTime() - new Date(startISO).getTime()) / 1000));
}

const recapTimeInputClassName = "min-h-8 w-[64px] rounded-lg border border-border/35 bg-[hsl(var(--surface-soft))] px-2 py-1 text-center font-mono text-[15px] tabular-nums tracking-[-0.03em] text-foreground shadow-[inset_0_1px_0_hsl(var(--surface-contrast)/0.65)] focus:outline-none focus:ring-1 focus:ring-primary/35";

function getImportedEventEffectiveStart(event: ImportedEvent): string {
  return event.timer_started_at || event.start_time;
}

function getImportedEventEffectiveEnd(event: ImportedEvent): string | null {
  return event.timer_ended_at || event.end_time;
}

/** Parse text that may contain a subtitle/detail separator */
function parseSubtitleDetail(text?: string | null): { subtitle: string; detail: string | null } {
  if (!text) return { subtitle: '', detail: null };
  const idx = text.indexOf(DETAIL_SEPARATOR);
  if (idx === -1) return { subtitle: text, detail: null };
  return { subtitle: text.substring(0, idx), detail: text.substring(idx + DETAIL_SEPARATOR.length) };
}

/** Check if text is long enough to warrant auto-summarization */
function shouldSummarize(text: string): boolean {
  return text.trim().length > 60;
}

function cleanDetailText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[，、。！？,.!?]*\s*(呃|啊|嗯|那个|然后呢|就是说|对吧|嘛|吧|呢|哦|哈|嘿|喂|额|唔|诶|哎)\s*/gi, ' ')
    .replace(/\s+([,.!?，。！？])/g, '$1')
    .trim();
}

function lightlyPolishRecapText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  let polished = trimmed
    .replace(/\bi\b/g, 'I')
    .replace(/\bim\b/gi, "I'm")
    .replace(/\bidk\b/gi, "I don't know")
    .replace(/\bdont\b/gi, "don't")
    .replace(/\bcant\b/gi, "can't")
    .replace(/\bwont\b/gi, "won't")
    .replace(/\bdoesnt\b/gi, "doesn't")
    .replace(/\bdidnt\b/gi, "didn't")
    .replace(/\bisnt\b/gi, "isn't")
    .replace(/\barent\b/gi, "aren't")
    .replace(/\bwasnt\b/gi, "wasn't")
    .replace(/\bwerent\b/gi, "weren't")
    .replace(/\bive\b/gi, "I've")
    .replace(/\bill\b/gi, "I'll")
    .replace(/\bthats\b/gi, "that's")
    .replace(/\btheres\b/gi, "there's")
    .replace(/\bwhats\b/gi, "what's")
    .replace(/\bcuz\b/gi, "because")
    .replace(/\bwanna\b/gi, "want to")
    .replace(/\bgonna\b/gi, "going to")
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1');

  polished = polished.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`;
  });

  if (/[A-Za-z]$/.test(polished) && !/[.!?]$/.test(polished)) {
    polished += '.';
  }

  return polished;
}

function buildLocalSummary(text: string): { title: string; detail: string | null } {
  const original = text.trim();
  const cleaned = cleanDetailText(text);
  if (!cleaned) return { title: original, detail: null };

  const withoutBullets = cleaned.replace(/^[\-*•\d.)\s]+/, '').trim();
  const chunks = withoutBullets
    .split(/(?<=[。！？.!?])\s+|(?<=;)\s+|\n+/)
    .map(part => part.trim())
    .filter(Boolean);

  const clauseCandidates = withoutBullets
    .split(/[，,、]+/)
    .map(part => part.trim())
    .filter(Boolean);

  const boringLeadPattern = /^(very|really|so|super|quite|pretty|kind of|sort of|interesting|nice|cool|fun|great|amazing|wow|honestly|basically|actually|today|tonight|just|and then|then)\b/i;
  const actionPattern = /\b(went|met|found|fixed|finished|submitted|called|talked|learned|noticed|realized|discovered|visited|started|stopped|watched|worked|wrote|made|cooked|cleaned|bought|got|prepared|showed|moved|booked)\b/i;
  const chineseActionPattern = /(去了|见了|认识了|发现了|修好了|完成了|提交了|打了电话|聊了|学到了|注意到|意识到|看了|做了|写了|买了|准备了|搬了|预约了)/;

  const normalizedClauses = clauseCandidates
    .map(clause => clause
      .replace(/^when\s+/i, '')
      .replace(/^while\s+/i, '')
      .replace(/^I first (knew|know) that\s+/i, '')
      .replace(/^I realized that\s+/i, '')
      .replace(/^I found that\s+/i, '')
      .replace(/^there(?:'s| is)\s+/i, '')
      .replace(/^(today|tonight|just|actually|basically|so|then|and)\s+/i, '')
      .replace(/^(今天|刚刚|就是|然后|所以)\s*/g, '')
      .trim())
    .filter(Boolean);

  const pickedClause =
    normalizedClauses.find(clause => !boringLeadPattern.test(clause) && (actionPattern.test(clause) || chineseActionPattern.test(clause))) ||
    normalizedClauses.find(clause => !boringLeadPattern.test(clause) && clause.length >= 12) ||
    normalizedClauses[0] ||
    chunks[0] ||
    withoutBullets;

  let normalizedTitle = pickedClause
    .replace(/^I\s+/i, '')
    .replace(/^I'm\s+/i, '')
    .replace(/^we\s+/i, '')
    .replace(/^there(?:'s| is)\s+/i, '')
    .trim();

  if (/playground next to my apt/i.test(normalizedTitle)) {
    normalizedTitle = 'Found a playground next to my apartment';
  }

  if (/mayors event/i.test(normalizedTitle)) {
    normalizedTitle = normalizedTitle.replace(/mayors event/i, "mayor's event");
  }

  if (/^[a-z]/.test(normalizedTitle)) {
    normalizedTitle = normalizedTitle.charAt(0).toUpperCase() + normalizedTitle.slice(1);
  }

  const maxTitleLen = /[\u4e00-\u9fff]/.test(normalizedTitle) ? 24 : 48;
  let title = normalizedTitle;
  if (title.length > maxTitleLen) {
    title = `${title.slice(0, maxTitleLen).trim()}…`;
  }
  if (!title) {
    title = withoutBullets.slice(0, maxTitleLen).trim();
  }

  return {
    title,
    detail: title !== original ? original : null,
  };
}

function isStandaloneUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\/[^\s]+$/i.test(trimmed);
}

interface TodayViewProps {
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  recordedDates?: Set<string>;
  getMomentsForDate: (date: string) => Moment[];
  onAddMoment: (data: {
    text?: string;
    emoji?: string;
    photos: string[];
    links?: MomentLinkPreview[];
    tags?: string[];
    location?: { name: string; lat: number; lng: number; category: 'restaurant' | 'coffee' | 'grocery' | 'park' | 'museum' | 'other' };
    isSpecial?: boolean;
  }) => Promise<Moment | undefined> | void;
  onEditMoment?: (id: string, data: MomentEditUpdates) => void;
  onDeleteMoment?: (id: string) => void;
  todayMode?: TodayMode;
  onTodayModeChange?: (mode: TodayMode) => void;
  todosDone?: number;
  todosTotal?: number;
  completedTodos?: Todo[];
  allTodos?: Todo[];
  allMoments?: Moment[];
  importedEvents?: ImportedEvent[];
  onUpdateTodo?: (id: string, updates: Partial<Todo>) => void;
  onUpdateImportedEvent?: (id: string, updates: Partial<ImportedEvent>) => void;
  wakeHour?: number;
  wakeMinute?: number;
  bedtimeHour?: number;
  bedtimeMinute?: number;
  homepageImageUrl?: string;
  onOpenVoiceSheet?: () => void;
  voiceSheetOpen?: boolean;
}

// Default emojis - will be overridden by useCustomOptions

// Default values - will be overridden by props
const DEFAULT_BEDTIME_HOUR = 23;
const DEFAULT_BEDTIME_MINUTE = 30;
const DEFAULT_WAKE_HOUR = 8;
const DEFAULT_WAKE_MINUTE = 0;

function getTimeDisplayVisible(): boolean {
  const stored = localStorage.getItem('time-display-style');
  if (stored === 'hidden') return false;
  const oldVal = localStorage.getItem('show-time-display');
  if (oldVal === 'false') return false;
  return true;
}

function DayTimeDisplay({ mode, todosDone, todosTotal, timeRecordedPct, bedtimeHour, bedtimeMinute, wakeHour, wakeMinute, onWakeChange, onBedtimeChange, selectedDate, compact }: { mode?: TodayMode; todosDone?: number; todosTotal?: number; timeRecordedPct?: number; bedtimeHour: number; bedtimeMinute: number; wakeHour: number; wakeMinute: number; onWakeChange?: (h: number, m: number) => void; onBedtimeChange?: (h: number, m: number) => void; selectedDate?: Date; compact?: boolean }) {
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

function DailyHabitTracker({
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
function EditableCompletedTodo({ todo, onUpdate }: { todo: Todo; onUpdate: (updates: Partial<Todo>) => void }) {
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
function MomentTimerSummary({ title, elapsed, startedAt, onConfirm, onCancel }: {
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
function MomentTimeEditor({ moment, onEditMoment }: { moment: Moment; onEditMoment?: (id: string, data: Partial<Moment>) => void }) {
  const { t } = useLanguage();
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

function ImportedEventTimeEditor({ event, onUpdate }: { event: ImportedEvent; onUpdate?: (id: string, data: Partial<ImportedEvent>) => void }) {
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
function MomentDisplay({ moment, index, onStartEdit, onStartTimer, onLightbox, onEditMoment }: {
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
function formatReplayDuration(totalMinutes: number, lang: string): string {
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (lang === 'zh') {
    if (hrs > 0 && mins > 0) return `${hrs}小时${mins}分钟`;
    if (hrs > 0) return `${hrs}小时`;
    return `${mins}分钟`;
  }
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

function cleanReplayTitle(rawTitle: string): string {
  const { subtitle } = parseSubtitleDetail(rawTitle);
  let title = subtitle
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[😀-🙏✨🌟⭐️🔥🎉💡📍⏱📝]+/u, '')
    .replace(/^(very|really|so|super|quite|pretty|interesting|nice|cool|fun|great|amazing|wow|honestly|basically|actually)\s*,?\s*/i, '')
    .replace(/^I\s+/i, '')
    .replace(/^I'm\s+/i, '')
    .replace(/^when\s+/i, '')
    .replace(/^went to\s+/i, 'Went to ')
    .replace(/^showing\s+/i, 'Showing ')
    .replace(/^showing her around my apt/i, 'Showed her around my apartment')
    .replace(/^there(?:'s| is)\s+/i, '')
    .replace(/mayors event/gi, "mayor's event")
    .replace(/\s+([,.!?])/g, '$1')
    .trim();

  if (!title) return '';
  title = title.replace(/[,.!?]+$/, '').trim();
  if (/^[a-z]/.test(title)) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  return title;
}

function buildLocalLifeReplay(
  events: { time: string; title: string; duration?: string }[],
  lang: string
): string | null {
  if (events.length < 3) return null;

  const cleaned = events
    .map(event => ({
      ...event,
      title: cleanReplayTitle(event.title),
    }))
    .filter(event => event.title.length > 0);

  if (cleaned.length < 3) return null;

  const first = cleaned[0];
  const middle = cleaned[Math.floor(cleaned.length / 2)];
  const last = cleaned[cleaned.length - 1];
  const totalMoments = cleaned.length;
  const totalMinutes = cleaned.reduce((sum, event) => {
    const match = event.duration?.match(/(\d+)m/i);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);
  const timeHint = totalMinutes > 0 ? formatReplayDuration(totalMinutes, lang) : null;

  const middleFragments = cleaned
    .slice(1, -1)
    .map(event => event.title)
    .filter((title, index, arr) => arr.indexOf(title) === index)
    .slice(0, 2);

  if (lang === 'zh') {
    const fragments = [
      `${first.time}从「${first.title}」开始`,
      middleFragments.length > 0 ? `中间经过「${middleFragments.join('」和「')}」` : `中间还记录了「${middle.title}」`,
      `最后落在「${last.title}」`,
    ];
    if (timeHint) fragments.push(`总共活跃了大约 ${timeHint}`);
    return `今天一共串起了 ${totalMoments} 个片段，${fragments.join('，')}。`;
  }

  const fragments = [
    `You started with ${first.title} at ${first.time}`,
    middleFragments.length > 0 ? `moved through ${middleFragments.join(' and ')}` : `moved through ${middle.title}`,
    `and wrapped with ${last.title}`,
  ];
  if (timeHint) fragments.push(`for about ${timeHint} of active time`);
  return `${fragments.join(', ')} across ${totalMoments} moments today.`;
}

function LifeReplay({ items, lang, dateKey }: { items: { type: string; time: Date; endTime?: Date; data: any }[]; lang: string; dateKey: string }) {
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

export function TodayView({ selectedDate, onSelectedDateChange, recordedDates, getMomentsForDate, onAddMoment, onEditMoment, onDeleteMoment, todayMode, onTodayModeChange, todosDone, todosTotal, completedTodos, allTodos, allMoments, importedEvents = [], onUpdateTodo, onUpdateImportedEvent, wakeHour: propWakeHour, wakeMinute: propWakeMinute, bedtimeHour: propBedtimeHour, bedtimeMinute: propBedtimeMinute, homepageImageUrl, onOpenVoiceSheet, voiceSheetOpen }: TodayViewProps) {
  const { formatDate } = useDateLocale();
  const { t, lang } = useLanguage();
  const isDarkMode = useIsDarkMode();
  const { getWorkType } = useWorkTypes();
  const { dues, addDue, updateDue, incrementHabitCount, setHabitCount } = useDues();
  const { defaultRecapTags, customRecapTags, allEmojis, orderedRecapTags } = useCustomOptions();
  const emojis = allEmojis;
  const quickTags = orderedRecapTags.map(key => {
    const def = defaultRecapTags.find(d => d.key === key);
    return { key, label: def ? t(key) : key };
  });
  const WAKE_HOUR = propWakeHour ?? DEFAULT_WAKE_HOUR;
  const WAKE_MINUTE = propWakeMinute ?? DEFAULT_WAKE_MINUTE;
  const BEDTIME_HOUR = propBedtimeHour ?? DEFAULT_BEDTIME_HOUR;
  const BEDTIME_MINUTE = propBedtimeMinute ?? DEFAULT_BEDTIME_MINUTE;
  const [text, setText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ name: string; lat: number; lng: number; category: 'restaurant' | 'coffee' | 'grocery' | 'park' | 'museum' | 'other' } | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [selectedLinks, setSelectedLinks] = useState<MomentLinkPreview[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [inputStartTime, setInputStartTime] = useState(() => format(new Date(), 'HH:mm'));
  const [inputEndTime, setInputEndTime] = useState(() => format(new Date(), 'HH:mm'));
  const [locationOpen, setLocationOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingLink, setIsResolvingLink] = useState(false);
  // Inline timeline insertion state
  const [inlineInsertTime, setInlineInsertTime] = useState<string | null>(null);
  const [inlineInsertText, setInlineInsertText] = useState('');
  const [inlineInsertSubmitting, setInlineInsertSubmitting] = useState(false);
  const inlineInsertRef = useRef<HTMLInputElement>(null);
  const [reminderConfig, setReminderConfig] = useState<{ enabled: boolean; intervalDays: number }>({ enabled: false, intervalDays: 30 });
  const { addReminder } = useReminders();

  // Auto-detect tags from text
  const autoDetectedTags = useMemo(() => detectAutoTags(text), [text]);
  const allFinalTags = useMemo(() => [...new Set([...selectedTags, ...autoDetectedTags])], [selectedTags, autoDetectedTags]);




  // Photo lightbox state
  const [lightboxPhotos, setLightboxPhotos] = useState<{ photos: string[]; index: number } | null>(null);

  // Moment timer state
  const [timerMomentId, setTimerMomentId] = useState<string | null>(null);
  const [timerTargetType, setTimerTargetType] = useState<'moment' | 'imported'>('moment');
  const [timerMomentTitle, setTimerMomentTitle] = useState('');
  const [momentTimerElapsed, setMomentTimerElapsed] = useState(0);
  const [momentTimerStartedAt, setMomentTimerStartedAt] = useState<string | null>(null);
  const [momentTimerPaused, setMomentTimerPaused] = useState(false);
  const [momentPauseElapsed, setMomentPauseElapsed] = useState(0);
  const [showMomentTimerOverlay, setShowMomentTimerOverlay] = useState(false);
  const [showMomentTimerSummary, setShowMomentTimerSummary] = useState(false);
  const [originalTimerSnapshot, setOriginalTimerSnapshot] = useState<{ startedAt: string | null; endedAt: string | null; seconds: number | null } | null>(null);

  // Moment timer tick
  useEffect(() => {
    if (!timerMomentId || momentTimerPaused) return;
    const interval = setInterval(() => setMomentTimerElapsed(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [timerMomentId, momentTimerPaused]);

  // Pause duration tick
  useEffect(() => {
    if (!timerMomentId || !momentTimerPaused) return;
    const interval = setInterval(() => setMomentPauseElapsed(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [timerMomentId, momentTimerPaused]);

  const startMomentTimer = (moment: Moment) => {
    const startISO = new Date().toISOString();
    setTimerMomentId(moment.id);
    setTimerTargetType('moment');
    setTimerMomentTitle(moment.text || moment.emoji || 'Moment');
    setMomentTimerElapsed(0);
    setMomentPauseElapsed(0);
    setMomentTimerStartedAt(startISO);
    setMomentTimerPaused(false);
    setShowMomentTimerOverlay(true);
    // Save original timer values so we can restore on cancel
    setOriginalTimerSnapshot({
      startedAt: moment.timer_started_at || null,
      endedAt: moment.timer_ended_at || null,
      seconds: moment.timer_seconds ?? null,
    });
    // Persist timer start immediately
    if (onEditMoment) {
      onEditMoment(moment.id, { timer_started_at: startISO } as Partial<Moment>);
    }
  };

  const startImportedEventTimer = (event: ImportedEvent) => {
    const startISO = new Date().toISOString();
    setTimerMomentId(event.id);
    setTimerTargetType('imported');
    setTimerMomentTitle(event.title || 'Calendar event');
    setMomentTimerElapsed(0);
    setMomentPauseElapsed(0);
    setMomentTimerStartedAt(startISO);
    setMomentTimerPaused(false);
    setShowMomentTimerOverlay(true);
    setOriginalTimerSnapshot({
      startedAt: event.timer_started_at || null,
      endedAt: event.timer_ended_at || null,
      seconds: event.timer_seconds ?? null,
    });
    onUpdateImportedEvent?.(event.id, { timer_started_at: startISO, timer_ended_at: null, timer_seconds: 0 });
  };

  const handleMomentTimerStop = () => {
    setShowMomentTimerOverlay(false);
    setShowMomentTimerSummary(true);
  };

  const handleMomentTimerCancel = () => {
    // Restore original timer values
    if (timerMomentId) {
      const restore = {
        timer_started_at: originalTimerSnapshot?.startedAt ?? null,
        timer_ended_at: originalTimerSnapshot?.endedAt ?? null,
        timer_seconds: originalTimerSnapshot?.seconds ?? null,
      };
      if (timerTargetType === 'moment') onEditMoment?.(timerMomentId, restore as Partial<Moment>);
      else onUpdateImportedEvent?.(timerMomentId, restore as Partial<ImportedEvent>);
    }
    setTimerMomentId(null);
    setShowMomentTimerOverlay(false);
    setShowMomentTimerSummary(false);
    setOriginalTimerSnapshot(null);
  };

  const handleMomentTimerConfirm = (data: { startTime: string; endTime: string }) => {
    if (timerMomentId) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startISO = localTimeOnDateISO(dateStr, data.startTime);
      const endISO = localTimeOnDateISO(dateStr, data.endTime);
      if (!startISO || !endISO) return;
      const diffSec = durationSeconds(startISO, endISO);
      const updates = { timer_started_at: startISO, timer_ended_at: endISO, timer_seconds: diffSec };
      if (timerTargetType === 'moment') onEditMoment?.(timerMomentId, updates as Partial<Moment>);
      else onUpdateImportedEvent?.(timerMomentId, updates as Partial<ImportedEvent>);
    }
    setTimerMomentId(null);
    setShowMomentTimerSummary(false);
    setOriginalTimerSnapshot(null);
  };
  
  // Edit state
  const [editingMoment, setEditingMoment] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoTitle, setEditingTodoTitle] = useState('');
  const [editingImportedEventId, setEditingImportedEventId] = useState<string | null>(null);
  const [editingImportedEventTitle, setEditingImportedEventTitle] = useState('');
  const [expandedStreamIds, setExpandedStreamIds] = useState<Set<string>>(new Set());
  const toggleStreamExpand = (id: string) => setExpandedStreamIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [editText, setEditText] = useState('');
  const [editDetailText, setEditDetailText] = useState<string | null>(null);
  const [editEmoji, setEditEmoji] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState<{ name: string; lat: number; lng: number; category: 'restaurant' | 'coffee' | 'grocery' | 'park' | 'museum' | 'other' } | null>(null);
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editLocationOpen, setEditLocationOpen] = useState(false);
  const [editEmojiOpen, setEditEmojiOpen] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recapContentRef = useRef<HTMLDivElement>(null);
  const recapRightColRef = useRef<HTMLDivElement>(null);
  const [recapInputDock, setRecapInputDock] = useState<{ left: number; width: number } | null>(null);
  const [headerImageSrc, setHeaderImageSrc] = useState(homepageImageUrl || monetPainting);
  
  
  const today = selectedDate;
  const selectedDateStr = format(today, 'yyyy-MM-dd');
  const todayMoments = getMomentsForDate(format(today, 'yyyy-MM-dd'));
  const recapHabits = useMemo(
    () => dues.filter(due => due.habit_category !== null && due.show_in_recap_daily && !due.is_completed),
    [dues]
  );

  useEffect(() => {
    setHeaderImageSrc(homepageImageUrl || monetPainting);
  }, [homepageImageUrl]);

  // Sort moments by effective start time (timer_started_at or createdAt), chronologically
  const sortedMoments = useMemo(() => {
    return [...todayMoments].sort((a, b) => {
      const aTime = a.timer_started_at ? new Date(a.timer_started_at).getTime() : new Date(a.createdAt).getTime();
      const bTime = b.timer_started_at ? new Date(b.timer_started_at).getTime() : new Date(b.createdAt).getTime();
      return aTime - bTime;
    });
  }, [todayMoments]);

  // Calculate non-overlapping time coverage percentage
  const timeRecordedPct = useMemo(() => {
    const wakeMin = WAKE_HOUR * 60 + WAKE_MINUTE;
    const bedMin = BEDTIME_HOUR * 60 + BEDTIME_MINUTE;
    const totalDayMin = bedMin - wakeMin;
    if (totalDayMin <= 0) return 0;

    // Collect all time intervals from todos and moments
    const intervals: [number, number][] = [];
    
    // From moments
    todayMoments.forEach(m => {
      if (m.timer_started_at && m.timer_ended_at) {
        const s = new Date(m.timer_started_at);
        const e = new Date(m.timer_ended_at);
        intervals.push([s.getHours() * 60 + s.getMinutes(), e.getHours() * 60 + e.getMinutes()]);
      }
    });

    // From completed todos
    (completedTodos || []).forEach(t => {
      if (t.timer_started_at && t.timer_ended_at) {
        const s = parseISO(t.timer_started_at);
        const e = parseISO(t.timer_ended_at);
        intervals.push([s.getHours() * 60 + s.getMinutes(), e.getHours() * 60 + e.getMinutes()]);
      }
    });

    importedEvents.forEach(event => {
      const startIso = getImportedEventEffectiveStart(event);
      const endIso = getImportedEventEffectiveEnd(event);
      if (startIso && endIso) {
        const s = parseISO(startIso);
        const e = parseISO(endIso);
        intervals.push([s.getHours() * 60 + s.getMinutes(), e.getHours() * 60 + e.getMinutes()]);
      }
    });

    if (intervals.length === 0) return 0;

    // Merge overlapping intervals
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const last = merged[merged.length - 1];
      if (intervals[i][0] <= last[1]) {
        last[1] = Math.max(last[1], intervals[i][1]);
      } else {
        merged.push(intervals[i]);
      }
    }

    const coveredMin = merged.reduce((sum, [s, e]) => sum + Math.max(0, Math.min(e, bedMin) - Math.max(s, wakeMin)), 0);
    return Math.round((coveredMin / totalDayMin) * 100);
  }, [todayMoments, completedTodos, importedEvents]);

  const shouldShowSampleTag = (moment: Moment) => {
    if (!moment.id.startsWith('sample-')) return false;
    // If the stored text already contains the tag, avoid duplicating in UI.
    return !(moment.text || '').includes('(sample)');
  };

  const timelineItems = useMemo(() => {
    type TimelineItem =
      | { type: 'todo'; data: Todo; time: Date; endTime?: Date; isPlanOutline?: boolean }
      | { type: 'moment'; data: Moment; time: Date; endTime?: Date; isPlanOutline?: boolean }
      | { type: 'imported'; data: ImportedEvent; time: Date; endTime?: Date; isPlanOutline?: boolean };

    const items: TimelineItem[] = [];

    completedTodos?.forEach(todo => {
      const time = todo.timer_started_at ? parseISO(todo.timer_started_at) : parseISO(todo.created_at);
      const endTime = todo.timer_ended_at ? parseISO(todo.timer_ended_at) : undefined;
      items.push({ type: 'todo', data: todo, time, endTime });
    });

    allTodos?.forEach(todo => {
      if (todo.is_completed) return;
      if (!todo.timer_started_at || !todo.timer_ended_at) return;
      if ((todo.timer_seconds || 0) <= 0) return;
      const time = parseISO(todo.timer_started_at);
      const endTime = parseISO(todo.timer_ended_at);
      items.push({ type: 'todo', data: todo, time, endTime });
    });

    allTodos?.forEach(todo => {
      if (todo.is_completed || !todo.timer_started_at) return;
      if (!todo.timer_ended_at) return;
      if ((todo.timer_seconds || 0) > 0) return;
      const time = parseISO(todo.timer_started_at);
      const endTime = parseISO(todo.timer_ended_at);
      const now = Date.now();
      if (endTime.getTime() > now) return;
      const createdAt = parseISO(todo.created_at).getTime();
      if (createdAt > endTime.getTime()) return;
      items.push({ type: 'todo', data: todo, time, endTime, isPlanOutline: true });
    });

    sortedMoments.forEach(moment => {
      const time = moment.timer_started_at ? parseISO(moment.timer_started_at) : parseISO(moment.createdAt);
      const endTime = moment.timer_ended_at ? parseISO(moment.timer_ended_at) : undefined;
      items.push({ type: 'moment', data: moment, time, endTime });
    });

    importedEvents.forEach(event => {
      const startIso = getImportedEventEffectiveStart(event);
      const endIso = getImportedEventEffectiveEnd(event);
      const time = parseISO(startIso);
      const endTime = endIso ? parseISO(endIso) : undefined;
      if (Number.isFinite(time.getTime())) {
        items.push({ type: 'imported', data: event, time, endTime });
      }
    });

    items.sort((a, b) => a.time.getTime() - b.time.getTime());
    return items;
  }, [completedTodos, allTodos, sortedMoments, importedEvents]);

  // Click outside to close edit
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest('[data-edit-popover="true"]')) return;
      if (editingMoment && editRef.current && !editRef.current.contains(target as Node)) {
        if (onEditMoment) {
          const trimmedTitle = editText.trim();
          const trimmedDetail = editDetailText?.trim();
          const finalText = trimmedDetail ? trimmedTitle + DETAIL_SEPARATOR + trimmedDetail : trimmedTitle;
          onEditMoment(editingMoment, {
            text: finalText || undefined,
            emoji: editEmoji || undefined,
            location: editLocation ?? null,
            photos: uniquePhotoList(editPhotos),
            tags: editTags,
          });
        }
        setEditingMoment(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingMoment, editText, editDetailText, editEmoji, editLocation, editPhotos, editTags, onEditMoment]);

  // Inline timeline insertion handler
  const handleInlineInsert = useCallback(async (timeStr: string) => {
    if (inlineInsertSubmitting || !inlineInsertText.trim()) return;
    setInlineInsertSubmitting(true);
    try {
      // If no emoji provided, classify mood from text
      const insertText = inlineInsertText.trim();
      const moodEmoji = insertText ? classifyMood(insertText).emoji : null;
      const result = await onAddMoment({ text: insertText, photos: [], emoji: moodEmoji || undefined });
      if (result && result.id && onEditMoment) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const startISO = new Date(`${dateStr}T${timeStr}:00`).toISOString();
        await Promise.resolve(onEditMoment(result.id, {
          timer_started_at: startISO,
          timer_ended_at: null,
          timer_seconds: null,
        } as Partial<Moment>));
      }
      setInlineInsertText('');
      setInlineInsertTime(null);
    } finally {
      setInlineInsertSubmitting(false);
    }
  }, [inlineInsertSubmitting, inlineInsertText, onAddMoment, onEditMoment, selectedDate]);

  const handleSend = useCallback(async () => {
    if (isSubmitting || (!text.trim() && !selectedLocation && !selectedEmoji && selectedPhotos.length === 0 && selectedLinks.length === 0 && selectedTags.length === 0)) return;

    setIsSubmitting(true);
    try {
      const rawText = lightlyPolishRecapText(text);
      
      let finalText = rawText || undefined;
      if (rawText && shouldSummarize(rawText)) {
        const { title, detail } = buildLocalSummary(rawText);
        finalText = detail ? title + DETAIL_SEPARATOR + detail : title;
      }

      // If user didn't pick an emoji, try to auto-classify from text (only when there's text)
      let chosenEmoji: string | undefined = selectedEmoji || undefined;
      if (!chosenEmoji && finalText) {
        const cls = classifyMood(finalText as string);
        if (cls.emoji) chosenEmoji = cls.emoji;
      }

      const result = await onAddMoment({
        text: finalText,
        emoji: chosenEmoji,
        photos: selectedPhotos,
        links: selectedLinks,
        location: selectedLocation || undefined,
        tags: allFinalTags.length > 0 ? allFinalTags : undefined,
      });

      if (result && result.id && inputStartTime && onEditMoment) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const startISO = new Date(`${dateStr}T${inputStartTime}:00`).toISOString();
        const isSameTime = !inputEndTime || inputEndTime === inputStartTime;
        const endISO = isSameTime ? undefined : new Date(`${dateStr}T${inputEndTime}:00`).toISOString();
        const diffSec = endISO ? Math.max(0, Math.floor((new Date(endISO).getTime() - new Date(startISO).getTime()) / 1000)) : undefined;
        await Promise.resolve(onEditMoment(result.id, {
          timer_started_at: startISO,
          timer_ended_at: endISO || null,
          timer_seconds: diffSec ?? null,
        } as Partial<Moment>));
      }

      // Create reminder if enabled
      if (reminderConfig.enabled) {
        await addReminder(
          rawText || selectedEmoji || 'Reminder',
          reminderConfig.intervalDays,
          `From moment: ${rawText}`
        );
      }

      setText('');
      setSelectedEmoji(null);
      setSelectedLocation(null);
      setSelectedPhotos([]);
      setSelectedLinks([]);
      setSelectedTags([]);
      setReminderConfig({ enabled: false, intervalDays: 30 });
      setInputStartTime(format(new Date(), 'HH:mm'));
      setInputEndTime(format(new Date(), 'HH:mm'));
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, text, selectedEmoji, selectedLocation, selectedPhotos, selectedLinks, selectedTags, onAddMoment, inputStartTime, inputEndTime, selectedDate, onEditMoment, reminderConfig, addReminder, allFinalTags]);

  const addLinkPreview = useCallback(async (rawUrl: string) => {
    const url = normalizeUrl(rawUrl);
    if (!url) {
      toast.error('Invalid link');
      return false;
    }
    const siteFallback = (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return url;
      }
    })();

    let shouldFetch = false;
    setSelectedLinks(prev => {
      if (prev.some(link => link.url === url)) return prev;
      shouldFetch = true;
      return [...prev, { url, siteName: siteFallback, title: siteFallback }];
    });
    if (!shouldFetch) return true;

    setIsResolvingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('link-preview', {
        body: { url },
      });

      if (error) {
        console.error('Link preview failed:', error);
        toast.warning('Preview unavailable, link added anyway');
        return true;
      }

      const preview: MomentLinkPreview = {
        url,
        title: typeof data?.title === 'string' ? data.title : siteFallback,
        description: typeof data?.description === 'string' ? data.description : undefined,
        image: typeof data?.image === 'string' ? data.image : undefined,
        siteName: typeof data?.siteName === 'string' ? data.siteName : siteFallback,
      };

      setSelectedLinks(prev => prev.map(link => link.url === url ? { ...link, ...preview } : link));
      return true;
    } catch (err) {
      console.error('Link preview exception:', err);
      toast.warning('Preview unavailable, link added anyway');
      return true;
    } finally {
      setIsResolvingLink(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const native = e.nativeEvent as KeyboardEvent;
    const isComposing = isImeComposing(native);
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    let handledImage = false;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        handledImage = true;
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (dataUrl) setSelectedPhotos(prev => [...prev, dataUrl]);
        };
        reader.readAsDataURL(file);
      }
    }
    if (handledImage) return;

    const pastedText = e.clipboardData.getData('text/plain');
    const pastedUrl = extractFirstUrl(pastedText);
    if (pastedUrl && isStandaloneUrl(pastedUrl)) {
      e.preventDefault();
      void addLinkPreview(pastedUrl);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const validFiles = Array.from(files).filter(f => validatePhotoFile(f));
    if (!canAddMorePhotos(selectedPhotos.length, validFiles.length)) return;
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setSelectedPhotos(prev => [...prev, dataUrl]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const startEdit = (moment: Moment) => {
    const { subtitle, detail } = parseSubtitleDetail(moment.text);
    setEditingMoment(moment.id);
    setEditText(subtitle);
    setEditDetailText(detail);
    setEditEmoji(moment.emoji || null);
    setEditLocation(moment.location ? { ...moment.location, category: moment.location.category || 'other' } : null);
    setEditPhotos(uniquePhotoList(moment.photos || []));
    setEditTags(moment.tags || []);
  };

  const handleEditFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const validFiles = Array.from(files).filter(f => validatePhotoFile(f));
    if (!canAddMorePhotos(editPhotos.length, validFiles.length)) return;
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setEditPhotos(prev => uniquePhotoList([...prev, dataUrl]));
        }
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };

  const removeEditPhoto = (index: number) => {
    setEditPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const saveEdit = () => {
    if (editingMoment && onEditMoment) {
      const trimmedTitle = editText.trim();
      const trimmedDetail = editDetailText?.trim();
      const finalText = trimmedDetail ? trimmedTitle + DETAIL_SEPARATOR + trimmedDetail : trimmedTitle;
      onEditMoment(editingMoment, {
        text: finalText || undefined,
        emoji: editEmoji || undefined,
        location: editLocation ?? null,
        photos: uniquePhotoList(editPhotos),
        tags: editTags,
      });
    }
    setEditingMoment(null);
  };

  useEffect(() => {
    if (todayMode === 'plan') return;

    const updateRecapInputDock = () => {
      const el = recapRightColRef.current ?? recapContentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setRecapInputDock({
        left: rect.left + 8,
        width: Math.max(280, rect.width - 16),
      });
    };

    updateRecapInputDock();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateRecapInputDock())
      : null;
    const observe = recapRightColRef.current ?? recapContentRef.current;
    if (resizeObserver && observe) resizeObserver.observe(observe);

    window.addEventListener('resize', updateRecapInputDock);
    window.addEventListener('scroll', updateRecapInputDock, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateRecapInputDock);
      window.removeEventListener('scroll', updateRecapInputDock, true);
    };
  }, [todayMode]);

  const canSend = text.trim() || selectedLocation || selectedEmoji || selectedPhotos.length > 0 || selectedLinks.length > 0 || selectedTags.length > 0;

  return (
    <div className="flex-1 flex flex-col">
      {/* Moment focusing overlay */}
      {showMomentTimerOverlay && timerMomentId && (
        <div
          className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-10 animate-fade-in cursor-pointer"
          onClick={() => setShowMomentTimerOverlay(false)}
        >
          <p className="text-xs text-muted-foreground/60 tracking-[0.3em] uppercase">
            {momentTimerPaused ? 'Paused' : 'Focusing'}
          </p>
          <p className="text-base font-medium text-foreground/80">{timerMomentTitle}</p>
          <div className="text-5xl font-mono font-extralight text-foreground/30 tabular-nums">
            {String(Math.floor(momentTimerElapsed / 3600)).padStart(2, '0')}:{String(Math.floor((momentTimerElapsed % 3600) / 60)).padStart(2, '0')}
          </div>
          {momentTimerPaused && momentPauseElapsed > 0 && (
            <p className="text-sm font-mono text-muted-foreground/50 tabular-nums">
              paused {String(Math.floor(momentPauseElapsed / 60)).padStart(2, '0')}:{String(momentPauseElapsed % 60).padStart(2, '0')}
            </p>
          )}
          <div className="flex items-center gap-6" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setMomentTimerPaused(p => !p); setMomentPauseElapsed(0); }} className="w-12 h-12 rounded-full border border-border/50 flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors">
              {momentTimerPaused ? <Play size={20} /> : <Pause size={20} />}
            </button>
            <button onClick={handleMomentTimerStop} className="w-10 h-10 rounded-full border border-border/30 flex items-center justify-center text-primary/60 hover:text-primary transition-colors"><Square size={14} /></button>
            <button onClick={handleMomentTimerCancel} className="w-10 h-10 rounded-full border border-border/30 flex items-center justify-center text-destructive/50 hover:text-destructive transition-colors"><X size={14} /></button>
          </div>
          <p className="text-xs text-muted-foreground/30 mt-4">tap anywhere to minimize</p>
        </div>
      )}

      {/* Photo lightbox */}
      {lightboxPhotos && (
        <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={() => setLightboxPhotos(null)}>
          <button onClick={() => setLightboxPhotos(null)} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground z-10">
            <X size={24} />
          </button>
          <div className="relative max-w-[90vw] max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <img src={lightboxPhotos.photos[lightboxPhotos.index]} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            {lightboxPhotos.photos.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-3">
                {lightboxPhotos.photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxPhotos({ ...lightboxPhotos, index: i })}
                    className={cn("w-2 h-2 rounded-full transition-colors", i === lightboxPhotos.index ? "bg-primary" : "bg-muted-foreground/30")}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Moment timer summary */}
      {showMomentTimerSummary && momentTimerStartedAt && (
        <MomentTimerSummary
          title={timerMomentTitle}
          elapsed={momentTimerElapsed}
          startedAt={momentTimerStartedAt}
          onConfirm={handleMomentTimerConfirm}
          onCancel={handleMomentTimerCancel}
        />
      )}

      {/* Floating mini timer for moments */}
      {timerMomentId && !showMomentTimerOverlay && !showMomentTimerSummary && (
        <button
          onClick={() => setShowMomentTimerOverlay(true)}
          className={cn(
            "fixed bottom-20 right-3 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-lg transition-colors border",
            momentTimerPaused ? "bg-muted border-border text-muted-foreground" : "bg-primary/10 border-primary/30 text-foreground"
          )}
        >
          <Timer size={16} className="text-primary" />
          <div className="flex flex-col">
            <span className="text-xs truncate max-w-[120px] font-medium">{timerMomentTitle}</span>
            <span className="text-base font-mono font-semibold tabular-nums text-primary">{String(Math.floor(momentTimerElapsed / 60)).padStart(2, '0')}:{String(momentTimerElapsed % 60).padStart(2, '0')}</span>
          </div>
        </button>
      )}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Date + time + image layout */}
      <div className="pt-2 pb-1 overflow-hidden">
        <div className="flex items-start gap-3 sm:gap-5 px-4 sm:px-6">
          {/* Left: homepage image */}
          <div
            className="w-[58%] lg:w-[66%] flex-shrink-0 overflow-hidden rounded-2xl select-none"
            style={{ height: 84 }}
            onDragStart={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <img
              src={headerImageSrc}
              alt="Daily painting"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                WebkitUserDrag: 'none',
                userSelect: 'none',
                pointerEvents: 'none',
              } as React.CSSProperties}
              onError={() => {
                setHeaderImageSrc((current) => {
                  if (!current || current === dailyPainting) return '';
                  if (current === monetPainting) return dailyPainting;
                  return monetPainting;
                });
              }}
            />
          </div>

          {/* Right: date info */}
          <div className="w-[38%] lg:w-[32%] flex flex-col min-w-0 pt-1 sm:pt-1.5">
            {/* Date row */}
            <div className="flex items-start justify-between">
              <span className="self-start text-[24px] sm:text-[30px] lg:text-[36px] font-light text-foreground leading-none">
                {format(today, 'd')}
              </span>
              <div className="flex flex-col items-end gap-0 self-end">
                <span className="text-[17px] sm:text-[20px] lg:text-[24px] font-semibold text-primary uppercase tracking-[0.18em] leading-none">
                  {formatDate(today, 'MMMM')}
                </span>
                <div className="mt-1.5 flex items-center gap-1.5 leading-none">
                  <span className="text-[17px] sm:text-[20px] text-muted-foreground">
                    {formatDate(today, 'yyyy')}
                  </span>
                  <span className="text-muted-foreground text-[17px] sm:text-[20px]">·</span>
                  <span className="text-[17px] sm:text-[20px] text-muted-foreground">
                    {formatDate(today, 'EEEE')}
                  </span>
                </div>
              </div>
            </div>

            {/* Time display intentionally hidden for now: users found the plan/recap logic hard to parse. */}
          </div>
        </div>
      </div>

      <WeekDateBar
        selectedDate={today}
        onDateSelect={onSelectedDateChange}
        recordedDates={recordedDates}
        onTaskMove={async (taskId: string, newDate: string) => {
          const todo = allTodos?.find(t => t.id === taskId);
          if (!todo) {
            await onUpdateTodo?.(taskId, { date: newDate } as any);
            return;
          }

          await onUpdateTodo?.(taskId, {
            date: newDate,
            plan_started_at: moveIsoToDateKeepingLocalTime(todo.plan_started_at, newDate),
            plan_ended_at: moveIsoToDateKeepingLocalTime(todo.plan_ended_at, newDate),
            timer_started_at: moveIsoToDateKeepingLocalTime(todo.timer_started_at, newDate),
            timer_ended_at: moveIsoToDateKeepingLocalTime(todo.timer_ended_at, newDate),
          } as any);
        }}
      />

      {/* Only show recap content when in recap mode */}
      {(!todayMode || todayMode === 'recap') && (
      <>

      {/* Floating bottom input bar */}
      {!voiceSheetOpen && recapInputDock && <div
        className="fixed z-20 pointer-events-none"
        style={{ left: recapInputDock.left, width: recapInputDock.width, bottom: 16 }}
      >
        <div className="pointer-events-auto">
        {/* Auto-detected tags + selected tags badges */}
        {(selectedTags.length > 0 || autoDetectedTags.length > 0) && (
          <div className="flex gap-1.5 px-1 pb-2 overflow-x-auto">
            {[...new Set([...autoDetectedTags, ...selectedTags])].map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                {tag}
                <button onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))} className="hover:text-destructive"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="bg-[hsl(var(--toolbar-background))] border border-border rounded-[20px] shadow-[0_2px_10px_hsl(var(--foreground)/0.08)] overflow-hidden">
          {/* Photo previews */}
          {selectedPhotos.length > 0 && (
            <div className="flex gap-2 p-2.5 border-b border-border/70 overflow-x-auto">
              {selectedPhotos.map((photo, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={photo} alt="" className="w-14 h-14 object-cover rounded-lg" />
                  <button 
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-foreground text-background rounded-full flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {(selectedLinks.length > 0 || isResolvingLink) && (
            <div className="space-y-2 border-b border-border/70 p-2.5">
              {selectedLinks.map((link, index) => (
                <LinkPreviewCard
                  key={`${link.url}-${index}`}
                  preview={link}
                  compact
                  onRemove={() => setSelectedLinks(prev => prev.filter((_, i) => i !== index))}
                />
              ))}
              {isResolvingLink && (
                <div className="flex items-center gap-2 rounded-[16px] border border-border/70 bg-[hsl(var(--surface-soft))] px-3 py-2 text-[12px] text-muted-foreground">
                  <Loader2 size={13} className="animate-spin" />
                  <span>Loading link preview…</span>
                </div>
              )}
            </div>
          )}

          {/* Selected location badge */}
          {selectedLocation && (
            <div className="flex flex-wrap gap-2 px-3 pt-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[hsl(var(--surface-inset))] rounded-full text-sm animate-fade-in">
                <MapPin size={12} className="text-[hsl(var(--text-soft))]" />
                <span className="truncate max-w-[150px]">{selectedLocation.name}</span>
                <button onClick={() => setSelectedLocation(null)} className="text-muted-foreground hover:text-foreground">
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Main input row */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5">
            <InputPlusMenu
              emojis={emojis}
              selectedEmoji={selectedEmoji}
              onEmojiChange={setSelectedEmoji}
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              availableTags={quickTags}
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              autoDetectedTags={autoDetectedTags}
              onPhotoClick={handlePhotoClick}
              photoCount={selectedPhotos.length}
              onAddLink={addLinkPreview}
              linkCount={selectedLinks.length}
              reminderConfig={reminderConfig}
              onReminderChange={setReminderConfig}
              showReminder={true}
              showTime={false}
            />
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={t('today.placeholder')}
                rows={1}
                className="w-full bg-transparent resize-none focus:outline-none text-foreground placeholder:text-muted-foreground/60 text-[14px] leading-5"
                style={{ minHeight: '24px', maxHeight: '100px' }}
              />


            </div>
            {/* Direct photo button */}
            <button
              onClick={handlePhotoClick}
              className="w-8 h-8 rounded-full transition-colors flex-shrink-0 hover:bg-[hsl(var(--surface-soft-hover))] text-muted-foreground hover:text-foreground flex items-center justify-center"
              title="Add photo"
            >
              <Image size={15} />
            </button>
            {/* Direct location button */}
            <Popover open={locationOpen} onOpenChange={setLocationOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "w-8 h-8 rounded-full transition-colors flex-shrink-0 flex items-center justify-center",
                    selectedLocation
                      ? "bg-[hsl(var(--surface-inset))] text-foreground"
                      : "hover:bg-[hsl(var(--surface-soft-hover))] text-muted-foreground hover:text-foreground"
                  )}
                  title="Add location"
                >
                  <MapPin size={15} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 bg-popover z-50" align="end" side="top">
                <LocationPopover
                  onSelect={(loc) => { setSelectedLocation(loc); setLocationOpen(false); }}
                  onClose={() => setLocationOpen(false)}
                />
              </PopoverContent>
            </Popover>
            {onOpenVoiceSheet && (
              <button
                onClick={onOpenVoiceSheet}
                className="w-8 h-8 rounded-full transition-colors flex-shrink-0 hover:bg-[hsl(var(--surface-soft-hover))] text-muted-foreground hover:text-foreground flex items-center justify-center"
              >
                <Mic size={15} />
              </button>
            )}
            <Button
              onClick={async () => {
                if (isSubmitting || !canSend) return;
                setIsSubmitting(true);
                try {
                  const rawText = lightlyPolishRecapText(text);
                  let finalText = rawText || undefined;
                  if (rawText && shouldSummarize(rawText)) {
                    const { title, detail } = buildLocalSummary(rawText);
                    finalText = detail ? title + DETAIL_SEPARATOR + detail : title;
                  }
                  const result = await onAddMoment({
                    text: finalText,
                    emoji: selectedEmoji || undefined,
                    photos: selectedPhotos,
                    links: selectedLinks,
                    location: selectedLocation || undefined,
                    tags: allFinalTags.length > 0 ? allFinalTags : undefined,
                  });
                  if (result && result.id && inputStartTime && onEditMoment) {
                    const dateStr = format(selectedDate, 'yyyy-MM-dd');
                    const startISO = new Date(`${dateStr}T${inputStartTime}:00`).toISOString();
                    const isSameTime = !inputEndTime || inputEndTime === inputStartTime;
                    const endISO = isSameTime ? undefined : new Date(`${dateStr}T${inputEndTime}:00`).toISOString();
                    const diffSec = endISO ? Math.max(0, Math.floor((new Date(endISO).getTime() - new Date(startISO).getTime()) / 1000)) : undefined;
                    await Promise.resolve(onEditMoment(result.id, {
                      timer_started_at: startISO, timer_ended_at: endISO || null, timer_seconds: diffSec ?? null,
                    } as Partial<Moment>));
                  }
                  if (reminderConfig.enabled && result) {
                    await addReminder(text.trim() || selectedEmoji || 'Reminder', reminderConfig.intervalDays, `From moment: ${text.trim()}`);
                  }
                  setText(''); setSelectedEmoji(null); setSelectedLocation(null); setSelectedPhotos([]); setSelectedLinks([]); setSelectedTags([]);
                  setReminderConfig({ enabled: false, intervalDays: 30 });
                  setInputStartTime(format(new Date(), 'HH:mm')); setInputEndTime(format(new Date(), 'HH:mm'));
                  if (textareaRef.current) textareaRef.current.style.height = 'auto';
                  if (result && result.id) startMomentTimer(result);
                } finally { setIsSubmitting(false); }
              }}
              variant="outline"
              disabled={!canSend || isSubmitting}
              size="icon"
              className="h-8 w-8 rounded-full flex-shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-soft-hover))]"
              title="Add & start timer"
            >
              <Timer size={15} />
            </Button>
            <Button
              onClick={handleSend}
              disabled={!canSend || isSubmitting}
              size="icon"
              className="h-8 w-8 rounded-full flex-shrink-0 bg-primary/12 text-primary hover:bg-primary/18"
            >
              <ArrowUp size={15} />
            </Button>
          </div>
        </div>
        </div>
      </div>}

      {/* Moments list */}
      {/* Unified iOS-style timeline: merge completed todos + moments */}
      <div ref={recapContentRef} className="recap-readable-ui px-4 sm:px-5 lg:px-6 flex-1 overflow-y-auto mt-1 pb-40">
        <div className="lg:grid lg:grid-cols-[minmax(260px,3fr)_minmax(0,7fr)] lg:gap-6 lg:items-start">
          <div className="mb-5 lg:mb-0 flex flex-col gap-3">
            <DailyHabitTracker
              habits={recapHabits}
              selectedDateStr={selectedDateStr}
              onIncrement={(habitId, dateStr) => { void incrementHabitCount(habitId, dateStr); }}
              onSetCount={(habitId, nextCount, dateStr) => { void setHabitCount(habitId, nextCount, dateStr); }}
              onUpdateHabit={(habitId, updates) => { void updateDue(habitId, updates); }}
              onAddHabit={(title) => { void addDue(title, undefined, 'Uncategorized', true); }}
            />
            <LifeReplay items={timelineItems} lang={lang} dateKey={format(selectedDate, 'yyyy-MM-dd')} />
            {onTodayModeChange && (
              <div className="flex items-center justify-between pt-3 border-t border-border/20 mt-2">
                <span className="text-[11px] text-muted-foreground/50">
                  {[todosDone != null && todosTotal != null && todosTotal > 0 && `${todosDone}/${todosTotal} done`, sortedMoments.length > 0 && `${sortedMoments.length} moments`].filter(Boolean).join(' · ')}
                </span>
                <button
                  onClick={() => onTodayModeChange('plan')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d7c8bc]/65 bg-[#fbf8f4] px-3.5 py-1.5 text-[12px] font-semibold text-[#8a7465] shadow-[0_6px_18px_rgba(110,92,76,0.07)] transition-all hover:border-[#c9ad9a] hover:bg-[#f6efe8] hover:text-[#725d50] dark:border-foreground/[0.14] dark:bg-foreground/[0.05] dark:text-foreground/80 dark:shadow-[0_6px_18px_rgba(0,0,0,0.4)] dark:hover:border-foreground/22 dark:hover:bg-foreground/[0.09] dark:hover:text-foreground"
                >
                  Plan my day ›
                </button>
              </div>
            )}
          </div>
          <div className="min-w-0" ref={recapRightColRef}>

        {/* Unified timeline */}
        {(() => {
          // Build Life Rhythm segments
          type RhythmSegment = { tag: string; color: string; icon: string; durationMin: number; startMin: number; endMin: number };
          const rhythmSegments: RhythmSegment[] = [];
          
          for (const item of timelineItems) {
            if ((item as any).isPlanOutline) continue; // Skip plan outlines from rhythm
            const title = item.type === 'todo' ? item.data.title : item.type === 'imported' ? item.data.title : (parseSubtitleDetail(item.data.text).subtitle || '');
            const tags = item.type === 'todo' ? item.data.tags : item.type === 'imported' ? undefined : item.data.tags;
            const tag = tags?.[0]?.toLowerCase() || autoClassifyTag(title) || 'life';
            const workTypeFallback = item.type === 'todo'
              ? WORK_TYPE_META[getWorkType({ entity: 'todo', id: item.data.id, title, tags })]?.color
              : item.type === 'moment'
                ? WORK_TYPE_META[getWorkType({ entity: 'moment', id: item.data.id, text: title, tags })]?.color
                : undefined;
            const fallback = workTypeFallback || (item.type === 'todo' ? 'hsl(var(--primary))' : item.type === 'imported' ? 'hsl(var(--accent))' : '#D5AE4C');
            const color = getActivityAccentColor({ title, tags, isDarkMode }) || fallback;
            const icon = getActivityTagIcon(title, tags) || '🍔';
            const startMin = item.time.getHours() * 60 + item.time.getMinutes();
            const endMin = item.endTime
              ? item.endTime.getHours() * 60 + item.endTime.getMinutes()
              : startMin + 5;
            const durationMin = Math.max(endMin - startMin, 5);

            // Merge with previous if same tag
            const prev = rhythmSegments[rhythmSegments.length - 1];
            if (prev && prev.tag === tag) {
              prev.durationMin += durationMin;
              prev.endMin = Math.max(prev.endMin, endMin);
            } else {
              rhythmSegments.push({ tag, color, icon, durationMin, startMin, endMin });
            }
          }

          const totalRhythmMin = rhythmSegments.reduce((s, r) => s + r.durationMin, 0);

          if (timelineItems.length === 0) {
            return (
              <div className="flex min-h-[42vh] items-center justify-center">
                <div className="w-full max-w-md rounded-[28px] border border-border bg-[hsl(var(--surface-soft))] px-8 py-10 text-center shadow-[0_8px_24px_hsl(var(--foreground)/0.04)]">
                  <p className="text-[17px] font-normal text-[hsl(var(--text-soft))]">
                    Recap my day
                  </p>
                  <p className="mt-3 text-[12px] leading-6 text-muted-foreground/70">
                    No moments or completed tasks yet. Add a small moment below and your recap will start to take shape.
                  </p>
                </div>
              </div>
            );
          }

              // Calculate evidence summary stats
              const totalActiveMin = (() => {
                const spans: { start: number; end: number }[] = [];
                for (const item of timelineItems) {
                  if ((item as any).isPlanOutline) continue;
                  if (!item.endTime) continue;
                  const start = item.time.getTime();
                  const end = item.endTime.getTime();
                  if (end > start) spans.push({ start, end });
                }
                return Math.round(mergedWallClockFocusMinutes(spans));
              })();
              const activeHours = Math.floor(totalActiveMin / 60);
              const activeMins = totalActiveMin % 60;
              const categoryCount = new Set(rhythmSegments.map(s => s.tag)).size;

              // ─── Build Today Landscape data: hourly density buckets ───
              const LANDSCAPE_START = WAKE_HOUR;
              const LANDSCAPE_END = BEDTIME_HOUR + (BEDTIME_MINUTE > 0 ? 1 : 0);
              const landscapeBuckets: { hour: number; density: number; color: string; tag: string; events: number; activeMin: number }[] = [];
              
              for (let h = LANDSCAPE_START; h < LANDSCAPE_END; h++) {
                const bucketStart = h * 60;
                const bucketEnd = (h + 1) * 60;
                let activeMin = 0;
                let events = 0;
                const tagMinutes = new Map<string, { min: number; color: string }>();
                
                for (const item of timelineItems) {
                  if ((item as any).isPlanOutline) continue;
                  const itemStartMin = item.time.getHours() * 60 + item.time.getMinutes();
                  const itemEndMin = item.endTime 
                    ? item.endTime.getHours() * 60 + item.endTime.getMinutes()
                    : itemStartMin + 5;
                  
                  const overlapStart = Math.max(itemStartMin, bucketStart);
                  const overlapEnd = Math.min(itemEndMin, bucketEnd);
                  if (overlapStart < overlapEnd) {
                    const overlapMin = overlapEnd - overlapStart;
                    activeMin += overlapMin;
                    events++;
                    const title = item.type === 'todo' ? item.data.title : item.type === 'imported' ? item.data.title : (parseSubtitleDetail(item.data.text).subtitle || '');
                    const tags = item.type === 'todo' ? item.data.tags : item.type === 'imported' ? undefined : item.data.tags;
                    const tag = tags?.[0]?.toLowerCase() || autoClassifyTag(title) || 'life';
                    const workTypeFallback = item.type === 'todo'
                      ? WORK_TYPE_META[getWorkType({ entity: 'todo', id: item.data.id, title, tags })]?.color
                      : item.type === 'moment'
                        ? WORK_TYPE_META[getWorkType({ entity: 'moment', id: item.data.id, text: title, tags })]?.color
                        : undefined;
                    const fallback = workTypeFallback || (item.type === 'todo' ? 'hsl(var(--primary))' : item.type === 'imported' ? 'hsl(var(--accent))' : '#D5AE4C');
                    const color = getActivityAccentColor({ title, tags, isDarkMode }) || fallback;
                    const existing = tagMinutes.get(tag);
                    if (existing) existing.min += overlapMin;
                    else tagMinutes.set(tag, { min: overlapMin, color });
                  }
                }
                
                let dominantTag = 'life';
                let dominantColor = 'hsl(var(--muted))';
                let maxTagMin = 0;
                for (const [tag, info] of tagMinutes) {
                  if (info.min > maxTagMin) { maxTagMin = info.min; dominantTag = tag; dominantColor = info.color; }
                }
                
                const density = Math.min(activeMin / 60, 1);
                landscapeBuckets.push({ hour: h, density, color: dominantColor, tag: dominantTag, events, activeMin: Math.min(activeMin, 60) });
              }

              const maxDensity = Math.max(...landscapeBuckets.map(b => b.density), 0.1);
              const realItemCount = timelineItems.filter(i => !(i as any).isPlanOutline).length;

              return (
            <>
               {/* ─── Today Summary (compact) ─── */}
               <div className="mb-2 pb-2 border-b border-border/30">
                 <div className="flex items-center gap-1.5 flex-wrap text-[13px]">
                   <span className="font-semibold text-foreground">{realItemCount}</span>
                   <span className="text-muted-foreground/60">{realItemCount === 1 ? t('recap.moment') : t('recap.moments')}</span>
                   {totalActiveMin > 0 && (
                     <>
                       <span className="text-muted-foreground/30">·</span>
                       <span className="font-semibold text-foreground">
                         {activeHours > 0 ? `${activeHours}h` : ''}{activeMins > 0 ? `${activeMins}m` : activeHours > 0 ? '' : '0m'}
                       </span>
                       <span className="text-muted-foreground/60">active</span>
                     </>
                   )}
                   {rhythmSegments.length > 0 && (() => {
                     const tagTotals = new Map<string, { min: number; color: string }>();
                     for (const seg of rhythmSegments) {
                       const existing = tagTotals.get(seg.tag);
                       if (existing) existing.min += seg.durationMin;
                       else tagTotals.set(seg.tag, { min: seg.durationMin, color: seg.color });
                     }
                     const sorted = [...tagTotals.entries()].sort((a, b) => b[1].min - a[1].min);
                     return sorted.map(([tag, info]) => {
                       const h = Math.floor(info.min / 60);
                       const m = info.min % 60;
                       return (
                         <span key={tag} className="flex items-center gap-0.5">
                           <span className="text-muted-foreground/30">·</span>
                           <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ backgroundColor: info.color }} />
                           <span className="text-muted-foreground/50 ml-0.5">{tag}</span>
                           <span className="font-mono tabular-nums text-muted-foreground/40 text-[11px]">
                             {h > 0 ? `${h}h` : ''}{m > 0 ? `${m}m` : h > 0 ? '' : '0m'}
                           </span>
                         </span>
                       );
                     });
                   })()}
                 </div>
                 {rhythmSegments.length > 0 && (() => {
                   const tagTotals = new Map<string, { min: number; color: string }>();
                   for (const seg of rhythmSegments) {
                     const existing = tagTotals.get(seg.tag);
                     if (existing) existing.min += seg.durationMin;
                     else tagTotals.set(seg.tag, { min: seg.durationMin, color: seg.color });
                   }
                   const sorted = [...tagTotals.entries()].sort((a, b) => b[1].min - a[1].min);
                   const totalMin = sorted.reduce((sum, [, info]) => sum + info.min, 0);
                   return (
                     <div className="flex h-[3px] rounded-full overflow-hidden bg-muted/30 mt-1.5">
                       {sorted.map(([tag, info]) => {
                         const pct = totalMin > 0 ? (info.min / totalMin) * 100 : 0;
                         const h = Math.floor(info.min / 60);
                         const m = info.min % 60;
                         const timeStr = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
                         return (
                           <div
                             key={tag}
                             className="relative h-full transition-opacity hover:opacity-80"
                             style={{ width: `${pct}%`, backgroundColor: info.color, minWidth: pct > 0 ? '3px' : 0 }}
                             title={`${tag} — ${timeStr}`}
                           />
                         );
                       })}
                     </div>
                   );
                 })()}
               </div>
                  {/* ─── Timeline ─── */}
                  <div className="mb-1.5">
                    <p className="text-[11px] uppercase tracking-[0.08em] mb-1 text-muted-foreground/35 font-normal">{t('recap.timeline')}</p>
                  </div>

            {/* Life Stream: flowing vertical line with dots, threads, phase labels */}
            {(() => {
              type TaggedItem = typeof timelineItems[0] & { tag: string; dotColor: string; tagIcon?: string; title: string };
              const tagged: TaggedItem[] = timelineItems.map(item => {
                const title = item.type === 'todo' ? item.data.title : item.type === 'imported' ? item.data.title : (parseSubtitleDetail(item.data.text).subtitle || '');
                const tags = item.type === 'todo' ? item.data.tags : item.type === 'imported' ? undefined : item.data.tags;
                const tag = tags?.[0]?.toLowerCase() || autoClassifyTag(title) || '';
                const workTypeFallback = item.type === 'todo'
                  ? WORK_TYPE_META[getWorkType({ entity: 'todo', id: item.data.id, title, tags })]?.color
                  : item.type === 'moment'
                    ? WORK_TYPE_META[getWorkType({ entity: 'moment', id: item.data.id, text: title, tags })]?.color
                    : undefined;
                const fallback = workTypeFallback || (item.type === 'todo' ? 'hsl(var(--primary))' : item.type === 'imported' ? 'hsl(var(--accent))' : '#D5AE4C');
                const dotColor = getActivityAccentColor({ title, tags, isDarkMode }) || fallback;
                const tagIcon = getActivityTagIcon(title, tags);
                return { ...item, tag, dotColor, tagIcon, title };
              });

              // Extract keywords from title
              const getKeywords = (title: string): Set<string> => {
                const words = title.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
                return new Set(words);
              };

              const hasKeywordOverlap = (a: string, b: string): boolean => {
                const kwA = getKeywords(a);
                const kwB = getKeywords(b);
                for (const w of kwA) {
                  if (kwB.has(w)) return true;
                  for (const w2 of kwB) {
                    if (w.includes(w2) || w2.includes(w)) return true;
                  }
                }
                return false;
              };

              const THREAD_MAX_GAP_MS = 4 * 60 * 60 * 1000;
              const CLUSTER_GAP_MS = 60 * 60 * 1000;
              type Thread = { tag: string; color: string; icon?: string; items: TaggedItem[]; startTime: Date; endTime: Date; threadName?: string };
              const threads: Thread[] = [];

              for (const item of tagged) {
                const itemEnd = item.endTime || new Date(item.time.getTime() + 5 * 60000);
                const prev = threads[threads.length - 1];
                if (prev && item.tag && prev.tag === item.tag) {
                  const gap = item.time.getTime() - prev.endTime.getTime();
                  const kwMatch = prev.items.some(pi => hasKeywordOverlap(pi.title, item.title));
                  if ((kwMatch && gap < THREAD_MAX_GAP_MS) || gap < CLUSTER_GAP_MS) {
                    prev.items.push(item);
                    prev.endTime = itemEnd > prev.endTime ? itemEnd : prev.endTime;
                    continue;
                  }
                }
                threads.push({ tag: item.tag, color: item.dotColor, icon: item.tagIcon, items: [item], startTime: item.time, endTime: itemEnd });
              }

              // Generate thread names
              for (const thread of threads) {
                if (thread.items.length < 2) continue;
                const wordCount = new Map<string, number>();
                thread.items.forEach(item => {
                  getKeywords(item.title).forEach(w => {
                    wordCount.set(w, (wordCount.get(w) || 0) + 1);
                  });
                });
                let bestWord = '';
                let bestCount = 1;
                for (const [word, count] of wordCount) {
                  if (count > bestCount) { bestWord = word; bestCount = count; }
                }
                if (bestWord && bestCount >= 2) {
                  thread.threadName = bestWord.charAt(0).toUpperCase() + bestWord.slice(1);
                }
              }

              // Determine activity phases based on time
              const getPhaseLabel = (hour: number): string => {
                if (hour < 12) return t('recap.morning');
                if (hour < 14) return lang === 'zh' ? '午间' : 'Midday';
                if (hour < 17) return t('recap.afternoon');
                if (hour < 20) return t('recap.evening');
                return t('recap.night');
              };
              const getPhaseIcon = (hour: number): string => {
                if (hour < 12) return '☀';
                if (hour < 17) return '🌤';
                return '🌙';
              };

              let lastPhase = '';

              return (
                <div className="px-2">
                  {threads.map((thread, gi) => {
                    const isThread = thread.tag && thread.items.length > 1;
                    const firstHour = thread.startTime.getHours();
                    const phase = getPhaseLabel(firstHour);
                    const phaseIcon = getPhaseIcon(firstHour);
                    const showPhase = phase !== lastPhase;
                    if (showPhase) lastPhase = phase;

                    const clusterDurMin = Math.round((thread.endTime.getTime() - thread.startTime.getTime()) / 60000);
                    const durLabel = clusterDurMin >= 60
                      ? `${Math.floor(clusterDurMin / 60)}h${clusterDurMin % 60 > 0 ? ` ${clusterDurMin % 60}m` : ''}`
                      : `${clusterDurMin}m`;

                    const prevThread = gi > 0 ? threads[gi - 1] : null;
                    const gapMinutes = prevThread ? Math.round((thread.startTime.getTime() - prevThread.endTime.getTime()) / 60000) : 0;
                    const midpointTime = prevThread && gapMinutes > 10
                      ? new Date(prevThread.endTime.getTime() + (thread.startTime.getTime() - prevThread.endTime.getTime()) / 2)
                      : null;
                    const midpointStr = midpointTime ? format(midpointTime, 'HH:mm') : null;
                    const gapH = Math.floor(gapMinutes / 60);
                    const gapM = gapMinutes % 60;
                    const gapLabel = gapMinutes >= 60
                      ? `${gapH}h${gapM > 0 ? ` ${gapM}m` : ''}`
                      : `${gapMinutes}m`;

                    return (
                      <div key={gi}>
                        {/* ── Inline insert between threads ── */}
                        {midpointStr && gapMinutes > 10 && (
                          inlineInsertTime === midpointStr ? (
                            <div className="flex items-stretch gap-0">
                              <div className="w-14 flex-shrink-0 pt-[3px] text-right pr-3">
                              <span className="font-mono tabular-nums text-primary/60" style={{ fontSize: '14px' }}>{midpointStr}</span>
                              </div>
                              <div className="w-5 flex-shrink-0 flex flex-col items-center">
                                <div className="w-[9px] h-[9px] rounded-full bg-primary/60 mt-[6px] z-10 ring-2 ring-background" />
                                <div className="flex-1 w-[1.5px] bg-border" />
                              </div>
                              <div className="flex-1 pl-2 pr-1 py-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    ref={inlineInsertRef}
                                    autoFocus
                                    value={inlineInsertText}
                                    onChange={e => setInlineInsertText(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && !(e.nativeEvent as any).isComposing && inlineInsertText.trim()) {
                                        handleInlineInsert(midpointStr);
                                      }
                                      if (e.key === 'Escape') { setInlineInsertTime(null); setInlineInsertText(''); }
                                    }}
                                    placeholder={lang === 'zh' ? '记录这里发生的事...' : 'What happened here...'}
                                    className="flex-1 min-w-0 bg-secondary/50 rounded-lg px-3 py-1.5 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/30"
                                  />
                                  <button
                                    onClick={() => { if (inlineInsertText.trim()) handleInlineInsert(midpointStr); }}
                                    disabled={!inlineInsertText.trim() || inlineInsertSubmitting}
                                    className="p-1.5 rounded-full bg-primary text-primary-foreground disabled:opacity-30 flex-shrink-0"
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    onClick={() => { setInlineInsertTime(null); setInlineInsertText(''); }}
                                    className="p-1 text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="group/insert flex items-stretch gap-0">
                              <div className="w-14 flex-shrink-0" />
                              <div className="w-5 flex-shrink-0 flex flex-col items-center">
                                <div className="flex-1 w-[1.5px] bg-border" />
                              </div>
                              <div className="flex-1 pl-2 pr-1">
                                <button
                                  onClick={() => { setInlineInsertTime(midpointStr); setInlineInsertText(''); }}
                                  className="w-full py-1 flex items-center gap-2 opacity-0 group-hover/insert:opacity-100 transition-opacity duration-200"
                                >
                                  <div className="flex-1 h-px bg-primary/15 group-hover/insert:bg-primary/25 transition-colors" />
                                  <span className="text-[10px] uppercase tracking-[0.08em] text-primary/35 group-hover/insert:text-primary/55 whitespace-nowrap transition-colors">
                                    + {lang === 'zh' ? '记录' : 'add'}
                                    {gapMinutes >= 45 && (
                                      <span className="text-muted-foreground/22 ml-1 normal-case tracking-normal">{gapLabel}</span>
                                    )}
                                  </span>
                                  <div className="flex-1 h-px bg-primary/15 group-hover/insert:bg-primary/25 transition-colors" />
                                </button>
                              </div>
                            </div>
                          )
                        )}

                        {/* Phase label — TimelineView section header style */}
                        {showPhase && (
                          <div className="flex items-center gap-2 px-3 pt-4 pb-2">
                            <span className="text-xs" style={{ opacity: 0.5 }}>{phaseIcon}</span>
                            <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground/50">
                              {phase}
                            </span>
                            <div className="flex-1 h-px bg-border/50" />
                          </div>
                        )}

                        {/* Thread header */}
                        {isThread && (
                          <div className="flex items-stretch gap-0">
                            <div className="w-14 flex-shrink-0 pt-[3px] text-right pr-3">
                              <span className="font-mono tabular-nums text-muted-foreground" style={{ fontSize: '14px' }}>
                                {format(thread.startTime, 'HH:mm')}
                              </span>
                            </div>
                            <div className="w-5 flex-shrink-0 flex flex-col items-center">
                              <div
                                className="w-[10px] h-[10px] rounded-full flex-shrink-0 mt-[6px] z-10 ring-2 ring-background border-2"
                                style={{ borderColor: thread.color, backgroundColor: 'hsl(var(--background))' }}
                              />
                              <div className="flex-1 w-[1.5px] bg-border" />
                            </div>
                            <div className="flex-1 pl-2 pr-1 py-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[12px] font-medium" style={{ color: thread.color }}>
                                  {thread.icon || ''} {thread.threadName || `${thread.tag} block`}
                                </span>
                                <span className="text-[11px] text-muted-foreground/40 font-mono tabular-nums">
                                  {format(thread.startTime, 'HH:mm')}–{format(thread.endTime, 'HH:mm')} · {durLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Items */}
                        {thread.items.map((item, ii) => {
                          const timeStr = format(item.time, 'HH:mm');
                          const isPlanOutline = !!(item as any).isPlanOutline;
                          const isLastItem = gi === threads.length - 1 && ii === thread.items.length - 1;

                          if (item.type === 'todo') {
                            const todo = item.data;
                            const hasTime = todo.timer_started_at && todo.timer_ended_at;
                            const durationMin = todo.timer_seconds ? Math.floor(todo.timer_seconds / 60) : 0;
                            const hasProgress = todo.progress > 0 && todo.progress < 100;
                            const isSavedSession = !todo.is_completed && !isPlanOutline;
                            const todoDurLabel = durationMin >= 60
                              ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}m` : ''}`
                              : `${durationMin}m`;
                            return (
                              <StreamNode
                                key={`todo-${todo.id}${isPlanOutline ? '-plan' : ''}`}
                                timeStr={timeStr}
                                color={item.dotColor}
                                isPlanOutline={isPlanOutline}
                                isLast={isLastItem}
                              >
                                <div className="group/card relative">
                                  <div className={cn("flex items-center gap-2 min-w-0", isPlanOutline && "opacity-50")}>
                                    {item.tagIcon && <span className="text-[14px] flex-shrink-0">{item.tagIcon}</span>}
                                    {editingTodoId === todo.id && !isPlanOutline ? (
                                      <input
                                        autoFocus
                                        value={editingTodoTitle}
                                        onChange={e => setEditingTodoTitle(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter' && !(e.nativeEvent as any).isComposing && editingTodoTitle.trim()) {
                                            onUpdateTodo?.(todo.id, { title: editingTodoTitle.trim() });
                                            setEditingTodoId(null);
                                          }
                                          if (e.key === 'Escape') setEditingTodoId(null);
                                        }}
                                        onBlur={() => {
                                          if (editingTodoTitle.trim() && editingTodoTitle.trim() !== todo.title) {
                                            onUpdateTodo?.(todo.id, { title: editingTodoTitle.trim() });
                                          }
                                          setEditingTodoId(null);
                                        }}
                                        className="flex-1 min-w-0 bg-transparent font-medium focus:outline-none border-b border-primary/30"
                                        style={{ fontSize: '16px' }}
                                      />
                                    ) : (
                                      <span
                                        className={cn(
                                          "truncate cursor-pointer transition-colors",
                                          isPlanOutline ? "text-muted-foreground" : "text-foreground hover:text-primary/80",
                                          !isPlanOutline && todo.is_completed && "text-foreground/80"
                                        )}
                                        style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.2 }}
                                        onClick={() => { if (!isPlanOutline) { setEditingTodoId(todo.id); setEditingTodoTitle(todo.title); } }}
                                      >{todo.title}</span>
                                    )}
                                    {isPlanOutline && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-destructive/60 bg-destructive/8 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-auto">
                                        <X size={8} strokeWidth={2.5} /> {t('recap.missed')}
                                      </span>
                                    )}
                                    {!isPlanOutline && todo.is_completed && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-auto">
                                        <Check size={8} strokeWidth={2.5} />
                                      </span>
                                    )}
                                    {isSavedSession && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-auto">
                                        <Timer size={8} strokeWidth={2.2} /> saved
                                      </span>
                                    )}
                                  </div>
                                  {hasProgress && (
                                    <div className="mt-1.5 flex items-center gap-1.5">
                                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                        <div className="h-full rounded-full bg-primary/50" style={{ width: `${todo.progress}%` }} />
                                      </div>
                                      <span className="text-[11px] text-muted-foreground/60">{todo.progress}%</span>
                                    </div>
                                  )}
                                  {/* Meta row */}
                                  <div className="flex items-center gap-x-3 gap-y-1 mt-1 flex-wrap">
                                    {!isPlanOutline && hasTime && durationMin > 0 && (
                                      <span className="font-mono tabular-nums text-muted-foreground/75" style={{ fontSize: '14px' }}>
                                        ⏱ {todoDurLabel}
                                      </span>
                                    )}
                                    {hasTime && durationMin > 0 && (
                                      <span className="font-mono tabular-nums text-muted-foreground/45" style={{ fontSize: '14px' }}>
                                        {format(parseISO(todo.timer_started_at!), 'HH:mm')} → {format(parseISO(todo.timer_ended_at!), 'HH:mm')}
                                      </span>
                                    )}
                                    {!isPlanOutline && (
                                      <button
                                        className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors"
                                        onClick={() => toggleStreamExpand(todo.id)}
                                      >
                                        {expandedStreamIds.has(todo.id) ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                        <span>{todo.note ? 'notes' : 'notes'}</span>
                                        {todo.note && <span className="w-1 h-1 rounded-full bg-primary/50 ml-0.5" />}
                                      </button>
                                    )}
                                  </div>
                                  {/* Expanded note panel */}
                                  {expandedStreamIds.has(todo.id) && !isPlanOutline && (
                                    <NoteCard
                                      content={todo.note}
                                      onSave={(v) => onUpdateTodo?.(todo.id, { note: v || null })}
                                      onCollapse={() => toggleStreamExpand(todo.id)}
                                    />
                                  )}
                                </div>
                              </StreamNode>
                            );
                          }

                          if (item.type === 'imported') {
                            const event = item.data;
                            const timerStart = event.timer_started_at ? parseISO(event.timer_started_at) : null;
                            const timerEnd = event.timer_ended_at ? parseISO(event.timer_ended_at) : null;
                            const hasTimer = !!(timerStart && timerEnd);
                            const durationSec = event.timer_seconds || (hasTimer ? Math.max(0, Math.floor((timerEnd!.getTime() - timerStart!.getTime()) / 1000)) : 0);
                            const durationMin = Math.floor(durationSec / 60);
                            const durationLabel = durationMin >= 60
                              ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}m` : ''}`
                              : `${durationMin}m`;

                            return (
                              <StreamNode
                                key={`imported-${event.id}`}
                                timeStr={timeStr}
                                color={item.dotColor}
                                isLast={isLastItem}
                              >
                                <div className="group/card relative">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[14px] flex-shrink-0">📅</span>
                                    {editingImportedEventId === event.id ? (
                                      <input
                                        autoFocus
                                        value={editingImportedEventTitle}
                                        onChange={e => setEditingImportedEventTitle(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter' && !(e.nativeEvent as any).isComposing && editingImportedEventTitle.trim()) {
                                            onUpdateImportedEvent?.(event.id, { title: editingImportedEventTitle.trim() });
                                            setEditingImportedEventId(null);
                                          }
                                          if (e.key === 'Escape') setEditingImportedEventId(null);
                                        }}
                                        onBlur={() => {
                                          if (editingImportedEventTitle.trim() && editingImportedEventTitle.trim() !== event.title) {
                                            onUpdateImportedEvent?.(event.id, { title: editingImportedEventTitle.trim() });
                                          }
                                          setEditingImportedEventId(null);
                                        }}
                                        className="flex-1 min-w-0 bg-transparent font-medium focus:outline-none border-b border-primary/30"
                                        style={{ fontSize: '16px' }}
                                      />
                                    ) : (
                                      <span
                                        className="truncate cursor-pointer text-foreground hover:text-primary/80 transition-colors"
                                        style={{ fontSize: '16px', fontWeight: 600, lineHeight: 1.2 }}
                                        onClick={() => {
                                          setEditingImportedEventId(event.id);
                                          setEditingImportedEventTitle(event.title);
                                        }}
                                      >
                                        {event.title}
                                      </span>
                                    )}
                                    {event.source_file === 'manual' && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground/60 bg-muted/40 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-auto">
                                        calendar
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-x-3 gap-y-1 mt-1 flex-wrap">
                                    {hasTimer && durationMin > 0 && (
                                      <span className="font-mono tabular-nums text-muted-foreground/75" style={{ fontSize: '14px' }}>
                                        ⏱ {durationLabel}
                                      </span>
                                    )}
                                    <ImportedEventTimeEditor event={event} onUpdate={onUpdateImportedEvent} />
                                    {event.location && (
                                      <span className="flex items-center gap-1 text-muted-foreground/75 truncate" style={{ fontSize: '14px' }} title={event.location}>
                                        <MapPin size={14} className="flex-shrink-0" />
                                        <span className="truncate max-w-[180px]">{event.location}</span>
                                      </span>
                                    )}
                                    <button
                                      className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-muted-foreground/45 hover:bg-primary/10 hover:text-primary transition-colors"
                                      onClick={() => startImportedEventTimer(event)}
                                    >
                                      <Timer size={10} />
                                      <span>{event.timer_started_at && !event.timer_ended_at ? 'timing' : 'start'}</span>
                                    </button>
                                  </div>
                                </div>
                              </StreamNode>
                            );
                          }

                          // Moment
                          const moment = item.data;
                          const { subtitle, detail } = parseSubtitleDetail(moment.text);
                          const hasTimer = moment.timer_started_at && moment.timer_ended_at;
                          const durationSec = moment.timer_seconds || 0;
                          const durationMin = Math.floor(durationSec / 60);
                          const momentDurLabel = durationMin >= 60
                            ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? `${durationMin % 60}m` : ''}`
                            : `${durationMin}m`;

                          return (
                            <StreamNode
                              key={`moment-${moment.id}`}
                              timeStr={timeStr}
                              color={item.dotColor}
                              isLast={isLastItem}
                            >
                              {editingMoment === moment.id ? (
                                /* ── Inline edit mode ── */
                                <div ref={editRef} data-edit-popover="true" className="space-y-2">
                                  <textarea
                                    autoFocus
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    onPaste={(e) => {
                                      const items = e.clipboardData?.items;
                                      if (!items) return;
                                      for (const item of Array.from(items)) {
                                        if (item.type.startsWith('image/')) {
                                          e.preventDefault();
                                          const file = item.getAsFile();
                                          if (!file) continue;
                                          const reader = new FileReader();
                                          reader.onload = (ev) => {
                                            const dataUrl = ev.target?.result as string;
                                            if (dataUrl) setEditPhotos(prev => uniquePhotoList([...prev, dataUrl]));
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }
                                    }}
                                    placeholder={lang === 'zh' ? '标题' : 'Title'}
                                    className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                                    rows={1}
                                  />
                                  {editDetailText !== null && (
                                    <textarea
                                      value={editDetailText}
                                      onChange={e => setEditDetailText(e.target.value)}
                                      placeholder={lang === 'zh' ? '详情' : 'Details'}
                                      className="w-full bg-secondary/30 rounded-lg px-3 py-2 text-[13px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none border-l-2 border-primary/20"
                                      rows={3}
                                    />
                                  )}
                                  {editDetailText === null && (
                                    <button
                                      onClick={() => setEditDetailText('')}
                                      className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                                    >
                                      + {lang === 'zh' ? '添加详情' : 'Add details'}
                                    </button>
                                  )}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <MomentTimeEditor moment={moment} onEditMoment={onEditMoment} />
                                    <Popover open={editLocationOpen} onOpenChange={setEditLocationOpen}>
                                      <PopoverTrigger asChild>
                                        <button
                                          className={cn(
                                            "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] transition-colors",
                                            editLocation
                                              ? "bg-[hsl(var(--surface-inset))] text-foreground"
                                              : "bg-secondary/40 text-muted-foreground hover:text-foreground"
                                          )}
                                          title="Add location"
                                        >
                                          <MapPin size={13} />
                                          <span className="max-w-[140px] truncate">
                                            {editLocation ? editLocation.name : (lang === 'zh' ? '添加地点' : 'Add location')}
                                          </span>
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-72 p-3 bg-popover z-50" align="start" side="bottom">
                                        <LocationPopover
                                          onSelect={(loc) => { setEditLocation(loc); setEditLocationOpen(false); }}
                                          onClose={() => setEditLocationOpen(false)}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  {editPhotos.length > 0 && (
                                    <div className="flex gap-1.5 overflow-x-auto">
                                      {editPhotos.map((photo, pi) => (
                                        <div key={pi} className="relative flex-shrink-0">
                                          <img src={photo} alt="" className="w-10 h-10 object-cover rounded-lg" />
                                          <button onClick={() => removeEditPhoto(pi)} className="absolute -top-1 -right-1 w-4 h-4 bg-foreground text-background rounded-full flex items-center justify-center"><X size={10} /></button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-1">
                                    {editTags.map((tag, ti) => (
                                      <span key={ti} className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary flex items-center gap-1">
                                        {tag}
                                        <button onClick={() => setEditTags(prev => prev.filter((_, i) => i !== ti))}><X size={8} /></button>
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => editFileInputRef.current?.click()} className="p-1 text-muted-foreground hover:text-foreground"><Image size={13} /></button>
                                    <input ref={editFileInputRef} type="file" accept="image/*" multiple onChange={handleEditFileChange} className="hidden" />
                                    <div className="flex-1" />
                                    {onDeleteMoment && (
                                      <button onClick={() => { onDeleteMoment(moment.id); setEditingMoment(null); }} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                                    )}
                                    <button onClick={() => setEditingMoment(null)} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                                    <button onClick={saveEdit} className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:opacity-90">Save</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="group/card relative flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    {/* Title row */}
                                    <div className="flex items-center gap-2 min-w-0">
                                      {!item.tagIcon && moment.emoji && <span className="text-[15px] flex-shrink-0">{moment.emoji}</span>}
                                      {item.tagIcon && <span className="text-[14px] flex-shrink-0">{item.tagIcon}</span>}
                                      <span
                                        className="truncate cursor-pointer text-foreground hover:text-primary/80 transition-colors"
                                        style={{ fontSize: '17px', fontWeight: 600, lineHeight: 1.2 }}
                                        onClick={() => startEdit(moment)}
                                      >
                                        {subtitle || moment.emoji || 'Moment'}
                                      </span>
                                      {/* Hover action icons */}
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity flex-shrink-0 ml-auto">
                                        <button onClick={() => startMomentTimer(moment)} className="p-1 text-muted-foreground/30 hover:text-primary transition-colors"><Timer size={12} /></button>
                                        <button onClick={() => startEdit(moment)} className="p-1 text-muted-foreground/30 hover:text-foreground transition-colors"><Pencil size={12} /></button>
                                        {onDeleteMoment && (
                                          <button onClick={() => onDeleteMoment(moment.id)} className="p-1 text-muted-foreground/30 hover:text-destructive transition-colors"><Trash2 size={12} /></button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Meta row */}
                                    <div className="flex items-center gap-x-3 gap-y-1 mt-1 flex-wrap">
                                      {hasTimer && durationMin > 0 && (
                                        <span className="font-mono tabular-nums text-muted-foreground/75" style={{ fontSize: '14px' }}>
                                          ⏱ {momentDurLabel}
                                        </span>
                                      )}
                                      {moment.location && (
                                        <span className="flex items-center gap-1 text-muted-foreground/75 truncate" style={{ fontSize: '14px' }} title={moment.location.name}>
                                          <MapPin size={14} className="flex-shrink-0" />
                                          <span className="truncate max-w-[180px]">{moment.location.name}</span>
                                        </span>
                                      )}
                                      {hasTimer && durationMin > 0 && (
                                        <span className="font-mono tabular-nums text-muted-foreground/45" style={{ fontSize: '14px' }}>
                                          {format(parseISO(moment.timer_started_at!), 'HH:mm')} → {format(parseISO(moment.timer_ended_at!), 'HH:mm')}
                                        </span>
                                      )}
                                      <button
                                        className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors"
                                        onClick={() => toggleStreamExpand(moment.id)}
                                      >
                                        {expandedStreamIds.has(moment.id) ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                        <span>notes</span>
                                        {detail && <span className="w-1 h-1 rounded-full bg-primary/50 ml-0.5" />}
                                      </button>
                                    </div>

                                    {/* Expandable notes/detail */}
                                    {expandedStreamIds.has(moment.id) && (
                                      <StreamDetail
                                        detail={detail}
                                        onCollapse={() => toggleStreamExpand(moment.id)}
                                        onSaveDetail={(newDetail) => {
                                          if (onEditMoment) {
                                            const { subtitle: currentSubtitle } = parseSubtitleDetail(moment.text);
                                            const trimmedDetail = newDetail.trim();
                                            const finalText = trimmedDetail ? currentSubtitle + DETAIL_SEPARATOR + trimmedDetail : currentSubtitle;
                                            onEditMoment(moment.id, { text: finalText || undefined });
                                          }
                                        }}
                                      />
                                    )}

                                    {moment.links && moment.links.length > 0 && (
                                      <div className="mt-3 space-y-2">
                                        {moment.links.map((link, linkIndex) => (
                                          <LinkPreviewCard
                                            key={`${link.url}-${linkIndex}`}
                                            preview={link}
                                            compact
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Right: photos (up to 4) */}
                                  {moment.photos.length > 0 && (
                                    <div className="flex-shrink-0 flex items-center gap-1.5">
                                      {moment.photos.slice(0, 4).map((photo, i) => {
                                        const singlePhoto = moment.photos.length === 1;
                                        const manyPhotos = moment.photos.length >= 3;
                                        return (
                                          <img
                                            key={i}
                                            src={photo}
                                            alt=""
                                            className={cn(
                                              "object-cover cursor-pointer border border-border/40 shadow-[0_10px_24px_hsl(var(--foreground)/0.06)]",
                                              singlePhoto
                                                ? "w-[96px] h-[124px] sm:w-[112px] sm:h-[144px] rounded-xl"
                                                : manyPhotos
                                                  ? "w-[60px] h-[76px] sm:w-[68px] sm:h-[88px] rounded-lg"
                                                  : "w-[72px] h-[92px] sm:w-[84px] sm:h-[108px] rounded-lg"
                                            )}
                                            onClick={() => setLightboxPhotos({ photos: moment.photos, index: i })}
                                          />
                                        );
                                      })}
                                      {moment.photos.length > 4 && (
                                        <button
                                          className="text-[12px] text-muted-foreground/60 pl-0.5"
                                          onClick={() => setLightboxPhotos({ photos: moment.photos, index: 0 })}
                                        >
                                          +{moment.photos.length - 4}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </StreamNode>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* ── Add at end of timeline ── */}
                  {(() => {
                    const nowTime = format(new Date(), 'HH:mm');
                    const endInsertKey = `end-${nowTime}`;
                    return (
                      inlineInsertTime === endInsertKey ? (
                        <div className="flex items-stretch gap-0">
                          <div className="w-14 flex-shrink-0 pt-[3px] text-right pr-3">
                            <span className="font-mono tabular-nums text-primary/60" style={{ fontSize: '12px' }}>{nowTime}</span>
                          </div>
                          <div className="w-5 flex-shrink-0 flex flex-col items-center">
                            <div className="w-[9px] h-[9px] rounded-full bg-primary/60 mt-[6px] z-10 ring-2 ring-background" />
                          </div>
                          <div className="flex-1 pl-2 pr-1 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                value={inlineInsertText}
                                onChange={e => setInlineInsertText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !(e.nativeEvent as any).isComposing && inlineInsertText.trim()) {
                                    handleInlineInsert(nowTime);
                                  }
                                  if (e.key === 'Escape') { setInlineInsertTime(null); setInlineInsertText(''); }
                                }}
                                placeholder={lang === 'zh' ? '记录这里发生的事...' : 'What happened here...'}
                                className="flex-1 min-w-0 bg-secondary/50 rounded-lg px-3 py-1.5 text-[14px] focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/30"
                              />
                              <button
                                onClick={() => { if (inlineInsertText.trim()) handleInlineInsert(nowTime); }}
                                disabled={!inlineInsertText.trim() || inlineInsertSubmitting}
                                className="p-1.5 rounded-full bg-primary text-primary-foreground disabled:opacity-30 flex-shrink-0"
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                onClick={() => { setInlineInsertTime(null); setInlineInsertText(''); }}
                                className="p-1 text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="group/insert flex items-stretch gap-0">
                          <div className="w-14 flex-shrink-0" />
                          <div className="w-5 flex-shrink-0 flex flex-col items-center">
                            <div className="flex-1 w-[1.5px] bg-border" />
                          </div>
                          <div className="flex-1 pl-2 pr-1">
                            <button
                              onClick={() => { setInlineInsertTime(endInsertKey); setInlineInsertText(''); }}
                              className="w-full py-1 flex items-center gap-2 opacity-0 group-hover/insert:opacity-100 transition-opacity duration-200"
                            >
                              <div className="flex-1 h-px bg-primary/15 group-hover/insert:bg-primary/25 transition-colors" />
                              <span className="text-[11px] text-primary/40 group-hover/insert:text-primary/60 whitespace-nowrap transition-colors">
                                + {lang === 'zh' ? '记录' : 'add'}
                              </span>
                              <div className="flex-1 h-px bg-primary/15 group-hover/insert:bg-primary/25 transition-colors" />
                            </button>
                          </div>
                        </div>
                      )
                    );
                  })()}

                  {/* End cap */}
                  <div className="flex items-stretch gap-0">
                    <div className="w-14 flex-shrink-0" />
                    <div className="w-5 flex-shrink-0 flex justify-center">
                      <div className="w-[7px] h-[7px] rounded-full bg-border/60" />
                    </div>
                  </div>
                </div>
              );
            })()}

            </>
          );
        })()}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

/* ── Life Stream helper components ── */
function StreamNode({ timeStr, color, isPlanOutline, isLast, children }: {
  timeStr?: string; color: string; isPlanOutline?: boolean; isLast?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="group flex items-stretch gap-0">
      {/* Time column */}
      <div className="w-14 flex-shrink-0 pt-[3px] text-right pr-3">
        {timeStr && (
          <span className="font-mono tabular-nums text-muted-foreground" style={{ fontSize: '14px' }}>
            {timeStr}
          </span>
        )}
      </div>
      {/* Dot + line column */}
      <div className="w-5 flex-shrink-0 flex flex-col items-center relative">
        <div
          className="w-[10px] h-[10px] rounded-full flex-shrink-0 mt-[6px] z-10 ring-2 ring-background"
          style={{
            backgroundColor: isPlanOutline ? 'transparent' : color,
            border: isPlanOutline ? `2px dashed ${color}` : 'none',
          }}
        />
        {!isLast && <div className="flex-1 w-[1.5px] bg-border" />}
      </div>
      {/* Content column */}
      <div className="flex-1 min-w-0 pb-2 pl-2 pr-1">
        {(() => {
          const outlineStyle: React.CSSProperties | undefined = isPlanOutline
            ? { borderStyle: 'dashed', borderWidth: '1.8px', borderColor: color }
            : undefined;
          return (
            <div
              className={cn(
                "rounded-xl transition-colors px-3 py-1.5 -ml-1",
                isPlanOutline ? "" : "hover:bg-muted/35"
              )}
              style={outlineStyle}
            >
              {children}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ── simple markdown → safe HTML ── */
function renderMarkdown(text: string): string {
  // Escape HTML first to prevent XSS
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let html = esc(text);

  // Headings
  html = html.replace(/^### (.+)$/gm, '<strong style="font-size:13px">$1</strong>');
  html = html.replace(/^## (.+)$/gm, '<strong style="font-size:14px">$1</strong>');
  html = html.replace(/^# (.+)$/gm, '<strong style="font-size:15px">$1</strong>');

  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="font-family:monospace;font-size:11px;background:rgba(0,0,0,0.06);padding:1px 4px;border-radius:3px">$1</code>');

  // Markdown links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:hsl(var(--primary));text-decoration:underline;text-decoration-color:hsl(var(--primary)/0.4)">$1</a>');

  // Raw URLs
  html = html.replace(/(^|[\s(])((https?:\/\/)[^\s<)"]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer" style="color:hsl(var(--primary));text-decoration:underline;text-decoration-color:hsl(var(--primary)/0.4)">$2</a>');

  // Bullet lists
  html = html.replace(/^[-*] (.+)$/gm, '<span style="display:block;padding-left:12px">· $1</span>');

  // Line breaks
  html = html.replace(/\n\n/g, '<br/><br/>');
  html = html.replace(/\n/g, '<br/>');

  return html;
}

function NoteCard({ content, onSave, onCollapse }: {
  content?: string | null;
  onSave?: (v: string) => void;
  onCollapse?: () => void;
}) {
  // Auto-enter edit mode when there's no content yet
  const [editing, setEditing] = useState(!content);
  const [value, setValue] = useState(content ?? '');

  useEffect(() => {
    setValue(content ?? '');
    if (!content) setEditing(true);
  }, [content]);

  const handleSave = () => {
    if (onSave) onSave(value);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setValue(content ?? '');
    if (!content && onCollapse) onCollapse();
  };

  if (editing) {
    return (
      <div className="mt-2 rounded-xl bg-[hsl(var(--surface-soft))] overflow-hidden">
        <textarea
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Type notes... supports **bold**, *italic*, [link](url)"
          className="w-full bg-transparent px-3 pt-2.5 pb-1 text-[12px] text-foreground/75 focus:outline-none resize-none leading-relaxed placeholder:text-muted-foreground/35"
          rows={4}
        />
        <div className="flex items-center justify-end gap-3 px-3 pb-2.5">
          <button onClick={handleCancel} className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">Cancel</button>
          <button onClick={handleSave} className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">Save</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group/note mt-2 relative rounded-xl bg-[hsl(var(--surface-soft))] px-3 py-2.5 cursor-pointer"
      onClick={() => { setValue(content ?? ''); setEditing(true); }}
    >
      <div
        className="text-[12px] text-foreground/55 leading-relaxed max-h-[180px] overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content ?? '') }}
      />
      <div className="absolute top-2 right-2 opacity-0 group-hover/note:opacity-100 transition-opacity">
        <Pencil size={10} className="text-muted-foreground/40" />
      </div>
    </div>
  );
}

function StreamDetail({ detail, onSaveDetail, onCollapse }: { detail?: string | null; onSaveDetail?: (newDetail: string) => void; onCollapse?: () => void }) {
  return <NoteCard content={detail} onSave={onSaveDetail} onCollapse={onCollapse} />;
}

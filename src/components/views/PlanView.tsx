import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { Plus, Trash2, Timer, Circle, CheckCircle2, ChevronDown, ChevronRight, Square, Pause, Play, Check, X, Loader2, Mic, ArrowUp, Bell, Repeat, ListTodo, CalendarDays, NotebookPen, Camera, MapPin, List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, isImeComposing } from '@/lib/utils';
import { extractLeadingEmoji } from '@/lib/emoji';
import { useTodos, Todo } from '@/hooks/useTodos';
import { useImportedEvents } from '@/hooks/useImportedEvents';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { showUndoToast } from '@/lib/undoToast';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';


import { useCustomOptions } from '@/hooks/useCustomOptions';
import { useReminders } from '@/hooks/useReminders';
import { PlanTimelineView } from '@/components/views/PlanTimelineView';
import { autoClassifyTag, TAG_CATEGORY_COLORS } from '@/lib/autoTag';
import { PlanDrift } from '@/components/today/PlanDrift';
import { FocusTimerOverlay, FloatingTimer } from '@/components/FocusTimerOverlay';
import { Moment } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { LocationPopover } from '@/components/LocationPopover';
import { useWorkTypes } from '@/hooks/useWorkTypes';
import { WorkType, WORK_TYPE_META, resolveWorkType, getWorkTypeKey } from '@/lib/workType';
import { tidyTaskTitle } from '@/lib/tidyTaskTitle';
import { useIsDarkMode } from '@/hooks/useIsDarkMode';
import {
  getPlanTimelineRhythmPreset,
  loadPlanTimelineRhythmPresetId,
  presetToRhythmPalette,
} from '@/lib/planTimelineRhythmPresets';

function isActivelyRunningTodo(todo: Pick<Todo, 'timer_started_at' | 'timer_ended_at'>) {
  if (!todo.timer_started_at || todo.timer_ended_at) return false;
  const startedAt = new Date(todo.timer_started_at).getTime();
  return Number.isFinite(startedAt) && startedAt <= Date.now();
}



const PLAN_LIST_MODE_KEY = 'plan-list-default';

function readPlanListMode(): 'grouped' | 'flat' {
  if (typeof window === 'undefined') return 'flat';
  return localStorage.getItem(PLAN_LIST_MODE_KEY) === 'grouped' ? 'grouped' : 'flat';
}

/** Above this movement (px, L1) we treat as dock drag and call setPointerCapture — below, leave click to FloatingTimer */
const TIMER_DOCK_DRAG_COMMIT_PX = 10;

const TIME_SEGMENTS = [
  { id: 'anytime' as const, label: 'Anytime', emoji: '🗂️' },
  { id: 'morning' as const, label: 'Morning', emoji: '☀' },
  { id: 'afternoon' as const, label: 'Afternoon', emoji: '🌤' },
  { id: 'evening' as const, label: 'Evening', emoji: '🌙' },
];

const TASK_EMOJIS = ['📚', '💻', '🏋️', '✍️', '🎯', '📝', '🔬', '🎨', '🏃', '🧹', '📞', '🛒'];
const CAPTURE_NOTE_TAG = 'capture-note';
const CAPTURE_TYPES = ['win', 'blocker', 'thought', 'gratitude', 'idea', 'progress'] as const;
const CAPTURE_MOODS = ['good', 'neutral', 'tired', 'stressed', 'excited'] as const;
const CAPTURE_MOOD_EMOJIS: Record<(typeof CAPTURE_MOODS)[number], string> = {
  good: '🙂',
  neutral: '😌',
  tired: '😮‍💨',
  stressed: '😵‍💫',
  excited: '🤩',
};

const WORK_TYPE_ORDER: WorkType[] = ['deep', 'shallow', 'admin', 'errand', 'recovery'];
function getTaskTagPillStyle(tag?: string | null) {
  if (!tag) return { bg: '#F3F3F3', color: '#707070' };
  const color = TAG_CATEGORY_COLORS[tag.toLowerCase()] || '#707070';
  // bg is the same base hex — callers apply their own alpha via hexWithAlpha
  return { bg: color, color };
}

function hexWithAlpha(hex: string, alphaHex: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? `${hex}${alphaHex}` : hex;
}

function autoDetectCaptureType(text: string): (typeof CAPTURE_TYPES)[number] | null {
  const lower = text.toLowerCase();
  if (/\b(win|won|finished|completed|accomplished|nailed|shipped)\b/.test(lower)) return 'win';
  if (/\b(block|blocked|stuck|issue|problem|can't|cannot|error|fail)\b/.test(lower)) return 'blocker';
  if (/\b(grateful|thankful|appreciate|blessed)\b/.test(lower)) return 'gratitude';
  if (/\b(idea|what if|how about)\b/.test(lower)) return 'idea';
  if (/\b(progress|worked|built|implemented|fixed|pushed)\b/.test(lower)) return 'progress';
  return 'thought';
}

function getTimeSegmentForHour(hour: number): Todo['time_segment'] {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function getAutoDoneDurationMinutes(todo: Todo): number {
  const normalizedTags = (todo.tags || []).map(tag => tag.toLowerCase());
  const inferredTag = autoClassifyTag(todo.title);
  const workType = resolveWorkType({
    entity: 'todo',
    id: todo.id,
    title: todo.title,
    tags: todo.tags,
  });
  const title = todo.title.toLowerCase();
  const isTinyTask =
    normalizedTags.some(tag => ['tiny', 'quick', 'small'].includes(tag)) ||
    /\b(quick|small|tiny|minor|reply|email|message|text|call|check|submit|upload|print|scan)\b/.test(title) ||
    /小任务|快速|回复|邮件|消息|检查|提交|上传|打印|电话/.test(title);

  if (isTinyTask) return 5;
  if (normalizedTags.some(tag => ['admin', 'shallow'].includes(tag))) return 10;
  if (normalizedTags.some(tag => ['errand', 'shopping', 'travel'].includes(tag))) return 15;
  if (normalizedTags.some(tag => ['health', 'recovery'].includes(tag))) return 20;
  if (normalizedTags.some(tag => ['deep', 'study'].includes(tag))) return 60;
  if (inferredTag === 'shopping' || inferredTag === 'travel') return 15;
  if (inferredTag === 'health') return 20;
  if (inferredTag === 'study') return workType === 'deep' ? 60 : 30;
  if (inferredTag === 'work') return workType === 'deep' ? 60 : 20;

  switch (workType) {
    case 'deep':
      return 60;
    case 'errand':
      return 15;
    case 'recovery':
      return 20;
    case 'shallow':
    case 'admin':
    default:
      return 10;
  }
}

function getAutoDoneTimerUpdates(todo: Todo): Partial<Todo> {
  const durationMinutes = getAutoDoneDurationMinutes(todo);
  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - durationMinutes * 60_000);

  return {
    timer_started_at: startedAt.toISOString(),
    timer_ended_at: endedAt.toISOString(),
    timer_seconds: durationMinutes * 60,
  };
}

/* ── Rotating second tick SVG ── */
function SecondTick({ elapsed, size = 56 }: { elapsed: number; size?: number }) {
  const secs = elapsed % 60;
  const angle = (secs / 60) * 360 - 90;
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const tickLen = 6;
  const rad = (angle * Math.PI) / 180;
  const x1 = cx + (r - tickLen) * Math.cos(rad);
  const y1 = cy + (r - tickLen) * Math.sin(rad);
  const x2 = cx + r * Math.cos(rad);
  const y2 = cy + r * Math.sin(rad);

  return (
    <svg width={size} height={size} className="absolute inset-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={1} className="text-border/30" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="text-primary" />
    </svg>
  );
}

/* ── Immersive Focusing Overlay ── */
function FocusingOverlay({ taskTitle, elapsed, isPaused, onTogglePause, onStop, onCancel, onMinimize }: {
  taskTitle: string; elapsed: number; isPaused: boolean;
  onTogglePause: () => void; onStop: () => void; onCancel: () => void; onMinimize: () => void;
}) {
  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-10 animate-fade-in cursor-pointer" onClick={onMinimize}>
      <p className="text-xs text-muted-foreground/60 tracking-[0.3em] uppercase">{isPaused ? 'Paused' : 'Focusing'}</p>
      <p className="text-base font-medium text-foreground/80">{taskTitle}</p>
      <div className="relative w-56 h-56 flex items-center justify-center">
        <SecondTick elapsed={isPaused ? 0 : elapsed} size={224} />
        <span className="text-5xl font-mono font-extralight text-foreground/30 tabular-nums">{pad(hrs)}:{pad(mins)}</span>
      </div>
      <div className="flex items-center gap-6" onClick={e => e.stopPropagation()}>
        <button onClick={onTogglePause} className="w-12 h-12 rounded-full border border-border/50 flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors">
          {isPaused ? <Play size={20} /> : <Pause size={20} />}
        </button>
        <button onClick={onStop} className="w-10 h-10 rounded-full border border-border/30 flex items-center justify-center text-primary/60 hover:text-primary transition-colors" title="Finish"><Square size={14} /></button>
        <button onClick={onCancel} className="w-10 h-10 rounded-full border border-border/30 flex items-center justify-center text-destructive/50 hover:text-destructive transition-colors" title="Cancel"><X size={14} /></button>
      </div>
      <p className="text-xs text-muted-foreground/30 mt-4">tap anywhere to minimize</p>
    </div>
  );
}

/* ── Timer Completion Summary ── */
function TimerCompletionOverlay({ taskTitle, elapsed, startedAt, onConfirm, onCancel }: {
  taskTitle: string; elapsed: number; startedAt: string;
  onConfirm: (data: { progress: number; isCompleted: boolean; startTime: string; endTime: string }) => void;
  onCancel: () => void;
}) {
  const startDate = new Date(startedAt);
  const endDate = new Date();
  const [startTime, setStartTime] = useState(format(startDate, 'HH:mm'));
  const [endTime, setEndTime] = useState(format(endDate, 'HH:mm'));
  const [progress, setProgress] = useState(0);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  const handleConfirm = () => {
    if (progress >= 100) { onConfirm({ progress: 100, isCompleted: true, startTime, endTime }); }
    else { setShowConfirmComplete(true); }
  };

  if (showConfirmComplete) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center animate-fade-in">
        <div className="w-[300px] bg-card border border-border rounded-2xl p-6 space-y-5 shadow-xl text-center">
          <p className="text-sm text-foreground/80">Mark this task as complete?</p>
          <p className="text-xs text-muted-foreground">Progress: {progress}%</p>
          <div className="flex items-center gap-4 justify-center pt-2">
            <button onClick={() => onConfirm({ progress, isCompleted: false, startTime, endTime })} className="w-12 h-12 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" title="Keep open"><X size={20} /></button>
            <button onClick={() => onConfirm({ progress, isCompleted: true, startTime, endTime })} className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity" title="Mark complete"><Check size={20} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-[320px] bg-card border border-border rounded-2xl p-6 space-y-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground/60 tracking-[0.2em] uppercase">Session complete</p>
          <p className="text-base font-medium text-foreground">{taskTitle}</p>
        </div>
        <div className="text-center">
          <span className="text-3xl font-mono font-light text-foreground/40 tabular-nums">{hrs > 0 ? `${pad(hrs)}:` : ''}{pad(mins)}:{pad(secs)}</span>
        </div>
        <div className="flex items-center justify-center gap-3">
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-secondary rounded-lg px-2 py-1 text-sm font-mono text-center w-24 focus:outline-none focus:ring-1 focus:ring-primary" />
          <span className="text-muted-foreground text-sm">→</span>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-secondary rounded-lg px-2 py-1 text-sm font-mono text-center w-24 focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Progress</span><span className="text-xs font-mono text-muted-foreground">{progress}%</span></div>
          <Slider value={[progress]} onValueChange={([v]) => setProgress(v)} max={100} step={5} className="w-full" />
        </div>
        <div className="flex items-center gap-3 justify-center pt-1">
          <button onClick={onCancel} className="w-12 h-12 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" title="Discard"><X size={20} /></button>
          <button onClick={handleConfirm} className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity" title="Save"><Check size={20} /></button>
        </div>
      </div>
    </div>
  );
}

/* ── Floating mini timer ── */
function FloatingTimerWidgets({ timers, onClickTimer }: { timers: { id: string; title: string; elapsed: number; isPaused: boolean }[]; onClickTimer: (id: string) => void; }) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="fixed bottom-20 right-3 z-[70] flex flex-col gap-2" style={{ pointerEvents: 'auto' }}>
      {timers.map(t => (
        <div
          key={t.id}
          role="button"
          tabIndex={0}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onPointerUp={(e) => { e.stopPropagation(); onClickTimer(t.id); }}
          onKeyDown={(e) => { if (e.key === 'Enter') onClickTimer(t.id); }}
          className={cn("flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-lg transition-colors text-left border cursor-pointer select-none", t.isPaused ? "bg-muted border-border text-muted-foreground" : "bg-primary/10 border-primary/20 text-primary")}
        >
          <Timer size={16} />
          <div className="flex flex-col">
            <span className="text-xs truncate max-w-[120px] leading-tight font-medium">{t.title}</span>
            <span className="text-base font-mono font-semibold tabular-nums">{pad(Math.floor(t.elapsed / 60))}:{pad(t.elapsed % 60)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Progress dialog ── */
function ProgressDialog({ taskTitle, initialProgress, onConfirm, onCancel }: {
  taskTitle: string; initialProgress: number;
  onConfirm: (progress: number, isCompleted: boolean) => void; onCancel: () => void;
}) {
  const [progress, setProgress] = useState(initialProgress);
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className="w-[300px] bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xl">
        <p className="text-sm font-medium text-foreground text-center">{taskTitle}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">How much done?</span><span className="text-xs font-mono text-muted-foreground">{progress}%</span></div>
          <Slider value={[progress]} onValueChange={([v]) => setProgress(v)} max={100} step={5} className="w-full" />
        </div>
        <div className="flex items-center gap-3 justify-center">
          <button onClick={() => onConfirm(progress, false)} className="w-10 h-10 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" title="Save progress, keep open"><X size={18} /></button>
          <button onClick={() => onConfirm(progress, true)} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity" title="Mark complete"><Check size={18} /></button>
        </div>
      </div>
    </div>
  );
}

/* ── Todo item for the left list ── */
function fmtSec(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) {
    const rm = m % 60;
    return rm > 0 ? `${h}h${rm}m` : `${h}h`;
  }
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d${rh}h` : `${d}d`;
}

function TodoItem({ todo, onToggle, onDelete, onFocus, onUpdateTitle, onUpdateTime, onUpdateProgress, isTiming, timerElapsed, isPaused, onDragStart, onDragEnd, onToggleWithProgress }: {
  todo: Todo; onToggle: () => void; onDelete: () => void; onFocus: () => void;
  onUpdateTitle: (title: string) => void; onUpdateTime: (startTime: string, endTime: string) => void;
  onUpdateProgress: (progress: number) => void;
  isTiming: boolean; timerElapsed: number; isPaused: boolean;
  onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void; onToggleWithProgress: () => void;
}) {
  const { t: tLang, lang } = useLanguage();
  const { getWorkType, setWorkType, overrides } = useWorkTypes();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const hasProgress = todo.progress > 0 && todo.progress < 100 && !todo.is_completed;

  // "Resting" = worked before but not actively timing right now
  const priorWorkSec = todo.timer_seconds || 0;
  const isResting = !isTiming && !todo.is_completed && priorWorkSec > 0 && !!todo.timer_ended_at;
  const restSec = isResting
    ? Math.max(0, Math.floor((Date.now() - new Date(todo.timer_ended_at!).getTime()) / 1000))
    : 0;

  const handleSaveTitle = () => {
    const cleaned = tidyTaskTitle(editTitle);
    if (cleaned && cleaned !== todo.title) onUpdateTitle(cleaned);
    else setEditTitle(todo.title);
    setIsEditing(false);
  };

  const handleStartEditTime = () => {
    const start = todo.timer_started_at ? format(new Date(todo.timer_started_at), 'HH:mm') : format(new Date(), 'HH:mm');
    const end = todo.timer_ended_at ? format(new Date(todo.timer_ended_at), 'HH:mm') : format(new Date(), 'HH:mm');
    setEditStart(start); setEditEnd(end); setIsEditingTime(true);
  };

  const handleSaveTime = () => { onUpdateTime(editStart, editEnd); setIsEditingTime(false); };
  const handleDoubleClickDelete = () => {
    if (isEditing) return;
    // No blocking confirm — delete is instantly undoable via the toast.
    onDelete();
  };

  const isScheduled = !!todo.plan_started_at && !todo.is_completed;
  const isDoing = isActivelyRunningTodo(todo);
  const inferredTag = todo.tags?.[0] || autoClassifyTag(todo.title);
  const tagLabel = inferredTag
    ? inferredTag.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
  const tagPillStyle = getTaskTagPillStyle(inferredTag);
  const workType = getWorkType({ entity: 'todo', id: todo.id, title: todo.title, tags: todo.tags });
  const workTypeMeta = WORK_TYPE_META[workType];
  // Only treat the work type as "set" when the user deliberately picked one
  // (an explicit override). Otherwise the pill is just auto-inferred noise, so
  // we reveal it on row hover instead of cluttering every row.
  const hasExplicitWorkType = !!overrides[getWorkTypeKey('todo', todo.id)];
  const statusLabel = todo.is_completed
    ? 'Done'
    : isDoing
      ? null
      : isResting
        ? tLang('focus.resumeChip')
        : isScheduled
          ? 'Planned'
          : null;

  // Resolve color for active (doing/timing) state: tag → work type → neutral
  const activeColor = tagPillStyle.color !== '#707070'
    ? tagPillStyle.color
    : workTypeMeta?.color || '#8B8B8B';
  const isDark = useIsDarkMode();

  // ── Visual hierarchy (the whole point of this block) ─────────────
  // Goal:   active   ▓▓▓ dominates
  //         inactive ░░░ recedes (especially on dark)
  //         done     ·   barely there
  //
  // Light mode keeps the original "white card on warm paper" treatment
  // because that already reads correctly. The interesting logic is the
  // dark mode branch, where we INVERT the previous mistake: bright
  // surfaces had been making inactive rows louder than the active one.
  // Now inactive rows go transparent with a hairline border, the
  // active row leans hard into its tag color (stronger tint + ring +
  // soft glow halo), and completed rows fade with opacity.

  const activeCategoryStyle = isDoing
    ? isDark
      ? {
          background: `linear-gradient(135deg, ${activeColor}3D 0%, ${activeColor}1F 100%)`,
          borderColor: `${activeColor}80`,
          boxShadow: `0 0 0 1px ${activeColor}38, 0 8px 26px ${activeColor}24`,
        }
      : {
          background: `linear-gradient(135deg, ${activeColor}18 0%, ${activeColor}09 100%)`,
          borderColor: `${activeColor}50`,
        }
    : undefined;

  const containerCls = todo.is_completed
    // Done: maximally recede in both modes — no surface, no border, faded.
    ? "bg-transparent border-transparent opacity-65 hover:opacity-90 dark:opacity-45 dark:hover:opacity-75"
    : isDoing
      // Active: surface comes from inline activeCategoryStyle. Hover just
      // bumps it slightly so the user feels feedback without us fighting
      // the carefully tuned tint.
      ? "hover:brightness-[0.985] dark:hover:brightness-[1.06]"
      : isScheduled
        ? "hover:brightness-[0.99] dark:hover:brightness-[1.04]"
      : isResting
        // Resting = "you have a paused session here". Use a whisper of
        // amber warmth in dark mode so it reads as "come back to me"
        // instead of just another inactive row.
        ? "bg-transparent border-[#F1E6DD] hover:bg-[#FFF6EE] dark:border-amber-500/22 dark:hover:bg-amber-500/[0.04]"
      // Inactive (default): bright in light (cards on paper) → near
      // invisible in dark (transparent surface, hairline border).
      : "bg-white/75 border-[#EFEFEF] hover:bg-[#F9F9F9] dark:bg-transparent dark:border-white/[0.07] dark:hover:bg-white/[0.025]";

  return (
    <div
      className={cn(
        "flex h-[50px] w-full max-w-[920px] items-center gap-3 px-3.5 group rounded-[16px] transition-colors relative select-none border",
        containerCls
      )}
      style={activeCategoryStyle}
      draggable={!isEditing}
      onDragStart={e => { if (isEditing) { e.preventDefault(); return; } onDragStart(e); }}
      onDragEnd={onDragEnd}
      onDoubleClick={e => {
        e.preventDefault();
        e.stopPropagation();
        handleDoubleClickDelete();
      }}
    >
      <button onClick={onToggleWithProgress} className="flex-shrink-0">
        {todo.is_completed ? <CheckCircle2 size={18} className="text-primary/85" /> : <Circle size={18} className="text-muted-foreground/45" />}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {isEditing ? (
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') { setEditTitle(todo.title); setIsEditing(false); } }}
            className="min-w-0 flex-1 text-[12px] font-medium bg-transparent border-b border-primary/30 focus:outline-none focus:border-primary py-0.5" autoFocus />
        ) : (
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[16px] font-semibold leading-tight cursor-pointer transition-colors truncate",
                todo.is_completed
                  // Done — already faded by container opacity, plus muted
                  // strikethrough for unambiguous semantics.
                  ? "text-muted-foreground line-through decoration-muted-foreground/40"
                  : isDoing
                    // Active — pure foreground. Hover tones slightly down
                    // (instead of brightening) since it's already maxed.
                    ? "text-foreground hover:text-foreground/90"
                    // Inactive — full in light mode, recede in dark so the
                    // active row visually wins. Hover invites by lifting
                    // the title back to full brightness.
                    : "text-foreground hover:text-foreground/85 dark:text-foreground/72 dark:hover:text-foreground"
              )}
              onClick={() => { setEditTitle(todo.title); setIsEditing(true); }}
            >
              {todo.title}
            </p>
          </div>
        )}
        {!isEditing && (
          <div className="flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/45">
              {statusLabel && (
                <span className="inline-flex items-center gap-1">
                  {todo.is_completed
                    ? <CheckCircle2 size={9} strokeWidth={2} className="text-primary/70" />
                  : isDoing
                      ? <Timer size={9} strokeWidth={2} style={{ color: hexWithAlpha(activeColor, '88') }} />
                      : isResting
                        ? <Timer size={9} strokeWidth={2} className="text-amber-500/65" />
                        : <CalendarDays size={9} strokeWidth={2} />}
                  <span className={cn(
                    "font-medium",
                    todo.is_completed && "text-primary/70",
                    isResting && "text-amber-500/65"
                  )}
                    style={isDoing ? { color: hexWithAlpha(activeColor, '88') } : undefined}
                  >{statusLabel}</span>
                </span>
              )}
              {/* Resting: show work time + rest duration */}
              {isResting && (
                <span className="inline-flex items-center gap-1 text-amber-500/70">
                  <span>{fmtSec(priorWorkSec)}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground/55">{lang === 'zh' ? `休${fmtSec(restSec)}` : `${fmtSec(restSec)} ago`}</span>
                </span>
              )}
              {!isResting && tagLabel && (
                <span
                  // dark:saturate softens the inline-style tag color (which
                  // is a fully-saturated hex designed for white canvas) so it
                  // doesn't read as neon on the dark surface.
                  className="inline-flex max-w-[88px] min-w-0 items-center gap-1 rounded-full px-1.5 py-[2px] text-[10px] font-medium dark:saturate-[0.78] dark:opacity-90"
                  style={{ backgroundColor: hexWithAlpha(tagPillStyle.bg, '20'), color: tagPillStyle.color }}
                >
                  <ListTodo size={9} strokeWidth={2} />
                  <span className="truncate">{tagLabel}</span>
                </span>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "items-center gap-1 rounded-full px-1.5 py-[2px] text-[10px] font-medium transition-colors hover:brightness-95 dark:saturate-[0.78] dark:opacity-90",
                      hasExplicitWorkType ? "inline-flex" : "hidden group-hover:inline-flex"
                    )}
                    style={{ color: hexWithAlpha(workTypeMeta.color, 'B3'), backgroundColor: `${workTypeMeta.bg}73` }}
                    title="Work type"
                  >
                    <span className="truncate">{workTypeMeta.shortLabel}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-40 rounded-2xl p-1.5">
                  <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                    Work Type
                  </div>
                  <div className="space-y-1">
                    {WORK_TYPE_ORDER.map((type) => {
                      const meta = WORK_TYPE_META[type];
                      const active = type === workType;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setWorkType('todo', todo.id, type)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors',
                            active ? 'bg-secondary text-foreground' : 'hover:bg-secondary/70 text-muted-foreground'
                          )}
                        >
                          <span>{meta.label}</span>
                          {active && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {hasProgress && (
              <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-primary/8 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                <span className="inline-block h-1 w-4 overflow-hidden rounded-full bg-primary/14">
                  <span className="block h-full rounded-full bg-primary/60" style={{ width: `${todo.progress}%` }} />
                </span>
                <span>{todo.progress}%</span>
              </span>
            )}
          </div>
        )}
        {isEditingTime ? (
          <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
            <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} className="bg-secondary rounded px-1 py-0.5 text-xs font-mono w-[70px] focus:outline-none focus:ring-1 focus:ring-primary" />
            <span className="text-muted-foreground text-xs">→</span>
            <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="bg-secondary rounded px-1 py-0.5 text-xs font-mono w-[70px] focus:outline-none focus:ring-1 focus:ring-primary" />
            <button onClick={handleSaveTime} className="text-primary hover:text-primary/80"><Check size={12} /></button>
            <button onClick={() => setIsEditingTime(false)} className="text-muted-foreground hover:text-destructive"><X size={12} /></button>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onDelete}
          className="hidden group-hover:flex h-[34px] w-[34px] rounded-full items-center justify-center border border-transparent text-muted-foreground/55 transition-colors hover:border-destructive/25 hover:bg-destructive/[0.08] hover:text-destructive"
          title={lang === 'zh' ? '删除' : 'Delete'}
        >
          <Trash2 size={14} />
        </button>
        {!todo.is_completed && (
          <button
            onClick={onFocus}
            className={cn(
              "h-[34px] w-[34px] rounded-full flex items-center justify-center transition-colors border",
              isTiming
                ? (isPaused ? "border-border bg-secondary text-foreground/55 opacity-70" : "border-border bg-secondary text-foreground/70 shadow-sm")
                : isResting
                  ? "border-[#8A6A4F]/45 bg-transparent text-[#8A6A4F] hover:bg-[#FFF4EA] dark:border-foreground/20 dark:text-foreground/72 dark:hover:bg-foreground/[0.06]"
                  : "border-[#2F2D29]/45 bg-transparent text-[#2F2D29] hover:bg-[#F2F1EF] dark:border-foreground/20 dark:text-foreground/72 dark:hover:bg-foreground/[0.06]"
            )}
            title={
              isTiming
                ? (lang === 'zh' ? '查看计时器' : 'Show timer')
                : isResting
                  ? tLang('plan.resumeTimer')
                  : tLang('plan.startFocusTimer')
            }
          >
            <Timer size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main PlanView — Split layout: Task List (left) + Timeline (right)
   ══════════════════════════════════════════════════════════════ */
export function PlanView({
  onTodosChanged,
  date,
  onViewDues,
  onViewFullTimeline,
  onOpenVoiceSheet,
  voiceSheetOpen,
  overlayOpen,
  onSwitchToRecap,
  moments = [],
  todos: todosProp,
  importedEvents: importedEventsProp = [],
  onAddMoment,
}: {
  onTodosChanged?: () => void;
  date?: string;
  onViewDues?: () => void;
  onViewFullTimeline?: () => void;
  onOpenVoiceSheet?: () => void;
  voiceSheetOpen?: boolean;
  overlayOpen?: boolean;
  onSwitchToRecap?: () => void;
  moments?: Moment[];
  todos?: Todo[];
  importedEvents?: any[];
  onAddMoment?: (data: {
    text?: string;
    emoji?: string;
    photos: string[];
    tags?: string[];
    isSpecial?: boolean;
    location?: { name: string; lat: number; lng: number; category?: 'restaurant' | 'coffee' | 'grocery' | 'park' | 'museum' | 'other' };
    timer_started_at?: string | null;
    timer_ended_at?: string | null;
    timer_seconds?: number | null;
  }) => Promise<any>;
}) {
  const todayStr = date || format(new Date(), 'yyyy-MM-dd');
  const {
    todos: hookTodos,
    addTodo: rawAddTodo,
    updateTodo: rawUpdateTodo,
    deleteTodo: rawDeleteTodo,
    restoreTodo: rawRestoreTodo,
    toggleComplete: rawToggleComplete,
  } = useTodos(todayStr);
  
  const { events: importedEvents } = useImportedEvents();
  const todos = todosProp ?? hookTodos;
  const dateMoments = moments;
  const dateImportedEvents = useMemo(() => {
    if (importedEventsProp.length > 0) return importedEventsProp;
    return importedEvents.filter(e => format(new Date(e.start_time), 'yyyy-MM-dd') === todayStr);
  }, [importedEvents, importedEventsProp, todayStr]);
  const { defaultPlanTags, customPlanTags, orderedPlanTags } = useCustomOptions();
  const { getWorkType: getPlanWorkType } = useWorkTypes();
  const { t: tLang, lang } = useLanguage();
  const { addReminder } = useReminders();
  const planTags = orderedPlanTags.map(key => {
    const def = defaultPlanTags.find(d => d.key === key);
    return def ? tLang(key) : key;
  });
  const addTodo = useCallback(async (title: string, timeSegment: Todo['time_segment'] = 'anytime', dueDate?: string) => {
    const cleanTitle = tidyTaskTitle(title);
    const result = await rawAddTodo(cleanTitle, timeSegment, dueDate);
    // Auto-classify tag if none assigned
    if (result && (!result.tags || result.tags.length === 0)) {
      const autoTag = autoClassifyTag(cleanTitle);
      if (autoTag) {
        await rawUpdateTodo(result.id, { tags: [autoTag] });
      }
    }
    onTodosChanged?.();
    return result;
  }, [rawAddTodo, rawUpdateTodo, onTodosChanged]);

  const updateTodo = useCallback(async (id: string, updates: Partial<Todo>) => {
    await rawUpdateTodo(id, updates);
    onTodosChanged?.();
  }, [rawUpdateTodo, onTodosChanged]);

  const deleteTodo = useCallback(async (id: string) => {
    setPausedTimers(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setShowOverlayForId(prev => prev === id ? null : prev);
    await rawDeleteTodo(id);
    onTodosChanged?.();
  }, [rawDeleteTodo, onTodosChanged]);

  // Delete with an Undo affordance: remove immediately (no blocking dialog),
  // then offer a brief window to restore the exact task that was removed.
  const deleteTodoWithUndo = useCallback((id: string) => {
    const snapshot = todos.find(t => t.id === id);
    deleteTodo(id);
    if (!snapshot) return;
    showUndoToast({
      description: lang === 'zh' ? `已删除“${snapshot.title}”` : `Deleted “${snapshot.title}”`,
      undoLabel: lang === 'zh' ? '撤销' : 'Undo',
      onUndo: () => { rawRestoreTodo(snapshot); onTodosChanged?.(); },
    });
  }, [todos, deleteTodo, rawRestoreTodo, lang, onTodosChanged]);

  const toggleComplete = useCallback(async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const newCompleted = !todo.is_completed;
    const updates: Partial<Todo> = {
      is_completed: newCompleted,
      progress: newCompleted ? 100 : todo.progress,
    };

    if (newCompleted && todo.timer_started_at && !todo.timer_ended_at) {
      // Task was actively running — record end time
      updates.timer_ended_at = new Date().toISOString();
      updates.timer_seconds = getElapsed(todo);
      clearFreshTimerStart(todo.id);
      setPausedTimers(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setShowOverlayForId(prev => prev === id ? null : prev);
    } else if (newCompleted && todo.plan_started_at && !todo.timer_started_at) {
      // Plan-only completion — treat plan time as actual so Doing view matches Plan view
      const endedAt = todo.plan_ended_at ?? new Date().toISOString();
      updates.timer_started_at = todo.plan_started_at;
      updates.timer_ended_at = endedAt;
      updates.timer_seconds = Math.max(0, Math.floor(
        (new Date(endedAt).getTime() - new Date(todo.plan_started_at).getTime()) / 1000
      ));
    } else if (newCompleted && !todo.timer_started_at && !todo.plan_started_at) {
      Object.assign(updates, getAutoDoneTimerUpdates(todo));
    }

    await rawUpdateTodo(id, updates);
    onTodosChanged?.();
  }, [todos, rawUpdateTodo, onTodosChanged]);

  const isEnterSubmit = (e: React.KeyboardEvent) => {
    const native = e.nativeEvent as KeyboardEvent;
    return e.key === 'Enter' && !e.shiftKey && !isImeComposing(native);
  };

  const [newTitle, setNewTitle] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const taskColumnRef = useRef<HTMLDivElement>(null);
  const timelineFrameRef = useRef<HTMLDivElement>(null);
  const [taskInputDock, setTaskInputDock] = useState<{ left: number; width: number } | null>(null);
  const [recapDock, setRecapDock] = useState<{ right: number; bottom: number } | null>(null);
  
  const [collapsedSegments, setCollapsedSegments] = useState<Set<string>>(new Set());
  const [archiveCollapsed, setArchiveCollapsed] = useState(true);
  const [addingSegment, setAddingSegment] = useState<string | null>(null);
  const [segmentNewTitle, setSegmentNewTitle] = useState('');
  const [isAddingQuick, setIsAddingQuick] = useState(false);
  const [listMode, setListModeState] = useState<'grouped' | 'flat'>(() => readPlanListMode());
  const setListMode = useCallback((mode: 'grouped' | 'flat') => {
    setListModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PLAN_LIST_MODE_KEY, mode);
      window.dispatchEvent(new CustomEvent('plan-list-mode-change', { detail: mode }));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PLAN_LIST_MODE_KEY, listMode);
  }, [listMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleListModeChange = (event: Event) => {
      const next = (event as CustomEvent<'grouped' | 'flat'>).detail;
      if (next === 'grouped' || next === 'flat') setListModeState(next);
    };
    window.addEventListener('plan-list-mode-change', handleListModeChange);
    return () => window.removeEventListener('plan-list-mode-change', handleListModeChange);
  }, []);

  const [_initPauseStates] = useState<Map<string, { pausedAt: number | null; totalPausedMs: number }>>(() => {
    try {
      const raw = localStorage.getItem('plan-pause-states');
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, { pausedAt: number | null; totalPausedMs: number }>;
        return new Map(Object.entries(obj));
      }
    } catch {}
    return new Map();
  });
  const pauseStatesRef = useRef(_initPauseStates);
  const [pausedTimers, setPausedTimers] = useState<Set<string>>(() => {
    const s = new Set<string>();
    _initPauseStates.forEach((v, k) => { if (v.pausedAt !== null) s.add(k); });
    return s;
  });
  const [pauseStateVersion, setPauseStateVersion] = useState(0);
  const [showOverlayForId, setShowOverlayForId] = useState<string | null>(null);
  const [pendingStopIds, setPendingStopIds] = useState<Set<string>>(new Set());
  const [freshTimerStarts, setFreshTimerStarts] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [recurringUntilDone, setRecurringUntilDone] = useState(false);
  const [reminderConfig, setReminderConfig] = useState<{ enabled: boolean; type: 'browser' | 'email'; intervalDays: number }>({ enabled: false, type: 'browser', intervalDays: 1 });
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [timelineRhythmPresetId] = useState(loadPlanTimelineRhythmPresetId);
  const timelineRhythmPreset = useMemo(() => getPlanTimelineRhythmPreset(timelineRhythmPresetId), [timelineRhythmPresetId]);
  const timelineRhythmPalette = useMemo(() => presetToRhythmPalette(timelineRhythmPreset), [timelineRhythmPreset]);
  const [captureSheetOpen, setCaptureSheetOpen] = useState(false);
  const [captureDraft, setCaptureDraft] = useState('');
  const [captureMood, setCaptureMood] = useState<(typeof CAPTURE_MOODS)[number] | null>(null);
  const [capturePhotos, setCapturePhotos] = useState<string[]>([]);
  const [captureLocation, setCaptureLocation] = useState<{ name: string; lat: number; lng: number; category: 'restaurant' | 'coffee' | 'grocery' | 'park' | 'museum' | 'other' } | null>(null);
  const [showCaptureLocationPopover, setShowCaptureLocationPopover] = useState(false);
  const captureFileInputRef = useRef<HTMLInputElement>(null);
  const [isSavingCapture, setIsSavingCapture] = useState(false);
  const [timerDockPos, setTimerDockPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('plan-floating-timer-pos');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const timerDockRef = useRef<HTMLDivElement>(null);
  const timerDockDragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    /** True only after user moved past TIMER_DOCK_DRAG_COMMIT_PX — then we hold pointer capture */
    committed: boolean;
  } | null>(null);
  const suppressTimerClickRef = useRef(false);
  const { user } = useAuth();
  const captureDraftStorageKey = useMemo(
    () => `plan-capture-draft:${user?.id || 'guest'}:${todayStr}`,
    [todayStr, user?.id]
  );
  const activeTimerTodos = todos.filter(t => isActivelyRunningTodo(t) && !pendingStopIds.has(t.id));
  const restingTodos = todos.filter(t => !t.is_completed && !isActivelyRunningTodo(t) && (t.timer_seconds || 0) > 0 && !!t.timer_ended_at);
  const defaultQuickSegment = getTimeSegmentForHour(new Date().getHours()) as Todo['time_segment'];
  const defaultQuickSegmentConfig = TIME_SEGMENTS.find(seg => seg.id === defaultQuickSegment) || TIME_SEGMENTS[1];

  // Clean up pendingStopIds only once todos reflects the task has actually stopped —
  // prevents the FloatingTimer from briefly remounting (which resets its mountTime cap).
  useEffect(() => {
    if (pendingStopIds.size === 0) return;
    setPendingStopIds(prev => {
      const next = new Set(prev);
      let changed = false;
      prev.forEach(id => {
        const todo = todos.find(t => t.id === id);
        if (!todo || !isActivelyRunningTodo(todo)) { next.delete(id); changed = true; }
      });
      return changed ? next : prev;
    });
  }, [todos]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTimerTodos.length === 0 && restingTodos.length === 0) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeTimerTodos.length, restingTodos.length]);

  useEffect(() => {
    const saved = localStorage.getItem(captureDraftStorageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        draft?: string;
        mood?: (typeof CAPTURE_MOODS)[number] | null;
        photos?: string[];
        location?: { name: string; lat: number; lng: number; category: 'restaurant' | 'coffee' | 'grocery' | 'park' | 'museum' | 'other' } | null;
      };
      setCaptureDraft(parsed.draft || '');
      setCaptureMood(parsed.mood || null);
      setCapturePhotos(Array.isArray(parsed.photos) ? parsed.photos : []);
      setCaptureLocation(parsed.location || null);
    } catch {
      localStorage.removeItem(captureDraftStorageKey);
    }
  }, [captureDraftStorageKey]);

  useEffect(() => {
    const hasDraft = Boolean(
      captureDraft.trim() ||
      captureMood ||
      capturePhotos.length > 0 ||
      captureLocation
    );
    if (!hasDraft) {
      localStorage.removeItem(captureDraftStorageKey);
      return;
    }
    localStorage.setItem(
      captureDraftStorageKey,
      JSON.stringify({
        draft: captureDraft,
        mood: captureMood,
        photos: capturePhotos,
        location: captureLocation,
      })
    );
  }, [captureDraft, captureDraftStorageKey, captureLocation, captureMood, capturePhotos]);
  void pauseStateVersion;

  const getElapsed = (todo: Todo) => {
    const accumulatedSec = Math.max(0, todo.timer_seconds || 0);
    const startedAtISO = freshTimerStarts[todo.id] ?? todo.timer_started_at;
    if (!startedAtISO) return accumulatedSec;
    const startedAt = new Date(startedAtISO).getTime();
    if (!Number.isFinite(startedAt)) return accumulatedSec;
    const pauseState = pauseStatesRef.current.get(todo.id);
    const now = Date.now();
    const currentPauseMs = pauseState?.pausedAt ? (now - pauseState.pausedAt) : 0;
    const totalPausedMs = (pauseState?.totalPausedMs || 0) + currentPauseMs;
    const sessionSec = Math.max(0, Math.floor((now - startedAt - totalPausedMs) / 1000));
    return accumulatedSec + sessionSec;
  };

  const getCurrentSessionElapsed = (todo: Todo) => {
    const startedAtISO = freshTimerStarts[todo.id] ?? todo.timer_started_at;
    if (!startedAtISO) return 0;
    const startedAt = new Date(startedAtISO).getTime();
    if (!Number.isFinite(startedAt)) return 0;
    const pauseState = pauseStatesRef.current.get(todo.id);
    const now = Date.now();
    const currentPauseMs = pauseState?.pausedAt ? (now - pauseState.pausedAt) : 0;
    const totalPausedMs = (pauseState?.totalPausedMs || 0) + currentPauseMs;
    return Math.max(0, Math.floor((now - startedAt - totalPausedMs) / 1000));
  };

  const savePauseStatesToStorage = useCallback(() => {
    try {
      const obj: Record<string, { pausedAt: number | null; totalPausedMs: number }> = {};
      pauseStatesRef.current.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem('plan-pause-states', JSON.stringify(obj));
    } catch {}
  }, []);

  const clearPauseState = useCallback((todoId: string) => {
    pauseStatesRef.current.delete(todoId);
    savePauseStatesToStorage();
    setPausedTimers(prev => {
      const next = new Set(prev);
      next.delete(todoId);
      return next;
    });
    setPauseStateVersion(v => v + 1);
  }, [savePauseStatesToStorage]);

  const clearFreshTimerStart = useCallback((todoId: string) => {
    setFreshTimerStarts(prev => {
      if (!prev[todoId]) return prev;
      const next = { ...prev };
      delete next[todoId];
      return next;
    });
  }, []);

  const clampTimerDock = useCallback((x: number, y: number) => {
    const rect = timerDockRef.current?.getBoundingClientRect();
    const width = rect?.width || 220;
    const height = rect?.height || 72;
    const margin = 10;
    return {
      x: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - width - margin)),
      y: Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - height - margin)),
    };
  }, []);

  const handleTimerDockPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = timerDockRef.current?.getBoundingClientRect();
    if (!rect) return;
    timerDockDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: rect.left,
      startY: rect.top,
      committed: false,
    };
    /* Defer setPointerCapture until committed — immediate capture steals the gesture and blocks FloatingTimer click */
  }, []);

  const handleTimerDockPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = timerDockDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (!drag.committed) {
      if (Math.abs(dx) + Math.abs(dy) < TIMER_DOCK_DRAG_COMMIT_PX) return;
      drag.committed = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    const next = clampTimerDock(drag.startX + dx, drag.startY + dy);
    setTimerDockPos(next);
  }, [clampTimerDock]);

  const handleTimerDockPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = timerDockDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const committed = drag.committed;
    timerDockDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (committed) {
      suppressTimerClickRef.current = true;
      setTimerDockPos((current) => {
        if (current) localStorage.setItem('plan-floating-timer-pos', JSON.stringify(current));
        return current;
      });
      window.setTimeout(() => {
        suppressTimerClickRef.current = false;
      }, 0);
    }
  }, []);

  const handleTimerDockPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = timerDockDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    timerDockDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  const withFreshTimerStart = useCallback((todo: Todo) => {
    const timerStartedAt = freshTimerStarts[todo.id];
    return timerStartedAt ? { ...todo, timer_started_at: timerStartedAt } : todo;
  }, [freshTimerStarts]);

  const handlePauseStateChange = useCallback((todoId: string, pauseState: { pausedAt: number | null; totalPausedMs: number }) => {
    if (pauseState.pausedAt === null && pauseState.totalPausedMs === 0) {
      pauseStatesRef.current.delete(todoId);
    } else {
      pauseStatesRef.current.set(todoId, pauseState);
    }
    savePauseStatesToStorage();
    setPausedTimers(prev => {
      const next = new Set(prev);
      if (pauseState.pausedAt !== null) next.add(todoId);
      else next.delete(todoId);
      return next;
    });
    setPauseStateVersion(v => v + 1);
  }, [savePauseStatesToStorage]);

  const [resetPromptTodoId, setResetPromptTodoId] = useState<string | null>(null);

  const handleStartFocus = (todo: Todo) => {
    // If already actively timing (started but not ended), check if it's a scheduled task
    if (todo.timer_started_at && !todo.timer_ended_at) {
      // Check if this was a pre-scheduled timer (started time is in the past, more than 30s ago)
      const startedAt = new Date(todo.timer_started_at).getTime();
      const diff = Date.now() - startedAt;
      if (diff > 30000) {
        // Show reset/resume prompt
        setResetPromptTodoId(todo.id);
        return;
      }
      setShowOverlayForId(todo.id);
      return;
    }
    // Start a fresh timer from now, keep plan fields intact
    const startISO = new Date().toISOString();
    clearPauseState(todo.id);
    setFreshTimerStarts(prev => ({ ...prev, [todo.id]: startISO }));
    updateTodo(todo.id, { timer_started_at: startISO, timer_ended_at: null });
    window.dispatchEvent(new Event('eol-timer-started'));
    const hasAnotherActiveTimer =
      activeTimerTodos.some(t => t.id !== todo.id) ||
      (showOverlayForId !== null && showOverlayForId !== todo.id);
    if (!hasAnotherActiveTimer) {
      setShowOverlayForId(todo.id);
    }
  };

  const handleResetTimer = (todoId: string) => {
    const startISO = new Date().toISOString();
    clearPauseState(todoId);
    setFreshTimerStarts(prev => ({ ...prev, [todoId]: startISO }));
    updateTodo(todoId, { timer_started_at: startISO, timer_ended_at: null, timer_seconds: 0 });
    window.dispatchEvent(new Event('eol-timer-started'));
    setResetPromptTodoId(null);
    setShowOverlayForId(todoId);
  };

  const handleResumeTimer = (todoId: string) => {
    setResetPromptTodoId(null);
    setShowOverlayForId(todoId);
  };

  const handleTogglePause = (todoId: string) => {
    setPausedTimers(prev => { const next = new Set(prev); next.has(todoId) ? next.delete(todoId) : next.add(todoId); return next; });
  };

  const handleStopTimer = async (todoId: string) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo?.timer_started_at) return;

    const elapsed = getElapsed(todo);
    const isDueChild = Boolean((todo as any).parent_due_id);
    const nextProgress = isDueChild ? Math.max(0, Math.min(100, todo.progress || 0)) : 100;
    const nextCompleted = isDueChild ? nextProgress >= 100 : true;

    await updateTodo(todoId, {
      timer_ended_at: new Date().toISOString(),
      timer_seconds: elapsed,
      progress: nextProgress,
      is_completed: nextCompleted,
    });

    if (isDueChild) {
      await supabase.from('todos').update({ progress: nextProgress, is_completed: nextProgress >= 100 } as any).eq('id', (todo as any).parent_due_id);
    }

    clearPauseState(todoId);
    setShowOverlayForId(null);
  };

  const handleCancelTimer = (todoId: string) => {
    updateTodo(todoId, { timer_started_at: null, timer_ended_at: null });
    clearPauseState(todoId);
    setShowOverlayForId(null);
  };

  const handleToggleWithProgress = async (todo: Todo) => {
    const next = todo.is_completed ? 0 : 100;
    const updates: Partial<Todo> = { progress: next, is_completed: !todo.is_completed };

    if (!todo.is_completed && todo.timer_started_at && !todo.timer_ended_at) {
      updates.timer_ended_at = new Date().toISOString();
      updates.timer_seconds = getElapsed(todo);
      clearFreshTimerStart(todo.id);
      setPausedTimers(prev => {
        const n = new Set(prev);
        n.delete(todo.id);
        return n;
      });
      setShowOverlayForId(prev => prev === todo.id ? null : prev);
    } else if (!todo.is_completed && todo.plan_started_at && !todo.timer_started_at) {
      const endedAt = todo.plan_ended_at ?? new Date().toISOString();
      updates.timer_started_at = todo.plan_started_at;
      updates.timer_ended_at = endedAt;
      updates.timer_seconds = Math.max(0, Math.floor(
        (new Date(endedAt).getTime() - new Date(todo.plan_started_at).getTime()) / 1000
      ));
    } else if (!todo.is_completed && !todo.timer_started_at && !todo.plan_started_at) {
      Object.assign(updates, getAutoDoneTimerUpdates(todo));
    }

    await updateTodo(todo.id, updates);
    if ((todo as any).parent_due_id) {
      await supabase.from('todos').update({ progress: next, is_completed: next >= 100 } as any).eq('id', (todo as any).parent_due_id);
    }
  };

  const handleAdd = async (startTimer = false) => {
    if (isAddingQuick || !newTitle.trim()) return;
    const plainTitle = newTitle.trim();
    const emoji = selectedEmoji;
    setNewTitle(''); setSelectedEmoji(null); setIsAddingQuick(true);
    try {
      const title = emoji ? `${emoji} ${plainTitle}` : plainTitle;
      const newTodo = await addTodo(title, defaultQuickSegment);
      if (newTodo && reminderConfig.enabled) {
        await addReminder(title, reminderConfig.intervalDays, `Task reminder (${todayStr})`, reminderConfig.type);
      }
      if (startTimer && newTodo) {
        const startISO = new Date().toISOString();
        setFreshTimerStarts(prev => ({ ...prev, [newTodo.id]: startISO }));
        await updateTodo(newTodo.id, { timer_started_at: startISO });
        if (activeTimerTodos.length === 0 && showOverlayForId === null) {
          setShowOverlayForId(newTodo.id);
        }
      }
    } finally { setIsAddingQuick(false); }
  };

  const toggleSegment = (id: string) => {
    setCollapsedSegments(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const [dragTodoId, setDragTodoId] = useState<string | null>(null);

  useEffect(() => {
    const updateTaskInputDock = () => {
      if (!taskColumnRef.current) return;
      const rect = taskColumnRef.current.getBoundingClientRect();
      setTaskInputDock({
        left: rect.left + 8,
        width: Math.max(240, rect.width - 16),
      });
    };

    updateTaskInputDock();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateTaskInputDock())
      : null;
    if (resizeObserver && taskColumnRef.current) resizeObserver.observe(taskColumnRef.current);

    window.addEventListener('resize', updateTaskInputDock);
    window.addEventListener('scroll', updateTaskInputDock, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateTaskInputDock);
      window.removeEventListener('scroll', updateTaskInputDock, true);
    };
  }, []);

  useEffect(() => {
    const updateRecapDock = () => {
      if (!timelineFrameRef.current) return;
      const rect = timelineFrameRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      setRecapDock({
        right: Math.max(18, viewportWidth - rect.right + 18),
        bottom: 22,
      });
    };

    updateRecapDock();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateRecapDock())
      : null;
    if (resizeObserver && timelineFrameRef.current) resizeObserver.observe(timelineFrameRef.current);

    window.addEventListener('resize', updateRecapDock);
    window.addEventListener('scroll', updateRecapDock, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateRecapDock);
      window.removeEventListener('scroll', updateRecapDock, true);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (segmentId: string, dropIndex?: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragTodoId) return;
    const draggedTodo = todos.find(t => t.id === dragTodoId);
    if (!draggedTodo) { setDragTodoId(null); return; }
    const segTodos = todos.filter(t => t.time_segment === segmentId && t.id !== dragTodoId);
    const insertAt = dropIndex != null ? Math.min(dropIndex, segTodos.length) : segTodos.length;
    segTodos.splice(insertAt, 0, draggedTodo);
    const updates: Promise<void>[] = [];
    if (draggedTodo.time_segment !== segmentId) updates.push(updateTodo(dragTodoId, { time_segment: segmentId as Todo['time_segment'], sort_order: insertAt }));
    else updates.push(updateTodo(dragTodoId, { sort_order: insertAt }));
    segTodos.forEach((t, i) => { if (t.id !== dragTodoId && t.sort_order !== i) updates.push(updateTodo(t.id, { sort_order: i })); });
    Promise.all(updates);
    setDragTodoId(null);
  };

  // Handle dropping a todo from the list onto the timeline
  const handleDropOnTimeline = useCallback((todoId: string, startMin: number) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const startH = Math.floor(startMin / 60);
    const startM = startMin % 60;
    const tag = todo.tags?.[0] || autoClassifyTag(todo.title) || '';
    const smartDur = ['admin','finance','shopping','travel'].includes(tag) ? 15
      : ['life'].includes(tag) ? 20
      : ['social'].includes(tag) ? 30
      : ['health'].includes(tag) ? 45
      : ['study','work','event'].includes(tag) ? 60
      : 30;
    const endMin = startMin + smartDur;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;
    const startISO = new Date(`${today}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`).toISOString();
    const endISO = new Date(`${today}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`).toISOString();
    // 只设置计划时间；实际执行(actual)只能通过番茄钟或在 Actual 模式下补记
    updateTodo(todoId, {
      plan_started_at: startISO,
      plan_ended_at: endISO,
    });
  }, [todos, updateTodo]);

  const grouped = TIME_SEGMENTS.map(seg => {
    const segTodos = todos.filter(t => t.time_segment === seg.id && !t.is_completed);
    segTodos.sort((a, b) => {
      const aDoing = isActivelyRunningTodo(a) ? 1 : 0;
      const bDoing = isActivelyRunningTodo(b) ? 1 : 0;
      if (aDoing !== bDoing) return bDoing - aDoing;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return { ...seg, todos: segTodos };
  });

  const archivedTodos = useMemo(() => {
    const done = todos.filter(t => t.is_completed);
    done.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return done;
  }, [todos]);
  const captureMoments = useMemo(() => {
    return [...dateMoments]
      .filter(moment => moment.tags?.includes(CAPTURE_NOTE_TAG))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [dateMoments]);
  const latestCaptureMoments = captureMoments.slice(0, 3);

  const getInheritedPlanActualRange = useCallback((todo: Todo) => {
    if (!todo.plan_started_at || !todo.plan_ended_at) return null;
    if (!todo.timer_started_at) return null;
    if ((todo.timer_seconds || 0) > 0 || todo.timer_ended_at) return null;

    const planStartMs = new Date(todo.plan_started_at).getTime();
    const planEndMs = new Date(todo.plan_ended_at).getTime();
    if (!Number.isFinite(planStartMs) || !Number.isFinite(planEndMs) || planEndMs <= planStartMs) {
      return null;
    }

    return {
      startISO: todo.plan_started_at,
      endISO: todo.plan_ended_at,
    };
  }, []);

  const logFocusSessionMoment = useCallback(async (todo: Todo, workingSec: number, endedAtISO: string) => {
    if (!onAddMoment || !todo.timer_started_at || workingSec <= 0) return;
    const inheritedPlanRange = getInheritedPlanActualRange(todo);
    await onAddMoment({
      text: todo.title,
      emoji: extractLeadingEmoji(todo.title),
      photos: [],
      tags: ['focus-session', `todo-session:${todo.id}`, ...(todo.tags || [])],
      timer_started_at: inheritedPlanRange?.startISO ?? todo.timer_started_at,
      timer_ended_at: endedAtISO,
      timer_seconds: workingSec,
    });
  }, [getInheritedPlanActualRange, onAddMoment]);
  const getCaptureTypeLabel = useCallback((moment: Moment) => {
    const value = moment.tags?.find(tag => tag !== CAPTURE_NOTE_TAG && !tag.startsWith('mood:'));
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : null;
  }, []);
  const getCaptureMoodLabel = useCallback((moment: Moment) => {
    const value = moment.tags?.find(tag => tag.startsWith('mood:'))?.replace('mood:', '');
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : null;
  }, []);

  // Unscheduled tasks = tasks without a time set on the timeline
  const unscheduledTodos = useMemo(() => todos.filter(t => !t.plan_started_at && !t.is_completed), [todos]);
  const scheduledCount = useMemo(() => todos.filter(t => t.plan_started_at || t.is_completed).length, [todos]);
  const activeTimerIdSet = useMemo(() => new Set(activeTimerTodos.map(t => t.id)), [activeTimerTodos]);
  const getTimerElapsedForId = useCallback((id: string) => {
    const todo = todos.find(t => t.id === id);
    return todo ? getCurrentSessionElapsed(todo) : 0;
  }, [todos, tick]);

  const overlayTodo = showOverlayForId ? todos.find(t => t.id === showOverlayForId) : null;
  const floatingTimers = activeTimerTodos.filter(t => t.id !== showOverlayForId)
    .map(t => ({ id: t.id, title: t.title, elapsed: getElapsed(t), isPaused: pausedTimers.has(t.id) }));
  const uploadCapturePhoto = useCallback(async (file: File): Promise<string | null> => {
    if (!user || file.size > 5 * 1024 * 1024) return null;
    const ext = file.type.split('/')[1] || file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('moment-photos').upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from('moment-photos').getPublicUrl(path);
    return data?.publicUrl ?? null;
  }, [user]);

  const handleCaptureFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const url = await uploadCapturePhoto(file);
      if (url) setCapturePhotos(prev => [...prev, url]);
    }
    if (captureFileInputRef.current) captureFileInputRef.current.value = '';
  }, [uploadCapturePhoto]);

  const handleSaveCapture = useCallback(async () => {
    const text = captureDraft.trim();
    if (!text || !onAddMoment || isSavingCapture) return;

    setIsSavingCapture(true);
    const detectedType = autoDetectCaptureType(text);
    try {
      await onAddMoment({
        text,
        photos: capturePhotos,
        emoji: captureMood ? CAPTURE_MOOD_EMOJIS[captureMood] : undefined,
        location: captureLocation ?? undefined,
        tags: [
          CAPTURE_NOTE_TAG,
          ...(detectedType ? [detectedType] : []),
          ...(captureMood ? [`mood:${captureMood}`] : []),
        ],
      });
      setCaptureDraft('');
      setCaptureMood(null);
      setCapturePhotos([]);
      setCaptureLocation(null);
      localStorage.removeItem(captureDraftStorageKey);
      setCaptureSheetOpen(false);
    } finally {
      setIsSavingCapture(false);
    }
  }, [captureDraft, captureMood, capturePhotos, captureLocation, captureDraftStorageKey, isSavingCapture, onAddMoment]);

  const resetPromptTodo = resetPromptTodoId ? todos.find(t => t.id === resetPromptTodoId) : null;

  return (
    <>
      {/* Reset/Resume prompt */}
      {resetPromptTodo && (
        <div className="fixed inset-0 z-[80] bg-background/90 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={() => setResetPromptTodoId(null)}>
          <div className="w-[300px] bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-foreground">{resetPromptTodo.title}</p>
            <p className="text-xs text-muted-foreground">
              {tLang('plan.timerStartedAt') || 'Timer started at'} {format(new Date(resetPromptTodo.timer_started_at!), 'HH:mm')}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleResumeTimer(resetPromptTodoId!)}
                className="w-full py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                {tLang('plan.resumeTimer') || 'Resume (keep original start)'}
              </button>
              <button
                onClick={() => handleResetTimer(resetPromptTodoId!)}
                className="w-full py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                {tLang('plan.resetTimer') || 'Reset Timer (start from now)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {overlayTodo && (
        <FocusTimerOverlay
          todo={withFreshTimerStart(overlayTodo)}
          pauseState={pauseStatesRef.current.get(overlayTodo.id)}
          onPauseStateChange={(pauseState) => handlePauseStateChange(overlayTodo.id, pauseState)}
          onMinimize={() => setShowOverlayForId(null)}
          accentColor={(() => {
            const inferredTag = overlayTodo.tags?.[0] || autoClassifyTag(overlayTodo.title);
            const tagColor = inferredTag ? TAG_CATEGORY_COLORS[inferredTag.toLowerCase()] : null;
            if (tagColor) return tagColor;
            const wt = getPlanWorkType({ entity: 'todo', id: overlayTodo.id, title: overlayTodo.title, tags: overlayTodo.tags });
            return WORK_TYPE_META[wt]?.color || undefined;
          })()}
          onComplete={async (workingSec, progress) => {
            const finalProgress = progress ?? 100;
            const isDueChild = Boolean((overlayTodo as any).parent_due_id);
            const endedAtISO = new Date().toISOString();
            const shouldDetachSession = finalProgress < 100;
            const snap = withFreshTimerStart(overlayTodo);
            const inheritedPlanRange = getInheritedPlanActualRange(snap);
            setPendingStopIds(prev => new Set([...prev, snap.id]));
            clearPauseState(snap.id);
            clearFreshTimerStart(snap.id);
            setShowOverlayForId(null);
            try {
              if (shouldDetachSession) {
                await logFocusSessionMoment(snap, workingSec, endedAtISO);
              }
              await updateTodo(snap.id, {
                timer_started_at: shouldDetachSession ? null : (inheritedPlanRange?.startISO ?? snap.timer_started_at),
                timer_ended_at: shouldDetachSession ? null : endedAtISO,
                timer_seconds: (snap.timer_seconds || 0) + workingSec,
                is_completed: finalProgress >= 100,
                progress: finalProgress,
              });
              if (isDueChild) {
                await supabase
                  .from('todos')
                  .update({ progress: finalProgress, is_completed: finalProgress >= 100 } as any)
                  .eq('id', (snap as any).parent_due_id);
              }
            } catch {
              // best-effort save
            }
          }}
          onSaveAndContinue={async (workingSec, progress) => {
            const nextProgress = progress ?? overlayTodo.progress ?? 0;
            const isDueChild = Boolean((overlayTodo as any).parent_due_id);
            const endedAtISO = new Date().toISOString();
            const snap = withFreshTimerStart(overlayTodo);
            // Close and remove from active timers immediately
            setPendingStopIds(prev => new Set([...prev, snap.id]));
            clearPauseState(snap.id);
            clearFreshTimerStart(snap.id);
            setShowOverlayForId(null);
            try {
              await logFocusSessionMoment(snap, workingSec, endedAtISO);
              await updateTodo(snap.id, {
                timer_started_at: null,
                timer_ended_at: endedAtISO,
                timer_seconds: (snap.timer_seconds || 0) + workingSec,
                progress: nextProgress,
                is_completed: false,
              });
              if (isDueChild) {
                await supabase
                  .from('todos')
                  .update({ progress: nextProgress, is_completed: false } as any)
                  .eq('id', (snap as any).parent_due_id);
              }
            } catch {
              // best-effort save
            }
          }}
          onFinishAt={async (workingSec, progress, completed, endedAtISO) => {
            const finalProgress = completed ? 100 : progress;
            const isDueChild = Boolean((overlayTodo as any).parent_due_id);
            const snap = withFreshTimerStart(overlayTodo);
            const shouldDetachSession = !completed;
            const inheritedPlanRange = getInheritedPlanActualRange(snap);
            setPendingStopIds(prev => new Set([...prev, snap.id]));
            clearPauseState(snap.id);
            clearFreshTimerStart(snap.id);
            setShowOverlayForId(null);
            try {
              if (shouldDetachSession) {
                await logFocusSessionMoment(snap, workingSec, endedAtISO);
              }
              await updateTodo(snap.id, {
                timer_started_at: shouldDetachSession ? null : (inheritedPlanRange?.startISO ?? snap.timer_started_at),
                timer_ended_at: shouldDetachSession ? endedAtISO : endedAtISO,
                timer_seconds: (snap.timer_seconds || 0) + workingSec,
                progress: finalProgress,
                is_completed: completed,
              });
              if (isDueChild) {
                await supabase
                  .from('todos')
                  .update({ progress: finalProgress, is_completed: completed } as any)
                  .eq('id', (snap as any).parent_due_id);
              }
            } catch {
              // best-effort save
            }
          }}
          onCancel={async () => {
            await updateTodo(overlayTodo.id, { timer_started_at: null, timer_ended_at: null });
            clearPauseState(overlayTodo.id);
            clearFreshTimerStart(overlayTodo.id);
            setShowOverlayForId(null);
          }}
          onUpdateStartTime={async (newStartedAt) => {
            await updateTodo(overlayTodo.id, { timer_started_at: newStartedAt } as any);
          }}
          onUpdateEndTime={async (newEndedAt) => {
            await updateTodo(overlayTodo.id, { plan_ended_at: newEndedAt } as any);
          }}
        />
      )}
      {!captureSheetOpen && !overlayOpen && activeTimerTodos.filter(t => t.id !== showOverlayForId).length > 0 && (
        <div
          ref={timerDockRef}
          className="fixed z-[70] flex cursor-grab touch-none select-none flex-col gap-2 active:cursor-grabbing"
          style={{
            pointerEvents: 'auto',
            ...(timerDockPos ? { left: timerDockPos.x, top: timerDockPos.y } : { right: recapDock ? recapDock.right : 8, bottom: recapDock ? recapDock.bottom + 48 : 16 }),
          }}
          onPointerDownCapture={handleTimerDockPointerDown}
          onPointerMove={handleTimerDockPointerMove}
          onPointerUp={handleTimerDockPointerUp}
          onPointerCancel={handleTimerDockPointerCancel}
          onClickCapture={(e) => {
            if (!suppressTimerClickRef.current) return;
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {activeTimerTodos.filter(t => t.id !== showOverlayForId).map(t => (
            <FloatingTimer
              key={t.id}
              todo={withFreshTimerStart(t)}
              isPaused={pausedTimers.has(t.id)}
              pauseState={pauseStatesRef.current.get(t.id)}
              onClick={() => setShowOverlayForId(t.id)}
              accentColor={(() => {
                const inferredTag = t.tags?.[0] || autoClassifyTag(t.title);
                const tagColor = inferredTag ? TAG_CATEGORY_COLORS[inferredTag.toLowerCase()] : null;
                if (tagColor) return tagColor;
                const wt = getPlanWorkType({ entity: 'todo', id: t.id, title: t.title, tags: t.tags });
                return WORK_TYPE_META[wt]?.color || undefined;
              })()}
            />
          ))}
        </div>
      )}

      {/* Main split layout */}
      <div className="flex gap-0" style={{ minHeight: 'calc(100vh - 180px)' }}>
        {/* Center: Task List (50%) */}
        <div
          ref={taskColumnRef}
          className="flex-1 border-r border-border/20 pr-0.5 flex flex-col min-h-0"
          style={{ maxHeight: 'calc(100vh - 180px)' }}
        >
          <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-2 space-y-1 pb-28">
              {/* Flat list mode */}
              {listMode === 'flat' ? (
                <div className="space-y-0.5">
                  {[...todos].filter(t => !t.is_completed).sort((a, b) => {
                    const aDoing = isActivelyRunningTodo(a) ? 1 : 0;
                    const bDoing = isActivelyRunningTodo(b) ? 1 : 0;
                    if (aDoing !== bDoing) return bDoing - aDoing;
                    const aPlanned = a.plan_started_at ? 1 : 0;
                    const bPlanned = b.plan_started_at ? 1 : 0;
                    if (aPlanned !== bPlanned) return aPlanned - bPlanned;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  }).map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={() => toggleComplete(todo.id)}
                      onDelete={() => deleteTodoWithUndo(todo.id)}
                      onUpdateTitle={(title) => updateTodo(todo.id, { title })}
                      onUpdateTime={(startTime, endTime) => {
                        const startISO = new Date(`${todayStr}T${startTime}:00`).toISOString();
                        const endISO = new Date(`${todayStr}T${endTime}:00`).toISOString();
                        const diffSec = Math.max(0, Math.floor((new Date(endISO).getTime() - new Date(startISO).getTime()) / 1000));
                        updateTodo(todo.id, { timer_started_at: startISO, timer_ended_at: endISO, timer_seconds: diffSec });
                      }}
                      onFocus={() => handleStartFocus(todo)}
                      isTiming={activeTimerTodos.some(t => t.id === todo.id)}
                      timerElapsed={activeTimerTodos.some(t => t.id === todo.id) ? getElapsed(todo) : 0}
                      isPaused={pausedTimers.has(todo.id)}
                      onDragStart={(e) => {
                        setDragTodoId(todo.id);
                        e.dataTransfer.setData('text/plain', todo.id);
                        e.dataTransfer.setData('text/date', todo.date);
                        e.dataTransfer.effectAllowed = 'move';
                        window.dispatchEvent(new CustomEvent('plan-task-drag-start', {
                          detail: { taskId: todo.id, taskDate: todo.date }
                        }));
                      }}
                      onDragEnd={() => {
                        setDragTodoId(null);
                        window.dispatchEvent(new Event('plan-task-drag-end'));
                      }}
                      onToggleWithProgress={() => handleToggleWithProgress(todo)}
                      onUpdateProgress={(progress) => {
                        updateTodo(todo.id, { progress, is_completed: progress >= 100 });
                        if ((todo as any).parent_due_id) {
                          supabase.from('todos').update({ progress, is_completed: progress >= 100 } as any).eq('id', (todo as any).parent_due_id);
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                {grouped.map((seg, segIdx) => (
                  <div key={seg.id} onDragOver={handleDragOver} onDrop={handleDrop(seg.id)}
                    className={cn(segIdx > 0 && "pt-2 border-t border-border/20")}>
                    {/* Section header — matches reference style */}
                    <div className="flex items-center justify-between px-0.5 py-1.5">
                      <button
                        onClick={() => toggleSegment(seg.id)}
                        className="flex items-center gap-2 min-w-0"
                      >
                        <span className="text-[13px] leading-none opacity-65">{seg.emoji}</span>
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/65">{seg.label}</span>
                        <span className="text-[11px] text-muted-foreground/45 font-normal">{seg.todos.length}</span>
                        {collapsedSegments.has(seg.id)
                          ? <ChevronRight size={13} className="text-muted-foreground/45" />
                          : <ChevronDown size={13} className="text-muted-foreground/45" />}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCollapsedSegments(prev => {
                            const next = new Set(prev);
                            next.delete(seg.id);
                            return next;
                          });
                          setAddingSegment(addingSegment === seg.id ? null : seg.id);
                          setSegmentNewTitle('');
                        }}
                        title={lang === 'zh' ? `添加到${seg.label}` : `Add to ${seg.label}`}
                        className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors rounded-md hover:bg-[hsl(var(--surface-soft-hover))]"
                      >
                        <Plus size={15} />
                      </button>
                    </div>

                    {!collapsedSegments.has(seg.id) && (
                      <div>
                        {addingSegment === seg.id && (
                          <div className="flex gap-1 py-1 px-0.5">
                            <input autoFocus value={segmentNewTitle} onChange={e => setSegmentNewTitle(e.target.value)}
                              placeholder={`Add to ${seg.label}...`}
                              onKeyDown={async e => {
                                if (isEnterSubmit(e) && segmentNewTitle.trim()) { await addTodo(segmentNewTitle.trim(), seg.id as Todo['time_segment']); setSegmentNewTitle(''); setAddingSegment(null); }
                                if (e.key === 'Escape') setAddingSegment(null);
                              }}
                              className="flex-1 h-7 text-[12px] rounded-lg bg-card border border-border px-2 focus:outline-none focus:ring-1 focus:ring-primary text-foreground" />
                          </div>
                        )}
                        <div className="space-y-0.5">
                        {seg.todos.map((todo, todoIdx) => (
                          <div key={todo.id}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(seg.id, todoIdx)(e); }}>
                            <TodoItem
                              todo={todo}
                              onToggle={() => toggleComplete(todo.id)}
                              onDelete={() => deleteTodoWithUndo(todo.id)}
                              onUpdateTitle={(title) => updateTodo(todo.id, { title })}
                              onUpdateTime={(startTime, endTime) => {
                                const startISO = new Date(`${todayStr}T${startTime}:00`).toISOString();
                                const endISO = new Date(`${todayStr}T${endTime}:00`).toISOString();
                                const diffSec = Math.max(0, Math.floor((new Date(endISO).getTime() - new Date(startISO).getTime()) / 1000));
                                updateTodo(todo.id, { timer_started_at: startISO, timer_ended_at: endISO, timer_seconds: diffSec });
                              }}
                              onFocus={() => handleStartFocus(todo)}
                              isTiming={activeTimerTodos.some(t => t.id === todo.id)}
                              timerElapsed={activeTimerTodos.some(t => t.id === todo.id) ? getElapsed(todo) : 0}
                              isPaused={pausedTimers.has(todo.id)}
                              onDragStart={(e) => {
                                  setDragTodoId(todo.id);
                                  e.dataTransfer.setData('text/plain', todo.id);
                                  e.dataTransfer.setData('text/date', todo.date);
                                  e.dataTransfer.effectAllowed = 'move';
                                  window.dispatchEvent(new CustomEvent('plan-task-drag-start', {
                                    detail: { taskId: todo.id, taskDate: todo.date }
                                  }));
                              }}
                              onDragEnd={() => {
                                setDragTodoId(null);
                                window.dispatchEvent(new Event('plan-task-drag-end'));
                              }}
                              onToggleWithProgress={() => handleToggleWithProgress(todo)}
                              onUpdateProgress={(progress) => {
                                updateTodo(todo.id, { progress, is_completed: progress >= 100 });
                                if ((todo as any).parent_due_id) {
                                  supabase.from('todos').update({ progress, is_completed: progress >= 100 } as any).eq('id', (todo as any).parent_due_id);
                                }
                              }}
                            />
                          </div>
                        ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                </div>
              )}

              {/* Archive: completed todos */}
              {archivedTodos.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/20">
                  <div className="flex items-center px-0.5 py-1.5">
                    <button onClick={() => setArchiveCollapsed(v => !v)} className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Check size={11} className="text-muted-foreground/40 shrink-0" />
                      <span className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">{tLang('plan.done') || 'Done'}</span>
                      <span className="text-[11px] text-muted-foreground/35">{archivedTodos.length}</span>
                      {archiveCollapsed ? <ChevronRight size={11} className="text-muted-foreground/30" /> : <ChevronDown size={11} className="text-muted-foreground/30" />}
                    </button>
                  </div>
                  {!archiveCollapsed && (
                    <div>
                      <div className="space-y-0.5">
                        {archivedTodos.map(todo => (
                          <TodoItem
                            key={todo.id}
                            todo={todo}
                            onToggle={() => toggleComplete(todo.id)}
                            onDelete={() => deleteTodoWithUndo(todo.id)}
                            onUpdateTitle={(title) => updateTodo(todo.id, { title })}
                            onUpdateTime={(startTime, endTime) => {
                              const startISO = new Date(`${todayStr}T${startTime}:00`).toISOString();
                              const endISO = new Date(`${todayStr}T${endTime}:00`).toISOString();
                              const diffSec = Math.max(0, Math.floor((new Date(endISO).getTime() - new Date(startISO).getTime()) / 1000));
                              updateTodo(todo.id, { timer_started_at: startISO, timer_ended_at: endISO, timer_seconds: diffSec });
                            }}
                            onFocus={() => handleStartFocus(todo)}
                            isTiming={activeTimerTodos.some(t => t.id === todo.id)}
                            timerElapsed={activeTimerTodos.some(t => t.id === todo.id) ? getElapsed(todo) : 0}
                            isPaused={pausedTimers.has(todo.id)}
                            onDragStart={(e) => {
                              setDragTodoId(todo.id);
                              e.dataTransfer.setData('text/plain', todo.id);
                              e.dataTransfer.setData('text/date', todo.date);
                              e.dataTransfer.effectAllowed = 'move';
                              window.dispatchEvent(new CustomEvent('plan-task-drag-start', { detail: { taskId: todo.id, taskDate: todo.date } }));
                            }}
                            onDragEnd={() => { setDragTodoId(null); window.dispatchEvent(new Event('plan-task-drag-end')); }}
                            onToggleWithProgress={() => handleToggleWithProgress(todo)}
                            onUpdateProgress={(progress) => {
                              updateTodo(todo.id, { progress, is_completed: progress >= 100 });
                              if ((todo as any).parent_due_id) {
                                supabase.from('todos').update({ progress, is_completed: progress >= 100 } as any).eq('id', (todo as any).parent_due_id);
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Day footer — a calm two-tier block:
                    1) PlanDrift compact line carries the day's status (the metric)
                    2) a single quieter row underneath with view-toggle + recap CTA
                  No border-t separators, no shadowed pills — visual hierarchy
                  comes from typography & opacity alone. */}
              <div className="mt-4 space-y-1">
                <PlanDrift
                  allTodos={todos}
                  completedTodos={todos.filter(t => t.is_completed)}
                  allMoments={dateMoments}
                  todayDateStr={todayStr}
                  defaultCollapsed
                  rhythmPresetId={timelineRhythmPresetId}
                  rhythmPalette={timelineRhythmPalette}
                />

                <div className="flex items-center justify-end gap-2 px-3">
                  <div
                    role="toolbar"
                    aria-label={lang === 'zh' ? '列表布局' : 'List layout'}
                    className="inline-flex items-center gap-px rounded-full border border-border/30 bg-muted/20 p-[3px]"
                  >
                    <button
                      type="button"
                      onClick={() => setListMode('flat')}
                      title={tLang('plan.flat') || 'Flat list'}
                      className={cn(
                        'rounded-full p-[5px] transition-colors text-muted-foreground/55 hover:text-foreground/75',
                        listMode === 'flat' && 'bg-background text-foreground shadow-[0_0_0_1px_hsl(var(--border)/0.22)]',
                      )}
                    >
                      <List size={13} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setListMode('grouped')}
                      title={tLang('plan.grouped') || 'Grouped by segment'}
                      className={cn(
                        'rounded-full p-[5px] transition-colors text-muted-foreground/55 hover:text-foreground/75',
                        listMode === 'grouped' && 'bg-background text-foreground shadow-[0_0_0_1px_hsl(var(--border)/0.22)]',
                      )}
                    >
                      <LayoutGrid size={13} strokeWidth={2} />
                    </button>
                  </div>

                  {onSwitchToRecap && (
                    <button
                      onClick={onSwitchToRecap}
                      className="group inline-flex items-center gap-0.5 rounded-full border border-[#dccfc1]/40 bg-[#fbf8f4]/55 px-2.5 py-1 text-[11px] font-medium tracking-[-0.01em] text-[#8a7465]/82 transition-all hover:border-[#c9b9a8]/75 hover:bg-[#f6efe8]/85 hover:text-[#725d50] dark:border-foreground/[0.11] dark:bg-foreground/[0.04] dark:text-foreground/65 dark:hover:border-foreground/18 dark:hover:bg-foreground/[0.07] dark:hover:text-foreground/85"
                    >
                      {lang === 'zh' ? '复盘' : 'Recap'}
                      <span className="text-[#8a7465]/50 transition-transform group-hover:translate-x-0.5 dark:text-foreground/40">→</span>
                    </button>
                  )}
                </div>
              </div>

          </div>
          </div>
          {/* Fixed task input rendered separately so it stays at the current viewport bottom */}
          {!showOverlayForId && !voiceSheetOpen && taskInputDock && (
            <div
              className="fixed z-20 pointer-events-none"
              style={{ left: taskInputDock.left, width: taskInputDock.width, bottom: 16 }}
            >
              <div className="pointer-events-auto">
              <div className="bg-[hsl(var(--toolbar-background))] border border-border rounded-[20px] shadow-[0_2px_10px_hsl(var(--foreground)/0.08)] overflow-visible">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                  {/* ➕ menu button */}
                  <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setPlusMenuOpen(prev => !prev); }}
                      className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                        plusMenuOpen ? "bg-[hsl(var(--surface-inset))] text-foreground" : "bg-transparent hover:bg-[hsl(var(--surface-soft-hover))] text-muted-foreground hover:text-foreground"
                      )}>
                      <Plus size={16} />
                    </button>
                    {plusMenuOpen && (
                      <div className="absolute bottom-12 left-0 bg-card border border-border rounded-xl shadow-xl p-2 min-w-[180px] z-[70] space-y-0.5 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider px-2 pt-1">Time slot</p>
                        <div className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs bg-primary/10 text-primary">
                          <span>{defaultQuickSegmentConfig.emoji}</span>
                          <span>
                            {tLang(`plan.seg.${defaultQuickSegment}`) || defaultQuickSegmentConfig.label}
                          </span>
                          <Check size={12} className="ml-auto" />
                        </div>
                        <p className="px-2 pt-0.5 text-[10px] leading-4 text-muted-foreground/60">
                          {lang === 'zh' ? '快速添加会先放到当前时间段；想放回 Anytime 可以再拖过去。' : 'Quick add drops into the current time segment first. Drag it to Anytime if you want it unscheduled.'}
                        </p>
                        <div className="border-t border-border/30 my-1" />
                        <button onClick={() => setReminderConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                          className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors",
                            reminderConfig.enabled ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground"
                          )}>
                          <Bell size={14} className={reminderConfig.enabled ? "text-primary" : "text-muted-foreground"} />
                          <span>{tLang('plan.setReminder') || 'Set Reminder'}</span>
                          {reminderConfig.enabled && <Check size={12} className="ml-auto" />}
                        </button>
                        {reminderConfig.enabled && (
                          <div className="px-1 py-1 space-y-1">
                            <div className="flex gap-1">
                              <button onClick={() => setReminderConfig(prev => ({ ...prev, type: 'browser' }))} className={cn("px-2 py-1 rounded text-[11px]", reminderConfig.type === 'browser' ? "bg-primary/10 text-primary" : "bg-secondary text-foreground")}>Web</button>
                              <button onClick={() => setReminderConfig(prev => ({ ...prev, type: 'email' }))} className={cn("px-2 py-1 rounded text-[11px]", reminderConfig.type === 'email' ? "bg-primary/10 text-primary" : "bg-secondary text-foreground")}>Email</button>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {[1, 3, 7, 30].map(d => (
                                <button key={d} onClick={() => setReminderConfig(prev => ({ ...prev, intervalDays: d }))} className={cn("px-2 py-1 rounded text-[11px]", reminderConfig.intervalDays === d ? "bg-primary/10 text-primary" : "bg-secondary text-foreground")}>{d}d</button>
                              ))}
                            </div>
                          </div>
                        )}
                        <button onClick={() => { setRecurringUntilDone(prev => !prev); }}
                          className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors",
                            recurringUntilDone ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground"
                          )}>
                          <Repeat size={14} className={recurringUntilDone ? "text-primary" : "text-muted-foreground"} />
                          <span>{tLang('plan.repeatDaily') || 'Repeat daily until done'}</span>
                          {recurringUntilDone && <Check size={12} className="ml-auto" />}
                        </button>
                      </div>
                    )}
                  </div>
                  <textarea value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => { if (!isAddingQuick && isEnterSubmit(e)) { e.preventDefault(); handleAdd(); } }}
                    placeholder={tLang('plan.addTask') || 'Add a task...'} rows={1}
                    className="flex-1 bg-transparent resize-none focus:outline-none text-foreground placeholder:text-muted-foreground/60 text-[13px] leading-5"
                    style={{ minHeight: '24px', maxHeight: '72px' }} />
                  {onOpenVoiceSheet && (
                    <button onClick={onOpenVoiceSheet}
                      className="w-8 h-8 rounded-full transition-colors flex-shrink-0 hover:bg-[hsl(var(--surface-soft-hover))] text-muted-foreground hover:text-foreground flex items-center justify-center"
                      title="Voice input"><Mic size={15} /></button>
                  )}
                  <Button onClick={() => handleAdd(true)} size="icon" variant="outline" className="h-8 w-8 rounded-full flex-shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-soft-hover))]" title={tLang('plan.addAndStart') || 'Add & start timer'} disabled={isAddingQuick || !newTitle.trim()}><Timer size={15} /></Button>
                  <Button onClick={() => handleAdd()} size="icon" className="h-8 w-8 rounded-full flex-shrink-0 bg-primary/12 text-primary hover:bg-primary/18" disabled={isAddingQuick || !newTitle.trim()}><ArrowUp size={15} /></Button>
                </div>
              </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Timeline (takes remaining space, ~50%) */}
          <div className="flex-1 flex flex-col min-w-0 pl-0">
          <div
            ref={timelineFrameRef}
            className="relative flex-1 min-h-0 rounded-[28px] border border-[rgba(55,55,62,0.07)] bg-[#f9fafc] px-2.5 py-4 dark:border-border/35 dark:bg-transparent"
          >
            <PlanTimelineView
              todos={todos}
              moments={dateMoments}
              importedEvents={dateImportedEvents}
              date={todayStr}
              rhythmPresetId={timelineRhythmPresetId}
              onUpdateTodo={updateTodo}
              onAddTodo={(title, seg) => addTodo(title, seg as any)}
              onDropTodo={handleDropOnTimeline}
              onUnscheduleTodo={(id) => updateTodo(id, { plan_started_at: null, plan_ended_at: null })}
              onDeleteTodo={deleteTodoWithUndo}
              onRenameTodo={(id, title) => updateTodo(id, { title })}
              onStartTimer={(id) => {
                const todo = todos.find(t => t.id === id);
                if (todo) handleStartFocus(todo);
              }}
              activeTimerIds={activeTimerIdSet}
              getTimerElapsed={getTimerElapsedForId}
            />
          </div>
        </div>
      </div>

      {!showOverlayForId && !voiceSheetOpen && !captureSheetOpen && !overlayOpen && recapDock && (
        <button
          onClick={() => setCaptureSheetOpen(true)}
          className="fixed z-[55] inline-flex items-center gap-1.5 rounded-full border border-[#dccfc1]/60 bg-[#fbf8f4]/82 px-3 py-1.5 text-[11.5px] font-medium tracking-[-0.005em] text-[#8a7465]/90 shadow-[0_4px_14px_rgba(94,79,65,0.06)] backdrop-blur-md transition-all hover:border-[#c9b9a8]/85 hover:bg-[#f6efe8]/92 hover:text-[#725d50] dark:border-foreground/[0.14] dark:bg-foreground/[0.06] dark:text-foreground/72 dark:shadow-[0_4px_14px_rgba(0,0,0,0.32)] dark:hover:border-foreground/22 dark:hover:bg-foreground/[0.10] dark:hover:text-foreground/90"
          style={{ right: recapDock.right, bottom: recapDock.bottom }}
          title={lang === 'zh' ? '添加到 Recap' : 'Add to recap'}
        >
          <NotebookPen size={13} strokeWidth={1.85} className="opacity-80" />
          <span>{lang === 'zh' ? 'Recap' : 'Recap'}</span>
        </button>
      )}

      <input ref={captureFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleCaptureFileChange} />
      <Sheet open={captureSheetOpen} onOpenChange={setCaptureSheetOpen}>
        <SheetContent
          side="right"
          className="w-full border-border/70 bg-background/95 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border/60 px-5 py-4">
            <SheetTitle className="text-[15px] font-semibold">Log a moment</SheetTitle>
          </SheetHeader>

          <div className="px-5 py-5 space-y-3">
            {/* Mood — above the input */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {CAPTURE_MOODS.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => setCaptureMood((c) => c === mood ? null : mood)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    captureMood === mood
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/40 bg-[hsl(var(--surface-soft))] text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{CAPTURE_MOOD_EMOJIS[mood]}</span>
                  <span>{mood.charAt(0).toUpperCase() + mood.slice(1)}</span>
                </button>
              ))}
            </div>

            {/* Unified input box */}
            <div className="flex flex-col rounded-[18px] border border-border/60 bg-[hsl(var(--surface-soft))] overflow-visible">
              {/* Photo previews at top */}
              {capturePhotos.length > 0 && (
                <div className="flex flex-wrap gap-2 px-3 pt-3">
                  {capturePhotos.map((url, i) => (
                    <div key={i} className="relative w-[68px] h-[68px] flex-shrink-0 rounded-xl overflow-hidden">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setCapturePhotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea */}
              <Textarea
                value={captureDraft}
                onChange={(e) => setCaptureDraft(e.target.value)}
                onKeyDown={(e) => {
                  const native = e.nativeEvent as KeyboardEvent;
                  if (e.key === 'Enter' && !e.shiftKey && !native.isComposing && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSaveCapture();
                  }
                }}
                onPaste={(e) => {
                  const imageItem = Array.from(e.clipboardData.items).find(item => item.type.startsWith('image/'));
                  if (imageItem) {
                    e.preventDefault();
                    const file = imageItem.getAsFile();
                    if (!file) return;
                    const localUrl = URL.createObjectURL(file);
                    setCapturePhotos(prev => [...prev, localUrl]);
                    void uploadCapturePhoto(file).then(url => {
                      if (url) {
                        setCapturePhotos(prev => prev.map(p => p === localUrl ? url : p));
                        URL.revokeObjectURL(localUrl);
                      } else {
                        setCapturePhotos(prev => prev.filter(p => p !== localUrl));
                      }
                    });
                  }
                }}
                placeholder="Capture a win, thought, or feeling..."
                className="border-0 bg-transparent px-4 py-3 text-[13px] leading-6 min-h-[120px] resize-none focus-visible:ring-0 placeholder:text-muted-foreground/45"
              />

              {/* Bottom toolbar */}
              <div className="flex items-center gap-2 px-3 pb-3">
                <button
                  type="button"
                  onClick={() => captureFileInputRef.current?.click()}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-soft-hover))] transition-colors"
                  title="Add photo"
                >
                  <Camera size={15} />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCaptureLocationPopover(v => !v)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                      captureLocation
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/50 bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <MapPin size={11} />
                    {captureLocation ? captureLocation.name : 'Location'}
                  </button>
                  {showCaptureLocationPopover && (
                    <LocationPopover
                      onSelect={(loc) => { setCaptureLocation(loc); setShowCaptureLocationPopover(false); }}
                      onClose={() => setShowCaptureLocationPopover(false)}
                    />
                  )}
                </div>
                {captureLocation && (
                  <button
                    type="button"
                    onClick={() => setCaptureLocation(null)}
                    className="text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    <X size={11} />
                  </button>
                )}
                <Button
                  onClick={handleSaveCapture}
                  disabled={!captureDraft.trim() || isSavingCapture}
                  size="icon"
                  className="ml-auto h-8 w-8 rounded-full"
                >
                  {isSavingCapture ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={15} />}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

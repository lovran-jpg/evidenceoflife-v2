import { useState, useEffect, useRef, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { Pause, Play, Square, X, Check, Timer, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Todo } from '@/hooks/useTodos';
import { autoClassifyTag, TAG_CATEGORY_COLORS } from '@/lib/autoTag';
import { useLanguage } from '@/hooks/useLanguage';

export interface PauseState {
  pausedAt: number | null;
  totalPausedMs: number;
}

// ── Tree growth system ──

const TREE_STAGES = [
  { maxPct: 20, emoji: '🌱', label: 'Seed', labelZh: '种子' },
  { maxPct: 50, emoji: '🌿', label: 'Sprout', labelZh: '嫩芽' },
  { maxPct: 80, emoji: '🌳', label: 'Tree', labelZh: '小树' },
  { maxPct: 101, emoji: '🌲', label: 'Big Tree', labelZh: '大树' },
];

const ACTIVITY_TREES: Record<string, { stages: string[]; color: string }> = {
  study:  { stages: ['🌱', '🌿', '🌲', '🌲'], color: 'hsl(var(--focus-green))' },
  event:  { stages: ['🌱', '🌿', '🌲', '🌲'], color: 'hsl(var(--focus-green))' },
  health: { stages: ['🌱', '🌸', '🌳', '🌳'], color: 'hsl(var(--focus-green))' },
  life:   { stages: ['🌱', '🌿', '🌸', '🌸'], color: 'hsl(var(--focus-green))' },
};

const DEAD_TREE = '🥀';

function colorWithAlpha(color: string, alpha: number): string {
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
  }
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

function getTimerColor(tag: string): string {
  return TAG_CATEGORY_COLORS[tag.toLowerCase()] || '#6F7EF7';
}

function getActivityTag(todo: Todo): string {
  if (todo.tags?.length) return todo.tags[0];
  return autoClassifyTag(todo.title) || 'study';
}

function getStartedAtMs(startedAtISO: string | null | undefined, fallback: number): number {
  if (!startedAtISO) return fallback;
  const parsed = new Date(startedAtISO).getTime();
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getTreeEmoji(tag: string, pct: number): string {
  const trees = ACTIVITY_TREES[tag] || ACTIVITY_TREES.study;
  if (pct < 20) return trees.stages[0];
  if (pct < 50) return trees.stages[1];
  if (pct < 80) return trees.stages[2];
  return trees.stages[3];
}

function getTreeStageIndex(pct: number): number {
  if (pct < 20) return 0;
  if (pct < 50) return 1;
  if (pct < 80) return 2;
  return 3;
}

// Default session = 25 min (Pomodoro)
const DEFAULT_SESSION_SEC = 25 * 60;

// ── Focus Timer Overlay ──

interface FocusTimerOverlayProps {
  todo: Todo;
  onMinimize: () => void;
  onComplete: (elapsed: number, progress?: number) => void;
  onSaveAndContinue: (elapsed: number, progress?: number) => void;
  onFinishAt?: (elapsed: number, progress: number, completed: boolean, endedAtISO: string) => void;
  onCancel: () => void;
  pauseState?: PauseState;
  onPauseStateChange?: (pauseState: PauseState) => void;
  onUpdateStartTime?: (newStartedAt: string) => void;
  onUpdateEndTime?: (newEndedAt: string) => void;
  previewMode?: boolean;
  previewElapsedSec?: number;
  accentColor?: string;
}

export function FocusTimerOverlay({
  todo,
  onMinimize,
  onComplete,
  onSaveAndContinue,
  onFinishAt,
  onCancel,
  pauseState: externalPauseState,
  onPauseStateChange,
  onUpdateStartTime,
  onUpdateEndTime,
  previewMode = false,
  previewElapsedSec = 0,
  accentColor,
}: FocusTimerOverlayProps) {
  const { lang, t } = useLanguage();
  const [localPauseState, setLocalPauseState] = useState<PauseState>(externalPauseState ?? { pausedAt: null, totalPausedMs: 0 });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showDeath, setShowDeath] = useState(false);
  const [stageAnimating, setStageAnimating] = useState(false);
  const [editingStart, setEditingStart] = useState(false);
  const [startTimeInput, setStartTimeInput] = useState('');
  const pauseState = externalPauseState ?? localPauseState;
  const isPaused = pauseState.pausedAt !== null;
  const mountTimeRef = useRef(Date.now());
  const fallbackStartedAtRef = useRef(Date.now());

  const tag = getActivityTag(todo);
  const treeColor = accentColor || getTimerColor(tag);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const now = Date.now();
    fallbackStartedAtRef.current = now;
    mountTimeRef.current = now;
    setNowMs(now);
  }, [todo.id]);

  useEffect(() => {
    if (!externalPauseState) return;
    setLocalPauseState(externalPauseState);
  }, [externalPauseState?.pausedAt, externalPauseState?.totalPausedMs]);

  const updatePauseState = useCallback((next: PauseState) => {
    setLocalPauseState(next);
    onPauseStateChange?.(next);
  }, [onPauseStateChange]);

  // accumulatedSec = total time logged across PREVIOUS focus sessions on this task.
  // It is intentionally NOT folded into the session timer — each focus session is
  // a discrete pomodoro cycle. The accumulated total shows up only as quiet context.
  const accumulatedSec = previewMode ? 0 : Math.max(0, todo.timer_seconds || 0);
  const startedAt = previewMode
    ? fallbackStartedAtRef.current
    : getStartedAtMs(todo.timer_started_at, fallbackStartedAtRef.current);
  const now = nowMs;
  const rawElapsed = previewMode ? 0 : now - startedAt;
  const currentPauseMs = isPaused ? (now - pauseState.pausedAt!) : 0;
  const totalPaused = pauseState.totalPausedMs + currentPauseMs;
  const workingMs = Math.max(0, rawElapsed - totalPaused);
  // Only cap during the first 2s for freshly started timers (prevents DB round-trip flash).
  // For ongoing timers being resumed, skip the cap so elapsed shows correctly immediately.
  const mountElapsed = now - mountTimeRef.current;
  const cappedWorkingMs = (mountElapsed < 2000 && rawElapsed < 10000) ? Math.min(workingMs, mountElapsed + 500) : workingMs;
  // sessionDisplaySec = current focus session only (resets on each new "Focus" press).
  // sessionWorkingSec = same value, just without the mount-cap, used for DB writes.
  const sessionDisplaySec = previewMode ? previewElapsedSec : Math.floor(cappedWorkingMs / 1000);
  const sessionWorkingSec = previewMode ? previewElapsedSec : Math.floor(workingMs / 1000);
  const restSec = isPaused ? Math.floor(currentPauseMs / 1000) : 0;
  const startedDate = Number.isFinite(startedAt) ? new Date(startedAt) : null;
  const crossedDay = startedDate ? startedDate.toDateString() !== new Date().toDateString() : false;
  const looksForgotten = !previewMode && !isPaused && (sessionWorkingSec >= 4 * 3600 || crossedDay);
  const suggestedEndDate = (() => {
    if (!startedDate) return null;
    const plannedEnd = todo.plan_ended_at ? new Date(todo.plan_ended_at) : null;
    if (plannedEnd && plannedEnd.getTime() > startedAt && plannedEnd.getTime() < Date.now()) return plannedEnd;
    return new Date(startedAt + DEFAULT_SESSION_SEC * 1000);
  })();
  const suggestedEndLabel = suggestedEndDate
    ? `${String(suggestedEndDate.getHours()).padStart(2, '0')}:${String(suggestedEndDate.getMinutes()).padStart(2, '0')}`
    : null;
  const suggestedEndElapsedSec = suggestedEndDate && Number.isFinite(startedAt)
    ? Math.max(60, Math.floor((suggestedEndDate.getTime() - startedAt - totalPaused) / 1000))
    : DEFAULT_SESSION_SEC;

  // Progress + tree growth tied to the CURRENT session only — one pomodoro cycle.
  // Each new "Focus" press starts a fresh seed → tree growth, no carry-over.
  const progressPct = Math.min(100, (sessionDisplaySec / DEFAULT_SESSION_SEC) * 100);
  const currentStage = getTreeStageIndex(progressPct);
  const prevStageRef = useRef(currentStage);
  const treeEmoji = getTreeEmoji(tag, progressPct);

  // Detect stage change for animation
  useEffect(() => {
    if (currentStage !== prevStageRef.current) {
      prevStageRef.current = currentStage;
      setStageAnimating(true);
      const t = setTimeout(() => setStageAnimating(false), 500);
      return () => clearTimeout(t);
    }
  }, [currentStage]);

  const pad = (n: number) => String(n).padStart(2, '0');
  // Big timer display = current focus session, never the lifetime sum.
  const hrs = Math.floor(sessionDisplaySec / 3600);
  const mins = Math.floor((sessionDisplaySec % 3600) / 60);
  const secs = sessionDisplaySec % 60;

  // Quiet "previously" indicator — shows the total time already logged on this
  // task across earlier Continue Later sessions. Only appears when relevant.
  const accumulatedLabel = (() => {
    if (accumulatedSec < 30) return null;
    const aH = Math.floor(accumulatedSec / 3600);
    const aM = Math.floor((accumulatedSec % 3600) / 60);
    if (aH > 0) return aM > 0 ? `${aH}h ${aM}m` : `${aH}h`;
    return `${aM}m`;
  })();

  // Progress ring geometry
  const ringR = 88;
  const ringCx = 96;
  const ringCy = 96;
  const circumference = 2 * Math.PI * ringR;
  const dashOffset = circumference * (1 - progressPct / 100);

  const handlePauseResume = useCallback(() => {
    updatePauseState((() => {
      const prev = pauseState;
      if (prev.pausedAt !== null) {
        const pausedDuration = Date.now() - prev.pausedAt;
        return { pausedAt: null, totalPausedMs: prev.totalPausedMs + pausedDuration };
      } else {
        return { ...prev, pausedAt: Date.now() };
      }
    })());
  }, [pauseState, updatePauseState]);

  // Slider DEFAULTS to 100% and renders muted/gray until the user actually
  // drags it. Most "End this phase" taps mean "this block is basically done";
  // forcing the user to push the slider to the end every time was friction.
  // `progressTouched` drives both the brighten-on-edit styling and whether we
  // trust the slider value over the task's existing progress.
  const [completionProgress, setCompletionProgress] = useState(100);
  const [progressTouched, setProgressTouched] = useState(false);

  useEffect(() => {
    setCompletionProgress(100);
    setProgressTouched(false);
  }, [todo.id]);

  // "Complete" is a decisive action: it always means 100% done, regardless of
  // where the slider sits. The slider exists only to record partial progress
  // for the "Continue Later" path.
  const handleComplete = useCallback(() => {
    onComplete(sessionWorkingSec, 100);
  }, [onComplete, sessionWorkingSec]);

  // 阶段性结束：保存本段计入历史、结束本轮计时器，任务仍开放。进度封顶 99%
  // （与「完成任务」区分开）。若用户没动滑块，保留任务原有进度，避免凭空抬到 99%。
  const handleContinueLater = useCallback(() => {
    const nextProgress = progressTouched
      ? Math.min(99, completionProgress)
      : Math.max(0, Math.min(99, todo.progress || 0));
    onSaveAndContinue(sessionWorkingSec, nextProgress);
  }, [completionProgress, progressTouched, todo.progress, onSaveAndContinue, sessionWorkingSec]);

  const handleFinishAtSuggestion = useCallback((completed: boolean) => {
    if (!suggestedEndDate || !onFinishAt) return;
    // When NOT completing (e.g. closing a forgotten timer), never fabricate a
    // 100%-but-unfinished state from the default slider — that muddies the
    // resume gating. Keep the task's existing progress unless the user dragged
    // the slider, and cap at 99% to stay distinct from "complete".
    const nextProgress = completed
      ? 100
      : progressTouched
        ? Math.min(99, completionProgress)
        : Math.max(0, Math.min(99, todo.progress || 0));
    onFinishAt(suggestedEndElapsedSec, nextProgress, completed, suggestedEndDate.toISOString());
  }, [completionProgress, progressTouched, todo.progress, onFinishAt, suggestedEndDate, suggestedEndElapsedSec]);

  const handleCancel = useCallback(() => {
    setShowDeath(true);
    setTimeout(() => {
      onCancel();
    }, 1500);
  }, [onCancel]);

  // Death screen
  if (showDeath) {
    return (
      <div className="fixed inset-0 z-[80] bg-[hsl(var(--surface-contrast))] flex flex-col items-center justify-center gap-6 animate-fade-in">
        <div className="text-7xl opacity-60">{DEAD_TREE}</div>
        <p className="text-sm text-muted-foreground/60">
          {lang === 'zh' ? '专注被中断了...' : 'Session interrupted...'}
        </p>
      </div>
    );
  }

  const stageInfo = TREE_STAGES[currentStage];

  // Worked-so-far label for quiet context on the rest screen.
  const workedLabel = (() => {
    const wH = Math.floor(sessionDisplaySec / 3600);
    const wM = Math.floor((sessionDisplaySec % 3600) / 60);
    if (wH > 0) return wM > 0 ? `${wH}h ${wM}m` : `${wH}h`;
    return `${wM}m`;
  })();

  // ── Dedicated REST screen ──
  // When paused, the focus chrome (ring, tree, stop/complete flow) is the wrong
  // mental model — the user is taking a breather, not finishing. Render a calm,
  // breathing rest card instead: big break time, one obvious Resume action.
  if (isPaused && !previewMode) {
    return (
      <div
        className="fixed inset-0 z-[80] cursor-pointer overflow-hidden animate-fade-in"
        style={{ backgroundColor: 'hsl(var(--overlay-backdrop))' }}
        onClick={() => onMinimize()}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ backgroundColor: colorWithAlpha(treeColor, 0.06) }}
          />
        </div>

        <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
          <div
            className="w-full max-w-[360px] rounded-[32px] border border-border/60 bg-[hsl(var(--surface-contrast)/0.97)] px-6 py-8 shadow-[0_18px_54px_hsl(var(--foreground)/0.15)] backdrop-blur-xl sm:max-w-[376px]"
            onClick={e => e.stopPropagation()}
          >
            {/* Eyebrow */}
            <div className="flex items-center justify-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: treeColor }} />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: treeColor }} />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground/55">
                {lang === 'zh' ? '休息中' : 'On a break'}
              </span>
            </div>

            {/* Breathing circle with the rest time at its heart */}
            <div className="mt-7 flex justify-center">
              <div className="relative flex h-[180px] w-[180px] items-center justify-center">
                {/* breathing rings */}
                <span
                  className="absolute inset-0 rounded-full border"
                  style={{ borderColor: colorWithAlpha(treeColor, 0.18), animation: 'breathe 4s ease-in-out infinite' }}
                />
                <span
                  className="absolute inset-[14px] rounded-full border"
                  style={{ borderColor: colorWithAlpha(treeColor, 0.12), animation: 'breathe 4s ease-in-out infinite 0.4s' }}
                />
                <div
                  className="absolute inset-[26px] rounded-full"
                  style={{ background: `radial-gradient(circle at 50% 45%, ${colorWithAlpha(treeColor, 0.14)}, transparent 70%)` }}
                />
                <div className="relative z-10 flex flex-col items-center">
                  <span className="font-mono text-[40px] font-light leading-none tabular-nums tracking-[0.02em] text-foreground/90">
                    {pad(Math.floor(restSec / 60))}:{pad(restSec % 60)}
                  </span>
                  <span className="mt-2 text-[11px] tracking-[0.05em] text-muted-foreground/50">
                    {lang === 'zh' ? '已休息' : 'resting'}
                  </span>
                </div>
              </div>
            </div>

            {/* Task context — quiet, the break is the focus now */}
            <div className="mt-6 text-center">
              <p className="text-[13px] font-medium leading-snug text-foreground/80">
                {todo.title}
              </p>
              <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground/45">
                {lang === 'zh' ? `本次已专注 ${workedLabel}` : `${workedLabel} focused so far`}
                {accumulatedLabel && (lang === 'zh' ? ` · 累计 ${accumulatedLabel}` : ` · ${accumulatedLabel} total`)}
              </p>
            </div>

            {/* Resume — the one obvious action */}
            <button
              onClick={handlePauseResume}
              className="mt-7 flex h-14 w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-semibold text-white/95 transition-all hover:brightness-[0.97] active:brightness-[0.93]"
              style={{
                backgroundColor: treeColor,
                boxShadow: `0 6px 20px ${colorWithAlpha(treeColor, 0.32)}`,
              }}
            >
              <Play size={18} className="fill-current" />
              {lang === 'zh' ? '继续专注' : 'Resume focus'}
            </button>

            {/* Secondary actions — calm, low-emphasis */}
            <div className="mt-3 flex items-center justify-center gap-5">
              <button
                onClick={() => onMinimize()}
                className="text-[12px] font-medium text-muted-foreground/55 transition-colors hover:text-foreground/75"
              >
                {lang === 'zh' ? '收起' : 'Minimize'}
              </button>
              <span className="h-3 w-px bg-border/60" />
              <button
                onClick={handleCancel}
                className="text-[12px] font-medium text-destructive/55 transition-colors hover:text-destructive/80"
              >
                {lang === 'zh' ? '放弃本次' : 'Discard'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div
      className="fixed inset-0 z-[80] cursor-pointer overflow-hidden animate-fade-in"
      style={{ backgroundColor: 'hsl(var(--overlay-backdrop))' }}
      onClick={() => onMinimize()}
    >
      <div className="absolute inset-0 opacity-35 pointer-events-none">
        <div className="absolute left-1/2 top-[18%] h-48 w-48 -translate-x-1/2 rounded-full blur-3xl" style={{ backgroundColor: colorWithAlpha(treeColor, 0.09) }} />
        <div className="absolute left-1/2 top-[54%] h-64 w-64 -translate-x-1/2 rounded-full border border-border/20" />
      </div>

      <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div
          className="max-h-[calc(100vh-2rem)] w-full max-w-[360px] overflow-y-auto rounded-[32px] border border-border/70 bg-[hsl(var(--surface-contrast)/0.98)] px-5 py-5 shadow-[0_18px_54px_hsl(var(--foreground)/0.13)] backdrop-blur-xl sm:max-h-[calc(100vh-3rem)] sm:max-w-[376px]"
          onClick={e => e.stopPropagation()}
        >
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/52">
              {isPaused
                ? (lang === 'zh' ? '已暂停' : 'Paused')
                : accumulatedSec > 0
                  ? t('focus.overlayContinuing')
                  : t('focus.overlayFocusing')}
            </p>

            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: treeColor }} />
              <span className="rounded-full bg-[hsl(var(--surface-soft))] px-3 py-1 text-[11px] font-medium capitalize text-[hsl(var(--text-soft))] shadow-[inset_0_0_0_1px_hsl(var(--border)/0.7)]">
                {tag}
              </span>
            </div>

            <h2 className="mx-auto mt-4 max-w-[300px] text-balance text-[19px] font-semibold leading-[1.2] tracking-[-0.03em] text-foreground sm:text-[20px]">
              {todo.title}
            </h2>
          </div>

          <div className="mt-5 flex justify-center">
            <div className="relative flex h-[164px] w-[164px] items-center justify-center rounded-full bg-[hsl(var(--surface-soft))] shadow-[inset_0_0_0_1px_hsl(var(--border)/0.55)] sm:h-[172px] sm:w-[172px]">
              <svg width={154} height={154} viewBox="4 4 184 184" className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 sm:h-[160px] sm:w-[160px]" style={{ transform: 'translate(-50%, -50%) rotate(-90deg)' }}>
                <circle cx={ringCx} cy={ringCy} r={ringR} fill="none" stroke="hsl(var(--focus-track))" strokeWidth={7} />
                <circle
                  cx={ringCx}
                  cy={ringCy}
                  r={ringR}
                  fill="none"
                  stroke={treeColor}
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-1000"
                  style={{ opacity: 0.9 }}
                />
              </svg>

              <div className="relative z-10 flex flex-col items-center">
                <span
                  className={cn(
                    "text-[40px] leading-none transition-transform duration-500 sm:text-[44px]",
                    stageAnimating && "animate-scale-in",
                    isPaused && "opacity-45 grayscale"
                  )}
                >
                  {treeEmoji}
                </span>
                <span className="mt-2 font-mono text-[23px] font-light tabular-nums tracking-[0.03em] text-foreground/78 sm:text-[24px]">
                  {pad(hrs)}:{pad(mins)}:{pad(secs)}
                </span>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[hsl(var(--text-soft))]">
                  <span>{lang === 'zh' ? stageInfo.labelZh : stageInfo.label}</span>
                  <span>·</span>
                  <span>{Math.round(progressPct)}%</span>
                  {isPaused && (
                    <>
                      <span>·</span>
                      <span>{lang === 'zh' ? '暂停' : 'Rest'} {pad(Math.floor(restSec / 60))}:{pad(restSec % 60)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quiet "previously" hint — surfaces only when this task already has
              prior focus sessions. Confirms continuity ("you've spent Xh on
              this before") without inflating the live session timer. */}
          {accumulatedLabel && (
            <div className="mt-2 flex items-center justify-center">
              <span className="font-mono text-[10px] tabular-nums tracking-[0.08em] text-muted-foreground/45">
                {lang === 'zh' ? `之前累计 ${accumulatedLabel}` : `Previously ${accumulatedLabel}`}
              </span>
            </div>
          )}

          {/* Adjustable end time */}
          {!previewMode && (onUpdateEndTime || onUpdateStartTime) && todo.timer_started_at && (
            <div className="mt-3 flex justify-center" onClick={e => e.stopPropagation()}>
              {(() => {
                const endTime = todo.plan_ended_at
                  ? new Date(todo.plan_ended_at)
                  : null;
                const endDisplay = endTime
                  ? `${String(endTime.getHours()).padStart(2,'0')}:${String(endTime.getMinutes()).padStart(2,'0')}`
                  : null;
                return editingStart ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground/55">{lang === 'zh' ? '结束于' : 'Ends at'}</span>
                    <input
                      type="time"
                      autoFocus
                      defaultValue={endDisplay ?? (() => {
                        const d = new Date(todo.timer_started_at as string);
                        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                      })()}
                      onChange={e => setStartTimeInput(e.target.value)}
                      className="font-mono text-[12px] bg-[hsl(var(--surface-soft))] border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/12 text-primary hover:bg-primary/20"
                      onClick={() => {
                        if (startTimeInput && onUpdateEndTime) {
                          const ref = new Date(todo.timer_started_at as string);
                          const [h, m] = startTimeInput.split(':').map(Number);
                          const next = new Date(ref);
                          next.setHours(h, m, 0, 0);
                          onUpdateEndTime(next.toISOString());
                        }
                        setEditingStart(false);
                      }}
                    >
                      <Check size={11} />
                    </button>
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted"
                      onClick={() => setEditingStart(false)}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground/45 hover:text-muted-foreground/70 transition-colors"
                    onClick={() => setEditingStart(true)}
                  >
                    <Timer size={11} />
                    <span>{lang === 'zh' ? '结束于' : 'Ends at'} {endDisplay ?? '--:--'}</span>
                  </button>
                );
              })()}
            </div>
          )}

          {looksForgotten && suggestedEndLabel && onFinishAt && (
            <div className="mt-4 rounded-[20px] border border-amber-200/55 bg-amber-50/65 px-3.5 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
              <p className="text-[12px] font-semibold tracking-[-0.01em] text-amber-900/80">
                {lang === 'zh' ? '可能忘记结束了' : 'Maybe left running'}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-amber-900/58">
                {lang === 'zh'
                  ? `可以先把这段收在 ${suggestedEndLabel}，也可以继续计时。`
                  : `End this session at ${suggestedEndLabel}, or keep it running.`}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleFinishAtSuggestion(false)}
                  className="h-8 rounded-full bg-white/75 px-3 text-[11px] font-semibold text-amber-900/72 shadow-[inset_0_0_0_1px_rgba(146,64,14,0.12)] transition-colors hover:bg-white dark:bg-white/[0.06] dark:text-amber-200/85 dark:shadow-[inset_0_0_0_1px_rgba(252,211,77,0.18)] dark:hover:bg-white/[0.10]"
                >
                  {lang === 'zh' ? `收在 ${suggestedEndLabel}` : `End ${suggestedEndLabel}`}
                </button>
                <button
                  onClick={() => handleFinishAtSuggestion(true)}
                  className="h-8 rounded-full bg-amber-900/10 px-3 text-[11px] font-semibold text-amber-900/78 transition-colors hover:bg-amber-900/14 dark:bg-amber-200/10 dark:text-amber-200/85 dark:hover:bg-amber-200/15"
                >
                  {lang === 'zh' ? '完成任务' : 'Complete'}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4" onClick={e => e.stopPropagation()}>
            {!showStopConfirm ? (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <button
                    onClick={handlePauseResume}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-[hsl(var(--surface-contrast))] text-foreground/72 transition-colors hover:bg-[hsl(var(--surface-soft-hover))]"
                  >
                    {isPaused ? <Play size={17} /> : <Pause size={17} />}
                    <span className="text-[12px] font-medium">{isPaused ? (lang === 'zh' ? '继续' : 'Resume') : (lang === 'zh' ? '暂停' : 'Pause')}</span>
                  </button>
                  <button
                    onClick={() => setShowStopConfirm(true)}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-[0_4px_14px_hsl(var(--foreground)/0.12)] transition-[filter] hover:brightness-[1.06]"
                    style={{ backgroundColor: treeColor }}
                    title="Stop"
                  >
                    <Square size={16} className="fill-current" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-destructive/18 bg-[hsl(var(--surface-contrast))] text-destructive/72 transition-colors hover:bg-destructive/8"
                    title="Cancel timer"
                  >
                    <X size={17} />
                    <span className="text-[12px] font-medium">{lang === 'zh' ? '取消' : 'Cancel'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-border/60 bg-[hsl(var(--surface-soft)/0.72)] p-3 shadow-[inset_0_1px_0_hsl(var(--surface-contrast)/0.5)]">
                {/* Back affordance — a mis-tapped stop must never trap the user
                    in the end panel. This returns to the live timer untouched. */}
                <button
                  type="button"
                  onClick={() => setShowStopConfirm(false)}
                  className="mb-2 flex items-center gap-1 rounded-full px-1.5 py-1 text-[11px] font-medium text-muted-foreground/60 transition-colors hover:text-foreground/80"
                >
                  <ChevronLeft size={14} />
                  <span>{lang === 'zh' ? '返回计时' : 'Back to timer'}</span>
                </button>
                <div className="rounded-[18px] border border-border/60 bg-[hsl(var(--surface-contrast)/0.78)] px-3.5 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--text-soft))]">
                      {lang === 'zh' ? '完成进度' : 'Progress'}
                    </span>
                    <span className={cn(
                      'font-mono text-[11px] tabular-nums transition-colors',
                      progressTouched ? 'text-foreground/80' : 'text-muted-foreground/40',
                    )}>
                      {completionProgress}%
                    </span>
                  </div>
                  <Slider
                    value={[completionProgress]}
                    onValueChange={([v]) => { setCompletionProgress(v); setProgressTouched(true); }}
                    max={100}
                    step={5}
                    className={cn('mt-2 w-full transition-opacity', progressTouched ? 'opacity-100' : 'opacity-45')}
                  />
                </div>
                <p className="mt-2 px-0.5 text-center text-[10px] leading-relaxed text-muted-foreground/50">
                  {t('focus.endPhaseHint')}
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleContinueLater}
                    className="flex h-11 w-full items-center justify-center rounded-full border border-border/55 bg-[hsl(var(--surface-contrast)/0.85)] px-3 text-[12.5px] font-medium tracking-[-0.005em] text-foreground/70 transition-colors hover:bg-[hsl(var(--surface-contrast))] hover:text-foreground/85"
                  >
                    {t('focus.endPhase')}
                  </button>
                  <button
                    onClick={handleComplete}
                    className="group flex h-11 w-full items-center justify-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium tracking-[-0.005em] text-white/95 transition-all hover:brightness-[0.96] active:brightness-[0.92]"
                    // Soften the raw treeColor: blend ~22% with the warm card
                    // surface so it sits as a CALM affirmative button, not a
                    // saturated CTA shouting at the user. Keeps the tag-color
                    // identity for consistency with the timer ring.
                    style={{
                      backgroundColor: `color-mix(in srgb, ${treeColor} 78%, hsl(var(--card)) 22%)`,
                      boxShadow: `0 2px 10px color-mix(in srgb, ${treeColor} 30%, transparent)`,
                    }}
                  >
                    <Check size={14} strokeWidth={2.2} className="opacity-90" />
                    {lang === 'zh' ? '完成任务' : 'Complete'}
                  </button>
                </div>
              </div>
            )}
          </div>
          {!showStopConfirm && (
            <p className="mt-5 text-center text-[11px] text-muted-foreground/45">
              {lang === 'zh' ? '轻触空白处最小化' : 'Tap outside to minimize'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Floating mini timer widget ── */

interface FloatingTimerProps {
  todo: Todo;
  isPaused: boolean;
  pauseState?: PauseState;
  onClick: () => void;
  accentColor?: string;
}

export function FloatingTimer({ todo, isPaused, pauseState, onClick, accentColor }: FloatingTimerProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const tag = getActivityTag(todo);
  const treeColor = accentColor || getTimerColor(tag);

  const mountTimeRef2 = useRef(Date.now());
  const fallbackStartedAtRef = useRef(Date.now());
  useEffect(() => {
    const now = Date.now();
    fallbackStartedAtRef.current = now;
    mountTimeRef2.current = now;
    setNowMs(now);
  }, [todo.id]);

  const startedAt = getStartedAtMs(todo.timer_started_at, fallbackStartedAtRef.current);
  const now = nowMs;
  const rawElapsed = now - startedAt;
  const currentPauseMs = isPaused && pauseState?.pausedAt ? (now - pauseState.pausedAt) : 0;
  const totalPaused = (pauseState?.totalPausedMs || 0) + currentPauseMs;
  const rawWorkingMs = Math.max(0, rawElapsed - totalPaused);
  const mountElapsed2 = now - mountTimeRef2.current;
  // Floating widget shows the CURRENT session only — same semantics as the
  // full overlay. Lifetime/accumulated time is intentionally not shown here;
  // it would defeat the pomodoro rhythm and balloon to absurd values.
  const sessionSec = (mountElapsed2 < 2000 && rawWorkingMs < 10000)
    ? Math.max(0, Math.floor(Math.min(rawWorkingMs, mountElapsed2 + 500) / 1000))
    : Math.max(0, Math.floor(rawWorkingMs / 1000));
  const progressPct = Math.min(100, (sessionSec / DEFAULT_SESSION_SEC) * 100);
  const treeEmoji = getTreeEmoji(tag, progressPct);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      role="button"
      tabIndex={0}
      data-floating-timer="true"
      onClick={e => { e.stopPropagation(); onClick(); }}
      onPointerDown={e => { e.stopPropagation(); }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={cn(
        "flex h-9 w-max max-w-[260px] items-center gap-2 pl-2 pr-2 rounded-2xl border shadow-[0_6px_18px_hsl(var(--foreground)/0.1)] transition-colors text-left cursor-pointer select-none overflow-hidden",
        isPaused && "bg-[hsl(var(--surface-soft))] border-border text-muted-foreground"
      )}
      style={!isPaused ? {
        backgroundColor: colorWithAlpha(treeColor, 0.12),
        borderColor: colorWithAlpha(treeColor, 0.45),
        color: treeColor,
      } : undefined}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 flex-shrink-0 rounded-full",
          isPaused ? "bg-muted-foreground/50" : "animate-pulse"
        )}
        style={!isPaused ? { backgroundColor: treeColor } : undefined}
        aria-hidden
      />
      <span className="text-base leading-none flex-shrink-0">{treeEmoji}</span>
      <span className="min-w-0 max-w-[120px] flex-shrink truncate text-[11px] font-medium leading-none">{todo.title}</span>
      <span
        className="flex-shrink-0 rounded-md px-1.5 py-1 text-[12px] font-mono font-semibold tabular-nums leading-none"
        style={!isPaused ? { backgroundColor: colorWithAlpha(treeColor, 0.16) } : undefined}
      >
        {sessionSec >= 3600
          ? `${Math.floor(sessionSec / 3600)}:${pad(Math.floor((sessionSec % 3600) / 60))}:${pad(sessionSec % 60)}`
          : `${pad(Math.floor(sessionSec / 60))}:${pad(sessionSec % 60)}`}
      </span>
    </div>
  );
}

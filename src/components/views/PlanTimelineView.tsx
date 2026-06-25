import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { parseISO, format, isToday as isTodayFn } from 'date-fns';
import { Clock, Check, X, Plus, CalendarDays, Trash2, ArrowLeft, Pencil, Timer } from 'lucide-react';
import { cn, isImeComposing } from '@/lib/utils';
import { Todo } from '@/hooks/useTodos';
import { Moment } from '@/types';
import { ImportedEvent } from '@/hooks/useImportedEvents';
import { useLanguage } from '@/hooks/useLanguage';
import { useWorkTypes } from '@/hooks/useWorkTypes';
import { WORK_TYPE_META } from '@/lib/workType';
import { getActivityAccentColor } from '@/lib/activityColors';
import {
  PLAN_TIMELINE_WAKE_HOUR as WAKE_HOUR,
  PLAN_TIMELINE_BEDTIME_HOUR as BEDTIME_HOUR,
  PLAN_TIMELINE_BEDTIME_MINUTE as BEDTIME_MINUTE,
  PLAN_TIMELINE_WAKE_TOTAL_MIN as WAKE_TOTAL_MIN,
  PLAN_TIMELINE_BED_TOTAL_MIN as BED_TOTAL_MIN,
} from '@/lib/planTimelineDayBounds';
import {
  DEFAULT_PLAN_TIMELINE_RHYTHM_PRESET_ID,
  getPlanTimelineRhythmPreset,
  presetToNowMarkers,
} from '@/lib/planTimelineRhythmPresets';
import {
  HOUR_HEIGHT,
  NOW_VIEWPORT_ANCHOR,
  PX_PER_MIN,
  DRAG_SNAP_MIN,
  MIN_BLOCK_MIN,
  REST_COLOR,
  SHOW_FREE_TIME_LABELS,
  TIME_RAIL_WIDTH_PX,
  TIMELINE_CANVAS_LIGHT,
  BLOCK_CORNER_PX,
  SLIM_BOTH_OUTER_PX,
  ULTRA_SHORT_OUTER_PX,
  DRAG_UNSCHEDULE_MARGIN_PX,
  MAX_TIMELINE_TITLE_FONT_PX,
  formatGapMinutesLabel,
  TimelineIntervalPill,
  TimelineSpine,
  TimelineSpineBranch,
  SPINE_X_PX,
  hourLabel,
  fmtTime,
  localMinuteToISOString,
  snapMinute,
  getSmartDuration,
  getTagColor,
  softenTagForTimeline,
  deepenWarmTimelineColor,
  adjustTagForDarkMode,
  timelineFillGradient,
  timelineBlockShell,
  getTagIcon,
  assignColumns,
  slotKey,
  slotToMin,
  type TimeBlock,
  type SlotKey,
} from './planTimeline/planTimelinePrimitives';
import { buildPlanBlocks } from './planTimeline/buildPlanBlocks';

interface PlanTimelineViewProps {
  todos: Todo[];
  moments: Moment[];
  importedEvents?: ImportedEvent[];
  date?: string; // yyyy-MM-dd, used to determine if viewing today or a past/future day
  onUpdateTodo: (id: string, updates: Partial<Todo>) => void;
  onAddTodo: (title: string, timeSegment: string) => Promise<any>;
  onDropTodo?: (todoId: string, startMin: number) => void;
  onUnscheduleTodo?: (id: string) => void;
  onDeleteTodo?: (id: string) => void;
  onRenameTodo?: (id: string, title: string) => void;
  onStartTimer?: (todoId: string) => void;
  /** Edit a moment row (focus-session or standalone) shown on the timeline. */
  onUpdateMoment?: (id: string, updates: Partial<Moment>) => void;
  /** Remove a moment row shown on the timeline. */
  onDeleteMoment?: (id: string) => void;
  activeTimerIds?: Set<string>;
  getTimerElapsed?: (todoId: string) => number;
  /** Plan page rhythm picker — shifts “now” marker + stays in sync with Execution chart */
  rhythmPresetId?: string;
}

export function PlanTimelineView({ todos, moments, importedEvents, date, onUpdateTodo, onAddTodo, onDropTodo, onUnscheduleTodo, onDeleteTodo, onRenameTodo, onStartTimer, onUpdateMoment, onDeleteMoment, activeTimerIds, getTimerElapsed, rhythmPresetId }: PlanTimelineViewProps) {
  const { t, lang } = useLanguage();
  const { getWorkType } = useWorkTypes();
  const tOr = useCallback((key: string, fallback: string) => {
    const translated = t(key);
    return !translated || translated === key ? fallback : translated;
  }, [t]);
  const [displayMode, setDisplayMode] = useState<'plan' | 'actual' | 'both'>('both');
  // Determine if we're viewing today or a different date
  const viewingDate = date ? new Date(date + 'T00:00:00') : new Date();
  const isViewingToday = isTodayFn(viewingDate);

  // Track dark mode so we can adapt the (light-mode-tuned) hex tag colors to
  // sit harmoniously on a dark canvas. Watches BOTH the manual `.dark` class
  // toggle and the system color-scheme preference.
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document === 'undefined') return false;
    if (document.documentElement.classList.contains('dark')) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const recompute = () => {
      const hasClass = document.documentElement.classList.contains('dark');
      setIsDarkMode(hasClass || mq.matches);
    };
    recompute();
    mq.addEventListener('change', recompute);
    const observer = new MutationObserver(recompute);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mq.removeEventListener('change', recompute);
      observer.disconnect();
    };
  }, []);

  const rhythmNowMarkers = useMemo(() => {
    const preset = getPlanTimelineRhythmPreset(rhythmPresetId ?? DEFAULT_PLAN_TIMELINE_RHYTHM_PRESET_ID);
    return presetToNowMarkers(preset, isDarkMode);
  }, [rhythmPresetId, isDarkMode]);

  // Use the same accent source as task rows + focus timer. Keep the raw hue here;
  // the block shell already mixes it into the timeline surface.
  const getThemedTagColor = useCallback(
    (tags?: string[], title?: string) => {
      return getActivityAccentColor({ title, tags, isDarkMode });
    },
    [isDarkMode]
  );

  const timelineCanvasBg = isDarkMode ? 'hsl(240 5% 6%)' : TIMELINE_CANVAS_LIGHT;
  const timelineHourLineColor = isDarkMode ? 'hsl(240 4% 100% / 0.12)' : 'rgba(55, 55, 62, 0.10)';
  const timelineHalfHourLineColor = isDarkMode ? 'hsl(240 4% 100% / 0.06)' : 'rgba(55, 55, 62, 0.055)';
  const timelineRailLabelColor = isDarkMode ? 'hsl(240 5% 86% / 0.46)' : 'rgba(75, 75, 80, 0.48)';
  const timelinePastTint = isDarkMode ? 'hsl(240 4% 100% / 0.018)' : 'rgba(15, 23, 42, 0.014)';
  
  const [dragging, setDragging] = useState<{ id: string; target: 'plan' | 'actual' | 'moment'; edge: 'move' | 'top' | 'bottom'; startY: number; startMin: number; origStart: number; origEnd: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ startMin: number; endMin: number } | null>(null);
  const [dragOutside, setDragOutside] = useState(false);
  const [slotAddTitle, setSlotAddTitle] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const slotInputRef = useRef<HTMLInputElement>(null);
  const justDraggedRef = useRef(false);
  // For past/future days, treat the entire day as "past" (nowMin = end of day)
  const [nowMin, setNowMin] = useState(() => {
    if (!isViewingToday) return BED_TOTAL_MIN;
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  const [nowSec, setNowSec] = useState(() => new Date().getSeconds());
  const nowPreciseMin = isViewingToday ? nowMin + nowSec / 60 : nowMin;
  const nowTimeLabel = fmtTime(nowMin);

  const [selectedSlots, setSelectedSlots] = useState<Set<SlotKey>>(new Set());
  const [customRange, setCustomRange] = useState<{ startMin: number; endMin: number } | null>(null);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [slotDragging, setSlotDragging] = useState(false);
  const [slotDragMode, setSlotDragMode] = useState<'select' | 'deselect'>('select');
  const [edgeDragging, setEdgeDragging] = useState<'top' | 'bottom' | null>(null);
  const edgeDragStartY = useRef(0);
  const edgeDragOrigRange = useRef<{ startMin: number; endMin: number } | null>(null);
  const [rangeDragging, setRangeDragging] = useState<{ anchorMin: number } | null>(null);
  const [dropIndicatorMin, setDropIndicatorMin] = useState<number | null>(null);
  const [dragTaskTitle, setDragTaskTitle] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockTitle, setEditingBlockTitle] = useState('');
  const [editingTimeBlockId, setEditingTimeBlockId] = useState<string | null>(null);
  const [editingTimeStart, setEditingTimeStart] = useState('');
  const [editingTimeEnd, setEditingTimeEnd] = useState('');
  const [editingActualBlockId, setEditingActualBlockId] = useState<string | null>(null);
  const [editingActualStart, setEditingActualStart] = useState('');
  const [editingActualEnd, setEditingActualEnd] = useState('');
  const [photoLightbox, setPhotoLightbox] = useState<{ photos: string[]; index: number } | null>(null);
  const restKey = `eol_rest_${date || format(new Date(), 'yyyy-MM-dd')}`;
  const [restStartMin, setRestStartMinState] = useState<number | null>(() => {
    try { const v = localStorage.getItem(`${restKey}_start`); return v !== null ? parseInt(v, 10) : null; } catch { return null; }
  });
  const [restBlocks, setRestBlocksState] = useState<{ id: string; startMin: number; endMin: number }[]>(() => {
    try {
      const v = localStorage.getItem(`${restKey}_blocks`);
      const parsed: { id: string; startMin: number; endMin: number }[] = v ? JSON.parse(v) : [];
      // Discard any auto-close blocks left by a previous buggy version
      return parsed.filter(b => !b.id.startsWith('rest-auto-'));
    } catch { return []; }
  });
  const setRestStartMin = useCallback((val: number | null) => {
    setRestStartMinState(val);
    try { val !== null ? localStorage.setItem(`${restKey}_start`, String(val)) : localStorage.removeItem(`${restKey}_start`); } catch {}
  }, [restKey]);
  const setRestBlocks = useCallback((updater: (prev: { id: string; startMin: number; endMin: number }[]) => { id: string; startMin: number; endMin: number }[]) => {
    setRestBlocksState(prev => {
      const next = updater(prev);
      try { localStorage.setItem(`${restKey}_blocks`, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [restKey]);
  // Track previous key to detect date navigation; skip on initial mount to avoid overwriting live state
  const prevRestKeyRef = useRef(restKey);
  useEffect(() => {
    if (prevRestKeyRef.current === restKey) return;
    prevRestKeyRef.current = restKey;
    try {
      const v = localStorage.getItem(`${restKey}_start`);
      setRestStartMinState(v !== null ? parseInt(v, 10) : null);
    } catch { setRestStartMinState(null); }
    try {
      const v = localStorage.getItem(`${restKey}_blocks`);
      const parsed: { id: string; startMin: number; endMin: number }[] = v ? JSON.parse(v) : [];
      setRestBlocksState(parsed.filter(b => !b.id.startsWith('rest-auto-')));
    } catch { setRestBlocksState([]); }
  }, [restKey]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (isViewingToday) {
      const viewportHeight = containerRef.current.clientHeight || 0;
      const nowTop = minToY(nowMin);
      const scrollTarget = Math.max(0, nowTop - viewportHeight * NOW_VIEWPORT_ANCHOR);
      containerRef.current.scrollTop = scrollTarget;
    } else {
      // For past/future days, scroll to 6 AM
      const sixAmTop = minToY(6 * 60);
      containerRef.current.scrollTop = Math.max(0, sixAmTop);
    }
  }, [isViewingToday]);

  useEffect(() => {
    if (!isViewingToday) {
      setNowMin(BED_TOTAL_MIN);
      return;
    }
    const timer = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
      setNowSec(n.getSeconds());
    }, 1000);
    return () => clearInterval(timer);
  }, [isViewingToday]);

  const planBlocks = useMemo<TimeBlock[]>(
    () => buildPlanBlocks(todos, importedEvents, moments, activeTimerIds, getTimerElapsed),
    [todos, importedEvents, moments, activeTimerIds, getTimerElapsed],
  );

  const positioned = useMemo(() => assignColumns(planBlocks), [planBlocks]);

  const sortedPlanBlocks = useMemo(
    () => [...planBlocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin),
    [planBlocks],
  );
  const lastScheduledEndMin = sortedPlanBlocks.length > 0
    ? sortedPlanBlocks[sortedPlanBlocks.length - 1].endMin
    : null;

  const hours: number[] = [];
  for (let h = WAKE_HOUR; h <= BEDTIME_HOUR; h++) hours.push(h);

  const minToY = useCallback((minute: number) => {
    const m = Math.max(WAKE_TOTAL_MIN, Math.min(minute, BED_TOTAL_MIN));
    return (m - WAKE_TOTAL_MIN) * PX_PER_MIN;
  }, []);

  const yToMin = useCallback((y: number) => {
    return Math.round(WAKE_TOTAL_MIN + y / PX_PER_MIN);
  }, []);

  const totalHeight = minToY(BED_TOTAL_MIN);

  const sessionContinuationMap = useMemo(() => {
    const grouped = new Map<string, Array<{
      id: string;
      startMin: number;
      endMin: number;
    }>>();

    positioned.forEach(({ block }) => {
      if (!block.sessionGroupKey) return;
      const startMin = block.actualStartMin ?? block.startMin;
      const endMin = block.actualEndMin ?? block.endMin;
      if (!grouped.has(block.sessionGroupKey)) grouped.set(block.sessionGroupKey, []);
      grouped.get(block.sessionGroupKey)!.push({ id: block.id, startMin, endMin });
    });

    const map = new Map<string, { downHeight: number; gapMin: number }>();

    grouped.forEach(items => {
      items.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
      for (let i = 0; i < items.length - 1; i += 1) {
        const current = items[i];
        const next = items[i + 1];
        const gapMin = next.startMin - current.endMin;
        if (gapMin <= 0 || gapMin > 240) continue;
        map.set(current.id, {
          downHeight: Math.max(8, minToY(next.startMin) - minToY(current.endMin)),
          gapMin,
        });
      }
    });

    return map;
  }, [positioned, minToY]);

  const remainingTimeStr = useMemo(() => {
    const bedMin = BEDTIME_HOUR * 60 + BEDTIME_MINUTE;
    const diff = Math.max(0, bedMin - nowMin);
    return formatGapMinutesLabel(diff);
  }, [nowMin]);

  const allSlots = useMemo(() => {
    const slots: { key: SlotKey; h: number; half: 0 | 30; startMin: number; endMin: number }[] = [];
    for (let h = WAKE_HOUR; h <= BEDTIME_HOUR; h++) {
      slots.push({ key: slotKey(h, 0), h, half: 0, startMin: h * 60, endMin: h * 60 + 30 });
      if (h < BEDTIME_HOUR || BEDTIME_MINUTE >= 30) {
        slots.push({ key: slotKey(h, 30), h, half: 30, startMin: h * 60 + 30, endMin: h * 60 + 60 });
      }
    }
    return slots;
  }, []);

  const slotRange = useMemo(() => {
    if (selectedSlots.size === 0) return null;
    const sorted = [...selectedSlots].map(k => slotToMin(k)).sort((a, b) => a.start - b.start);
    return { startMin: sorted[0].start, endMin: sorted[sorted.length - 1].end };
  }, [selectedSlots]);

  const selectedRange = customRange ?? slotRange;

  useEffect(() => {
    if (!selectedRange) { setStartInput(''); setEndInput(''); return; }
    setStartInput(fmtTime(selectedRange.startMin));
    setEndInput(fmtTime(selectedRange.endMin));
  }, [selectedRange?.startMin, selectedRange?.endMin]);

  // Auto-focus the creation card input when selection range appears
  // and dismiss on any click outside the creation card
  useEffect(() => {
    if (selectedRange) {
      requestAnimationFrame(() => slotInputRef.current?.focus());
      const handler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-creation-card="true"]') || target.closest('[data-range-handle="true"]')) return;
        setSlotAddTitle('');
        setSelectedSlots(new Set());
        setCustomRange(null);
      };
      // Use setTimeout to avoid immediately dismissing from the same click
      const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
      return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
    }
  }, [!!selectedRange]);

  const clampSelectionRange = useCallback((start: number, end: number) => {
    const safeStart = Math.max(WAKE_TOTAL_MIN, Math.min(start, BED_TOTAL_MIN - 10));
    const safeEnd = Math.max(safeStart + 10, Math.min(end, BED_TOTAL_MIN));
    return { startMin: safeStart, endMin: safeEnd };
  }, []);

  const clientYToMin = useCallback((clientY: number) => {
    if (!containerRef.current) return nowMin;
    const rect = containerRef.current.getBoundingClientRect();
    const yInScrollable = clientY - rect.top + containerRef.current.scrollTop;
    return yToMin(yInScrollable);
  }, [nowMin, yToMin]);

  const getBlockEditTarget = useCallback((block: TimeBlock, mode: 'plan' | 'actual' | 'both', isTimerActive: boolean) => {
    if (block.source !== 'todo') return null;
    const hasPlan = block.planStartMin != null;
    const hasActual = !!block.hasActual;

    if (mode === 'plan') return hasPlan ? 'plan' : null;
    if (mode === 'actual') return hasActual && !isTimerActive ? 'actual' : null;
    if (hasPlan && hasActual) return null;
    if (hasPlan) return 'plan';
    if (hasActual && !isTimerActive) return 'actual';
    return null;
  }, []);

  // Moment blocks carry their real row id behind a `moment-` prefix on the
  // timeline. Strip it so moment edit/delete hooks receive the DB id.
  const parseMomentBlockId = useCallback((blockId: string) =>
    blockId.startsWith('moment-') ? blockId.slice('moment-'.length) : null, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, block: TimeBlock, edge: 'move' | 'top' | 'bottom') => {
    if (block.source === 'imported') return;
    // Moment blocks have a single (actual) span — drag/resize edits that span.
    if (block.source === 'moment') {
      if (!onUpdateMoment) return;
      e.preventDefault();
      e.stopPropagation();
      const startMin = clientYToMin(e.clientY);
      setDragging({ id: block.id, target: 'moment', edge, startY: e.clientY, startMin, origStart: block.startMin, origEnd: block.endMin });
      setDragPreview({ startMin: block.startMin, endMin: block.endMin });
      return;
    }
    const isTimerActive = !!activeTimerIds?.has(block.id);
    const target = getBlockEditTarget(block, displayMode, isTimerActive);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    const startMin = clientYToMin(e.clientY);
    const origStart = target === 'actual'
      ? (block.actualStartMin ?? block.startMin)
      : (block.planStartMin ?? block.startMin);
    const origEnd = target === 'actual'
      ? (block.actualEndMin ?? block.endMin)
      : (block.planEndMin ?? block.endMin);
    setDragging({ id: block.id, target, edge, startY: e.clientY, startMin, origStart, origEnd });
    setDragPreview({ startMin: origStart, endMin: origEnd });
  }, [activeTimerIds, clientYToMin, displayMode, getBlockEditTarget, onUpdateMoment]);

  const isOutsideTimeline = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return false;
    const rect = containerRef.current.getBoundingClientRect();
    return (
      clientX < rect.left - DRAG_UNSCHEDULE_MARGIN_PX ||
      clientX > rect.right + DRAG_UNSCHEDULE_MARGIN_PX ||
      clientY < rect.top - DRAG_UNSCHEDULE_MARGIN_PX ||
      clientY > rect.bottom + DRAG_UNSCHEDULE_MARGIN_PX
    );
  }, []);

  const updateDragPreview = useCallback((clientX: number, clientY: number) => {
    if (rangeDragging) {
      const currentMin = snapMinute(clientYToMin(clientY));
      const start = Math.min(rangeDragging.anchorMin, currentMin);
      const end = Math.max(rangeDragging.anchorMin, currentMin);
      setCustomRange(clampSelectionRange(start, end));
      return;
    }

    if (!dragging) return;

    // Dragging a whole block out of the timeline means "put it back in the list".
    if (dragging.edge === 'move') {
      const isOutside = isOutsideTimeline(clientX, clientY);
      setDragOutside(isOutside);
      if (isOutside) return; // Don't update preview position when outside
    }

    const currentMin = snapMinute(clientYToMin(clientY));

    let newStart = dragging.origStart;
    let newEnd = dragging.origEnd;

    if (dragging.edge === 'move') {
      const delta = currentMin - dragging.startMin;
      newStart = Math.max(WAKE_TOTAL_MIN, dragging.origStart + delta);
      newEnd = newStart + (dragging.origEnd - dragging.origStart);
      if (newEnd > BED_TOTAL_MIN) {
        newEnd = BED_TOTAL_MIN;
        newStart = newEnd - (dragging.origEnd - dragging.origStart);
      }
    } else if (dragging.edge === 'top') {
      const deltaMin = (clientY - dragging.startY) / PX_PER_MIN;
      newStart = Math.max(WAKE_TOTAL_MIN, Math.min(snapMinute(dragging.origStart + deltaMin), dragging.origEnd - MIN_BLOCK_MIN));
    } else {
      const deltaMin = (clientY - dragging.startY) / PX_PER_MIN;
      newEnd = Math.max(dragging.origStart + MIN_BLOCK_MIN, Math.min(snapMinute(dragging.origEnd + deltaMin), BED_TOTAL_MIN));
    }

    setDragPreview({
      startMin: snapMinute(newStart),
      endMin: snapMinute(newEnd),
    });
  }, [dragging, rangeDragging, clientYToMin, clampSelectionRange, isOutsideTimeline]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    updateDragPreview(e.clientX, e.clientY);
  }, [updateDragPreview]);

  const handleMouseUp = useCallback((clientX?: number, clientY?: number) => {
    if (rangeDragging) setRangeDragging(null);

    if (dragging && dragPreview) {
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 0);

      const releasedOutside = dragging.edge === 'move' && clientX != null && clientY != null
        ? isOutsideTimeline(clientX, clientY)
        : dragOutside;

      // If dragged outside the timeline, act on the block being dragged.
      // In Both mode this can still be a plan frame, so don't key this off the visible tab.
      if (releasedOutside) {
        if (dragging.target === 'plan' && onUnscheduleTodo) {
          // Plan frame: move task back to the list.
          onUnscheduleTodo(dragging.id);
        } else if (dragging.target === 'actual') {
          // Actual frame: clear actual time, keep plan.
          onUpdateTodo(dragging.id, {
            timer_started_at: null,
            timer_ended_at: null,
            timer_seconds: null,
            is_completed: false,
          } as any);
        }
      } else {
        const targetDay = date || format(new Date(), 'yyyy-MM-dd');
        const startISO = localMinuteToISOString(targetDay, dragPreview.startMin);
        const endISO = localMinuteToISOString(targetDay, dragPreview.endMin);
        const diffSec = Math.max(0, (dragPreview.endMin - dragPreview.startMin) * 60);

        if (dragging.target === 'moment') {
          const momentId = parseMomentBlockId(dragging.id);
          if (momentId) {
            onUpdateMoment?.(momentId, {
              timer_started_at: startISO,
              timer_ended_at: endISO,
              timer_seconds: diffSec,
            } as Partial<Moment>);
          }
        } else if (dragging.target === 'plan') {
          // 计划模式下调整计划时间
          onUpdateTodo(dragging.id, {
            plan_started_at: startISO,
            plan_ended_at: endISO,
          } as any);
        } else if (dragging.target === 'actual') {
          // 实际模式下视为补记 actual，顺便标记为完成（出现删除线）
          // 但如果当前正在计时，就不要强行写死结束时间
          const isActive = activeTimerIds?.has(dragging.id);
          if (!isActive) {
            onUpdateTodo(dragging.id, {
              timer_started_at: startISO,
              timer_ended_at: endISO,
              timer_seconds: diffSec,
              is_completed: true,
            } as any);
          }
        }
      }
    }
    setDragging(null);
    setDragPreview(null);
    setDragOutside(false);
  }, [dragging, dragPreview, dragOutside, onUpdateTodo, onUnscheduleTodo, rangeDragging, activeTimerIds, displayMode, date, isOutsideTimeline, onUpdateMoment, parseMomentBlockId]);

  const parseHHMM = (value: string): number | null => {
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  };

  const applyManualRange = useCallback(() => {
    if (!selectedRange) return;
    const parsedStart = parseHHMM(startInput);
    const parsedEnd = parseHHMM(endInput);
    if (parsedStart == null || parsedEnd == null) return;
    const clampedStart = Math.max(WAKE_TOTAL_MIN, Math.min(parsedStart, BED_TOTAL_MIN - 10));
    const clampedEnd = Math.max(clampedStart + 10, Math.min(parsedEnd, BED_TOTAL_MIN));
    setCustomRange({ startMin: clampedStart, endMin: clampedEnd });
    const nextSlots = new Set<SlotKey>();
    allSlots.forEach(slot => {
      const overlaps = slot.startMin < clampedEnd && slot.endMin > clampedStart;
      if (overlaps) nextSlots.add(slot.key);
    });
    setSelectedSlots(nextSlots);
  }, [selectedRange, startInput, endInput, allSlots]);

  const handleSaveBlockTime = useCallback((blockId: string) => {
    const parsedStart = parseHHMM(editingTimeStart);
    const parsedEnd = parseHHMM(editingTimeEnd);
    if (parsedStart == null || parsedEnd == null || parsedEnd <= parsedStart) {
      setEditingTimeBlockId(null);
      return;
    }
    const d = date || new Date().toISOString().slice(0, 10);
    const startISO = localMinuteToISOString(d, parsedStart);
    const endISO = localMinuteToISOString(d, parsedEnd);
    const momentId = parseMomentBlockId(blockId);
    if (momentId) {
      // Moments only have an actual span — write it to the timer fields.
      onUpdateMoment?.(momentId, {
        timer_started_at: startISO,
        timer_ended_at: endISO,
        timer_seconds: Math.max(0, (parsedEnd - parsedStart) * 60),
      } as Partial<Moment>);
      setEditingTimeBlockId(null);
      return;
    }
    onUpdateTodo(blockId, { plan_started_at: startISO, plan_ended_at: endISO } as any);
    setEditingTimeBlockId(null);
  }, [editingTimeStart, editingTimeEnd, date, onUpdateTodo, onUpdateMoment, parseMomentBlockId]);

  const handleRestToggle = useCallback(() => {
    if (restStartMin !== null) {
      const endMin = Math.max(restStartMin + 5, nowMin);
      setRestBlocks(prev => [...prev, { id: `rest-${Date.now()}`, startMin: restStartMin, endMin }]);
      setRestStartMin(null);
    } else {
      setRestStartMin(nowMin);
    }
  }, [restStartMin, nowMin]);

  const handleSaveActualTime = useCallback((blockId: string) => {
    const parsedStart = parseHHMM(editingActualStart);
    const parsedEnd = parseHHMM(editingActualEnd);
    if (parsedStart == null || parsedEnd == null || parsedEnd <= parsedStart) {
      setEditingActualBlockId(null);
      return;
    }
    const d = date || new Date().toISOString().slice(0, 10);
    const startISO = localMinuteToISOString(d, parsedStart);
    const endISO = localMinuteToISOString(d, parsedEnd);
    const diffSec = Math.max(0, (parsedEnd - parsedStart) * 60);
    // 在 Actual 模式下手动录入也视为完成一次实际执行
    onUpdateTodo(blockId, { timer_started_at: startISO, timer_ended_at: endISO, timer_seconds: diffSec, is_completed: true } as any);
    setEditingActualBlockId(null);
  }, [editingActualStart, editingActualEnd, date, onUpdateTodo]);

  const handleEdgeDragStart = useCallback((edge: 'top' | 'bottom', e: React.MouseEvent) => {
    if (!selectedRange) return;
    e.preventDefault();
    e.stopPropagation();
    setEdgeDragging(edge);
    edgeDragStartY.current = e.clientY;
    edgeDragOrigRange.current = { ...selectedRange };
  }, [selectedRange]);

  const handleEdgeDragMove = useCallback((e: MouseEvent) => {
    if (!edgeDragging || !edgeDragOrigRange.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const yInScrollable = e.clientY - rect.top + containerRef.current.scrollTop;
    const currentMin = yToMin(yInScrollable);
    const base = edgeDragOrigRange.current;
    let newStartMin = base.startMin;
    let newEndMin = base.endMin;
    if (edgeDragging === 'top') {
      newStartMin = Math.max(WAKE_TOTAL_MIN, Math.min(snapMinute(currentMin), base.endMin - MIN_BLOCK_MIN));
    } else {
      newEndMin = Math.min(BED_TOTAL_MIN, Math.max(snapMinute(currentMin), base.startMin + MIN_BLOCK_MIN));
    }
    setCustomRange({ startMin: newStartMin, endMin: newEndMin });
    const nextSlots = new Set<SlotKey>();
    allSlots.forEach(slot => {
      const overlaps = slot.startMin < newEndMin && slot.endMin > newStartMin;
      if (overlaps) nextSlots.add(slot.key);
    });
    setSelectedSlots(nextSlots);
  }, [edgeDragging, allSlots, yToMin]);

  const handleEdgeDragEnd = useCallback(() => {
    setEdgeDragging(null);
    edgeDragOrigRange.current = null;
  }, []);

  useEffect(() => {
    if (!edgeDragging) return;
    window.addEventListener('mousemove', handleEdgeDragMove);
    window.addEventListener('mouseup', handleEdgeDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleEdgeDragMove);
      window.removeEventListener('mouseup', handleEdgeDragEnd);
    };
  }, [edgeDragging, handleEdgeDragMove, handleEdgeDragEnd]);

  useEffect(() => {
    const handleDragStart = (event: Event) => {
      const customEvent = event as CustomEvent<{ title?: string }>;
      setDragTaskTitle(customEvent.detail?.title || null);
    };
    const handleDragEnd = () => {
      setDragTaskTitle(null);
      setDropIndicatorMin(null);
    };
    window.addEventListener('plan-task-drag-start', handleDragStart as EventListener);
    window.addEventListener('plan-task-drag-end', handleDragEnd);
    return () => {
      window.removeEventListener('plan-task-drag-start', handleDragStart as EventListener);
      window.removeEventListener('plan-task-drag-end', handleDragEnd);
    };
  }, []);

  // Auto-stop rest when a timer starts
  useEffect(() => {
    const handler = () => {
      try {
        const stored = localStorage.getItem(`${restKey}_start`);
        if (stored === null) return;
        const startMin = parseInt(stored, 10);
        if (isNaN(startMin)) return;
        const now = new Date();
        const endMin = Math.max(startMin + 1, now.getHours() * 60 + now.getMinutes());
        setRestBlocks(prev => [...prev, { id: `rest-${Date.now()}`, startMin, endMin }]);
        setRestStartMin(null);
      } catch {}
    };
    window.addEventListener('eol-timer-started', handler);
    return () => window.removeEventListener('eol-timer-started', handler);
  }, [restKey, setRestBlocks, setRestStartMin]);

  // Global mouse listeners for block dragging (so drag-to-unschedule works outside timeline)
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => updateDragPreview(e.clientX, e.clientY);
    const onUp = (e: MouseEvent) => handleMouseUp(e.clientX, e.clientY);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, handleMouseUp, updateDragPreview]);

  // Handle external drag & drop from the task list
  const handleTimelineDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const min = clientYToMin(e.clientY);
    const snapped = snapMinute(min);
    setDropIndicatorMin(snapped);
    const todoId = e.dataTransfer.getData('text/plain');
    if (todoId) setDragTaskId(todoId);
  }, [clientYToMin]);

  const handleTimelineDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const todoId = e.dataTransfer.getData('text/plain');
    if (todoId) {
      const todo = todos.find(t => t.id === todoId);
      const duration = getSmartDuration(todo?.title || '', todo?.tags);
      const min = clientYToMin(e.clientY);
      const snapped = snapMinute(min);
      const clamped = Math.max(WAKE_TOTAL_MIN, Math.min(snapped, BED_TOTAL_MIN - duration));
      // Past slots (before now) → log as done; future slots → schedule as plan
      const logAsDone = displayMode === 'actual' || clamped < nowMin;
      if (logAsDone) {
        const targetDay = date || format(new Date(), 'yyyy-MM-dd');
        const startISO = localMinuteToISOString(targetDay, clamped);
        const endISO = localMinuteToISOString(targetDay, clamped + duration);
        onUpdateTodo(todoId, {
          timer_started_at: startISO,
          timer_ended_at: endISO,
          timer_seconds: duration * 60,
          is_completed: true,
        } as any);
      } else {
        onDropTodo?.(todoId, clamped);
      }
    }
    setDropIndicatorMin(null);
    setDragTaskId(null);
  }, [clientYToMin, date, displayMode, nowMin, onDropTodo, onUpdateTodo, todos]);

  const handleTimelineDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the container entirely
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDropIndicatorMin(null);
      setDragTaskId(null);
    }
  }, []);

  const handleTimelineWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!isViewingToday || e.deltaY >= 0 || !containerRef.current) return;

    const container = containerRef.current;
    const viewportHeight = container.clientHeight || 0;
    const nowAnchorScroll = Math.max(0, minToY(nowMin) - viewportHeight * NOW_VIEWPORT_ANCHOR);
    const resistanceBand = 180;
    const resistanceStart = nowAnchorScroll + resistanceBand;

    // Only add resistance when scrolling upward into / across the "now" area.
    if (container.scrollTop > resistanceStart) return;

    e.preventDefault();

    const distanceIntoBand = Math.max(0, resistanceStart - container.scrollTop);
    const t = Math.min(1, distanceIntoBand / resistanceBand);
    const resistance = container.scrollTop <= nowAnchorScroll
      ? 0.24
      : 0.7 - 0.38 * t;

    container.scrollTop += e.deltaY * resistance;
  }, [isViewingToday, minToY, nowMin]);

  const removeBlockFromTimeline = useCallback((block: TimeBlock) => {
    if (block.source === 'moment') {
      const momentId = parseMomentBlockId(block.id);
      if (momentId) onDeleteMoment?.(momentId);
      return;
    }
    if (block.source !== 'todo') return;

    if (displayMode === 'plan') {
      onUpdateTodo(block.id, { plan_started_at: null, plan_ended_at: null } as any);
      return;
    }

    if (displayMode === 'actual') {
      onUpdateTodo(block.id, {
        timer_started_at: null,
        timer_ended_at: null,
        timer_seconds: 0,
        is_completed: false,
      } as any);
      return;
    }

    onUpdateTodo(block.id, {
      plan_started_at: null,
      plan_ended_at: null,
      timer_started_at: null,
      timer_ended_at: null,
      timer_seconds: 0,
      is_completed: false,
    } as any);
  }, [displayMode, onUpdateTodo, onDeleteMoment, parseMomentBlockId]);

  // Rename either a todo block or a moment block, routing to the right hook.
  const renameBlock = useCallback((block: TimeBlock, title: string) => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === block.title) return;
    const momentId = parseMomentBlockId(block.id);
    if (momentId) {
      onUpdateMoment?.(momentId, { text: trimmed } as Partial<Moment>);
      return;
    }
    onRenameTodo?.(block.id, trimmed);
  }, [onRenameTodo, onUpdateMoment, parseMomentBlockId]);

  const renderBlock = (block: TimeBlock, col: number, totalCols: number) => {
    const isDraggingThis = dragging?.id === block.id;
    const isImported = block.source === 'imported';
    const isMoment = block.source === 'moment';
    const isTodo = block.source === 'todo';
    const isTimerActive = isTodo && activeTimerIds?.has(block.id);
    const blockTodoForTimer = isTodo ? todos.find(td => td.id === block.id) : undefined;
    const showResumeTimerTitle = Boolean(
      blockTodoForTimer &&
      !block.isCompleted &&
      !isTimerActive &&
      (blockTodoForTimer.timer_seconds || 0) > 0 &&
      blockTodoForTimer.timer_ended_at &&
      !blockTodoForTimer.timer_started_at &&
      (blockTodoForTimer.progress ?? 0) > 0 &&
      (blockTodoForTimer.progress ?? 0) < 100
    );
    const editTarget = getBlockEditTarget(block, displayMode, !!isTimerActive);
    const isEditable = !isImported && (isMoment ? !!onUpdateMoment : !!editTarget);
    const isEditingThis = editingBlockId === block.id;
    const showLiveBadge = isTimerActive && !block.isCompleted;
    const tagIcon = getTagIcon(block.tags, block.title);
    const workType = block.source === 'imported'
      ? null
      : getWorkType({
          entity: block.source,
          id: block.id,
          title: block.title,
          tags: block.tags,
        });
    const tagColor = getThemedTagColor(block.tags, block.title);
    const workTypeColor = workType ? WORK_TYPE_META[workType]?.color : undefined;
    const accentPaint = tagColor || workTypeColor || (isImported ? '#8B91A8' : 'hsl(var(--primary))');
    const blockColor = accentPaint;
    /** Solid paint for fills — grid lines stay under blocks */
    const canvasBg = timelineCanvasBg;
    /** Dark: cooler elevated graphite base; warm card tokens made orange tasks turn muddy. */
    const blockFillBase = isDarkMode ? 'hsl(240 5% 15%)' : canvasBg;
    const fillGradVariant = isDarkMode ? ('darkTint' as const) : ('default' as const);
    const shellFor = (intensity: 'plan' | 'actual' | 'active' | 'done' | 'ghost') =>
      timelineBlockShell(isDarkMode, blockFillBase, accentPaint, intensity);
    const colorWithAlpha = (alpha: number) => {
      if (/^#[0-9A-Fa-f]{6}$/.test(accentPaint)) return `${accentPaint}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
      const cssVar = isImported ? '--accent' : '--primary';
      return `hsl(var(${cssVar}) / ${alpha})`;
    };
    const activeColorWithAlpha = (alpha: number) => colorWithAlpha(alpha);
    /** Surface is near-neutral graphite in dark, so the left bar carries the
     * colour identity — keep it bright rather than dimming it. */
    const edgeAlpha = (a: number) => (isDarkMode ? Math.min(1, a * 1.15) : a * 1.08);
    const tintedCard = (strength: number) =>
      /^#[0-9A-Fa-f]{6}$/.test(accentPaint)
        ? `color-mix(in srgb, ${blockFillBase} ${100 - Math.round(strength * 100)}%, ${accentPaint} ${Math.round(strength * 100)}%)`
        : blockFillBase;
    const tintedBorder = (strength: number) =>
      /^#[0-9A-Fa-f]{6}$/.test(accentPaint)
        ? `color-mix(in srgb, hsl(var(--border)) ${100 - Math.round(strength * 100)}%, ${accentPaint} ${Math.round(strength * 100)}%)`
        : `hsl(var(${isImported ? '--accent' : '--primary'}) / 0.35)`;
    const tintedText = (strength: number) =>
      /^#[0-9A-Fa-f]{6}$/.test(accentPaint)
        ? `color-mix(in srgb, hsl(var(--foreground)) ${100 - Math.round(strength * 100)}%, ${accentPaint} ${Math.round(strength * 100)}%)`
        : 'hsl(var(--foreground))';

    // Side-by-side columns for overlapping blocks
    const widthPct = 100 / totalCols;
    const leftPct = col * widthPct;
    const gap = totalCols > 1 ? 6 : 0;
    const timelineWidthPx = containerRef.current?.clientWidth ?? 0;
    const blockWidthPx = timelineWidthPx > 0 ? (timelineWidthPx * widthPct) / 100 - gap : 0;
    const sessionContinuation = sessionContinuationMap.get(block.id);

    // Plan/Actual logic for todo blocks
    const hasPlan = isTodo && block.planStartMin != null;
    const hasActual = isTodo && block.hasActual;
    const isPlanOnly = hasPlan && !hasActual;

    // Live activity must always be visible: a task you're recording right now
    // shouldn't vanish from the timeline just because you're in Plan view.
    if (isTodo && displayMode === 'plan' && !hasPlan && !isTimerActive) {
      return null;
    }

    // For plan-only (no actual started), use plan range for the block
    const planStart = isDraggingThis && dragging?.target === 'plan' && dragPreview
      ? dragPreview.startMin
      : (block.planStartMin ?? block.startMin);
    const planEnd = isDraggingThis && dragging?.target === 'plan' && dragPreview
      ? dragPreview.endMin
      : (block.planEndMin ?? block.endMin);
    const actualStart = isDraggingThis && dragging?.target === 'actual' && dragPreview
      ? dragPreview.startMin
      : (block.actualStartMin ?? block.startMin);
    // While a timer is running the activity is happening *right now*, so the live
    // actual block should always reach the "now" line — never leave a gap below it.
    // We extend to whichever is later: the accumulated focused minutes, or the
    // current wall-clock moment (when viewing today).
    const liveActualEnd = isTimerActive
      ? Math.max(
          actualStart + (getTimerElapsed ? Math.max(1, Math.ceil(getTimerElapsed(block.id) / 60)) : 1),
          isViewingToday ? nowPreciseMin : 0,
        )
      : null;
    const baseActualEnd = isDraggingThis && dragging?.target === 'actual' && dragPreview
      ? dragPreview.endMin
      : (block.actualEndMin ?? block.endMin);
    const actualEnd = Math.max(baseActualEnd, liveActualEnd ?? 0);
    const overlapStart = Math.max(planStart, actualStart);
    const overlapEnd = Math.min(planEnd, actualEnd);
    const overlapLen = Math.max(0, overlapEnd - overlapStart);
    const actualLen = Math.max(1, actualEnd - actualStart);
    const overlapRatio = overlapLen / actualLen;
    const planDurationForChrome = Math.max(1, planEnd - planStart);

    // When plan and actual are nearly identical, we still keep the planned frame visible
    // so "Both" mode remains structurally consistent. Only the extra planned label/connector
    // logic should quiet down in that case.
    const planActualIdentical = hasPlan && hasActual
      && Math.abs((block.planStartMin ?? 0) - (block.actualStartMin ?? 0)) <= 2
      && Math.abs((block.planEndMin ?? 0) - actualEnd) <= 2;
    const showBothMiniState = displayMode === 'both' && hasPlan && hasActual && !planActualIdentical && overlapRatio < 0.72;

    // How far the actual START drifted from the planned start (minutes).
    // Positive = started later than planned, negative = earlier. This is the
    // single most legible "did I follow my plan?" signal, so we surface it as a
    // small labeled chip on the actual block in Both mode.
    const startDeltaMin = hasPlan && hasActual
      ? Math.round((block.actualStartMin ?? 0) - (block.planStartMin ?? 0))
      : 0;
    const fmtDelta = (mins: number) => {
      const a = Math.abs(mins);
      const h = Math.floor(a / 60);
      const m = a % 60;
      return h > 0 ? (m > 0 ? `${h}h${m}m` : `${h}h`) : `${m}m`;
    };
    const showDeviationChip = displayMode === 'both' && hasPlan && hasActual
      && !planActualIdentical && Math.abs(startDeltaMin) >= 5;

    // Determine what to render based on display mode
    const showPlan = hasPlan && (displayMode === 'plan' || displayMode === 'both');
    // A plan-less task that's actively timing still shows its live actual block,
    // even in Plan view — otherwise "what I'm doing now" disappears.
    const showActual = hasActual && (displayMode === 'actual' || displayMode === 'both' || (isTimerActive && !hasPlan));

    // The outer container uses the widest range visible
    let visibleStart = block.startMin;
    let visibleEnd = block.endMin;
    if (displayMode === 'plan' && hasPlan) { visibleStart = planStart; visibleEnd = planEnd; }
    else if (displayMode === 'actual' && hasActual) { visibleStart = actualStart; visibleEnd = actualEnd; }
    else if (displayMode === 'both' && editTarget === 'plan' && !hasActual) { visibleStart = planStart; visibleEnd = planEnd; }
    else if (displayMode === 'both' && editTarget === 'actual' && !hasPlan) { visibleStart = actualStart; visibleEnd = actualEnd; }

    const clampedStart = Math.max(visibleStart, WAKE_TOTAL_MIN);
    const clampedEnd = Math.min(visibleEnd, BED_TOTAL_MIN);
    const rawTop = minToY(clampedStart);
    const rawHeight = Math.max(minToY(clampedEnd) - rawTop, 1);
    /** Keep plan/actual strip heights close to timeline scale (~20m ≈ px) instead of forcing 20px+ */
    const MIN_PLAN_ACT_BOX_PX = 12;
    const planSegH = Math.max(
      minToY(Math.min(planEnd, BED_TOTAL_MIN)) - minToY(Math.max(planStart, WAKE_TOTAL_MIN)),
      MIN_PLAN_ACT_BOX_PX,
    );
    const actSegH = Math.max(
      minToY(Math.min(actualEnd, BED_TOTAL_MIN)) - minToY(Math.max(actualStart, WAKE_TOTAL_MIN)),
      MIN_PLAN_ACT_BOX_PX,
    );
    /** Todo outer shell was min 40px + thick handles; keep short tasks closer to true timeline height */
    const outerMinH = isTodo ? (isEditable ? 23 : 22) : 28;
    const height = Math.max(rawHeight, outerMinH);
    const shouldAnchorCompletedActualToEnd =
      block.isCompleted &&
      hasActual &&
      !isTimerActive &&
      actualEnd <= nowPreciseMin + 0.75 &&
      (displayMode === 'actual' || (displayMode === 'both' && (!hasPlan || visibleEnd <= actualEnd + 0.75)));
    const top = shouldAnchorCompletedActualToEnd && height > rawHeight
      ? Math.max(0, rawTop - (height - rawHeight))
      : rawTop;
    const tallNarrowLayout = blockWidthPx > 0 && blockWidthPx < 145 && height > 120;
    const compactLayout = height < 64 || (blockWidthPx > 0 && blockWidthPx < 170);
    const veryCompactLayout = height < 42 || (blockWidthPx > 0 && blockWidthPx < 120);
    /** Plan dashed top+bottom stripes fight text in squat Both-mode blocks — use single inset outline */
    const slimBothQuietPlanStripe =
      displayMode === 'both' &&
      hasPlan &&
      hasActual &&
      height <= SLIM_BOTH_OUTER_PX &&
      overlapLen >= planDurationForChrome * 0.78;
    const ultraShortOuter = height <= ULTRA_SHORT_OUTER_PX;
    const narrowLayout = blockWidthPx > 0 && blockWidthPx < 150;
    const ultraNarrowLayout = blockWidthPx > 0 && blockWidthPx < 105;
    const largeBlockLayout = !compactLayout && blockWidthPx >= 185 && height >= 110;
    const extraLargeBlockLayout = !compactLayout && blockWidthPx >= 215 && height >= 150;
    const suppressLeadingMeta = narrowLayout || ultraNarrowLayout || blockWidthPx < 175;
    const microLayout = height < 34 || blockWidthPx < 95;
    const slimBarLayout = height < 38 && blockWidthPx >= 120;
    /** Too narrow for any readable title (would render as "U…"); show only color bar + emoji + duration, title on hover */
    const hideTitleTooNarrow = blockWidthPx > 0 && blockWidthPx < 64;
    const titleFontSizePx = microLayout
      ? 11
      : narrowLayout
        ? 13
        : compactLayout
          ? 15
          : extraLargeBlockLayout
            ? 18
            : largeBlockLayout
              ? 17
              : 16;
    const titleFontSize = `${Math.min(titleFontSizePx, MAX_TIMELINE_TITLE_FONT_PX)}px`;
    const timeFontSize = microLayout
      ? '8px'
      : compactLayout
        ? '11px'
        : extraLargeBlockLayout
          ? '14px'
          : largeBlockLayout
            ? '13px'
            : '12px';
    const metaFontSize = microLayout
      ? '7px'
      : extraLargeBlockLayout
        ? '10px'
        : largeBlockLayout
          ? '9px'
          : '8px';
    const pillFontSize = microLayout
      ? '7px'
      : extraLargeBlockLayout
        ? '9px'
        : largeBlockLayout
          ? '8px'
          : '8px';
    /** When plan dashed sits on actual fill, keep interior transparent */
    const planOpaqueBackdrop =
      !(displayMode === 'both' && showPlan && showActual && hasPlan && hasActual);
    const liveGlow = isTimerActive
      ? `0 0 0 1px ${colorWithAlpha(0.16)}, 0 0 0 3px ${colorWithAlpha(0.06)}`
      : undefined;
    const editingGlow = isEditingThis
      ? `0 0 0 1px ${colorWithAlpha(0.22)}, 0 0 0 3px ${colorWithAlpha(0.1)}`
      : undefined;

    // Calculate actual fill percentage (only when timer is active)
    let actualFillPct = 0;
    if (block.isCompleted) {
      actualFillPct = 100;
    } else if (isTimerActive && hasActual) {
      // Use the pause-aware elapsed seconds from PlanView (getCurrentSessionElapsed),
      // not wall-clock minutes, so the fill freezes during rest and resumes after.
      // Falls back to wall-clock if no getTimerElapsed was supplied (shouldn't happen for active timers).
      const elapsedSec = getTimerElapsed ? getTimerElapsed(block.id) : Math.max(0, ((nowMin + nowSec / 60) - actualStart) * 60);
      const elapsedInBlock = Math.max(0, elapsedSec / 60);
      const blockDuration = actualEnd - actualStart;
      actualFillPct = blockDuration > 0 ? Math.min(100, (elapsedInBlock / blockDuration) * 100) : 0;
    }

    // For non-todo blocks, keep original behavior
    if (!isTodo) {
      const isFocusSession = !!block.tags?.includes('focus-session');
      const effectiveStart = block.startMin;
      const effectiveEnd = block.endMin;
      const fillPct = block.isCompleted ? 100 : (nowMin > effectiveStart ? Math.min(100, ((Math.min(nowMin, effectiveEnd) - effectiveStart) / (effectiveEnd - effectiveStart)) * 100) : 0);
      const isInProgress = !block.isCompleted && fillPct > 0 && fillPct < 100;
      const isFuture = !block.isCompleted && fillPct === 0;
      const compactSessionLayout = isFocusSession || height <= 44;
      const eventShell = shellFor((block.isCompleted || isFocusSession) ? 'done' : isFuture ? 'ghost' : 'actual');
      return (
        <div
          key={block.id}
          data-plan-block="true"
          title={hideTitleTooNarrow ? block.title : undefined}
          className={cn(
            "absolute overflow-hidden transition-shadow group/block",
            block.photos?.length ? "cursor-zoom-in" : "cursor-default"
          )}
          onClick={(e) => {
            if (!block.photos?.length) return;
            e.stopPropagation();
            setPhotoLightbox({ photos: block.photos, index: 0 });
          }}
          style={{
            top, height,
            left: `calc(${leftPct}% + ${gap / 2}px)`,
            width: `calc(${widthPct}% - ${gap}px)`,
            zIndex: 10 + col,
            borderRadius: `${BLOCK_CORNER_PX}px`,
            background: eventShell.background,
            borderLeft: `${isDarkMode ? 2 : 3}px solid ${(block.isCompleted || isFocusSession) ? colorWithAlpha(edgeAlpha(0.34)) : isFuture ? colorWithAlpha(edgeAlpha(0.18)) : colorWithAlpha(edgeAlpha(0.38))}`,
            boxShadow: eventShell.shadow,
          }}
        >
          {sessionContinuation && (
            <div
              className="absolute left-1/2 top-full z-[5] -translate-x-1/2 pointer-events-none flex flex-col items-center"
              style={{ height: sessionContinuation.downHeight, width: 48 }}
            >
              <div className="absolute left-1/2 top-0 h-full -translate-x-1/2 border-l border-dashed" style={{ borderColor: colorWithAlpha(0.34) }} />
              {sessionContinuation.downHeight >= 18 && (
                <div className="absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2">
                  <TimelineIntervalPill isDarkMode={isDarkMode}>
                    {(() => {
                      const h = Math.floor(sessionContinuation.gapMin / 60);
                      const m = sessionContinuation.gapMin % 60;
                      return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''} rest` : `${m}m rest`;
                    })()}
                  </TimelineIntervalPill>
                </div>
              )}
            </div>
          )}
          {isInProgress && <div className="absolute top-0 left-0 right-0 pointer-events-none transition-all duration-1000" style={{ height: `${fillPct}%`, backgroundColor: tintedCard(isDarkMode ? 0.1 : 0.075), borderRadius: `${BLOCK_CORNER_PX}px ${BLOCK_CORNER_PX}px 0 0` }} />}
          {compactSessionLayout ? (
            <div className="absolute inset-0 z-10 flex items-center px-3">
              <div className="flex min-w-0 w-full items-center gap-2">
                {block.photos?.[0] && (
                  <img
                    src={block.photos[0]}
                    alt=""
                    className="h-5 w-5 flex-shrink-0 rounded-md border border-background/70 object-cover shadow-sm"
                  />
                )}
                {(block.emoji || tagIcon) && (
                  <span className="flex-shrink-0 leading-none" style={{ fontSize: '13px' }}>
                    {block.emoji || tagIcon}
                  </span>
                )}
                {hideTitleTooNarrow ? (
                  <span className="min-w-0 flex-1" />
                ) : (
                  <span
                    className="min-w-0 flex-1 truncate leading-none"
                    style={{ fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'hsl(0 0% 100% / 0.95)' : 'hsl(var(--foreground))' }}
                  >
                    {block.title}
                  </span>
                )}
                <span
                  className="flex-shrink-0 font-mono tabular-nums leading-none text-muted-foreground/70"
                  style={{ fontSize: '10px' }}
                >
                  {Math.max(1, effectiveEnd - effectiveStart)}m
                </span>
              </div>
            </div>
          ) : (
            <div className="px-2.5 py-1.5 relative z-10">
              <div className="flex items-center gap-1.5 min-w-0">
                {block.photos?.[0] && (
                  <img
                    src={block.photos[0]}
                    alt=""
                    className="h-7 w-7 flex-shrink-0 rounded-lg border border-background/70 object-cover shadow-sm"
                  />
                )}
                {(block.emoji || tagIcon) && <span className="flex-shrink-0" style={{ fontSize: '15px' }}>{block.emoji || tagIcon}</span>}
                {!hideTitleTooNarrow && <span className="truncate" style={{ fontSize: '15px', fontWeight: 600, color: isDarkMode ? 'hsl(0 0% 100% / 0.95)' : 'hsl(var(--foreground))' }}>{block.title}</span>}
              </div>
              {height > 34 && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="font-mono tabular-nums text-muted-foreground/70" style={{ fontSize: '12px' }}>{Math.max(1, effectiveEnd - effectiveStart)}m</span>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // ── Todo block: Plan (dashed) + Actual (solid fill) ──
    return (
      <div
        key={block.id}
        data-plan-block="true"
        title={hideTitleTooNarrow ? block.title : undefined}
        className={cn(
          "absolute overflow-visible transition-shadow group/block",
          isEditable ? "cursor-grab" : "cursor-default",
          isDraggingThis && !dragOutside && "shadow-lg ring-2 ring-primary/40 z-30 opacity-60",
          isDraggingThis && dragOutside && "shadow-lg ring-2 ring-destructive/40 z-30 opacity-30 scale-95 transition-transform",
          isEditingThis && "z-30",
        )}
        style={{
          top, height,
          left: `calc(${leftPct}% + ${gap / 2}px)`,
          width: `calc(${widthPct}% - ${gap}px)`,
          zIndex: isDraggingThis ? 30 : isEditingThis ? 35 : (10 + col),
        }}
        onMouseDown={isEditable && !isEditingThis ? (e) => handleMouseDown(e, block, 'move') : undefined}
      >
        {sessionContinuation && (
          <div
            className="absolute left-1/2 top-full z-[5] -translate-x-1/2 pointer-events-none flex flex-col items-center"
            style={{ height: sessionContinuation.downHeight, width: 48 }}
          >
            <div className="absolute left-1/2 top-0 h-full -translate-x-1/2 border-l border-dashed" style={{ borderColor: colorWithAlpha(0.34) }} />
            {sessionContinuation.downHeight >= 18 && (
              <div className="absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2">
                <TimelineIntervalPill isDarkMode={isDarkMode}>
                  {(() => {
                    const h = Math.floor(sessionContinuation.gapMin / 60);
                    const m = sessionContinuation.gapMin % 60;
                    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''} rest` : `${m}m rest`;
                  })()}
                </TimelineIntervalPill>
              </div>
            )}
          </div>
        )}
        <div
          className="relative h-full overflow-hidden pointer-events-auto"
          style={{
            borderRadius: `${BLOCK_CORNER_PX}px`,
            backgroundColor: 'transparent',
            boxShadow: 'none',
          }}
        >
          {displayMode === 'both' && showPlan && showActual && (() => {
          const overlapMinutes = Math.max(0, Math.min(planEnd, actualEnd) - Math.max(planStart, actualStart));
          if (overlapMinutes > 0) return null;

          const planTop = minToY(Math.max(planStart, WAKE_TOTAL_MIN)) - top;
          const planHeight = planSegH;
          const actTop = minToY(Math.max(actualStart, WAKE_TOTAL_MIN)) - top;
          const actHeight = actSegH;
          const planBottom = planTop + planHeight;
          const actBottom = actTop + actHeight;
          const directionDown = actTop >= planBottom;
          const lineStartY = directionDown ? planBottom : actBottom;
          const lineEndY = directionDown ? actTop : planTop;
          const gapBetween = Math.abs(lineEndY - lineStartY);

          if (gapBetween < 18) return null;

          const lineTop = Math.min(lineStartY, lineEndY);
          const lineHeight = gapBetween;
          const arrowY = directionDown ? lineHeight - 1 : 1;
          const arrowRotation = directionDown ? 180 : 0;

          return (
            <div
              className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-[1]"
              style={{ top: lineTop, height: lineHeight, width: 18 }}
            >
              <svg width="18" height={lineHeight} viewBox={`0 0 18 ${lineHeight}`} className="overflow-visible">
                <line
                  x1="9"
                  y1="3"
                  x2="9"
                  y2={Math.max(3, lineHeight - 3)}
                  stroke={colorWithAlpha(0.42)}
                  strokeWidth="1.5"
                  strokeDasharray="2 3"
                  strokeLinecap="round"
                />
                <path
                  d="M9 0 L13 6 L5 6 Z"
                  fill={colorWithAlpha(0.55)}
                  transform={`translate(0 ${arrowY - 6}) rotate(${arrowRotation} 9 3)`}
                />
              </svg>
            </div>
          );
        })()}

        {/* Plan box (dashed) — empty until the task has actual timer evidence. */}
        {showPlan && (() => {
          const planTop = minToY(Math.max(planStart, WAKE_TOTAL_MIN)) - top;
          const planHeight = planSegH;
          const showPlanMiniLabel = false;
          // Stronger dash on "both" (so the planned boundary reads through the
          // solid actual fill) and on plan-only (so an empty outline doesn't
          // disappear against the canvas).
          const hollowPlanFrame = !showActual;
          const planDashColor = hollowPlanFrame ? colorWithAlpha(isDarkMode ? 0.5 : 0.66) : colorWithAlpha(edgeAlpha(0.28));
          const planDashWidth = hollowPlanFrame ? (isDarkMode ? 2 : 2.25) : (isDarkMode ? 1.25 : 1.5);
          const planDashSegment = hollowPlanFrame ? 12 : 10;
          const planDashGap = hollowPlanFrame ? 8 : 9;
          return (
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: planTop,
                height: planHeight,
                borderRadius: `${BLOCK_CORNER_PX}px`,
                background: hollowPlanFrame ? 'transparent' : planOpaqueBackdrop ? shellFor('plan').background : 'transparent',
                boxShadow: 'none',
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  borderRadius: `${BLOCK_CORNER_PX}px`,
                  ...(slimBothQuietPlanStripe
                    ? {
                      border: `${planDashWidth}px dashed ${planDashColor}`,
                      boxSizing: 'border-box',
                    }
                    : {
                      backgroundImage: [
                        `repeating-linear-gradient(90deg, ${planDashColor} 0 ${planDashSegment}px, transparent ${planDashSegment}px ${planDashSegment + planDashGap}px)`,
                        `repeating-linear-gradient(90deg, ${planDashColor} 0 ${planDashSegment}px, transparent ${planDashSegment}px ${planDashSegment + planDashGap}px)`,
                        `repeating-linear-gradient(180deg, ${planDashColor} 0 ${planDashSegment}px, transparent ${planDashSegment}px ${planDashSegment + planDashGap}px)`,
                        `repeating-linear-gradient(180deg, ${planDashColor} 0 ${planDashSegment}px, transparent ${planDashSegment}px ${planDashSegment + planDashGap}px)`,
                      ].join(', '),
                      backgroundPosition: 'left top, left bottom, left top, right top',
                      backgroundSize: `100% ${planDashWidth}px, 100% ${planDashWidth}px, ${planDashWidth}px 100%, ${planDashWidth}px 100%`,
                      backgroundRepeat: 'no-repeat',
                    }),
                }}
              />
              {showPlanMiniLabel && (
                <div
                  className="absolute left-3 top-3 rounded-full bg-background/90 px-2 py-[2px] font-semibold uppercase tracking-[0.06em] shadow-sm"
                  style={{ fontSize: pillFontSize, color: colorWithAlpha(0.7) }}
                >
                  PLAN
                </div>
              )}
            </div>
          );
        })()}

        {/* Actual box (solid fill) — only when pomodoro has been started */}
        {showActual && (() => {
          const actTop = minToY(Math.max(actualStart, WAKE_TOTAL_MIN)) - top;
          const actHeight = actSegH;
          const showTitleInActual = false;
          // Suppress mini labels when plan/done bars will render in content (avoids double "done" overlap)
          const willShowPlanActualBars = displayMode === 'both' && hasPlan && hasActual && block.isCompleted && height > 80 && blockWidthPx >= 160;
          const showActualMiniLabel = false;
          const showCompactActualMiniLabel = false;
          const actualShell = shellFor(block.isCompleted ? 'done' : isTimerActive ? 'active' : 'actual');
          const actualBorderColor = isTimerActive
            ? activeColorWithAlpha(edgeAlpha(0.38))
            : block.isCompleted
              ? colorWithAlpha(edgeAlpha(0.24))
              : colorWithAlpha(edgeAlpha(0.28));
          return (
            <div
              className="absolute left-0 right-0"
              style={{
                top: actTop,
                height: actHeight,
                borderRadius: `${BLOCK_CORNER_PX}px`,
                background: actualShell.background,
                borderLeft: `${isDarkMode ? 2 : 3}px solid ${actualBorderColor}`,
                boxShadow: block.isCompleted
                  ? actualShell.shadow
                  : editingGlow || liveGlow || actualShell.shadow,
              }}
            >
              {/* Actual fill overlay */}
              {actualFillPct > 0 && !block.isCompleted && (
                <div
                  className="absolute top-0 left-0 right-0 pointer-events-none transition-all duration-1000"
                  style={{
                    height: `${actualFillPct}%`,
                    background: timelineFillGradient(isDarkMode, blockFillBase, accentPaint, 0.11, 0.07, 0.045, fillGradVariant),
                    borderRadius: `${BLOCK_CORNER_PX}px ${BLOCK_CORNER_PX}px 0 0`,
                  }}
                />
              )}
              {/* Plan-deviation chip — how far the actual start drifted from plan.
                  The clearest "did I stick to my plan?" signal in Both mode. */}
              {showDeviationChip && actHeight >= 18 && blockWidthPx >= 88 && (
                <div
                  className="absolute right-1 top-1 z-20 flex items-center gap-[2px] rounded-full px-1.5 py-[1px] font-semibold leading-none pointer-events-none whitespace-nowrap"
                  style={{
                    fontSize: extraLargeBlockLayout ? '11px' : '10px',
                    color: colorWithAlpha(isDarkMode ? 0.95 : 0.82),
                    background: isDarkMode ? 'hsl(240 6% 9% / 0.72)' : 'hsl(0 0% 100% / 0.86)',
                    boxShadow: `inset 0 0 0 1px ${colorWithAlpha(0.28)}`,
                    backdropFilter: 'blur(2px)',
                  }}
                  title={lang === 'zh'
                    ? `实际比计划${startDeltaMin > 0 ? '晚' : '早'}开始 ${fmtDelta(startDeltaMin)}`
                    : `Started ${fmtDelta(startDeltaMin)} ${startDeltaMin > 0 ? 'later' : 'earlier'} than planned`}
                >
                  <span style={{ fontSize: '0.95em', lineHeight: 1 }}>{startDeltaMin > 0 ? '↓' : '↑'}</span>
                  {lang === 'zh'
                    ? `${startDeltaMin > 0 ? '晚' : '早'}${fmtDelta(startDeltaMin)}`
                    : `${fmtDelta(startDeltaMin)} ${startDeltaMin > 0 ? 'late' : 'early'}`}
                </div>
              )}
              {isTimerActive && (
                <>
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      borderRadius: `${BLOCK_CORNER_PX}px`,
                    }}
                  />
                </>
              )}
              {/* Show title inside actual block when it's far from plan */}
              {showTitleInActual && actHeight > 20 && (
                <div className="px-2 py-1 relative z-10">
                  <div className="flex items-center gap-1 min-w-0">
                    {(block.emoji || tagIcon) && <span className="flex-shrink-0" style={{ fontSize: '12px' }}>{block.emoji || tagIcon}</span>}
                    <span className="truncate" style={{ fontSize: '12px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                      {block.title}
                    </span>
                  </div>
                </div>
              )}
              {showActualMiniLabel && (
                <div
                  className="absolute left-2 bottom-2 rounded-full bg-background/88 px-1.5 py-[1px] font-medium uppercase tracking-[0.06em] shadow-sm"
                  style={{ fontSize: pillFontSize }}
                >
                  {isTimerActive ? 'doing' : block.isCompleted ? 'done' : 'actual'}
                </div>
              )}
              {showCompactActualMiniLabel && (
                <div
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-medium leading-none uppercase tracking-[0.05em]"
                  style={{ color: blockColor, fontSize: microLayout ? '9px' : slimBarLayout ? '10px' : '11px' }}
                >
                  done
                </div>
              )}
            </div>
          );
        })()}


        {/* Resize handles — z-[15] puts them above the content area (z-10) so they actually receive mousedown events */}
        {isEditable && !isEditingThis && (() => {
          const ultraSlimHandles = ultraShortOuter;
          const slimResize = height <= 38 && !ultraSlimHandles;
          const midResize = !slimResize && height <= 50;
          return (
          <>
            <div
              className={cn(
                'absolute top-0 left-0 right-0 cursor-n-resize flex items-start justify-center z-[15]',
                ultraSlimHandles ? '-top-1 h-3 pt-1' : slimResize ? '-top-1 h-4 pt-1' : midResize ? 'h-5 pt-1' : 'h-7 pt-1.5',
              )}
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, block, 'top'); }}
            >
              <div
                className={cn(
                  'rounded-full opacity-0 group-hover/block:opacity-70 transition-opacity',
                  ultraSlimHandles ? 'w-8 h-[2px]' : slimResize ? 'w-6 h-[2px]' : 'w-8 h-[3px]',
                )}
                style={{ backgroundColor: colorWithAlpha(edgeAlpha(isPlanOnly ? 0.34 : 0.28)) }}
              />
            </div>
            <div
              className={cn(
                'absolute bottom-0 left-0 right-0 cursor-s-resize flex items-end justify-center z-[15]',
                ultraSlimHandles ? '-bottom-1 h-3 pb-1' : slimResize ? '-bottom-1 h-4 pb-1' : midResize ? 'h-5 pb-1' : 'h-7 pb-1.5',
              )}
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, block, 'bottom'); }}
            >
              <div
                className={cn(
                  'rounded-full opacity-0 group-hover/block:opacity-70 transition-opacity',
                  ultraSlimHandles ? 'w-8 h-[2px]' : slimResize ? 'w-6 h-[2px]' : 'w-8 h-[3px]',
                )}
                style={{ backgroundColor: colorWithAlpha(edgeAlpha(isPlanOnly ? 0.34 : 0.28)) }}
              />
            </div>
          </>
          );
        })()}

        {/* Action buttons on hover */}
        {!isEditingThis && (
          <div
            className={cn(
              "absolute opacity-0 group-hover/block:opacity-100 flex items-center gap-1 z-30 rounded-md px-1 py-0.5 bg-card/90 shadow-sm ring-1 ring-border/50 backdrop-blur-sm",
              veryCompactLayout ? "-top-8 right-0" : "top-1 right-1"
            )}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {!block.isCompleted && onStartTimer && (
              <button
                onClick={() => onStartTimer(block.id)}
                className={cn("p-1.5 rounded-lg transition-colors", isTimerActive ? "text-primary bg-primary/20" : "hover:bg-primary/20 text-muted-foreground hover:text-primary")}
                title={
                  isTimerActive
                    ? (lang === 'zh' ? '计时进行中' : 'Timer running')
                    : showResumeTimerTitle
                      ? t('plan.resumeTimer')
                      : t('plan.startFocusTimer')
                }
              >
                <Timer size={14} />
              </button>
            )}
            <button
              onClick={() => {
                if (displayMode === 'actual' && hasActual && !isTimerActive) {
                  setEditingActualBlockId(block.id);
                  setEditingActualStart(fmtTime(actualStart));
                  setEditingActualEnd(fmtTime(actualEnd));
                  return;
                }
                if (veryCompactLayout || microLayout) {
                  setEditingTimeBlockId(block.id);
                  setEditingTimeStart(fmtTime(planStart));
                  setEditingTimeEnd(fmtTime(planEnd));
                  return;
                }
                setEditingBlockId(block.id);
                setEditingBlockTitle(block.title);
                setEditingTimeStart(fmtTime(planStart));
                setEditingTimeEnd(fmtTime(planEnd));
              }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            {displayMode === 'plan' && onUnscheduleTodo && !block.isCompleted && (
              <button onClick={() => onUnscheduleTodo(block.id)} className="p-1 rounded text-muted-foreground hover:text-accent-foreground transition-colors" title="Move back to list"><ArrowLeft size={12} /></button>
            )}
            {block.source === 'todo' && (
              <button
                onClick={() => removeBlockFromTimeline(block)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"
                title={displayMode === 'plan' ? 'Remove from timeline' : displayMode === 'actual' ? 'Clear actual time' : 'Remove from timeline'}
              >
                <Trash2 size={14} />
              </button>
            )}
            {block.source === 'moment' && onDeleteMoment && (
              <button
                onClick={() => removeBlockFromTimeline(block)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive"
                title={lang === 'zh' ? '删除' : 'Delete'}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        {editingTimeBlockId === block.id && veryCompactLayout && (
          <div
            className="absolute right-0 top-full z-40 mt-1 flex items-center gap-1 rounded-xl border border-border/60 bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur-sm"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <input
              autoFocus
              value={editingTimeStart}
              onChange={e => setEditingTimeStart(e.target.value)}
              className="w-[54px] rounded-md bg-secondary/80 px-1 py-0.5 text-center font-mono text-[11px] tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="HH:MM"
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveBlockTime(block.id);
                if (e.key === 'Escape') setEditingTimeBlockId(null);
              }}
            />
            <span className="text-[10px] text-muted-foreground/55">→</span>
            <input
              value={editingTimeEnd}
              onChange={e => setEditingTimeEnd(e.target.value)}
              className="w-[54px] rounded-md bg-secondary/80 px-1 py-0.5 text-center font-mono text-[11px] tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="HH:MM"
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveBlockTime(block.id);
                if (e.key === 'Escape') setEditingTimeBlockId(null);
              }}
              onBlur={() => handleSaveBlockTime(block.id)}
            />
          </div>
        )}

        {editingActualBlockId === block.id && veryCompactLayout && (
          <div
            className="absolute right-0 top-full z-40 mt-1 flex items-center gap-1 rounded-xl border border-border/60 bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur-sm"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <input
              autoFocus
              value={editingActualStart}
              onChange={e => setEditingActualStart(e.target.value)}
              className="w-[54px] rounded-md bg-secondary/80 px-1 py-0.5 text-center font-mono text-[11px] tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="HH:MM"
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveActualTime(block.id);
                if (e.key === 'Escape') setEditingActualBlockId(null);
              }}
            />
            <span className="text-[10px] text-muted-foreground/55">→</span>
            <input
              value={editingActualEnd}
              onChange={e => setEditingActualEnd(e.target.value)}
              className="w-[54px] rounded-md bg-secondary/80 px-1 py-0.5 text-center font-mono text-[11px] tabular-nums focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="HH:MM"
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveActualTime(block.id);
                if (e.key === 'Escape') setEditingActualBlockId(null);
              }}
              onBlur={() => handleSaveActualTime(block.id)}
            />
          </div>
        )}

        {/* Content area — anchored to the primary (actual or plan) block, not always y=0 */}
        {(() => {
          const planTopOffset = showPlan ? Math.max(0, minToY(Math.max(planStart, WAKE_TOTAL_MIN)) - top) : 0;
          const actTopOffset = showActual ? Math.max(0, minToY(Math.max(actualStart, WAKE_TOTAL_MIN)) - top) : 0;
          const contentTopOffset = showActual ? actTopOffset : planTopOffset;
          const planBoxH = showPlan ? planSegH : 0;
          const actBoxH = showActual ? actSegH : 0;
          const contentHeight = showActual ? actBoxH : showPlan ? planBoxH : height;
          /** Outer shell is inflated (outerMinH) but title sat in thin act Seg band — vertically center across full pill */
          const compactContentFullShell = veryCompactLayout && contentHeight > 0 && contentHeight <= height - 4;
          return (
        <div
          className={cn(
            "absolute left-0 right-0 z-10 overflow-hidden",
            veryCompactLayout ? "px-0 py-0" : "px-3.5 py-2.5 flex flex-col justify-center",
            tallNarrowLayout && !veryCompactLayout && "items-center text-center"
          )}
          style={{
            top: compactContentFullShell ? 0 : contentTopOffset,
            height: compactContentFullShell ? height : contentHeight,
          }}
        >
          {(() => {
            const timeStr = `${fmtTime(planStart)} → ${fmtTime(planEnd)}`;
            const planDurationMin = planEnd - planStart;
            const durationStr = (() => { const h = Math.floor(planDurationMin / 60); const m = planDurationMin % 60; return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`; })();
            const actualDurationMin = hasActual ? Math.max(0, actualEnd - actualStart) : 0;
            const actualDurationStr = (() => {
              const h = Math.floor(actualDurationMin / 60);
              const m = actualDurationMin % 60;
              return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
            })();
            const showCombinedBothMeta = displayMode === 'both' && hasPlan && hasActual;
            const allowWrappedTitle = !narrowLayout && !microLayout && !tallNarrowLayout && height >= 70 && blockWidthPx >= 160;
            const stackTimeMeta =
              compactLayout || narrowLayout || tallNarrowLayout || showCombinedBothMeta;
            /** Planned / Both(plan-only strip): subtitles. Doing view: omit — block geometry is enough */
            const showPlanRowTime =
              displayMode !== 'actual' &&
              !showCombinedBothMeta &&
              (displayMode === 'both' ? hasPlan : displayMode === 'plan');
            /** Compact strip: prefer actual duration in Doing mode */
            const compactDurationLabel =
              displayMode === 'actual' && hasActual ? actualDurationStr : durationStr;
            const hideElapsedWhileTiming = isTimerActive && !block.isCompleted;
            const maxDurMin = Math.max(planDurationMin, actualDurationMin);
            const planBarPct = maxDurMin > 0 ? (planDurationMin / maxDurMin) * 100 : 100;
            const actualBarPct = maxDurMin > 0 ? (actualDurationMin / maxDurMin) * 100 : 100;
            const overrunMin = actualDurationMin - planDurationMin;
            const showPlanActualBars = false;
            return (
              <>
                {isEditingThis ? (
                  <div
                    className="flex flex-col gap-1.5 min-w-0"
                    onMouseDown={e => e.stopPropagation()}
                    onBlur={(e) => {
                      if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
                      if (editingBlockTitle.trim() && editingBlockTitle.trim() !== block.title) {
                        renameBlock(block, editingBlockTitle);
                      }
                      handleSaveBlockTime(block.id);
                      setEditingBlockId(null);
                    }}
                  >
                    <input
                      autoFocus
                      value={editingBlockTitle}
                      onChange={e => setEditingBlockTitle(e.target.value)}
                      onKeyDown={e => {
                        const nev = e.nativeEvent as KeyboardEvent;
                        if (e.key === 'Enter' && !isImeComposing(nev) && editingBlockTitle.trim()) {
                          renameBlock(block, editingBlockTitle);
                          handleSaveBlockTime(block.id);
                          setEditingBlockId(null);
                        }
                        if (e.key === 'Escape') setEditingBlockId(null);
                      }}
                      className="flex-1 min-w-0 bg-transparent font-medium focus:outline-none"
                      style={{ fontSize: titleFontSize, borderBottom: `1px solid ${colorWithAlpha(0.25)}` }}
                    />
                    {!microLayout && !ultraNarrowLayout && (
                      <div className="flex items-center gap-1">
                        <input
                          value={editingTimeStart}
                          onChange={e => setEditingTimeStart(e.target.value)}
                          className="w-[48px] font-mono tabular-nums bg-muted/20 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-primary/30"
                          style={{ fontSize: '11px' }}
                          placeholder="HH:MM"
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveBlockTime(block.id); if (e.key === 'Escape') setEditingBlockId(null); }}
                        />
                        <span className="text-muted-foreground/50" style={{ fontSize: '10px' }}>→</span>
                        <input
                          value={editingTimeEnd}
                          onChange={e => setEditingTimeEnd(e.target.value)}
                          className="w-[48px] font-mono tabular-nums bg-muted/20 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-primary/30"
                          style={{ fontSize: '11px' }}
                          placeholder="HH:MM"
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveBlockTime(block.id); if (e.key === 'Escape') setEditingBlockId(null); }}
                        />
                      </div>
                    )}
                  </div>
                ) : veryCompactLayout ? (
                  /* Very compact pills — flex-centered so text sits mid-block, not at top edge */
                  <div className="absolute inset-x-0 inset-y-0 flex items-center">
                    <div
                      className={cn(
                        'flex min-w-0 w-full items-center',
                        ultraShortOuter ? 'gap-1 px-2' : 'gap-[6px] px-[14px]',
                      )}
                    >
                    {!ultraNarrowLayout && (block.emoji || tagIcon) && (
                      <span
                        className={cn(
                          'inline-flex flex-shrink-0 items-center justify-center leading-none',
                          ultraShortOuter ? 'h-3 min-w-[10px] text-[11px]' : 'h-3.5 w-3.5 text-[13px]',
                        )}
                        style={{ margin: 0, lineHeight: 1, opacity: block.isCompleted ? 0.5 : 1 }}
                      >
                        {block.emoji || tagIcon}
                      </span>
                    )}
                    <span
                      className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap leading-tight"
                      style={{
                        fontSize: ultraShortOuter ? '9.5px' : microLayout ? '10px' : ultraNarrowLayout ? '11px' : '12px',
                        fontWeight: 500,
                        lineHeight: 1.08,
                        margin: 0,
                        color: block.isCompleted ? tintedText(0.12) : isPlanOnly ? tintedText(0.45) : 'hsl(var(--foreground))',
                      }}
                    >
                      {hideTitleTooNarrow ? '' : block.title}
                    </span>
                    {!hideElapsedWhileTiming && !narrowLayout && blockWidthPx >= 280 && compactDurationLabel.length <= 10 && (
                      <span
                        className="flex-shrink-0 font-mono tabular-nums text-muted-foreground/60 leading-none"
                        style={{ fontSize: '10px', fontWeight: 500, lineHeight: 1, margin: 0 }}
                      >
                        {compactDurationLabel}
                      </span>
                    )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={cn("flex items-center gap-1.5 min-w-0", tallNarrowLayout && "w-full justify-center")}>
                      {!suppressLeadingMeta && (block.emoji || tagIcon) && (
                        <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center leading-none"
                          style={{ fontSize: compactLayout ? '13px' : '14px', opacity: block.isCompleted ? 0.5 : 1 }}>
                          {block.emoji || tagIcon}
                        </span>
                      )}
                      {!suppressLeadingMeta && showLiveBadge && (
                        <span className="flex-shrink-0 h-2 w-2 rounded-full" style={{ backgroundColor: blockColor }} />
                      )}
                      {!suppressLeadingMeta && isPlanOnly && !block.isCompleted && (
                        <span
                          className="flex-shrink-0 rounded bg-background/85 px-1.5 py-0.5 font-semibold tracking-[0.04em]"
                          style={{ fontSize: metaFontSize, color: colorWithAlpha(isDarkMode ? 0.82 : 0.76) }}
                        >
                          PLAN
                        </span>
                      )}
                      <span className={cn("min-w-0 overflow-hidden text-ellipsis leading-[1.2]", tallNarrowLayout ? "text-center" : "flex-1")} style={{
                        fontSize: titleFontSize,
                        fontWeight: 500,
                        display: allowWrappedTitle ? '-webkit-box' : 'block',
                        WebkitLineClamp: allowWrappedTitle ? 2 : 'unset',
                        WebkitBoxOrient: allowWrappedTitle ? 'vertical' : 'unset',
                        whiteSpace: allowWrappedTitle ? 'normal' : 'nowrap',
                        color: block.isCompleted ? tintedText(0.12) : isPlanOnly ? (isDarkMode ? 'hsl(0 0% 100% / 0.9)' : tintedText(0.48)) : 'hsl(var(--foreground))',
                      }}>{hideTitleTooNarrow ? '' : block.title}</span>
                    </div>
                    {editingTimeBlockId === block.id && (
                      <div className={cn("mt-0.5 gap-1", narrowLayout ? "flex flex-col items-center" : "flex items-center flex-wrap")} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={editingTimeStart}
                          onChange={e => setEditingTimeStart(e.target.value)}
                          className="w-[52px] font-mono tabular-nums bg-secondary/90 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-2 focus:ring-primary/35"
                          style={{ fontSize: compactLayout ? '11px' : '13px' }}
                          placeholder="HH:MM"
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveBlockTime(block.id);
                            if (e.key === 'Escape') setEditingTimeBlockId(null);
                          }}
                        />
                        <span className="text-muted-foreground/50" style={{ fontSize: '10px' }}>{narrowLayout ? '↓' : '→'}</span>
                        <input
                          value={editingTimeEnd}
                          onChange={e => setEditingTimeEnd(e.target.value)}
                          className="w-[52px] font-mono tabular-nums bg-secondary/90 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-2 focus:ring-primary/35"
                          style={{ fontSize: compactLayout ? '11px' : '13px' }}
                          placeholder="HH:MM"
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveBlockTime(block.id);
                            if (e.key === 'Escape') setEditingTimeBlockId(null);
                          }}
                          onBlur={() => handleSaveBlockTime(block.id)}
                        />
                      </div>
                    )}
                    {editingTimeBlockId !== block.id && !ultraNarrowLayout && (
                      <div className={cn(
                        "mt-0.5",
                        stackTimeMeta ? "flex flex-col gap-0.5" : "flex items-center gap-1 flex-wrap",
                        tallNarrowLayout ? "items-center text-center" : stackTimeMeta ? "items-start" : ""
                      )}>
                        {/* Plan subtitle — Planned tab, or Both when this block is plan-only */}
                        {showPlanRowTime &&
                          (displayMode === 'plan' ? (
                          <button
                            className="max-w-full whitespace-nowrap font-mono tabular-nums leading-none text-muted-foreground/70 hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-none p-0"
                            style={{ fontSize: timeFontSize, fontWeight: 500 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTimeBlockId(block.id);
                              setEditingTimeStart(fmtTime(planStart));
                              setEditingTimeEnd(fmtTime(planEnd));
                            }}
                            onMouseDown={e => e.stopPropagation()}
                          >
                            {narrowLayout ? durationStr : timeStr}
                          </button>
                        ) : (
                          <span
                            className="max-w-full whitespace-nowrap font-mono tabular-nums leading-none text-muted-foreground/70"
                            style={{ fontSize: timeFontSize, fontWeight: 500 }}
                          >
                            {narrowLayout ? durationStr : timeStr}
                          </span>
                        ))}
                        {hasActual && displayMode === 'actual' && editingActualBlockId === block.id && (
                          <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                            <span style={{ fontSize: timeFontSize, color: blockColor }}>(</span>
                            <input
                              autoFocus
                              value={editingActualStart}
                              onChange={e => setEditingActualStart(e.target.value)}
                              className="w-[52px] font-mono tabular-nums bg-secondary rounded px-1 py-0 text-center focus:outline-none focus:ring-1 focus:ring-primary/40"
                              style={{ fontSize: compactLayout ? '11px' : '13px' }}
                              placeholder="HH:MM"
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveActualTime(block.id);
                                if (e.key === 'Escape') setEditingActualBlockId(null);
                              }}
                            />
                            <span className="text-muted-foreground/50" style={{ fontSize: '10px' }}>→</span>
                            <input
                              value={editingActualEnd}
                              onChange={e => setEditingActualEnd(e.target.value)}
                              className="w-[52px] font-mono tabular-nums bg-secondary rounded px-1 py-0 text-center focus:outline-none focus:ring-1 focus:ring-primary/40"
                              style={{ fontSize: compactLayout ? '11px' : '13px' }}
                              placeholder="HH:MM"
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveActualTime(block.id);
                                if (e.key === 'Escape') setEditingActualBlockId(null);
                              }}
                              onBlur={() => handleSaveActualTime(block.id)}
                            />
                            <span style={{ fontSize: timeFontSize, color: blockColor }}>)</span>
                          </div>
                        )}
                        {/* "Xm doing/done" — only show for completed blocks */}
                        {showCombinedBothMeta && block.isCompleted && (showPlanActualBars ? (
                          <div className="mt-1.5 space-y-[4px]" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground/50 flex-shrink-0 font-mono" style={{ fontSize: '9px', minWidth: '22px' }}>plan</span>
                              <div className="flex-1 h-[4px] rounded-full bg-muted/30 overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${planBarPct}%`, backgroundColor: colorWithAlpha(0.35) }} />
                              </div>
                              <span className="text-muted-foreground/55 font-mono flex-shrink-0" style={{ fontSize: '9px', minWidth: '28px', textAlign: 'right' }}>{durationStr}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="flex-shrink-0 font-mono" style={{ fontSize: '9px', color: blockColor, minWidth: '22px' }}>done</span>
                              <div className="flex-1 h-[4px] rounded-full bg-muted/30 overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${actualBarPct}%`, backgroundColor: blockColor }} />
                              </div>
                              <span className="font-mono flex-shrink-0" style={{ fontSize: '9px', color: blockColor, minWidth: '28px', textAlign: 'right' }}>
                                {actualDurationStr}{Math.abs(overrunMin) >= 3 ? ` ${overrunMin > 0 ? '+' : ''}${overrunMin}m` : ''}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 whitespace-nowrap leading-none rounded-full px-1.5 py-[3px] font-medium"
                            style={{ fontSize: '10px', backgroundColor: colorWithAlpha(0.12), color: blockColor }}
                          >
                            {block.isCompleted && <span style={{ fontSize: '9px' }}>✓</span>}
                            {actualDurationStr}
                          </span>
                        ))}
                        {!hasActual && isTodo && displayMode === 'actual' && (
                          editingActualBlockId === block.id ? (
                            <div className="flex items-center gap-1" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                              <input
                                autoFocus
                                value={editingActualStart}
                                onChange={e => setEditingActualStart(e.target.value)}
                                className="w-[52px] font-mono tabular-nums bg-secondary rounded px-1 py-0 text-center focus:outline-none focus:ring-1 focus:ring-primary/40"
                                style={{ fontSize: compactLayout ? '10px' : '12px' }}
                                placeholder="HH:MM"
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveActualTime(block.id);
                                  if (e.key === 'Escape') setEditingActualBlockId(null);
                                }}
                              />
                              <span className="text-muted-foreground/50" style={{ fontSize: '10px' }}>→</span>
                              <input
                                value={editingActualEnd}
                                onChange={e => setEditingActualEnd(e.target.value)}
                                className="w-[52px] font-mono tabular-nums bg-secondary rounded px-1 py-0 text-center focus:outline-none focus:ring-1 focus:ring-primary/40"
                                style={{ fontSize: compactLayout ? '10px' : '12px' }}
                                placeholder="HH:MM"
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveActualTime(block.id);
                                  if (e.key === 'Escape') setEditingActualBlockId(null);
                                }}
                                onBlur={() => handleSaveActualTime(block.id)}
                              />
                            </div>
                          ) : (
                            <button
                              className="text-muted-foreground/40 hover:text-primary transition-colors bg-transparent border-none p-0 cursor-pointer"
                              style={{ fontSize: compactLayout ? '10px' : largeBlockLayout ? '12px' : '11px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingActualBlockId(block.id);
                                setEditingActualStart(fmtTime(planStart));
                                setEditingActualEnd(fmtTime(planEnd));
                              }}
                              onMouseDown={e => e.stopPropagation()}
                            >
                              {block.isCompleted ? '✎ actual time' : '+ doing'}
                            </button>
                          )
                        )}
                        {!hideElapsedWhileTiming && !compactLayout && !microLayout && !hasActual && !showCombinedBothMeta && (
                          <span
                            className="whitespace-nowrap leading-none text-muted-foreground/60"
                            style={{ fontSize: timeFontSize }}
                          >
                            {displayMode === 'actual' ? `Not started` : durationStr}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
                {/* Progress bar — only show if user explicitly set a progress value */}
                {block.isCompleted && height > 48 && !isEditingThis && block.progress != null && block.progress > 0 && block.progress < 100 && (
                  <div className="flex items-center gap-1 mt-1" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                    <div
                      className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden cursor-pointer relative"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100 / 5) * 5;
                        const clamped = Math.max(0, Math.min(100, pct));
                        onUpdateTodo(block.id, { progress: clamped, is_completed: clamped >= 100 } as any);
                      }}
                    >
                      <div className="h-full rounded-full transition-all" style={{ width: `${block.progress}%`, backgroundColor: colorWithAlpha(0.5) }} />
                    </div>
                    <span
                      className="text-muted-foreground/50 font-mono"
                      style={{ fontSize: blockWidthPx >= 215 && height >= 150 ? '12px' : blockWidthPx >= 185 && height >= 110 ? '11px' : '10px' }}
                    >
                      {block.progress}%
                    </span>
                  </div>
                )}
              </>
            );
          })()}
          {block.photos && block.photos.length > 0 && height > 56 && !isEditingThis && (
            <div className="flex gap-1 mt-0.5">
              {block.photos.slice(0, Math.min(3, Math.floor((height - 48) / 20))).map((photo, idx) => (
                <img key={idx} src={photo} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
              ))}
              {block.photos.length > 3 && <span className="text-[9px] text-muted-foreground/60 self-end">+{block.photos.length - 3}</span>}
            </div>
          )}
          {false && (block.tags && block.tags.length > 0 || workType) && height > 108 && blockWidthPx > 220 && !isEditingThis && !(displayMode === 'both' && hasPlan && hasActual) && (
            <div className={cn("flex flex-wrap gap-0.5 mt-0.5", tallNarrowLayout && "justify-center")}>
              {block.tags?.slice(0, 1).map(tag => (
                <span
                  key={tag}
                  className="px-1 py-0 rounded-full"
                  style={{
                    fontSize: blockWidthPx >= 215 && height >= 150 ? '11px' : blockWidthPx >= 185 && height >= 110 ? '10px' : '9px',
                    backgroundColor: tintedCard(0.18),
                    color: tintedText(0.55),
                  }}
                >
                  #{tag}
                </span>
              ))}
              {workType && (
                <span
                  className="px-1.5 py-0 rounded-full"
                  style={{
                    fontSize: blockWidthPx >= 215 && height >= 150 ? '11px' : blockWidthPx >= 185 && height >= 110 ? '10px' : '9px',
                    backgroundColor: WORK_TYPE_META[workType].bg,
                    color: WORK_TYPE_META[workType].color,
                  }}
                >
                  {WORK_TYPE_META[workType].shortLabel}
                </span>
              )}
            </div>
          )}
        </div>
          );
        })()}
        </div>
      </div>
    );
  };

  return (
    <div
      className="select-none flex-1 flex flex-col min-h-0 relative isolate"
      onMouseMove={handleMouseMove}
      onMouseUp={(e) => { handleMouseUp(e.clientX, e.clientY); }}
      onMouseLeave={(e) => {
        // Block drags (move/top/bottom) continue via window listeners — only cancel range selection
        if (dragging) return;
        handleMouseUp(e.clientX, e.clientY);
      }}
    >
      {/* Timeline area. The maxHeight used to be a flat 600px which, on
          common laptop windows (~800px tall), often cut tasks off mid-block
          even though there was empty space below. Switching to a viewport-
          aware clamp lets the timeline grow with the window but still caps
          on huge monitors so it doesn't eat the entire screen. */}
      <div
        className="relative flex flex-1 overflow-y-auto scrollbar-slim"
        style={{ maxHeight: 'min(820px, calc(100vh - 220px))', minHeight: 360, backgroundColor: timelineCanvasBg }}
        ref={containerRef}
        onDragOver={handleTimelineDragOver}
        onDrop={handleTimelineDrop}
        onDragLeave={handleTimelineDragLeave}
        onWheel={handleTimelineWheel}
      >
        {/* Hour labels + quiet “remaining” line (same column as screenshot) */}
        <div
          className="flex-shrink-0 relative z-20 overflow-visible border-r border-[rgba(55,55,62,0.05)] dark:border-border/35"
          style={{ width: TIME_RAIL_WIDTH_PX, height: totalHeight, backgroundColor: timelineCanvasBg }}
        >
          {hours.map(h => {
            const top = minToY(h * 60);
            return (
              <div
                key={h}
                className="absolute inset-x-0 flex -translate-y-1/2 items-center justify-end pr-2.5"
                style={{ top }}
              >
                <span
                  className="font-sans text-[12px] font-medium tabular-nums leading-none tracking-tight"
                  style={{ color: timelineRailLabelColor }}
                >
                  {hourLabel(h)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Timeline content */}
        <div
          className={cn(
            "flex-1 relative transition-colors",
            dragTaskTitle && "bg-primary/[0.03]"
          )}
          style={{ height: totalHeight, backgroundColor: timelineCanvasBg }}
          onDragOver={handleTimelineDragOver}
          onDrop={handleTimelineDrop}
          onDragLeave={handleTimelineDragLeave}
          onMouseDown={(e) => {
            if ((e as any).dataTransfer) return;
            const target = e.target as HTMLElement;
            if (target.closest('[data-plan-block="true"]') || target.closest('[data-range-handle="true"]') || target.closest('[data-creation-card="true"]')) return;
            if (selectedRange) {
              setSlotAddTitle('');
              setSelectedSlots(new Set());
              setCustomRange(null);
              return;
            }
            const anchor = clientYToMin(e.clientY);
            const initial = clampSelectionRange(anchor, anchor + 15);
            setSelectedSlots(new Set());
            setCustomRange(initial);
            setRangeDragging({ anchorMin: anchor });
          }}
        >
          {isViewingToday && nowMin > WAKE_TOTAL_MIN && (
            <div
              className="absolute left-0 right-0 top-0 pointer-events-none"
              style={{
                height: minToY(Math.min(nowPreciseMin, BED_TOTAL_MIN)),
                ...(timelinePastTint
                  ? { backgroundColor: timelinePastTint }
                  : { backgroundColor: 'hsl(var(--muted) / 0.16)' }),
              }}
            />
          )}

          {/* Quiet vertical "spine" running the full day — a single visual thread
              the eye follows from wake to bed. Branches from each leftmost block
              hook back onto it so the day reads as continuous, even when
              individual blocks have gaps between them. */}
          <TimelineSpine isDarkMode={isDarkMode} totalHeight={totalHeight} />
          {positioned.map(({ block, col }) => {
            if (col !== 0) return null;
            const startMinForBranch = block.actualStartMin ?? block.startMin;
            const blockTop = minToY(Math.max(WAKE_TOTAL_MIN, Math.min(BED_TOTAL_MIN, startMinForBranch)));
            const tagColor = getThemedTagColor(block.tags, block.title);
            const accentColor =
              tagColor
              || (block.source === 'imported' ? '#8B91A8' : isDarkMode ? 'hsl(18, 45%, 57%)' : 'hsl(18, 45%, 55%)');
            // Block's left edge in px = content-column-left (0) + leftPct% of column width.
            // Because col 0 always means leftPct === 0, the block starts at x = gap/2 (≈3px).
            // We render the branch out to ~that x.
            const blockLeftPx = 3;
            return (
              <TimelineSpineBranch
                key={`spine-branch-${block.id}`}
                top={blockTop}
                blockLeftPx={Math.max(SPINE_X_PX + 8, blockLeftPx + 28)}
                accentColor={accentColor}
                isDarkMode={isDarkMode}
              />
            );
          })}

          {/* Half-hour slot grid: solid hour lines + dashed mid-hour lines */}
          {allSlots.map(slot => {
            const top = minToY(slot.startMin);
            const isTopHalf = slot.half === 0;
            return (
              <div
                key={`slot-${slot.key}`}
                className={cn("absolute left-0 right-0 transition-colors pointer-events-none")}
                style={{
                  top,
                  height: minToY(slot.endMin) - minToY(slot.startMin),
                  borderTopWidth: 1,
                  borderTopStyle: isTopHalf ? 'solid' : 'dashed',
                  borderTopColor: isTopHalf ? timelineHourLineColor : timelineHalfHourLineColor,
                }}
              />
            );
          })}

          {/* Drop preview block */}
          {dropIndicatorMin !== null && (() => {
            const dragTodo = (dragTaskId ? todos.find(t => t.id === dragTaskId) : undefined)
              || (dragTaskTitle ? todos.find(t => t.title === dragTaskTitle) : undefined);
            const previewTitle = dragTodo?.title || dragTaskTitle || '';
            const previewDur = getSmartDuration(previewTitle, dragTodo?.tags);
            const durLabel = previewDur >= 60 ? `${previewDur / 60}h` : `${previewDur}m`;
            const isPastDrop = dropIndicatorMin < nowMin;
            const previewTagColor = getThemedTagColor(dragTodo?.tags, previewTitle);
            const previewColor = previewTagColor || (isPastDrop ? '#4B9478' : 'hsl(var(--primary))');
            const previewColorWithAlpha = (alpha: number) => {
              if (previewTagColor) return `${previewTagColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
              return isPastDrop ? `rgba(75, 148, 120, ${alpha})` : `hsl(var(--primary) / ${alpha})`;
            };
            const previewDashColor = previewColorWithAlpha(isPastDrop ? 0.42 : 0.55);
            const previewHeight = Math.max(minToY(Math.min(dropIndicatorMin + previewDur, BED_TOTAL_MIN)) - minToY(dropIndicatorMin), 28);
            const previewCompact = previewHeight < 46;
            return (
              <div
                className="absolute left-0 right-0 z-40 overflow-hidden pointer-events-none"
                style={{
                  top: minToY(dropIndicatorMin),
                  height: previewHeight,
                  borderRadius: `${BLOCK_CORNER_PX}px`,
                  border: `1px dashed ${previewDashColor}`,
                  background: `linear-gradient(180deg, ${previewColorWithAlpha(isPastDrop ? 0.13 : 0.07)} 0%, ${previewColorWithAlpha(isPastDrop ? 0.045 : 0.025)} 100%)`,
                  boxShadow: `0 8px 24px ${previewColorWithAlpha(0.04)}`,
                }}
              >
                {isPastDrop && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ backgroundColor: previewColorWithAlpha(0.32) }}
                  />
                )}
                <div className={cn('flex h-full min-w-0 items-center gap-2 px-3', isPastDrop && 'pl-3.5')}>
                  {isPastDrop && <span className="flex-shrink-0 text-[13px] leading-none" style={{ color: previewColor }}>✓</span>}
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium leading-none text-foreground/88">
                    {previewTitle || (isPastDrop ? 'Log as done' : 'Drop to schedule')}
                  </span>
                  {!previewCompact && (
                    <span className="flex-shrink-0 font-mono text-[10.5px] leading-none text-muted-foreground/55">
                      {fmtTime(dropIndicatorMin)} → {fmtTime(Math.min(dropIndicatorMin + previewDur, BED_TOTAL_MIN))}
                    </span>
                  )}
                  <span
                    className="flex-shrink-0 rounded-full bg-background/75 px-1.5 py-[2px] text-[10px] font-medium leading-none shadow-[inset_0_0_0_1px_hsl(var(--border)/0.35)]"
                    style={{ color: previewColor }}
                  >
                    {isPastDrop ? `✓ ${durLabel}` : durLabel}
                  </span>
                </div>
              </div>
            );
          })()}


          {/* Inline creation card at selected range — looks like a dashed plan block */}
          {selectedRange && (() => {
            const rangeTop = minToY(selectedRange.startMin);
            const rangeHeight = Math.max(minToY(selectedRange.endMin) - rangeTop, 48);
            const isPastRange = isViewingToday && selectedRange.endMin <= nowMin;
            const creationTagColor = slotAddTitle.trim() ? getThemedTagColor(undefined, slotAddTitle.trim()) : undefined;
            const pastAccent = '#4B9478';
            const borderColor = creationTagColor || (isPastRange ? pastAccent : 'hsl(var(--muted-foreground) / 0.45)');
            const startH = Math.floor(selectedRange.startMin / 60);
            const startM = selectedRange.startMin % 60;
            const endH = Math.floor(selectedRange.endMin / 60);
            const endM = selectedRange.endMin % 60;
            const durationMin = selectedRange.endMin - selectedRange.startMin;
            const durH = Math.floor(durationMin / 60);
            const durM = durationMin % 60;
            const durStr = durH > 0 ? `${durH}h${durM > 0 ? ` ${durM}m` : ''}` : `${durM}m`;

            const applyTimeEdit = (field: 'start' | 'end', value: string) => {
              const match = value.match(/^(\d{1,2}):(\d{2})$/);
              if (!match) return;
              const h = parseInt(match[1], 10);
              const m = parseInt(match[2], 10);
              if (h < 0 || h > 23 || m < 0 || m > 59) return;
              const newMin = h * 60 + m;
              if (field === 'start' && newMin < selectedRange.endMin) {
                setCustomRange({ startMin: newMin, endMin: selectedRange.endMin });
              } else if (field === 'end' && newMin > selectedRange.startMin) {
                setCustomRange({ startMin: selectedRange.startMin, endMin: newMin });
              }
            };

            const dismiss = () => { setSlotAddTitle(''); setSelectedSlots(new Set()); setCustomRange(null); };
            return (
              <div
                data-creation-card="true"
                className="absolute left-0 right-0 z-30"
                style={{ top: rangeTop }}
                onMouseDown={e => e.stopPropagation()}
              >
                <div
                  className="flex flex-col gap-1 rounded-[12px] border border-border px-3 py-2.5 shadow-[0_10px_30px_hsl(var(--foreground)/0.16)] ring-1 ring-border/40 overflow-hidden"
                  style={{
                    borderLeft: `3px solid ${borderColor}`,
                    minHeight: rangeHeight,
                    background: `linear-gradient(180deg, color-mix(in srgb, hsl(var(--card)) 88%, ${borderColor} 12%) 0%, hsl(var(--card)) 60%)`,
                  }}
                >
                  <div className="flex items-center gap-2 pr-5">
                    {isPastRange && (
                      <span className="flex-shrink-0 text-[12px]" style={{ color: pastAccent }}>✓</span>
                    )}
                    <input
                      ref={slotInputRef}
                      value={slotAddTitle}
                      onChange={e => setSlotAddTitle(e.target.value)}
                      onKeyDown={e => {
                        const native = e.nativeEvent as KeyboardEvent;
                        if (e.key === 'Enter' && !isImeComposing(native) && slotAddTitle.trim() && selectedRange) {
                          const range = selectedRange;
                          const targetDay = date || format(new Date(), 'yyyy-MM-dd');
                          const sH = Math.floor(range.startMin / 60);
                          const sM = range.startMin % 60;
                          const eH = Math.floor(range.endMin / 60);
                          const eM = range.endMin % 60;
                          const startISO = new Date(`${targetDay}T${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}:00`).toISOString();
                          const endISO = new Date(`${targetDay}T${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}:00`).toISOString();
                          const diffSec = (range.endMin - range.startMin) * 60;
                          (async () => {
                            const result = await onAddTodo(slotAddTitle.trim(), 'anytime');
                            if (result && result.id) {
                              if (isPastRange) {
                                onUpdateTodo(result.id, {
                                  timer_started_at: startISO,
                                  timer_ended_at: endISO,
                                  timer_seconds: diffSec,
                                  is_completed: true,
                                } as any);
                              } else {
                                onUpdateTodo(result.id, { plan_started_at: startISO, plan_ended_at: endISO });
                              }
                            }
                          })();
                          dismiss();
                        }
                        if (e.key === 'Escape') dismiss();
                      }}
                      placeholder={isPastRange ? 'What did you do?' : 'Add task...'}
                      className="flex-1 bg-transparent text-[13px] font-medium focus:outline-none placeholder:text-muted-foreground/25 text-foreground"
                      style={{ color: creationTagColor || undefined }}
                      autoFocus
                    />
                  </div>
                  <div className="mt-auto flex items-center gap-0.5 font-mono tabular-nums text-muted-foreground/40" style={{ fontSize: '10px' }}>
                    <input
                      className="w-[40px] bg-transparent text-center focus:outline-none focus:bg-secondary/50 rounded hover:bg-secondary/30 transition-colors"
                      defaultValue={`${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`}
                      key={`start-${selectedRange.startMin}`}
                      onBlur={e => applyTimeEdit('start', e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                    <span>–</span>
                    <input
                      className="w-[40px] bg-transparent text-center focus:outline-none focus:bg-secondary/50 rounded hover:bg-secondary/30 transition-colors"
                      defaultValue={`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`}
                      key={`end-${selectedRange.endMin}`}
                      onBlur={e => applyTimeEdit('end', e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                    <span className="ml-1 opacity-50">{durStr}</span>
                    {isPastRange && (
                      <span className="ml-1.5 font-sans text-[9px] font-medium uppercase tracking-[0.06em]" style={{ color: pastAccent, opacity: 0.8 }}>done</span>
                    )}
                  </div>
                  <button
                    onClick={dismiss}
                    className="absolute top-2 right-2 p-0.5 rounded text-muted-foreground/30 hover:text-foreground transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Drag handles for selected range */}
          {selectedRange && (() => {
            const topPx = minToY(selectedRange.startMin);
            const bottomPx = minToY(selectedRange.endMin);
            return (
              <>
                <div
                  data-range-handle="true"
                  className="absolute left-0 right-0 z-[25] h-4 cursor-n-resize flex items-center justify-center"
                  style={{ top: topPx - 8 }}
                  onMouseDown={e => handleEdgeDragStart('top', e)}
                >
                  <div className="h-[3px] w-8 rounded-full bg-primary/30" />
                </div>
                <div
                  data-range-handle="true"
                  className="absolute left-0 right-0 z-[25] h-4 cursor-s-resize flex items-center justify-center"
                  style={{ top: bottomPx - 8 }}
                  onMouseDown={e => handleEdgeDragStart('bottom', e)}
                >
                  <div className="h-[3px] w-8 rounded-full bg-primary/30" />
                </div>
              </>
            );
          })()}

          {/* Lane highlights removed — blocks render their own backgrounds */}

          {/* Rest blocks — background layer, always beneath task blocks */}
          {[...restBlocks, ...(restStartMin !== null ? [{ id: 'rest-active', startMin: restStartMin, endMin: Math.max(restStartMin + 5, nowMin) }] : [])].map(rb => {
            const rbTop = minToY(rb.startMin);
            const rbHeight = Math.max(minToY(rb.endMin) - rbTop, 12);
            const isActive = rb.id === 'rest-active';
            const durationMin = rb.endMin - rb.startMin;
            const durStr = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`;
            return (
              <div
                key={rb.id}
                className="absolute z-[2] group/rest"
                style={{ top: rbTop, height: rbHeight, left: 0, right: 0 }}
              >
                {/* Subtle tinted fill */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: REST_COLOR,
                    opacity: isActive ? 0.1 : 0.07,
                    borderRadius: '6px',
                  }}
                />
                {/* Left accent bar */}
                <div
                  className="absolute top-0 bottom-0 left-0"
                  style={{
                    width: '3px',
                    backgroundColor: REST_COLOR,
                    opacity: isActive ? 0.65 : 0.45,
                    borderRadius: '3px 0 0 3px',
                  }}
                />
                {/* Label — always shown, duration text only when tall enough */}
                <div className="absolute left-3 top-0 bottom-0 flex items-center gap-1 pointer-events-none select-none overflow-hidden">
                  <span style={{ fontSize: '10px', color: REST_COLOR, opacity: 0.75, lineHeight: 1 }}>
                    😴{!isActive && rbHeight >= 20 ? ` ${durStr}` : ''}
                  </span>
                </div>
                {/* Delete on hover — only for completed rest blocks */}
                {!isActive && (
                  <button
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/rest:opacity-60 hover:!opacity-100 transition-opacity pointer-events-auto"
                    onClick={() => setRestBlocks(prev => prev.filter(b => b.id !== rb.id))}
                    style={{ color: REST_COLOR }}
                  >
                    <X size={9} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Plan blocks */}
          {positioned.map(({ block, col, totalCols }) => renderBlock(block, col, totalCols))}

          {/* Empty state */}
          {planBlocks.length === 0 && !selectedRange && (
            <div
              className="absolute left-0 right-0 z-[3] pointer-events-none flex items-center justify-center"
              style={{ top: minToY(Math.max(WAKE_TOTAL_MIN + 90, Math.min(nowMin, BED_TOTAL_MIN - 120))) }}
            >
              <div className="w-[min(360px,calc(100%-32px))] rounded-2xl border border-dashed border-border/45 bg-[hsl(var(--surface-contrast)/0.8)] px-4 py-4 text-center shadow-[0_12px_30px_hsl(var(--foreground)/0.04)] backdrop-blur-sm">
                <p className="text-[15px] font-semibold text-foreground/90">
                  {tOr('plan.dragHere', 'Drag a task here to schedule it')}
                </p>
                <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground/75">
                  {tOr('plan.dragHereHint', 'Left side is your task list. This side becomes today’s plan.')}
                </p>
                <div className="mt-3 rounded-[16px] border-2 border-dashed border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.05)] px-3 py-2.5 text-left">
                  <div className="flex items-center gap-2">
                    <span className="rounded-[7px] bg-background/80 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                      Plan
                    </span>
                    <span className="truncate text-[14px] font-medium text-foreground/85">
                      {tOr('plan.sampleBlock', 'Example task')}
                    </span>
                  </div>
                  <div className="mt-1 font-mono tabular-nums text-[12px] text-muted-foreground/75">
                    {tOr('plan.sampleTimeRange', '09:00 → 10:00')} <span className="text-muted-foreground/50">• 1h</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gap labels: full pill only when gap is roomy; short gaps stay quiet (subtle) */}
          {(() => {
            if (!SHOW_FREE_TIME_LABELS) return [];
            const MIN_PX = 22;
            /** Minutes between tasks — primary cue for readable “hero” pill vs quiet chip */
            const FULL_PILL_MIN_MINUTES = 28;
            const gaps: { startMin: number; endMin: number }[] = [];
            for (let i = 0; i < sortedPlanBlocks.length - 1; i++) {
              const gapStart = sortedPlanBlocks[i].endMin;
              const gapEnd = sortedPlanBlocks[i + 1].startMin;
              if (gapEnd - gapStart < 5) continue;
              const nextBlock = sortedPlanBlocks[i + 1];
              // Pomodoro floater shows live elapsed — omit free-gap pill above an actively timed task
              if (nextBlock.source === 'todo' && activeTimerIds?.has(nextBlock.id)) continue;
              gaps.push({ startMin: gapStart, endMin: gapEnd });
            }
            if (sortedPlanBlocks.length > 0) {
              const lastEnd = sortedPlanBlocks[sortedPlanBlocks.length - 1].endMin;
              if (BED_TOTAL_MIN - lastEnd >= 30) gaps.push({ startMin: lastEnd, endMin: BED_TOTAL_MIN });
            }
            const elems: React.ReactNode[] = [];
            gaps.forEach((gap, i) => {
              const isTrailingGap = gap.endMin === BED_TOTAL_MIN;
              const gapPx = minToY(gap.endMin) - minToY(gap.startMin);
              if (gapPx < MIN_PX) return;
              if (isTrailingGap) return;
              const centerY = (minToY(gap.startMin) + minToY(gap.endMin)) / 2;
              const diffMin = gap.endMin - gap.startMin;
              const useFullPill = diffMin >= FULL_PILL_MIN_MINUTES;
              const labelOffset = useFullPill ? 11 : 7;
              elems.push(
                <div
                  key={`gap-${gap.startMin}-${gap.endMin}-${i}`}
                  className="absolute left-0 right-0 z-[3] pointer-events-none flex items-center justify-center"
                  style={{ top: centerY - labelOffset }}
                >
                  <TimelineIntervalPill isDarkMode={isDarkMode} variant={useFullPill ? 'default' : 'subtle'}>
                    {formatGapMinutesLabel(diffMin)}
                  </TimelineIntervalPill>
                </div>,
              );
            });
            return elems;
          })()}

          {/* Current time indicator — NOW (only show on today) */}
          {isViewingToday && nowMin >= WAKE_TOTAL_MIN && nowMin <= BED_TOTAL_MIN && (
            <>
              {/* Past wash — a soft neutral tint over time that has already
                  elapsed. The future canvas stays clean white so it reads as
                  "still open". Sits at z-[1] so it only colors the empty
                  canvas; task blocks render above it untouched.
                  The gradient fades just before "now" so the transition into
                  the white future feels seamless rather than abrupt. */}
              {nowPreciseMin > WAKE_TOTAL_MIN + 2 && (
                <div
                  className="absolute left-0 right-0 pointer-events-none z-[1]"
                  style={{
                    top: 0,
                    height: minToY(nowPreciseMin),
                    background: isDarkMode
                      ? 'linear-gradient(to bottom, hsl(var(--foreground) / 0.032) 0%, hsl(var(--foreground) / 0.028) 80%, hsl(var(--foreground) / 0.012) 100%)'
                      : 'linear-gradient(to bottom, rgba(15,23,42,0.022) 0%, rgba(15,23,42,0.014) 82%, rgba(15,23,42,0.004) 100%)',
                  }}
                />
              )}
              {/* Now line — thin, soft, slightly blurred, fading to the right */}
              <div
                className="absolute left-0 right-0 z-[52] pointer-events-none"
                style={{
                  top: minToY(nowPreciseMin),
                  height: 1,
                  background: rhythmNowMarkers.lineGradient,
                  filter: 'blur(0.35px)',
                  transform: 'translateY(-0.5px)',
                }}
              />
              {/* Anchor dot — left edge, where the gradient line is strongest.
                  Marks "now begins here" as a structural emphasis. */}
              <div
                className="absolute left-0 z-[53] -translate-y-1/2 pointer-events-none"
                style={{ top: minToY(nowPreciseMin) }}
              >
                <span
                  aria-hidden
                  className="block h-1.5 w-1.5 rounded-full"
                  style={{
                    background: rhythmNowMarkers.dot,
                    boxShadow: rhythmNowMarkers.glow,
                  }}
                />
              </div>

              {/* Timestamp — right edge, away from the hour-label spine on the left.
                  Lightly backdropped so it stays readable when a task block
                  happens to extend across the now-line. */}
              <div
                className="absolute right-1 z-[53] -translate-y-1/2 pointer-events-none"
                style={{ top: minToY(nowPreciseMin) }}
              >
                <span className="inline-flex items-center rounded-full bg-background/72 px-1.5 py-[2px] font-mono text-[10px] tabular-nums tracking-[0.02em] text-foreground/55 backdrop-blur-[3px]">
                  {nowTimeLabel}
                </span>
              </div>
            </>
          )}

          {/* Today remaining — always tuck *below* the precise now line (not last block end alone, which can land on the line) */}
          {isViewingToday && nowMin < BED_TOTAL_MIN - 5 && (() => {
            const GAP_AFTER_BLOCK_PX = 22;
            /** Clear the 1px now line + blur so the pill sits clearly in "future" */
            const CLEAR_BELOW_NOW_PX = 14;
            const bedMin = BEDTIME_HOUR * 60 + BEDTIME_MINUTE;
            const remainingMin = Math.max(0, bedMin - nowMin);
            const remainingFullPill = remainingMin >= 45;
            const afterLastBlockY =
              lastScheduledEndMin != null ? minToY(lastScheduledEndMin) + GAP_AFTER_BLOCK_PX : 0;
            const belowNowY = minToY(nowPreciseMin) + CLEAR_BELOW_NOW_PX;
            const anchorY = Math.max(afterLastBlockY, belowNowY);
            const maxTopBeforeBed = Math.max(0, minToY(BED_TOTAL_MIN) - 48);
            const topPx = Math.min(Math.max(GAP_AFTER_BLOCK_PX + minToY(WAKE_TOTAL_MIN), anchorY), maxTopBeforeBed);
            return (
              <div
                className="absolute left-0 right-0 z-[48] pointer-events-none flex justify-center px-3"
                style={{ top: topPx }}
              >
                <TimelineIntervalPill isDarkMode={isDarkMode} variant={remainingFullPill ? 'default' : 'subtle'}>
                  {`${remainingTimeStr} · ${lang === 'zh' ? '今日剩余' : 'left today'}`}
                </TimelineIntervalPill>
              </div>
            );
          })()}

        </div>
      </div>

      {/* inset-right clears PlanView's absolute rhythm preset (palette) — same corner, ~w-8 + margin */}
      <div className="pointer-events-none absolute right-12 top-3 z-30 flex items-start gap-1">
        <button
          onClick={handleRestToggle}
          className="pointer-events-auto flex items-center gap-1 px-2 py-[2px] text-[9px] font-medium rounded-full transition-all backdrop-blur-md shadow-[0_4px_12px_hsl(var(--foreground)/0.05)]"
          style={{
            background: restStartMin !== null
              ? `color-mix(in srgb, hsl(var(--surface-contrast)) 80%, ${REST_COLOR} 20%)`
              : 'hsl(var(--surface-contrast) / 0.9)',
            border: `1px solid ${restStartMin !== null ? REST_COLOR : 'hsl(var(--border) / 0.5)'}`,
            color: restStartMin !== null ? REST_COLOR : 'hsl(var(--muted-foreground))',
          }}
        >
          {restStartMin !== null ? (
            <>
              <span className="animate-pulse">●</span>
              <span>Stop Rest</span>
            </>
          ) : (
            <>
              <span>😴</span>
              <span>Rest</span>
            </>
          )}
        </button>
        {selectedRange && (
          <span className="text-[9px] text-muted-foreground bg-[hsl(var(--surface-contrast)/0.9)] backdrop-blur-md border border-border/50 rounded-full px-2 py-0.5 shadow-[0_4px_12px_hsl(var(--foreground)/0.06)] pointer-events-auto">
            {t('plan.selected')} <span className="font-semibold text-foreground">
              {Math.max(0, Math.round(selectedRange.endMin - selectedRange.startMin))}
            </span> {t('plan.minutes')}
          </span>
        )}
        <div className="flex items-center bg-[hsl(var(--surface-contrast)/0.88)] backdrop-blur-md rounded-full p-[1.5px] shadow-[0_4px_12px_hsl(var(--foreground)/0.05)] border border-border/45 pointer-events-auto">
          {(['plan', 'actual', 'both'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setDisplayMode(mode)}
              className={cn(
                "px-2 py-[1px] text-[9px] font-medium rounded-full transition-all",
                displayMode === mode
                  ? "bg-[hsl(var(--surface-soft))] text-foreground shadow-sm"
                  : "text-muted-foreground/85 hover:text-foreground"
              )}
            >
              {mode === 'plan' ? 'Planned' : mode === 'actual' ? 'Doing' : 'Both'}
            </button>
          ))}
        </div>
      </div>

      {photoLightbox && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-background/94 p-4 backdrop-blur-sm"
          onClick={() => setPhotoLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setPhotoLightbox(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-background/70 p-2 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            aria-label="Close photo preview"
          >
            <X size={22} />
          </button>
          <div className="flex max-h-[88vh] max-w-[92vw] flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <img
              src={photoLightbox.photos[photoLightbox.index]}
              alt=""
              className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            {photoLightbox.photos.length > 1 && (
              <div className="flex max-w-full gap-2 overflow-x-auto rounded-full bg-background/75 px-2 py-2 shadow-sm">
                {photoLightbox.photos.map((photo, index) => (
                  <button
                    key={`${photo}-${index}`}
                    type="button"
                    onClick={() => setPhotoLightbox({ ...photoLightbox, index })}
                    className={cn(
                      "h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border transition-opacity",
                      index === photoLightbox.index ? "border-primary opacity-100" : "border-border/50 opacity-60 hover:opacity-90"
                    )}
                  >
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

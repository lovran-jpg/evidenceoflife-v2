// Suggestion-based auto-scheduling.
//
// Turns a pile of unscheduled todos into concrete timeline placements the user
// can preview, accept, or drag. This is intentionally rule-based (Phase 1): the
// only "preference" signals are the task's own time_segment and its historical
// real duration. It never mutates data — it returns Suggestions the UI paints as
// ghost blocks and only commits on explicit accept.
//
// Two lanes model the user's "I do many little things at once" reality:
//   - focus:      exclusive. Consumes free space; deep work, meetings, writing.
//   - background: can overlap existing blocks; laundry, downloads, errands.

import { inferWorkType } from '@/lib/workType';
import { getSmartDuration } from '@/components/views/planTimeline/planTimelinePrimitives';
import type { FreeRegion } from '@/lib/freeRegions';
import { resolveSegment, type SchedulingProfile } from '@/lib/schedulingProfile';

export type ScheduleLane = 'focus' | 'background';

export interface SchedulableTodo {
  id: string;
  title: string;
  tags?: string[];
  time_segment?: 'morning' | 'afternoon' | 'evening' | 'anytime' | string | null;
}

/** Minimal shape of a past todo used to learn real durations. */
export interface DurationHistoryRow {
  title: string;
  tags?: string[] | null;
  timer_seconds?: number | null;
}

export interface Suggestion {
  todoId: string;
  title: string;
  startMin: number;
  endMin: number;
  lane: ScheduleLane;
  /** Human-readable why, e.g. "afternoon · ~35m (your usual) fits here". */
  reason: string;
}

export interface AutoScheduleOptions {
  /** Usable day bounds in minutes (wake / bedtime). */
  dayStart: number;
  dayEnd: number;
  /** Past todos for median-duration learning. Optional. */
  history?: DurationHistoryRow[];
  /** Snap placements to this grid (minutes). Default 5. */
  snapMin?: number;
  /** Clamp any single placement to at most this long. Default 120. */
  maxDurationMin?: number;
  /** Per-todo lane override (user toggled focus↔background in the preview). */
  laneOverrides?: Record<string, ScheduleLane>;
  /** Learned habit profile (Phase 2). Fills in a preferred segment for tasks
   *  the user left as "anytime", based on when they historically did that kind
   *  of work. Optional — omit for pure rule-based (Phase 1) behaviour. */
  profile?: SchedulingProfile;
}

const SEG_BOUNDS: Record<string, [number, number]> = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 18 * 60],
  evening: [18 * 60, 24 * 60],
};

const normKey = (title: string, tags?: string[] | null) => {
  const tag = (tags && tags[0]) || '';
  return `${tag}::${title.trim().toLowerCase()}`;
};

const median = (nums: number[]): number => {
  if (!nums.length) return NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Preferred time window for a task, intersected with the usable day.
 * `anytime` (or unknown) → the whole day.
 */
export function segmentWindow(
  timeSegment: string | null | undefined,
  dayStart: number,
  dayEnd: number,
): [number, number] {
  const bounds = timeSegment ? SEG_BOUNDS[timeSegment] : undefined;
  if (!bounds) return [dayStart, dayEnd];
  return [Math.max(dayStart, bounds[0]), Math.min(dayEnd, bounds[1])];
}

/**
 * Estimate how long a task will take, in minutes. Prefers the median of the
 * user's real recorded durations for the same tag+title (much truer than a
 * static default); falls back to same-tag history, then to getSmartDuration.
 */
export function estimateDurationMin(
  todo: SchedulableTodo,
  history?: DurationHistoryRow[],
): number {
  if (history && history.length) {
    const meaningful = history.filter(h => (h.timer_seconds || 0) >= 60);
    const key = normKey(todo.title, todo.tags);
    const exact = meaningful
      .filter(h => normKey(h.title, h.tags) === key)
      .map(h => (h.timer_seconds as number) / 60);
    if (exact.length) return Math.round(median(exact));

    const tag = todo.tags?.[0];
    if (tag) {
      const sameTag = meaningful
        .filter(h => (h.tags?.[0] || '') === tag)
        .map(h => (h.timer_seconds as number) / 60);
      if (sameTag.length >= 3) return Math.round(median(sameTag));
    }
  }
  return getSmartDuration(todo.title, todo.tags);
}

/** Deep work is exclusive; lighter work can run in the background. */
export function inferLane(todo: SchedulableTodo): ScheduleLane {
  const wt = inferWorkType({ title: todo.title, tags: todo.tags });
  return wt === 'errand' || wt === 'recovery' ? 'background' : 'focus';
}

const snap = (min: number, step: number) => Math.round(min / step) * step;

/**
 * Produce ghost-preview placements for unscheduled todos.
 *
 * focus tasks greedily claim the first free sub-window (inside their preferred
 * segment) long enough to hold them, shrinking that region's remaining space so
 * two focus tasks never overlap. background tasks are placed in their preferred
 * window without consuming free space (they may sit over existing blocks); the
 * timeline's column layout renders the overlap side-by-side. Tasks that don't
 * fit anywhere are skipped (no suggestion) rather than forced.
 */
export function autoSchedule(
  unscheduled: SchedulableTodo[],
  freeRegions: FreeRegion[],
  opts: AutoScheduleOptions,
): Suggestion[] {
  const { dayStart, dayEnd, history, snapMin = 5, maxDurationMin = 120, laneOverrides, profile } = opts;

  // Mutable free spans the focus lane consumes as it places tasks.
  const spans = freeRegions
    .map(r => ({ startMin: r.startMin, endMin: r.endMin }))
    .sort((a, b) => a.startMin - b.startMin);

  // Background placements accumulate so parallel bg tasks stagger instead of
  // stacking on the exact same minute.
  const bgByWindow = new Map<string, number>();

  const suggestions: Suggestion[] = [];

  for (const todo of unscheduled) {
    const lane = laneOverrides?.[todo.id] ?? inferLane(todo);
    const durRaw = Math.min(estimateDurationMin(todo, history), maxDurationMin);
    const dur = Math.max(snapMin, snap(durRaw, snapMin));
    // Learned preference fills in a segment for "anytime" tasks; explicit
    // time_segment always wins inside resolveSegment.
    const learnedSeg = resolveSegment(todo, profile);
    const effectiveSeg = learnedSeg ?? todo.time_segment ?? null;
    const [winStart, winEnd] = segmentWindow(effectiveSeg, dayStart, dayEnd);
    if (winEnd - winStart < dur) continue;

    const isLearned = !!learnedSeg && !SEG_BOUNDS[todo.time_segment as string];
    const segLabel = SEG_BOUNDS[effectiveSeg as string]
      ? `${effectiveSeg}${isLearned ? ' (you usually)' : ''} · `
      : '';
    const usual = history && history.length ? ' (your usual)' : '';

    if (lane === 'focus') {
      // First free span that overlaps the preferred window with room to fit.
      let placed = false;
      for (const span of spans) {
        const availStart = Math.max(span.startMin, winStart);
        const availEnd = Math.min(span.endMin, winEnd);
        if (availEnd - availStart < dur) continue;
        const start = snap(availStart, snapMin);
        const end = start + dur;
        if (end > Math.min(span.endMin, winEnd)) continue;
        suggestions.push({
          todoId: todo.id,
          title: todo.title,
          startMin: start,
          endMin: end,
          lane,
          reason: `${segLabel}~${dur}m${usual} fits here`,
        });
        span.startMin = end; // consume the space
        placed = true;
        break;
      }
      if (!placed) continue;
    } else {
      // Background: stack sequentially from the window start, ignoring occupied
      // space (it may overlap). Keeps multiple bg tasks from sharing one minute.
      const wkey = `${winStart}-${winEnd}`;
      const cursor = bgByWindow.get(wkey) ?? winStart;
      const start = snap(cursor, snapMin);
      const end = start + dur;
      if (end > winEnd) continue;
      suggestions.push({
        todoId: todo.id,
        title: todo.title,
        startMin: start,
        endMin: end,
        lane,
        reason: `${segLabel}background · ~${dur}m${usual}`,
      });
      bgByWindow.set(wkey, end);
    }
  }

  return suggestions;
}

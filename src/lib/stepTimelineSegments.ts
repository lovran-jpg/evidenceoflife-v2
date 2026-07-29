// Turning a task's step work-sessions into sub-segments that render INSIDE the
// parent task's timeline block.
//
// Steps (sub-tasks) each carry a lightweight timer. Every time a step's timer
// stops, `logStepSessionMoment` (PlanView) records a focus-session moment tagged
// `step-session` + `todo-session:<parentId>` carrying the real session window
// (timer_started_at → timer_ended_at). Those moments are the ONLY durable record
// of *when* a step was worked on — the step row itself clears `timer_started_at`
// on stop, keeping only the accumulated `timer_seconds`.
//
// This pure helper groups those session moments by their parent task and lays
// them out as positioned sub-segments: real wall-clock start/end, plus a
// column/totalCols assignment so overlapping sessions (steps worked on at the
// same time) render SIDE-BY-SIDE inside the parent block rather than stacking or
// hiding each other. The parent block spans the union of its sessions.
//
// Kept framework-free and pure so it can be unit-tested in isolation.

import { parseISO } from 'date-fns';

/** Minimal moment shape this helper reads. Matches the app's Moment type. */
export interface StepSessionMomentInput {
  id: string;
  tags?: string[] | null;
  text?: string | null;
  emoji?: string | null;
  timer_started_at?: string | null;
  timer_ended_at?: string | null;
  timer_seconds?: number | null;
}

/** A single step work-session, positioned for rendering inside the parent block. */
export interface PositionedStepSegment {
  /** Stable id for React keys (`step-seg-<momentId>`). */
  id: string;
  parentId: string;
  title: string;
  emoji?: string;
  /** Minutes-from-midnight the session started. */
  startMin: number;
  /** Minutes-from-midnight the session ended (always > startMin). */
  endMin: number;
  /** Column index within its overlap cluster (0-based). */
  col: number;
  /** Total columns in its overlap cluster (side-by-side count). */
  totalCols: number;
}

/** All step segments for one parent, plus the union extent they span. */
export interface ParentStepSegments {
  segments: PositionedStepSegment[];
  /** Earliest session start across all segments. */
  unionStartMin: number;
  /** Latest session end across all segments. */
  unionEndMin: number;
}

const STEP_SESSION_TAG = 'step-session';
const PARENT_TAG_PREFIX = 'todo-session:';
/** Floor so a very short tap still renders as a visible sliver. */
const MIN_SEGMENT_MIN = 4;
const DAY_MIN = 1440;

function parentIdFromTags(tags: string[]): string | null {
  const tag = tags.find(t => t.startsWith(PARENT_TAG_PREFIX));
  return tag ? tag.slice(PARENT_TAG_PREFIX.length) : null;
}

function resolveSessionBounds(m: StepSessionMomentInput): { startMs: number; endMs: number } | null {
  if (!m.timer_started_at) return null;
  const start = parseISO(m.timer_started_at);
  const startMs = start.getTime();
  if (!Number.isFinite(startMs)) return null;

  let endMs = startMs + MIN_SEGMENT_MIN * 60_000;
  if (m.timer_ended_at) {
    const end = parseISO(m.timer_ended_at);
    const parsedEndMs = end.getTime();
    if (Number.isFinite(parsedEndMs) && parsedEndMs > startMs) {
      endMs = parsedEndMs;
    }
  } else if ((m.timer_seconds ?? 0) > 0) {
    endMs = startMs + Math.ceil((m.timer_seconds ?? 0)) * 1000;
  }

  if (endMs <= startMs) {
    endMs = startMs + MIN_SEGMENT_MIN * 60_000;
  }
  return { startMs, endMs };
}

/**
 * Assign side-by-side columns to a parent's segments so overlapping sessions sit
 * next to each other. Segments are grouped into "overlap clusters" (transitively
 * overlapping runs); every segment in a cluster shares the cluster's column
 * count so widths stay uniform within a cluster.
 */
function positionColumns(
  raw: Array<Omit<PositionedStepSegment, 'col' | 'totalCols'>>,
): PositionedStepSegment[] {
  const sorted = [...raw].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: PositionedStepSegment[] = [];

  let cluster: PositionedStepSegment[] = [];
  let clusterEnd = -Infinity;
  // Per active column, the endMin of the segment currently occupying it.
  let columnEnds: number[] = [];

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const total = Math.max(1, columnEnds.length);
    for (const seg of cluster) seg.totalCols = total;
    out.push(...cluster);
    cluster = [];
    columnEnds = [];
    clusterEnd = -Infinity;
  };

  for (const seg of sorted) {
    // A gap after everything in the current cluster closes it out.
    if (seg.startMin >= clusterEnd) flushCluster();

    // Reuse the first column freed by this segment's start; else open a new one.
    let col = columnEnds.findIndex(end => end <= seg.startMin);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(seg.endMin);
    } else {
      columnEnds[col] = seg.endMin;
    }

    cluster.push({ ...seg, col, totalCols: 1 });
    clusterEnd = Math.max(clusterEnd, seg.endMin);
  }
  flushCluster();

  return out;
}

/**
 * Group step-session moments by parent task and position them for in-block
 * rendering.
 *
 * @param moments  All moments for the day (non-step-session moments are ignored).
 * @param dayKey   'yyyy-MM-dd' — sessions are clipped to this day if they overlap it.
 */
export function buildStepSegmentsByParent(
  moments: StepSessionMomentInput[],
  dayKey?: string,
): Map<string, ParentStepSegments> {
  const byParent = new Map<string, Array<Omit<PositionedStepSegment, 'col' | 'totalCols'>>>();

  const dayStartMs = dayKey ? parseISO(dayKey).getTime() : null;
  const dayEndMs = dayStartMs != null && Number.isFinite(dayStartMs)
    ? dayStartMs + DAY_MIN * 60_000
    : null;

  for (const m of moments) {
    const tags = m.tags ?? [];
    if (!tags.includes(STEP_SESSION_TAG)) continue;
    const bounds = resolveSessionBounds(m);
    if (!bounds) continue;

    const parentId = parentIdFromTags(tags);
    if (!parentId) continue;

    let startMin = 0;
    let endMin = 0;
    if (dayStartMs != null && dayEndMs != null) {
      if (bounds.endMs <= dayStartMs || bounds.startMs >= dayEndMs) continue;
      const clippedStartMs = Math.max(bounds.startMs, dayStartMs);
      const clippedEndMs = Math.min(bounds.endMs, dayEndMs);
      startMin = Math.max(0, Math.floor((clippedStartMs - dayStartMs) / 60_000));
      endMin = startMin + Math.max(1, Math.ceil((clippedEndMs - clippedStartMs) / 60_000));
      endMin = Math.min(DAY_MIN, endMin);
    } else {
      const start = new Date(bounds.startMs);
      startMin = start.getHours() * 60 + start.getMinutes();
      endMin = startMin + Math.ceil((bounds.endMs - bounds.startMs) / 60_000);
    }

    endMin = Math.max(endMin, startMin + MIN_SEGMENT_MIN);
    if (dayStartMs != null && dayEndMs != null) {
      endMin = Math.min(DAY_MIN, endMin);
    }

    const list = byParent.get(parentId) ?? [];
    list.push({
      id: `step-seg-${m.id}`,
      parentId,
      title: m.text || m.emoji || 'Step',
      emoji: m.emoji || undefined,
      startMin,
      endMin,
    });
    byParent.set(parentId, list);
  }

  const result = new Map<string, ParentStepSegments>();
  for (const [parentId, raw] of byParent) {
    const segments = positionColumns(raw);
    const unionStartMin = Math.min(...segments.map(s => s.startMin));
    const unionEndMin = Math.max(...segments.map(s => s.endMin));
    result.set(parentId, { segments, unionStartMin, unionEndMin });
  }
  return result;
}

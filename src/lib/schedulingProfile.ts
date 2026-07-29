// Habit learning for auto-scheduling (Phase 2).
//
// Phase 1 auto-scheduled tasks using only the task's own `time_segment` (which is
// usually unset) and its historical duration. This module adds the missing
// "learn my patterns" half: from the user's *real* history — when they actually
// worked on each kind of task — it derives a preferred time-of-day per work type.
//
// It is deliberately pure and conservative:
//   - Learns only when there's enough signal (min samples + a clear plurality).
//     A noisy 40/30/30 split yields no preference rather than a coin-flip guess.
//   - Never mutates data. It returns a profile the scheduler *consults*; the user
//     still sees every placement as a ghost they can accept, move, or dismiss.
//
// No new database table is required: the profile is derived on the fly from the
// todo rows the app already stores.

import { inferWorkType, type WorkType } from '@/lib/workType';

export type DaySegment = 'morning' | 'afternoon' | 'evening';

/** One past task, with the local hour it was actually worked on (if known). */
export interface HistoryEvent {
  title: string;
  tags?: string[] | null;
  /** Local hour (0–23) the task was started/tracked. null when never tracked. */
  startedHour?: number | null;
}

export interface SchedulingProfile {
  /** Learned preferred segment per work type, only where the signal is strong. */
  preferredSegmentByWorkType: Partial<Record<WorkType, DaySegment>>;
  /** Total history events that carried a usable hour. */
  sampleCount: number;
}

export interface BuildProfileOptions {
  /** Minimum tracked events of a work type before we trust a preference. Default 3. */
  minSamples?: number;
  /** Fraction of samples the winning segment must reach. Default 0.5. */
  pluralityThreshold?: number;
}

/** Map a 0–23 local hour to a coarse day segment. */
export function hourToSegment(hour: number): DaySegment {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Derive a scheduling profile from real history.
 *
 * For each work type we collect the segments its events actually happened in and
 * keep the plurality segment when it clears both thresholds. Events without a
 * tracked hour contribute nothing (we can't know *when* they happened).
 */
export function buildSchedulingProfile(
  events: HistoryEvent[],
  opts: BuildProfileOptions = {},
): SchedulingProfile {
  const minSamples = opts.minSamples ?? 3;
  const pluralityThreshold = opts.pluralityThreshold ?? 0.5;

  const counts = new Map<WorkType, Record<DaySegment, number>>();
  let sampleCount = 0;

  for (const ev of events) {
    const hour = ev.startedHour;
    if (hour == null || !Number.isFinite(hour) || hour < 0 || hour > 23) continue;
    const wt = inferWorkType({ title: ev.title, tags: ev.tags ?? undefined });
    const seg = hourToSegment(hour);
    let bucket = counts.get(wt);
    if (!bucket) {
      bucket = { morning: 0, afternoon: 0, evening: 0 };
      counts.set(wt, bucket);
    }
    bucket[seg] += 1;
    sampleCount += 1;
  }

  const preferredSegmentByWorkType: Partial<Record<WorkType, DaySegment>> = {};
  for (const [wt, bucket] of counts) {
    const total = bucket.morning + bucket.afternoon + bucket.evening;
    if (total < minSamples) continue;
    const [winSeg, winCount] = (Object.entries(bucket) as [DaySegment, number][]).reduce(
      (best, cur) => (cur[1] > best[1] ? cur : best),
      ['morning', -1] as [DaySegment, number],
    );
    if (winCount / total >= pluralityThreshold) {
      preferredSegmentByWorkType[wt] = winSeg;
    }
  }

  return { preferredSegmentByWorkType, sampleCount };
}

/**
 * Resolve which segment a todo should aim for.
 *
 * An explicit `time_segment` on the task always wins (the user said so). When the
 * task is `anytime`/unset, fall back to the learned preference for its work type,
 * if one exists. Returns null when there's nothing to go on → whole-day window.
 */
export function resolveSegment(
  todo: { title: string; tags?: string[] | null; time_segment?: string | null },
  profile: SchedulingProfile | undefined,
): DaySegment | null {
  const explicit = todo.time_segment;
  if (explicit === 'morning' || explicit === 'afternoon' || explicit === 'evening') {
    return explicit;
  }
  if (!profile) return null;
  const wt = inferWorkType({ title: todo.title, tags: todo.tags ?? undefined });
  return profile.preferredSegmentByWorkType[wt] ?? null;
}

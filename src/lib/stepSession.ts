// Turning a step's just-ended timer session into a loggable moment window.
//
// Steps (sub-tasks) each carry a lightweight timer. When a step stops or is
// completed, its elapsed wall-clock time is folded into the step's accumulated
// `timer_seconds` and its `timer_started_at` marker is cleared — which DESTROYS
// the "when did this happen" information. That's why finished step work used to
// vanish from the plan timeline: nothing recorded the session's real position.
//
// This pure helper captures the just-ended session window (start → now) BEFORE
// that information is lost, so the caller can persist it as a focus-session
// moment tagged to the parent todo. The moment then flows through the existing
// moments → buildPlanBlocks pipeline and renders as a truthfully-positioned
// segment, grouped under the parent via `todo-session:<parentId>`.

const MAX_SESSION_MS = 24 * 60 * 60 * 1000; // 24h — beyond this, treat as a forgotten/corrupt timer, not a real session

export interface StepSessionWindow {
  /** ISO timestamp the running session started. */
  startISO: string;
  /** ISO timestamp the session ended (usually "now"). */
  endISO: string;
  /** Whole seconds elapsed in this session. */
  seconds: number;
}

/**
 * Compute the session window for a step that is stopping right now.
 *
 * Returns null (nothing to log) when:
 *   - the step has no running timer (`timer_started_at` absent),
 *   - the start timestamp is unparseable,
 *   - the elapsed time is below `minSeconds` (an accidental tap), or
 *   - the elapsed time exceeds 24h (a forgotten/corrupt timer — logging it would
 *     paint a giant phantom block, so we skip it just like the stale-timer guards
 *     elsewhere in the app).
 */
export function computeStepSession(
  step: { timer_started_at?: string | null },
  nowMs: number,
  minSeconds = 1,
): StepSessionWindow | null {
  const startedAt = step.timer_started_at;
  if (!startedAt) return null;

  const startMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startMs)) return null;

  const elapsedMs = nowMs - startMs;
  if (elapsedMs <= 0) return null;
  if (elapsedMs > MAX_SESSION_MS) return null;

  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < minSeconds) return null;

  return {
    startISO: new Date(startMs).toISOString(),
    endISO: new Date(nowMs).toISOString(),
    seconds,
  };
}

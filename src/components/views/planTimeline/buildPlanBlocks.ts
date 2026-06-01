import { parseISO } from 'date-fns';
import { extractLeadingEmoji } from '@/lib/emoji';
import { Todo } from '@/hooks/useTodos';
import { Moment } from '@/types';
import { ImportedEvent } from '@/hooks/useImportedEvents';
import { PLAN_TIMELINE_WAKE_TOTAL_MIN as WAKE_TOTAL_MIN } from '@/lib/planTimelineDayBounds';
import { TimeBlock, getTagIcon } from './planTimelinePrimitives';

/** Build the timeline blocks from todos, imported events and moments. Pure. */
export function buildPlanBlocks(
  todos: Todo[],
  importedEvents: ImportedEvent[] | undefined,
  moments: Moment[],
  activeTimerIds: Set<string> | undefined,
  getTimerElapsed: ((todoId: string) => number) | undefined,
): TimeBlock[] {
  const blocks: TimeBlock[] = [];

  todos
    .filter(t => !t.is_completed && (t.plan_started_at || t.timer_started_at))
    .forEach(t => {
      // Determine plan time range (纯计划也可以出现)
      let planStartMin: number | undefined;
      let planEndMin: number | undefined;
      if (t.plan_started_at) {
        const pd = parseISO(t.plan_started_at);
        planStartMin = pd.getHours() * 60 + pd.getMinutes();
        if (t.plan_ended_at) {
          const pe = parseISO(t.plan_ended_at);
          planEndMin = pe.getHours() * 60 + pe.getMinutes();
        }
      }

      // Determine actual time range（只有番茄钟/Actual 模式补记后才有）
      let actualStartMin: number | undefined;
      let actualEndMin: number | undefined;
      const hasPendingPlannedRun =
        !!t.plan_started_at &&
        !!t.timer_started_at &&
        !t.timer_ended_at &&
        (t.timer_seconds || 0) === 0 &&
        !activeTimerIds?.has(t.id); // if actively running, always show actual fill

      if (t.timer_started_at && !hasPendingPlannedRun) {
        const d = parseISO(t.timer_started_at);
        actualStartMin = d.getHours() * 60 + d.getMinutes();
        const liveElapsedSec = activeTimerIds?.has(t.id) && getTimerElapsed ? getTimerElapsed(t.id) : 0;
        let endMin = actualStartMin + 30;
        if (liveElapsedSec > 0) {
          endMin = actualStartMin + Math.ceil(liveElapsedSec / 60);
        } else if (t.timer_ended_at) {
          const e = parseISO(t.timer_ended_at);
          endMin = e.getHours() * 60 + e.getMinutes();
        } else if (t.timer_seconds && t.timer_seconds > 0) {
          endMin = actualStartMin + Math.ceil(t.timer_seconds / 60);
        }
        actualEndMin = endMin;
      }

      const hasPlan = !!planStartMin;
      const hasActual = !!actualStartMin;

      // 如果只有计划，用计划时间；如果有 actual，就按 plan/actual 包络算容器高度
      const basePlanStart = planStartMin ?? actualStartMin ?? WAKE_TOTAL_MIN;
      const basePlanEnd = planEndMin ?? (actualEndMin ?? (basePlanStart + 30));
      const baseActualStart = actualStartMin ?? basePlanStart;
      const baseActualEnd = actualEndMin ?? basePlanEnd;

      const blockStart = hasPlan && hasActual ? Math.min(basePlanStart, baseActualStart) : (hasPlan ? basePlanStart : baseActualStart);
      const blockEnd = hasPlan && hasActual ? Math.max(basePlanEnd, baseActualEnd) : (hasPlan ? basePlanEnd : baseActualEnd);

      blocks.push({
        id: t.id,
        title: t.title,
        startMin: blockStart,
        endMin: Math.max(blockEnd, blockStart + 10),
        type: 'plan',
        source: 'todo',
        tags: t.tags,
        photos: (t as any).photos,
        emoji: extractLeadingEmoji(t.title),
        progress: t.progress,
        planStartMin: hasPlan ? basePlanStart : undefined,
        planEndMin: hasPlan ? Math.max(basePlanEnd, basePlanStart + 10) : undefined,
        actualStartMin: hasActual ? baseActualStart : undefined,
        actualEndMin: hasActual ? Math.max(baseActualEnd, baseActualStart + 10) : undefined,
        hasActual,
        sessionGroupKey: `todo-session:${t.id}`,
      });
    });

  // Completed todos with time
  todos
    .filter(t => t.is_completed && (t.timer_started_at || t.plan_started_at))
    .forEach(t => {
      let planStartMin: number | undefined;
      let planEndMin: number | undefined;
      if (t.plan_started_at) {
        const pd = parseISO(t.plan_started_at);
        planStartMin = pd.getHours() * 60 + pd.getMinutes();
        if (t.plan_ended_at) {
          const pe = parseISO(t.plan_ended_at);
          planEndMin = pe.getHours() * 60 + pe.getMinutes();
        }
      }

      // Plan-only completion: never used the timer, just marked done
      if (!t.timer_started_at) {
        const planStart = planStartMin!;
        const planEnd = planEndMin ?? (planStart + 30);
        blocks.push({
          id: t.id,
          title: t.title,
          startMin: planStart,
          endMin: Math.max(planEnd, planStart + 5),
          type: 'plan',
          source: 'todo',
          isCompleted: true,
          tags: t.tags,
          photos: (t as any).photos,
          emoji: extractLeadingEmoji(t.title),
          progress: t.progress,
          planStartMin: planStart,
          planEndMin: Math.max(planEnd, planStart + 5),
          hasActual: false,
          sessionGroupKey: `todo-session:${t.id}`,
        });
        return;
      }

      const d = parseISO(t.timer_started_at!);
      let startMin = d.getHours() * 60 + d.getMinutes();
      let endMin = startMin + 5;
      if (t.timer_ended_at) {
        const e = parseISO(t.timer_ended_at);
        endMin = e.getHours() * 60 + e.getMinutes();
      } else if (t.timer_seconds && t.timer_seconds > 0) {
        endMin = startMin + Math.ceil(t.timer_seconds / 60);
      }

      // Capture whether a REAL plan exists BEFORE we apply any fallback.
      // Without this, a completed todo that was only timed (never dragged
      // into a plan slot) would still get phantom plan bounds equal to
      // the actual bounds — and render with both a dashed plan outline
      // AND the solid actual fill, even though the user never planned it.
      const hadRealPlan = planStartMin != null;
      const planStart = planStartMin ?? startMin;
      const planEnd = planEndMin ?? endMin;
      const blockStart = hadRealPlan ? Math.min(planStart, startMin) : startMin;
      const blockEnd = hadRealPlan ? Math.max(planEnd, endMin) : endMin;

      blocks.push({
        id: t.id,
        title: t.title,
        startMin: blockStart,
        endMin: Math.max(blockEnd, blockStart + 5),
        type: 'plan',
        source: 'todo',
        isCompleted: true,
        tags: t.tags,
        photos: (t as any).photos,
        emoji: extractLeadingEmoji(t.title),
        progress: t.progress,
        // Only emit plan bounds when a plan ACTUALLY existed. Otherwise
        // leave undefined so `hasPlan` in the renderer evaluates false
        // and the dashed plan box is suppressed (actual-only block).
        planStartMin: hadRealPlan ? planStart : undefined,
        planEndMin: hadRealPlan ? Math.max(planEnd, planStart + 5) : undefined,
        actualStartMin: startMin,
        actualEndMin: Math.max(endMin, startMin + 5),
        hasActual: true,
        sessionGroupKey: `todo-session:${t.id}`,
      });
    });

  // Imported events
  (importedEvents || []).forEach(ev => {
    const d = new Date(ev.start_time);
    const startMin = d.getHours() * 60 + d.getMinutes();
    let endMin = startMin + 60;
    if (ev.end_time) {
      const e = new Date(ev.end_time);
      endMin = e.getHours() * 60 + e.getMinutes();
    }
    blocks.push({
      id: `imported-${ev.id}`,
      title: ev.title,
      startMin,
      endMin: Math.max(endMin, startMin + 15),
      type: 'plan',
      source: 'imported',
      emoji: '📅',
      isCompleted: ev.is_completed,
    });
  });

  // Moments with time
  moments.forEach(m => {
    if (!m.timer_started_at) return;
    const d = parseISO(m.timer_started_at);
    const startMin = d.getHours() * 60 + d.getMinutes();
    let endMin = startMin + 5;
    if (m.timer_ended_at) {
      const e = parseISO(m.timer_ended_at);
      endMin = e.getHours() * 60 + e.getMinutes();
    }
    const sessionGroupKey = m.tags?.find(tag => tag.startsWith('todo-session:'));
    const isFocusSession = !!m.tags?.includes('focus-session');
    blocks.push({
      id: `moment-${m.id}`,
      title: m.text || m.emoji || 'Moment',
      startMin,
      endMin: Math.max(endMin, startMin + 5),
      type: 'plan',
      emoji: m.emoji || (isFocusSession ? getTagIcon(m.tags, m.text || undefined) : undefined),
      source: 'moment',
      isCompleted: isFocusSession,
      photos: m.photos,
      tags: m.tags,
      sessionGroupKey,
    });
  });

  // Deduplicate by id
  const seen = new Set<string>();
  return blocks.filter(b => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

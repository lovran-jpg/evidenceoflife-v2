import { describe, expect, it } from 'vitest';
import { selectRedundantEmptyCarriedIds } from '@/lib/carryTodos';
import type { Todo } from '@/hooks/useTodos';

function makeTodo(partial: Partial<Todo> & { id: string }): Todo {
  return {
    title: 'Task',
    date: '2026-07-05',
    time_segment: 'anytime',
    progress: 0,
    is_completed: false,
    due_date: null,
    sort_order: 0,
    created_at: '2026-07-05T09:00:00.000Z',
    timer_started_at: null,
    timer_ended_at: null,
    timer_seconds: 0,
    tags: [],
    plan_started_at: null,
    plan_ended_at: null,
    ...partial,
  };
}

const NO_STEPS = new Set<string>();

describe('selectRedundantEmptyCarriedIds', () => {
  it('returns nothing when there is nothing carried', () => {
    expect(selectRedundantEmptyCarriedIds([], [], NO_STEPS)).toEqual([]);
  });

  it('drops blank carried copies when today already has the same title', () => {
    const today = [makeTodo({ id: 'today', title: 'Modify my resume', date: '2026-07-08' })];
    const past = [
      makeTodo({ id: 'p5', title: 'Modify my resume', date: '2026-07-05' }),
      makeTodo({ id: 'p6', title: 'Modify my resume', date: '2026-07-06' }),
    ];
    expect(selectRedundantEmptyCarriedIds(today, past, NO_STEPS).sort()).toEqual(['p5', 'p6']);
  });

  it('NEVER deletes a row that has logged work, and drops the blank sibling', () => {
    const past = [
      makeTodo({ id: 'withTimer', title: 'Modify my resume', date: '2026-07-05', timer_seconds: 1200 }),
      makeTodo({ id: 'blank', title: 'Modify my resume', date: '2026-07-06' }),
    ];
    // The blank is redundant (the timer row is the survivor); the timer row stays.
    expect(selectRedundantEmptyCarriedIds([], past, NO_STEPS)).toEqual(['blank']);
  });

  it('keeps a row with progress and removes only the empty duplicate', () => {
    const past = [
      makeTodo({ id: 'prog', title: 'Write report', date: '2026-07-05', progress: 40 }),
      makeTodo({ id: 'blank', title: 'Write report', date: '2026-07-06' }),
    ];
    expect(selectRedundantEmptyCarriedIds([], past, NO_STEPS)).toEqual(['blank']);
  });

  it('treats a running timer (no seconds yet) as real work, never deleting it', () => {
    const past = [
      makeTodo({ id: 'running', title: 'Focus', date: '2026-07-05', timer_started_at: '2026-07-05T23:00:00.000Z' }),
      makeTodo({ id: 'blank', title: 'Focus', date: '2026-07-06' }),
    ];
    expect(selectRedundantEmptyCarriedIds([], past, NO_STEPS)).toEqual(['blank']);
  });

  it('treats a row with step children as real work, never deleting it', () => {
    const past = [
      makeTodo({ id: 'hasSteps', title: 'Plan trip', date: '2026-07-05' }),
      makeTodo({ id: 'blank', title: 'Plan trip', date: '2026-07-06' }),
    ];
    const withSteps = new Set(['hasSteps']);
    expect(selectRedundantEmptyCarriedIds([], past, withSteps)).toEqual(['blank']);
  });

  it('when every copy is blank, keeps the most recent and drops older blanks', () => {
    const past = [
      makeTodo({ id: 'p4', title: 'Buy milk', date: '2026-07-04' }),
      makeTodo({ id: 'p6', title: 'Buy milk', date: '2026-07-06' }),
      makeTodo({ id: 'p5', title: 'Buy milk', date: '2026-07-05' }),
    ];
    // p6 (newest) survives; p4 and p5 removed.
    expect(selectRedundantEmptyCarriedIds([], past, NO_STEPS).sort()).toEqual(['p4', 'p5']);
  });

  it('leaves a single blank carried task untouched', () => {
    const past = [makeTodo({ id: 'solo', title: 'Call dentist', date: '2026-07-05' })];
    expect(selectRedundantEmptyCarriedIds([], past, NO_STEPS)).toEqual([]);
  });

  it('does not delete across different titles', () => {
    const past = [
      makeTodo({ id: 'a', title: 'Task A', date: '2026-07-05' }),
      makeTodo({ id: 'b', title: 'Task B', date: '2026-07-06' }),
    ];
    expect(selectRedundantEmptyCarriedIds([], past, NO_STEPS)).toEqual([]);
  });

  it('is case- and whitespace-insensitive when grouping titles', () => {
    const today = [makeTodo({ id: 'today', title: '  modify MY resume ', date: '2026-07-08' })];
    const past = [makeTodo({ id: 'p5', title: 'Modify my resume', date: '2026-07-05' })];
    expect(selectRedundantEmptyCarriedIds(today, past, NO_STEPS)).toEqual(['p5']);
  });

  it('ignores completed carried rows entirely', () => {
    const past = [
      makeTodo({ id: 'doneRow', title: 'Old task', date: '2026-07-05', is_completed: true }),
      makeTodo({ id: 'blank', title: 'Old task', date: '2026-07-06' }),
    ];
    // Only one live blank remains → nothing to dedupe.
    expect(selectRedundantEmptyCarriedIds([], past, NO_STEPS)).toEqual([]);
  });
});

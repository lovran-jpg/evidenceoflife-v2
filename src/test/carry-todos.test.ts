import { describe, expect, it } from 'vitest';
import { mergeCarriedTodos, selectRedundantEmptyCarriedIds } from '@/lib/carryTodos';
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

describe('mergeCarriedTodos', () => {
  it('returns today\'s list untouched when nothing carried', () => {
    const todos = [makeTodo({ id: 'a', title: 'Today task', date: '2026-07-08' })];
    expect(mergeCarriedTodos(todos, [])).toBe(todos);
  });

  it('collapses the same title across multiple past days into one row', () => {
    const todos: Todo[] = [];
    const past = [
      makeTodo({ id: 'jul5', title: 'Modify my resume', date: '2026-07-05', timer_seconds: 1800 }),
      makeTodo({ id: 'jul6', title: 'Modify my resume', date: '2026-07-06' }),
    ];
    const merged = mergeCarriedTodos(todos, past);
    const resumes = merged.filter(t => t.title === 'Modify my resume');
    expect(resumes).toHaveLength(1);
    // The copy with real work logged (timer) wins over the empty one.
    expect(resumes[0].id).toBe('jul5');
  });

  it('prefers logged progress over a more recent empty copy', () => {
    const past = [
      makeTodo({ id: 'older', title: 'Write report', date: '2026-07-04', progress: 60 }),
      makeTodo({ id: 'newer', title: 'Write report', date: '2026-07-06' }),
    ];
    const merged = mergeCarriedTodos([], past);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('older');
  });

  it('falls back to the most recent day when work is equal', () => {
    const past = [
      makeTodo({ id: 'd4', title: 'Call bank', date: '2026-07-04' }),
      makeTodo({ id: 'd6', title: 'Call bank', date: '2026-07-06' }),
    ];
    const merged = mergeCarriedTodos([], past);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('d6');
  });

  it('drops a carried task already present in today\'s list (case/space-insensitive)', () => {
    const todos = [makeTodo({ id: 'today', title: 'Modify my resume', date: '2026-07-08' })];
    const past = [makeTodo({ id: 'jul5', title: '  modify MY resume ', date: '2026-07-05' })];
    const merged = mergeCarriedTodos(todos, past);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('today');
  });

  it('keeps genuinely different titles separate', () => {
    const past = [
      makeTodo({ id: 'a', title: 'Task A', date: '2026-07-05' }),
      makeTodo({ id: 'b', title: 'Task B', date: '2026-07-05' }),
    ];
    const merged = mergeCarriedTodos([], past);
    expect(merged).toHaveLength(2);
  });

  it('normalizes an invalid time_segment to anytime', () => {
    const past = [makeTodo({ id: 'x', title: 'Odd', date: '2026-07-05', time_segment: 'weird' as unknown as Todo['time_segment'] })];
    const merged = mergeCarriedTodos([], past);
    expect(merged[0].time_segment).toBe('anytime');
  });

  it('skips carried rows that are already completed', () => {
    const past = [makeTodo({ id: 'done', title: 'Finished', date: '2026-07-05', is_completed: true })];
    const merged = mergeCarriedTodos([], past);
    expect(merged).toHaveLength(0);
  });
});

describe('selectRedundantEmptyCarriedIds', () => {
  const noSteps = new Set<string>();

  it('removes a blank carried shell when today already has the same title', () => {
    const today = [makeTodo({ id: 'clone', title: 'Meditate', date: '2026-07-08' })];
    const past = [makeTodo({ id: 'shell', title: 'Meditate', date: '2026-07-05' })];
    expect(selectRedundantEmptyCarriedIds(today, past, noSteps)).toEqual(['shell']);
  });

  it('never deletes a recurring source, even as a blank shell with a today clone', () => {
    // Regression: the daily-clone chain breaks if the recurring SOURCE row is
    // deleted. A blank source on a past day + a same-title clone on today must
    // NOT flag the source as removable.
    const today = [makeTodo({ id: 'clone', title: 'Water plants', date: '2026-07-08' })];
    const past = [makeTodo({ id: 'source', title: 'Water plants', date: '2026-07-05', is_recurring: true })];
    expect(selectRedundantEmptyCarriedIds(today, past, noSteps)).toEqual([]);
  });
});

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, isSameDay, subDays } from 'date-fns';
import { hasTrackedFirstAction, markFirstActionTracked, trackEvent } from '@/lib/analytics';

export interface Todo {
  id: string;
  title: string;
  date: string;
  time_segment: 'morning' | 'afternoon' | 'evening' | 'anytime';
  progress: number;
  is_completed: boolean;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  timer_started_at: string | null;
  timer_ended_at: string | null;
  timer_seconds: number;
  tags: string[];
  plan_started_at: string | null;
  plan_ended_at: string | null;
  photos?: string[];
  location_name?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_category?: string | null;
  note?: string | null;
  habit_category?: string | null;
}

function buildDemoTodos(targetDate: string): Todo[] {
  const localTime = (time: string) => `${targetDate}T${time}:00`;

  return [
    {
      id: `demo-todo-1-${targetDate}`,
      title: 'Morning reset',
      date: targetDate,
      time_segment: 'morning',
      progress: 100,
      is_completed: true,
      due_date: null,
      sort_order: 0,
      created_at: localTime('06:45'),
      timer_started_at: localTime('07:12'),
      timer_ended_at: localTime('07:34'),
      timer_seconds: 22 * 60,
      tags: ['reset'],
      plan_started_at: localTime('06:45'),
      plan_ended_at: localTime('07:05'),
    },
    {
      id: `demo-todo-2-${targetDate}`,
      title: 'Draft project notes',
      date: targetDate,
      time_segment: 'afternoon',
      progress: 65,
      is_completed: false,
      due_date: null,
      sort_order: 1,
      created_at: localTime('07:20'),
      timer_started_at: localTime('07:48'),
      timer_ended_at: localTime('08:18'),
      timer_seconds: 30 * 60,
      tags: ['focus'],
      plan_started_at: localTime('07:20'),
      plan_ended_at: localTime('07:50'),
    },
    {
      id: `demo-todo-3-${targetDate}`,
      title: 'Call home',
      date: targetDate,
      time_segment: 'evening',
      progress: 100,
      is_completed: true,
      due_date: null,
      sort_order: 2,
      created_at: localTime('08:10'),
      timer_started_at: localTime('08:52'),
      timer_ended_at: localTime('09:18'),
      timer_seconds: 26 * 60,
      tags: ['life'],
      plan_started_at: localTime('08:10'),
      plan_ended_at: localTime('08:40'),
    },
  ];
}

function moveIsoToDateKeepingLocalTime(isoString: string | null | undefined, newDate: string): string | null {
  if (!isoString) return null;
  const original = new Date(isoString);
  if (Number.isNaN(original.getTime())) return null;
  const hh = String(original.getHours()).padStart(2, '0');
  const mm = String(original.getMinutes()).padStart(2, '0');
  const ss = String(original.getSeconds()).padStart(2, '0');
  return new Date(`${newDate}T${hh}:${mm}:${ss}`).toISOString();
}

export function useTodos(date?: string) {
  const { user, isDemo, authReady } = useAuth();
  const targetDate = date || format(new Date(), 'yyyy-MM-dd');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const rollOverYesterdayTodos = useCallback(async () => {
    if (!user || isDemo) return;
    if (!isSameDay(new Date(`${targetDate}T00:00:00`), new Date())) return;

    // Run the carry-over at most once per day per user. fetchTodos re-runs on
    // every tab switch / window focus / visibility change / minute sync, and
    // without this guard each of those re-issued the DB "move yesterday→today"
    // mutation — thrashing the data and making refreshes feel unstable. The
    // localStorage flag makes repeat fetches read-only.
    const rollKey = `todos-rollover-done:${user.id}:${targetDate}`;
    try {
      if (localStorage.getItem(rollKey)) return;
    } catch {
      /* localStorage unavailable — fall through and just run it */
    }

    const previousDate = format(subDays(new Date(`${targetDate}T00:00:00`), 1), 'yyyy-MM-dd');
    const { data: existingToday } = await supabase
      .from('todos')
      .select('sort_order')
      .eq('date', targetDate)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextSortOrder = ((existingToday?.[0]?.sort_order as number | undefined) ?? -1) + 1;
    const { data: carryovers, error } = await supabase
      .from('todos')
      .select('*')
      .eq('date', previousDate)
      .eq('is_completed', false)
      .is('due_date', null)
      .is('parent_due_id', null)
      .is('habit_category', null)
      .order('sort_order', { ascending: true });

    if (error) return;
    // Mark done even when there was nothing to carry over, so we don't re-query
    // on every refresh for the rest of the day.
    try { localStorage.setItem(rollKey, '1'); } catch { /* ignore */ }
    if (!carryovers?.length) return;

    // Only carry a task forward the day AFTER it was created. Once a task has
    // been rolled, its created_at no longer equals yesterday, so it won't be
    // rolled again — it stays put on its date instead of chasing "today"
    // forever. This stops weeks-old unfinished tasks from piling onto today.
    const freshlyDue = (carryovers as any[]).filter(
      (todo) => todo.created_at && format(new Date(todo.created_at), 'yyyy-MM-dd') === previousDate
    );
    if (!freshlyDue.length) return;

    await Promise.all(
      freshlyDue.map((todo, index) =>
        supabase
          .from('todos')
          .update({
            date: targetDate,
            sort_order: nextSortOrder + index,
            plan_started_at: moveIsoToDateKeepingLocalTime(todo.plan_started_at, targetDate),
            plan_ended_at: moveIsoToDateKeepingLocalTime(todo.plan_ended_at, targetDate),
          } as any)
          .eq('id', todo.id)
      )
    );
  }, [user, isDemo, targetDate]);

  const fetchTodos = useCallback(async () => {
    if (!authReady) {
      setLoading(true);
      return;
    }

    if (!user || isDemo) {
      setTodos(isDemo ? buildDemoTodos(targetDate) : []);
      setLoading(false);
      return;
    }

    try {
      await rollOverYesterdayTodos();

      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('date', targetDate)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        const filtered = (data as any[]).filter(t => !(t.due_date && !t.parent_due_id));
        setTodos(filtered as Todo[]);
      }
    } catch (err) {
      console.error('Failed to fetch todos (exception):', err);
    } finally {
      setLoading(false);
    }
  }, [user, targetDate, isDemo, authReady, rollOverYesterdayTodos]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const addTodo = useCallback(async (title: string, timeSegment: Todo['time_segment'] = 'anytime', dueDate?: string): Promise<Todo | null> => {
    if (!user) return null;
    const tempId = crypto.randomUUID();
    const optimistic: Todo = {
      id: tempId, title, date: targetDate, time_segment: timeSegment,
      progress: 0, is_completed: false, due_date: dueDate || null,
      sort_order: todos.length, created_at: new Date().toISOString(),
      timer_started_at: null, timer_ended_at: null, timer_seconds: 0,
      tags: [],
      plan_started_at: null, plan_ended_at: null,
    };
    setTodos(prev => [optimistic, ...prev]);

    if (isDemo) return optimistic;

    const { data, error } = await supabase
      .from('todos')
      .insert({
        user_id: user.id, title, date: targetDate,
        time_segment: timeSegment, due_date: dueDate || null,
        sort_order: todos.length,
      })
      .select()
      .single();
    if (!error && data) {
      const todo = data as Todo;
      setTodos(prev => prev.map(t => t.id === tempId ? todo : t));
      if (!hasTrackedFirstAction(user.id, 'todo_created')) {
        trackEvent('first_action', {
          action_type: 'todo_created',
        });
        markFirstActionTracked(user.id, 'todo_created');
      }
      return todo;
    } else {
      setTodos(prev => prev.filter(t => t.id !== tempId));
      return null;
    }
  }, [user, targetDate, todos.length, isDemo]);

  const updateTodo = useCallback(async (id: string, updates: Partial<Todo>) => {
    if (isDemo) {
      setTodos(prev => {
        const next = prev.map(t => t.id === id ? { ...t, ...updates } : t);
        if (updates.date && updates.date !== targetDate) {
          return next.filter(t => t.id !== id);
        }
        return next;
      });
      return;
    }
    // Optimistic update — apply immediately so UI reflects changes without DB round-trip delay
    setTodos(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      if (updates.date && updates.date !== targetDate) {
        return next.filter(t => t.id !== id);
      }
      return next;
    });
    await supabase
      .from('todos')
      .update(updates)
      .eq('id', id);
  }, [isDemo, targetDate]);

  const deleteTodo = useCallback(async (id: string) => {
    if (isDemo) {
      setTodos(prev => prev.filter(t => t.id !== id));
      return;
    }
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id);
    if (!error) {
      setTodos(prev => prev.filter(t => t.id !== id));
    }
  }, [isDemo]);

  const restoreTodo = useCallback(async (todo: Todo) => {
    // Re-insert a just-deleted todo (undo). Preserve original fields & order.
    setTodos(prev => {
      if (prev.some(t => t.id === todo.id)) return prev;
      const next = [...prev, todo];
      next.sort((a, b) => a.sort_order - b.sort_order);
      return next;
    });
    if (isDemo || !user) return;
    const { error } = await supabase
      .from('todos')
      .insert({
        id: todo.id, user_id: user.id, title: todo.title, date: todo.date,
        time_segment: todo.time_segment, progress: todo.progress,
        is_completed: todo.is_completed, due_date: todo.due_date,
        sort_order: todo.sort_order, created_at: todo.created_at,
        timer_started_at: todo.timer_started_at, timer_ended_at: todo.timer_ended_at,
        timer_seconds: todo.timer_seconds, tags: todo.tags,
        plan_started_at: todo.plan_started_at, plan_ended_at: todo.plan_ended_at,
      });
    if (error) {
      // DB restore failed — roll the optimistic re-insert back out
      setTodos(prev => prev.filter(t => t.id !== todo.id));
    }
  }, [isDemo, user]);

  const toggleComplete = useCallback(async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const newCompleted = !todo.is_completed;
    await updateTodo(id, { 
      is_completed: newCompleted,
      progress: newCompleted ? 100 : todo.progress,
    });
  }, [todos, updateTodo]);

  return { todos, loading, addTodo, updateTodo, deleteTodo, restoreTodo, toggleComplete, refetch: fetchTodos };
}

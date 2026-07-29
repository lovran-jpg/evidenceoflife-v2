export interface TodoDoneUndoFields {
  is_completed: boolean;
  progress: number;
  timer_started_at: string | null;
  timer_ended_at: string | null;
  timer_seconds: number | null;
}

export interface TodoDoneUndoSnapshot extends TodoDoneUndoFields {}

export function createTodoDoneUndoSnapshot(todo: TodoDoneUndoFields): TodoDoneUndoSnapshot {
  return {
    is_completed: todo.is_completed,
    progress: todo.progress,
    timer_started_at: todo.timer_started_at,
    timer_ended_at: todo.timer_ended_at,
    timer_seconds: todo.timer_seconds,
  };
}

export function restoreTodoDoneFromUndo(snapshot: TodoDoneUndoSnapshot): TodoDoneUndoFields {
  return {
    is_completed: snapshot.is_completed,
    progress: snapshot.progress,
    timer_started_at: snapshot.timer_started_at,
    timer_ended_at: snapshot.timer_ended_at,
    timer_seconds: snapshot.timer_seconds,
  };
}

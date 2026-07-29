import { describe, expect, it } from 'vitest';
import { createTodoDoneUndoSnapshot, restoreTodoDoneFromUndo } from '@/lib/todoDoneUndo';

describe('todo done undo snapshot', () => {
  it('restores done-related fields back to pre-complete state', () => {
    const before = {
      is_completed: false,
      progress: 35,
      timer_started_at: '2026-07-14T01:00:00.000Z',
      timer_ended_at: null,
      timer_seconds: 900,
    };
    const snapshot = createTodoDoneUndoSnapshot(before);

    const afterDone = {
      ...before,
      is_completed: true,
      progress: 100,
      timer_ended_at: '2026-07-14T02:00:00.000Z',
      timer_seconds: 3600,
    };

    const restored = restoreTodoDoneFromUndo(snapshot);
    const rolledBack = { ...afterDone, ...restored };

    expect(rolledBack).toEqual(before);
  });
});

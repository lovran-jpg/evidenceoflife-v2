ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_source_id uuid REFERENCES public.todos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_to_habit_id uuid REFERENCES public.todos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_todos_recurrence_source ON public.todos(recurrence_source_id);
CREATE INDEX IF NOT EXISTS idx_todos_is_recurring_user
  ON public.todos(user_id)
  WHERE is_recurring = true;


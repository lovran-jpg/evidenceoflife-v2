
-- Add parent_due_id to link daily plan entries back to a master due item
ALTER TABLE public.todos ADD COLUMN parent_due_id uuid DEFAULT NULL REFERENCES public.todos(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX idx_todos_parent_due_id ON public.todos(parent_due_id);

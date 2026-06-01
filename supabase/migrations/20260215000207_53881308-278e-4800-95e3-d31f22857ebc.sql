-- Add indexes to speed up queries
CREATE INDEX IF NOT EXISTS idx_moments_user_date ON public.moments (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_todos_user_date ON public.todos (user_id, date);
CREATE INDEX IF NOT EXISTS idx_moments_user_id ON public.moments (user_id);
CREATE INDEX IF NOT EXISTS idx_moments_user_date ON public.moments (user_id, date);
CREATE INDEX IF NOT EXISTS idx_moments_user_location ON public.moments (user_id) WHERE location_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos (user_id);
CREATE INDEX IF NOT EXISTS idx_todos_user_date ON public.todos (user_id, date);
ALTER TABLE public.todos 
ADD COLUMN IF NOT EXISTS plan_started_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS plan_ended_at timestamptz DEFAULT NULL;
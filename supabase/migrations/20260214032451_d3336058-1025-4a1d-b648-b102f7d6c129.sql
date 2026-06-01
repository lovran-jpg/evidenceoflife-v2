
-- Add timer tracking columns to todos
ALTER TABLE public.todos
ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS timer_ended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS timer_seconds INTEGER DEFAULT 0;


-- Add timer columns to moments table for pomodoro/time tracking
ALTER TABLE public.moments ADD COLUMN timer_started_at timestamptz DEFAULT NULL;
ALTER TABLE public.moments ADD COLUMN timer_ended_at timestamptz DEFAULT NULL;
ALTER TABLE public.moments ADD COLUMN timer_seconds integer DEFAULT 0;

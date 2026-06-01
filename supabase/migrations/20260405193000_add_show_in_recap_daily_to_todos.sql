ALTER TABLE public.todos
ADD COLUMN IF NOT EXISTS show_in_recap_daily boolean NOT NULL DEFAULT false;

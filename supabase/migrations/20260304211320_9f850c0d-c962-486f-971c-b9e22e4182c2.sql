
CREATE TABLE public.due_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  due_id uuid NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  reminder_type text NOT NULL DEFAULT 'browser', -- 'browser' or 'email'
  remind_before_minutes integer NOT NULL DEFAULT 1440, -- default 1 day = 1440 min
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_interval_days integer DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_notified_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, due_id, reminder_type)
);

ALTER TABLE public.due_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own due reminders" ON public.due_reminders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own due reminders" ON public.due_reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own due reminders" ON public.due_reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own due reminders" ON public.due_reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);

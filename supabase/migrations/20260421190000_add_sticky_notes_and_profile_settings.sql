ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.sticky_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'reminder',
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT sticky_notes_category_check CHECK (category IN ('reminder', 'free-time'))
);

ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sticky notes"
  ON public.sticky_notes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sticky notes"
  ON public.sticky_notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sticky notes"
  ON public.sticky_notes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sticky notes"
  ON public.sticky_notes
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_sticky_notes_updated_at ON public.sticky_notes;
CREATE TRIGGER update_sticky_notes_updated_at
  BEFORE UPDATE ON public.sticky_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.sticky_note_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.sticky_notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sticky_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sticky note items"
  ON public.sticky_note_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sticky note items"
  ON public.sticky_note_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sticky note items"
  ON public.sticky_note_items
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sticky note items"
  ON public.sticky_note_items
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_sticky_note_items_updated_at ON public.sticky_note_items;
CREATE TRIGGER update_sticky_note_items_updated_at
  BEFORE UPDATE ON public.sticky_note_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS sticky_notes_user_id_sort_order_idx
  ON public.sticky_notes (user_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS sticky_note_items_note_id_sort_order_idx
  ON public.sticky_note_items (note_id, sort_order, created_at);

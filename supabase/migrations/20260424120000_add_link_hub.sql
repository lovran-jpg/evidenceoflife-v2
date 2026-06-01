CREATE TABLE IF NOT EXISTS public.link_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  collapsed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.link_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own link groups"
  ON public.link_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own link groups"
  ON public.link_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own link groups"
  ON public.link_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own link groups"
  ON public.link_groups FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_link_groups_updated_at ON public.link_groups;
CREATE TRIGGER update_link_groups_updated_at
  BEFORE UPDATE ON public.link_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.link_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.link_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'General',
  collapsed BOOLEAN NOT NULL DEFAULT false,
  photos TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.link_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own link sections"
  ON public.link_sections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own link sections"
  ON public.link_sections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own link sections"
  ON public.link_sections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own link sections"
  ON public.link_sections FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_link_sections_updated_at ON public.link_sections;
CREATE TRIGGER update_link_sections_updated_at
  BEFORE UPDATE ON public.link_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.link_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.link_sections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  site_name TEXT,
  preview_image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.link_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own link items"
  ON public.link_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own link items"
  ON public.link_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own link items"
  ON public.link_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own link items"
  ON public.link_items FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_link_items_updated_at ON public.link_items;
CREATE TRIGGER update_link_items_updated_at
  BEFORE UPDATE ON public.link_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS link_groups_user_sort_idx ON public.link_groups (user_id, sort_order);
CREATE INDEX IF NOT EXISTS link_sections_group_sort_idx ON public.link_sections (group_id, sort_order);
CREATE INDEX IF NOT EXISTS link_items_section_sort_idx ON public.link_items (section_id, sort_order);

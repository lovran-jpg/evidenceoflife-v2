
-- Create table for imported calendar events (from ICS files)
CREATE TABLE public.imported_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  location TEXT,
  source_file TEXT NOT NULL, -- original filename for batch operations
  import_batch_id TEXT NOT NULL, -- group events from same import
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.imported_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own imported events"
ON public.imported_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own imported events"
ON public.imported_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own imported events"
ON public.imported_events FOR DELETE
USING (auth.uid() = user_id);

-- Optional V1 restaurant details. Existing places and visits remain untouched.
-- Google Place IDs may be stored; Google-derived coordinates must not be persisted here.
ALTER TABLE public.places
  ADD COLUMN address text,
  ADD COLUMN google_place_id text;

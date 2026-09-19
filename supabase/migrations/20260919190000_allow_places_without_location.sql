-- Phase 4A: a restaurant can be created with only a name.
-- The city foreign keys remain; when city_id is present, (city_id, user_id)
-- must still match a city owned by the same user.
ALTER TABLE public.places
  ALTER COLUMN city_id DROP NOT NULL,
  ALTER COLUMN lat DROP NOT NULL,
  ALTER COLUMN lng DROP NOT NULL;

-- Phase 2: optional restaurant visit details. Existing visits remain unchanged.
ALTER TABLE public.visits
  ADD COLUMN what_i_ate text,
  ADD COLUMN rating smallint,
  ADD CONSTRAINT visits_rating_range_check CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);

CREATE INDEX visits_user_id_date_idx ON public.visits (user_id, date);

-- Reversal, only after confirming no visit uses the new columns:
-- DROP INDEX public.visits_user_id_date_idx;
-- ALTER TABLE public.visits DROP CONSTRAINT visits_rating_range_check,
--   DROP COLUMN rating, DROP COLUMN what_i_ate;

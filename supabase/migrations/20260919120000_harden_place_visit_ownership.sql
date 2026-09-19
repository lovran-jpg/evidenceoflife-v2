-- Phase 1: ensure a child row can only reference a parent owned by the same user.
-- Existing single-column foreign keys remain in place for backwards compatibility.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.places p
    JOIN public.cities c ON c.id = p.city_id
    WHERE p.user_id <> c.user_id
  ) THEN
    RAISE EXCEPTION 'Cannot add places city ownership constraint: mismatched existing rows found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visits v
    JOIN public.places p ON p.id = v.place_id
    WHERE v.user_id <> p.user_id
  ) THEN
    RAISE EXCEPTION 'Cannot add visits place ownership constraint: mismatched existing rows found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.visits v
    JOIN public.moments m ON m.id = v.moment_id
    WHERE v.user_id <> m.user_id
  ) THEN
    RAISE EXCEPTION 'Cannot add visits moment ownership constraint: mismatched existing rows found';
  END IF;
END
$$;

ALTER TABLE public.cities
  ADD CONSTRAINT cities_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.places
  ADD CONSTRAINT places_id_user_id_key UNIQUE (id, user_id),
  ADD CONSTRAINT places_city_id_user_id_fkey
    FOREIGN KEY (city_id, user_id)
    REFERENCES public.cities (id, user_id)
    ON DELETE CASCADE;

ALTER TABLE public.moments
  ADD CONSTRAINT moments_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.visits
  ADD CONSTRAINT visits_place_id_user_id_fkey
    FOREIGN KEY (place_id, user_id)
    REFERENCES public.places (id, user_id)
    ON DELETE CASCADE,
  ADD CONSTRAINT visits_moment_id_user_id_fkey
    FOREIGN KEY (moment_id, user_id)
    REFERENCES public.moments (id, user_id);

CREATE INDEX places_city_id_user_id_idx
  ON public.places (city_id, user_id);

CREATE INDEX visits_place_id_user_id_idx
  ON public.visits (place_id, user_id);

CREATE INDEX visits_moment_id_user_id_idx
  ON public.visits (moment_id, user_id)
  WHERE moment_id IS NOT NULL;

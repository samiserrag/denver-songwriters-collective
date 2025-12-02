-- ===============================
-- EVENT TYPE ENUM
-- ===============================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
    CREATE TYPE event_type AS ENUM (
      'open_mic',
      'showcase',
      'song_circle',
      'workshop',
      'other'
    );
  END IF;
END
$$;


-- ===============================
-- VENUES TABLE
-- ===============================

CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  website_url TEXT,
  phone TEXT,
  google_maps_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ===============================
-- UPDATE TRIGGER FOR venues
-- ===============================

CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS venues_updated_at ON public.venues;

CREATE TRIGGER venues_updated_at
BEFORE UPDATE ON public.venues
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();


-- ===============================
-- ALTER events TABLE
-- ===============================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type event_type DEFAULT 'open_mic' NOT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS venue_id UUID;


-- Add FK for venue_id → venues(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'events_venue_id_fkey'
  ) THEN
    ALTER TABLE public.events
    ADD CONSTRAINT events_venue_id_fkey
      FOREIGN KEY (venue_id)
      REFERENCES public.venues(id)
      ON DELETE SET NULL;
  END IF;
END
$$;


-- ===============================
-- OPEN MIC CLAIMS TABLE
-- ===============================

CREATE TABLE IF NOT EXISTS public.open_mic_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===============================
-- PERFORMER COLLABORATION FIELDS
-- ===============================
-- Add fields for collaboration preferences, specialties, and favorite open mic

-- Add open_to_collabs boolean field
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS open_to_collabs BOOLEAN DEFAULT false;

-- Add specialties field (array of text for multiple specialties)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}';

-- Add favorite_open_mic field (free text for now, could reference events later)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_open_mic TEXT;

-- ===============================
-- SPOTLIGHT OPEN MICS
-- ===============================
-- Add is_spotlight field to events table for featuring open mics
-- (events already has is_featured, so we use that or add a separate spotlight field)

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_spotlight BOOLEAN DEFAULT false;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS spotlight_reason TEXT;

-- ===============================
-- COMMENTS
-- ===============================
COMMENT ON COLUMN public.profiles.open_to_collabs IS 'Whether the performer is open to collaborations';
COMMENT ON COLUMN public.profiles.specialties IS 'Array of specialties/services the performer offers (e.g., vocals, guitar, songwriting, production)';
COMMENT ON COLUMN public.profiles.favorite_open_mic IS 'The performer''s favorite Denver open mic';
COMMENT ON COLUMN public.events.is_spotlight IS 'Whether this event is a spotlight/featured open mic';
COMMENT ON COLUMN public.events.spotlight_reason IS 'Reason for spotlighting this open mic';

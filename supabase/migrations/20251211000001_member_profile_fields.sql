-- ==========================================================
-- ADD MEMBER PROFILE FIELDS
-- Migration: 20251211000001_member_profile_fields.sql
-- ==========================================================
-- Adds new fields to support a richer member directory:
-- - available_for_hire: Whether member is available for paid gigs
-- - interested_in_cowriting: Whether member wants to co-write
-- - genres: Array of music genres they play/write
-- - instruments: Array of instruments they play
-- - song_links: Array of links to their music (SoundCloud, Bandcamp, etc.)

-- Add available_for_hire field
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS available_for_hire BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.available_for_hire IS 'Whether this member is available for paid gigs/hire';

-- Add interested_in_cowriting field
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS interested_in_cowriting BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.interested_in_cowriting IS 'Whether this member is interested in co-writing sessions';

-- Add genres array field
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS genres TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.profiles.genres IS 'Array of music genres the member plays or writes';

-- Add instruments array field
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS instruments TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.profiles.instruments IS 'Array of instruments the member plays';

-- Add song_links array field
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS song_links TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.profiles.song_links IS 'Array of links to member songs (SoundCloud, Bandcamp, YouTube, etc.)';

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_profiles_available_for_hire
ON public.profiles(available_for_hire)
WHERE available_for_hire = true;

CREATE INDEX IF NOT EXISTS idx_profiles_interested_in_cowriting
ON public.profiles(interested_in_cowriting)
WHERE interested_in_cowriting = true;

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

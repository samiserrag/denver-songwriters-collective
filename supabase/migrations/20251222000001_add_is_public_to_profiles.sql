-- Add is_public flag to profiles for public visibility control
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- Backfill safety for any existing NULL values
UPDATE public.profiles
SET is_public = true
WHERE is_public IS NULL;

-- Index to support filtering by public visibility
CREATE INDEX IF NOT EXISTS profiles_is_public_idx ON public.profiles(is_public);

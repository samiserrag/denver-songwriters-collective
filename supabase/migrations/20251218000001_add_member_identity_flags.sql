-- Phase 3A: Add self-identification flags to profiles
-- Safe additive migration - no breaking changes
-- Part of member role simplification

-- 1. Add new boolean columns with defaults
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_songwriter BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_studio BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_fan BOOLEAN DEFAULT false;

-- 2. Backfill based on existing role values
UPDATE public.profiles SET is_songwriter = true WHERE role = 'performer';
UPDATE public.profiles SET is_studio = true WHERE role = 'studio';
UPDATE public.profiles SET is_fan = true WHERE role = 'fan';
-- Note: is_host already exists and is populated

-- 3. Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_songwriter ON public.profiles(is_songwriter) WHERE is_songwriter = true;
CREATE INDEX IF NOT EXISTS idx_profiles_is_studio ON public.profiles(is_studio) WHERE is_studio = true;
CREATE INDEX IF NOT EXISTS idx_profiles_is_fan ON public.profiles(is_fan) WHERE is_fan = true;

-- Verification query (run separately to check results):
-- SELECT
--   role,
--   COUNT(*) as total,
--   SUM(CASE WHEN is_songwriter THEN 1 ELSE 0 END) as songwriters,
--   SUM(CASE WHEN is_studio THEN 1 ELSE 0 END) as studios,
--   SUM(CASE WHEN is_fan THEN 1 ELSE 0 END) as fans,
--   SUM(CASE WHEN is_host THEN 1 ELSE 0 END) as hosts
-- FROM public.profiles
-- GROUP BY role;

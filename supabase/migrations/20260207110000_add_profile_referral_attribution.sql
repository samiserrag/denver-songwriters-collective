-- Phase 7B.1: Community invite attribution fields on profiles.
-- Share-first rollout stores referral source without introducing new tables.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_via text,
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS referral_captured_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_profile_id
  ON public.profiles(referred_by_profile_id);

CREATE INDEX IF NOT EXISTS idx_profiles_referral_captured_at
  ON public.profiles(referral_captured_at DESC);

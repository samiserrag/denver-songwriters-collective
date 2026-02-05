-- GTM-3.1: Add text ref columns for editorial slug/URL inputs
-- These are additive and nullable; legacy UUID/slug columns remain as fallback.

ALTER TABLE public.digest_editorial
  ADD COLUMN IF NOT EXISTS member_spotlight_ref TEXT,
  ADD COLUMN IF NOT EXISTS venue_spotlight_ref TEXT,
  ADD COLUMN IF NOT EXISTS blog_feature_ref TEXT,
  ADD COLUMN IF NOT EXISTS gallery_feature_ref TEXT,
  ADD COLUMN IF NOT EXISTS featured_happenings_refs TEXT[];

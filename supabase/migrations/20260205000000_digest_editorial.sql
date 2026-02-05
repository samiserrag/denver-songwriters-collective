-- GTM-3: Digest Editorial Content
--
-- Stores per-week editorial content for the weekly happenings digest.
-- Keyed by (week_key, digest_type) to allow one editorial per digest per week.
-- All content fields are nullable — email renders normally without editorial.
--
-- RLS enabled with no policies = service role only access
-- (same pattern as digest_settings).

CREATE TABLE IF NOT EXISTS public.digest_editorial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT NOT NULL,
  digest_type TEXT NOT NULL DEFAULT 'weekly_happenings',
  subject_override TEXT,
  intro_note TEXT,
  featured_happening_ids UUID[],
  member_spotlight_id UUID,
  venue_spotlight_id UUID,
  blog_feature_slug TEXT,
  gallery_feature_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  UNIQUE (week_key, digest_type)
);

ALTER TABLE public.digest_editorial ENABLE ROW LEVEL SECURITY;

-- Update updated_at on change
CREATE OR REPLACE FUNCTION update_digest_editorial_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER digest_editorial_updated_at
  BEFORE UPDATE ON public.digest_editorial
  FOR EACH ROW
  EXECUTE FUNCTION update_digest_editorial_updated_at();

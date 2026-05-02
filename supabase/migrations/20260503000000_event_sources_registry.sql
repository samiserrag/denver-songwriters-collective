-- Lane 6 Step 3a: event_sources registry table (inert, admin-only)
-- REVIEWED: policy change acknowledged
-- Source: docs/investigation/source-observation-step-3a-migration-brief.md
--
-- Adds public.event_sources, the registry backbone for the proposed
-- SOURCE-OBS-01 verification model. This is an inert schema slice:
--
-- - No application reader or writer.
-- - No trigger to maintain claim_status (deferred to step 3e).
-- - No SECURITY INVOKER public view (deferred until the first reader ships).
-- - Admin-only RLS policy; service_role bypasses RLS by default.
--
-- Active verification behavior is unchanged. last_verified_at IS NOT NULL
-- continues to drive the Confirmed/Unconfirmed badge per the
-- Phase 4.89 Confirmation Invariants in
-- .claude/rules/10-web-product-invariants.md. SOURCE-OBS-01 in
-- docs/CONTRACTS.md remains Draft / Proposed / Not Active.

-- ===========================================================================
-- Table
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.event_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'claimed_feed',
    'first_party_site',
    'first_party_calendar',
    'civic_calendar',
    'nonprofit_calendar',
    'aggregator_public',
    'ticket_page',
    'community_submission',
    'concierge_created'
  )),
  risk_tier TEXT NOT NULL CHECK (risk_tier IN ('A', 'B', 'C', 'D', 'E', 'F')),
  display_name TEXT NOT NULL,
  homepage_url TEXT,
  feed_url TEXT,
  robots_summary TEXT,
  terms_summary TEXT,
  default_cadence_minutes INTEGER NOT NULL,
  last_fetch_at TIMESTAMPTZ,
  last_fetch_status TEXT,
  claim_status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN (
    'unclaimed',
    'claimed_by_venue',
    'claimed_by_artist',
    'claimed_by_organization'
  )),
  claimed_by_venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  claimed_by_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  claimed_by_artist_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================================================
-- Comments — disambiguate registry from per-fetch observations
-- ===========================================================================

COMMENT ON TABLE public.event_sources IS
  'Registry of external data sources (one row per registered source). Per-fetch facts live in event_source_observations (added in step 3b). claim_status is a denormalized cache of approved claim rows; the maintenance trigger ships in step 3e.';

COMMENT ON COLUMN public.event_sources.claim_status IS
  'Denormalized cache of approved claim rows on venue_claims, organization_claims, and (future) artist_claims. Default ''unclaimed'' and inert until the maintenance trigger ships in step 3e. Do not populate manually.';

-- ===========================================================================
-- Indexes (per brief §4.2)
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_event_sources_type
  ON public.event_sources(type);
CREATE INDEX IF NOT EXISTS idx_event_sources_risk_tier
  ON public.event_sources(risk_tier);
CREATE INDEX IF NOT EXISTS idx_event_sources_claim_status
  ON public.event_sources(claim_status);

-- ===========================================================================
-- RLS — admin-only in step 3a (no readers exist yet)
-- ===========================================================================

ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_sources_admin_all ON public.event_sources;
CREATE POLICY event_sources_admin_all
ON public.event_sources
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ===========================================================================
-- updated_at trigger (SECURITY INVOKER by default; not a tripwire concern)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.update_event_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_sources_updated_at ON public.event_sources;
CREATE TRIGGER event_sources_updated_at
  BEFORE UPDATE ON public.event_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_sources_updated_at();

-- ===========================================================================
-- Privileges — service_role only; anon/authenticated access deferred
-- ===========================================================================
-- Step 3a explicitly avoids granting SELECT to anon or authenticated. The
-- brief's RLS posture in §5 references a public-facing surface via a
-- SECURITY INVOKER view (event_sources_public). That view ships in a later
-- step alongside the first reader. Until then, the table is reachable only
-- by the admin role (via the policy above) and service_role.

GRANT ALL ON public.event_sources TO service_role;

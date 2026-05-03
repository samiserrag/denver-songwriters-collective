-- Lane 6 Step 3b: event_source_observations append-only evidence ledger (inert)
-- REVIEWED: policy change acknowledged
-- Source brief: docs/investigation/source-observation-step-3b-observations-brief.md
-- Decisions:    docs/investigation/source-observation-step-3b-open-questions-decision-memo.md
--
-- Adds public.event_source_observations as the append-only evidence ledger
-- for what registered external sources said about events at a particular
-- moment in time. This is an inert schema slice in 3b:
--
-- - No application reader or writer.
-- - No public view (deferred until first reader ships).
-- - No immutability trigger (RLS-deny posture only per memo Q7).
-- - No claim_status / derivation / verification-state materialization.
-- - No conflict or possible_cancellation stored flags (derive at read time).
-- - Admin-read RLS only; service_role for crawler / Deduper / retention.
-- - event_id NULLABLE (memo Q1 record-then-match design); the Deduper agent
--   sets event_id later via a service_role UPDATE NULL -> uuid. That is
--   the only sanctioned mutation; once linked, the row is fully immutable.
-- - created_by_role CHECK enum has NO value for "user direct write" (memo
--   Q6); community corrections live in the proposed-change queue
--   (COMMUNITY-CORRECTION-01) and may produce observations only via a
--   crawler-fetch indirection of the cited URL.
-- - agent_run_id is a bare uuid; no FK, no CHECK in 3b (memo Q5). Future
--   agent_runs table ships with the crawler in a later step.
-- - raw_snapshot_ref nullable; storage backend deferred (memo Q5).
-- - No partitioning, no retention policy (memo Q3). Revisit at >10M rows
--   or 12 months operating time.
--
-- Active verification behavior is unchanged. last_verified_at IS NOT NULL
-- continues to drive the Confirmed/Unconfirmed badge per the Phase 4.89
-- Confirmation Invariants in .claude/rules/10-web-product-invariants.md.
-- SOURCE-OBS-01 in docs/CONTRACTS.md remains Draft / Proposed / Not Active.
-- event_audit_log (Lane 5 PR A) semantics are unchanged. Lane 5 PR B scope
-- is not expanded by this migration.

-- ===========================================================================
-- Table
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.event_source_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- event_id nullable per memo Q1 (record-then-match)
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.event_sources(id) ON DELETE RESTRICT,
  source_url TEXT NOT NULL,
  -- Denormalized snapshot of event_sources.type at observation time, for
  -- fast filter queries at derivation time.
  source_type TEXT NOT NULL,
  observation_type TEXT NOT NULL CHECK (observation_type IN (
    'found',
    'missing',
    'changed',
    'cancelled',
    'error'
  )),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observed_title TEXT,
  observed_start_at TIMESTAMPTZ,
  observed_end_at TIMESTAMPTZ,
  observed_venue_name TEXT,
  observed_location TEXT,
  observed_ticket_url TEXT,
  -- Long-tail jsonb of any extra raw key-value pairs the parser saw beyond
  -- the flat columns above. No normalized_fields jsonb (the flat columns
  -- ARE the normalized canonical shape, per brief §3.6).
  extracted_fields JSONB,
  extraction_confidence NUMERIC(4,3) CHECK (extraction_confidence BETWEEN 0 AND 1),
  source_confidence NUMERIC(4,3) CHECK (source_confidence BETWEEN 0 AND 1),
  content_hash TEXT,
  -- Storage backend deferred (memo Q5); column ships nullable.
  raw_snapshot_ref TEXT,
  -- created_by_role CHECK enum encodes COMMUNITY-CORRECTION-01 at the
  -- schema level: no value for "user direct write".
  created_by_role TEXT NOT NULL DEFAULT 'crawler' CHECK (created_by_role IN (
    'crawler',
    'admin_seed',
    'concierge_extract',
    'community_evidence_fetch'
  )),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Bare uuid in 3b; future agent_runs table ships with the crawler.
  agent_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================================================
-- Comments
-- ===========================================================================

COMMENT ON TABLE public.event_source_observations IS
  'Append-only evidence ledger of what registered external sources said about events at a particular moment. Each row is one source x one fetch x one event listing. Inputs to a future derivation function (SOURCE-OBS-01); not, on its own, a verification surface. Immutable: corrections happen by inserting a newer observation, not by mutating an old one. event_id NULLABLE allows record-then-match design (Deduper sets event_id later via service_role only).';

COMMENT ON COLUMN public.event_source_observations.event_id IS
  'NULL until the Deduper agent matches this observation to a CSC event. service_role-only UPDATE NULL -> uuid is the sole sanctioned mutation; once linked, the row is fully immutable.';

COMMENT ON COLUMN public.event_source_observations.created_by_role IS
  'Discriminates who/what generated the observation. CHECK enum has no value for "user direct write" - community corrections live in the proposed-change queue (COMMUNITY-CORRECTION-01) and may produce observations only via a crawler-fetch indirection of the cited URL, which carries community_evidence_fetch role and is written by service_role.';

COMMENT ON COLUMN public.event_source_observations.agent_run_id IS
  'Bare uuid in 3b; no FK or CHECK constraint. Future agent_runs (or equivalent crawl-runs registry) table ships with the crawler in a later step.';

COMMENT ON COLUMN public.event_source_observations.raw_snapshot_ref IS
  'Storage backend deferred (memo Q5). Column ships nullable; population is a later concern.';

COMMENT ON COLUMN public.event_source_observations.extracted_fields IS
  'Long-tail jsonb of any extra raw key-value pairs the parser saw beyond the flat observed_* columns. The flat columns are the normalized canonical shape; this jsonb captures anything else the parser produced. Not indexed in 3b (no GIN); add only when EXPLAIN evidence demands.';

-- ===========================================================================
-- Indexes (per brief §6 + memo decisions)
-- ===========================================================================

-- Newest observation per event (dominant derivation read pattern).
CREATE INDEX IF NOT EXISTS idx_event_source_observations_event_observed
  ON public.event_source_observations(event_id, observed_at DESC);

-- Per-source backlog (health dashboards, source-status queries).
CREATE INDEX IF NOT EXISTS idx_event_source_observations_source_observed
  ON public.event_source_observations(source_id, observed_at DESC);

-- Review-queue filter for missing / cancelled / error observation types.
CREATE INDEX IF NOT EXISTS idx_event_source_observations_observation_type
  ON public.event_source_observations(observation_type);

-- Deduper's unmatched candidate queue (memo Q1 partial index).
CREATE INDEX IF NOT EXISTS idx_event_source_observations_unmatched
  ON public.event_source_observations(observed_at DESC)
  WHERE event_id IS NULL;

-- Dedup of identical re-fetches across sources (non-unique).
CREATE INDEX IF NOT EXISTS idx_event_source_observations_content_hash
  ON public.event_source_observations(content_hash);

-- Deferred per memo:
--   * Composite covering index on (event_id, observation_type, observed_at DESC) (memo Q6 from prior cycle).
--   * GIN on extracted_fields (no jsonb query target in 3b).
--   * UNIQUE(event_id, source_id, content_hash) (data-model-plan §4.2; defer
--     until EXPLAIN ANALYZE evidence; may add via CREATE UNIQUE INDEX
--     CONCURRENTLY in a later step).

-- ===========================================================================
-- RLS - admin-read only in 3b; service_role bypass for crawler/Deduper/retention
-- ===========================================================================

ALTER TABLE public.event_source_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_source_observations_admin_select ON public.event_source_observations;
CREATE POLICY event_source_observations_admin_select
ON public.event_source_observations
FOR SELECT
TO authenticated
USING (public.is_admin());

-- No INSERT, UPDATE, or DELETE policies for any app role in 3b.
-- - anon: no policy = no access.
-- - authenticated (non-admin): no policy = no access.
-- - authenticated (admin): SELECT only via the policy above; no INSERT/UPDATE/DELETE.
-- - service_role: bypasses RLS by Postgres semantics; no explicit policy needed.
--
-- The Deduper's event_id NULL -> uuid UPDATE happens via service_role only,
-- gated by code review. No immutability trigger ships in 3b (memo Q7).

-- ===========================================================================
-- Privileges - service_role only; anon/authenticated have no grants
-- ===========================================================================
-- Step 3b explicitly avoids granting any privilege to anon or authenticated.
-- The brief's RLS table reserves authenticated-admin SELECT only via the
-- policy above (which already requires the authenticated role). No public
-- view ships in 3b. The first reader is the future derivation function,
-- which will read as service_role and digest a label for the API surface.

GRANT ALL ON public.event_source_observations TO service_role;

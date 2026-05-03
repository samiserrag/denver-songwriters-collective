-- Lane 6 Step 3c: event_change_log workflow surface (inert)
-- REVIEWED: policy change acknowledged
-- Source brief: docs/investigation/source-observation-step-3c-event-change-log-brief.md
-- Decisions:    docs/investigation/source-observation-step-3c-open-questions-decision-memo.md
--
-- Adds public.event_change_log as the proposed-change workflow surface for
-- the SOURCE-OBS-01 verification model. This is an inert schema slice in 3c:
--
-- - No application reader or writer.
-- - No public view (deferred until first reader ships).
-- - No claim_status / derivation / verification-state materialization.
-- - Admin SELECT + admin transition-constrained UPDATE; no anon/authenticated
--   INSERT/UPDATE/DELETE; no admin INSERT/DELETE in 3c; service_role bypass
--   for Trust agent / status-transition jobs / retention.
-- - event_id NOT NULL (memo Q1: deltas only exist for matched events).
-- - status workflow with BOTH RLS UPDATE policies AND a BEFORE UPDATE
--   trigger as defense-in-depth (memo Q2). Trigger applies to ALL roles
--   including service_role.
-- - field_name CHECK enum with 9-value initial allowlist (memo Q3).
-- - change_severity CHECK enum; emitted by the Trust agent at INSERT time;
--   immutable per row in 3c (memo Q4).
-- - applied_audit_log_id nullable uuid, no FK in 3c (memo Q5; matches the
--   agent_run_id forward-compat pattern from 3b).
-- - proposal_source CHECK enum has NO value for "user direct write"
--   (memo Q6); community corrections live in a separate future surface and
--   feed event_change_log only via service_role indirection.
-- - One row per (event, observation, field) (memo Q8); per-field status
--   independence is the primary design driver.
-- - No partitioning, no retention policy in 3c (memo Q7). Revisit at
--   >10M rows or 12 months operating time.
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

CREATE TABLE IF NOT EXISTS public.event_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- event_id NOT NULL per memo Q1: deltas only exist for matched events.
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- Every entry traces to a source observation (brief §3.3).
  observation_id UUID NOT NULL REFERENCES public.event_source_observations(id) ON DELETE CASCADE,
  -- Denormalized from observation for fast filter at review time (brief §3.4).
  source_id UUID NOT NULL REFERENCES public.event_sources(id) ON DELETE RESTRICT,
  -- field_name CHECK enum (memo Q3) — catches derivation bugs at the
  -- schema level. Widen via ALTER CONSTRAINT when new tracked fields ship.
  field_name TEXT NOT NULL CHECK (field_name IN (
    'title',
    'start_at',
    'end_at',
    'venue_id',
    'venue_name',
    'ticket_url',
    'status',
    'description',
    'organizer'
  )),
  current_value TEXT,
  proposed_value TEXT,
  -- change_severity (memo Q4) — emitted by Trust agent at INSERT;
  -- immutable per row.
  change_severity TEXT NOT NULL CHECK (change_severity IN (
    'minor',
    'material',
    'cancellation_risk'
  )),
  confidence NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  change_reason TEXT,
  -- proposal_source enum encodes COMMUNITY-CORRECTION-01 boundary at the
  -- schema level (memo Q6). NO value for "user direct write".
  proposal_source TEXT NOT NULL DEFAULT 'derivation' CHECK (proposal_source IN (
    'derivation',
    'admin_seed',
    'concierge_extract'
  )),
  -- Bare uuid in 3c; future derivation_runs (or equivalent) ships with
  -- the Step 4 derivation function (memo Q5 / agent_run_id pattern).
  derivation_run_id UUID,
  -- Status workflow. Transitions enforced by both RLS UPDATE policy
  -- (app-role) and a BEFORE UPDATE trigger (defense-in-depth across all
  -- roles including service_role). See triggers below.
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'rejected',
    'applied',
    'withdrawn',
    'superseded'
  )),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  -- Nullable uuid in 3c; no FK constraint (memo Q5). Future migration
  -- adds the FK to public.event_audit_log when link semantics stabilize.
  applied_audit_log_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================================================
-- Comments
-- ===========================================================================

COMMENT ON TABLE public.event_change_log IS
  'Proposed-change workflow surface for the SOURCE-OBS-01 verification model. Each row is one (event, observation, field) delta with workflow status (pending / approved / rejected / applied / withdrawn / superseded). NOT applied audit history — that lives in event_audit_log (Lane 5 PR A). Workflow-mutable: status transitions are constrained by RLS UPDATE policies (app-role) and a BEFORE UPDATE trigger (defense-in-depth across all roles including service_role). Inputs to a future derivation function (Step 4); not, on its own, a verification surface.';

COMMENT ON COLUMN public.event_change_log.event_id IS
  'NOT NULL: a delta only exists for a matched event (memo Q1). The Deduper sets event_id on the underlying observation before the Trust agent derives a delta.';

COMMENT ON COLUMN public.event_change_log.observation_id IS
  'NOT NULL FK to the source observation that produced this delta. Every change_log entry traces back to an observation.';

COMMENT ON COLUMN public.event_change_log.proposal_source IS
  'Discriminates who/what generated the proposal. CHECK enum has no value for "user direct write" — community corrections live in a separate future surface (per COMMUNITY-CORRECTION-01) and feed event_change_log only via service_role indirection.';

COMMENT ON COLUMN public.event_change_log.change_severity IS
  'Severity emitted by the Trust agent at INSERT time (memo Q4). Immutable per row in 3c; corrections happen by writing a new row with a different severity, not by UPDATEing this column.';

COMMENT ON COLUMN public.event_change_log.applied_audit_log_id IS
  'Nullable uuid in 3c; no FK constraint (memo Q5). Future migration adds the FK to public.event_audit_log when link semantics stabilize.';

COMMENT ON COLUMN public.event_change_log.derivation_run_id IS
  'Bare uuid in 3c; no FK constraint. Future derivation_runs (or equivalent) table ships with the Step 4 derivation function.';

COMMENT ON COLUMN public.event_change_log.status IS
  'Workflow state. Transitions: pending -> approved/rejected/withdrawn/superseded; approved -> applied. Direct pending -> applied is forbidden by trigger (must go through approved). Terminal states (applied, rejected, withdrawn, superseded) cannot transition back, enforced by the same trigger.';

-- Retention/partitioning intentionally deferred (memo Q7).
-- Revisit at >10M rows or 12 months operating time.

-- ===========================================================================
-- Indexes (per brief §6 + memo decisions)
-- ===========================================================================

-- Latest pending/approved entries per event — review queue.
CREATE INDEX IF NOT EXISTS idx_event_change_log_event_status_created
  ON public.event_change_log(event_id, status, created_at DESC);

-- Trace deltas back to the source observation.
CREATE INDEX IF NOT EXISTS idx_event_change_log_observation
  ON public.event_change_log(observation_id);

-- Per-source filter for review and health metrics.
CREATE INDEX IF NOT EXISTS idx_event_change_log_source
  ON public.event_change_log(source_id);

-- Review queue prioritization by status + severity.
CREATE INDEX IF NOT EXISTS idx_event_change_log_status_severity
  ON public.event_change_log(status, change_severity);

-- High-priority pending queue (partial index).
CREATE INDEX IF NOT EXISTS idx_event_change_log_pending_severity_created
  ON public.event_change_log(change_severity, created_at DESC)
  WHERE status = 'pending';

-- Deferred per memo / brief:
--   * Composite (event_id, field_name, status) for "latest pending proposal
--     per (event, field)" — defer until EXPLAIN ANALYZE evidence.
--   * GIN — no jsonb in this table.
--   * Partitioning — deferred (memo Q7).

-- ===========================================================================
-- updated_at trigger (matches existing claim-table pattern)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.update_event_change_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_change_log_updated_at ON public.event_change_log;
CREATE TRIGGER event_change_log_updated_at
  BEFORE UPDATE ON public.event_change_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_change_log_updated_at();

-- ===========================================================================
-- Status transition validation trigger (memo Q2 defense-in-depth)
-- ===========================================================================
-- Enforces workflow invariants regardless of role (including service_role,
-- which bypasses RLS). Raises an exception on:
--   * Transitions out of terminal states (applied / rejected / withdrawn /
--     superseded). Terminal means terminal.
--   * Direct pending -> applied. Approved must come first.
--
-- All other transitions are permitted (pending -> approved / rejected /
-- withdrawn / superseded; approved -> applied). The trigger does not
-- restrict same-status UPDATEs (no transition).

CREATE OR REPLACE FUNCTION public.event_change_log_validate_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('applied', 'rejected', 'withdrawn', 'superseded') THEN
    RAISE EXCEPTION 'event_change_log: cannot transition out of terminal status %', OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'pending' AND NEW.status = 'applied' THEN
    RAISE EXCEPTION 'event_change_log: direct pending -> applied transition is not allowed; status must transition through approved'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_change_log_validate_transition ON public.event_change_log;
CREATE TRIGGER event_change_log_validate_transition
  BEFORE UPDATE ON public.event_change_log
  FOR EACH ROW
  EXECUTE FUNCTION public.event_change_log_validate_transition();

-- ===========================================================================
-- RLS — admin-read + admin transition-constrained UPDATE; service_role bypass
-- ===========================================================================

ALTER TABLE public.event_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_change_log_admin_select ON public.event_change_log;
CREATE POLICY event_change_log_admin_select
ON public.event_change_log
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Admin can UPDATE only pending rows, and only to approved or rejected.
-- Other transitions (pending -> withdrawn / superseded; approved -> applied)
-- happen via service_role under code review.
DROP POLICY IF EXISTS event_change_log_admin_update ON public.event_change_log;
CREATE POLICY event_change_log_admin_update
ON public.event_change_log
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  AND status = 'pending'
)
WITH CHECK (
  public.is_admin()
  AND status IN ('approved', 'rejected')
);

-- No INSERT or DELETE policies for any app role in 3c.
-- - anon: no policy = no access.
-- - authenticated (non-admin): no policy = no access.
-- - authenticated (admin): SELECT + transition-constrained UPDATE only.
-- - service_role: bypasses RLS by Postgres semantics.
--
-- The transition-validation trigger applies to ALL roles including
-- service_role.

-- ===========================================================================
-- Privileges — service_role only; anon/authenticated have no grants
-- ===========================================================================
-- Step 3c follows the same pattern as 3a / 3b: anon/authenticated have only
-- the Supabase-default schema-level grants (basic CRUD), and RLS is the
-- actual enforcement gate. No GRANT to anon/authenticated added here.

GRANT ALL ON public.event_change_log TO service_role;

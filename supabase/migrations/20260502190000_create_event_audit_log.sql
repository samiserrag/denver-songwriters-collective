-- Event Audit Log (Lane 5 PR A)
--
-- Implements the schema approved in:
--   docs/investigation/event-audit-and-admin-alerts.md          (PR #193)
--   docs/investigation/event-audit-and-admin-alerts-decision-memo.md (PR #203)
--
-- Sami's §7 answers (decision memo §2.2 + §2.5 / decision memo §3 trust-layer):
--   * ON DELETE SET NULL on event_id (NOT cascade) so audit rows survive
--     event deletion. Denormalized event snapshot fields preserve enough
--     context to investigate after the parent row is gone.
--   * RLS: server-side service-role insert only. Authenticated/anon insert
--     denied so client-forged audit rows are impossible. Read for admins
--     and accepted hosts/cohosts of the event.
--   * No UPDATE / DELETE policy → rows are immutable from the API. Cleanup
--     is per-role retention and ships in PR B (suspicion scorer + cleanup).
--   * Retention is by actor_role only, never by host payment tier
--     (Trust Layer Invariant in .claude/rules/00-governance-and-safety.md).
--
-- This migration creates the table and policies only. The server-side
-- helper (web/src/lib/audit/eventAudit.ts) and route hooks ship in the
-- same PR but are gated behind EVENT_AUDIT_LOG_ENABLED, so this migration
-- is forward-safe to apply before the helper is enabled.
--
-- REVIEWED: policy change acknowledged
--
-- ----------------------------------------------------------------------
-- Runtime RLS smoke queries (run after apply per
-- .claude/rules/30-supabase-migrations-and-deploy.md):
--
--   -- 1. Service role insert succeeds (run as service role):
--   INSERT INTO event_audit_log
--     (event_id, event_id_at_observation, actor_id, actor_role, action,
--      source, changed_fields)
--   VALUES
--     (NULL, gen_random_uuid(), NULL, 'service', 'create', 'service_role',
--      '[]'::jsonb)
--   RETURNING id;
--
--   -- 2. Authenticated insert blocked (run as authenticated, expect error):
--   INSERT INTO event_audit_log
--     (event_id, event_id_at_observation, actor_role, action, source,
--      changed_fields)
--   VALUES
--     (NULL, gen_random_uuid(), 'host', 'create', 'manual_form',
--      '[]'::jsonb);
--   -- expect: new row violates row-level security policy
--
--   -- 3. Anon insert blocked (run as anon, expect error):
--   -- same as (2) — should fail with the same RLS violation.
--
--   -- 4. Admin SELECT succeeds (run as authenticated where profile.role='admin'):
--   SELECT count(*) FROM event_audit_log;
--   -- expect: row count, no error
--
--   -- 5. Host SELECT scoped to their events succeeds:
--   SELECT count(*) FROM event_audit_log
--   WHERE event_id IN (
--     SELECT event_id FROM event_hosts
--     WHERE user_id = auth.uid() AND invitation_status = 'accepted'
--   );
--   -- expect: row count for their events only.
--
--   -- 6. Non-host authenticated user gets zero rows:
--   SELECT count(*) FROM event_audit_log;
--   -- expect: 0 (RLS hides everything they can't see).
-- ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS event_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Live FK to events. SET NULL on event delete so the audit row
  -- outlives the parent row. The denormalized snapshot fields below
  -- carry enough context to investigate a deleted event.
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,

  -- Denormalized event snapshot (populated at audit-write time, never
  -- nulled). Minimal — these are the fields the deleted-event
  -- investigation flow needs and nothing more (decision memo §2.5
  -- "Keep this minimal; do not turn the audit row into a full event
  -- copy").
  event_id_at_observation uuid NOT NULL,
  event_title_at_observation text,
  event_slug_at_observation text,
  event_start_date_at_observation text, -- ISO date YYYY-MM-DD
  event_venue_name_at_observation text,

  -- Actor identity. actor_id is FK so we can join to profiles for the
  -- admin browser later, but SET NULL on user delete so audit rows
  -- survive account deletion too.
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL CHECK (
    actor_role IN ('host', 'cohost', 'admin', 'service', 'import', 'anon', 'unknown')
  ),

  -- What happened.
  action text NOT NULL CHECK (
    action IN (
      'create', 'update', 'delete', 'publish', 'unpublish',
      'cancel', 'restore', 'cover_update'
    )
  ),

  -- Where the change came from. Additional sources land in PR B/C.
  source text NOT NULL CHECK (
    source IN (
      'manual_form', 'ai_chat', 'ai_edit', 'api',
      'admin_console', 'import', 'service_role'
    )
  ),

  -- Diff payload from web/src/lib/events/computePatchDiff.ts. Empty
  -- array for create/delete actions where the field-level diff is not
  -- meaningful.
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Hash of the prior event row (web/src/lib/events/editTurnTelemetry.ts
  -- hashPriorState helper). Used for cross-correlating with Axiom
  -- [edit-turn-telemetry] events.
  prior_hash text,

  -- One-line human summary, e.g. "venue: Lost Lake → Larimer Lounge".
  summary text,

  -- Request context for forensics. ip_hash is sha256(ip + per-day salt)
  -- so velocity scoring works without storing IP plaintext (decision
  -- memo §4.1 privacy mitigation).
  request_id text,
  ip_hash text,
  user_agent_class text, -- 'browser' / 'mobile' / 'bot' / 'unknown'

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE event_audit_log IS
  'Per-write audit trail for event mutations. Inserted server-side via service role. Read by admins and accepted hosts/cohosts of the event. ON DELETE SET NULL preserves rows after event delete; denormalized event snapshot covers deleted-event investigation. See docs/investigation/event-audit-and-admin-alerts*.md.';

COMMENT ON COLUMN event_audit_log.event_id IS
  'Live FK to events; SET NULL on event delete. Use event_id_at_observation for forensic joins on deleted events.';

COMMENT ON COLUMN event_audit_log.event_id_at_observation IS
  'Original event id captured at audit-write time. Never nulled; survives event row deletion.';

COMMENT ON COLUMN event_audit_log.changed_fields IS
  'Output shape of computePatchDiff(prevEvent, nextEvent). Empty array for create/delete actions.';

COMMENT ON COLUMN event_audit_log.ip_hash IS
  'sha256(remote_ip || daily_salt). Stored hashed so velocity scoring works without retaining the plaintext IP.';

-- Indexes per investigation §3 PR A:
--   * (event_id, created_at) — host audit-history surface (PR C, future).
--   * (event_id_at_observation, created_at) — same for deleted events.
--   * (actor_id, created_at) — actor-velocity scoring (PR B).
--   * (source, created_at) — analytics by origin.
--   * (created_at) — admin browser default sort.
CREATE INDEX IF NOT EXISTS idx_event_audit_log_event_id_created
  ON event_audit_log (event_id, created_at DESC)
  WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_audit_log_event_id_at_obs_created
  ON event_audit_log (event_id_at_observation, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_audit_log_actor_id_created
  ON event_audit_log (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_audit_log_source_created
  ON event_audit_log (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_audit_log_created_at
  ON event_audit_log (created_at DESC);

ALTER TABLE event_audit_log ENABLE ROW LEVEL SECURITY;

-- Block all client-side writes. The audit helper writes with the service
-- role key, which bypasses RLS by design. This deny-by-default policy
-- ensures no client (authenticated host, anon, or otherwise) can forge
-- or alter audit rows. Distinct from the wide-open app_logs policy
-- (decision memo §2.3 reasoning).
CREATE POLICY "no client inserts on event_audit_log"
  ON event_audit_log
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

-- Audit rows are immutable. No UPDATE policy → no client UPDATE.
-- (Service role can update if a future migration genuinely needs it.)
-- No DELETE policy → no client DELETE. PR B retention cleanup will run
-- via the service role.

-- Admins read everything. Mirrors the moderation/audit pattern in
-- web/src/lib/audit/moderationAudit.ts callers.
CREATE POLICY "admins read all event_audit_log"
  ON event_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Hosts/cohosts read audit rows for events they manage. Joined via
-- event_hosts with accepted invitation status — same pattern used by
-- canManageEvent server-side.
CREATE POLICY "hosts read event_audit_log for their events"
  ON event_audit_log
  FOR SELECT
  TO authenticated
  USING (
    event_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM event_hosts
      WHERE event_hosts.event_id = event_audit_log.event_id
        AND event_hosts.user_id = auth.uid()
        AND event_hosts.invitation_status = 'accepted'
    )
  );

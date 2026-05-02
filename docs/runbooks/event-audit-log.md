# Event Audit Log Runbook (PR A — flag-on, soak window)

**Status:** PR A live in production · `EVENT_AUDIT_LOG_ENABLED=true` · 7-day technical soak active.
**Soak start:** `2026-05-02T20:49:31.590Z`
**Earliest PR B eligibility:** `2026-05-09T20:49:31.590Z` AND explicit Sami "go".

This runbook covers operational tasks for the event audit log shipped in PR #210 (merge commit `cadd9f69`). It does **not** authorize PR B (suspicion scorer + admin email/digest) or PR C (admin browser UI / public transparency line / RSS / JSON / MCP / retention cleanup / trust-layer surfaces). Those remain blocked until the gates in §11 are met.

The canonical investigation + decision references for this work are:

- [`docs/investigation/event-audit-and-admin-alerts.md`](../investigation/event-audit-and-admin-alerts.md) — investigation
- [`docs/investigation/event-audit-and-admin-alerts-decision-memo.md`](../investigation/event-audit-and-admin-alerts-decision-memo.md) — Sami's §7 answers
- Trust Layer Invariant in [`.claude/rules/00-governance-and-safety.md`](../../.claude/rules/00-governance-and-safety.md)
- Migration apply rules in [`.claude/rules/30-supabase-migrations-and-deploy.md`](../../.claude/rules/30-supabase-migrations-and-deploy.md)
- Axiom field conventions in [`.claude/rules/40-ops-observability-and-debug.md`](../../.claude/rules/40-ops-observability-and-debug.md)

---

## 1. Current production state

| Item | Value |
|---|---|
| PR A merge commit | `cadd9f69` (PR #210) |
| Migration applied | `20260502190000_create_event_audit_log.sql` |
| Migration recorded in `supabase_migrations.schema_migrations` | yes (verified 2026-05-02) |
| Helper module | [`web/src/lib/audit/eventAudit.ts`](../../web/src/lib/audit/eventAudit.ts) |
| Route hooks live | POST `/api/my-events`, PATCH/DELETE `/api/my-events/[id]`, POST `/api/my-events/[id]/overrides` |
| Vercel env var | `EVENT_AUDIT_LOG_ENABLED=true` (Production scope; Sensitive) |
| Production deploy with flag baked in | first verified at `dpl_3Ydmq7reCLPve5CqXVhdFa49Szj4` (no-cache redeploy) |
| First real audit row | `id=66534fb7-d1a8-4141-ad7e-bac1e37a9512`, `created_at=2026-05-02T20:49:31.590Z` |
| Daily soak monitor routine | `trig_01VWvwddJMf1HesDy6a78CAa` — daily 9:07am MT, read-only |

---

## 2. Flag / env behavior

The helper short-circuits on a strict equality check at the top of `logEventAudit`:

```ts
// web/src/lib/audit/eventAudit.ts
export function isEventAuditLogEnabled(): boolean {
  return process.env.EVENT_AUDIT_LOG_ENABLED === "true";
}
```

Behavior:

- `EVENT_AUDIT_LOG_ENABLED === "true"` (literal lowercase string) → helper writes audit rows + emits `[event-audit]` to Axiom.
- Any other value (`"True"`, `"TRUE"`, `"1"`, `"yes"`, `" true"`, unset) → helper returns silently, no `[event-audit]` log line, no DB row, no `[event-audit-failed]`. **Both silences mean the same thing: flag did not evaluate to `true`.**
- Route handlers always call the helper. The flag check lives entirely inside the helper. PATCH / POST / DELETE responses never block on audit success or failure.

The env var is marked **Sensitive** in Vercel — value cannot be revealed in the UI, only edited/replaced. To verify the value end-to-end, run a real PATCH and check for the `[event-audit]` log line + DB row (see §5 `quick-smoke` block).

---

## 3. Migration / table / policy summary

### Schema (DDL summary)

```sql
CREATE TABLE event_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Live FK; SET NULL on event delete so audit rows survive forensics
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,

  -- Denormalized event snapshot (written at audit time, never nulled)
  event_id_at_observation         uuid NOT NULL,
  event_title_at_observation      text,
  event_slug_at_observation       text,
  event_start_date_at_observation text,
  event_venue_name_at_observation text,

  -- Actor identity
  actor_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL CHECK (
    actor_role IN ('host','cohost','admin','service','import','anon','unknown')
  ),

  -- Intent
  action text NOT NULL CHECK (
    action IN ('create','update','delete','publish','unpublish','cancel','restore','cover_update')
  ),
  source text NOT NULL CHECK (
    source IN ('manual_form','ai_chat','ai_edit','api','admin_console','import','service_role')
  ),

  -- Diff payload (computePatchDiff output) + correlation
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  prior_hash     text,
  summary        text,

  -- Request context
  request_id       text,                         -- Vercel x-vercel-id
  ip_hash          text,                         -- sha256(ip + per-day salt) — never plaintext
  user_agent_class text,                         -- 'browser' / 'mobile' / 'bot' / 'unknown'

  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Indexes

| Name | Purpose |
|---|---|
| `idx_event_audit_log_event_id_created` | host audit-history surface (PR C) |
| `idx_event_audit_log_event_id_at_obs_created` | same for deleted events |
| `idx_event_audit_log_actor_id_created` | actor-velocity scoring (PR B) |
| `idx_event_audit_log_source_created` | analytics by origin |
| `idx_event_audit_log_created_at` | admin browser default sort |

### RLS policies (3 SELECT/INSERT only — no UPDATE/DELETE policy → rows immutable from API)

| Policy | Operation | Roles | Effect |
|---|---|---|---|
| `no client inserts on event_audit_log` | INSERT | `authenticated`, `anon` | `WITH CHECK (false)` — denies forged audit rows. Service role bypasses RLS by design and writes via the helper. |
| `admins read all event_audit_log` | SELECT | `authenticated` where `profiles.role = 'admin'` | Full read. |
| `hosts read event_audit_log for their events` | SELECT | `authenticated` where joined to `event_hosts` with `invitation_status='accepted'` | Scoped read for hosts/cohosts. `event_id IS NULL` rows are not visible to hosts (intentional — deleted-event forensics is admin-only). |

### Decision-memo invariants encoded by this schema

- `ON DELETE SET NULL` on `event_id` (Sami §7 #6) + denormalized snapshot → audit rows survive event deletion.
- Retention by `actor_role` only (Sami §7 #4) → never by payment tier (Trust Layer Invariant).
- Flag default-off (Sami §7 #9) → forward-safe to apply migration before flipping.

---

## 4. Axiom queries

Dataset: `vercel-runtime`. Confirm CLI auth with `axiom auth status axiom`.

### 4.1 Successful audit-hook fires

```bash
# Last 24h — all [event-audit] events
axiom query "['vercel-runtime'] | where message contains '[event-audit]' | sort by _time desc | take 20" --start-time -24h

# Last 24h — count
axiom query "['vercel-runtime'] | where message contains '[event-audit]' | summarize count()" --start-time -24h

# Since soak start (paste the timestamp into start-time)
axiom query "['vercel-runtime'] | where message contains '[event-audit]' | summarize count()" --start-time 2026-05-02T20:49:31Z
```

### 4.2 Audit-hook failure events (insert path errored after flag check passed)

```bash
# Last 24h — count (expected 0 during soak)
axiom query "['vercel-runtime'] | where message contains '[event-audit-failed]' | summarize count()" --start-time -24h

# Last 24h — full payloads
axiom query "['vercel-runtime'] | where message contains '[event-audit-failed]' | sort by _time desc | take 10" --start-time -24h

# Since soak start
axiom query "['vercel-runtime'] | where message contains '[event-audit-failed]' | sort by _time desc | take 50" --start-time 2026-05-02T20:49:31Z
```

The `[event-audit-failed]` prefix is emitted by the helper from three error paths: payload-build failure, missing Supabase env vars, and DB insert error. Any non-zero count during soak should be investigated against the helper source before flipping the flag off.

### 4.3 Cross-correlate audit fires with PATCH 5xx

```bash
# Last 24h — 5xx PATCHes against the events API (any cause, not just audit)
axiom query "['vercel-runtime'] | where path == '/api/my-events/[id]' and proxy.method == 'PATCH' and proxy.statusCode >= 500 | sort by _time desc | take 20" --start-time -24h
```

If a 5xx coincides in time with an `[event-audit-failed]` line for the same `requestId`, the audit hook is implicated. The helper is fire-and-forget per investigation §4.1, so this should be vanishingly rare; investigate before continuing soak.

### 4.4 Filter by deployment (after a redeploy)

```bash
axiom query "['vercel-runtime'] | where message contains 'event-audit' and deploymentId == '<dpl_id>' | sort by _time desc | take 20" --start-time -1h
```

---

## 5. SQL queries (Supabase Management API or `psql`)

All queries are **SELECT-only** during soak. Project ref: `oipozdbfxyskoscsgbfq`.

### 5.1 Row counts by enum

```sql
-- Total rows
SELECT count(*) FROM event_audit_log;

-- By actor_role
SELECT actor_role, count(*) FROM event_audit_log GROUP BY actor_role ORDER BY count(*) DESC;

-- By source
SELECT source, count(*) FROM event_audit_log GROUP BY source ORDER BY count(*) DESC;

-- By action
SELECT action, count(*) FROM event_audit_log GROUP BY action ORDER BY count(*) DESC;

-- Combined dimension grid
SELECT actor_role, source, action, count(*)
FROM event_audit_log
GROUP BY actor_role, source, action
ORDER BY count(*) DESC;
```

### 5.2 Recent rows + sample changed_fields

```sql
SELECT id, action, source, actor_role, summary,
       jsonb_array_length(changed_fields) AS field_count,
       created_at
FROM event_audit_log
ORDER BY created_at DESC
LIMIT 10;

-- Inspect changed_fields shape on a specific row
SELECT changed_fields
FROM event_audit_log
WHERE id = '<row-uuid>';
```

Each `changed_fields` entry should have: `field`, `kind` (`scalar` | `array`), `risk_tier` (`low` | `medium` | `high`), `enforcement_mode` (`shadow` | `enforced`), `scope` (`series` | `occurrence`). Scalar entries also have `before`/`after`; array entries have `added`/`removed`.

### 5.3 Malformed-row checks

```sql
-- Rows with NULL forensic fields (should be 0; columns are NOT NULL)
SELECT count(*) AS null_forensic_rows
FROM event_audit_log
WHERE event_id_at_observation IS NULL
   OR actor_role IS NULL
   OR action IS NULL
   OR source IS NULL
   OR created_at IS NULL;

-- Rows with empty changed_fields where action implies a diff (not create/delete)
SELECT count(*) AS empty_diff_with_diff_action
FROM event_audit_log
WHERE action IN ('update','publish','unpublish','cover_update')
  AND jsonb_array_length(changed_fields) = 0;

-- Rows with malformed changed_fields entries (missing required keys)
SELECT id, changed_fields
FROM event_audit_log
WHERE jsonb_typeof(changed_fields) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(changed_fields) entry
    WHERE NOT (entry ? 'field' AND entry ? 'kind' AND entry ? 'risk_tier' AND entry ? 'enforcement_mode' AND entry ? 'scope')
  )
ORDER BY created_at DESC
LIMIT 20;

-- Service-role rows with no actor_id (expected for service writes)
SELECT count(*) AS service_writes_unattributed
FROM event_audit_log
WHERE actor_role = 'service' AND actor_id IS NULL;
```

### 5.4 Quick smoke: prove the helper is firing right now

```sql
-- After running a known PATCH, confirm exactly one new row appeared:
SELECT id, event_id, actor_role, action, source, summary, created_at
FROM event_audit_log
WHERE event_id = '<your-test-event-id>'
ORDER BY created_at DESC
LIMIT 5;
```

Cross-check against `[event-audit]` Axiom line for the same `request_id`.

---

## 6. Daily soak monitor

Routine `trig_01VWvwddJMf1HesDy6a78CAa` — read-only, runs at **9:07am MT** every day, manage at https://claude.ai/code/routines/trig_01VWvwddJMf1HesDy6a78CAa.

It runs the six checks in §4 + §5 and outputs a written report. It cannot self-cancel — Sami disables it manually after the May 10 post-soak run.

If the routine reports any of the following, pause before proceeding:

- `[event-audit-failed]` count > 0 (any window)
- Forensic NULL-field count > 0
- Unexpected enum value in `actor_role` / `source` / `action`
- Malformed `changed_fields` entries
- PATCH 5xx coinciding with `[event-audit-failed]` for the same `requestId`

---

## 7. Controlled write matrix (PLAN — to run after soak, not now)

Designed to exercise each `(action, source, actor_role)` branch the helper classifies, so PR B's scorer reads a known-good shape distribution. **Do not run any row until Sami says "GO matrix" on or after `2026-05-09T20:49:31.590Z`.**

| # | Test | Driver | Expected audit-row shape | Cleanup | Risk |
|---|---|---|---|---|---|
| 1 | Admin manual edit | Chrome MCP `fetch('/api/my-events/<test-event>', {method:'PATCH', body:{host_notes:'matrix #1 …'}})` from auth'd admin session | `actor_role='admin'`, `source='manual_form'`, `action='update'`, single scalar `host_notes` change | Revert `host_notes` via second PATCH | Low |
| 2 | Non-admin host edit | Same `fetch`, logged in as a non-admin host on an event they own | `actor_role='host'`, `source='manual_form'`, `action='update'` | Revert | Low if non-admin host session reachable; **skip** if not (ergonomic, not correctness gate) |
| 3 | Cover update on a draft | PATCH with `cover_image_url` only on a draft event | `action='cover_update'` (single-field intent classifier branch) | Revert to prior cover URL | Low on draft, **medium on published** — limit to draft |
| 4 | AI edit (safe) | `fetch` with header / body marker `ai_write_source: 'conversational_create_ui_auto_apply'` + small change | `source='ai_edit'`, `action` per intent | Revert | Low — already exercised in real traffic via PR #182 |
| 5 | (optional) Cancel + restore | DELETE without `?hard=true` to soft-cancel a low-stakes draft, then PATCH `restore: true` | Row pair: `action='cancel'` then `action='restore'` | Restore covers it | **Higher** — surfaces a host-facing lifecycle. Skip unless explicitly authorized at matrix-run time. |

**Not in matrix:** hard delete (removes a real event row), unattributed service writes (synthetic, no production value), bulk import simulation (PR B/C territory), any path that touches a published CSC-branded event.

After the matrix runs, post a side-by-side `(expected vs actual)` table per row, revert any state changes, and report. Only after that AND a separate explicit "GO PR B" does PR B implementation work begin.

---

## 8. Rollback procedure (flip the flag off)

Use this if the soak monitor surfaces a real correctness or user-facing problem and you want to stop new audit-row writes without removing the table or the helper code.

### Step 1 — Set `EVENT_AUDIT_LOG_ENABLED=false` in Vercel

1. Open https://vercel.com/samiserrags-projects/denver-songwriters-collective/settings/environment-variables
2. Find `EVENT_AUDIT_LOG_ENABLED` → menu → **Edit** → set value to `false` (lowercase) → Save
3. Confirm the value scope still reads `Production and Preview` (or just Production if narrower is preferred)

(Alternative: delete the env var entirely. The helper treats unset and `false` identically — both return false from `isEventAuditLogEnabled()`.)

### Step 2 — Redeploy Production

1. Open https://vercel.com/samiserrags-projects/denver-songwriters-collective/deployments
2. Click into the current Production deploy → **Deployment Actions** → **Redeploy**
3. **Uncheck "Use existing Build Cache"** (env-var changes need a fresh build)
4. Click **Redeploy** → wait for `Ready` + alias swap

### Step 3 — Verify the helper has stopped

Issue one PATCH against a known test event from the auth'd browser session, then verify both signals are silent:

```bash
# Should return 0
axiom query "['vercel-runtime'] | where message contains '[event-audit]' | summarize count()" --start-time -10m

# Should return 0 new rows for the test event after the rollback PATCH
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
  SELECT count(*) FROM event_audit_log
  WHERE event_id = '<your-test-event-id>'
    AND created_at > NOW() - interval '10 minutes';
"
```

Both must return 0 for rollback to be considered complete. If either still shows activity, check whether (a) the redeploy actually completed, (b) the redeploy is the Current Production alias, (c) the env var was saved with the new value.

### What rollback does NOT do

- The `event_audit_log` table stays in place (forward-safe).
- Existing audit rows are not deleted — they remain queryable for forensics.
- Helper code stays in the repo; only the runtime check returns false.
- RLS policies stay in place.

To fully remove the table (rare), follow the rollback-only SQL placement rule in [`30-supabase-migrations-and-deploy.md`](../../.claude/rules/30-supabase-migrations-and-deploy.md) — create a forward migration in `supabase/migrations/_archived/` (never in active `supabase/migrations/`) and apply manually under Sami stop-gate.

---

## 9. Helper failure modes (already-known)

The helper is fire-and-forget per investigation §4.1 — it never throws into the route handler. Its three error paths log with the `[event-audit-failed]` prefix:

| Failure | Cause | What to do |
|---|---|---|
| Missing Supabase env vars | `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` not present in the runtime | Verify env vars in Vercel (these are required by other code paths too — if missing, the whole API would be broken). |
| Payload build error | Caller passed a malformed input (rare; routes use the convenience helpers) | Check the route call site against the helper's `LogEventAuditInput` shape. |
| DB insert error | Service-role key invalid, RLS policy regression, table missing, network error | Run §5 SELECT smoke, verify migration still applied, check service role key hasn't rotated. |

The route's PATCH/POST/DELETE response is **never blocked** by audit failures — the user always gets the normal API response. Audit failure only means the audit row is missing for that request.

---

## 10. PR B prerequisites

PR B (suspicion scorer + admin email + retention cleanup) is **BLOCKED** until **all** of the following hold:

| # | Prerequisite |
|---|---|
| 1 | Current UTC time is on or after `2026-05-09T20:49:31.590Z` (7-day soak window) |
| 2 | Cumulative `[event-audit-failed]` count since soak start = 0 |
| 3 | No malformed-row findings from §5.3 across the soak window |
| 4 | No PATCH 5xx coincidence with `[event-audit-failed]` from §4.3 across the soak window |
| 5 | Controlled write matrix (§7) has run cleanly with `(expected vs actual)` matched per row |
| 6 | Sami issues an explicit "GO PR B" — no implicit advance, no auto-promotion from a clean soak alone |

§7 #6 (`ON DELETE`) and §7 #9 (feature-flag default) from the decision memo were already answered for PR A and remain in force; they do not need to be re-asked for PR B unless Sami changes them.

PR C (admin browser UI, public transparency line, RSS / JSON / MCP, retention cleanup function, trust-layer surfaces) requires a **separate** stop-gate after PR B has been live for its own soak period, per decision memo §2.4 + §2.5. Public-facing surfaces in PR C must additionally cite Lane 6 strategy docs and obey the trust-never-pay-to-play boundary in [`docs/strategy/OPERATING_THESIS.md`](../strategy/OPERATING_THESIS.md) §6.

---

## 11. Out of scope for this runbook

This runbook does NOT cover (and the operator should NOT execute) any of the following without separate explicit authorization:

- Suspicion scorer logic (PR B)
- Admin email / digest plumbing (PR B)
- Retention cleanup function (PR B)
- Admin browser UI (PR C)
- Public "last updated" transparency line (PR C — Lane 6 trust-layer)
- RSS / JSON / MCP / `llms.txt` / agent-readable surface (PR C — Lane 6 stop-gate)
- Any modification to verification badges or `last_verified_at` derivation
- Direct service-role writes to `event_audit_log` outside the helper

If any of the above is needed, route through Sami stop-gate per [`docs/GOVERNANCE.md`](../GOVERNANCE.md) before touching code.

---

**End — Event audit log runbook v1 (PR A flag-on, soak window).**

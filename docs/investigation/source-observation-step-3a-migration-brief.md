# Source Observation Step 3a — Migration Brief (`event_sources`)

**Status:** Implementation brief — **does not authorize applying any migration**
**Lane:** Lane 6 (strategy and policy authoring)
**Created:** 2026-05-02
**Audience:** Future migration author and the reviewer for the step-3a migration stop-gate

**Predecessors:**

- [PR #214](https://github.com/samiserrag/denver-songwriters-collective/pull/214) (merged) — investigation: source observation data model plan
- [PR #219](https://github.com/samiserrag/denver-songwriters-collective/pull/219) (merged) — decision memo on the six open questions
- [docs/strategy/SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md) — migration plan
- [docs/investigation/source-observation-data-model-plan.md](source-observation-data-model-plan.md)
- [docs/investigation/source-observation-open-questions-decision-memo.md](source-observation-open-questions-decision-memo.md)
- [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md) — Draft / Proposed / Not Active
- [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md) — stop-gates

> **No production verification behavior is changed by this brief.** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed, remains the only active rule per [Phase 4.89 Confirmation Invariants](../../.claude/rules/10-web-product-invariants.md). [SOURCE-OBS-01](../CONTRACTS.md) stays Draft / Proposed / Not Active. **Approving this brief does not authorize applying the migration.** The migration PR (3a-execute) is its own stop-gate.

---

## 1. Purpose

This brief specifies the contents of the **first** migration in the SOURCE-OBS-01 data-model phase. It is concrete enough that the future migration author can write the SQL with confidence, and tight enough that the reviewer of the 3a-execute stop-gate has an unambiguous comparison target. The brief itself ships no SQL, no code, no triggers, no policies, no rows.

## 2. Scope of Step 3a

### 2.1 In scope (single migration slice)

- Create one new table: `event_sources`.
- Add the indexes listed in §4.2.
- Add the constraints listed in §4.3.
- Add the table comment in §4.4 (the naming-disambiguation note from [decision memo Q2](source-observation-open-questions-decision-memo.md)).
- `ENABLE ROW LEVEL SECURITY` and add the policies in §5.

### 2.2 Out of scope (each its own future stop-gate)

| Step | Scope | Why deferred |
|---|---|---|
| 3b | `event_source_observations` table + FK to `event_sources` | Smaller review surface per table; no writers exist yet |
| 3c | `event_change_log` table + FK to `event_source_observations` | Depends on 3b |
| 3d | `artist_claims` table + `artist_subject_type` discriminator per [decision memo Q1](source-observation-open-questions-decision-memo.md) | Independent slice; pairs with future modifier wiring |
| 3e (or 3a-trigger) | `event_sources.claim_status` trigger + reconciliation job | Trigger arrives between table-create and the first writer per [decision memo Q4](source-observation-open-questions-decision-memo.md) |
| 4–8 | Derivation function · feature-flagged badge variant · backfill · CONTRACTS supersession | Each its own stop-gate per [SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md) |

### 2.3 Always out of scope for 3a

- Application code (server, route, RPC).
- API / MCP / crawler / write surfaces.
- Verification badge / UI / rendered-surface changes.
- Any change to [`web/src/lib/events/verification.ts`](../../web/src/lib/events/verification.ts).
- Admin auto-confirm path changes.
- Activation, supersession, or modification of [SOURCE-OBS-01](../CONTRACTS.md).
- Any data backfill.

## 3. Migration File Conventions

The migration author should:

- Place a single new SQL file under `supabase/migrations/` with a fresh timestamp prefix (matching the repo's existing `YYYYMMDDHHMMSS_short_name.sql` convention).
- Use `IF NOT EXISTS` and `IF EXISTS` consistently with other recent migrations in the repo (see for example [`20260317224500_organizations_claims_and_managers.sql`](../../supabase/migrations/20260317224500_organizations_claims_and_managers.sql)).
- Include a one-line file-top SQL comment naming the source brief: `-- Source: docs/investigation/source-observation-step-3a-migration-brief.md`.
- Author idempotent, transaction-safe DDL.

This brief does not specify the timestamp; the author chooses one at migration-write time.

## 4. The Table — `event_sources`

### 4.1 Proposed columns

Columns mirror [data-model-plan §6.1](source-observation-data-model-plan.md), with [decision-memo Q2](source-observation-open-questions-decision-memo.md) and [Q4](source-observation-open-questions-decision-memo.md) resolutions baked in.

| Column | Type | Constraint / Notes |
|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `type` | `text` | `NOT NULL` + CHECK: `IN ('claimed_feed','first_party_site','first_party_calendar','civic_calendar','nonprofit_calendar','aggregator_public','ticket_page','community_submission','concierge_created')` |
| `risk_tier` | `text` | `NOT NULL` + CHECK: `IN ('A','B','C','D','E','F')` |
| `display_name` | `text` | `NOT NULL` |
| `homepage_url` | `text` | nullable; **no UNIQUE** ([Q2](source-observation-open-questions-decision-memo.md)) |
| `feed_url` | `text` | nullable; **no UNIQUE** ([Q2](source-observation-open-questions-decision-memo.md)) |
| `robots_summary` | `text` | nullable; one-line policy snapshot |
| `terms_summary` | `text` | nullable; one-line ToS snapshot |
| `default_cadence_minutes` | `integer` | `NOT NULL` |
| `last_fetch_at` | `timestamptz` | nullable |
| `last_fetch_status` | `text` | nullable |
| `claim_status` | `text` | `NOT NULL DEFAULT 'unclaimed'` + CHECK: `IN ('unclaimed','claimed_by_venue','claimed_by_artist','claimed_by_organization')`. Denormalized cache; trigger arrives in 3e per [Q4](source-observation-open-questions-decision-memo.md). |
| `claimed_by_venue_id` | `uuid` | `REFERENCES public.venues(id) ON DELETE SET NULL` |
| `claimed_by_organization_id` | `uuid` | `REFERENCES public.organizations(id) ON DELETE SET NULL` |
| `claimed_by_artist_id` | `uuid` | `REFERENCES public.profiles(id) ON DELETE SET NULL`. Aligned with the current profile-as-artist model; revisits if a future `artists` table is introduced per [Q1](source-observation-open-questions-decision-memo.md). |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` |

### 4.2 Indexes

- Primary key on `id` (implicit).
- `idx_event_sources_type` on `(type)`.
- `idx_event_sources_risk_tier` on `(risk_tier)`.
- `idx_event_sources_claim_status` on `(claim_status)`.

The author should choose `CREATE INDEX IF NOT EXISTS` consistent with prior repo migrations.

### 4.3 Constraints

- All `CHECK` constraints listed in §4.1 (`type`, `risk_tier`, `claim_status` enums).
- All `REFERENCES … ON DELETE SET NULL` constraints listed in §4.1.
- **No UNIQUE constraints on URL columns** ([Q2](source-observation-open-questions-decision-memo.md)).
- **No partitioning** ([Q3](source-observation-open-questions-decision-memo.md) defers this; `event_sources` is a registry, not a high-volume fact table — partitioning is a Q3 concern for `event_source_observations`).

### 4.4 Table comment

The migration must add a table comment that disambiguates the name from a possible per-event-per-source join interpretation ([Q2](source-observation-open-questions-decision-memo.md)):

> Registry of external data sources (one row per registered source). Per-fetch facts live in `event_source_observations` (added in step 3b). `claim_status` is a denormalized cache of approved claim rows; the maintenance trigger ships in step 3e.

This is `COMMENT ON TABLE public.event_sources IS '…'` in SQL.

### 4.5 Optional column comment for `claim_status`

Recommended (not required) to reduce confusion when the trigger has not yet shipped:

> Denormalized cache of approved claim rows on `venue_claims`, `organization_claims`, and (future) `artist_claims`. **Default `'unclaimed'` and inert until the maintenance trigger ships in step 3e.** Do not populate manually.

## 5. RLS Posture

`ENABLE ROW LEVEL SECURITY` on `public.event_sources` is **mandatory** per the database security invariants in [.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md).

| Role | Action | Policy |
|---|---|---|
| `anon` | `SELECT` | Allowed on `(id, type, risk_tier, display_name, homepage_url, claim_status)`. **Forbidden** on `feed_url`, `robots_summary`, `terms_summary`, `default_cadence_minutes`, `last_fetch_at`, `last_fetch_status`. |
| `authenticated` (self) | `SELECT` | Same as `anon`. |
| `authenticated` (admin role per existing `is_admin()` helper) | `INSERT` / `UPDATE` / `DELETE` | Allowed on all columns. |
| `service_role` | All | Allowed (service_role bypasses RLS by default; no explicit policy required). |

Implementation notes:

- The `anon` SELECT policy must be expressed as a *column-restricted* view or as application-level column omission, not as an RLS predicate (RLS policies are row-level, not column-level). The simplest path is a `SECURITY INVOKER` view named `event_sources_public` exposing only the public columns. Both the table and the view must comply with the four database security invariants.
- If a public view is added, the migration must use `WITH (security_invoker = true)` per the database invariants.
- No `SECURITY DEFINER` function is added by 3a.

## 6. Database Security Invariants Checklist

Per [.claude/rules/00-governance-and-safety.md §Security: Database Invariants](../../.claude/rules/00-governance-and-safety.md):

- [ ] RLS enabled on `public.event_sources`.
- [ ] No `SECURITY DEFINER` function added by this migration.
- [ ] If a `event_sources_public` view is added, it is created with `WITH (security_invoker = true)`.
- [ ] No `TRUNCATE`, `TRIGGER`, or `REFERENCES` privileges granted to `anon` or `authenticated`.
- [ ] Specific grants used (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) — never `ALL PRIVILEGES`.
- [ ] No allowlist entry added to bypass CI tripwire.

## 7. Compatibility Guarantees

- **Active rule unchanged:** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed. Cancelled when `status = 'cancelled'`.
- **Code unchanged:** [`web/src/lib/events/verification.ts`](../../web/src/lib/events/verification.ts) is not modified.
- **Phase 4.89 invariants** ([10-web-product-invariants.md](../../.claude/rules/10-web-product-invariants.md)) remain in force, byte-for-byte. Visibility never depends on `last_verified_at`. Auto-confirmation paths set `last_verified_at` exactly as today.
- **DSC TEST suppression** continues to fire on the existing rule.
- **No reader exists** for `event_sources` after 3a. `claim_status` defaults `'unclaimed'` and is inert.
- **No writer exists** for `event_sources` after 3a. The first writer ships only after the trigger and the registry-management surface land in later stop-gates.

## 8. Rollback Plan

### 8.1 Forward rollback

`DROP TABLE IF EXISTS public.event_sources` is sufficient. As of 3a:

- No FKs reference `event_sources` (3b has not shipped).
- No application code reads or writes the table.
- No view depends on it (or, if `event_sources_public` ships in 3a, drop that view first: `DROP VIEW IF EXISTS public.event_sources_public`).

### 8.2 What is preserved through rollback

- `events.last_verified_at` and `events.verified_by` are not touched.
- All existing claim tables (`event_claims`, `venue_claims`, `organization_claims`) are not touched.
- `verification.ts` semantics are not touched.

### 8.3 Rollback runbook stub

The migration author should attach a short rollback runbook fragment to the 3a-execute PR description with the exact SQL:

```sql
-- step-3a rollback
BEGIN;
DROP VIEW IF EXISTS public.event_sources_public;
DROP TABLE IF EXISTS public.event_sources;
COMMIT;
```

## 9. Smoke Queries (Post-Deploy, Read-Only)

Run these against the production DB after applying the migration. None of them write data.

```sql
-- 1. Table exists
SELECT to_regclass('public.event_sources');
-- Expected: 'public.event_sources'

-- 2. Row count = 0
SELECT count(*) FROM public.event_sources;
-- Expected: 0

-- 3. RLS enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relnamespace = 'public'::regnamespace
  AND relname = 'event_sources';
-- Expected: relrowsecurity = true

-- 4. Policies present
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.event_sources'::regclass
ORDER BY polname;
-- Expected: at least one SELECT policy and one all-action policy for admin role

-- 5. Indexes present
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'event_sources'
ORDER BY indexname;
-- Expected: PK index plus idx_event_sources_type, idx_event_sources_risk_tier, idx_event_sources_claim_status

-- 6. Table comment present
SELECT obj_description('public.event_sources'::regclass, 'pg_class');
-- Expected: the disambiguation note from §4.4

-- 7. CHECK constraints present
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.event_sources'::regclass AND contype = 'c'
ORDER BY conname;
-- Expected: CHECKs for type, risk_tier, claim_status

-- 8. Default claim_status
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'event_sources' AND column_name = 'claim_status';
-- Expected: column_default = ''unclaimed''::text
```

If any of those queries returns an unexpected result, the migration author halts the deploy and rolls back per §8.

## 10. Required Tests

### 10.1 Existing CI tripwires (must remain green)

- **RLS tripwire** — green for `event_sources`.
- **SECURITY DEFINER allowlist** — unchanged (no new SECURITY DEFINER functions).
- **Postgres-owned views with `security_invoker=true`** — green if `event_sources_public` view ships; otherwise N/A.
- **Privilege checks** — no new TRUNCATE/TRIGGER/REFERENCES on anon/authenticated.

### 10.2 Schema tests (added or extended in 3a-execute PR)

- Column types and nullability match §4.1.
- All CHECK constraints in §4.1 reject invalid values (round-trip per enum).
- All FKs in §4.1 fire `SET NULL` on parent delete (round-trip per FK).
- All indexes in §4.2 exist and are queryable.
- Table comment in §4.4 matches.

### 10.3 Compatibility tests (existing tests must continue passing)

- All `verification.ts` unit tests remain green; no behavioral diff.
- All Phase 4.89 invariants tests (existing) remain green.
- All DSC TEST suppression tests remain green.
- Discovery surfaces produce identical output before and after the migration on a representative event sample.

### 10.4 RLS tests (added in 3a-execute PR)

- `anon` cannot SELECT `feed_url`, `robots_summary`, `terms_summary`, `default_cadence_minutes`, `last_fetch_at`, `last_fetch_status`.
- `anon` can SELECT `id`, `type`, `risk_tier`, `display_name`, `homepage_url`, `claim_status`.
- `authenticated` non-admin has the same surface as `anon`.
- `authenticated` admin can INSERT/UPDATE/DELETE.

### 10.5 Negative tests

- Inserting a row with `type` outside the enum fails.
- Inserting a row with `risk_tier` outside the enum fails.
- Inserting a row with `claim_status` outside the enum fails.
- Deleting a referenced `venue` / `organization` / `profile` sets the corresponding `claimed_by_*_id` to NULL on `event_sources` rows (round-trip; useful only after a writer ships, but the FK semantics can be exercised in test fixtures).

## 11. Mapping to Predecessor Decisions

| Decision | Source | How 3a applies it |
|---|---|---|
| `event_sources` named keepable; add table comment | [#219 Q2](source-observation-open-questions-decision-memo.md) | §4.4 mandates the comment |
| No UNIQUE on URL columns | [#219 Q2](source-observation-open-questions-decision-memo.md) | §4.3 explicitly forbids them |
| No partitioning, no retention; review at >10M rows or 12 months | [#219 Q3](source-observation-open-questions-decision-memo.md) | N/A for `event_sources`; is a 3b concern |
| Keep `claim_status` denormalized; trigger arrives later | [#219 Q4](source-observation-open-questions-decision-memo.md) | §4.1 ships the column with default `'unclaimed'`; §4.5 column comment marks it inert until 3e |
| `raw_snapshot_ref` storage deferred | [#219 Q5](source-observation-open-questions-decision-memo.md) | N/A for `event_sources`; is a 3b concern |
| `event_change_log` covering composite index deferred | [#219 Q6](source-observation-open-questions-decision-memo.md) | N/A for `event_sources`; is a 3c concern |
| `artist_subject_type` discriminator must land with `artist_claims` | [#219 Q1](source-observation-open-questions-decision-memo.md) | N/A for `event_sources`; is a 3d concern |
| `event_sources` proposed shape | [#214 §6.1](source-observation-data-model-plan.md) | §4.1 mirrors it |
| RLS posture sketch | [#214 §8](source-observation-data-model-plan.md) | §5 expands to concrete policies |

## 12. What This Brief Does NOT Authorize

This document **records design intent and acceptance criteria for the 3a migration only.** It does not authorize:

- Writing the migration SQL.
- Applying the migration to any environment (staging, production, or otherwise).
- Adding the trigger from §2.2 (3e).
- Shipping any of 3b, 3c, 3d, or any later step.
- Any application code, route, RPC, MCP surface, or crawler change.
- Any verification UI, badge, label, or display path change.
- Any change to [`web/src/lib/events/verification.ts`](../../web/src/lib/events/verification.ts).
- Any admin auto-confirm path change.
- Activation or supersession of [SOURCE-OBS-01](../CONTRACTS.md). It remains Draft / Proposed / Not Active.
- Any backfill execution.

Each of the above requires its own stop-gate per [GOVERNANCE.md](../GOVERNANCE.md).

## 13. Stop-Gate Language for the 3a-Execute PR

When the future 3a-execute PR is opened, its description must include the following statements verbatim (or paraphrased while preserving meaning):

- "This PR implements `docs/investigation/source-observation-step-3a-migration-brief.md`."
- "Runtime verification behavior is not changed. `last_verified_at IS NOT NULL ⇒ Confirmed` remains the only active rule."
- "[`web/src/lib/events/verification.ts`](https://github.com/samiserrag/denver-songwriters-collective/blob/main/web/src/lib/events/verification.ts) is unchanged."
- "[SOURCE-OBS-01](https://github.com/samiserrag/denver-songwriters-collective/blob/main/docs/CONTRACTS.md) remains Draft / Proposed / Not Active."
- "No application code, API/MCP/crawler route, badge, UI, or admin auto-confirm change is included. No reader or writer exists for `event_sources` after this PR."
- "Smoke queries from §9 of the brief have been run and returned the expected results."
- "Rollback per §8 of the brief is `DROP TABLE IF EXISTS public.event_sources` (and the public view if added)."

The reviewer compares the PR diff against this brief, runs the smoke queries, and confirms the database security invariants tripwire is green before approving.

## 14. Non-Goals (Explicit)

This brief does **not**:

- Author or commit any SQL migration.
- Modify [`web/src/lib/events/verification.ts`](../../web/src/lib/events/verification.ts) or any other application code.
- Add or modify any API/MCP/crawler/RPC route.
- Modify the verification UI, badge component, or any rendered surface.
- Change any admin auto-confirm path.
- Activate, supersede, or otherwise modify [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md). It remains Draft / Proposed / Not Active.
- Begin operational ingestion of any external source.
- Authorize backfill execution.
- Authorize the 3a migration itself.
- Authorize any subsequent step (3b, 3c, 3d, 3e, 4–8).

---

**End of brief. Approval records the recommended migration shape; the migration PR (3a-execute) is its own stop-gate.**

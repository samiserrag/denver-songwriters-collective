# Postmortem: Private Events RLS Recursion Incident

**Date of incident:** 2026-02-18
**Duration of impact:** Minutes (hotfix applied same session)
**Severity:** P0 — all authenticated event reads failed; event surfaces appeared empty
**Author:** Claude Opus 4.6 (Repo Agent)
**Status:** Resolved. Preventive controls documented.

---

## Executive Summary

After applying the approved PR2 migration (`20260218030000_private_events_foundation.sql`) via Mode B, all authenticated Supabase queries against the `events` table failed with `infinite recursion detected in policy for relation "events"`. Event listings, detail pages, admin views, and all downstream surfaces returned zero rows for logged-in users. Anonymous users were also affected for any query path that triggered the recursive policy branch.

The root cause was a bidirectional RLS dependency: the new `events.public_read_events` policy contained a subquery into `event_attendee_invites`, while `event_attendee_invites` RLS policies contained subqueries back into `events`. PostgreSQL detected this cycle at query time and refused to evaluate either policy.

A secondary issue surfaced in CI: the rollback file (`20260218030001_private_events_foundation_rollback.sql`) was placed in the active `supabase/migrations/` directory. Clean-database CI runs treated it as a forward migration and applied it, which dropped the `visibility` column and `event_attendee_invites` table, breaking all subsequent migrations that depended on them.

Both issues were resolved within the same working session. The recursion was fixed by removing the `event_attendee_invites` subquery from the events policy (`20260218032000_fix_private_events_rls_recursion.sql`). The rollback file was moved to `supabase/migrations/_archived/`.

---

## Failure Chain Timeline

| Step | Action | Commit / Migration | Outcome |
|------|--------|-------------------|---------|
| 1 | Investigation completed; 14 surfaces audited; schema + RLS contract designed | — | Stop-gate document produced with risk matrix |
| 2 | Stop-gate approved by Sami; 7 gate questions answered | — | Execution authorized |
| 3 | PR1 shipped: OG + search leak hotfixes | `46237526` | Clean. No regression. |
| 4 | PR2 committed: migration + types + 40 contract tests | `fc182da7` | Build passes. All 4187 tests pass. Contract tests validate policy SQL text structure. |
| 5 | Migration applied via Mode B (psql) | `20260218030000` | All SQL statements succeed. `ALTER TABLE`, `CREATE TABLE`, `CREATE POLICY`, `DROP POLICY`, `CREATE POLICY` — no errors. |
| 6 | Schema verification queries run | — | `visibility` column confirmed. 92/92 events = `public`. `event_attendee_invites` table exists. Policy text confirmed in `pg_policies`. |
| 7 | **Failure begins.** Authenticated user loads any event surface. | — | PostgreSQL raises `infinite recursion detected in policy for relation "events"`. Supabase client returns empty result set (error swallowed). |
| 8 | Root cause identified: bidirectional RLS reference cycle | — | `events → event_attendee_invites → events` |
| 9 | Emergency hotfix: remove recursive branch from events policy | `20260218032000` | Events reads restored. Invite-based visibility deferred to non-recursive implementation. |
| 10 | Secondary issue: CI fails because rollback SQL in active migrations path | — | Clean-database CI applies rollback as forward migration, drops `visibility` column |
| 11 | Rollback file moved to `_archived/` | — | CI green. Contract test path updated. |

---

## Missed Assumptions

### Assumption 1: "Structurally valid SQL = runtime-safe SQL"

**Where it appeared:** The investigation's RLS Contract Matrix (Section 3) and the 40 contract tests in `pr2-private-events-rls-contract.test.ts`.

**What was validated:** The tests read the migration SQL source file and verified that policy text contained the correct role checks, table references, and constraint keywords. Every structural assertion passed.

**What was not validated:** Whether PostgreSQL's policy evaluator could execute the policy graph without hitting a recursion limit. The tests never ran an actual `SELECT` against the database with the new policies active.

**Why this matters:** PostgreSQL RLS policy evaluation is not a simple predicate check. When policy A on table X references table Y, and policy B on table Y references table X, PostgreSQL must evaluate both policies simultaneously. If either policy triggers evaluation of the other during row-level filtering, the engine detects infinite recursion and aborts. This is a runtime behavior that cannot be determined from static SQL analysis alone.

### Assumption 2: "Default 'public' means zero behavior change"

**Where it appeared:** The investigation's Executive Summary, Risk Matrix row 1 ("RLS policy change breaks existing queries — Severity HIGH, Likelihood LOW, mitigated by default 'public'"), and the migration's header comment.

**What was correct:** The default value itself was safe. All 92 existing events correctly received `visibility = 'public'`.

**What was incorrect:** The assumption conflated *data-level safety* with *policy-level safety*. Even though all rows had `visibility = 'public'`, the policy evaluator still had to parse and validate all branches of the `USING` clause — including the `event_attendee_invites` subquery branch — before it could determine that the `visibility = 'public'` branch was sufficient. The recursion was triggered during policy compilation/evaluation, not during row matching.

### Assumption 3: "Rollback files are inert if not explicitly applied"

**Where it appeared:** The rollback migration was created at `supabase/migrations/20260218030001_private_events_foundation_rollback.sql` — inside the active migrations directory, with a sequential timestamp.

**What was expected:** The file would sit dormant unless manually applied.

**What actually happened:** CI runs that provision a clean database from scratch (the "RLS Tripwire" job) apply all files in `supabase/migrations/` in timestamp order. The rollback file was applied as a forward migration, which dropped the `visibility` column and `event_attendee_invites` table, causing all subsequent migrations that referenced those objects to fail.

### Assumption 4: "The risk matrix covered all failure modes"

**Where it appeared:** Section 7 of the investigation, "Risk Matrix Summary."

**What was listed:** 7 risks including "RLS policy change breaks existing queries" (HIGH/LOW), "Performance degradation from RLS subqueries" (MEDIUM/MEDIUM).

**What was missing:** "Cross-table RLS recursion" was not listed as a distinct risk. "Performance degradation from RLS subqueries" was the closest analog, but it addressed query speed, not query correctness. RLS recursion is a correctness failure (queries return errors or zero rows), not a performance degradation.

---

## Why the Stop-Gate Protocol Did Not Catch This

The migration stop-gate protocol (defined in `30-supabase-migrations-and-deploy.md`) requires:

1. **Before apply:** Report branch, HEAD, filenames, test/build status. Wait for Sami approval.
2. **After apply:** Report mode used, migrations applied, verification query results. Confirm schema integrity.

All of these steps were followed correctly. The protocol's verification step uses schema-level queries (`\d table_name`, `SELECT` against `pg_policies`, row counts). These all returned correct results because:

- The schema changes were applied successfully (columns, tables, indexes exist).
- The policy text was correct (all expected clauses present).
- The row data was correct (92 events with `visibility = 'public'`).

The gap: **the protocol does not require a functional read test as a specific user role.** A simple `SELECT * FROM events LIMIT 1` executed as an `authenticated` user (not `service_role`) would have immediately surfaced the recursion error. This query was never part of the verification checklist.

---

## Guardrail Changes

### Must-Do Now (Before Any Further Migration in This Tract)

**1. Add runtime RLS smoke check to migration verification protocol**

Add to `30-supabase-migrations-and-deploy.md`, after "Verify schema change":

```
# 3b. Verify RLS reads (required for any migration that touches policies)
# Test as anon (no auth token)
psql "$DATABASE_URL" -c "SET ROLE anon; SELECT id, title FROM events LIMIT 3; RESET ROLE;"

# Test as authenticated (with a real user UUID)
psql "$DATABASE_URL" -c "SET ROLE authenticated; SET request.jwt.claims TO '{\"sub\": \"<any-user-uuid>\"}'; SELECT id, title FROM events LIMIT 3; RESET ROLE;"
```

If either query fails with a policy error, STOP and rollback before pushing to main.

**2. Recursion-risk flag for cross-table policy references**

Add to the stop-gate investigation template:

> **Cross-table RLS recursion check:** If any new or modified RLS policy on table A contains a subquery referencing table B, and table B has RLS policies that reference table A, this creates a recursion risk. Mark as HIGH risk and require a runtime smoke test before approval.

**3. Rollback file placement rule**

Formalize in `30-supabase-migrations-and-deploy.md`:

> Rollback-only SQL files MUST NOT be placed in `supabase/migrations/`. They MUST be placed in `supabase/migrations/_archived/` with a clear header comment: `-- ROLLBACK ONLY — DO NOT APPLY AS FORWARD MIGRATION`. CI will never apply files from `_archived/`.

**4. CI check for rollback files in active path**

Add a CI test or pre-commit check:

```bash
# Fail if any file in supabase/migrations/ contains rollback-indicating patterns
grep -rl "ROLLBACK\|rollback\|Restore original" supabase/migrations/*.sql && echo "ERROR: Rollback SQL found in active migrations" && exit 1
```

### Next Sprint

**5. Add automated RLS smoke test to CI pipeline**

Create a CI job that, after applying all migrations to a clean database, runs `SELECT` queries as `anon` and `authenticated` roles against every table with RLS enabled. Any policy evaluation error fails the build.

**6. Add recursion detection to contract tests**

Extend `pr2-private-events-rls-contract.test.ts` (or a new shared test) to parse all migration SQL files and flag bidirectional cross-table policy references:

```
For each policy P on table T:
  Extract all table references in P's USING/WITH CHECK clauses
  For each referenced table R:
    Check if R has any policy that references T
    If yes → flag as recursion risk
```

---

## Updated Stop-Gate Checklist Template

Use this template for all future migrations that modify RLS policies.

### Investigation Phase

- [ ] List all tables whose RLS policies are created, modified, or dropped
- [ ] For each policy, list all cross-table references in `USING` and `WITH CHECK` clauses
- [ ] **Recursion check:** For each cross-table reference A→B, verify B's policies do not reference A. If they do, document the cycle and propose a non-recursive alternative (e.g., `SECURITY DEFINER` helper function, materialized flags, or deferred application-layer checks).
- [ ] Add "Cross-table RLS recursion" as a row in the risk matrix if any cross-table references exist
- [ ] Verify rollback SQL is placed in `_archived/`, not active `migrations/`

### Stop-Gate Approval Phase

- [ ] All structural contract tests pass (schema shape, policy text, type alignment)
- [ ] Risk matrix includes cross-table recursion risk assessment
- [ ] Rollback file path is outside active `supabase/migrations/`
- [ ] Migration mode (A or B) confirmed by Sami

### Migration Apply Phase

- [ ] Apply migration via confirmed mode
- [ ] Record in `schema_migrations` history
- [ ] **Schema verification:** Column exists, table exists, policy text in `pg_policies` matches expectations
- [ ] **Runtime RLS smoke test (NEW — REQUIRED):**
  - [ ] `SELECT` as `anon` role succeeds and returns expected row count
  - [ ] `SELECT` as `authenticated` role succeeds and returns expected row count
  - [ ] If either fails with policy error → STOP, rollback, do not push to main
- [ ] Row-level data verification (e.g., default values applied correctly)

### Post-Apply Verification

- [ ] Load production site as anonymous user — verify public surfaces render
- [ ] Load production site as authenticated user — verify dashboard and event surfaces render
- [ ] Load production site as admin — verify admin views render
- [ ] Run full test suite — confirm no regressions
- [ ] Push to main only after all verification passes

---

## What We Will Do Differently Next Time

1. **Every RLS policy migration gets a runtime smoke test** before we report success. Not just schema checks — actual row reads as `anon` and `authenticated`.

2. **Cross-table policy references get flagged during investigation**, not discovered during incident response. The investigation template now includes a recursion check step.

3. **Rollback files never go in active migrations.** They go in `_archived/` from the start. This is a file placement rule, not a judgment call.

4. **The risk matrix must distinguish between performance risks and correctness risks.** "RLS subquery performance" and "RLS subquery recursion" are different failure modes with different detection methods.

5. **Contract tests should include at least one runtime assertion** where feasible. Static source-code analysis is necessary but not sufficient for validating database policy behavior.

---

*This postmortem is factual and non-defensive. The stop-gate protocol worked as designed for what it covered. It did not cover runtime policy evaluation, which is the gap that this incident revealed. The gap is now closed.*

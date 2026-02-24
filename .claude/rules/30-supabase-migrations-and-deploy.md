---
paths:
  - "supabase/**"
  - "web/supabase/**"
  - "web/src/lib/supabase/**"
  - "web/src/app/api/**"
---

# Supabase Migrations and Deploy Rules

This file contains deployment and migration execution rules.

## Deploy Rules

### Supabase Migrations BEFORE Push

**Project Reality:** This project's remote Supabase database contains many historical migrations applied directly via SQL before the migration history table (`supabase_migrations.schema_migrations`) was consistently used. As a result, `npx supabase db push` may attempt to re-apply already-applied migrations. This is a known, pre-existing state.

**You MUST choose the correct migration mode before applying any migration:**

#### MODE A — `supabase db push` (Only if history is clean)

Use this mode ONLY if `npx supabase migration list` shows that `db push` would apply ONLY the new migration(s) you intend.

```bash
# 1. Check what db push would apply
npx supabase migration list

# 2. If ONLY your new migration is pending:
npx supabase db push

# 3. Verify schema change
cd web && source .env.local && psql "$DATABASE_URL" -c "\d table_name"

# 4. THEN push to main
git push origin main
```

#### MODE B — Direct `psql` (Required when history is not clean)

Use this mode if `supabase migration list` shows many unexpected pending migrations (the common case for this repo).

```bash
# 1. Apply migration directly
cd web && source .env.local
psql "$DATABASE_URL" -f ../supabase/migrations/<YYYYMMDDHHMMSS>_migration_name.sql

# 2. Record in migration history
psql "$DATABASE_URL" -c "INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ('<YYYYMMDDHHMMSS>', '<filename>.sql', ARRAY['<summary>']) ON CONFLICT DO NOTHING;"

# 3. Verify schema change
psql "$DATABASE_URL" -c "\d table_name"

# 4. THEN push to main
git push origin main
```

**Rules:**
- If MODE B is used, do NOT run `npx supabase db push`
- If MODE A would apply unexpected migrations, STOP and switch to MODE B
- Always verify the schema change after applying
- Always record applied migrations in `supabase_migrations.schema_migrations`
- Do NOT push to `main` until the migration is confirmed applied on remote

#### Sandbox DNS/Network Limitation Fallback (Standard)

When running `psql` from the agent sandbox, you may see transient network resolution failures such as:

```text
could not translate host name "db.<project-ref>.supabase.co" to address
```

If this occurs:
1. Re-run the exact `psql` command with elevated execution permissions.
2. Continue MODE B steps (`-f migration`, insert into `schema_migrations`, verification queries).
3. Include one line in the execution report: "Direct DB commands required elevated execution due sandbox DNS/network limits."

This is an execution-environment limitation, not a migration logic failure.

#### Rollback File Placement (added 2026-02-18, per incident postmortem)

- Rollback-only SQL files MUST NOT be placed in `supabase/migrations/`. They MUST be placed in `supabase/migrations/_archived/` with a clear header comment: `-- ROLLBACK ONLY — DO NOT APPLY AS FORWARD MIGRATION`.
- CI applies all files in `supabase/migrations/` in timestamp order. A rollback file in this directory will be applied as a forward migration on clean-database CI runs, causing cascading failures.

#### Stop-Gate Protocol for Migrations

Before applying any migration:
1. Report: current branch, HEAD commit, new migration filenames, test/build status
2. **WAIT for Sami approval** before executing

After applying:
1. Report: which mode was used, exact migrations applied, verification query results
2. Confirm schema integrity
3. **Runtime RLS smoke test (REQUIRED for any migration that creates, modifies, or drops RLS policies):**
   - Run `SELECT` as `anon` role against affected tables — must return rows (not error)
   - Run `SELECT` as `authenticated` role against affected tables — must return rows (not error)
   - If either query fails with a policy evaluation error, STOP and rollback before pushing to main
4. Load production site as anonymous, authenticated, and admin users to verify surfaces render

#### Cross-Table RLS Recursion Check (added 2026-02-18, per incident postmortem)

Before writing any RLS policy that contains a subquery referencing another table:
1. Check whether that other table has RLS policies that reference back to this table.
2. If a bidirectional cycle exists, this is a **HIGH-risk recursion hazard**. PostgreSQL will raise `infinite recursion detected in policy for relation` at query time.
3. To break the cycle, use one of: a `SECURITY DEFINER` helper function (bypasses RLS on the inner lookup), a materialized boolean flag column, or defer the check to application-layer logic.
4. Document the cycle and resolution in the migration header comment.

**Reference:** `docs/postmortems/2026-02-18-private-events-rls-recursion.md`

#### CI-Enforced Guardrails (added PR6, 2026-02-19)

Three automated guardrails run in CI (`ci.yml` and `test.yml`):

1. **Guardrail A — Rollback File Scanner** (CI bash step)
   - Scans `supabase/migrations/*.sql` (excluding `_archived/`, `_duplicates_backup/`)
   - Fails if any filename contains "rollback" (case-insensitive)
   - Fails if any file has a `-- ROLLBACK` header in the first 5 lines
   - Also enforced by vitest: `pr6-ci-guardrails.test.ts`

2. **Guardrail B — Bidirectional RLS Cycle Detector** (vitest)
   - Processes all migrations in timestamp order, tracking DROP/CREATE POLICY
   - Builds a directed graph from active policy bodies (table→table references)
   - Detects cycles via DFS and fails with a clear message naming the cycle
   - Test: `pr6-ci-guardrails.test.ts`

3. **Guardrail C — Policy-Change Acknowledgment** (CI bash step, git-diff scoped)
   - Scans only new/modified `.sql` files in the current PR (via `git diff`)
   - If a file contains `CREATE POLICY`, `ALTER POLICY`, `DROP POLICY`, `ENABLE/DISABLE ROW LEVEL SECURITY`:
     - Requires the header comment: `-- REVIEWED: policy change acknowledged`
   - Skipped on first push (no base ref for diff)

**To acknowledge a policy change:** Add the line `-- REVIEWED: policy change acknowledged` anywhere in the migration file containing the policy SQL.

---

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

#### Stop-Gate Protocol for Migrations

Before applying any migration:
1. Report: current branch, HEAD commit, new migration filenames, test/build status
2. **WAIT for Sami approval** before executing

After applying:
1. Report: which mode was used, exact migrations applied, verification query results
2. Confirm schema integrity

---


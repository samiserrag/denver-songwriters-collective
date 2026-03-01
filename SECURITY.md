# Security Invariants (Supabase + CI)

This project enforces a strict, defense-in-depth security posture around
Supabase Row Level Security (RLS), database privileges, and SECURITY DEFINER usage.

These rules are **non-negotiable** and enforced in CI.

---

## Threat Model Addressed

This codebase explicitly defends against:
- Accidental or implicit data exposure via Supabase's REST/Data API
- Privilege escalation through SECURITY DEFINER functions
- Silent regressions from default Postgres / Supabase grants
- "Works locally" schema drift introduced by migrations or manual changes

---

## Enforced Invariants (CI-Guarded)

Every push / PR is checked for the following:

1. **All public tables MUST have RLS enabled**
   - No exceptions.
   - CI fails if any `public` table has RLS disabled.

2. **SECURITY DEFINER functions MUST NOT be callable by `anon` or `public`**
   - Only explicitly allowlisted functions may be callable.
   - Allowlist is intentionally tiny and documented.
   - Prefer server-only RPCs or SECURITY INVOKER functions.

3. **Postgres-owned views MUST use `SECURITY INVOKER`**
   - Postgres-owned views without `security_invoker=true` are treated as
     privilege-escalation risks.
   - Only allowlisted views may bypass this (rare).

4. **Dangerous table privileges are forbidden**
   - `TRUNCATE`, `TRIGGER`, `REFERENCES` are revoked from `anon` and `authenticated`.
   - Default privileges are locked to prevent future drift.
   - CI fails if these privileges reappear.

---

## Tooling

- **CI Tripwire**
  `web/scripts/security/supabase-rls-tripwire.mjs`
  Enforces all invariants above.

- **Human Posture Check**
  `web/scripts/security/security-posture.mjs`
  Quick local summary of the current security state.

- **Governance & Allowlists**
  `web/scripts/security/README.md`
  Defines when (and how) allowlists may be extended.

---

## Allowlist Policy (Strict)

Allowlisting is a last resort.

Before adding an allowlist entry, contributors must document:
1. Why the function/view must be accessible
2. Why safer alternatives were rejected
3. Who approved the exception

**Approval Required:** Sami
**Self-approval is not allowed.**

---

## If CI Fails

Do **not** immediately add an allowlist entry.

Instead:
1. Identify which invariant failed
2. Fix the root cause (RLS, permissions, function design, view ownership)
3. Only consider allowlisting if no safer alternative exists

See: `web/scripts/security/README.md#when-ci-fails`

---

## Migration Best Practices (CI Replay Safety)

The Supabase RLS Tripwire CI runs `supabase start` which applies all migrations from scratch.
Migrations must be idempotent and work on fresh databases, not just production.

### Common Pitfalls

| Issue | Solution |
|-------|----------|
| `DROP POLICY IF EXISTS` on non-existent table | Move DROP POLICY **after** CREATE TABLE |
| Using newly added enum value in same migration | Split into two migrations (ADD VALUE, then use it) |
| Backfill INSERT with hardcoded UUIDs | Add `WHERE EXISTS (SELECT 1 FROM ... WHERE id = 'uuid')` |
| REVOKE/GRANT on functions that may not exist | Wrap in `DO $$ ... IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = '...') THEN ... END IF; ... $$` |

### Known SECURITY DEFINER Functions

| Function | Purpose | Callable By |
|----------|---------|-------------|
| `public.is_album_collaborator(album_uuid)` | Breaks circular RLS dependency between `gallery_albums` and `gallery_album_links` by bypassing RLS on `gallery_album_links` to check collaborator status | `authenticated` only |
| `notify_new_user()` | Auth trigger for new user notifications | Trigger context only |
| `rpc_book_studio_service()` | Studio booking RPC | `authenticated` only |

### SECURITY DEFINER Function Pattern

When revoking EXECUTE from SECURITY DEFINER functions, use conditional DO blocks:

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'my_function'
    AND pronamespace = 'public'::regnamespace
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.my_function() FROM anon, public;
  END IF;
END $$;
```

This ensures the migration works on both fresh databases (where the function may not exist)
and production databases (where it does exist and needs privileges revoked).

---

## Secret Hygiene + Rotate/Revoke Runbook

### Local Guardrail: Pre-Commit Secret Scan

This repo includes a lightweight staged-diff scanner:
- Script: `web/scripts/security/precommit-secret-scan.sh`
- Hook: `.githooks/pre-commit`

One-time setup per clone:

```bash
git config core.hooksPath .githooks
```

The hook blocks commits that appear to include:
- `OPENAI_API_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `SMTP_PASSWORD=...`
- `DATABASE_URL=postgres...`
- `sk-proj-...` / `sk-...` style API tokens
- Private key headers (`BEGIN ... PRIVATE KEY`)

### Immediate Response if a Secret is Exposed

1. **Revoke/rotate first, then clean up code**
   - OpenAI: rotate API key
   - Supabase: rotate service role / DB credentials
   - SMTP/email provider: rotate app password
   - Any webhook/provider key: rotate immediately
2. **Update environment variables**
   - Vercel / Supabase / local `.env*` values
   - Redeploy after rotation so old credentials are dead
3. **Remove leaked material from repository state**
   - Delete leaked files (example: local check files with real keys)
   - Ensure ignore rules cover local secret files
4. **Audit logs and cost dashboards**
   - Check unusual API usage, login attempts, and email spikes

### Repository Rule

Never commit real secrets.  
Only commit placeholders (examples with `...`, `<placeholder>`, or docs-only values).

---

## Summary

This project treats database security as **code**, not configuration.

If you are unsure whether a change is safe:
**assume it is not** and ask before merging.

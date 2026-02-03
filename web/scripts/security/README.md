# Supabase RLS Tripwire

This directory contains the RLS (Row-Level Security) tripwire script that runs in CI to detect security regressions.

## What It Checks

| Check | Severity | Description |
|-------|----------|-------------|
| 1. RLS disabled | FAIL | Public tables without RLS enabled |
| 2. SECURITY DEFINER functions | FAIL | Functions callable by anon/public (unless allowlisted) |
| 3. postgres-owned views | FAIL | Views owned by postgres without `security_invoker=true` (unless allowlisted) |
| 4. Dangerous table privileges | FAIL | TRUNCATE, TRIGGER, or REFERENCES granted to anon/authenticated |

## Allowlist Governance

**Any addition to the allowlists requires explicit justification and approval.**

### When adding a SECURITY DEFINER function to the allowlist:

1. **Document why it must be callable by anon/public**
   - What does the function do?
   - Why can't this be done server-side (API route, edge function)?

2. **Document what alternatives were considered**
   - Can it use `SECURITY INVOKER` instead?
   - Can it be restricted to `authenticated` only?
   - Can the logic move to application code?

3. **Get approval**
   - Security-sensitive changes require review
   - Add a comment in the workflow file explaining the allowlist entry

### When adding a postgres-owned view to the allowlist:

1. **Confirm it cannot use `security_invoker=true`**
   - Views with `security_invoker=true` don't need allowlisting
   - Only allowlist if there's a specific reason the view must run as owner

2. **Confirm it's read-only and safe**
   - Does the view expose sensitive data?
   - Could it be used for privilege escalation?

### Current Allowlist Entries

#### Functions (anon + public):

| Function | Justification |
|----------|---------------|
| `public.handle_new_user()` | Auth trigger - must run during signup before user has session |
| `public.upsert_notification_preferences(...)` | User preferences - called during onboarding flow |

#### Views (postgres-owned):

| View | Justification |
|------|---------------|
| `public.event_venue_match` | Read-only view joining events and venues for public display |

## Running Locally

```bash
cd web
source .env.local
export DATABASE_URL

# With env vars for allowlists (copy from workflow file)
TRIPWIRE_ALLOW_ANON_FUNCTIONS="..." \
TRIPWIRE_ALLOW_PUBLIC_FUNCTIONS="..." \
TRIPWIRE_ALLOW_POSTGRES_OWNED_VIEWS="..." \
TRIPWIRE_FAIL_ON_DANGEROUS_TABLE_PRIVS="1" \
node scripts/security/supabase-rls-tripwire.mjs
```

## When CI Fails

### Step 1: Identify which check failed

| Failure Message | Check | Likely Cause |
|-----------------|-------|--------------|
| "RLS disabled on public tables" | Check 1 | New table missing `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` |
| "SECURITY DEFINER functions executable by anon/public" | Check 2 | New function with `SECURITY DEFINER` callable by anon/public |
| "Views owned by postgres without security_invoker=true" | Check 3 | View created by migration (runs as postgres) without `security_invoker=true` |
| "Dangerous table privileges detected" | Check 4 | `GRANT ALL` or explicit TRUNCATE/TRIGGER/REFERENCES grant |

### Step 2: Fix the root cause (don't allowlist first)

| Check | Preferred Fix |
|-------|---------------|
| RLS disabled | Add `ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;` to migration |
| SECURITY DEFINER | Change to `SECURITY INVOKER`, or move logic to API route/edge function |
| postgres-owned view | Add `WITH (security_invoker = true)` to view definition |
| Dangerous privileges | Use specific grants (`SELECT, INSERT, UPDATE, DELETE`) instead of `ALL` |

### Step 3: If allowlisting is truly necessary

1. **Document justification** in this README under "Current Allowlist Entries"
2. **Get approval** from project maintainer (Sami)
3. **Add to workflow** with explanatory comment
4. **Create PR** with security context in description

### Who Can Approve Allowlist Additions

- **Project maintainer (Sami)** — Required for all allowlist changes
- **No self-approvals** — The person adding the allowlist entry cannot approve it

## Anti-Patterns to Avoid

- ❌ "Just add it to the allowlist" without justification
- ❌ Using `SECURITY DEFINER` when `SECURITY INVOKER` would work
- ❌ Granting `ALL` privileges to anon/authenticated
- ❌ Creating postgres-owned views without `security_invoker=true`
- ❌ Disabling RLS on tables exposed to anon/authenticated

## Related Migrations

- `20260202000001_guest_verifications_rls.sql` - Fixed RLS on guest_verifications
- `20260202000002_revoke_dangerous_function_execute.sql` - Revoked EXECUTE on dangerous functions
- `20260202000005_revoke_dangerous_table_privs.sql` - Revoked TRUNCATE/TRIGGER/REFERENCES

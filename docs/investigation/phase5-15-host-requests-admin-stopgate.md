# STOP-GATE Investigation — Host Requests Admin (Pending Count Mismatch)

**Status:** Investigation (Step A) + Critique (Step B)
**Date:** 2026-02-05
**Owner:** Repo Agent

## Problem Statement
Admin UI shows **0** pending host requests, but the database has **1** pending request.

## Evidence (Step A)

### 1) Pending host request exists in DB
**Query:**
```sql
SELECT id, user_id, status, created_at
FROM host_requests
WHERE status = 'pending'
ORDER BY created_at DESC;
```
**Result:** 1 row
- `id`: `63b17ba5-1c88-4205-843c-18edf0f98463`
- `user_id`: `a407c8e5-4f3c-4795-b199-05d824578659`
- `status`: `pending`
- `created_at`: `2026-02-01 15:32:27.348018+00`

### 2) Admin UI query embeds `profiles`
**File:** `web/src/app/(protected)/dashboard/admin/host-requests/page.tsx`
```ts
const { data: requests } = await supabase
  .from("host_requests")
  .select(`
    *,
    user:profiles(id, full_name, avatar_url)
  `)
  .order("created_at", { ascending: true });
```

**API route uses the same embed:**
- `web/src/app/api/admin/host-requests/route.ts`

### 3) PostgREST embed fails because there is no FK to `profiles`
**Constraint check:**
```sql
SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS ref_table,
       pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE contype='f' AND conrelid='public.host_requests'::regclass;
```
**Result:**
- `host_requests_user_id_fkey` → `auth.users`
- `host_requests_reviewed_by_fkey` → `auth.users`

**No FK exists from** `host_requests.user_id` → `public.profiles.id`, so PostgREST cannot infer the relationship for `user:profiles(...)` embeds.

### 4) No FK on `profiles` → `auth.users`
```sql
SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS ref_table,
       pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE contype='f' AND conrelid='public.profiles'::regclass;
```
**Result:** none.

### 5) FK feasibility check (existing data)
```sql
SELECT COUNT(*) AS total,
       COUNT(p.id) AS with_profile,
       COUNT(*) - COUNT(p.id) AS missing_profile
FROM host_requests hr
LEFT JOIN profiles p ON p.id = hr.user_id;
```
**Result:** `missing_profile = 0` (safe to add FK now)

### 6) Admin RLS depends on app_metadata.role, but admin user lacks it
**Policy source:** `supabase/migrations/20251210000001_fix_rls_auth_users.sql`
- `public.is_admin()` checks `auth.jwt() -> app_metadata ->> 'role'`

**DB check:**
```sql
SELECT id, email, raw_app_meta_data->>'role' AS app_role
FROM auth.users
WHERE id IN (SELECT id FROM profiles WHERE role = 'admin');
```
**Result:** `app_role` is `NULL` for the admin user.

**Impact:** RLS admin policies do not treat this user as admin, which will block visibility of other users’ host requests once they exist.

---

## Root Cause Summary
1) **Embed failure**: Admin UI uses `user:profiles(...)` but `host_requests.user_id` only references `auth.users` — PostgREST cannot resolve the embed, so the query fails and UI silently shows empty data.
2) **Admin auth mismatch**: RLS uses `auth.jwt().app_metadata.role`, but the admin user only has `profiles.role = 'admin'`. This is inconsistent and will block admin access in RLS-protected tables.

---

## Proposed Fixes (Step A)

### A) DB Fix (PostgREST embed)
- Add FK: `host_requests.user_id → public.profiles.id` (additive migration).
- Constraint ensures embed works for: `select("*, user:profiles(id, full_name, avatar_url)")`.
- Data check passed: no missing profiles for current rows.

### B) Admin Role Fix
- Set `auth.users.raw_app_meta_data.role = 'admin'` for the admin user via Supabase-supported method.
- Document that **RLS uses app_metadata.role**; `profiles.role` is not authoritative for RLS.

### C) Code Hardening
- If PostgREST embed errors, **surface admin-only error** in UI and log the error server-side.
- API route should return clear 500 error if the query fails.
- Add a minimal test or integration check to guard the embed relationship.

---

## Critique (Step B)

### Risks
- **Migration failure** if any `host_requests.user_id` lacks a matching `profiles.id`.
  - Mitigation: preflight query (already shows 0 missing). Re-run right before migration in prod.
- **Future inserts** could fail if profile auto-create ever breaks.
  - Mitigation: confirm `handle_new_user` trigger is active; add monitoring for missing profiles.

### Coupling
- Database: `public.host_requests`, `public.profiles`
- API: `/api/admin/host-requests`
- UI: `/dashboard/admin/host-requests`
- RLS: `public.is_admin()` policies

### Migrations
- Add FK constraint (additive, no data loss).
- Potential additional index not required (profiles.id is PK).

### Rollback Plan
- Drop the FK if needed:
  ```sql
  ALTER TABLE public.host_requests
  DROP CONSTRAINT IF EXISTS host_requests_user_id_profiles_fkey;
  ```

### Test Coverage
- Add a minimal integration test for host requests admin query.
  - Option: test server route `/api/admin/host-requests` error handling.
  - Option: test `HostRequestsTable` receives data and renders pending count.
- Add regression check that admin page surfaces errors (not silent).

---

## Requested Approval
If approved, I will:
1) Add migration to enforce FK.
2) Update docs for admin role source of truth (app_metadata).
3) Harden admin host requests UI/API error handling.
4) Add tests / integration check.
5) Run lint, tests, build.

**Waiting for approval to execute.**

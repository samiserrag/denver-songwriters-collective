# Supabase RLS Hardening — Implementation Report

**Date:** February 2, 2026
**Implementer:** Repo Agent (Claude)
**Status:** ✅ COMPLETE

---

## Executive Summary

This document records the implementation of security hardening for Supabase SECURITY DEFINER functions. The goal was to reduce attack surface by revoking unnecessary EXECUTE privileges from `anon` and `public` roles while preserving application functionality.

### Results

| Metric | Before | After |
|--------|--------|-------|
| Functions with `anon=YES` | 18 | 2 |
| Functions with `public=YES` | 18 | 2 |
| Tests passing | 3499 | 3499 |
| RLS policies functional | Yes | Yes |

---

## Migrations Applied

### 1. `20260202000001_guest_verifications_rls.sql` (Phase 1)
- Added 3 explicit deny policies to `guest_verifications` table
- Prevents direct INSERT/UPDATE/DELETE from `anon` and `authenticated` roles
- Service role continues to handle verifications (bypasses RLS)

### 2. `20260202000002_revoke_dangerous_function_execute.sql` (Phase 1)
- Revoked `anon` and `public` EXECUTE on notification functions
- Fully restricted `cleanup_old_logs` to `service_role` only
- Note: `authenticated` retained EXECUTE on notification functions (required by app architecture)

### 3. `20260202000004_reduce_security_definer_execute_surface.sql` (Phase 2)
- Revoked `anon` and `public` EXECUTE on 13 additional functions:
  - Trigger-only functions (5)
  - Helper functions (4)
  - Unused functions (2)
  - Server-only RPC (1)
  - RLS-dependent function (1 - `is_admin`)

---

## Function Classification

### Category A: RLS-Dependent (DO NOT revoke authenticated)

| Function | RLS Policies | Action Taken |
|----------|--------------|--------------|
| `is_admin()` | 59 policies | Revoked anon/public, kept authenticated |

### Category B: Trigger-Only Functions

| Function | Trigger Binding | Action Taken |
|----------|-----------------|--------------|
| `handle_profile_slug()` | profiles | Revoked anon/public |
| `venue_slug_trigger()` | venues | Revoked anon/public |
| `cleanup_event_watchers_on_host_assign()` | events | Revoked anon/public |
| `enforce_event_status_invariants()` | events | Revoked anon/public |
| `prevent_admin_delete()` | profiles | Revoked anon/public |

### Category B: Helper Functions (called by triggers)

| Function | Called By | Action Taken |
|----------|-----------|--------------|
| `generate_profile_slug()` | handle_profile_slug | Revoked anon/public |
| `generate_venue_slug()` | venue_slug_trigger | Revoked anon/public |
| `generate_event_timeslots()` | Not used in app | Revoked anon/public |
| `generate_recurring_event_instances()` | Not used in app | Revoked anon/public |

### Category B: Unused Functions

| Function | Evidence | Action Taken |
|----------|----------|--------------|
| `mark_timeslot_no_show()` | Not in app code | Revoked anon/public |
| `mark_timeslot_performed()` | Not in app code | Revoked anon/public |

### Category C: Server-Only RPC

| Function | Client Used | Action Taken |
|----------|-------------|--------------|
| `promote_timeslot_waitlist()` | createServiceRoleClient() | Revoked anon/public |
| `cleanup_old_logs()` | Admin dashboard | Revoked all except service_role |
| `create_user_notification()` | Server routes | Revoked anon/public |
| `create_admin_notification()` | Server routes | Revoked anon/public |

### Category D: Client RPC (kept authenticated)

| Function | Usage | Action Taken |
|----------|-------|--------------|
| `upsert_notification_preferences()` | Dashboard settings | NOT TOUCHED |

### Untouched (Safety)

| Function | Reason | Action Taken |
|----------|--------|--------------|
| `handle_new_user()` | Signup flow, auth.users trigger | NOT TOUCHED |

---

## Before/After Privilege Snapshot

### Before Phase 2

```
function_name                          | anon | auth | public | service
---------------------------------------+------+------+--------+---------
cleanup_event_watchers_on_host_assign  | YES  | YES  | YES    | YES
enforce_event_status_invariants        | YES  | YES  | YES    | YES
generate_event_timeslots               | YES  | YES  | YES    | YES
generate_profile_slug                  | YES  | YES  | YES    | YES
generate_recurring_event_instances     | YES  | YES  | YES    | YES
generate_venue_slug                    | YES  | YES  | YES    | YES
handle_new_user                        | YES  | YES  | YES    | YES
handle_profile_slug                    | YES  | YES  | YES    | YES
is_admin                               | YES  | YES  | YES    | YES
mark_timeslot_no_show                  | YES  | YES  | YES    | YES
mark_timeslot_performed                | YES  | YES  | YES    | YES
prevent_admin_delete                   | YES  | YES  | YES    | YES
promote_timeslot_waitlist              | YES  | YES  | YES    | YES
upsert_notification_preferences        | YES  | YES  | YES    | YES
venue_slug_trigger                     | YES  | YES  | YES    | YES
cleanup_old_logs                       | NO   | NO   | NO     | YES  (Phase 1)
create_admin_notification              | NO   | YES  | NO     | YES  (Phase 1)
create_user_notification               | NO   | YES  | NO     | YES  (Phase 1)
```

### After Phase 2

```
function_name                          | anon | auth | public | service
---------------------------------------+------+------+--------+---------
cleanup_event_watchers_on_host_assign  | NO   | YES  | NO     | YES
enforce_event_status_invariants        | NO   | YES  | NO     | YES
generate_event_timeslots               | NO   | YES  | NO     | YES
generate_profile_slug                  | NO   | YES  | NO     | YES
generate_recurring_event_instances     | NO   | YES  | NO     | YES
generate_venue_slug                    | NO   | YES  | NO     | YES
handle_new_user                        | YES  | YES  | YES    | YES  (untouched)
handle_profile_slug                    | NO   | YES  | NO     | YES
is_admin                               | NO   | YES  | NO     | YES
mark_timeslot_no_show                  | NO   | YES  | NO     | YES
mark_timeslot_performed                | NO   | YES  | NO     | YES
prevent_admin_delete                   | NO   | YES  | NO     | YES
promote_timeslot_waitlist              | NO   | YES  | NO     | YES
upsert_notification_preferences        | YES  | YES  | YES    | YES  (untouched)
venue_slug_trigger                     | NO   | YES  | NO     | YES
cleanup_old_logs                       | NO   | NO   | NO     | YES
create_admin_notification              | NO   | YES  | NO     | YES
create_user_notification               | NO   | YES  | NO     | YES
```

---

## Verification Results

### Tests
- **3499/3499 tests pass** after all migrations

### Lint
- **0 errors, 0 warnings**

### Build
- **All routes compile successfully**

### Database Verification
```sql
-- 51/51 tables have RLS enabled
SELECT COUNT(*) as total, SUM(CASE WHEN relrowsecurity THEN 1 ELSE 0 END) as rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public';
-- Result: 51, 51

-- 213 RLS policies exist (210 original + 3 from Phase 1)
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Result: 213
```

---

## Rollback Plan

If issues are discovered post-deployment:

### Rollback Phase 2
```sql
-- Re-grant EXECUTE to anon and public for all hardened functions
GRANT EXECUTE ON FUNCTION public.handle_profile_slug() TO anon, public;
GRANT EXECUTE ON FUNCTION public.venue_slug_trigger() TO anon, public;
GRANT EXECUTE ON FUNCTION public.cleanup_event_watchers_on_host_assign() TO anon, public;
GRANT EXECUTE ON FUNCTION public.enforce_event_status_invariants() TO anon, public;
GRANT EXECUTE ON FUNCTION public.prevent_admin_delete() TO anon, public;
GRANT EXECUTE ON FUNCTION public.generate_profile_slug(text, uuid) TO anon, public;
GRANT EXECUTE ON FUNCTION public.generate_venue_slug(text, uuid) TO anon, public;
GRANT EXECUTE ON FUNCTION public.generate_event_timeslots(uuid) TO anon, public;
GRANT EXECUTE ON FUNCTION public.generate_recurring_event_instances(uuid, integer) TO anon, public;
GRANT EXECUTE ON FUNCTION public.mark_timeslot_no_show(uuid, uuid) TO anon, public;
GRANT EXECUTE ON FUNCTION public.mark_timeslot_performed(uuid, uuid) TO anon, public;
GRANT EXECUTE ON FUNCTION public.promote_timeslot_waitlist(uuid, integer) TO anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, public;
```

### Rollback Phase 1
```sql
-- Remove deny policies from guest_verifications
DROP POLICY IF EXISTS "Deny direct inserts" ON guest_verifications;
DROP POLICY IF EXISTS "Deny direct updates" ON guest_verifications;
DROP POLICY IF EXISTS "Deny direct deletes" ON guest_verifications;

-- Re-grant EXECUTE on notification functions
GRANT EXECUTE ON FUNCTION public.create_user_notification(uuid, text, text, text, text) TO anon, public;
GRANT EXECUTE ON FUNCTION public.create_admin_notification(notification_type, text, text, uuid, jsonb) TO anon, public;
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs() TO anon, authenticated, public;
```

---

## Deferred Security Improvements

### 1. Full Notification Function Lockdown
**Current state:** `authenticated` can call `create_user_notification` and `create_admin_notification`
**Risk:** Authenticated users can create notifications for any user_id
**Required fix:** Refactor app code to use `createServiceRoleClient()` for notification RPC calls

### 2. `handle_new_user()` Hardening
**Current state:** Callable by `anon`, `authenticated`, `public`
**Risk:** Low (function is bound to auth.users trigger)
**Investigation needed:** Confirm whether revoking from anon breaks signup

### 3. `upsert_notification_preferences()` Internal Validation
**Current state:** Callable by all roles
**Risk:** Any authenticated user can update any user's preferences
**Required fix:** Add `auth.uid() = p_user_id` check inside function body

---

## Audit Log

| Timestamp | Action | Result |
|-----------|--------|--------|
| 2026-02-02 17:00 | Phase 0 prechecks | PASS |
| 2026-02-02 17:05 | Verified Phase 1 migrations from previous session | PASS |
| 2026-02-02 17:10 | STOP-GATE #1 verification | PASS |
| 2026-02-02 17:15 | Identified 18 SECURITY DEFINER functions | Complete |
| 2026-02-02 17:30 | Classified functions by category | Complete |
| 2026-02-02 18:30 | Applied Phase 2 migration | PASS |
| 2026-02-02 18:35 | STOP-GATE #2 verification | PASS |
| 2026-02-02 18:40 | Documentation complete | PASS |

---

## Files Created/Modified

### Created
- `supabase/migrations/20260202000001_guest_verifications_rls.sql`
- `supabase/migrations/20260202000002_revoke_dangerous_function_execute.sql`
- `supabase/migrations/20260202000004_reduce_security_definer_execute_surface.sql`
- `docs/security/supabase-rls-audit.md`
- `docs/security/supabase-rls-hardening-implementation.md` (this file)

### Not Modified
- Application code (no changes required)
- RLS policies (only additions, no modifications)

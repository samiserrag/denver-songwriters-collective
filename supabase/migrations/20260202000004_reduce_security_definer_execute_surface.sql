-- Migration: 20260202000004_reduce_security_definer_execute_surface.sql
-- Purpose: Reduce attack surface of SECURITY DEFINER functions by revoking unnecessary EXECUTE privileges
-- Created: 2026-02-02
-- Approved: Phase 2 security hardening
--
-- Classification:
--   - Category A (RLS-dep): is_admin() - DO NOT REVOKE authenticated
--   - Category B (Trigger/Helper): Trigger functions don't need direct EXECUTE from anon/public
--   - Category C (Server RPC): promote_timeslot_waitlist uses service_role client
--   - Category D (Client RPC): upsert_notification_preferences needs authenticated
--
-- Safe to revoke from anon/public:
--   - Trigger-only functions (run in owner context)
--   - Helper functions (called by triggers, not direct RPC)
--   - Unused functions
--   - promote_timeslot_waitlist (server-side uses service_role)
--
-- KEEPING authenticated for:
--   - is_admin() - Critical for 59 RLS policies
--   - handle_new_user() - Signup flow (unclear if needed)
--   - upsert_notification_preferences() - Dashboard settings page

-- ============================================================================
-- CATEGORY B: Trigger-only functions
-- These are bound to triggers and don't need direct EXECUTE from anon/public
-- ============================================================================

-- handle_profile_slug: trigger on profiles
REVOKE EXECUTE ON FUNCTION public.handle_profile_slug() FROM anon, public;

-- venue_slug_trigger: trigger on venues
REVOKE EXECUTE ON FUNCTION public.venue_slug_trigger() FROM anon, public;

-- cleanup_event_watchers_on_host_assign: trigger on events
REVOKE EXECUTE ON FUNCTION public.cleanup_event_watchers_on_host_assign() FROM anon, public;

-- enforce_event_status_invariants: trigger on events
REVOKE EXECUTE ON FUNCTION public.enforce_event_status_invariants() FROM anon, public;

-- prevent_admin_delete: trigger on profiles
REVOKE EXECUTE ON FUNCTION public.prevent_admin_delete() FROM anon, public;

-- ============================================================================
-- CATEGORY B: Helper functions (called by triggers, not direct RPC)
-- ============================================================================

-- generate_profile_slug: called by handle_profile_slug trigger
REVOKE EXECUTE ON FUNCTION public.generate_profile_slug(text, uuid) FROM anon, public;

-- generate_venue_slug: called by venue_slug_trigger
REVOKE EXECUTE ON FUNCTION public.generate_venue_slug(text, uuid) FROM anon, public;

-- generate_event_timeslots: not used in app code
REVOKE EXECUTE ON FUNCTION public.generate_event_timeslots(uuid) FROM anon, public;

-- generate_recurring_event_instances: not used in app code
REVOKE EXECUTE ON FUNCTION public.generate_recurring_event_instances(uuid, integer) FROM anon, public;

-- ============================================================================
-- CATEGORY B: Unused functions (not called in app code)
-- ============================================================================

-- mark_timeslot_no_show: not used in current app code
REVOKE EXECUTE ON FUNCTION public.mark_timeslot_no_show(uuid, uuid) FROM anon, public;

-- mark_timeslot_performed: not used in current app code
REVOKE EXECUTE ON FUNCTION public.mark_timeslot_performed(uuid, uuid) FROM anon, public;

-- ============================================================================
-- CATEGORY C: Server-only RPC (uses service_role client)
-- ============================================================================

-- promote_timeslot_waitlist: called from /api/guest/action via createServiceRoleClient()
REVOKE EXECUTE ON FUNCTION public.promote_timeslot_waitlist(uuid, integer) FROM anon, public;

-- ============================================================================
-- CATEGORY A: RLS-dependent - REVOKE anon/public ONLY, keep authenticated
-- ============================================================================

-- is_admin: used in 59 RLS policies - MUST keep authenticated, revoke anon/public only
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;

-- ============================================================================
-- Ensure service_role retains EXECUTE on all functions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.handle_profile_slug() TO service_role;
GRANT EXECUTE ON FUNCTION public.venue_slug_trigger() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_event_watchers_on_host_assign() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_event_status_invariants() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_admin_delete() TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_profile_slug(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_venue_slug(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_event_timeslots(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_recurring_event_instances(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_timeslot_no_show(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_timeslot_performed(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_timeslot_waitlist(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- ============================================================================
-- DO NOT TOUCH: These functions need authenticated access
-- ============================================================================
-- handle_new_user() - May be needed for signup flow
-- upsert_notification_preferences() - Needed by dashboard settings
-- create_user_notification() - Already hardened in Phase 1
-- create_admin_notification() - Already hardened in Phase 1
-- cleanup_old_logs() - Already hardened in Phase 1

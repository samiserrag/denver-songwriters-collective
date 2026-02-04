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
-- Using conditional revokes to handle fresh databases where functions may not exist
-- ============================================================================

DO $$
BEGIN
  -- handle_profile_slug: trigger on profiles
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_profile_slug' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.handle_profile_slug() FROM anon, public;
  END IF;

  -- venue_slug_trigger: trigger on venues
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'venue_slug_trigger' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.venue_slug_trigger() FROM anon, public;
  END IF;

  -- cleanup_event_watchers_on_host_assign: trigger on events
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_event_watchers_on_host_assign' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.cleanup_event_watchers_on_host_assign() FROM anon, public;
  END IF;

  -- enforce_event_status_invariants: trigger on events
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enforce_event_status_invariants' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.enforce_event_status_invariants() FROM anon, public;
  END IF;

  -- prevent_admin_delete: trigger on profiles
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'prevent_admin_delete' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.prevent_admin_delete() FROM anon, public;
  END IF;
END $$;

-- ============================================================================
-- CATEGORY B: Helper functions (called by triggers, not direct RPC)
-- ============================================================================

DO $$
BEGIN
  -- generate_profile_slug: called by handle_profile_slug trigger
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_profile_slug' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.generate_profile_slug(text, uuid) FROM anon, public;
  END IF;

  -- generate_venue_slug: called by venue_slug_trigger
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_venue_slug' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.generate_venue_slug(text, uuid) FROM anon, public;
  END IF;

  -- generate_event_timeslots: not used in app code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_event_timeslots' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.generate_event_timeslots(uuid) FROM anon, public;
  END IF;

  -- generate_recurring_event_instances: not used in app code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_recurring_event_instances' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.generate_recurring_event_instances(uuid, integer) FROM anon, public;
  END IF;
END $$;

-- ============================================================================
-- CATEGORY B: Unused functions (not called in app code)
-- ============================================================================

DO $$
BEGIN
  -- mark_timeslot_no_show: not used in current app code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_timeslot_no_show' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.mark_timeslot_no_show(uuid, uuid) FROM anon, public;
  END IF;

  -- mark_timeslot_performed: not used in current app code
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_timeslot_performed' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.mark_timeslot_performed(uuid, uuid) FROM anon, public;
  END IF;

  -- notify_new_user: trigger/helper function, not direct RPC
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_new_user' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.notify_new_user() FROM anon, public;
  END IF;

  -- rpc_book_studio_service: unused studio booking function
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rpc_book_studio_service' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.rpc_book_studio_service(uuid, timestamp with time zone) FROM anon, public;
  END IF;
END $$;

-- ============================================================================
-- CATEGORY C: Server-only RPC (uses service_role client)
-- ============================================================================

DO $$
BEGIN
  -- promote_timeslot_waitlist: called from /api/guest/action via createServiceRoleClient()
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'promote_timeslot_waitlist' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.promote_timeslot_waitlist(uuid, integer) FROM anon, public;
  END IF;
END $$;

-- ============================================================================
-- CATEGORY A: RLS-dependent - REVOKE anon/public ONLY, keep authenticated
-- ============================================================================

DO $$
BEGIN
  -- is_admin: used in 59 RLS policies - MUST keep authenticated, revoke anon/public only
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
  END IF;
END $$;

-- ============================================================================
-- Ensure service_role retains EXECUTE on all functions
-- Using conditional grants to handle fresh databases where functions may not exist
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_profile_slug' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.handle_profile_slug() TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'venue_slug_trigger' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.venue_slug_trigger() TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_event_watchers_on_host_assign' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.cleanup_event_watchers_on_host_assign() TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enforce_event_status_invariants' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.enforce_event_status_invariants() TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'prevent_admin_delete' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.prevent_admin_delete() TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_profile_slug' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.generate_profile_slug(text, uuid) TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_venue_slug' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.generate_venue_slug(text, uuid) TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_event_timeslots' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.generate_event_timeslots(uuid) TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_recurring_event_instances' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.generate_recurring_event_instances(uuid, integer) TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_timeslot_no_show' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.mark_timeslot_no_show(uuid, uuid) TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_timeslot_performed' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.mark_timeslot_performed(uuid, uuid) TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'promote_timeslot_waitlist' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.promote_timeslot_waitlist(uuid, integer) TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_new_user' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.notify_new_user() TO service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rpc_book_studio_service' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION public.rpc_book_studio_service(uuid, timestamp with time zone) TO service_role;
  END IF;
END $$;

-- ============================================================================
-- DO NOT TOUCH: These functions need authenticated access
-- ============================================================================
-- handle_new_user() - May be needed for signup flow
-- upsert_notification_preferences() - Needed by dashboard settings
-- create_user_notification() - Already hardened in Phase 1
-- create_admin_notification() - Already hardened in Phase 1
-- cleanup_old_logs() - Already hardened in Phase 1

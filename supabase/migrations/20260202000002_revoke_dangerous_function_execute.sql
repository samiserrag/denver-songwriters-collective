-- Migration: 20260202000002_revoke_dangerous_function_execute.sql
-- Purpose: Revoke EXECUTE privileges on SECURITY DEFINER functions from anon/public
--
-- IMPORTANT: authenticated users retain EXECUTE on notification functions because
-- application code calls these functions from authenticated API routes using
-- createSupabaseServerClient() which runs as authenticated, not service_role.
--
-- Risk addressed: MEDIUM - Prevent anonymous users from calling dangerous functions
-- Risk addressed: MEDIUM - cleanup_old_logs restricted to service_role only
-- See: docs/security/supabase-rls-audit.md

-- Revoke execute from anon and public roles (but NOT authenticated)
-- These functions should never be called by anonymous users
REVOKE EXECUTE ON FUNCTION public.create_user_notification(uuid, text, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_admin_notification(notification_type, text, text, uuid, jsonb) FROM anon, public;

-- Revoke cleanup_old_logs from all user roles - only service_role should call this
-- This is typically invoked by scheduled jobs, not user-initiated requests
REVOKE EXECUTE ON FUNCTION public.cleanup_old_logs() FROM anon, authenticated, public;

-- Ensure service_role has execute privileges
GRANT EXECUTE ON FUNCTION public.create_user_notification(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_admin_notification(notification_type, text, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs() TO service_role;

-- Authenticated users retain execute on notification functions
-- This is required because API routes use authenticated context (not service_role)
-- to create notifications via sendEmailWithPreferences() and direct RPC calls
GRANT EXECUTE ON FUNCTION public.create_user_notification(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_notification(notification_type, text, text, uuid, jsonb) TO authenticated;

-- Note: Trigger functions (generate_profile_slug, venue_slug_trigger, etc.) are NOT revoked
-- as they are invoked by PostgreSQL triggers, not user calls.
--
-- Note: Functions with proper permission checks (mark_timeslot_no_show, etc.) are NOT revoked
-- as they validate caller permissions internally.
--
-- SECURITY IMPROVEMENT DEFERRED:
-- To fully secure notification functions, application code would need to be refactored to:
-- 1. Use createServiceRoleClient() instead of createSupabaseServerClient() for RPC calls
-- 2. Or add permission validation inside the functions themselves (Remediation #3 in audit)
-- This is tracked as a future security improvement.

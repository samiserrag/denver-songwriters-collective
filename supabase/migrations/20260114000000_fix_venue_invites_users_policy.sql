-- Fix venue_invites RLS: Drop policy that queries auth.users
--
-- Problem: The "users_see_own_invites" policy contains a subquery:
--   SELECT email FROM auth.users WHERE id = auth.uid()
--
-- The "authenticated" role does NOT have SELECT permission on auth.users.
-- This causes "permission denied for table users" (error code 42501) during
-- INSERT operations, even though the policy is SELECT-only, because PostgreSQL
-- evaluates RLS policies during INSERT.
--
-- Fix: Drop the problematic policy. Token acceptance is handled through the
-- service role client (which bypasses RLS), so this policy is not needed.

DROP POLICY IF EXISTS "users_see_own_invites" ON venue_invites;

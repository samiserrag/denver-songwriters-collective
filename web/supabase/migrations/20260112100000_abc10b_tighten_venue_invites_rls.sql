-- ABC10b: Tighten venue_invites RLS
--
-- Problem: The "anyone_can_lookup_by_token" policy exposes ALL invites to ALL
-- authenticated users. This allows enumeration of active invites.
--
-- Fix: Remove the overly broad SELECT policy and rely on:
-- 1. Admin policy (already exists)
-- 2. Service role for token acceptance (bypasses RLS)
--
-- Token lookup during acceptance is done via service role client,
-- so we don't need a user-facing token lookup policy.

-- Drop the overly broad policy
DROP POLICY IF EXISTS "anyone_can_lookup_by_token" ON venue_invites;

-- Add policy for venue managers to see invites for their venues
-- (Managers may need to see pending invites for coordination)
CREATE POLICY "managers_see_venue_invites" ON venue_invites
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM venue_managers
      WHERE venue_managers.venue_id = venue_invites.venue_id
      AND venue_managers.user_id = auth.uid()
      AND venue_managers.revoked_at IS NULL
    )
  );

-- Add policy for users to see invites addressed to them
CREATE POLICY "users_see_own_invites" ON venue_invites
  FOR SELECT TO authenticated
  USING (
    -- If email_restriction is set and matches current user's email
    email_restriction IS NOT NULL
    AND email_restriction = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

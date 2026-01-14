-- Fix venue_invites RLS policy for INSERT operations
--
-- Problem: The "Admins can manage all venue invites" policy had only a USING clause
-- but no WITH CHECK clause. For INSERT operations, RLS requires WITH CHECK.
-- This caused admin venue invite creation to fail silently.
--
-- Root cause: Original policy was created with just USING, which works for
-- SELECT/UPDATE/DELETE but not INSERT.

-- Drop the existing policy that's missing WITH CHECK
DROP POLICY IF EXISTS "Admins can manage all venue invites" ON venue_invites;

-- Recreate with both USING and WITH CHECK clauses
CREATE POLICY "Admins can manage all venue invites" ON venue_invites
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

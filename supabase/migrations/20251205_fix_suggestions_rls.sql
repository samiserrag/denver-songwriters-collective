-- Block 4 Security Hardening: Fix RLS policies for event_update_suggestions
-- This migration tightens permissions and adds missing UPDATE/DELETE policies

-- Drop overly permissive policies
DROP POLICY IF EXISTS "allow_public_insert_suggestions" ON event_update_suggestions;
DROP POLICY IF EXISTS "allow_public_select_suggestions" ON event_update_suggestions;

-- INSERT: public allowed, but must reference a real event
CREATE POLICY "public_insert_with_valid_event"
ON event_update_suggestions
FOR INSERT
TO public
WITH CHECK (
  event_id IS NOT NULL 
  AND EXISTS (SELECT 1 FROM events WHERE id = event_id)
);

-- SELECT: authenticated only (protects submitter emails, admin page still works)
CREATE POLICY "authenticated_select_all"
ON event_update_suggestions
FOR SELECT
TO authenticated
USING (true);

-- UPDATE: authenticated only (admin API validates role in code)
CREATE POLICY "authenticated_update_all"
ON event_update_suggestions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE: authenticated only (admin API validates role in code)
CREATE POLICY "authenticated_delete_all"
ON event_update_suggestions
FOR DELETE
TO authenticated
USING (true);

-- ============================================================================
-- Fix event_comments RLS: replace JWT-based admin check with DB-based check
--
-- BEFORE: "Admins can manage all comments" policy uses JWT metadata:
--   EXISTS (SELECT 1 FROM auth.users WHERE users.id = auth.uid()
--     AND users.raw_app_meta_data ->> 'role' = 'admin')
--
-- AFTER: Separate UPDATE/DELETE policies using public.is_admin() function
--
-- NOTE: The old policy was ALL (SELECT, INSERT, UPDATE, DELETE).
--   We only need admin UPDATE/DELETE for moderation.
--   Admins can already read via other SELECT policies.
--
-- ROLLBACK: See PR description for original policy definition
-- ============================================================================

-- Drop the JWT-based ALL policy
DROP POLICY IF EXISTS "Admins can manage all comments" ON public.event_comments;

-- Create admin UPDATE policy (for moderation)
DROP POLICY IF EXISTS event_comments_admin_update ON public.event_comments;
CREATE POLICY event_comments_admin_update
ON public.event_comments
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Create admin DELETE policy (for moderation)
DROP POLICY IF EXISTS event_comments_admin_delete ON public.event_comments;
CREATE POLICY event_comments_admin_delete
ON public.event_comments
FOR DELETE
USING (public.is_admin());

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

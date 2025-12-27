-- ============================================================================
-- Fix profiles SELECT policy: replace all SELECT policies with one explicit policy
--
-- BEFORE: Two conflicting SELECT policies:
--   1. "Public read access to profiles" - USING (true) - allows unrestricted reads!
--   2. "select_profiles" - USING (is_public=true OR self OR admin) - proper restrictions
--
-- AFTER: Single profiles_select policy with explicit intent:
--   - Public profiles (is_public=true) visible to everyone
--   - Users can always see their own profile
--   - Admins can see all profiles
--
-- ROLLBACK: See PR description for original policy definitions
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Public read access to profiles" ON public.profiles;

-- Drop the existing select_profiles policy (we'll recreate with same logic)
DROP POLICY IF EXISTS "select_profiles" ON public.profiles;

-- Create single explicit SELECT policy
CREATE POLICY profiles_select
ON public.profiles
FOR SELECT
USING (
  -- Public profiles visible to everyone
  (is_public = true)
  -- Users can always see their own profile
  OR (auth.uid() IS NOT NULL AND auth.uid() = id)
  -- Admins can see all profiles
  OR public.is_admin()
);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

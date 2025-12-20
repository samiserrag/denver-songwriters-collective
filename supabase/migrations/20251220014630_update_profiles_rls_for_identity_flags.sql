-- Update profiles RLS policy to support identity flags
-- This ensures users with is_songwriter, is_studio, is_host, or is_fan = true
-- are visible on the public Members page, even if role is NULL

DROP POLICY IF EXISTS select_profiles ON profiles;

CREATE POLICY select_profiles ON profiles
  FOR SELECT USING (
    -- Public can see profiles with legacy role='performer'
    (role = 'performer')
    -- OR public can see profiles with any identity flag set
    OR (is_songwriter = true OR is_studio = true OR is_fan = true OR is_host = true)
    -- Users can always see their own profile
    OR (auth.uid() IS NOT NULL AND auth.uid() = id)
    -- Admins can see all profiles
    OR is_admin()
  );

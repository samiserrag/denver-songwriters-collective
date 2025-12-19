-- Fix: Allow public read access to performer profiles and admin read access to all profiles
--
-- Issues being fixed:
-- 1. Public /performers page can't see any profiles (needs public read for performers)
-- 2. Admin /dashboard/admin/users page can't see all users (needs admin read for all)
--
-- The previous RLS policy only allowed users to read their own profile or admins to read all,
-- but "admins" check was via is_admin() which may have issues in some contexts.

-- Drop ALL existing select policies on profiles to avoid conflicts
DROP POLICY IF EXISTS select_profiles ON profiles;
DROP POLICY IF EXISTS public_read_profiles ON profiles;

-- Create a comprehensive select policy that allows:
-- 1. Anyone (including anonymous) to read performer profiles (for public /performers page)
-- 2. Authenticated users to read their own profile (for dashboard)
-- 3. Admins to read ALL profiles (for admin user directory)
CREATE POLICY select_profiles ON profiles
  FOR SELECT USING (
    -- Public can see profiles with role = 'performer' (for /performers page)
    (role = 'performer')
    -- Users can always see their own profile
    OR (auth.uid() IS NOT NULL AND auth.uid() = id)
    -- Admins can see all profiles (for admin dashboard)
    OR is_admin()
  );

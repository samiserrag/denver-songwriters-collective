-- Fix anon profile reads after is_admin() EXECUTE was revoked from anon/public.
--
-- Problem:
-- profiles SELECT policy includes is_admin() and is assigned to role public.
-- For anon requests this can fail with "permission denied for function is_admin",
-- which prevents rendering public member names in lineup/timeslot UIs.
--
-- Strategy:
-- 1) Keep the base SELECT policy public-safe (is_public OR own profile).
-- 2) Add admin-only SELECT via a separate authenticated policy.
-- 3) Scope admin mutation policies to authenticated to avoid anon evaluation.

-- 1) Make base select policy anon-safe (no is_admin call)
ALTER POLICY profiles_select
  ON public.profiles
  USING (
    (is_public = true)
    OR ((auth.uid() IS NOT NULL) AND (auth.uid() = id))
  );

-- 2) Add explicit admin SELECT policy for authenticated users
CREATE POLICY profiles_select_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 3) Ensure admin/mutation policies are not evaluated for anon
ALTER POLICY delete_admin_only
  ON public.profiles
  TO authenticated;

ALTER POLICY update_own_profile
  ON public.profiles
  TO authenticated;

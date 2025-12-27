-- Fix is_admin() function to work correctly when called from RLS policies
--
-- Root cause: is_admin() had SET search_path = '' which broke RLS policy
-- evaluation because policies call the function without schema prefix.
--
-- Solution: Remove search_path restriction. The function body already uses
-- fully-qualified references (public.profiles, public.user_role) so it's
-- still secure. SECURITY DEFINER ensures it runs with owner privileges.
--
-- This fixes 44 RLS policies across 30 tables that call is_admin().

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'::public.user_role
  );
$$;

-- Ensure grants are in place
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- Fix is_admin() to use fully-qualified type reference
-- The function has search_path='' for security, so 'admin' comparison
-- needs explicit schema prefix for the user_role enum type.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'::public.user_role
  );
$$;

-- Update profiles SELECT policy to respect public visibility
DROP POLICY IF EXISTS select_profiles ON public.profiles;

CREATE POLICY select_profiles ON public.profiles
  FOR SELECT USING (
    is_public = true
    OR (auth.uid() IS NOT NULL AND auth.uid() = id)
    OR is_admin()
  );

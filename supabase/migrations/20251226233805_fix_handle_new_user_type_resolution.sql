-- Fix handle_new_user() to use fully-qualified type reference
-- The function has search_path='' for security, so 'user_role' type
-- in public schema cannot be resolved without explicit schema prefix.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, is_fan, created_at)
  VALUES (NEW.id, NEW.email, 'member'::public.user_role, true, NOW());
  RETURN NEW;
END;
$$;

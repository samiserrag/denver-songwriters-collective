-- ============================================================================
-- Phase 1: handle_new_user() defaults cleanup
--
-- BEFORE: INSERT forces is_fan = true
-- AFTER:  INSERT does not set is_fan, so column default (false) applies
--         Role stays explicitly 'member'::public.user_role (existing behavior)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at)
  VALUES (NEW.id, NEW.email, 'member'::public.user_role, NOW());
  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';

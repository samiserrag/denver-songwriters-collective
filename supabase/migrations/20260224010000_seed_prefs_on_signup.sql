-- Ensure every new user gets a notification_preferences row on signup.
-- Previously, rows were only created on first visit to Email Preferences UI,
-- leaving users without explicit DB-level defaults.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at)
  VALUES (NEW.id, NEW.email, 'member'::public.user_role, NOW());

  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';

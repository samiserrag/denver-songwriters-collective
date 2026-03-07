-- Harden auth.users -> profiles seeding for OAuth/new-user flows.
-- Fixes failure mode: "Database error saving new user" when a stale/orphan
-- profiles row still holds the same email address.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  existing_profile_id uuid;
  existing_profile_has_auth boolean;
  seed_role public.user_role := 'member'::public.user_role;
BEGIN
  -- Keep super-admin bootstrap deterministic on identity recreation.
  IF lower(coalesce(NEW.email, '')) = 'sami.serrag@gmail.com' THEN
    seed_role := 'admin'::public.user_role;
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, created_at)
    VALUES (
      NEW.id,
      NEW.email,
      nullif(NEW.raw_user_meta_data->>'full_name', ''),
      nullif(NEW.raw_user_meta_data->>'avatar_url', ''),
      seed_role,
      now()
    );
  EXCEPTION WHEN unique_violation THEN
    -- Most likely the unique email index on profiles. If the conflicting profile
    -- no longer has a matching auth.users row, archive its email and continue.
    IF NEW.email IS NULL THEN
      RAISE;
    END IF;

    SELECT p.id
    INTO existing_profile_id
    FROM public.profiles p
    WHERE lower(p.email) = lower(NEW.email)
    LIMIT 1;

    IF existing_profile_id IS NULL THEN
      RAISE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = existing_profile_id
    )
    INTO existing_profile_has_auth;

    IF existing_profile_has_auth THEN
      -- Active profile/email collision must still fail loudly.
      RAISE;
    END IF;

    -- Orphan profile: preserve row/history but free unique email slot.
    UPDATE public.profiles
    SET email = NULL,
        updated_at = now()
    WHERE id = existing_profile_id;

    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, created_at)
    VALUES (
      NEW.id,
      NEW.email,
      nullif(NEW.raw_user_meta_data->>'full_name', ''),
      nullif(NEW.raw_user_meta_data->>'avatar_url', ''),
      seed_role,
      now()
    );
  END;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';

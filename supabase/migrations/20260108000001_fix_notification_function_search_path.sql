-- Fix: create_user_notification function search_path
--
-- The function had SET search_path TO '' which caused it to fail
-- with "type notifications does not exist" because it couldn't find
-- the public.notifications table type.
--
-- Fix: Set search_path to 'public' and fully qualify all references.

CREATE OR REPLACE FUNCTION public.create_user_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text DEFAULT NULL,
  p_link text DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result public.notifications;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (p_user_id, p_type, p_title, p_message, p_link)
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- Add master email_enabled toggle to notification_preferences
-- When false, all emails are suppressed regardless of category settings.
-- Dashboard notifications are unaffected (they are canonical).

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN notification_preferences.email_enabled
  IS 'Master kill-switch: when false, no emails are sent regardless of category toggles';

-- Drop the old 3-param overload so the GRANT below is unambiguous
DROP FUNCTION IF EXISTS upsert_notification_preferences(uuid, boolean, boolean, boolean);

-- Rebuild the upsert RPC to accept the new column
CREATE OR REPLACE FUNCTION upsert_notification_preferences(
  p_user_id uuid,
  p_email_claim_updates boolean DEFAULT NULL,
  p_email_event_updates boolean DEFAULT NULL,
  p_email_admin_notifications boolean DEFAULT NULL,
  p_email_enabled boolean DEFAULT NULL
)
RETURNS notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result notification_preferences;
BEGIN
  INSERT INTO notification_preferences (
    user_id,
    email_claim_updates,
    email_event_updates,
    email_admin_notifications,
    email_enabled,
    updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(p_email_claim_updates, true),
    COALESCE(p_email_event_updates, true),
    COALESCE(p_email_admin_notifications, true),
    COALESCE(p_email_enabled, true),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email_claim_updates = COALESCE(p_email_claim_updates, notification_preferences.email_claim_updates),
    email_event_updates = COALESCE(p_email_event_updates, notification_preferences.email_event_updates),
    email_admin_notifications = COALESCE(p_email_admin_notifications, notification_preferences.email_admin_notifications),
    email_enabled = COALESCE(p_email_enabled, notification_preferences.email_enabled),
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_notification_preferences(uuid, boolean, boolean, boolean, boolean) TO authenticated;

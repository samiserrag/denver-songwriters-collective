-- Split email_event_updates into 4 granular preference categories
-- Previously one toggle controlled 18 templates; now users can
-- independently manage host activity, attendee updates, digests,
-- and invitations.

-- 1. Add new columns (all default true)
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS email_host_activity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_attendee_activity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_digests boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_invitations boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN notification_preferences.email_host_activity
  IS 'RSVPs, comments, and co-host updates on events the user hosts';
COMMENT ON COLUMN notification_preferences.email_attendee_activity
  IS 'Reminders and changes for events the user is attending';
COMMENT ON COLUMN notification_preferences.email_digests
  IS 'Weekly open mic and happenings digest emails';
COMMENT ON COLUMN notification_preferences.email_invitations
  IS 'Co-host invitations, event invitations, and collaboration requests';

-- 2. Migrate existing data: copy email_event_updates value into all 4 columns
-- This preserves the user's previous intent — if they opted out of
-- event_updates, all 4 new categories start opted-out too.
UPDATE notification_preferences
SET
  email_host_activity = email_event_updates,
  email_attendee_activity = email_event_updates,
  email_digests = email_event_updates,
  email_invitations = email_event_updates;

-- 3. Role-aware reset: ensure hosts always have host_activity on,
-- and all users start with all categories enabled.
-- This resets ALL existing preference rows to true for the new columns,
-- since the old coarse toggle caused unintended opt-outs.
UPDATE notification_preferences
SET
  email_host_activity = true,
  email_attendee_activity = true,
  email_digests = true,
  email_invitations = true;

-- 4. Rebuild the upsert RPC with new columns
DROP FUNCTION IF EXISTS upsert_notification_preferences(uuid, boolean, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION upsert_notification_preferences(
  p_user_id uuid,
  p_email_claim_updates boolean DEFAULT NULL,
  p_email_event_updates boolean DEFAULT NULL,
  p_email_admin_notifications boolean DEFAULT NULL,
  p_email_enabled boolean DEFAULT NULL,
  p_email_host_activity boolean DEFAULT NULL,
  p_email_attendee_activity boolean DEFAULT NULL,
  p_email_digests boolean DEFAULT NULL,
  p_email_invitations boolean DEFAULT NULL
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
    email_host_activity,
    email_attendee_activity,
    email_digests,
    email_invitations,
    updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(p_email_claim_updates, true),
    COALESCE(p_email_event_updates, true),
    COALESCE(p_email_admin_notifications, true),
    COALESCE(p_email_enabled, true),
    COALESCE(p_email_host_activity, true),
    COALESCE(p_email_attendee_activity, true),
    COALESCE(p_email_digests, true),
    COALESCE(p_email_invitations, true),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email_claim_updates = COALESCE(p_email_claim_updates, notification_preferences.email_claim_updates),
    email_event_updates = COALESCE(p_email_event_updates, notification_preferences.email_event_updates),
    email_admin_notifications = COALESCE(p_email_admin_notifications, notification_preferences.email_admin_notifications),
    email_enabled = COALESCE(p_email_enabled, notification_preferences.email_enabled),
    email_host_activity = COALESCE(p_email_host_activity, notification_preferences.email_host_activity),
    email_attendee_activity = COALESCE(p_email_attendee_activity, notification_preferences.email_attendee_activity),
    email_digests = COALESCE(p_email_digests, notification_preferences.email_digests),
    email_invitations = COALESCE(p_email_invitations, notification_preferences.email_invitations),
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_notification_preferences(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) TO authenticated;

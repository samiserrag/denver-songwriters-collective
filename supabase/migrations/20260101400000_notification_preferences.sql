-- Phase 4.25: Notification Preferences
-- User-level email preferences that gate email sending only
-- Dashboard notifications always appear (canonical)

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_claim_updates boolean NOT NULL DEFAULT true,
  email_event_updates boolean NOT NULL DEFAULT true,
  email_admin_notifications boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE notification_preferences IS 'User email preferences. Turning off emails does not hide dashboard notifications.';
COMMENT ON COLUMN notification_preferences.email_claim_updates IS 'Email me about event claim updates (submitted, approved, rejected)';
COMMENT ON COLUMN notification_preferences.email_event_updates IS 'Email me about changes to events I host or RSVP to';
COMMENT ON COLUMN notification_preferences.email_admin_notifications IS 'Email me admin alerts (admins only)';

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can read their own preferences
CREATE POLICY "Users can read own notification preferences"
  ON notification_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own preferences (for initial setup)
CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can read any user's preferences
CREATE POLICY "Admins can read all notification preferences"
  ON notification_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update any user's preferences
CREATE POLICY "Admins can update all notification preferences"
  ON notification_preferences
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
  ON notification_preferences(user_id);

-- Function to upsert preferences (handles both insert and update)
CREATE OR REPLACE FUNCTION upsert_notification_preferences(
  p_user_id uuid,
  p_email_claim_updates boolean DEFAULT NULL,
  p_email_event_updates boolean DEFAULT NULL,
  p_email_admin_notifications boolean DEFAULT NULL
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
    updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(p_email_claim_updates, true),
    COALESCE(p_email_event_updates, true),
    COALESCE(p_email_admin_notifications, true),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email_claim_updates = COALESCE(p_email_claim_updates, notification_preferences.email_claim_updates),
    email_event_updates = COALESCE(p_email_event_updates, notification_preferences.email_event_updates),
    email_admin_notifications = COALESCE(p_email_admin_notifications, notification_preferences.email_admin_notifications),
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION upsert_notification_preferences TO authenticated;

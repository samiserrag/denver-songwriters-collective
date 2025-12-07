-- ==========================================================
-- ADMIN NOTIFICATIONS SYSTEM
-- Migration: 20251207_admin_notifications.sql
-- ==========================================================
-- Creates a notifications table for admin alerts when users:
-- - Sign up for events
-- - Submit corrections
-- - Create galleries
-- - Create blog posts
-- - Sign up (new user registration)
-- ==========================================================

-- ==========================================================
-- 1. NOTIFICATION TYPE ENUM
-- ==========================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM (
            'new_user',
            'event_signup',
            'correction_submitted',
            'gallery_created',
            'blog_post_created',
            'volunteer_signup',
            'host_claim'
        );
    END IF;
END
$$;

-- ==========================================================
-- 2. ADMIN NOTIFICATIONS TABLE
-- ==========================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          notification_type NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}',
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_notifications_type_idx ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS admin_notifications_created_idx ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_unread_idx ON admin_notifications(is_read) WHERE is_read = FALSE;

-- ==========================================================
-- 3. RLS POLICIES
-- ==========================================================

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can read notifications
CREATE POLICY "Admins can read notifications"
ON admin_notifications FOR SELECT
TO authenticated
USING (is_admin());

-- Only admins can update notifications (mark as read)
CREATE POLICY "Admins can update notifications"
ON admin_notifications FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- System (authenticated users) can insert notifications
-- This allows the app to create notifications when events happen
CREATE POLICY "Authenticated users can create notifications"
ON admin_notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only admins can delete notifications
CREATE POLICY "Admins can delete notifications"
ON admin_notifications FOR DELETE
TO authenticated
USING (is_admin());

-- ==========================================================
-- 4. HELPER FUNCTION TO CREATE NOTIFICATIONS
-- ==========================================================

CREATE OR REPLACE FUNCTION create_admin_notification(
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS admin_notifications
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result admin_notifications;
BEGIN
  INSERT INTO admin_notifications (type, title, message, user_id, metadata)
  VALUES (p_type, p_title, p_message, p_user_id, p_metadata)
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- ==========================================================
-- 5. TRIGGER: NEW USER REGISTRATION NOTIFICATION
-- ==========================================================

CREATE OR REPLACE FUNCTION notify_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_admin_notification(
    'new_user'::notification_type,
    'New User Registration',
    COALESCE(NEW.full_name, 'A new user') || ' has joined the community.',
    NEW.id,
    jsonb_build_object(
      'role', NEW.role,
      'email', (SELECT email FROM auth.users WHERE id = NEW.id)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only trigger on new profiles (not updates)
DROP TRIGGER IF EXISTS trg_notify_new_user ON profiles;
CREATE TRIGGER trg_notify_new_user
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION notify_new_user();

-- ==========================================================
-- END OF ADMIN NOTIFICATIONS MIGRATION
-- ==========================================================

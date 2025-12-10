-- =====================================================
-- PHASE 3: COMMENTS + NOTIFICATIONS
-- =====================================================

-- =====================================================
-- CLEANUP: Drop existing policies to make idempotent
-- =====================================================

-- event_comments policies
DROP POLICY IF EXISTS "Anyone can view public comments" ON public.event_comments;
DROP POLICY IF EXISTS "Hosts can view host-only comments" ON public.event_comments;
DROP POLICY IF EXISTS "Users can view own comments" ON public.event_comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.event_comments;
DROP POLICY IF EXISTS "Users can edit own comments" ON public.event_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.event_comments;
DROP POLICY IF EXISTS "Admins can manage all comments" ON public.event_comments;

-- notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications for users" ON public.notifications;

-- =====================================================
-- TABLES
-- =====================================================

-- Event comments
CREATE TABLE IF NOT EXISTS public.event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.event_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_host_only boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  hidden_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_comments_event ON public.event_comments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_user ON public.event_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_parent ON public.event_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- RLS
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Comment policies
CREATE POLICY "Anyone can view public comments"
  ON public.event_comments FOR SELECT
  USING (is_hidden = false AND is_host_only = false);

-- Hosts can view host-only comments on events they host
CREATE POLICY "Hosts can view host-only comments"
  ON public.event_comments FOR SELECT
  USING (
    is_hidden = false
    AND is_host_only = true
    AND EXISTS (
      SELECT 1 FROM public.event_hosts eh
      WHERE eh.event_id = event_comments.event_id
      AND eh.user_id = auth.uid()
      AND eh.invitation_status = 'accepted'
    )
  );

-- Users can always view their own comments (even hidden ones)
CREATE POLICY "Users can view own comments"
  ON public.event_comments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create comments"
  ON public.event_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can edit own comments"
  ON public.event_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.event_comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all comments"
  ON public.event_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );

-- Notification policies
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Allow admins to create notifications directly (rare, most go through function)
CREATE POLICY "Admins can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );

-- NOTE: System notifications are created via create_user_notification() SECURITY DEFINER function
-- which bypasses RLS. No permissive INSERT policy needed.

-- =====================================================
-- HELPER FUNCTION: Create notification (bypasses RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_user_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text DEFAULT NULL,
  p_link text DEFAULT NULL
) RETURNS public.notifications
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result notifications;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (p_user_id, p_type, p_title, p_message, p_link)
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_notification TO authenticated;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

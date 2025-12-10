-- =====================================================
-- PHASE 1: MINIMAL SCHEMA FOR DSC EVENTS + RSVP
-- =====================================================

-- Add columns to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_dsc_event boolean DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity integer DEFAULT NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS host_notes text DEFAULT NULL;

-- Create event_rsvps table
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
  waitlist_position integer,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON public.event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_status ON public.event_rsvps(event_id, status);
CREATE INDEX IF NOT EXISTS idx_events_dsc ON public.events(is_dsc_event) WHERE is_dsc_event = true;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Now drop existing policies (table exists now)
DROP POLICY IF EXISTS "Anyone can view non-cancelled RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can create own RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can update own RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can delete own RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Admins can manage all RSVPs" ON public.event_rsvps;

CREATE POLICY "Anyone can view non-cancelled RSVPs"
  ON public.event_rsvps FOR SELECT
  USING (status IN ('confirmed', 'waitlist'));

CREATE POLICY "Users can create own RSVPs"
  ON public.event_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RSVPs"
  ON public.event_rsvps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own RSVPs"
  ON public.event_rsvps FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all RSVPs"
  ON public.event_rsvps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;

-- =====================================================
-- PHASE 2: HOST PERMISSION SYSTEM
-- =====================================================

-- Create tables first
CREATE TABLE IF NOT EXISTS public.approved_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.host_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_host_requests_pending
ON public.host_requests(user_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.event_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'host' CHECK (role IN ('host', 'cohost')),
  invitation_status text NOT NULL DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'declined')),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_approved_hosts_user ON public.approved_hosts(user_id);
CREATE INDEX IF NOT EXISTS idx_approved_hosts_status ON public.approved_hosts(status);
CREATE INDEX IF NOT EXISTS idx_host_requests_status ON public.host_requests(status);
CREATE INDEX IF NOT EXISTS idx_event_hosts_event ON public.event_hosts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_hosts_user ON public.event_hosts(user_id);

ALTER TABLE public.approved_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_hosts ENABLE ROW LEVEL SECURITY;

-- Now drop existing policies (tables exist now)
DROP POLICY IF EXISTS "Users can view own host status" ON public.approved_hosts;
DROP POLICY IF EXISTS "Admins can manage approved hosts" ON public.approved_hosts;
DROP POLICY IF EXISTS "Users can create own host requests" ON public.host_requests;
DROP POLICY IF EXISTS "Users can view own host requests" ON public.host_requests;
DROP POLICY IF EXISTS "Admins can manage all host requests" ON public.host_requests;
DROP POLICY IF EXISTS "Public can view accepted event hosts" ON public.event_hosts;
DROP POLICY IF EXISTS "Users can view own host invitations" ON public.event_hosts;
DROP POLICY IF EXISTS "Users can respond to own invitations" ON public.event_hosts;
DROP POLICY IF EXISTS "Admins can manage all event hosts" ON public.event_hosts;

CREATE POLICY "Users can view own host status"
  ON public.approved_hosts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage approved hosts"
  ON public.approved_hosts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Users can create own host requests"
  ON public.host_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own host requests"
  ON public.host_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all host requests"
  ON public.host_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Public can view accepted event hosts"
  ON public.event_hosts FOR SELECT
  USING (invitation_status = 'accepted');

CREATE POLICY "Users can view own host invitations"
  ON public.event_hosts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can respond to own invitations"
  ON public.event_hosts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all event hosts"
  ON public.event_hosts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.approved_hosts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.host_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_hosts TO authenticated;

-- =====================================================
-- PHASE 3: COMMENTS + NOTIFICATIONS
-- =====================================================

-- Create tables first
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

CREATE INDEX IF NOT EXISTS idx_event_comments_event ON public.event_comments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_user ON public.event_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_parent ON public.event_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Now drop existing policies (tables exist now)
DROP POLICY IF EXISTS "Anyone can view public comments" ON public.event_comments;
DROP POLICY IF EXISTS "Hosts can view host-only comments" ON public.event_comments;
DROP POLICY IF EXISTS "Users can view own comments" ON public.event_comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.event_comments;
DROP POLICY IF EXISTS "Users can edit own comments" ON public.event_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.event_comments;
DROP POLICY IF EXISTS "Admins can manage all comments" ON public.event_comments;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications for users" ON public.notifications;

CREATE POLICY "Anyone can view public comments"
  ON public.event_comments FOR SELECT
  USING (is_hidden = false AND is_host_only = false);

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

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );

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

GRANT EXECUTE ON FUNCTION public.create_user_notification TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

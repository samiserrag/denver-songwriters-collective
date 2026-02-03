-- =====================================================
-- PHASE 2: HOST PERMISSION SYSTEM
-- =====================================================

-- =====================================================
-- CLEANUP: Drop existing policies to make idempotent
-- (Only if tables exist - fresh installs won't have them)
-- =====================================================
DO $$
BEGIN
  -- approved_hosts policies
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'approved_hosts' AND relnamespace = 'public'::regnamespace) THEN
    DROP POLICY IF EXISTS "Users can view own host status" ON public.approved_hosts;
    DROP POLICY IF EXISTS "Admins can manage approved hosts" ON public.approved_hosts;
  END IF;

  -- host_requests policies
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'host_requests' AND relnamespace = 'public'::regnamespace) THEN
    DROP POLICY IF EXISTS "Users can create own host requests" ON public.host_requests;
    DROP POLICY IF EXISTS "Users can view own host requests" ON public.host_requests;
    DROP POLICY IF EXISTS "Admins can manage all host requests" ON public.host_requests;
  END IF;

  -- event_hosts policies
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'event_hosts' AND relnamespace = 'public'::regnamespace) THEN
    DROP POLICY IF EXISTS "Public can view accepted event hosts" ON public.event_hosts;
    DROP POLICY IF EXISTS "Users can view own host invitations" ON public.event_hosts;
    DROP POLICY IF EXISTS "Users can respond to own invitations" ON public.event_hosts;
    DROP POLICY IF EXISTS "Admins can manage all event hosts" ON public.event_hosts;
  END IF;
END
$$;

-- =====================================================
-- TABLES
-- =====================================================

-- 1. Approved hosts table (users who can create events)
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

-- 2. Host requests (users requesting to become approved hosts)
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

-- Partial unique index: only one pending request per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_host_requests_pending
ON public.host_requests(user_id) WHERE status = 'pending';

-- 3. Event hosts (links hosts/co-hosts to specific events)
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_approved_hosts_user ON public.approved_hosts(user_id);
CREATE INDEX IF NOT EXISTS idx_approved_hosts_status ON public.approved_hosts(status);
CREATE INDEX IF NOT EXISTS idx_host_requests_status ON public.host_requests(status);
CREATE INDEX IF NOT EXISTS idx_event_hosts_event ON public.event_hosts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_hosts_user ON public.event_hosts(user_id);

-- RLS
ALTER TABLE public.approved_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_hosts ENABLE ROW LEVEL SECURITY;

-- approved_hosts policies
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

-- host_requests policies
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

-- event_hosts policies
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

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.approved_hosts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.host_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_hosts TO authenticated;

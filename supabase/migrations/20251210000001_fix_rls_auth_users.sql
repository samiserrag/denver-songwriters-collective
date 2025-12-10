-- =====================================================
-- FIX RLS POLICIES THAT REFERENCE auth.users
-- =====================================================
-- The auth.users table cannot be directly queried in RLS policies.
-- We need to use auth.jwt() instead to check admin role.
-- =====================================================

-- =====================================================
-- HELPER FUNCTION: Check if current user is admin
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- =====================================================
-- FIX event_rsvps POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage all RSVPs" ON public.event_rsvps;

CREATE POLICY "Admins can manage all RSVPs"
  ON public.event_rsvps FOR ALL
  USING (public.is_admin());

-- =====================================================
-- FIX approved_hosts POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage approved hosts" ON public.approved_hosts;

CREATE POLICY "Admins can manage approved hosts"
  ON public.approved_hosts FOR ALL
  USING (public.is_admin());

-- =====================================================
-- FIX host_requests POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage all host requests" ON public.host_requests;

CREATE POLICY "Admins can manage all host requests"
  ON public.host_requests FOR ALL
  USING (public.is_admin());

-- =====================================================
-- FIX event_hosts POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage all event hosts" ON public.event_hosts;

CREATE POLICY "Admins can manage all event hosts"
  ON public.event_hosts FOR ALL
  USING (public.is_admin());

-- =====================================================
-- ADD MISSING INSERT POLICY FOR event_hosts
-- =====================================================
-- Approved hosts need to be able to INSERT into event_hosts
-- when they create events or invite co-hosts

DROP POLICY IF EXISTS "Approved hosts can create event host entries" ON public.event_hosts;

CREATE POLICY "Approved hosts can create event host entries"
  ON public.event_hosts FOR INSERT
  WITH CHECK (
    -- User is inserting themselves as host
    (user_id = auth.uid() AND role = 'host')
    OR
    -- User is an approved host inviting someone else as cohost
    (
      invited_by = auth.uid()
      AND role = 'cohost'
      AND EXISTS (
        SELECT 1 FROM public.approved_hosts
        WHERE user_id = auth.uid()
        AND status = 'active'
      )
    )
    OR
    -- User is admin
    public.is_admin()
  );

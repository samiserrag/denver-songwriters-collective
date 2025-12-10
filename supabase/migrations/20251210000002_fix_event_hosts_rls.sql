-- =====================================================
-- FIX event_hosts RLS POLICIES
-- =====================================================
-- Issues:
-- 1. SELECT only shows accepted hosts or own invitations
-- 2. Primary hosts need to see all hosts for their events
-- 3. New hosts should have invitation_status = 'accepted' when creating event
-- =====================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Public can view accepted event hosts" ON public.event_hosts;
DROP POLICY IF EXISTS "Users can view own host invitations" ON public.event_hosts;

-- New SELECT policy: Anyone can view hosts for any event
-- (This is needed for the event page to show who's hosting)
CREATE POLICY "Anyone can view event hosts"
  ON public.event_hosts FOR SELECT
  USING (true);

-- Update the INSERT policy to set accepted status for primary host
DROP POLICY IF EXISTS "Approved hosts can create event host entries" ON public.event_hosts;

CREATE POLICY "Approved hosts can create event host entries"
  ON public.event_hosts FOR INSERT
  WITH CHECK (
    -- User is inserting themselves as host (auto-accepted)
    (user_id = auth.uid() AND role = 'host' AND invitation_status = 'accepted')
    OR
    -- User is an approved host inviting someone else as cohost (pending)
    (
      invited_by = auth.uid()
      AND role = 'cohost'
      AND invitation_status = 'pending'
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

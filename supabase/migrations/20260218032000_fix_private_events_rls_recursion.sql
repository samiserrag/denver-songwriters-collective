-- Hotfix: remove recursive SELECT path in events policy.
--
-- Incident: 2026-02-18 authenticated event queries failed with:
-- "infinite recursion detected in policy for relation events"
--
-- Cause:
-- events.public_read_events referenced event_attendee_invites,
-- and event_attendee_invites SELECT policies referenced events.
--
-- Fix:
-- Keep visibility gating for public/host/co-host/admin in events policy.
-- Defer attendee-invite visibility check to a non-recursive implementation tract.

DROP POLICY IF EXISTS public_read_events ON public.events;

CREATE POLICY public_read_events ON public.events
  FOR SELECT TO anon, authenticated
  USING (
    visibility = 'public'
    OR host_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.event_hosts
      WHERE event_hosts.event_id = events.id
      AND event_hosts.user_id = auth.uid()
      AND event_hosts.invitation_status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- Phase 4.48b: Guest RSVP RLS Policies
-- Updates RLS to support guest RSVPs (via service role)
-- =====================================================

-- STEP 1: Update SELECT policy to include 'offered' status
-- (guests on waitlist may get 'offered' status when spot opens)
DROP POLICY IF EXISTS "Anyone can view non-cancelled RSVPs" ON public.event_rsvps;

CREATE POLICY "Anyone can view non-cancelled RSVPs"
  ON public.event_rsvps FOR SELECT
  USING (status IN ('confirmed', 'waitlist', 'offered'));

-- STEP 2: Grant anon role SELECT access for public attendee lists
-- Guest RSVPs are inserted via service role, but need to be visible
GRANT SELECT ON public.event_rsvps TO anon;

-- NOTE: Guest INSERT/UPDATE operations use service role client
-- which bypasses RLS entirely. No additional INSERT policies needed.

-- STEP 3: Ensure guest_verifications has proper permissions
-- (already has public read, service role handles writes)
GRANT SELECT ON public.guest_verifications TO anon;
GRANT SELECT ON public.guest_verifications TO authenticated;

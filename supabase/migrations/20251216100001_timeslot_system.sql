-- =====================================================
-- PHASE 4: TIMESLOT SYSTEM
-- Enables per-slot claiming, waitlists, guest slots, and no-show tracking
--
-- Tables created:
--   - event_timeslots: Individual performance slots
--   - timeslot_claims: Claims on slots (members or guests)
--   - event_lineup_state: Tracks "now playing" for signage
--
-- Columns added to events:
--   - has_timeslots, slot_duration_minutes, total_slots
--   - allow_guest_slots, slot_offer_window_minutes, is_published
--
-- Columns added to profiles:
--   - no_show_count
-- =====================================================

-- =====================================================
-- DEPRECATE LEGACY TABLE
-- =====================================================

COMMENT ON TABLE public.event_slots IS 'DEPRECATED: Legacy table, not used. See event_timeslots + timeslot_claims for the new timeslot system.';

-- =====================================================
-- STEP 1: Add slot configuration columns to events
-- =====================================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS has_timeslots boolean DEFAULT false;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS slot_duration_minutes integer DEFAULT 15
  CHECK (slot_duration_minutes IS NULL OR (slot_duration_minutes >= 5 AND slot_duration_minutes <= 90));

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS total_slots integer
  CHECK (total_slots IS NULL OR total_slots > 0);

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS allow_guest_slots boolean DEFAULT false;

-- 2 hours for timeslots (not 24h like regular RSVPs)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS slot_offer_window_minutes integer DEFAULT 120;

-- Draft/publish flow: existing events default to published
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;

COMMENT ON COLUMN public.events.has_timeslots IS 'When true, event uses timeslot system instead of simple RSVP';
COMMENT ON COLUMN public.events.slot_duration_minutes IS 'Duration of each slot in minutes (5-90, default 15)';
COMMENT ON COLUMN public.events.total_slots IS 'Number of performance slots for this event';
COMMENT ON COLUMN public.events.allow_guest_slots IS 'When true, members can claim a slot for a named guest';
COMMENT ON COLUMN public.events.slot_offer_window_minutes IS 'Minutes until waitlist offer expires (default 120 = 2 hours)';
COMMENT ON COLUMN public.events.is_published IS 'When false, event is draft (not visible publicly, no signups)';

-- =====================================================
-- STEP 2: Create event_timeslots table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.event_timeslots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  slot_index integer NOT NULL,
  start_offset_minutes integer, -- NULL if event has no start_time
  duration_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, slot_index)
);

COMMENT ON TABLE public.event_timeslots IS 'Individual performance slots for timeslot-enabled events';
COMMENT ON COLUMN public.event_timeslots.slot_index IS '0-based index of the slot';
COMMENT ON COLUMN public.event_timeslots.start_offset_minutes IS 'Minutes from event start_time when this slot begins (NULL if no start_time)';

-- =====================================================
-- STEP 3: Create timeslot_claims table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.timeslot_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeslot_id uuid NOT NULL REFERENCES public.event_timeslots(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name text,
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'offered', 'waitlist', 'cancelled', 'no_show', 'performed')),
  offer_expires_at timestamptz,
  waitlist_position integer,
  claimed_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  CONSTRAINT member_or_guest CHECK (member_id IS NOT NULL OR guest_name IS NOT NULL)
);

COMMENT ON TABLE public.timeslot_claims IS 'Claims on individual timeslots (member or guest)';
COMMENT ON COLUMN public.timeslot_claims.guest_name IS 'Name of guest if slot claimed for someone else (publicly visible)';
COMMENT ON COLUMN public.timeslot_claims.status IS 'confirmed=active, offered=waiting for user to accept, waitlist=in queue, cancelled/no_show/performed=final states';
COMMENT ON COLUMN public.timeslot_claims.offer_expires_at IS 'When waitlist offer expires (2 hours for timeslots)';
COMMENT ON COLUMN public.timeslot_claims.waitlist_position IS 'Position in per-slot waitlist (NULL if not waitlisted)';
COMMENT ON COLUMN public.timeslot_claims.updated_by IS 'Who last modified this claim (for audit trail)';

-- =====================================================
-- STEP 4: Create event_lineup_state table
-- For tracking "now playing" in signage mode
-- =====================================================

CREATE TABLE IF NOT EXISTS public.event_lineup_state (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  now_playing_timeslot_id uuid REFERENCES public.event_timeslots(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.event_lineup_state IS 'Tracks current "now playing" slot for live events';

-- =====================================================
-- STEP 5: Add no_show_count to profiles for tracking
-- =====================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS no_show_count integer DEFAULT 0;

COMMENT ON COLUMN public.profiles.no_show_count IS 'Number of times member has been marked as no-show (visible to host/admin only)';

-- =====================================================
-- STEP 6: Create indexes
-- =====================================================

-- event_timeslots indexes
CREATE INDEX IF NOT EXISTS idx_event_timeslots_event
  ON public.event_timeslots(event_id);

-- timeslot_claims indexes
-- Partial unique index: only one active (non-cancelled) claim per slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_timeslot_claims_active_slot
  ON public.timeslot_claims(timeslot_id)
  WHERE status NOT IN ('cancelled', 'no_show');

-- Index for looking up a member's claims
CREATE INDEX IF NOT EXISTS idx_timeslot_claims_member
  ON public.timeslot_claims(member_id)
  WHERE member_id IS NOT NULL;

-- Index for waitlist ordering per slot
CREATE INDEX IF NOT EXISTS idx_timeslot_claims_waitlist
  ON public.timeslot_claims(timeslot_id, waitlist_position)
  WHERE status = 'waitlist';

-- Index for offer expiration checks
CREATE INDEX IF NOT EXISTS idx_timeslot_claims_offered
  ON public.timeslot_claims(offer_expires_at)
  WHERE status = 'offered';

-- events index for draft/published filtering
CREATE INDEX IF NOT EXISTS idx_events_is_published
  ON public.events(is_published)
  WHERE is_published = true;

-- events index for timeslot-enabled events
CREATE INDEX IF NOT EXISTS idx_events_has_timeslots
  ON public.events(has_timeslots)
  WHERE has_timeslots = true;

-- =====================================================
-- STEP 7: Enable RLS
-- =====================================================

ALTER TABLE public.event_timeslots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeslot_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_lineup_state ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 8: RLS Policies for event_timeslots
-- =====================================================

-- Anyone can view timeslots for published events
CREATE POLICY "Public can view timeslots of published events"
  ON public.event_timeslots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_timeslots.event_id
      AND e.is_published = true
    )
  );

-- Hosts can view/manage timeslots for their own events
CREATE POLICY "Hosts can manage their event timeslots"
  ON public.event_timeslots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_timeslots.event_id
      AND e.host_id = auth.uid()
    )
  );

-- Admins can manage all timeslots
CREATE POLICY "Admins can manage all timeslots"
  ON public.event_timeslots FOR ALL
  USING (is_admin());

-- =====================================================
-- STEP 9: RLS Policies for timeslot_claims
-- =====================================================

-- Anyone can view claims on published events (names visible, no emails)
CREATE POLICY "Public can view claims of published events"
  ON public.timeslot_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_timeslots t
      JOIN public.events e ON e.id = t.event_id
      WHERE t.id = timeslot_claims.timeslot_id
      AND e.is_published = true
    )
  );

-- Authenticated users can create their own claims
CREATE POLICY "Authenticated users can create own claims"
  ON public.timeslot_claims FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND member_id = auth.uid()
  );

-- Users can update their own claims (e.g., cancel, confirm offer)
CREATE POLICY "Users can update own claims"
  ON public.timeslot_claims FOR UPDATE
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- Users can delete their own claims
CREATE POLICY "Users can delete own claims"
  ON public.timeslot_claims FOR DELETE
  USING (member_id = auth.uid());

-- Hosts can manage claims for their events
CREATE POLICY "Hosts can manage claims on their events"
  ON public.timeslot_claims FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_timeslots t
      JOIN public.events e ON e.id = t.event_id
      WHERE t.id = timeslot_claims.timeslot_id
      AND e.host_id = auth.uid()
    )
  );

-- Admins can manage all claims
CREATE POLICY "Admins can manage all claims"
  ON public.timeslot_claims FOR ALL
  USING (is_admin());

-- =====================================================
-- STEP 10: RLS Policies for event_lineup_state
-- =====================================================

-- Anyone can view lineup state for published events
CREATE POLICY "Public can view lineup state"
  ON public.event_lineup_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_lineup_state.event_id
      AND e.is_published = true
    )
  );

-- Hosts can manage lineup state for their events
CREATE POLICY "Hosts can manage lineup state"
  ON public.event_lineup_state FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_lineup_state.event_id
      AND e.host_id = auth.uid()
    )
  );

-- Admins can manage all lineup states
CREATE POLICY "Admins can manage lineup state"
  ON public.event_lineup_state FOR ALL
  USING (is_admin());

-- =====================================================
-- STEP 11: Grant permissions
-- =====================================================

-- Anonymous users can read public data
GRANT SELECT ON public.event_timeslots TO anon;
GRANT SELECT ON public.timeslot_claims TO anon;
GRANT SELECT ON public.event_lineup_state TO anon;

-- Authenticated users have full CRUD (controlled by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_timeslots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeslot_claims TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_lineup_state TO authenticated;

-- =====================================================
-- STEP 12: Create function to generate timeslots on publish
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_event_timeslots(
  p_event_id uuid
)
RETURNS SETOF public.event_timeslots
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
  v_slot_index integer;
  v_offset integer;
BEGIN
  -- Get event details
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event.total_slots IS NULL OR v_event.total_slots <= 0 THEN
    RAISE EXCEPTION 'Event must have total_slots configured';
  END IF;

  -- Delete existing timeslots (for regeneration)
  -- This will CASCADE delete claims, so only call before any claims exist
  DELETE FROM public.event_timeslots WHERE event_id = p_event_id;

  -- Generate timeslots
  FOR v_slot_index IN 0..(v_event.total_slots - 1) LOOP
    -- Calculate offset if event has start_time
    IF v_event.start_time IS NOT NULL THEN
      v_offset := v_slot_index * COALESCE(v_event.slot_duration_minutes, 15);
    ELSE
      v_offset := NULL;
    END IF;

    INSERT INTO public.event_timeslots (
      event_id,
      slot_index,
      start_offset_minutes,
      duration_minutes
    ) VALUES (
      p_event_id,
      v_slot_index,
      v_offset,
      COALESCE(v_event.slot_duration_minutes, 15)
    );
  END LOOP;

  RETURN QUERY SELECT * FROM public.event_timeslots WHERE event_id = p_event_id ORDER BY slot_index;
END;
$$;

COMMENT ON FUNCTION public.generate_event_timeslots IS 'Generates timeslot rows for an event based on its total_slots and duration settings. WARNING: Deletes existing timeslots and claims.';

-- =====================================================
-- STEP 13: Create function for atomic waitlist promotion
-- =====================================================

CREATE OR REPLACE FUNCTION public.promote_timeslot_waitlist(
  p_timeslot_id uuid,
  p_offer_window_minutes integer DEFAULT 120
)
RETURNS uuid -- Returns the promoted claim ID, or NULL if no one to promote
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_claim RECORD;
  v_offer_expires timestamptz;
BEGIN
  -- Lock the next waitlisted claim for this slot
  SELECT * INTO v_next_claim
  FROM public.timeslot_claims
  WHERE timeslot_id = p_timeslot_id
    AND status = 'waitlist'
  ORDER BY waitlist_position ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Calculate expiry
  v_offer_expires := now() + (p_offer_window_minutes || ' minutes')::interval;

  -- Promote to offered status
  UPDATE public.timeslot_claims
  SET
    status = 'offered',
    offer_expires_at = v_offer_expires,
    waitlist_position = NULL,
    updated_at = now()
  WHERE id = v_next_claim.id;

  RETURN v_next_claim.id;
END;
$$;

COMMENT ON FUNCTION public.promote_timeslot_waitlist IS 'Atomically promotes next waitlist person to offered status with expiry window (default 2 hours)';

-- =====================================================
-- STEP 14: Create function to mark no-show
-- =====================================================

CREATE OR REPLACE FUNCTION public.mark_timeslot_no_show(
  p_claim_id uuid,
  p_updated_by uuid
)
RETURNS public.timeslot_claims
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim RECORD;
  v_event RECORD;
BEGIN
  -- Get the claim with event info
  SELECT c.*, e.host_id, e.slot_offer_window_minutes
  INTO v_claim
  FROM public.timeslot_claims c
  JOIN public.event_timeslots t ON t.id = c.timeslot_id
  JOIN public.events e ON e.id = t.event_id
  WHERE c.id = p_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  IF v_claim.status NOT IN ('confirmed', 'performed') THEN
    RAISE EXCEPTION 'Can only mark confirmed or performed claims as no-show';
  END IF;

  -- Check permission: must be host or admin
  IF v_claim.host_id != p_updated_by THEN
    -- Check if admin
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_updated_by AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only host or admin can mark no-show';
    END IF;
  END IF;

  -- Update claim to no_show
  UPDATE public.timeslot_claims
  SET
    status = 'no_show',
    updated_at = now(),
    updated_by = p_updated_by
  WHERE id = p_claim_id;

  -- Increment no-show count on profile if member claim
  IF v_claim.member_id IS NOT NULL THEN
    UPDATE public.profiles
    SET no_show_count = COALESCE(no_show_count, 0) + 1
    WHERE id = v_claim.member_id;
  END IF;

  -- Promote next in waitlist for this slot
  PERFORM public.promote_timeslot_waitlist(
    v_claim.timeslot_id,
    COALESCE(v_claim.slot_offer_window_minutes, 120)
  );

  RETURN (SELECT tc FROM public.timeslot_claims tc WHERE tc.id = p_claim_id);
END;
$$;

COMMENT ON FUNCTION public.mark_timeslot_no_show IS 'Marks a claim as no-show, increments member no_show_count, and promotes next waitlist person';

-- =====================================================
-- STEP 15: Create function to mark performed
-- =====================================================

CREATE OR REPLACE FUNCTION public.mark_timeslot_performed(
  p_claim_id uuid,
  p_updated_by uuid
)
RETURNS public.timeslot_claims
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim RECORD;
BEGIN
  -- Get the claim with event info
  SELECT c.*, e.host_id
  INTO v_claim
  FROM public.timeslot_claims c
  JOIN public.event_timeslots t ON t.id = c.timeslot_id
  JOIN public.events e ON e.id = t.event_id
  WHERE c.id = p_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  IF v_claim.status != 'confirmed' THEN
    RAISE EXCEPTION 'Can only mark confirmed claims as performed';
  END IF;

  -- Check permission: must be host or admin
  IF v_claim.host_id != p_updated_by THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_updated_by AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only host or admin can mark performed';
    END IF;
  END IF;

  -- Update claim
  UPDATE public.timeslot_claims
  SET
    status = 'performed',
    updated_at = now(),
    updated_by = p_updated_by
  WHERE id = p_claim_id;

  RETURN (SELECT tc FROM public.timeslot_claims tc WHERE tc.id = p_claim_id);
END;
$$;

COMMENT ON FUNCTION public.mark_timeslot_performed IS 'Marks a confirmed claim as performed (successful completion)';

-- =====================================================
-- STEP 16: Create trigger to auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_timeslot_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS timeslot_claims_updated_at ON public.timeslot_claims;
CREATE TRIGGER timeslot_claims_updated_at
  BEFORE UPDATE ON public.timeslot_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timeslot_claims_updated_at();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

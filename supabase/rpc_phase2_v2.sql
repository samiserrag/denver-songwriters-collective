-- ==========================================================
-- OPEN MIC DROP — PHASE 2 RPC FUNCTIONS (v2 - PATCHED)
-- Booking logic for open mic slots, studio appointments, and showcase lineups
-- ==========================================================
-- Dependencies:
-- - Phase 1 schema (schema_phase1.sql)
-- - Phase 1 RLS policies (rls_phase1.sql)
-- - is_admin() helper function from RLS file
--
-- PATCH NOTES (v2):
-- - Addressed Critical Race Conditions identified in Security Audit.
-- - Added FOR UPDATE locking to serialize bookings.
-- - Added input validation for array parameters.
-- ==========================================================

-- ==========================================================
-- SECTION A: OPEN MIC SLOT BOOKING
-- ==========================================================

-- Function 1: Claim an available open mic slot
-- PATCHED: Added Event-level locking to prevent slot hoarding
CREATE OR REPLACE FUNCTION rpc_claim_open_mic_slot(slot_id UUID)
RETURNS event_slots
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result event_slots;
BEGIN
  -- CRITICAL FIX: Lock parent event to prevent slot-hoarding race condition
  -- We lock the Event row associated with this slot.
  -- This forces concurrent claims for the SAME event to process sequentially.
  -- If slot_id is invalid, the subquery returns null and no lock is taken (safe).
  PERFORM 1
  FROM events
  WHERE id = (SELECT event_id FROM event_slots WHERE id = slot_id)
  FOR UPDATE;

  -- Atomic UPDATE with business rule enforcement
  UPDATE event_slots
  SET
    performer_id = auth.uid(),
    updated_at = NOW()
  WHERE id = slot_id
    AND performer_id IS NULL  -- Must be unclaimed
    AND NOT EXISTS (
      -- Prevent multiple slots per performer per event
      -- Because of the Lock above, this check is now concurrency-safe
      SELECT 1
      FROM event_slots es2
      WHERE es2.event_id = event_slots.event_id
        AND es2.performer_id = auth.uid()
    )
  RETURNING * INTO result;

  -- Check if update succeeded
  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Slot not available or you already have a slot in this event';
  END IF;

  RETURN result;
END;
$$;

-- Function 2: Unclaim a previously claimed slot
-- UNCHANGED: Row-level atomic update is sufficient here
CREATE OR REPLACE FUNCTION rpc_unclaim_open_mic_slot(slot_id UUID)
RETURNS event_slots
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result event_slots;
BEGIN
  -- Atomic UPDATE - only unclaim your own slot
  UPDATE event_slots
  SET
    performer_id = NULL,
    updated_at = NOW()
  WHERE id = slot_id
    AND performer_id = auth.uid()  -- Must be your slot
  RETURNING * INTO result;

  -- Check if update succeeded
  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Slot not found or does not belong to you';
  END IF;

  RETURN result;
END;
$$;

-- Function 3: Get all available slots for an event
-- UNCHANGED: Read-only
CREATE OR REPLACE FUNCTION rpc_get_available_slots_for_event(event_id UUID)
RETURNS SETOF event_slots
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM event_slots
  WHERE event_slots.event_id = rpc_get_available_slots_for_event.event_id
    AND performer_id IS NULL
  ORDER BY slot_index;
END;
$$;

-- ==========================================================
-- SECTION B: STUDIO BOOKING
-- ==========================================================

-- Function 4: Book a studio service appointment
-- PATCHED: Added Service-level locking to prevent double-booking
CREATE OR REPLACE FUNCTION rpc_book_studio_service(
  service_id UUID,
  desired_time TIMESTAMPTZ
)
RETURNS studio_appointments
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  service_duration INTEGER;
  service_exists BOOLEAN;
  result studio_appointments;
BEGIN
  -- CRITICAL FIX: Lock service row to prevent double-booking race condition
  -- This serializes all booking attempts for this specific service.
  -- Concurrent transactions will wait here until the lock is released.
  PERFORM 1 FROM studio_services WHERE id = service_id FOR UPDATE;

  -- Validate service exists and get duration
  SELECT
    duration_min,
    TRUE
  INTO
    service_duration,
    service_exists
  FROM studio_services
  WHERE id = service_id;

  IF NOT service_exists THEN
    RAISE EXCEPTION 'Service not found';
  END IF;

  -- Validate desired time is in the future
  IF desired_time <= NOW() THEN
    RAISE EXCEPTION 'Appointment time must be in the future';
  END IF;

  -- Check for double-booking (overlapping appointments for same service)
  -- Because of the Lock above, the state of studio_appointments is stable
  IF EXISTS (
    SELECT 1
    FROM studio_appointments sa
    JOIN studio_services ss ON sa.service_id = ss.id
    WHERE sa.service_id = rpc_book_studio_service.service_id
      AND sa.status NOT IN ('cancelled')
      AND (
        -- Check if new appointment overlaps with existing
        (desired_time, desired_time + (service_duration * INTERVAL '1 minute'))
        OVERLAPS
        (sa.appointment_time, sa.appointment_time + (ss.duration_min * INTERVAL '1 minute'))
      )
  ) THEN
    RAISE EXCEPTION 'Time slot already booked';
  END IF;

  -- Create the appointment
  INSERT INTO studio_appointments (
    service_id,
    performer_id,
    appointment_time,
    status
  ) VALUES (
    service_id,
    auth.uid(),
    desired_time,
    'pending'
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- ==========================================================
-- SECTION C: SHOWCASE / CURATED EVENT LINEUP
-- ==========================================================

-- Function 5: Set performer lineup for a showcase event
-- PATCHED: Added input validation and duplicate checks
CREATE OR REPLACE FUNCTION rpc_admin_set_showcase_lineup(
  event_id UUID,
  performer_ids UUID[]
)
RETURNS SETOF event_slots
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  is_showcase_event BOOLEAN;
  i INTEGER;
BEGIN
  -- 1. Authorization Check
  IF NOT (
    is_admin() OR
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND host_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Only admins or event host can set showcase lineup';
  END IF;

  -- 2. Validate Event
  SELECT is_showcase INTO is_showcase_event
  FROM events
  WHERE id = event_id;

  IF is_showcase_event IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF is_showcase_event = FALSE THEN
    RAISE EXCEPTION 'This function only works for showcase events';
  END IF;

  -- 3. Input Validation (New in v2)
  -- Check for duplicates in the input array
  IF (SELECT COUNT(*) FROM unnest(performer_ids)) > (SELECT COUNT(DISTINCT x) FROM unnest(performer_ids) x) THEN
     RAISE EXCEPTION 'Duplicate performer IDs found in lineup input';
  END IF;

  -- Check that all provided IDs actually exist in profiles
  IF EXISTS (
     SELECT 1 FROM unnest(performer_ids) AS pid
     WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = pid)
  ) THEN
     RAISE EXCEPTION 'One or more performer IDs do not exist';
  END IF;

  -- 4. Update Slots
  FOR i IN 1..array_length(performer_ids, 1) LOOP
    UPDATE event_slots
    SET
      performer_id = performer_ids[i],
      updated_at = NOW()
    WHERE event_slots.event_id = rpc_admin_set_showcase_lineup.event_id
      AND slot_index = i;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Slot % does not exist for this event. Create slots first.', i;
    END IF;
  END LOOP;

  -- Return all updated slots
  RETURN QUERY
  SELECT *
  FROM event_slots
  WHERE event_slots.event_id = rpc_admin_set_showcase_lineup.event_id
  ORDER BY slot_index;
END;
$$;

-- ==========================================================
-- END OF PHASE 2 RPC FUNCTIONS (v2 - PATCHED)
-- ==========================================================
-- Total functions: 5
-- Security model: SECURITY INVOKER (RLS-aware)
-- Helper dependencies: is_admin() from rls_phase1.sql
--
-- CRITICAL FIXES APPLIED:
-- 1. rpc_claim_open_mic_slot: Event-level FOR UPDATE lock prevents slot hoarding
-- 2. rpc_book_studio_service: Service-level FOR UPDATE lock prevents double-booking
-- 3. rpc_admin_set_showcase_lineup: Input validation (duplicates, existence checks)
--
-- NEXT STEPS:
-- 1. Execute this file in Supabase SQL Editor
-- 2. Test with concurrent requests to verify race condition fixes
-- 3. Monitor for deadlocks (unlikely with parent-table locking strategy)
-- ==========================================================

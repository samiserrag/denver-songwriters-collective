CREATE TYPE user_role AS ENUM ('performer', 'host', 'studio', 'admin');-- ============================================
-- OPEN MIC DROP - DATABASE INITIALIZATION
-- Migration: 20250101000000_init_schema.sql
-- ============================================
-- Execution order:
-- 1. Schema (tables, types, indexes, constraints)
-- 2. RLS policies
-- 3. Triggers
-- 4. RPC functions
-- ============================================

-- ============================================
-- PART 1: SCHEMA
-- Source: supabase/schema_phase1.sql
-- ============================================

-- ==========================================================
-- OPEN MIC DROP — PHASE 1 SCHEMA
-- Matches RLS policies exactly
-- ==========================================================

-- UUID extension (usually enabled but safe to call)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================================
-- ENUMS (safer than text fields)
-- ==========================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('performer', 'host', 'studio', 'admin');
    END IF;
END
$$;
    END IF;
END
$$;
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- ==========================================================
-- 1. PROFILES TABLE
-- ==========================================================

CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT auth.uid(),
  full_name     TEXT,
  role          user_role NOT NULL DEFAULT 'performer',
  bio           TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX profiles_id_idx ON profiles(id);

-- ==========================================================
-- 2. EVENTS TABLE
-- ==========================================================

CREATE TABLE events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  venue_name    TEXT,
  venue_address TEXT,
  event_date    DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_showcase   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX events_host_idx ON events(host_id);

-- ==========================================================
-- 3. EVENT_SLOTS TABLE
-- ==========================================================

CREATE TABLE event_slots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  performer_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  slot_index    INT NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(event_id, slot_index)
);

CREATE INDEX event_slots_event_idx ON event_slots(event_id);

-- ==========================================================
-- 4. STUDIO_SERVICES TABLE
-- ==========================================================

CREATE TABLE studio_services (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price_cents   INTEGER NOT NULL,
  duration_min  INTEGER NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX studio_services_studio_idx ON studio_services(studio_id);

-- ==========================================================
-- 5. STUDIO_APPOINTMENTS TABLE
-- ==========================================================

CREATE TABLE studio_appointments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id    UUID NOT NULL REFERENCES studio_services(id) ON DELETE CASCADE,
  performer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status        appointment_status NOT NULL DEFAULT 'pending',
  note          TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX studio_appt_service_idx ON studio_appointments(service_id);
CREATE INDEX studio_appt_performer_idx ON studio_appointments(performer_id);

-- ==========================================================
-- 6. SPOTLIGHTS TABLE
-- ==========================================================

CREATE TABLE spotlights (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  spotlight_date DATE NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX spotlights_artist_idx ON spotlights(artist_id);

-- ==========================================================
-- END OF PHASE 1 SCHEMA
-- ==========================================================

-- ============================================
-- PART 2: ROW LEVEL SECURITY POLICIES
-- Source: supabase/rls_phase1.sql
-- ============================================

-- OPEN MIC DROP - PHASE 1 RLS IMPLEMENTATION (REVISED WITH GEMINI FIXES)
-- Uses is_admin() SECURITY DEFINER helper to avoid recursion
-- IMPORTANT: Still add column-level triggers later for role/price protections.

-- ============================================
-- 0. HELPER FUNCTIONS (CRITICAL FIX)
-- ============================================
-- Admin check that bypasses RLS to avoid recursion.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all profiles
CREATE POLICY public_read_profiles ON profiles
FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile (role protection will be handled by trigger later)
CREATE POLICY update_own_profile ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY insert_own_profile ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Only admins can delete profiles
CREATE POLICY delete_admin_only ON profiles
  FOR DELETE USING (is_admin());

-- ============================================
-- 2. EVENTS TABLE
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Anyone can read events
CREATE POLICY public_read_events ON events
  FOR SELECT USING (true);

-- Hosts can manage their own events; admins can manage all
CREATE POLICY host_manage_own_events ON events
  FOR ALL USING (auth.uid() = host_id OR is_admin())
  WITH CHECK (auth.uid() = host_id OR is_admin());

-- ============================================
-- 3. EVENT_SLOTS TABLE
-- ============================================
ALTER TABLE event_slots ENABLE ROW LEVEL SECURITY;

-- Anyone can read slots
CREATE POLICY public_read_slots ON event_slots
  FOR SELECT USING (true);

-- Performers can claim or unclaim slots:
-- - Can update if slot is empty OR already theirs
-- - Can set performer_id to themselves or NULL (unclaim)
CREATE POLICY performer_claim_or_unclaim ON event_slots
  FOR UPDATE USING (
    (performer_id IS NULL OR performer_id = auth.uid())
  )
  WITH CHECK (
    (performer_id = auth.uid() OR performer_id IS NULL)
  );

-- Hosts can manage slots for their events; admins override
CREATE POLICY host_manage_event_slots ON event_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM events
      WHERE events.id = event_slots.event_id
        AND events.host_id = auth.uid()
    )
    OR is_admin()
  );

-- ============================================
-- 4. STUDIO_SERVICES TABLE
-- ============================================
ALTER TABLE studio_services ENABLE ROW LEVEL SECURITY;

-- Anyone can read services
CREATE POLICY public_read_services ON studio_services
  FOR SELECT USING (true);

-- Studios can manage their own services; admins override
CREATE POLICY studio_manage_own_services ON studio_services
  FOR ALL USING (studio_id = auth.uid() OR is_admin())
  WITH CHECK (studio_id = auth.uid() OR is_admin());

-- ============================================
-- 5. STUDIO_APPOINTMENTS TABLE
-- ============================================
ALTER TABLE studio_appointments ENABLE ROW LEVEL SECURITY;

-- Performers can view their own appointments
CREATE POLICY performer_view_own ON studio_appointments
  FOR SELECT USING (performer_id = auth.uid());

-- Performers can book appointments (insert)
CREATE POLICY performer_book_appointment ON studio_appointments
  FOR INSERT WITH CHECK (performer_id = auth.uid());

-- Performers can update their own appointments (status/cancellation)
-- NOTE: A trigger should later prevent price/duration manipulation.
CREATE POLICY performer_update_own ON studio_appointments
  FOR UPDATE USING (performer_id = auth.uid())
  WITH CHECK (performer_id = auth.uid());

-- Studios (and admins) can view/manage appointments for their services
CREATE POLICY studio_manage_appointments ON studio_appointments
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM studio_services
      WHERE studio_services.id = studio_appointments.service_id
        AND studio_services.studio_id = auth.uid()
    )
    OR is_admin()
  );

-- ============================================
-- 6. SPOTLIGHTS TABLE
-- ============================================
ALTER TABLE spotlights ENABLE ROW LEVEL SECURITY;

-- Anyone can read spotlight history
CREATE POLICY public_read_spotlights ON spotlights
  FOR SELECT USING (true);

-- Only admins can insert/update/delete spotlights
CREATE POLICY admin_manage_spotlights ON spotlights
  FOR ALL USING (is_admin());

-- ============================================
-- END OF PHASE 1 RLS IMPLEMENTATION (REVISED)
-- ============================================

-- ============================================
-- PART 3: TRIGGERS
-- Source: supabase/triggers_phase1.sql
-- ============================================

-- ==========================================================
-- OPEN MIC DROP — PHASE 1 COLUMN-LEVEL SECURITY TRIGGERS
-- ==========================================================
-- These triggers enforce column-level safety not possible in RLS:
-- 1. Prevent users from promoting themselves to admin
-- 2. Prevent changes to studio appointments after booking
-- 3. Prevent studio services from having price/duration changed by non-owners

-- ==========================================================
-- 0. HELPER — REUSE is_admin()
-- ==========================================================
-- Assumes is_admin() already exists (from RLS file)

-- ==========================================================
-- 1. PREVENT USERS CHANGING THEIR OWN ROLE
-- ==========================================================

CREATE OR REPLACE FUNCTION prevent_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow admins to edit anything
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  -- If role was changed by non-admin, reject
  IF NEW.role <> OLD.role THEN
    RAISE EXCEPTION 'Permission denied: You cannot change your user role.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_role_change
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_role_change();

-- ==========================================================
-- 2. PREVENT SERVICE CHANGES IN STUDIO APPOINTMENTS
-- ==========================================================
-- Prevents changing service_id after creation (which would change price)
-- Only allows status and note updates for non-admins

CREATE OR REPLACE FUNCTION prevent_appointment_service_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow admins to change anything
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  -- For non-admins, prevent changing service_id
  IF OLD.service_id IS DISTINCT FROM NEW.service_id THEN
    RAISE EXCEPTION 'Cannot change the service after booking';
  END IF;

  -- For non-admins, prevent changing performer_id or appointment_time
  IF OLD.performer_id IS DISTINCT FROM NEW.performer_id THEN
    RAISE EXCEPTION 'Cannot change the performer after booking';
  END IF;

  IF OLD.appointment_time IS DISTINCT FROM NEW.appointment_time THEN
    RAISE EXCEPTION 'Cannot change the appointment time after booking';
  END IF;

  -- Allow status and note changes
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_appointment_service_change
BEFORE UPDATE ON studio_appointments
FOR EACH ROW
EXECUTE FUNCTION prevent_appointment_service_change();

-- ==========================================================
-- 3. PREVENT STUDIO SERVICES FROM HAVING PRICE/DURATION CHANGED BY NON-OWNERS
-- ==========================================================

CREATE OR REPLACE FUNCTION restrict_studio_service_updates()
RETURNS TRIGGER AS $$
DECLARE
  service_owner UUID;
BEGIN
  SELECT studio_id INTO service_owner
  FROM studio_services
  WHERE id = OLD.id;

  -- Check if service exists (service_owner will be NULL if not found)
  IF service_owner IS NULL THEN
    RAISE EXCEPTION 'Service not found';
  END IF;

  IF is_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() <> service_owner THEN
    RAISE EXCEPTION 'Only the studio owner may update service details.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_studio_services_owner_only
BEFORE UPDATE ON studio_services
FOR EACH ROW
EXECUTE FUNCTION restrict_studio_service_updates();

-- ==========================================================
-- END OF PHASE 1 TRIGGERS
-- ==========================================================

-- ============================================
-- PART 4: RPC FUNCTIONS
-- Source: supabase/rpc_phase2_v2.sql
-- ============================================

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

-- Function: Get ALL slots for an event (including claimed)
CREATE OR REPLACE FUNCTION rpc_get_all_slots_for_event(event_id UUID)
RETURNS SETOF event_slots
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM event_slots
  WHERE event_slots.event_id = rpc_get_all_slots_for_event.event_id
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

  -- Lock event row to prevent concurrent lineup updates
  PERFORM 1 FROM events WHERE id = event_id FOR UPDATE;

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

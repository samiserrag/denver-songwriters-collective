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

-- 1. Public read policy (anyone can view events)
CREATE POLICY "public_read_events"
ON public.events
FOR SELECT
USING (true);

-- 2. Host insert policy (only hosts/admins can create)
CREATE POLICY "host_insert_events"
ON public.events
FOR INSERT
WITH CHECK (
  auth.uid() = host_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('host', 'admin')
  )
);

-- 3. Host update policy (hosts can update own events)
CREATE POLICY "host_update_own_events"
ON public.events
FOR UPDATE
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

-- 4. Host delete policy (hosts can delete own events)
CREATE POLICY "host_delete_own_events"
ON public.events
FOR DELETE
USING (auth.uid() = host_id);

-- 5. Admin full access (admins can do anything)
CREATE POLICY "admin_full_access_events"
ON public.events
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

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

-- Studios can view their own services
CREATE POLICY studio_select_own_services ON studio_services
  FOR SELECT USING (studio_id = auth.uid());

-- Only studios and admins can create services (role check)
CREATE POLICY studio_insert_services ON studio_services
  FOR INSERT WITH CHECK (
    studio_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('studio', 'admin')
    )
  );

-- Studios can update their own services
CREATE POLICY studio_update_own_services ON studio_services
  FOR UPDATE USING (studio_id = auth.uid())
  WITH CHECK (studio_id = auth.uid());

-- Studios can delete their own services
CREATE POLICY studio_delete_own_services ON studio_services
  FOR DELETE USING (studio_id = auth.uid());

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
-- IMPORTANT:
-- - Column-level protections (e.g., blocking role changes, price edits)
--   should be enforced via BEFORE UPDATE triggers or stored procedures.
-- - Gemini has reviewed this RLS structure for recursion and privilege escalation risks.
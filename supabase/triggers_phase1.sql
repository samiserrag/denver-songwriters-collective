-- ==========================================================
-- OPEN MIC DROP — PHASE 1 COLUMN-LEVEL SECURITY TRIGGERS
-- ==========================================================
-- These triggers enforce column-level safety not possible in RLS:
-- 1. Prevent users from promoting themselves to admin
-- 2. Prevent performers from modifying studio prices
-- 3. Prevent performers from altering service duration
-- 4. Prevent unauthorized role changes except by admins

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
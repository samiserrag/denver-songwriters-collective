-- Phase ABC6 Migration 3: Enforce NOT NULL + replace unique constraints to include date_key
--
-- PREREQUISITES:
-- - Migration 1 (20260111200000_abc6_add_date_key_columns.sql) must be applied
-- - Backfill script (abc6-backfill-date-keys.ts) must have run with --apply
-- - All tables must have 0 NULL date_key rows
--
-- THIS MIGRATION:
-- 1. Sets date_key NOT NULL on all 5 tables
-- 2. Replaces unique constraints to include date_key
-- 3. Changes event_lineup_state PK from (event_id) to (event_id, date_key)
--
-- NOTE: This is a BREAKING migration - run only after verifying 0 NULLs!

-- ============================================================================
-- PREFLIGHT CHECK: Verify no NULLs remain (migration will fail if any exist)
-- ============================================================================
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM event_rsvps WHERE date_key IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'STOP-GATE VIOLATION: event_rsvps has % NULL date_key rows', null_count;
    END IF;

    SELECT COUNT(*) INTO null_count FROM event_comments WHERE date_key IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'STOP-GATE VIOLATION: event_comments has % NULL date_key rows', null_count;
    END IF;

    SELECT COUNT(*) INTO null_count FROM event_timeslots WHERE date_key IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'STOP-GATE VIOLATION: event_timeslots has % NULL date_key rows', null_count;
    END IF;

    SELECT COUNT(*) INTO null_count FROM guest_verifications WHERE date_key IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'STOP-GATE VIOLATION: guest_verifications has % NULL date_key rows', null_count;
    END IF;

    SELECT COUNT(*) INTO null_count FROM event_lineup_state WHERE date_key IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'STOP-GATE VIOLATION: event_lineup_state has % NULL date_key rows', null_count;
    END IF;

    RAISE NOTICE 'PREFLIGHT PASSED: All tables have 0 NULL date_key rows';
END $$;

-- ============================================================================
-- 1. event_rsvps: NOT NULL + replace unique constraints
-- ============================================================================

-- 1a. Set NOT NULL
ALTER TABLE event_rsvps ALTER COLUMN date_key SET NOT NULL;

-- 1b. Drop old member unique constraint (event_id, user_id)
ALTER TABLE event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_event_id_user_id_key;

-- 1c. Add new member unique constraint (event_id, user_id, date_key)
-- Note: user_id can be NULL for guest RSVPs, so we need a partial unique index
ALTER TABLE event_rsvps
ADD CONSTRAINT event_rsvps_event_user_date_key
UNIQUE (event_id, user_id, date_key);

-- 1d. Drop old guest unique index (event_id, lower(guest_email)) WHERE guest_email IS NOT NULL AND status <> 'cancelled'
DROP INDEX IF EXISTS idx_event_rsvps_guest_email_event;

-- 1e. Add new guest unique index including date_key
CREATE UNIQUE INDEX idx_event_rsvps_guest_email_event_date
ON event_rsvps(event_id, lower(guest_email), date_key)
WHERE guest_email IS NOT NULL AND status <> 'cancelled';

COMMENT ON CONSTRAINT event_rsvps_event_user_date_key ON event_rsvps
IS 'One RSVP per member per event per occurrence date';

-- ============================================================================
-- 2. event_comments: NOT NULL only (no unique constraints to replace)
-- ============================================================================

ALTER TABLE event_comments ALTER COLUMN date_key SET NOT NULL;

-- ============================================================================
-- 3. event_timeslots: NOT NULL + replace unique constraint
-- ============================================================================

-- 3a. Set NOT NULL
ALTER TABLE event_timeslots ALTER COLUMN date_key SET NOT NULL;

-- 3b. Drop old unique constraint (event_id, slot_index)
ALTER TABLE event_timeslots DROP CONSTRAINT IF EXISTS event_timeslots_event_id_slot_index_key;

-- 3c. Add new unique constraint (event_id, slot_index, date_key)
ALTER TABLE event_timeslots
ADD CONSTRAINT event_timeslots_event_slot_date_key
UNIQUE (event_id, slot_index, date_key);

COMMENT ON CONSTRAINT event_timeslots_event_slot_date_key ON event_timeslots
IS 'One timeslot per slot_index per event per occurrence date';

-- ============================================================================
-- 4. guest_verifications: NOT NULL + replace unique index
-- ============================================================================

-- 4a. Set NOT NULL
ALTER TABLE guest_verifications ALTER COLUMN date_key SET NOT NULL;

-- 4b. Drop old unique index for active verifications (email, event_id) WHERE not verified and not locked
DROP INDEX IF EXISTS idx_guest_verifications_unique_active;

-- 4c. Add new unique index including date_key
CREATE UNIQUE INDEX idx_guest_verifications_unique_active_date
ON guest_verifications(email, event_id, date_key)
WHERE verified_at IS NULL AND locked_until IS NULL;

-- ============================================================================
-- 5. event_lineup_state: NOT NULL + change PK from (event_id) to (event_id, date_key)
-- ============================================================================

-- 5a. Set NOT NULL
ALTER TABLE event_lineup_state ALTER COLUMN date_key SET NOT NULL;

-- 5b. Drop old primary key (event_id only)
ALTER TABLE event_lineup_state DROP CONSTRAINT IF EXISTS event_lineup_state_pkey;

-- 5c. Add new composite primary key (event_id, date_key)
ALTER TABLE event_lineup_state
ADD CONSTRAINT event_lineup_state_pkey
PRIMARY KEY (event_id, date_key);

COMMENT ON CONSTRAINT event_lineup_state_pkey ON event_lineup_state
IS 'One lineup state per event per occurrence date';

-- ============================================================================
-- VERIFICATION: Confirm all constraints applied
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 3 complete. Per-occurrence constraints enforced on all 5 tables.';
    RAISE NOTICE 'Next steps: Update API routes to include date_key in all reads/writes.';
END $$;

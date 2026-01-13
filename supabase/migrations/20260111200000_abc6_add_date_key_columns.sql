-- Phase ABC6 Migration 1: Add date_key columns (additive, safe)
-- Purpose: Enable per-occurrence RSVPs, comments, timeslots, guest verifications, and lineup state
-- This migration adds nullable date_key columns and indexes; does NOT enforce constraints yet

-- ============================================================================
-- 1. Add date_key column to event_rsvps
-- ============================================================================
ALTER TABLE event_rsvps
ADD COLUMN IF NOT EXISTS date_key TEXT;

COMMENT ON COLUMN event_rsvps.date_key IS 'YYYY-MM-DD occurrence date this RSVP applies to (Denver-canonical)';

-- ============================================================================
-- 2. Add date_key column to event_comments
-- ============================================================================
ALTER TABLE event_comments
ADD COLUMN IF NOT EXISTS date_key TEXT;

COMMENT ON COLUMN event_comments.date_key IS 'YYYY-MM-DD occurrence date this comment applies to (Denver-canonical)';

-- ============================================================================
-- 3. Add date_key column to event_timeslots
-- ============================================================================
ALTER TABLE event_timeslots
ADD COLUMN IF NOT EXISTS date_key TEXT;

COMMENT ON COLUMN event_timeslots.date_key IS 'YYYY-MM-DD occurrence date this timeslot applies to (Denver-canonical)';

-- ============================================================================
-- 4. Add date_key column to guest_verifications
-- ============================================================================
ALTER TABLE guest_verifications
ADD COLUMN IF NOT EXISTS date_key TEXT;

COMMENT ON COLUMN guest_verifications.date_key IS 'YYYY-MM-DD occurrence date this verification applies to (Denver-canonical)';

-- ============================================================================
-- 5. Add date_key column to event_lineup_state
-- ============================================================================
ALTER TABLE event_lineup_state
ADD COLUMN IF NOT EXISTS date_key TEXT;

COMMENT ON COLUMN event_lineup_state.date_key IS 'YYYY-MM-DD occurrence date this lineup state applies to (Denver-canonical)';

-- ============================================================================
-- 6. Add indexes for query performance (event_id, date_key)
-- ============================================================================

-- Index for event_rsvps (event_id, date_key) - for querying RSVPs by occurrence
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_date_key
ON event_rsvps(event_id, date_key);

-- Index for event_comments (event_id, date_key) - for querying comments by occurrence
CREATE INDEX IF NOT EXISTS idx_event_comments_event_date_key
ON event_comments(event_id, date_key);

-- Index for event_timeslots (event_id, date_key) - for querying timeslots by occurrence
CREATE INDEX IF NOT EXISTS idx_event_timeslots_event_date_key
ON event_timeslots(event_id, date_key);

-- Index for guest_verifications (event_id, date_key) - for scoping verifications to occurrence
CREATE INDEX IF NOT EXISTS idx_guest_verifications_event_date_key
ON guest_verifications(event_id, date_key);

-- Index for guest_verifications (email, event_id, date_key) - for active verification lookups
CREATE INDEX IF NOT EXISTS idx_guest_verifications_email_event_date_key
ON guest_verifications(email, event_id, date_key);

-- Index for event_lineup_state (event_id, date_key) - prep for PK change in migration 3
CREATE INDEX IF NOT EXISTS idx_event_lineup_state_event_date_key
ON event_lineup_state(event_id, date_key);

-- ============================================================================
-- NOTE: No constraint changes in this migration
-- - NOT NULL enforcement happens in migration 3 after backfill
-- - Unique constraint updates happen in migration 3 after backfill
-- - PK changes happen in migration 3 after backfill
-- ============================================================================

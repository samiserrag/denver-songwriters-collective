-- ============================================================================
-- Phase 0 Data Cleanup - Event Anomalies
-- Executed: 2025-12-27
--
-- This file documents data fixes applied during Phase 0.
-- All changes use RETURNING to capture affected rows for audit.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Identity Crisis Events (open_mic with is_dsc_event=true)
--    This is a test event that should be deleted
-- ----------------------------------------------------------------------------
-- Verify before delete:
-- SELECT id, title, event_type, is_dsc_event FROM events
-- WHERE event_type = 'open_mic' AND is_dsc_event = true;

DELETE FROM events
WHERE id = 'b7ec8f48-c484-492e-8814-004d7bd0e226'
RETURNING id, title, 'identity_crisis_deleted' as cleanup_type;

-- ----------------------------------------------------------------------------
-- 2. Events Missing venue_id - Link to existing venues
-- ----------------------------------------------------------------------------

-- Link "Jam B4 the Slam at The Pearl" to The Pearl Denver
UPDATE events
SET venue_id = '354a8b01-5e0d-4add-852b-61861d77e25c'
WHERE id = 'cd244f85-4ae1-4d6e-92ba-c33a2825f054'
  AND venue_id IS NULL
RETURNING id, title, venue_id, 'venue_linked' as cleanup_type;

-- Link "Node Arts Collective Music & Poetry Open Mic" to Node Arts Collective
UPDATE events
SET venue_id = 'efc7b88e-372e-46ae-a313-ca04b89b99bd'
WHERE id = '0ec4b954-04ac-48bd-b852-c1ca2b7491a7'
  AND venue_id IS NULL
RETURNING id, title, venue_id, 'venue_linked' as cleanup_type;

-- Link "The Pearl Poetry Open Mic" to The Pearl Denver
UPDATE events
SET venue_id = '354a8b01-5e0d-4add-852b-61861d77e25c'
WHERE id = '5645ae56-578b-4b83-80c5-f042a19bc0e0'
  AND venue_id IS NULL
RETURNING id, title, venue_id, 'venue_linked' as cleanup_type;

-- ============================================================================
-- VERIFICATION QUERIES (all should return 0)
-- ============================================================================
-- SELECT COUNT(*) as identity_crisis FROM events WHERE event_type = 'open_mic' AND is_dsc_event = true;
-- SELECT COUNT(*) as orphaned FROM events WHERE day_of_week IS NULL AND event_date IS NULL;
-- SELECT COUNT(*) as missing_venue FROM events WHERE venue_id IS NULL AND venue_name IS NOT NULL;

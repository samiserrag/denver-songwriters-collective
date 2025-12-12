-- =====================================================
-- MIGRATION: Require venue_id for open mics
-- This migration ensures all open mic events have a proper venue_id
-- and removes reliance on denormalized venue_name/venue_address fields
-- =====================================================

-- STEP 1: Find events without venue_id and create/link venues
-- Run this query first to see what needs to be fixed:
-- SELECT id, title, venue_name, venue_address FROM events WHERE venue_id IS NULL AND event_type = 'open_mic';

-- STEP 2: For each event without venue_id, either:
-- a) Find existing venue by name and link it
-- b) Create new venue from denormalized fields and link it

-- Link events to existing venues by matching venue_name
UPDATE events e
SET venue_id = (
  SELECT v.id FROM venues v
  WHERE LOWER(TRIM(v.name)) = LOWER(TRIM(e.venue_name))
  LIMIT 1
)
WHERE e.venue_id IS NULL
  AND e.event_type = 'open_mic'
  AND e.venue_name IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM venues v
    WHERE LOWER(TRIM(v.name)) = LOWER(TRIM(e.venue_name))
  );

-- For remaining events without venue_id, create venues from denormalized data
-- Note: This requires venue_name to be present
INSERT INTO venues (name, address, city, state)
SELECT DISTINCT
  e.venue_name,
  COALESCE(e.venue_address, 'Address TBD'),
  'Denver',  -- Default city
  'CO'       -- Default state
FROM events e
WHERE e.venue_id IS NULL
  AND e.event_type = 'open_mic'
  AND e.venue_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM venues v
    WHERE LOWER(TRIM(v.name)) = LOWER(TRIM(e.venue_name))
  );

-- Now link those newly created venues
UPDATE events e
SET venue_id = (
  SELECT v.id FROM venues v
  WHERE LOWER(TRIM(v.name)) = LOWER(TRIM(e.venue_name))
  LIMIT 1
)
WHERE e.venue_id IS NULL
  AND e.event_type = 'open_mic'
  AND e.venue_name IS NOT NULL;

-- STEP 3: Clear the denormalized fields (optional - keep for historical reference)
-- UPDATE events
-- SET venue_name = NULL, venue_address = NULL
-- WHERE event_type = 'open_mic' AND venue_id IS NOT NULL;

-- STEP 4: Add constraint to require venue_id for open_mics (optional)
-- This prevents future events from being created without a venue
-- ALTER TABLE events ADD CONSTRAINT events_open_mic_venue_required
-- CHECK (event_type != 'open_mic' OR venue_id IS NOT NULL);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check for any remaining events without venue_id
-- SELECT id, title, venue_name FROM events WHERE venue_id IS NULL AND event_type = 'open_mic';

-- Check for events with both venue_id and denormalized fields (potential data conflicts)
-- SELECT e.id, e.title, e.venue_name AS denorm_name, v.name AS venue_name
-- FROM events e
-- JOIN venues v ON e.venue_id = v.id
-- WHERE e.venue_name IS NOT NULL AND e.venue_name != v.name;

-- Migration: Cleanup Test Events
-- Date: December 2024
-- Purpose: Remove or deactivate test events from production

-- Option 1: Soft delete - Set status to 'cancelled' for any test events
-- This preserves data while hiding from production views
UPDATE events
SET status = 'cancelled',
    updated_at = NOW()
WHERE
    -- Match "Night Owl" test events mentioned in feedback
    title ILIKE '%night owl%test%'
    OR title ILIKE '%test%night owl%'
    -- Also catch any other obvious test events
    OR title ILIKE '%test event%'
    OR title ILIKE '%[test]%'
    OR title ILIKE '%(test)%'
    OR description ILIKE '%this is a test%';

-- Option 2: For truly unwanted test data, hard delete (commented out for safety)
-- DELETE FROM events
-- WHERE title ILIKE '%night owl%test%'
--    OR title ILIKE '%test event%';

-- Log what was cleaned up (run this as a SELECT first to verify)
-- SELECT id, title, status, created_at
-- FROM events
-- WHERE title ILIKE '%test%' OR title ILIKE '%night owl%';

-- Verify no test events are visible in active status
SELECT
    COUNT(*) AS remaining_test_events,
    string_agg(title, ', ') AS event_titles
FROM events
WHERE status = 'active'
  AND (title ILIKE '%test%' OR description ILIKE '%this is a test%');

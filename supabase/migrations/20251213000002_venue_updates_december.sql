-- Migration: December 2024 Venue Updates
-- Based on community feedback and verification
-- Date: December 13, 2024

-- ============================================================================
-- 1. REMOVE: Fraco's Open Mic (ended in October)
-- ============================================================================
UPDATE events
SET status = 'cancelled',
    updated_at = NOW()
WHERE venue_name ILIKE '%fraco%'
  AND event_type = 'open_mic'
  AND status = 'active';

-- ============================================================================
-- 2. MARK INACTIVE: McKee (unknown location - needs verification)
-- ============================================================================
UPDATE events
SET status = 'inactive',
    description = COALESCE(description, '') || E'\n\n[Note: Marked inactive Dec 2024 - venue location needs verification]',
    updated_at = NOW()
WHERE venue_name ILIKE '%mckee%'
  AND event_type = 'open_mic'
  AND status = 'active';

-- ============================================================================
-- 3. ENSURE VENUE: Crazy Mountain Brewery
-- ============================================================================
INSERT INTO venues (name, address, city, state, zip)
VALUES ('Crazy Mountain Brewery', '1505 N Ogden St', 'Denver', 'CO', '80218')
ON CONFLICT (name) DO UPDATE SET
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip = EXCLUDED.zip,
    updated_at = NOW();

-- ============================================================================
-- 4. ADD VENUE: Node Arts Collective
-- ============================================================================
INSERT INTO venues (name, address, city, state, zip)
VALUES ('Node Arts Collective', '3704 W 72nd Ave', 'Westminster', 'CO', '80003')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 5. ADD VENUE: The Pearl Denver
-- ============================================================================
INSERT INTO venues (name, address, city, state, zip)
VALUES ('The Pearl Denver', '2195 California St', 'Denver', 'CO', '80205')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 6. ADD EVENT: Node Arts Collective - Music and Poetry Open Mic
-- ============================================================================
INSERT INTO events (
    title,
    slug,
    event_type,
    venue_name,
    venue_address,
    day_of_week,
    start_time,
    end_time,
    description,
    category,
    status,
    frequency
)
SELECT
    'Node Arts Collective Music & Poetry Open Mic',
    'node-arts-collective-music-poetry-open-mic',
    'open_mic',
    'Node Arts Collective',
    '3704 W 72nd Ave, Westminster, CO 80003',
    'Friday',
    '6:00 PM',
    '8:00 PM',
    'Music and Poetry focused open mic at Node Arts Collective. Note: This event runs intermittently - check with venue for specific dates.',
    'variety',
    'active',
    'intermittent'
WHERE NOT EXISTS (
    SELECT 1 FROM events WHERE slug = 'node-arts-collective-music-poetry-open-mic'
);

-- ============================================================================
-- 7. ADD EVENT: The Pearl Denver - Friday Poetry Open Mic
-- ============================================================================
INSERT INTO events (
    title,
    slug,
    event_type,
    venue_name,
    venue_address,
    day_of_week,
    start_time,
    end_time,
    description,
    category,
    status,
    frequency
)
SELECT
    'The Pearl Poetry Open Mic',
    'the-pearl-poetry-open-mic',
    'open_mic',
    'The Pearl Denver',
    '2195 California St, Denver, CO 80205',
    'Friday',
    '9:00 PM',
    '12:00 AM',
    'Weekly poetry open mic at The Pearl Denver. A welcoming space for poets and spoken word artists.',
    'poetry',
    'active',
    'weekly'
WHERE NOT EXISTS (
    SELECT 1 FROM events WHERE slug = 'the-pearl-poetry-open-mic'
);

-- ============================================================================
-- 8. ADD EVENT: The Pearl Denver - Sunday Jam B4 the Slam
-- ============================================================================
INSERT INTO events (
    title,
    slug,
    event_type,
    venue_name,
    venue_address,
    day_of_week,
    start_time,
    description,
    category,
    status,
    frequency
)
SELECT
    'Jam B4 the Slam at The Pearl',
    'jam-b4-the-slam-the-pearl',
    'open_mic',
    'The Pearl Denver',
    '2195 California St, Denver, CO 80205',
    'Sunday',
    '6:00 PM',
    'Sunday jam session before the slam at The Pearl Denver. Open to musicians and performers.',
    'variety',
    'active',
    'weekly'
WHERE NOT EXISTS (
    SELECT 1 FROM events WHERE slug = 'jam-b4-the-slam-the-pearl'
);

-- ============================================================================
-- 9. VERIFY: Crazy Mountain Brewery listings
-- Note: Search found Open Acoustic Jam on Thursdays 5-8 PM in addition to Friday event
-- Run this SELECT to see current listings and determine if both should exist
-- ============================================================================
-- SELECT id, title, day_of_week, start_time, end_time, status
-- FROM events
-- WHERE venue_name ILIKE '%crazy mountain%';

-- ============================================================================
-- SUMMARY: Run verification queries
-- ============================================================================
SELECT 'REMOVED/INACTIVE' as action, title, venue_name, status
FROM events
WHERE (venue_name ILIKE '%fraco%' OR venue_name ILIKE '%mckee%')
  AND event_type = 'open_mic'
  AND status IN ('cancelled', 'inactive')

UNION ALL

SELECT 'ADDED' as action, title, venue_name, status
FROM events
WHERE slug IN (
    'node-arts-collective-music-poetry-open-mic',
    'the-pearl-poetry-open-mic',
    'jam-b4-the-slam-the-pearl'
);

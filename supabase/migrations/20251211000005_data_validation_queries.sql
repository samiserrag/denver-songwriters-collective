-- =====================================================
-- DATA VALIDATION QUERIES
-- Run these in Supabase SQL Editor to identify issues
-- =====================================================

-- =====================================================
-- 1. EVENTS WITH MISSING OR BROKEN DATA
-- =====================================================

-- Events without venue_id (using denormalized override fields)
SELECT
  id,
  title,
  day_of_week,
  venue_name AS "override_venue_name",
  venue_address AS "override_venue_address",
  status
FROM events
WHERE venue_id IS NULL
  AND event_type = 'open_mic'
ORDER BY day_of_week, title;

-- Events with venue_id but venue doesn't exist (orphaned reference)
SELECT
  e.id,
  e.title,
  e.day_of_week,
  e.venue_id AS "orphaned_venue_id"
FROM events e
LEFT JOIN venues v ON e.venue_id = v.id
WHERE e.venue_id IS NOT NULL
  AND v.id IS NULL
  AND e.event_type = 'open_mic';

-- Events missing slug (can't be accessed via clean URL)
SELECT
  id,
  title,
  day_of_week,
  slug
FROM events
WHERE slug IS NULL
  AND event_type = 'open_mic'
ORDER BY day_of_week, title;

-- Events with invalid day_of_week (case issues or typos)
SELECT
  id,
  title,
  day_of_week
FROM events
WHERE event_type = 'open_mic'
  AND day_of_week NOT IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
  AND day_of_week IS NOT NULL
ORDER BY day_of_week;

-- Events missing critical display fields
SELECT
  id,
  title,
  day_of_week,
  start_time,
  status,
  description
FROM events
WHERE event_type = 'open_mic'
  AND (
    day_of_week IS NULL
    OR start_time IS NULL
    OR status IS NULL
    OR status NOT IN ('active', 'inactive', 'unverified')
  )
ORDER BY title;

-- =====================================================
-- 2. VENUES WITH MISSING OR BROKEN DATA
-- =====================================================

-- Venues with incomplete address info
SELECT
  id,
  name,
  address,
  city,
  state,
  zip,
  phone,
  website_url
FROM venues
WHERE
  address IS NULL OR address = ''
  OR city IS NULL OR city = ''
  OR state IS NULL OR state = ''
  OR zip IS NULL OR zip = ''
ORDER BY name;

-- Venues missing contact info (phone or website)
SELECT
  id,
  name,
  city,
  phone,
  website_url
FROM venues
WHERE
  (phone IS NULL OR phone = '')
  AND (website_url IS NULL OR website_url = '')
ORDER BY name;

-- Venues with potentially broken website URLs
SELECT
  id,
  name,
  website_url
FROM venues
WHERE website_url IS NOT NULL
  AND website_url != ''
  AND (
    website_url NOT LIKE 'http%'
    OR website_url LIKE '%goo.gl%'
  )
ORDER BY name;

-- Venues not associated with any events (orphaned venues)
SELECT
  v.id,
  v.name,
  v.city
FROM venues v
LEFT JOIN events e ON v.id = e.venue_id
WHERE e.id IS NULL
ORDER BY v.name;

-- =====================================================
-- 3. SUMMARY COUNTS
-- =====================================================

-- Count of open mics by status
SELECT
  COALESCE(status, 'NULL') AS status,
  COUNT(*) AS count
FROM events
WHERE event_type = 'open_mic'
GROUP BY status
ORDER BY count DESC;

-- Count of open mics by day
SELECT
  COALESCE(day_of_week, 'NULL') AS day_of_week,
  COUNT(*) AS count
FROM events
WHERE event_type = 'open_mic'
GROUP BY day_of_week
ORDER BY
  CASE day_of_week
    WHEN 'Monday' THEN 1
    WHEN 'Tuesday' THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday' THEN 4
    WHEN 'Friday' THEN 5
    WHEN 'Saturday' THEN 6
    WHEN 'Sunday' THEN 7
    ELSE 8
  END;

-- Count of events with vs without venue_id
SELECT
  CASE WHEN venue_id IS NOT NULL THEN 'Has venue_id' ELSE 'Using override fields' END AS venue_type,
  COUNT(*) AS count
FROM events
WHERE event_type = 'open_mic'
GROUP BY CASE WHEN venue_id IS NOT NULL THEN 'Has venue_id' ELSE 'Using override fields' END;

-- =====================================================
-- 4. FULL DATA EXPORT FOR REVIEW
-- =====================================================

-- All open mics with venue info (for manual review)
SELECT
  e.id AS event_id,
  e.title,
  e.slug,
  e.day_of_week,
  e.start_time,
  e.end_time,
  e.signup_time,
  e.status,
  e.description,
  e.recurrence_rule,
  e.venue_id,
  e.venue_name AS "override_venue_name",
  e.venue_address AS "override_venue_address",
  v.id AS "venue_record_id",
  v.name AS "venue_name",
  v.address AS "venue_address",
  v.city AS "venue_city",
  v.state AS "venue_state",
  v.zip AS "venue_zip",
  v.phone AS "venue_phone",
  v.website_url AS "venue_website"
FROM events e
LEFT JOIN venues v ON e.venue_id = v.id
WHERE e.event_type = 'open_mic'
ORDER BY
  CASE e.day_of_week
    WHEN 'Monday' THEN 1
    WHEN 'Tuesday' THEN 2
    WHEN 'Wednesday' THEN 3
    WHEN 'Thursday' THEN 4
    WHEN 'Friday' THEN 5
    WHEN 'Saturday' THEN 6
    WHEN 'Sunday' THEN 7
    ELSE 8
  END,
  e.start_time,
  e.title;

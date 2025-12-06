-- File: supabase/scripts/clean_null_venue_events.sql
-- Purpose: Safe, copy/paste SQL to find and (optionally) remove events with NULL venue_name
-- Recommended: Run these in Supabase SQL editor or psql after taking a backup.

-- STEP 1 — Count bad rows
-- Run this first to see how many rows are affected
SELECT COUNT(*) AS null_venue_count
FROM events
WHERE venue_name IS NULL;

-- STEP 2 — Preview the bad rows (inspect before deleting)
-- Shows the most recent 50 rows with NULL venue_name
SELECT
  id,
  title,
  day_of_week,
  start_time,
  recurrence_rule,
  created_at
FROM events
WHERE venue_name IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- OPTIONAL — reversible staging step (recommended for extra safety)
-- Mark rows as invalid first so you can review and later remove them
-- NOTE: only run this if you have a "status" column that accepts the value used below.
-- If your schema doesn't have a status column, skip this step.
UPDATE events
SET status = 'invalid'
WHERE venue_name IS NULL
RETURNING id, title, created_at;

-- STEP 3 — (Irreversible) Delete all events with NULL venue_name
-- Run only after you have reviewed the preview and confirmed you want to permanently remove them
DELETE FROM events
WHERE venue_name IS NULL
RETURNING id, title, created_at;

-- If you used the OPTIONAL staging step, you can delete only those staged rows:
-- DELETE FROM events WHERE status = 'invalid' RETURNING id, title, created_at;

-- Recommended backup example (run from a safe machine with psql installed):
-- pg_dump --table=events --file=events_backup.sql "postgres://user:pass@host:5432/dbname"

-- End of file

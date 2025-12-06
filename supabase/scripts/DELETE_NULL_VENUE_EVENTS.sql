-- File: supabase/scripts/DELETE_NULL_VENUE_EVENTS.sql
-- Purpose: Final, copy/paste safe DELETE statement to remove events with NULL venue_name.
-- IMPORTANT: This is irreversible. Run only after you've reviewed the COUNT + PREVIEW results and taken a backup.

-- Recommended quick backup (run from a machine with pg_dump/psql configured):
-- pg_dump --table=events --file=events_backup.sql "postgres://user:pass@host:5432/dbname"

-- Optional: preview and confirm the rows that will be deleted
SELECT COUNT(*) AS null_venue_count FROM events WHERE venue_name IS NULL;

SELECT id, title, day_of_week, start_time, recurrence_rule, created_at
FROM events
WHERE venue_name IS NULL
ORDER BY created_at DESC
LIMIT 200;

-- FINAL DELETE (run only after you confirm preview is correct)
BEGIN;

DELETE FROM events
WHERE venue_name IS NULL
RETURNING id, title, created_at;

COMMIT;

-- End of file

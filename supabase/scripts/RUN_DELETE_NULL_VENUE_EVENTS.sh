#!/usr/bin/env bash
# supabase/scripts/RUN_DELETE_NULL_VENUE_EVENTS.sh
# Usage: export PG_URI="postgres://user:pass@host:5432/dbname" && ./RUN_DELETE_NULL_VENUE_EVENTS.sh
# This script will: preview affected rows, then run the DELETE inside a transaction and print deleted rows.
# IMPORTANT: irreversible. Run only after you verified the preview and backed up the table.

if [ -z "$PG_URI" ]; then
  echo "Error: PG_URI environment variable is not set."
  echo "Example: export PG_URI='postgres://user:pass@host:5432/dbname'"
  exit 1
fi

set -euo pipefail

echo "Preview: count of rows with NULL venue_name"
psql "$PG_URI" -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) AS null_venue_count FROM events WHERE venue_name IS NULL;"

echo "Preview: up to 200 rows that would be deleted"
psql "$PG_URI" -v ON_ERROR_STOP=1 -c "SELECT id, title, day_of_week, start_time, recurrence_rule, created_at FROM events WHERE venue_name IS NULL ORDER BY created_at DESC LIMIT 200;"

read -p "Type DELETE to proceed (case-sensitive): " CONFIRM
if [ "$CONFIRM" != "DELETE" ]; then
  echo "Aborting. You must type DELETE to proceed."
  exit 0
fi

echo "Running DELETE inside a transaction and returning deleted rows..."
psql "$PG_URI" -v ON_ERROR_STOP=1 -c "BEGIN; DELETE FROM events WHERE venue_name IS NULL RETURNING id, title, created_at; COMMIT;"

echo "Done."

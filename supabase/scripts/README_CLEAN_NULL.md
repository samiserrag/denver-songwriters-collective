Status and next steps for cleaning events with NULL venue_name

This repository contains a helper SQL script at:

  supabase/scripts/clean_null_venue_events.sql

What I did:
- Created the SQL helper script with COUNT, PREVIEW, optional staging UPDATE, and DELETE statements.

Recommended next steps (run these in Supabase SQL Editor or psql):

1) Count how many rows have NULL venue_name
   RUN:
     SELECT COUNT(*) AS null_venue_count
     FROM events
     WHERE venue_name IS NULL;

2) Preview latest rows with NULL venue_name
   RUN:
     SELECT id, title, day_of_week, start_time, recurrence_rule, created_at
     FROM events
     WHERE venue_name IS NULL
     ORDER BY created_at DESC
     LIMIT 50;

3) If you want a reversible staging step, run the UPDATE to mark them as 'invalid' (only if your schema has a status column)
   RUN:
     UPDATE events
     SET status = 'invalid'
     WHERE venue_name IS NULL
     RETURNING id, title, created_at;

4) If you confirm deletion, run the DELETE
   RUN:
     DELETE FROM events
     WHERE venue_name IS NULL
     RETURNING id, title, created_at;

Safety notes:
- Backup the events table before destructive actions (pg_dump example is in the SQL script file).
- Paste the COUNT and PREVIEW outputs here if you want me to review them before deleting.
- If you want me to generate the exact DELETE statement or a transaction wrapper, say "approve delete" and I will provide it.

Task checklist
- [x] Analyze requirements
- [x] Create SQL statements for COUNT and PREVIEW
- [x] Save SQL script to repo (supabase/scripts/clean_null_venue_events.sql)
- [ ] Run COUNT query against DB to find events with NULL venue_name (user)
- [ ] If count > 0, fetch a preview of the bad rows (user)
- [ ] Wait for user approval before deletion
- [ ] If approved, delete events with NULL venue_name

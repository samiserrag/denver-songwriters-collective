# Duplicate Open Mic Events Review

This file documents potential duplicate events in the database that need manual review.

## How Duplicates Were Identified

Potential duplicates are identified by matching:
1. Same venue_name AND same day_of_week
2. Very similar titles (case-insensitive)

## SQL Query to Find Duplicates

Run this query in Supabase SQL Editor to identify potential duplicates:

```sql
-- Find potential duplicates (same venue, same day)
SELECT
  a.id as id1,
  b.id as id2,
  a.title as title1,
  b.title as title2,
  a.venue_name,
  a.day_of_week,
  a.status as status1,
  b.status as status2,
  a.start_time as start_time1,
  b.start_time as start_time2
FROM events a
JOIN events b ON
  LOWER(TRIM(a.venue_name)) = LOWER(TRIM(b.venue_name))
  AND a.day_of_week = b.day_of_week
  AND a.id < b.id
  AND a.event_type = 'open_mic'
  AND b.event_type = 'open_mic'
ORDER BY a.venue_name, a.day_of_week;
```

## Review Criteria

When reviewing duplicates:
- **Keep the more complete record** (more fields filled in)
- **Keep the most recently updated record** if data is equal
- **Check start_time** - different times may indicate different events
- **Check status** - prefer 'active' over 'inactive' or 'pending'

## Action Items

After running the query above, document findings here:

| Venue | Day | ID to Keep | ID to Remove | Notes |
|-------|-----|------------|--------------|-------|
| (Run query to populate) | | | | |

## IMPORTANT

**DO NOT DELETE ANY ROWS AUTOMATICALLY**

All deletions must be:
1. Reviewed by a human
2. Documented in this file
3. Performed manually in the Supabase dashboard

---

Generated: 2025-12-06
Last Updated: (update this when reviewed)

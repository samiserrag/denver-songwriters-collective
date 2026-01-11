# Phase ABC #3: One-Time Duplicate Venue Merge Procedure

**Status:** INVESTIGATION ONLY (No execution without explicit approval)
**Created:** January 2026
**Purpose:** Safe procedure to identify and merge duplicate venue records

---

## Overview

This document provides SQL scripts for a one-time cleanup of duplicate venue records.

**CRITICAL:** Do NOT execute any of these scripts without explicit approval. This is a reference document only.

---

## 1. Tables Referencing `venues.id`

| Table | FK Field | FK Behavior on Delete |
|-------|----------|----------------------|
| `events` | `venue_id` | SET NULL |
| `gallery_albums` | `venue_id` | SET NULL |
| `gallery_images` | `venue_id` | SET NULL |
| `monthly_highlights` | `venue_id` | SET NULL |

**Important:** All FKs use SET NULL on delete. If you delete a venue row without first repointing references, those references will become NULL (orphaned).

---

## 2. Identify Potential Duplicates

This query finds venues that may be duplicates based on normalized name + address + city + state + zip.

```sql
-- DRY-RUN: Find potential duplicate venue groups
SELECT
  LOWER(TRIM(name)) AS normalized_name,
  LOWER(TRIM(address)) AS normalized_address,
  LOWER(TRIM(city)) AS normalized_city,
  LOWER(TRIM(state)) AS normalized_state,
  LOWER(TRIM(COALESCE(zip, ''))) AS normalized_zip,
  COUNT(*) AS venue_count,
  ARRAY_AGG(id ORDER BY created_at ASC) AS venue_ids,
  ARRAY_AGG(name ORDER BY created_at ASC) AS venue_names
FROM venues
GROUP BY
  LOWER(TRIM(name)),
  LOWER(TRIM(address)),
  LOWER(TRIM(city)),
  LOWER(TRIM(state)),
  LOWER(TRIM(COALESCE(zip, '')))
HAVING COUNT(*) > 1
ORDER BY venue_count DESC, normalized_name;
```

**Output:** Groups of venue IDs that share the same normalized name/address/city/state/zip.

---

## 3. Count References Per Venue

Before merging, check how many rows reference each venue in the duplicate set.

```sql
-- DRY-RUN: Count all references for a list of venue IDs
-- Replace 'VENUE_ID_1', 'VENUE_ID_2' with actual UUIDs from Step 2

WITH venue_ids AS (
  SELECT unnest(ARRAY['VENUE_ID_1', 'VENUE_ID_2']::uuid[]) AS id
)
SELECT
  v.id,
  v.name,
  v.created_at,
  COALESCE(e.event_count, 0) AS events_count,
  COALESCE(ga.album_count, 0) AS gallery_albums_count,
  COALESCE(gi.image_count, 0) AS gallery_images_count,
  COALESCE(mh.highlight_count, 0) AS monthly_highlights_count,
  COALESCE(e.event_count, 0) + COALESCE(ga.album_count, 0) +
    COALESCE(gi.image_count, 0) + COALESCE(mh.highlight_count, 0) AS total_refs
FROM venues v
JOIN venue_ids vi ON v.id = vi.id
LEFT JOIN (
  SELECT venue_id, COUNT(*) AS event_count
  FROM events
  WHERE venue_id IS NOT NULL
  GROUP BY venue_id
) e ON v.id = e.venue_id
LEFT JOIN (
  SELECT venue_id, COUNT(*) AS album_count
  FROM gallery_albums
  WHERE venue_id IS NOT NULL
  GROUP BY venue_id
) ga ON v.id = ga.venue_id
LEFT JOIN (
  SELECT venue_id, COUNT(*) AS image_count
  FROM gallery_images
  WHERE venue_id IS NOT NULL
  GROUP BY venue_id
) gi ON v.id = gi.venue_id
LEFT JOIN (
  SELECT venue_id, COUNT(*) AS highlight_count
  FROM monthly_highlights
  WHERE venue_id IS NOT NULL
  GROUP BY venue_id
) mh ON v.id = mh.venue_id
ORDER BY v.created_at ASC;
```

**Output:** Reference counts per venue. Use this to decide which venue to keep (canonical) and which to merge away.

**Canonical Selection Criteria:**
1. Venue with more references (happenings)
2. If tied, older venue (earliest `created_at`)
3. If tied, venue with more complete data (has google_maps_url, website_url, etc.)

---

## 4. Merge Procedure (UPDATE then DELETE)

Once you've identified:
- `CANONICAL_ID` — The venue to KEEP
- `DUPLICATE_ID` — The venue to REMOVE

Run these scripts **in order**:

### Step 4a: Repoint all references from duplicate to canonical

```sql
-- APPLY: Update events to point to canonical venue
UPDATE events
SET venue_id = 'CANONICAL_ID'
WHERE venue_id = 'DUPLICATE_ID';

-- APPLY: Update gallery_albums to point to canonical venue
UPDATE gallery_albums
SET venue_id = 'CANONICAL_ID'
WHERE venue_id = 'DUPLICATE_ID';

-- APPLY: Update gallery_images to point to canonical venue
UPDATE gallery_images
SET venue_id = 'CANONICAL_ID'
WHERE venue_id = 'DUPLICATE_ID';

-- APPLY: Update monthly_highlights to point to canonical venue
UPDATE monthly_highlights
SET venue_id = 'CANONICAL_ID'
WHERE venue_id = 'DUPLICATE_ID';
```

### Step 4b: Verify no references remain

```sql
-- VERIFY: Confirm duplicate has 0 references before deleting
SELECT
  (SELECT COUNT(*) FROM events WHERE venue_id = 'DUPLICATE_ID') AS events_remaining,
  (SELECT COUNT(*) FROM gallery_albums WHERE venue_id = 'DUPLICATE_ID') AS albums_remaining,
  (SELECT COUNT(*) FROM gallery_images WHERE venue_id = 'DUPLICATE_ID') AS images_remaining,
  (SELECT COUNT(*) FROM monthly_highlights WHERE venue_id = 'DUPLICATE_ID') AS highlights_remaining;

-- Expected output: 0, 0, 0, 0
```

### Step 4c: Delete the duplicate venue

```sql
-- APPLY: Delete the duplicate venue (only after verify shows 0s)
DELETE FROM venues WHERE id = 'DUPLICATE_ID';
```

---

## 5. Known Duplicate Examples

These are examples of potential duplicates to investigate (not confirmed):

| Venue Name | Notes |
|------------|-------|
| Brewery Rickoli | May have duplicate entries with same address |
| Second Dawn Brewing | May have duplicate entries with same address |

Run Step 2 query to get actual IDs and confirm duplication.

---

## 6. Warnings

1. **Always dry-run first** — Run the SELECT queries to understand what will change before any UPDATE/DELETE.

2. **SET NULL on delete** — If you skip Step 4a and directly delete a venue, all referencing rows will have their `venue_id` set to NULL. This is recoverable but creates orphaned data.

3. **No undo** — These operations modify production data. Consider taking a database backup or snapshot before executing.

4. **One pair at a time** — Process duplicate pairs individually rather than batching to reduce risk of mistakes.

5. **Verify after merge** — After merging, check the canonical venue's `happenings_count` in the admin panel to confirm references were preserved.

---

## 7. Post-Merge Checklist

After merging duplicates:

- [ ] Verify canonical venue exists and has expected data
- [ ] Verify happenings count matches expected total
- [ ] Verify public venue page (`/venues/{id}`) loads correctly
- [ ] Verify events at venue still display correctly on `/happenings`
- [ ] Update any external references (if venue ID was shared externally)

---

## 8. Merge Audit Log

### 2026-01-11: Pair #1 — Brewery Rickoli

| Field | Value |
|-------|-------|
| Canonical ID | `0a507605-99bc-446e-87be-ae90ffd9f0fa` |
| Duplicate ID | `3efbadc5-f505-436d-8797-fc435a8d9632` |
| Events Moved | 1 (dup) → canonical (now 2 total) |
| Other FKs | 0 gallery_albums, 0 gallery_images, 0 monthly_highlights |
| SQL Pattern | BEGIN → UPDATE events/gallery_albums/gallery_images/monthly_highlights → DELETE dup → COMMIT |
| Verification | ✅ Canonical=2 events, Dup=0, Dup row deleted |

### 2026-01-11: Pair #2 — Second Dawn Brewing

| Field | Value |
|-------|-------|
| Canonical ID | `e64e1f40-f792-4195-8723-eac0bff47ed9` |
| Duplicate ID | `ec3e1bd4-b83f-427e-ad49-b0c1ff8da3d2` |
| Events Moved | 1 (dup) → canonical (now 3 total) |
| Other FKs | 0 gallery_albums, 0 gallery_images, 0 monthly_highlights |
| SQL Pattern | BEGIN → UPDATE events/gallery_albums/gallery_images/monthly_highlights → DELETE dup → COMMIT |
| Verification | ✅ Canonical=3 events, Dup=0, Dup row deleted |

---

**END OF DOCUMENT**

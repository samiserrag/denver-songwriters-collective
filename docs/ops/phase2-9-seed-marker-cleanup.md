# Phase 2.9 — Seed Marker DB Cleanup

**Date:** 2025-12-27 10:33 MST
**Branch:** `phase2-9-correctness-fixes`

## Summary

Removed internal `[DSC-SEED-P2-2]` markers from production event data that were inadvertently left visible to users.

## Query Used

```sql
UPDATE events
SET
  title = TRIM(REPLACE(title, '[DSC-SEED-P2-2]', '')),
  description = TRIM(REPLACE(REPLACE(description, 'Seed event for Phase 2.2 validation. [DSC-SEED-P2-2]', ''), 'Seed event for Phase 2.2 validation.', ''))
WHERE title LIKE '%DSC-SEED%' OR description LIKE '%DSC-SEED%';
```

## Results

| Metric | Value |
|--------|-------|
| Rows before | 3 |
| Rows after | 0 |
| Fields cleaned | `events.title`, `events.description` |

### Events Cleaned

| ID | Title (cleaned) |
|----|-----------------|
| `852913a0-1598-4407-a949-3cabcfd692da` | DSC Monthly Songwriter Showcase |
| `87385473-52e2-4859-b29c-5b52de16ae72` | Songwriting Workshop: Craft Your Chorus |
| `41807ee4-3421-4c3d-9104-9991d1805d67` | DSC Special Night: Acoustic Sessions |

## Repo Source Check

No repo source matches for `DSC-SEED` in `web/src/`: **0 matches**

## Note

The seed SQL script `docs/ops/phase2-seed-dsc-events.sql` was intentionally kept unchanged as an internal historical artifact documenting the original Phase 2.2 seeding process.

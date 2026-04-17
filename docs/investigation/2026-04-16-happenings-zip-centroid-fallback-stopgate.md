# Happenings ZIP Centroid Fallback Stop-Gate (2026-04-16)

## Scope

Fix `/happenings` ZIP radius filtering when the selected ZIP has no exact venue rows.

## Problem

Current location filtering requires exact venue ZIP matches to compute a centroid. If `exactMatchVenues.length === 0`, it returns `emptyReason: "no_venues"` and the page shows no events.

## Evidence

- `web/src/lib/happenings/locationFilter.ts:234` returns empty when exact ZIP/city matches are zero.
- `web/src/app/happenings/page.tsx:478` empties filtered groups whenever `emptyReason` is set.
- `web/src/app/happenings/page.tsx:661` shows generic "No venues found for ZIP ..." copy.
- Existing geocoding integration is already present in `web/src/lib/venue/geocoding.ts`.

## Approved Plan

1. Keep digest parity as a follow-up (out of scope in this change).
2. Add ZIP-only fallback:
   - validate US ZIP format
   - geocode ZIP centroid when exact ZIP matches are zero
   - continue with nearby radius expansion from geocoded centroid
3. Add in-memory ZIP centroid cache to reduce repeated API calls.
4. Add precise empty reasons (`invalid_zip`, `zip_lookup_failed`) and surface them in `/happenings` empty-state copy.
5. Add tests for fallback behaviors.

## Risk/Coupling Notes

- Coupling: `/happenings` location filter + UI empty-state messaging.
- Digest path intentionally unchanged in this tract.
- No schema migration in this implementation.

## Rollback

Revert these files:
- `web/src/lib/happenings/locationFilter.ts`
- `web/src/app/happenings/page.tsx`
- `web/src/__tests__/phase1-4-location-filter.test.ts`

## Verification

- Targeted eslint on changed files: PASS.
- Targeted vitest execution in sandbox: BLOCKED by filesystem EPERM creating vitest temp client directory.

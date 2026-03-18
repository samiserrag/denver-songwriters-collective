# 2026-03-18: Happenings Date Filter + Map Parity + Responsive Filters

## Scope

- Replace the old preset dropdown date jump control with direct controls:
  - `Today`
  - `Tomorrow`
  - `Jump to date`
- Make date selection a real URL filter (`date=YYYY-MM-DD`) so it applies to all three browse surfaces:
  - timeline
  - series
  - map
- Improve mobile and laptop filter usability for `/happenings`.

## Files changed

- `web/src/components/happenings/DateJumpControl.tsx`
- `web/src/components/happenings/StickyControls.tsx`
- `web/src/components/happenings/HappeningsFilters.tsx`
- `web/src/app/happenings/page.tsx`

## Behavior changes

1. Date filter now writes and reads `date=YYYY-MM-DD` in URL.
2. Map view now filters markers and counts by selected date.
3. Series view now filters to events that have an occurrence on selected date.
4. Timeline view keeps date section behavior, now aligned with URL date filter.
5. Unknown-schedule events are excluded when a specific date is selected.
6. Filters UI is responsive:
   - Quick filters are horizontal-scroll chips on mobile, wrapping cards on larger screens.
   - Location controls are grouped in a dedicated responsive card.
   - Advanced filters collapse cleanly and stack correctly on smaller screens.
   - Date controls are presented in a dedicated card with larger touch targets and explicit active-state label.
7. Map-mode summary now reports map-visible counts (not timeline totals), with explicit excluded count:
   - Example: `24 happenings shown on map across 24 venues · 4 not mappable`.

## Risk and coupling notes

- Primary coupling is in `/happenings` filtering pipeline:
  - occurrence expansion/grouping
  - location filtering
  - view-specific rendering paths
- Date filtering is applied before map pin generation to preserve map/timeline parity.
- Series parity uses derived `dateFilteredEventIds` from grouped occurrences to avoid divergent rules.

## Verification evidence

### Static checks

```bash
cd web
npx eslint src/components/happenings/DateJumpControl.tsx src/components/happenings/StickyControls.tsx src/components/happenings/HappeningsFilters.tsx src/app/happenings/page.tsx
npm test -- src/__tests__/phase1-0-map-view.test.ts
```

Outcome:

- ESLint: pass
- Map view tests: pass (`40/40`)

### Browser checks (Playwright, localhost)

Validated URL + behavior:

1. `http://localhost:3000/happenings?view=map`
2. Click `Today` -> `?view=map&date=2026-03-18`
3. Click `Tomorrow` -> `?view=map&date=2026-03-19`
4. Use date input + `Apply` -> `?view=map&date=2026-03-22`
5. Confirm map venue/happening counts changed with each date.
6. Switch views:
   - timeline retains `date=...`
   - series retains `date=...` and only shows series matching that date
7. Confirm map summary matches map-visible counts and no longer conflicts with pin stats.

## Follow-up

- Add/expand integration tests for `date` query-param behavior across timeline/series/map to prevent regressions in future filter refactors.

## Production data remediation (2026-03-18)

Issue observed in production after UI fixes:

- Date-filtered map view showed summary totals (e.g. `28 happenings across 1 date`) that did not match map pin totals (`24 venues with 24 happenings`).

Root cause:

- 5 published/public `location_mode='venue'` events had no `venue_id` and no custom coordinates, so they were excluded from map pins.

Remediation applied directly in production DB:

1. Created/finalized venue records and linked affected events:
   - `Bizarre Electronics Lounge` (`506 11th Ave, Longmont, CO 80501`)
   - `Couched Studios` (`9456 Cody Drive, Broomfield, CO 80021`)
   - `Jamestown Mercantile` (`108 Main St, Jamestown, CO 80455`)
   - `The Rusty Bucket Bar and Grill` (`3355 S Wadsworth Blvd Unit G101, Lakewood, CO 80227`)
   - `Vision Quest Brewery` (`2510 47th St Unit A2, Boulder, CO 80301`)
2. Added coordinates for all but Couched Studios (Broomfield centroid fallback applies until exact coordinates are confirmed).
3. Updated the 5 event rows to set `events.venue_id`.

Post-fix dataset audit:

```sql
with discovery as (
  select id, location_mode, venue_id, custom_latitude, custom_longitude
  from public.events
  where is_published = true
    and visibility = 'public'
    and status in ('active', 'needs_verification')
)
select
  count(*) as total_discovery_events,
  count(*) filter (where location_mode = 'online') as online_only,
  count(*) filter (
    where location_mode <> 'online'
      and venue_id is null
      and (custom_latitude is null or custom_longitude is null)
  ) as strictly_unmappable_non_online
from discovery;
```

Outcome:

- `total_discovery_events = 155`
- `online_only = 0`
- `strictly_unmappable_non_online = 0`

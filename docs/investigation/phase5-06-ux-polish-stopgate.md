# Phase 5.06: UX Polish — City/State, Monthly Edit, Event Detail

> **STOP-GATE 2: Implementation Complete**
> **Status:** ✅ Implementation Complete
> **Date:** 2026-01-28

---

## Problem Statements

### Goal A: City/State Not Showing on Happenings Cards

**User Report:** City/state information is NOT appearing after venue names on timeline cards (HappeningCard) or series view cards (SeriesCard) in production.

### Goal B: Monthly Series Day-of-Week Edit Missing

**User Report:** Cannot change day of week (e.g., Thursday → Wednesday) when editing a monthly recurring event series from the dashboard.

### Goal C: Event Detail Page UX Tweaks

**User Report:** Minor UX improvements needed:
1. "Get Directions" button behavior inconsistent with venue pages
2. RSVP button size appropriate? (confirm current state)
3. Any other layout polish opportunities

---

## GOAL A: City/State Not Showing — ROOT CAUSE FOUND

### Root Cause Analysis

**Property Name Mismatch Between Query and Components**

The Supabase query in `happenings/page.tsx` returns venue data under `venues` (plural), but all rendering components expect `venue` (singular).

**Query (line 140 of happenings/page.tsx):**
```typescript
venues!left(id, slug, name, address, city, state, google_maps_url, website_url)
```

This PostgREST syntax returns the joined data as `event.venues`, NOT `event.venue`.

**Components expect (HappeningCard.tsx lines 277-294, SeriesCard.tsx lines 89-102):**
```typescript
function getVenueCityState(event: HappeningEvent): string | null {
  if (event.venue && typeof event.venue === "object") {
    const city = event.venue.city;
    const state = event.venue.state;
    // ...
  }
  return null;
}
```

The function checks `event.venue` but the data is actually at `event.venues`. Since `event.venue` is undefined, the function always returns `null`.

**Evidence:**
- Line 261 of happenings/page.tsx casts to `any[]`: `let list = (events || []) as any[];`
- This cast hides the type mismatch from TypeScript
- The query DOES include city/state fields — they're just at the wrong property path

### Entry Points Affected

| Surface | File | Issue |
|---------|------|-------|
| Timeline View | `HappeningCard.tsx` | Checks `event.venue.city`, data is at `event.venues.city` |
| Series View | `SeriesCard.tsx` | Same issue — checks `event.venue.city` |
| Override venue map | `HappeningsCard.tsx` | Missing city/state in `overrideVenueData` type |

### Proposed Fix: Rename in Query or Transform Data

**Option A (Recommended): Alias in Query**

Change the PostgREST query to use an alias:
```typescript
// Before
venues!left(id, slug, name, address, city, state, google_maps_url, website_url)

// After (using PostgREST rename syntax)
venue:venues!left(id, slug, name, address, city, state, google_maps_url, website_url)
```

This renames the result from `venues` to `venue`, matching what components expect.

**Option B: Transform After Query**

Map `event.venues` to `event.venue` after the query returns:
```typescript
const events = (data || []).map(e => ({
  ...e,
  venue: e.venues, // Rename to match expected shape
}));
```

**Recommendation:** Option A (alias in query) is cleaner — single-point fix, no data transformation.

### Files to Modify

| File | Change |
|------|--------|
| `app/happenings/page.tsx` | Change `venues!left(...)` to `venue:venues!left(...)` |
| `components/happenings/HappeningsCard.tsx` | Add `city` and `state` to `overrideVenueData` type |

### Impact Assessment

- **Database:** No changes needed
- **Risk:** Low — PostgREST alias is standard syntax
- **Rollback:** Revert the alias if issues arise

---

## GOAL B: Monthly Day-of-Week Edit — CONFIRMED FROM PHASE 5.05

### Root Cause Analysis

**Edit Mode Missing Date Picker for Monthly Series**

This issue was fully investigated in `phase5-05-monthly-day-of-week-edit-stopgate.md`. The findings are confirmed:

**Create mode has (lines 1390-1454 of EventForm.tsx):**
- "First Event Date" field that derives `day_of_week` via `weekdayNameFromDateMT()`

**Edit mode lacks (lines 940-1146 of EventForm.tsx):**
- Ordinal checkboxes (1st, 2nd, 3rd, 4th, Last) ✅ EXISTS
- Pattern summary ✅ EXISTS
- Series Length ✅ EXISTS
- First Event Date field ❌ MISSING
- Any way to change `day_of_week` ❌ MISSING

The Day of Week dropdown (line 876) explicitly excludes monthly mode:
```typescript
{!occurrenceMode && ((mode === "edit" && formData.series_mode === "weekly") ||
                     (mode === "create" && formData.series_mode === "weekly")) && (
  // Day of Week dropdown only for WEEKLY mode
)}
```

### Proposed Fix (from Phase 5.05)

Add "First Event Date" field to edit mode for monthly series:
1. Location: Between ordinal checkboxes and series length in edit mode monthly section
2. Initialization: `event.event_date` (the anchor date)
3. Behavior: When date changes, derive new `day_of_week` via `weekdayNameFromDateMT()`
4. Warning: Show amber banner: "Changing the anchor date will shift all future occurrences to {new_day}"

### Files to Modify

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Add date picker to monthly edit section (~lines 940-1004) |

### Impact Assessment

- **Database:** No changes needed (`day_of_week` column already exists)
- **Risk:** Low — same pattern as create mode, just needs to be added to edit mode
- **Rollback:** Remove the date picker field

---

## GOAL C: Event Detail Page UX Tweaks

### Finding 1: "Get Directions" Button Uses Wrong URL Function

**Current State:**
- Event detail page uses `getGoogleMapsUrl()` which returns a SEARCH or PLACE PAGE URL
- Venue detail page uses `getVenueDirectionsUrl()` which returns a DIRECTIONS URL (`/maps/dir/`)

**Expected State (per Phase 4.65 in CLAUDE.md):**
- "Get Directions" should always open Google Maps in DIRECTIONS mode
- Venue name link should go to the place page (reviews, hours, photos)

**Evidence:**
- `app/events/[id]/page.tsx` line 694: `const mapsUrl = getGoogleMapsUrl(...)`
- `app/venues/[id]/page.tsx`: Uses `getVenueDirectionsUrl()` from `lib/venue/getDirectionsUrl.ts`
- The helper exists but event detail page doesn't use it

**Proposed Fix:**
Import and use `getVenueDirectionsUrl()` for the "Get Directions" button:
```typescript
import { getVenueDirectionsUrl } from "@/lib/venue/getDirectionsUrl";

// For "Get Directions" button:
const directionsUrl = getVenueDirectionsUrl({
  name: venueName,
  address: venueAddress,
  city: venueCity,
  state: venueState,
});
```

### Finding 2: RSVP Button Size — Already Appropriate

**Current State:**
- Guest RSVP button: `px-6 py-3 font-semibold rounded-xl` (line 466)
- Member RSVP button: `px-6 py-3 font-semibold rounded-xl` (line 509)
- Both buttons are consistent and appropriately sized for touch targets

**Conclusion:** No change needed.

### Finding 3: No "View on Maps" Button

**Current State:**
- Event detail page has only ONE maps-related button: "Get Directions"
- There is no separate "View on Maps" button to see the place page

**Potential Enhancement:**
If the venue has a `google_maps_url`, could show two buttons:
1. "Get Directions" → `getVenueDirectionsUrl()` (directions mode)
2. "View on Maps" → `google_maps_url` (place page with reviews, hours)

This matches the pattern established in Phase 4.65 for venue pages.

**Proposed Fix (Optional):**
Add "View on Maps" button when `venueGoogleMapsUrl` is available:
```typescript
{venueGoogleMapsUrl && venueGoogleMapsUrl !== directionsUrl && (
  <a href={venueGoogleMapsUrl} target="_blank" rel="noopener noreferrer">
    View on Maps
  </a>
)}
{directionsUrl && (
  <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
    Get Directions
  </a>
)}
```

### Files to Modify

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | Import `getVenueDirectionsUrl`, use for "Get Directions" button |
| `app/events/[id]/page.tsx` | (Optional) Add "View on Maps" button when `google_maps_url` available |

### Impact Assessment

- **Database:** No changes needed
- **Risk:** Low — existing helper function, pattern established on venue pages
- **Rollback:** Revert to using `getGoogleMapsUrl()` if issues arise

---

## Summary of Proposed Changes

| Goal | Fix | Files | Risk |
|------|-----|-------|------|
| A | PostgREST alias `venue:venues!left(...)` | happenings/page.tsx | Low |
| A | Add city/state to overrideVenueData type | HappeningsCard.tsx | Low |
| B | Add date picker to monthly edit mode | EventForm.tsx | Low |
| C1 | Use `getVenueDirectionsUrl()` for directions button | events/[id]/page.tsx | Low |
| C2 | (Optional) Add "View on Maps" button | events/[id]/page.tsx | Low |

---

## Test Coverage Needed

| Test | Description |
|------|-------------|
| City/state renders on timeline cards | HappeningCard shows "Denver, CO" after venue name |
| City/state renders on series cards | SeriesCard shows "Denver, CO" after venue name |
| Monthly edit shows date picker | Edit mode for monthly series shows First Event Date field |
| Date change updates day_of_week | Changing date in edit mode updates `formData.day_of_week` |
| Get Directions uses directions URL | Button href is `/maps/dir/` format, not search format |
| View on Maps shows place page | (If implemented) Button href uses `google_maps_url` |

---

## Checked Against DSC UX Principles

- **§2 (Visibility):** City/state improves event discoverability
- **§7 (UX Friction):** Monthly edit missing day change is friction; fix removes it
- **§8 (Dead States):** Current monthly edit is a dead-end for day changes; fix provides escape
- **§14 (Confusing = Wrong):** Two maps buttons doing the same thing is confusing; differentiate them

---

## STOP-GATE 2: Implementation Plan Preview

Pending approval, the implementation will:

### Goal A (City/State):
1. Change PostgREST query alias from `venues!left` to `venue:venues!left`
2. Update `overrideVenueData` type to include `city` and `state`
3. Add tests for city/state rendering

### Goal B (Monthly Day-of-Week):
1. Add "First Event Date" field to edit mode monthly section
2. Initialize with `event.event_date`
3. On change, derive `day_of_week` via `weekdayNameFromDateMT()`
4. Show warning banner when derived day differs from current day
5. Add tests for the new behavior

### Goal C (Event Detail UX):
1. Import `getVenueDirectionsUrl` from `lib/venue/getDirectionsUrl`
2. Use for "Get Directions" button
3. (Optional) Add "View on Maps" button when `google_maps_url` available
4. Add tests for URL behavior

---

---

## STOP-GATE 1.5: Red-Team Critique

### Goal A Risks

| Risk | Mitigation |
|------|------------|
| PostgREST alias syntax may vary by version | Verified: Supabase uses PostgREST 11+ which supports `alias:table!hint(columns)` syntax |
| Other pages may query venues differently | Audit shows happenings/page.tsx is the main listing query; other pages (venue detail, event detail) have separate queries that already work |
| Cast to `any[]` hides other type issues | After fix, consider removing the cast to let TypeScript catch mismatches |

**Confidence:** High — PostgREST alias is well-documented, single-point fix.

### Goal B Risks

| Risk | Mitigation |
|------|------------|
| Changing day shifts all RSVPs/overrides to orphaned dates | Warning banner explicitly tells user; past data preserved (not deleted) |
| User accidentally changes day without realizing | Date picker shows current day_of_week; change requires explicit action |
| Server-side canonicalization may interfere | Canonicalization only derives day_of_week when NULL; explicit value takes precedence |
| `event_date` update may trigger unintended side effects | `event_date` is the anchor; changing it only affects future occurrence expansion |

**Confidence:** Medium-High — Same pattern as create mode; need warning banner for safety.

### Goal C Risks

| Risk | Mitigation |
|------|------------|
| `getVenueDirectionsUrl` may return null for some events | Button already conditionally renders when URL exists; same pattern |
| Two maps buttons may confuse users | Clear labels: "Get Directions" (action) vs "View on Maps" (info) |
| Custom locations (no venue_id) have no google_maps_url | Directions button falls back to lat/lng or address; View on Maps only shows when URL exists |

**Confidence:** High — Existing helper, pattern proven on venue pages.

### Cross-Cutting Risks

| Risk | Mitigation |
|------|------------|
| Changes to happenings query may break other surfaces | SeriesView, DateSection, and filters all consume the same events array; type fix benefits all |
| Test coverage may miss edge cases | Add specific tests for: venue with no city, venue with city but no state, custom locations |

### Edge Cases to Test

1. **City/State:** Venue with only city (no state) — should show "Denver" not "Denver, "
2. **City/State:** Custom location (no venue_id) — should show nothing or custom_city
3. **Monthly Edit:** Event with NULL day_of_week in DB — form should derive from event_date
4. **Monthly Edit:** Switching from weekly to monthly — should preserve or derive day_of_week
5. **Directions:** Event with no venue (online-only) — no button should render
6. **Directions:** Event with venue but no address — should fall back to name-only search

---

## Implementation Complete

| Item | Status |
|------|--------|
| Goal A root cause identified | ✅ Property name mismatch (venues vs venue) |
| Goal B root cause confirmed | ✅ Edit mode missing date picker (from Phase 5.05) |
| Goal C findings documented | ✅ Wrong URL function, optional second button |
| Fix proposed | ✅ All three goals |
| Red-team critique | ✅ Risks assessed, mitigations identified |
| **Implementation** | ✅ **Complete** |
| **Tests** | ✅ **26 new tests passing (2908 total)** |

---

## STOP-GATE 2: Implementation Summary

### Goal A (City/State) — Implemented

**Files Modified:**

| File | Change |
|------|--------|
| `app/happenings/page.tsx` | Changed PostgREST query from `venues!left(...)` to `venue:venues!left(...)` |
| `components/happenings/HappeningsCard.tsx` | Added `city` and `state` to `overrideVenueData` type |

**Decision:** Kept `as any[]` casts with explanatory comments. Removing them would require cascading type definitions for the joined result shape.

### Goal C (Directions URL) — Implemented

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | Imported `getVenueDirectionsUrl`, added `venueCity`/`venueState` tracking, created `directionsUrl` and `viewOnMapsUrl` |

**Changes:**
- "Get Directions" button now uses `getVenueDirectionsUrl()` (directions mode `/maps/dir/`)
- "View on Maps" button uses `venueGoogleMapsUrl` when available (place page)
- Removed unused `getGoogleMapsUrl` function and `isValidHttpUrl` helper
- Custom locations use lat/lng when available, otherwise address-based fallback

### Goal B (Monthly Edit Date Picker) — Implemented

**Files Modified:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Added `originalDayOfWeek` tracking, date picker field, persistent warning banner |

**Features:**
- "Anchor Date (First Event)" field in edit mode monthly section
- Shows derived weekday via `DateDayIndicator`
- Persistent amber warning banner when `day_of_week` changes: "This series will move to {day}s"
- Warning explains impact on future occurrences

### Test Coverage

**New test file:** `__tests__/phase5-06-ux-polish.test.ts` (26 tests)

| Category | Tests |
|----------|-------|
| Goal A: City/State | 8 tests (city only, state only, null venue, override precedence) |
| Goal B: Day derivation | 8 tests (null db value, warning detection, day derivation accuracy) |
| Goal C: Directions URL | 8 tests (online-only, no venue, full info, partial info, lat/lng) |
| PostgREST alias contract | 1 test |
| Override venue propagation | 1 test |

---

## Smoke Checklist (5 clicks)

### Goal A: City/State
1. Visit `/happenings`
2. Verify venue cards show "Denver, CO" (or city name) after venue name
3. Switch to Series view — verify city/state appears on series cards

### Goal B: Monthly Edit
1. Navigate to `/dashboard/my-events/[monthly-series-id]`
2. Scroll to "Anchor Date" field
3. Change date to a different weekday
4. Verify amber warning: "This series will move to {day}s"
5. Verify `DateDayIndicator` shows derived weekday

### Goal C: Directions URL
1. Visit any event detail page (e.g., `/events/words-open-mic`)
2. Click "Get Directions" button
3. Verify Google Maps opens in **directions mode** (shows route, not search results)
4. If venue has `google_maps_url`, verify "View on Maps" button goes to place page

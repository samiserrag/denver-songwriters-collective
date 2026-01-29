# Phase 5.04: Event Clarity & Host Confidence

> **STOP-GATE 1: Investigation Report**
> **Status:** Complete — Awaiting approval before STOP-GATE 2
> **Date:** 2026-01-28

---

## Scope Summary

This phase addresses three UX clarity items:

| Item | Description | Execution Order |
|------|-------------|-----------------|
| **C** | Venue Google Maps link + "Get Directions" per occurrence | 1st |
| **B** | Restore "Signup time" field on create/edit forms | 2nd |
| **A** | City always visible on timeline cards + series rows | 3rd |

**Hard rules:**
- No migrations in this phase
- Add tests for each fix
- Follow STOP-GATE workflow

---

## Item C: Per-Occurrence Venue Resolution (Google Maps + Directions)

### Current State

**Finding:** Event detail page ALREADY implements per-occurrence venue resolution with Google Maps support.

**Evidence from `app/events/[id]/page.tsx`:**

1. **Per-occurrence venue override resolution** (lines 503-517):
   ```typescript
   if (overrideVenueId && overrideVenueId !== event.venue_id) {
     const { data: overrideVenue } = await supabase
       .from("venues")
       .select("name, address, city, state, google_maps_url, website_url, slug")
       .eq("id", overrideVenueId)
       .single();
     if (overrideVenue) {
       locationName = overrideVenue.name;
       // ... address assembly ...
       venueGoogleMapsUrl = overrideVenue.google_maps_url;
       venueWebsiteUrl = overrideVenue.website_url;
       venueSlug = overrideVenue.slug;
     }
   }
   ```

2. **`getGoogleMapsUrl` helper** (lines 153-181): Generates directions URL with priority order:
   - venue.google_maps_url (if valid HTTP URL)
   - lat/lng coordinates
   - venue name + address search
   - address-only search
   - name-only search

3. **"Get Directions" button** (lines 1284-1297): Already rendered with per-occurrence venue data

4. **"View on Maps" link** (via VenueLink component, line 1074): Uses `venueGoogleMapsUrl`

### Conclusion for Item C

**No changes needed.** The event detail page already:
- Resolves venue per occurrence via `override_patch.venue_id`
- Fetches override venue's `google_maps_url`, `website_url`, and address
- Displays "Get Directions" button with correct URL
- Uses VenueLink component for "View on Maps"

**Checked against DSC UX Principles:** §6 (Anchored Navigation) — occurrence-scoped venue data flows correctly.

---

## Item B: Restore "Signup time" Field

### Current State

**Finding:** `signup_time` field exists in database but is MISSING from the main EventForm.

**Database Schema (`database.types.ts` line 1151):**
```typescript
signup_time: string | null
```
The field exists in the `events` table.

**Legacy Admin Form (`EventEditForm.tsx` line 24, 70):**
```typescript
signup_time?: string;  // In interface
signup_time: event.signup_time || "",  // In form state
```
The legacy admin edit form includes this field.

**Main EventForm (`EventForm.tsx` lines 96-141):**
- `signup_time` is **NOT** in the event interface
- No input field for signup time exists
- Field was never ported from legacy form

**Occurrence Override Support (`nextOccurrence.ts` line 916-944):**
```typescript
export const ALLOWED_OVERRIDE_FIELDS = new Set([
  // ... other fields ...
  "signup_url",
  "signup_deadline",
  // NOTE: signup_time is NOT in this list
]);
```

### Display Locations

**HappeningCard (`HappeningCard.tsx` lines 54, 407, 825):**
```typescript
signup_time?: string;  // In interface
const formattedSignupTime = ...; // Formatting logic
// Rendered as "Sign-up: {time}" chip
```
The card already displays signup_time when present.

### Gaps Identified

| Gap | Location | Action Required |
|-----|----------|-----------------|
| Missing from EventForm interface | `EventForm.tsx` line 96 | Add `signup_time` to event interface |
| No form field | `EventForm.tsx` | Add time picker input |
| Not in API allowed fields | `api/my-events/[id]/route.ts` | Add to allowedFields |
| Not in create payload | `api/my-events/route.ts` | Add to insert builder |
| Not in override_patch fields | `nextOccurrence.ts` ALLOWED_OVERRIDE_FIELDS | **Decision needed** |

### Decision Point: Per-Occurrence Override?

**Current schema allows it** via `override_patch: Json` column, but `signup_time` is NOT in `ALLOWED_OVERRIDE_FIELDS`.

**Options:**
1. **Series-level only** (simpler): Add to EventForm, don't add to override fields
2. **Per-occurrence** (flexible): Add to EventForm AND ALLOWED_OVERRIDE_FIELDS

**Recommendation:** Option 1 (series-level only) for Phase 5.04. Per-occurrence signup_time can be added later if needed.

---

## Item A: City Always Visible on Timeline Cards + Series Rows

### Current State

**HappeningCard (`HappeningCard.tsx`):**

Interface includes city/state (lines 63-72):
```typescript
venue?: {
  id?: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  google_maps_url?: string | null;
  website_url?: string | null;
} | string | null;
```

Meta line rendering (lines 778-799):
```typescript
{displayVenueName || displayAddress ? (
  <span className="flex items-center gap-1 truncate">
    <MapPinIcon className="w-4 h-4 flex-shrink-0 opacity-70" />
    <span className="truncate">{displayVenueName || displayAddress}</span>
  </span>
) : null}
```

**Gap:** City/state is in the interface but NOT rendered in the meta line.

**SeriesCard (`SeriesCard.tsx`):**

Interface (lines 57-64):
```typescript
venue?: {
  id?: string;
  slug?: string | null;
  name?: string | null;
  address?: string | null;
  google_maps_url?: string | null;
  website_url?: string | null;
} | null;
```

**Gap:** `city` and `state` are NOT in the SeriesCard venue interface.

Meta line rendering (lines 298-318):
```typescript
{venueName && (
  <span className="flex items-center gap-1 truncate">
    <MapPinIcon className="w-4 h-4 flex-shrink-0 opacity-70" />
    {venueId ? (
      <Link href={`/venues/${venueSlug || venueId}`} ...>
        {venueName}
      </Link>
    ) : (
      <span className="truncate">{venueName}</span>
    )}
  </span>
)}
```

**Gap:** Only venue name shown, no city/state.

### Data Source Check

**Happenings page query (`happenings/page.tsx`):**
Need to verify venue join includes city/state fields.

### Changes Required for Item A

| Component | Gap | Fix |
|-----------|-----|-----|
| HappeningCard | City not displayed | Append ", City, ST" after venue name |
| SeriesCard interface | Missing city/state | Add `city?: string | null; state?: string | null;` |
| SeriesCard rendering | City not displayed | Append ", City, ST" after venue name |
| Happenings page query | May need city/state in join | Verify join includes these fields |

### Format

Display format: `{Venue Name}, {City}, {ST}` or `{Venue Name}` (if no city)

If venue is missing entirely: Show `—` (en-dash)

---

## Summary of Findings

| Item | Status | Work Required |
|------|--------|---------------|
| C | **Already Implemented** | None — per-occurrence venue + maps links work |
| B | **Gaps Found** | Add signup_time to EventForm + API routes |
| A | **Gaps Found** | Add city/state display to HappeningCard + SeriesCard |

---

## Execution Order Confirmed

Based on findings:

1. **Item C** — No changes needed (verify in browser)
2. **Item B** — Add signup_time field to EventForm, API routes
3. **Item A** — Add city/state display to card components

---

## Files to Modify (STOP-GATE 2 Preview)

### Item B (Signup Time)

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Add signup_time to interface, add form field |
| `api/my-events/route.ts` | Add signup_time to insert payload |
| `api/my-events/[id]/route.ts` | Add signup_time to allowedFields |
| New test file | Test signup_time persistence + display |

### Item A (City Visibility)

| File | Change |
|------|--------|
| `components/happenings/HappeningCard.tsx` | Append city/state to meta line |
| `components/happenings/SeriesCard.tsx` | Add city/state to interface, append to meta line |
| `app/happenings/page.tsx` | Verify venue join includes city/state |
| New test file | Test city display logic |

---

## Risks & Coupling

| Risk | Mitigation |
|------|------------|
| SeriesCard interface change affects callers | Check all SeriesCard usage sites |
| City display may truncate on mobile | Use existing truncate pattern |
| Signup time not in occurrence overrides | Documented as series-level only for Phase 5.04 |

---

## STOP-GATE 2: Implementation Plan

> **Status:** Approved and executing
> **Date:** 2026-01-28

### Scope Confirmation

| Item | Action | Confirmed |
|------|--------|-----------|
| **C** | Verify only — no code changes unless broken | ✅ |
| **B** | Add signup_time to EventForm (series-level only) | ✅ |
| **A** | Add city/state display to HappeningCard + SeriesCard | ✅ |

**Decision confirmed:** `signup_time` is series-level only for Phase 5.04. Do NOT add to `ALLOWED_OVERRIDE_FIELDS`.

### Files to Modify

#### Item C (Verify Only)
- `app/events/[id]/page.tsx` — Verify per-occurrence venue resolution works (no changes expected)

#### Item B (Signup Time)

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Add `signup_time` to event interface + form field |
| `api/my-events/route.ts` | Add `signup_time` to insert payload |
| `api/my-events/[id]/route.ts` | Add `signup_time` to allowedFields |

#### Item A (City Visibility)

| File | Change |
|------|--------|
| `components/happenings/HappeningCard.tsx` | Append city/state to venue display in meta line |
| `components/happenings/SeriesCard.tsx` | Add city/state to venue interface + append to display |
| `app/happenings/page.tsx` | Verify venue join includes city/state fields |

### Tests to Add

| Test File | Coverage |
|-----------|----------|
| `__tests__/phase5-04-event-clarity.test.ts` | signup_time create/edit/clear + city formatting logic |

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| SeriesCard interface change affects callers | Check all SeriesCard usage sites for compatibility |
| City display may truncate on mobile | Use existing truncate pattern (already in place) |
| Happenings query may not include city/state | Verify join and add if missing |
| signup_time empty string vs null | Convert empty string to null in API |

---

## STOP-GATE 2: Execution Log

### Part C — Verification

**Status:** ✅ Verified — No changes needed

Per-occurrence venue resolution already works correctly in `app/events/[id]/page.tsx`:
- Lines 503-532: Fetches override venue when `override_patch.venue_id` differs from base
- Lines 694-700: Computes `mapsUrl` using resolved venue data
- Lines 1284-1297: "Get Directions" button uses resolved `mapsUrl`
- VenueLink component uses resolved `venueGoogleMapsUrl`

### Part B — Signup Time Implementation

**Status:** ✅ Complete

1. Added `signup_time` to EventForm event interface (line 119)
2. Added `signup_time` to form state initialization (line 199)
3. Added signup_time form field with TIME_OPTIONS dropdown (lines 2028-2044)
4. Added `signup_time` to create payload in EventForm (line 640)
5. Added `signup_time` to buildEventInsert in POST route (line 205)
6. Added `signup_time` to allowedFields in PATCH route (line 154)

### Part A — City Visibility Implementation

**Status:** ✅ Complete

1. **HappeningCard:**
   - Added `getVenueCityState()` helper function (lines 275-289)
   - Added `venueCityState` derived value (line 427)
   - Updated `overrideVenueData` interface to include city/state (lines 153-154)
   - Updated effectiveEvent venue object to include city/state from override (line 416)
   - Updated meta line to append city/state after venue name (lines 800-825)

2. **SeriesCard:**
   - Added `city` and `state` to venue interface (lines 63-64)
   - Added `getVenueCityState()` helper function (lines 89-100)
   - Added `venueCityState` derived value (line 209)
   - Updated venue display to append city/state (lines 319-336)

3. **Happenings Page:**
   - Updated overrideVenueMap type to include city/state (line 173)
   - Updated override venue query to select city/state (line 177)
   - Updated map population to include city/state (line 181)

---

## STOP-GATE 3: Final Report

> **Status:** Complete
> **Date:** 2026-01-28

### Files Modified

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Added signup_time to interface, form state, form field, create payload |
| `api/my-events/route.ts` | Added signup_time to buildEventInsert |
| `api/my-events/[id]/route.ts` | Added signup_time to allowedFields |
| `components/happenings/HappeningCard.tsx` | Added getVenueCityState helper, updated meta line, updated overrideVenueData interface |
| `components/happenings/SeriesCard.tsx` | Added city/state to venue interface, added getVenueCityState helper, updated venue display |
| `app/happenings/page.tsx` | Added city/state to overrideVenueMap type and query |

### Tests Added

| Test File | Tests |
|-----------|-------|
| `__tests__/phase5-04-event-clarity.test.ts` | 19 tests covering signup_time create/edit/clear + city formatting logic |

### Quality Gates

| Check | Result |
|-------|--------|
| Lint | ✅ 0 errors, 0 warnings |
| Tests | ✅ 2863 passing (19 new) |
| Build | ✅ Success |

### Checked Against DSC UX Principles

- **§6 (Anchored Navigation):** Per-occurrence venue data flows correctly
- **§8 (Dead States):** City always visible prevents blank location displays
- **§10 (Defaults):** signup_time defaults to empty (user must explicitly select)

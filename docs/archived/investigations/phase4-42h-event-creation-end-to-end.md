# Phase 4.42h Investigation Report: Event Creation End-to-End Verification

**Investigation Date:** January 2026
**Status:** Complete — Awaiting Sami approval for execution plan

---

## Executive Summary

This report is the final consolidated investigation of the event creation → listing → series management flow. It confirms findings from Phase 4.42f and 4.42g with additional code-level evidence and provides a definitive fix plan.

**5 Root Causes Confirmed:**

| # | Issue | Root Cause | Severity |
|---|-------|-----------|----------|
| 1 | "Imported" copy for new events | Copy at `events/[id]/page.tsx:540` hardcoded for imports | High |
| 2 | "Missing details" on complete events | `is_free=null` triggers banner at `missingDetails.ts:81` | Medium |
| 3 | Series panel disappears after creation | `SeriesEditingNotice` doesn't check `series_id` | Medium |
| 4 | Date shift (Monday → Sunday) | `generateSeriesDates()` uses `toISOString().split("T")[0]` | Critical |
| 5 | Silent form validation | HTML5 `required` without custom error feedback | Low |

---

## 1) Happenings Query and Filter Analysis

### Query Location

**File:** `app/happenings/page.tsx:78-85`

```typescript
let query = supabase
  .from("events")
  .select(`*, venues!left(name, address, city, state)`)
  .eq("is_published", true)
  .in("status", ["active", "needs_verification"]);
```

### Complete Filter Matrix

| Filter | Code Location | Effect |
|--------|---------------|--------|
| `is_published = true` | Line 84 | **Required** - Only published events shown |
| `status IN ("active", "needs_verification")` | Line 85 | **Required** - Excludes draft, cancelled |
| `event_type` | Lines 107-122 | Optional - open_mic, showcase, workshop, etc. |
| `is_dsc_event = true` | Line 126 | Optional - Only if `?dsc=1` param |
| `location_mode` | Lines 137-143 | Optional - venue/online/hybrid |
| `is_free` | Lines 146-152 | Optional - free/paid/unknown |
| `event_date < today` | Line 157 | Only for `?time=past` |

### Event Visibility Requirements

For a newly created event to appear on `/happenings`:

1. ✅ `is_published = true` (set when user toggles "Publish")
2. ✅ `status = "active"` (set when published via `eventStatus` variable)
3. ✅ `event_date` within 90-day window OR has computable recurrence
4. ❓ `last_verified_at` — **NOT a filter** (doesn't affect visibility)

### Conclusion

**Published community events SHOULD appear on Happenings.** The query does not filter by:
- `source` (community vs import)
- `last_verified_at` (verification status)
- `host_id` (owner)

If an event is not appearing, the issue is likely:
- `is_published = false` (still draft)
- `status = "draft"` (not activated)
- Date outside 90-day window
- Date shifted due to timezone bug

---

## 2) Verification + Copy Correctness

### Current Logic

**File:** `lib/events/verification.ts:44-72`

```typescript
export function getPublicVerificationState(event: VerificationInput): VerificationResult {
  // Rule 1: Cancelled events are always cancelled
  if (event.status === "cancelled") {
    return { state: "cancelled", reason: "Event has been cancelled" };
  }

  // Rule 2: Confirmed if last_verified_at is set
  if (event.last_verified_at !== null && event.last_verified_at !== undefined) {
    return { state: "confirmed", reason: "Verified by admin", ... };
  }

  // Rule 3: Everything else is unconfirmed (default state)
  return { state: "unconfirmed", reason: "Awaiting admin verification", ... };
}
```

### Problem: Misleading Banner Copy

**File:** `app/events/[id]/page.tsx:532-541`

```tsx
{isUnconfirmed && !isCancelled && (
  <div className="...bg-amber-100...">
    <span className="font-medium">Happening (not confirmed)</span>
    <span className="block text-sm mt-0.5">
      This event was imported from an external source and hasn't been verified yet.
    </span>
```

**Issue:** The banner says "imported from an external source" but appears for ALL events where `last_verified_at = null`, including:
- Brand new community-created events
- Events created by the user themselves
- Events that have never been "imported"

### Evidence: Event Creation Sets source = "community"

**File:** `app/api/my-events/route.ts:205`

```typescript
source: "community",
```

All user-created events get `source: "community"`, but the UI doesn't check this field.

### Recommended Fix

**Option B (recommended):** Check `source` field to show different copy

```typescript
// Proposed fix
{isUnconfirmed && !isCancelled && (
  event.source === "import" ? (
    <span>This event was imported and hasn't been verified yet.</span>
  ) : (
    <span>This event is awaiting admin verification.</span>
  )
)}
```

---

## 3) Missing Details Banner Logic

### Current Logic

**File:** `lib/events/missingDetails.ts:44-95`

```typescript
export function computeMissingDetails(event: MissingDetailsInput): MissingDetailsResult {
  const reasons: string[] = [];

  // Rule 1: Online events need online_url
  // Rule 2: Hybrid events need online_url + physical location
  // Rule 3: Venue events need proper location reference
  // Rule 4: DSC events need age_policy

  // Rule 5: Unknown cost (is_free is null) ← THIS IS THE PROBLEM
  if (event.is_free === null || event.is_free === undefined) {
    reasons.push("Cost information unknown");
  }

  // Rule 6: Orphan venue (has name but no proper reference)

  return { missing: reasons.length > 0, reasons };
}
```

### Problem: `is_free = null` Always Triggers Banner

**Form Default:**
```typescript
// EventForm.tsx:127
is_free: event?.is_free ?? null,  // null for new events
```

Since the form doesn't require `is_free`, and it defaults to `null`, EVERY new event that doesn't explicitly set cost info will show "Missing details" even if all required fields are complete.

### Impact Analysis

| Field | Required in Form? | Triggers "Missing"? | Contract Violation |
|-------|-------------------|---------------------|-------------------|
| `venue_id` | Yes (venue mode) | Yes if missing | ✅ Correct |
| `online_url` | Yes (online mode) | Yes if missing | ✅ Correct |
| `age_policy` | No (DSC only) | Yes if DSC + missing | ⚠️ Questionable |
| `is_free` | **No** | **Yes if null** | ❌ Violation |

### Recommended Fix

**Option A (simplest):** Remove `is_free` from missing details check

```typescript
// Remove lines 80-83 from missingDetails.ts
// if (event.is_free === null || event.is_free === undefined) {
//   reasons.push("Cost information unknown");
// }
```

**Option B (alternative):** Rename banner to "More details helpful" with softer styling

---

## 4) Series Edit UX Gap

### Current Series Detection in SeriesEditingNotice

**File:** `components/events/SeriesEditingNotice.tsx:40-43`

```typescript
const isRecurring =
  event.is_recurring ||
  event.recurrence_rule ||
  (event.day_of_week && !event.event_date);
```

### Problem: `series_id` Not Recognized

When creating a series via "Create Event Series" panel:
- API sets `series_id` on all events in the series
- API sets `event_date` on each event (the specific date)
- API does NOT set `is_recurring` or `recurrence_rule`

This means the check `(event.day_of_week && !event.event_date)` fails because `event_date` IS set.

### Evidence from API Route

**File:** `app/api/my-events/route.ts:191-194`

```typescript
// Series fields
event_date: eventDate,        // ← ALWAYS SET (breaks the check)
series_id: seriesId,          // ← SET for series, NOT CHECKED
series_index: seriesIndex,
```

### Series Awareness in Dashboard

**File:** `MyEventsFilteredList.tsx:297-301`

The dashboard DOES show a "Series" badge for events with `series_id`:

```typescript
{event.series_id && (
  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
    Series
  </span>
)}
```

But the edit page doesn't show other events in the series.

### Recommended Fix

**Step 1:** Add `series_id` to SeriesEditingNotice interface and check:

```typescript
interface SeriesEditingNoticeProps {
  event: {
    id: string;
    series_id?: string | null;  // ← ADD THIS
    recurrence_rule?: string | null;
    day_of_week?: string | null;
    event_date?: string | null;
    is_recurring?: boolean | null;
  };
}

const isRecurring =
  event.is_recurring ||
  event.recurrence_rule ||
  event.series_id ||  // ← ADD THIS CHECK
  (event.day_of_week && !event.event_date);
```

**Step 2:** Add "Other events in this series" section to edit page (optional enhancement)

---

## 5) Date Handling Contract Audit

### Critical Bug: `generateSeriesDates()` Uses UTC Conversion

**File:** `app/api/my-events/route.ts:96-107`

```typescript
function generateSeriesDates(startDate: string, count: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00");  // LOCAL time parse

  for (let i = 0; i < count; i++) {
    const eventDate = new Date(start);
    eventDate.setDate(start.getDate() + (i * 7));
    dates.push(eventDate.toISOString().split("T")[0]);  // UTC conversion!
  }
  return dates;
}
```

### How the Bug Manifests

1. User in Asia (UTC+9) picks Monday Jan 12, 2026
2. `new Date("2026-01-12T00:00:00")` = Jan 12 00:00 local = Jan 11 15:00 UTC
3. `.toISOString()` = `"2026-01-11T15:00:00.000Z"`
4. `.split("T")[0]` = `"2026-01-11"` (Sunday!)

### Audit of `toISOString().split("T")[0]` Usage

| File | Line | Context | Risk |
|------|------|---------|------|
| `api/my-events/route.ts` | 103 | Series date generation | **CRITICAL** |
| `lib/events/recurrenceContract.ts` | 389 | RRULE UNTIL parsing | Low (edge case) |
| `app/page.tsx` | 148-149 | Highlights date filter | Low (server-side) |
| `dashboard/my-rsvps/page.tsx` | 36 | Today comparison | Low (server-side) |
| `AdminHighlightsClient.tsx` | 63, 119 | Default start_date | Low (admin UI) |
| `EventForm.tsx` | 799 | Min date for date picker | Low (display only) |

### Safe Pattern (Already Exists)

**File:** `lib/events/nextOccurrence.ts:47-49`

```typescript
export function denverDateKeyFromDate(d: Date): string {
  return denverDateFormatter.format(d);  // Uses America/Denver timezone
}
```

**File:** `lib/events/nextOccurrence.ts:55-60`

```typescript
export function addDaysDenver(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);  // Noon UTC avoids DST issues
  date.setUTCDate(date.getUTCDate() + days);
  return denverDateKeyFromDate(date);
}
```

### Other Date Display Bug

**File:** `app/events/[id]/display/page.tsx:204`

```typescript
{new Date(event.event_date + "T00:00:00").getDate()}
```

**Issue:** `.getDate()` returns day-of-month in LOCAL timezone, while surrounding code uses `timeZone: "America/Denver"`. This could show wrong day for users outside Mountain Time.

### Recommended Fix for `generateSeriesDates()`

```typescript
import { addDaysDenver, denverDateKeyFromDate } from "@/lib/events/nextOccurrence";

function generateSeriesDates(startDate: string, count: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    dates.push(addDaysDenver(startDate, i * 7));
  }
  return dates;
}
```

---

## Decision Checklist (Requires Sami Approval)

### Decision 1: Verification Banner Copy

- [ ] **A:** Auto-confirm user-created events (set `last_verified_at = NOW()`)
- [ ] **B:** Keep unconfirmed but change copy based on `source` field (Recommended)
- [ ] **C:** Change copy to generic "Awaiting verification" for all unconfirmed

### Decision 2: Missing Details Banner

- [ ] **A:** Remove `is_free` from missing details check entirely (Recommended)
- [ ] **B:** Rename banner to "More details helpful" with softer styling
- [ ] **C:** Make `is_free` required in form with explicit "Unknown" option

### Decision 3: Series Edit UX

- [ ] **A:** Add `series_id` check to SeriesEditingNotice (quick fix) (Recommended)
- [ ] **B:** Add "Other events in this series" section to edit page
- [ ] **C:** Both A and B

### Decision 4: Date Bug Fix Scope

- [ ] **A:** Fix `generateSeriesDates()` in API route only (Recommended)
- [ ] **B:** Fix all `toISOString().split("T")[0]` hotspots
- [ ] **C:** Full audit and standardize on MT helpers everywhere

---

## Execution Plan (NOT YET APPROVED)

### Phase 4.42i-1: Date Bug Fix (Priority 1 - Critical)

1. Replace `generateSeriesDates()` with MT-safe implementation using `addDaysDenver()`
2. Fix `display/page.tsx:204` `.getDate()` to use timezone-safe formatting

**Estimated test additions:** 5-8 tests

### Phase 4.42i-2: Copy Fixes (Priority 2 - High)

3. Update `events/[id]/page.tsx:540` banner copy based on Decision 1
4. Update `missingDetails.ts` based on Decision 2

**Estimated test additions:** 4-6 tests

### Phase 4.42i-3: Series UX (Priority 3 - Medium)

5. Add `series_id` to SeriesEditingNotice based on Decision 3

**Estimated test additions:** 2-3 tests

---

## Stop Point

**Investigation complete.** Awaiting Sami's decisions on the 4 options above before any code changes.

No code has been modified. This document is read-only analysis.

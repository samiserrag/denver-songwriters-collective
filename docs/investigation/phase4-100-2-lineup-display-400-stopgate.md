# STOP-GATE 0 — Phase 4.100.2: Lineup/Display 400 Bad Request + Date Mismatch

**Status:** STOP-GATE 0 (Investigation Complete, Awaiting Approval)
**Date:** 2026-01-30
**Investigator:** Claude Code Agent

---

## Problem Statement

Two bugs affecting the Lineup Control (`/events/[id]/lineup`) and TV Display (`/events/[id]/display`) pages:

1. **400 Bad Request on polling** — Pages fail to load or show "Connection lost" when accessed via slug URLs
2. **Occurrence-date mismatch** — Dashboard dropdown shows one date (e.g., Feb 5) but effective date is different (e.g., Jan 15)

---

## Investigation Findings

### Bug #1: 400 Bad Request on Slug Access

**Root Cause:** The lineup and display pages use `.eq("id", eventId)` for all Supabase queries, but the route param `eventId` can be either a UUID or a slug.

**Evidence:**

**File:** `web/src/app/events/[id]/lineup/page.tsx`
- Line 85: `const eventId = params.id as string;` — captures route param (could be UUID or slug)
- Lines 175-179: Initial event fetch
  ```typescript
  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("id, title, slug, venue_name, start_time, event_date, is_recurring, day_of_week, recurrence_rule")
    .eq("id", eventId)  // <-- FAILS when eventId is a slug like "test-open-mic-thursdays"
    .single();
  ```
- Line 145: Auth check also uses `.eq("id", eventId)`

**File:** `web/src/app/events/[id]/display/page.tsx`
- Line 110: Same pattern: `.eq("id", eventId)`

**Why it fails:** PostgreSQL returns a 400 error when comparing a string (slug) against a UUID column. The Supabase REST API surfaces this as HTTP 400.

**Correct Pattern (from `/events/[id]/page.tsx`):**
```typescript
// Lines 41-43: UUID detection helper
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Lines 77-87: Conditional query based on param type
const { data: event } = isUUID(id)
  ? await supabase.from("events").select(...).eq("id", id).single()
  : await supabase.from("events").select(...).eq("slug", id).single();
```

The lineup and display pages do NOT implement this pattern.

---

### Bug #2: Occurrence-Date Mismatch

**Root Cause:** NOT a bug in LineupControlSection — the component correctly uses its `selectedDate` state for both display and URLs.

**Actual Issue:** The dashboard parent page (`/dashboard/my-events/[id]/page.tsx`) computes `availableDates` and `nextOccurrenceDate` server-side, but the LineupControlSection links to the lineup page with the SLUG (not UUID), triggering Bug #1.

**Evidence:**

**File:** `web/src/app/(protected)/dashboard/my-events/[id]/_components/LineupControlSection.tsx`
- Lines 27-29: State correctly initialized from props
  ```typescript
  const [selectedDate, setSelectedDate] = React.useState<string>(
    nextOccurrenceDate || availableDates[0] || ""
  );
  ```
- Lines 35-42: URLs correctly use `selectedDate` in the query param
  ```typescript
  const lineupUrl = `/events/${eventSlug || eventId}/lineup?date=${selectedDate}`;
  const displayUrl = `/events/${eventSlug || eventId}/display?date=${selectedDate}`;
  ```

**File:** `web/src/app/(protected)/dashboard/my-events/[id]/page.tsx`
- Lines 141-148: `nextOccurrenceDate` computed via `computeNextOccurrence()`
- Lines 150-163: `availableDates` computed via `expandOccurrencesForEvent()`
- Lines 309-315: Props passed correctly to LineupControlSection

**The "mismatch" scenario:**
1. User selects Feb 5 in LineupControlSection dropdown
2. Component updates `selectedDate` state to "2026-02-05"
3. Component builds URL: `/events/{slug}/lineup?date=2026-02-05`
4. User clicks link, navigates to lineup page
5. **Lineup page queries by slug** → 400 Bad Request
6. Lineup page shows error state, `effectiveDateKey` is never set correctly
7. If user reloads or the page partially works, it may show wrong date from fallback logic

The "Jan 15" scenario could be:
- The fallback when `expandOccurrencesForEvent()` returns an unexpected result
- The `event_date` anchor being used instead of the computed occurrence
- Timezone issues in the fallback at line 219: `new Date().toISOString().split("T")[0]`

---

## Minimal Patch Plan

### Fix #1: UUID/Slug Detection in Lineup + Display Pages

**Files to modify:**
1. `web/src/app/events/[id]/lineup/page.tsx`
2. `web/src/app/events/[id]/display/page.tsx`

**Changes:**
1. Add `isUUID()` helper function (copy from `/events/[id]/page.tsx`)
2. Modify all Supabase queries to use conditional `.eq()`:
   - If `isUUID(eventId)` → `.eq("id", eventId)`
   - Else → `.eq("slug", eventId)`
3. After initial fetch, store the actual UUID (`eventData.id`) and use that for subsequent queries

**Estimated scope:** ~20 lines per file

### Fix #2: Date Propagation (Deferred)

The date mismatch is a **symptom of Fix #1**. Once the slug query works correctly:
- Lineup page will load successfully
- `?date=` param will be parsed correctly
- `effectiveDateKey` will be set from URL param

No additional changes needed unless mismatch persists after Fix #1.

---

## Risk Assessment

**Risk:** Low
- Changes are additive (new helper function)
- Pattern is proven (already works in `/events/[id]/page.tsx`)
- No schema or API changes
- No data migration

**Rollback:** Revert commit

---

## Test Plan

1. **Manual smoke test:**
   - Navigate to `/events/{uuid}/lineup` → should work (baseline)
   - Navigate to `/events/{slug}/lineup` → should work (currently fails)
   - Navigate to `/events/{slug}/display` → should work (currently fails)
   - Select date in LineupControlSection, click link → should load correct date

2. **Automated tests:** Add tests for `isUUID()` helper in both files

---

## Decision Required

**Approval needed to proceed with Fix #1 implementation.**

STOP-GATE 0 complete. Awaiting approval.

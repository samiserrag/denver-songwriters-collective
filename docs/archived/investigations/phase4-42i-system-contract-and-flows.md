# Phase 4.42i Investigation Report: System Contract & Flows

**Investigation Date:** January 2026
**Status:** Complete — Provides system contract, state machine, date audit, UX flows, and acceptance checklist

---

## 1. Event State Machine (DB Columns → State)

### Relevant DB Columns (from `database.types.ts`)

| Column | Type | Purpose |
|--------|------|---------|
| `status` | string | Core lifecycle: `draft`, `active`, `needs_verification`, `cancelled` |
| `is_published` | boolean | Whether event appears in public listings |
| `published_at` | timestamp | When event was first published |
| `source` | string | Origin: `community`, `import`, `admin` |
| `last_verified_at` | timestamp | When admin last verified (null = unverified) |
| `verified_by` | string | Admin user ID who verified |
| `cancelled_at` | timestamp | When event was cancelled |
| `cancel_reason` | string | Reason for cancellation |
| `series_id` | string | Links events in a series |
| `series_index` | number | Position in series (0, 1, 2...) |
| `is_recurring` | boolean | Legacy flag (not consistently set) |
| `recurrence_rule` | string | RRULE or legacy text pattern |
| `event_date` | string | Specific date (YYYY-MM-DD) |
| `day_of_week` | string | Weekday name for recurring events |

### State Machine Diagram

```
                              ┌─────────────────────────────────────────┐
                              │           EVENT LIFECYCLE               │
                              └─────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  CREATION SOURCE                                                              │
│  ──────────────────                                                           │
│  source="community"  ──→  User created via EventForm                          │
│  source="import"     ──→  Bulk imported / seeded data                         │
│  source="admin"      ──→  Admin-created event                                 │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  DRAFT STATE                                                                  │
│  ─────────────                                                                │
│  status="draft"                                                               │
│  is_published=false                                                           │
│  published_at=null                                                            │
│  last_verified_at=null  (always null on create)                               │
│                                                                               │
│  ▸ NOT visible on /happenings                                                 │
│  ▸ NOT visible on public event page (404)                                     │
│  ▸ Visible on /dashboard/my-events (with "Draft" badge)                       │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                          User clicks "Publish"
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  PUBLISHED / UNVERIFIED STATE                                                 │
│  ────────────────────────────                                                 │
│  status="active"                                                              │
│  is_published=true                                                            │
│  published_at=NOW()                                                           │
│  last_verified_at=null  (STILL null until admin verifies)                     │
│                                                                               │
│  ▸ Visible on /happenings (if date in 90-day window)                          │
│  ▸ Visible on public event page                                               │
│  ▸ Shows "Unconfirmed" banner (amber)                                         │
│  ▸ BUG: Banner says "imported from external source" for ALL unverified        │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                          Admin verifies event
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  PUBLISHED / VERIFIED STATE                                                   │
│  ───────────────────────────                                                  │
│  status="active"                                                              │
│  is_published=true                                                            │
│  last_verified_at=NOW()                                                       │
│  verified_by=admin_user_id                                                    │
│                                                                               │
│  ▸ Visible on /happenings                                                     │
│  ▸ Shows "Confirmed" badge (green)                                            │
│  ▸ No banner on detail page                                                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                          User/Admin cancels
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  CANCELLED STATE                                                              │
│  ───────────────                                                              │
│  status="cancelled"                                                           │
│  cancelled_at=NOW()                                                           │
│  cancel_reason="..."                                                          │
│                                                                               │
│  ▸ NOT visible on /happenings (by default)                                    │
│  ▸ Visible on public event page with "Cancelled" banner (red)                 │
│  ▸ Visible on /dashboard/my-events (in collapsed "Cancelled" section)         │
└──────────────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────┐
│  SERIES EVENTS (series_id != null)                                            │
│  ─────────────────────────────────                                            │
│  Each series event has:                                                       │
│  - series_id: shared UUID across all events in series                         │
│  - series_index: 0, 1, 2, ... position in series                              │
│  - event_date: specific date for this occurrence                              │
│  - day_of_week: weekday (e.g., "Monday")                                      │
│                                                                               │
│  NOTE: is_recurring and recurrence_rule are NOT SET for series events         │
│  This causes SeriesEditingNotice detection to fail!                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Verification State Logic (verification.ts)

```typescript
// Simplified truth table
status === "cancelled"           → CANCELLED
last_verified_at !== null        → CONFIRMED
everything else                  → UNCONFIRMED
```

**Key Insight:** The `source` field is NOT checked by verification logic, but it SHOULD be checked by the UI banner copy.

---

## 2. Date Handling Audit (Create → Convert → Compare → Display)

### Date Handling Paths

| Path | File | Line | Pattern | Safe? |
|------|------|------|---------|-------|
| **CREATE: Series generation** | `api/my-events/route.ts` | 98-103 | `new Date(startDate + "T00:00:00")` → `toISOString().split("T")[0]` | **NO** |
| CREATE: Form preview chips | `EventForm.tsx` | 829 | `new Date(formData.start_date + "T00:00:00")` → local math | **NO** |
| **SAFE: Form helpers** | `formDateHelpers.ts` | 123-133 | Uses `addDaysDenver()` | **YES** |
| **COMPARE: Happenings day filter** | `happenings/page.tsx` | 226 | `new Date(event.event_date + "T00:00:00").getDay()` | **RISKY** |
| COMPARE: Past event check | `events/[id]/page.tsx` | 187 | `new Date(event.event_date + "T23:59:59")` | OK |
| **DISPLAY: Display page day** | `display/page.tsx` | 204 | `new Date(...).getDate()` (local) vs `timeZone: "America/Denver"` | **NO** |
| DISPLAY: Lineup page | `lineup/page.tsx` | 283 | With `timeZone: "America/Denver"` | OK |
| DISPLAY: My Events list | `MyEventsFilteredList.tsx` | 283-286 | Mixed local `.getDate()` and MT formatting | **NO** |
| DISPLAY: Search route | `api/search/route.ts` | 140 | `new Date(event.event_date)` without T00:00:00 suffix | **NO** |
| **SAFE: Happenings main** | `happenings/page.tsx` | 73-75 | Uses `getTodayDenver()`, `addDaysDenver()` | **YES** |
| **SAFE: HappeningCard** | `HappeningCard.tsx` | Uses `T12:00:00Z` pattern | **YES** |
| **SAFE: Occurrence expansion** | `nextOccurrence.ts` | Uses `denverDateKeyFromDate()` throughout | **YES** |

### Safe Pattern (Already Exists)

```typescript
// nextOccurrence.ts - THE GOLD STANDARD
export function denverDateKeyFromDate(d: Date): string {
  return denverDateFormatter.format(d);  // America/Denver timezone
}

export function addDaysDenver(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);  // Noon UTC avoids DST
  date.setUTCDate(date.getUTCDate() + days);
  return denverDateKeyFromDate(date);
}

// formDateHelpers.ts - USES THE SAFE PATTERN
export function generateSeriesDates(startDate: string, count: number): string[] {
  const dates: string[] = [];
  let current = startDate;
  for (let i = 0; i < count; i++) {
    dates.push(current);
    current = addDaysDenver(current, 7);  // SAFE
  }
  return dates;
}
```

### Unsafe Pattern (Multiple Locations)

```typescript
// DANGEROUS - api/my-events/route.ts:96-107
function generateSeriesDates(startDate: string, count: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00");  // LOCAL time
  for (let i = 0; i < count; i++) {
    const eventDate = new Date(start);
    eventDate.setDate(start.getDate() + (i * 7));
    dates.push(eventDate.toISOString().split("T")[0]);  // UTC CONVERSION BUG!
  }
  return dates;
}
```

### Hotspots Requiring Fix

| Priority | File | Issue | Fix |
|----------|------|-------|-----|
| **P0** | `api/my-events/route.ts:96-107` | Series generation shifts dates | Import and use `generateSeriesDates` from `formDateHelpers.ts` |
| P1 | `display/page.tsx:204` | `.getDate()` uses local timezone | Use `toLocaleDateString` with `timeZone: "America/Denver"` |
| P1 | `MyEventsFilteredList.tsx:286,394` | `.getDate()` uses local timezone | Use MT-safe formatting |
| P2 | `api/search/route.ts:140` | Missing `T00:00:00` suffix | Add suffix for consistent parsing |
| P2 | `EventForm.tsx:829` | Preview chips use local time | Use MT helpers |

---

## 3. UX Flow Proposals

### Flow A: Create → Preview Draft → Publish

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CREATE FLOW                                                                 │
└─────────────────────────────────────────────────────────────────────────────┘

User clicks "+ Add Event"
        │
        ▼
┌─────────────────────┐
│  EventForm (Create) │
│  - Title            │
│  - Venue/Custom     │
│  - Day of Week      │
│  - Start Date       │
│  - Series count     │
└─────────────────────┘
        │
        │  Clicks "Save as Draft" OR "Save & Publish"
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  API POST /api/my-events                                                     │
│  - Creates 1 or N events (if series)                                         │
│  - Sets source="community"                                                   │
│  - Sets status="draft" OR "active"                                           │
│  - Sets is_published=false OR true                                           │
│  - PROPOSED: Set last_verified_at=NOW() for source="community" + publish     │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Redirect → /dashboard/my-events/[id]?created=true                           │
│  - Shows success banner                                                      │
│  - If draft: Shows "Draft" badge + "View Preview" link                       │
│  - If published: Shows "Live" badge + "View Public Page" link                │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        │  User clicks "Publish" (if draft)
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Event is now:                                                               │
│  - status="active", is_published=true                                        │
│  - Visible on /happenings                                                    │
│  - CURRENT: Shows "Unconfirmed" banner                                       │
│  - PROPOSED: Shows "Created by community" (not "imported")                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow B: Create Series → View Occurrences → Edit Occurrence → Edit Series

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SERIES CREATION FLOW                                                        │
└─────────────────────────────────────────────────────────────────────────────┘

User fills EventForm with:
  - Day of Week: "Monday"
  - First Event Date: "2026-01-12"
  - Number of Events: 4
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Series Preview Panel shows:                                                 │
│  - Jan 12 (Mon) ✓                                                            │
│  - Jan 19 (Mon) ✓                                                            │
│  - Jan 26 (Mon) ✓                                                            │
│  - Feb 2 (Mon) ✓                                                             │
│                                                                               │
│  BUG: If user is in UTC+9, dates shift backward!                             │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        │  Clicks "Create Event Series"
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  API creates 4 event rows:                                                   │
│  - All share series_id="abc123"                                              │
│  - Each has unique event_date and series_index                               │
│  - NONE have is_recurring=true or recurrence_rule set!                       │
│                                                                               │
│  BUG: generateSeriesDates() uses toISOString() → dates can shift!            │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        │  Redirect to edit page for first event
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Edit Page for Event 1 of Series                                             │
│                                                                               │
│  CURRENT UX:                                                                  │
│  - SeriesEditingNotice shows "One-time event" (wrong!)                        │
│  - No link to other occurrences                                               │
│  - No "Series" badge in header                                                │
│                                                                               │
│  ROOT CAUSE: SeriesEditingNotice checks:                                      │
│    is_recurring || recurrence_rule || (day_of_week && !event_date)            │
│  but series events have event_date set, so check fails!                       │
│                                                                               │
│  PROPOSED UX:                                                                 │
│  - Header shows "Event 1 of 4 in series"                                      │
│  - SeriesEditingNotice shows:                                                 │
│    "This is part of a series. Editing affects this occurrence only."          │
│  - "Other occurrences" section shows links to events 2, 3, 4                  │
│  - "Edit all in series" button (advanced)                                     │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│  PROPOSED: Series Edit UX Enhancement                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SeriesEditingNotice (Updated)                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  🔄 Series: Event 1 of 4                                                     │
│                                                                               │
│  ────────────────────────────────────────────                                │
│  Changes here affect THIS occurrence only.                                   │
│                                                                               │
│  Other events in this series:                                                │
│  ├── Jan 19, 2026 (Edit)                                                     │
│  ├── Jan 26, 2026 (Edit)                                                     │
│  └── Feb 2, 2026 (Edit)                                                      │
│                                                                               │
│  [Admin only: Override Editor →]                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Acceptance Test Checklist

### Pre-Flight Checklist (Must Pass Before Feature Work)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ACCEPTANCE TESTS: Event Creation → Listing Flow                             │
└─────────────────────────────────────────────────────────────────────────────┘

[ ] TEST-001: Single Event Creation (Draft)
    Given: User is logged in
    When: User creates event with is_published=false
    Then: Event has status="draft", is_published=false
    And: Event does NOT appear on /happenings
    And: Event appears on /dashboard/my-events with "Draft" badge
    And: Event detail page returns 404 for non-owner

[ ] TEST-002: Single Event Creation (Publish Immediately)
    Given: User is logged in
    When: User creates event with is_published=true
    Then: Event has status="active", is_published=true, source="community"
    And: Event appears on /happenings within 90-day window
    And: Event detail page shows event
    And: Banner shows "Awaiting verification" (NOT "imported from external")

[ ] TEST-003: Draft → Publish Transition
    Given: User has a draft event
    When: User clicks "Publish"
    Then: Event has status="active", is_published=true
    And: Event appears on /happenings
    And: published_at is set to current timestamp

[ ] TEST-004: Series Creation (No Date Shift)
    Given: User is in any timezone (including UTC+9)
    When: User creates series starting Monday Jan 12, 2026 with 4 events
    Then: All 4 events have correct event_date:
          - 2026-01-12 (Monday)
          - 2026-01-19 (Monday)
          - 2026-01-26 (Monday)
          - 2026-02-02 (Monday)
    And: All events share same series_id
    And: series_index is 0, 1, 2, 3 respectively

[ ] TEST-005: Series Edit Page Shows Series Context
    Given: Event is part of a 4-event series
    When: User opens edit page for event 1
    Then: SeriesEditingNotice shows series membership
    And: Links to other occurrences are visible

[ ] TEST-006: Published Event Visibility on Happenings
    Given: Event has status="active", is_published=true, event_date within 90 days
    When: User visits /happenings
    Then: Event appears in the listing
    And: Event is grouped under correct date section

[ ] TEST-007: Missing Details Banner
    Given: Event has all required fields filled
    And: is_free is null (not set)
    When: User views event detail page
    Then: "Missing details" banner should NOT appear
          (After fix: is_free=null should not trigger banner)

[ ] TEST-008: Verification Banner Copy
    Given: Event has source="community", last_verified_at=null
    When: User views event detail page
    Then: Banner says "Awaiting verification" or similar
    And: Banner does NOT say "imported from external source"

[ ] TEST-009: Cancelled Event Visibility
    Given: Event has status="cancelled"
    When: User visits /happenings (default view)
    Then: Event does NOT appear
    When: User enables "Show cancelled" toggle
    Then: Event appears with "Cancelled" badge

[ ] TEST-010: Date Display Consistency (Mountain Time)
    Given: Event has event_date="2026-01-12"
    When: User views event from any timezone
    Then: Date displays as "Monday, January 12, 2026"
    And: Day number shows as "12" (not "11" or "13")

┌─────────────────────────────────────────────────────────────────────────────┐
│  EDGE CASE TESTS                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

[ ] TEST-E01: User in UTC+14 creates Monday event
    Then: event_date is Monday (not shifted to Sunday)

[ ] TEST-E02: User in UTC-12 creates Monday event
    Then: event_date is Monday (not shifted to Tuesday)

[ ] TEST-E03: DST transition (March/November)
    Given: Series spans daylight saving time change
    Then: All dates remain on correct weekday

[ ] TEST-E04: Series with 12 events (max)
    Then: All 12 events created successfully with correct dates

[ ] TEST-E05: Recurring event (not series) expansion
    Given: Event has day_of_week="Monday", recurrence_rule="weekly"
    Then: Event expands to ~13 occurrences in 90-day window
```

---

## 5. Summary: What Must Be Fixed

### Critical Path (P0)

| Fix | File | Change |
|-----|------|--------|
| Date shift bug | `api/my-events/route.ts` | Replace local `generateSeriesDates()` with import from `formDateHelpers.ts` |

### High Priority (P1)

| Fix | File | Change |
|-----|------|--------|
| Banner copy | `events/[id]/page.tsx:540` | Check `source` field: show "imported" only if `source="import"` |
| Missing details | `missingDetails.ts:80-83` | Remove `is_free=null` trigger OR make field required |
| Series detection | `SeriesEditingNotice.tsx:40-43` | Add `series_id` to detection logic |

### Medium Priority (P2)

| Fix | File | Change |
|-----|------|--------|
| Display page date | `display/page.tsx:204` | Use MT-safe formatting instead of `.getDate()` |
| My Events dates | `MyEventsFilteredList.tsx:286,394` | Use MT-safe formatting |
| Search route | `api/search/route.ts:140` | Add `T00:00:00` suffix to date parsing |
| Form preview | `EventForm.tsx:829` | Use MT helpers for preview chips |

---

## Stop Point

**Investigation complete.** This report provides:
1. Event state machine diagram with DB columns
2. Complete date handling audit (safe vs unsafe paths)
3. UX flow proposals for Create → Publish and Series management
4. Acceptance test checklist (10 core + 5 edge cases)

**No code changes made.** Awaiting Sami's approval on fix priorities before execution.

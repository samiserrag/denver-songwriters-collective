# Phase 4.42f Investigation Report: Event Creation UX and Listing Issues

**Investigation Date:** January 2026
**Status:** Complete - Awaiting approval for fix plan

---

## Executive Summary

Investigation into reported symptoms:
1. Create Event scrolls to schedule section without feedback
2. Monday series displays as Sunday on public page
3. New community events show "imported from external source" banner
4. "Missing details" banner appears for complete events
5. Newly published events may not appear on /happenings
6. Series management UX unclear after creation

**Root causes identified:** 5 distinct issues across date handling, UI copy, validation feedback, and state logic.

---

## A) Form Validation / Submit Behavior

### Finding: Silent HTML5 Validation

The form uses native HTML5 `required` attributes on:
- Title (line 460)
- Description (line 543)
- Venue selector (line 620)
- Day of Week (line 729)
- Start Time (line 745)
- Online URL when mode=online (line 892)

**Behavior:** When `required` fields are empty, browser scrolls to first invalid field without custom error message.

**Evidence:**
```typescript
// EventForm.tsx lines 729, 745
<select
  value={formData.day_of_week}
  required  // <-- HTML5 validation
```

**Custom validation is minimal:**
```typescript
// EventForm.tsx lines 282-306
if ((formData.location_mode === "online" || ...) && !formData.online_url) {
  setError("Online URL is required for online or hybrid events");
  setLoading(false);
  return;
}
// ... publish confirmation check ...
```

**Problem:** No inline field-level error indicators. User sees form scroll up but doesn't know which field failed.

---

## B) Date-Only Timezone Shift Paths

### Critical Bug #1: Series Date Generation (API Route)

**File:** `app/api/my-events/route.ts` lines 96-107

```typescript
function generateSeriesDates(startDate: string, count: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00"); // LOCAL time parse

  for (let i = 0; i < count; i++) {
    const eventDate = new Date(start);
    eventDate.setDate(start.getDate() + (i * 7));
    dates.push(eventDate.toISOString().split("T")[0]); // UTC conversion!
  }
  return dates;
}
```

**Bug:** `new Date(startDate + "T00:00:00")` parses in LOCAL timezone, then `.toISOString()` converts to UTC.

**Example failure scenario:**
- User in Tokyo (JST, UTC+9) picks Monday Jan 12, 2026
- `new Date("2026-01-12T00:00:00")` = Jan 12 00:00 JST = Jan 11 15:00 UTC
- `.toISOString()` = `"2026-01-11T15:00:00.000Z"`
- `.split("T")[0]` = `"2026-01-11"` (Sunday!)

### Critical Bug #2: Display Page Date Number

**File:** `app/events/[id]/display/page.tsx` line 204

```typescript
<span className="text-4xl font-bold leading-none">
  {new Date(event.event_date + "T00:00:00").getDate()}  // LOCAL timezone!
</span>
```

**Bug:** `.getDate()` returns day-of-month in LOCAL timezone, but surrounding code uses `timeZone: "America/Denver"`.

### Critical Bug #3: Search Route

**File:** `app/api/search/route.ts` line 140

```typescript
subtitle: event.venue_name || (event.event_date
  ? new Date(event.event_date).toLocaleDateString(...)  // NO timezone suffix!
  : undefined),
```

**Bug:** `new Date(event.event_date)` without `T00:00:00` suffix parses as UTC midnight, causing day-before display in US timezones.

### Critical Bug #4: Form Preview Chips

**File:** `EventForm.tsx` lines 828-837

```typescript
const startDate = new Date(formData.start_date + "T00:00:00"); // LOCAL time
const eventDate = new Date(startDate);
eventDate.setDate(startDate.getDate() + (i * 7)); // LOCAL time math
// ... formatted with timeZone: "America/Denver"
```

**Bug:** Mixing LOCAL time operations with MT display. If user's local timezone differs from America/Denver, dates can shift.

### Safe Pattern (Reference)

**File:** `components/happenings/HappeningCard.tsx` line 212

```typescript
const displayDate = new Date(`${occurrence.date}T12:00:00Z`); // SAFE: noon UTC
```

This is the correct pattern - parsing at noon UTC ensures the calendar date is preserved regardless of display timezone.

---

## C) Flag/State for New Community Events

### Finding: "Imported" Copy for ALL Unconfirmed Events

**File:** `app/events/[id]/page.tsx` lines 532-541

```tsx
{isUnconfirmed && !isCancelled && (
  <div className="...bg-amber-100...">
    ...
    <span className="font-medium">Happening (not confirmed)</span>
    <span className="block text-sm mt-0.5">
      This event was imported from an external source and hasn&apos;t been verified yet.
    </span>
```

**Problem:** The copy says "imported from an external source" but this banner appears for ALL events where `last_verified_at` is null - including brand new community-created events.

**Root cause:** Phase 4.40 changed ALL events to start as "unconfirmed" (awaiting admin verification), but the UI copy wasn't updated to reflect this. The copy was written when only imported events were unconfirmed.

### Event Creation Defaults

**File:** `app/api/my-events/route.ts` lines 332-334

```typescript
const eventStatus = body.is_published === true ? "active" : "draft";
const publishedAt = body.is_published === true ? new Date().toISOString() : null;
```

Events are created with:
- `status = "active"` (if publishing) or `"draft"` (if not)
- `is_published = true/false` per user choice
- `last_verified_at = null` (DB default, not explicitly set)
- `source = "community"` (line 205 in buildEventInsert)

**The query at /happenings filters:**
```typescript
.eq("is_published", true)
.in("status", ["active", "needs_verification"]);
```

So a published community event SHOULD appear. The issue is the misleading "imported" copy, not the filter.

---

## D) "Missing Details" Banner

### Finding: Cost Field Triggers Banner

**File:** `lib/events/missingDetails.ts` lines 80-83

```typescript
// Rule 5: Unknown cost (is_free is null)
if (event.is_free === null || event.is_free === undefined) {
  reasons.push("Cost information unknown");
}
```

**Problem:** The form doesn't require setting `is_free`. Default form state:
```typescript
is_free: event?.is_free ?? null,  // null for new events
```

So ANY new event that doesn't explicitly set the "Cost" dropdown will show "Missing details."

**Note:** This is intentional by design (Phase 4.1) to encourage complete information. However, the banner copy "Missing details" combined with "imported/unverified" creates a negative impression for legitimate new events.

---

## E) /happenings Filter Analysis

### Current Query (Confirmed Working)

**File:** `app/happenings/page.tsx` lines 78-85

```typescript
let query = supabase
  .from("events")
  .select(`*, venues!left(name, address, city, state)`)
  .eq("is_published", true)
  .in("status", ["active", "needs_verification"]);
```

**A newly created, published event will appear IF:**
1. `is_published = true` ✓ (set when user publishes)
2. `status IN ("active", "needs_verification")` ✓ (set to "active" when published)

**Events are NOT excluded by:**
- `is_dsc_event` filter (only applied if `dscFilter=true`)
- `verify` filter (only applied if param present)
- `last_verified_at` (not used in query)

**Conclusion:** The happenings filters should include community events. If events aren't appearing, check:
1. Was `is_published` actually set to true?
2. Is the event in the 90-day window?
3. Is the date correctly stored (not shifted)?

---

## F) Series Management UX

### Current Flow

1. **Create** → User fills EventForm, selects Day of Week, picks Number of Events
2. **Submit** → API creates N separate event rows with `series_id` linking them
3. **Redirect** → Navigates to edit page for first event only
4. **Edit Page** → Shows single event form, no series awareness

### Series Awareness After Creation

**File:** `app/(protected)/dashboard/my-events/[id]/page.tsx`

The edit page shows:
- `SeriesEditingNotice` component (lines 184-192)
- Single event form (EventForm)
- No link to other series occurrences
- No link to occurrence overrides

**SeriesEditingNotice:**
```tsx
<SeriesEditingNotice
  event={{
    id: event.id,
    recurrence_rule: event.recurrence_rule,
    day_of_week: event.day_of_week,
    event_date: event.event_date,
    is_recurring: event.is_recurring,
  }}
  showOverrideLink={isAdmin}
/>
```

**Problems:**
1. Newly created series events don't have `recurrence_rule` set (only `series_id`)
2. "Other occurrences" not shown or linked
3. Override editor only linked for admins

---

## Root Causes Summary

| # | Issue | Root Cause | Files |
|---|-------|-----------|-------|
| 1 | Silent validation scroll | HTML5 `required` without custom error feedback | EventForm.tsx |
| 2 | Monday → Sunday shift | `toISOString()` on local-time Date | api/my-events/route.ts:103 |
| 3 | "Imported" copy for new events | Copy not updated after Phase 4.40 | events/[id]/page.tsx:540 |
| 4 | Missing details banner | `is_free=null` triggers warning | missingDetails.ts:80-83 |
| 5 | Form preview date drift | Local time math with MT display | EventForm.tsx:829-831 |

---

## Recommended Fix Sequence (For Approval)

**Priority 1 - Critical (Date Correctness):**
1. Fix `generateSeriesDates` in API route to use MT-canonical date math
2. Fix display page `.getDate()` to use MT
3. Fix search route date parsing

**Priority 2 - UX Clarity:**
4. Update "imported" copy to reflect "awaiting verification" for all event types
5. Consider making `is_free` a required field OR removing it from "missing details" heuristic

**Priority 3 - Validation UX:**
6. Add inline field error indicators for required fields
7. Custom error messages instead of silent HTML5 scroll

**Priority 4 - Series UX:**
8. Show series awareness in edit page (list other occurrences)
9. Link to override management for hosts, not just admins

---

## Stop Point

**Investigation complete.** Awaiting approval to proceed with Phase 4.42g execution plan.

No code changes have been made. This document is read-only analysis.

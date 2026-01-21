# Stop-Gate Critique: Series Date Routing + Recurrence Expansion + Timeslot Backprop

**Date:** 2026-01-12
**Status:** APPROVED FOR EXECUTION

---

## Executive Summary

This document provides the required stop-gate critique before implementing fixes for:
- **Bug A:** Venue page "No upcoming happenings" for events with multi-ordinal recurrence and NULL `event_date`
- **Bug B:** Series date routing - `?date=` parameter on event detail pages doesn't resolve to correct occurrence

---

## 1. Call Sites Relying on `?date=` for Event Detail and Series Navigation

### 1.1 Event Detail Page (`web/src/app/events/[id]/page.tsx`)

**Current behavior (lines 197-199, 376-421):**
```typescript
const { date: selectedDateKey } = await searchParams;
// ...
let effectiveSelectedDate: string | null = null;
if (isValidDateKey(selectedDateKey)) {
  if (upcomingOccurrences.length > 0 && isDateInOccurrences(selectedDateKey, upcomingOccurrences)) {
    effectiveSelectedDate = selectedDateKey;
  }
}
```

**Issue:** The page uses `?date=` to select which occurrence to display, but it does NOT resolve to the correct `event_id` in a many-event series. It just changes the displayed date while keeping the same event_id.

**Call sites:**
| Location | Purpose | Affected by Bug B |
|----------|---------|-------------------|
| `page.tsx:199` | Read `date` from searchParams | Yes |
| `page.tsx:376-402` | Determine effectiveSelectedDate | Yes |
| `page.tsx:394-401` | Query occurrence override for selected date | Yes |
| `page.tsx:449-453` | Query RSVPs (uses `event.id`, not date-scoped event) | **Yes - Critical** |
| `page.tsx:457-473` | Query timeslots (uses `event.id`, not date-scoped event) | **Yes - Critical** |

### 1.2 SeriesCard Date Pills (`web/src/components/happenings/SeriesCard.tsx`)

**Current behavior (lines 196-206, 340-360):**
```typescript
// UpcomingDatesList links:
<Link href={`/events/${eventIdentifier}?date=${occ.dateKey}`}>
  {formatDateShort(occ.dateKey)} @ {timeDisplay}
</Link>
```

**Issue:** All date pills link to the SAME event slug with different `?date=` params. In a many-event series, each occurrence should link to its own event slug/id.

**Call sites:**
| Location | Purpose | Affected by Bug B |
|----------|---------|-------------------|
| `SeriesCard.tsx:198` | UpcomingDatesList link | Yes - wrong href |
| `SeriesCard.tsx:344, 354` | Next date link | Yes - wrong href |

### 1.3 Components Using `dateKey` Prop

These components receive `dateKey` from the parent page:

| Component | File | Lines | How Used |
|-----------|------|-------|----------|
| RSVPSection | `events/RSVPSection.tsx` | Prop | Scopes RSVP to occurrence |
| TimeslotSection | `events/TimeslotSection.tsx` | Prop | Scopes timeslots to occurrence |
| AttendeeList | `events/AttendeeList.tsx` | Prop | Scopes attendees to occurrence |
| EventComments | `events/EventComments.tsx` | Prop | Scopes comments to occurrence |

**Issue:** These components receive `dateKey` correctly, BUT the parent page passes the wrong `event.id`. In a many-event series, each occurrence IS a different `event_id` with its own timeslots/RSVPs.

---

## 2. Recurrence Expansion Failure Mode for Multi-Ordinal with `event_date` NULL

### 2.1 Data Shape (Bar 404 Example)

```sql
SELECT id, title, event_date, day_of_week, recurrence_rule, is_recurring
FROM events WHERE id = 'e9f97b88-5783-4047-8fad-c03a61f4ac09';

-- Result:
-- event_date: NULL
-- day_of_week: Tuesday
-- recurrence_rule: 2nd/4th
-- is_recurring: false (data inconsistency!)
```

### 2.2 Code Path Analysis

**Step 1: `interpretRecurrence()` (`recurrenceContract.ts:249-319`)**
```typescript
// Case: recurrence_rule = "2nd/4th" (legacy multi-ordinal)
// Goes to line 505-520: isMultiOrdinalPattern() returns true
// parseMultiOrdinal("2nd/4th") returns [2, 4]
return {
  isRecurring: true,
  frequency: "monthly",
  ordinals: [2, 4],
  dayOfWeekIndex: 2, // Tuesday
  isConfident: true  // dayInfo is not null
};
```
**Status:** ✅ This works correctly.

**Step 2: `expandOccurrencesForEvent()` (`nextOccurrence.ts:532-601`)**
```typescript
const recurrence = interpretRecurrence(event);  // Gets correct interpretation
const targetDayIndex = recurrence.dayOfWeekIndex;  // = 2 (Tuesday)

// Line 554-558: Early exit check
if (targetDayIndex === null || !recurrence.isConfident) {
  return [];  // NOT triggered - we have valid dayIndex and isConfident
}

// Line 562-564: Effective start calculation
const effectiveStart = event.event_date && event.event_date >= startKey
  ? event.event_date
  : startKey;  // = startKey (today) since event_date is NULL

// Line 568-578: Monthly ordinal expansion
case "monthly":
  if (recurrence.ordinals.length > 0) {  // [2, 4].length > 0 = true
    expandMonthlyOrdinals(ordinals, targetDayIndex, effectiveStart, endKey, ...);
  }
```
**Status:** ✅ Should work correctly - falls back to startKey when event_date is NULL.

**Step 3: `expandMonthlyOrdinals()` (`nextOccurrence.ts:657-698`)**

This function iterates through months in the window and computes the 2nd and 4th Tuesday of each month.

**Potential Issue:** If `startKey` (today) is past the 4th Tuesday of the current month, does it find the next month's occurrences?

Let's trace January 2026 (assuming today = Jan 12):
- 2nd Tuesday of Jan 2026: Jan 14 ✅ (within window)
- 4th Tuesday of Jan 2026: Jan 28 ✅ (within window)

**Status:** ✅ This SHOULD produce occurrences.

### 2.3 Hypothesis: Bug is in `computeNextOccurrence()` or Filter Logic

Looking at `groupEventsAsSeriesView()` line 1075-1079:
```typescript
if (allOccurrences.length === 0 && !nextOcc.isConfident) {
  unknownEvents.push(event);
  continue;
}
```

Let me check `computeNextOccurrence()`:

<review needed - `computeNextOccurrence` might return `isConfident: false` for events with NULL event_date>

### 2.4 Actual Root Cause

After reviewing `computeNextOccurrence()` (lines 764-870), I found the issue:

```typescript
// Line 794-799: For non-recurring events with event_date
if (!event.is_recurring && event.event_date) {
  // Returns date or null based on if past
}

// Line 802-807: For non-recurring without event_date
if (!event.is_recurring && !event.event_date) {
  return { date: "9999-12-31", isConfident: false };
}
```

**BUT** the Bar 404 event has `is_recurring = false` (incorrectly) even though it has a valid `recurrence_rule`. The `computeNextOccurrence()` function checks `event.is_recurring` field first, NOT the interpreted recurrence!

**Root Cause:** `computeNextOccurrence()` uses the DB field `is_recurring` instead of `interpretRecurrence().isRecurring`. When `is_recurring = false` but `recurrence_rule` is set, the function returns `isConfident: false` and the event goes to `unknownEvents`.

---

## 3. EventForm Series/Occurrence Creation Model

### 3.1 How Series Are Created (`api/my-events/route.ts:305-412`)

```typescript
// Line 305-316: Series configuration
const occurrenceCount = Math.min(Math.max(body.occurrence_count || 1, 1), 12);
const seriesId = occurrenceCount > 1 ? crypto.randomUUID() : null;
const eventDates = generateSeriesDates(startDate, occurrenceCount);

// Line 322-403: Create N separate event rows
for (let i = 0; i < eventDates.length; i++) {
  const insertPayload = buildEventInsert({
    // ...
    eventDate: eventDates[i],
    seriesId,
    seriesIndex: seriesId ? i : null,
  });
  // Each occurrence = separate event row with unique id
}
```

**Model:** "Many-event series" - each occurrence is a separate `events` row with:
- Unique `id` (UUID)
- Shared `series_id`
- Unique `event_date`
- Same title, venue, times, etc.

### 3.2 Timeslot Generation Per Event

```typescript
// Line 393-402: Generate timeslots for each event
if (body.has_timeslots && body.total_slots) {
  await supabase.rpc("generate_event_timeslots", { p_event_id: event.id });
}
```

**Key Fact:** Timeslots are generated per `event_id`. Each occurrence event can have its own timeslots.

### 3.3 Current Limitations

| Feature | Supported | Notes |
|---------|-----------|-------|
| Create series (multiple events) | ✅ | Creates N rows with shared series_id |
| Edit series template | ❌ | No "apply to all" option |
| Edit single occurrence | ✅ | Each event is independent |
| Delete single occurrence | ⚠️ | Deletes that event row only |
| Timeslots per occurrence | ✅ | Each event has own timeslots |
| RSVPs per occurrence | ✅ | date_key scopes to event's date |

---

## 4. Fix Specifications

### Fix A: Series Date Routing Correctness

**Goal:** When visiting `/events/[slug]?date=YYYY-MM-DD` where the event has `series_id`, resolve to the correct occurrence event and redirect.

**Implementation:**
1. After fetching event, check if it has `series_id` and `date` param exists
2. If the `date` param doesn't match current event's `event_date`:
   - Query for sibling event in same series with matching `event_date`
   - If found: redirect to `/events/{sibling_slug_or_id}` (no `?date=` needed since each occurrence is its own page)
   - If not found: show current event with warning message
3. Update SeriesCard date pills to link to correct occurrence URLs

**Risks:** Low - redirect is fail-safe (falls back to current behavior)

### Fix B: Recurrence Expansion for NULL event_date

**Goal:** Multi-ordinal recurrence events with `event_date = NULL` should still produce upcoming occurrences.

**Implementation:**
1. In `computeNextOccurrence()`, use `interpretRecurrence().isRecurring` instead of `event.is_recurring` DB field
2. This makes the function trust the parsed recurrence rule over the DB flag

**Alternative:** Fix the data - set `is_recurring = true` for events with valid recurrence_rule. But code fix is more robust.

**Risks:** Low - only changes behavior for events where `is_recurring = false` but `recurrence_rule` indicates recurring

### Fix C: Timeslot Backprop Script

**Goal:** For many-event series where only first occurrence has timeslots, copy forward to future occurrences.

**Implementation:**
1. Query all series_id groups where at least one event has timeslots
2. For each series: identify "template" event (has timeslots)
3. For each other event in series without timeslots: copy timeslot structure
4. Dry-run default; `--apply` flag to actually insert

**Risks:**
- Low with dry-run default
- Must ensure `date_key` is set correctly on copied timeslots
- Must respect NOT NULL constraint on `date_key`

---

## 5. Test Coverage Plan

### Fix A Tests
- Series with 3 occurrences: visit occurrence A with `?date=B` → redirects to occurrence B
- Non-series event: `?date=` param is ignored (no redirect)
- Series with no matching date: shows current event with warning
- SeriesCard date pills: generate distinct hrefs per occurrence

### Fix B Tests
- Event with `event_date = NULL`, `day_of_week = Tuesday`, `recurrence_rule = "2nd/4th"` → produces Jan 14, Jan 28 occurrences
- Venue page shows these events under "upcoming happenings"

### Fix C Tests
- Detect missing timeslots in series (dry-run output)
- Apply mode inserts expected rows with correct date_key
- Skip events that already have timeslots

---

## 6. Quality Gates

All must pass before merge:
- [ ] `npm run lint` - 0 errors, 0 warnings
- [ ] `npm run test` - all passing
- [ ] `npm run build` - success

---

## 7. Manual Verification Steps

After deploy:
1. Visit `/venues/bar-404` → should show "Bar 404 Open (Blues) Jam" with upcoming dates
2. Visit series event with `?date=` for different occurrence → lands on correct occurrence page
3. Check lineup on series event → shows correct slots for that occurrence

---

**STOP-GATE STATUS: APPROVED**

Critique complete. Ready to proceed with implementation.

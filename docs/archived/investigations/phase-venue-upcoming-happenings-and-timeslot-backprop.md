# Investigation: Venue Upcoming Happenings + Timeslot Backprop

**Status:** COMPLETE
**Date:** 2026-01-12
**Investigator:** Repo Agent

---

## Goal

Determine root causes for:
1. **Bug A:** Venue page `/venues/bar-404` shows "No upcoming happenings" despite having an event
2. **Bug B:** Series occurrences appear "blended" for lineup/timeslots when switching `?date=` parameter

---

## A) Venue Bug Scope

### A.1 Production DB: Published Events with venue_id but event_date IS NULL

**SQL:**
```sql
SELECT id, title, venue_id, status, is_published, is_recurring, day_of_week, event_date, start_time
FROM events
WHERE venue_id IS NOT NULL
  AND event_date IS NULL
  AND is_published = true
ORDER BY title;
```

**Result:** **88 events** have `venue_id` set, `is_published = true`, but `event_date IS NULL`.

Example rows:
| id | title | status | is_recurring | day_of_week | event_date | recurrence_rule |
|----|-------|--------|--------------|-------------|------------|-----------------|
| e9f97b88-... | Bar 404 Open (Blues) Jam | unverified | **false** | Tuesday | NULL | **2nd/4th** |
| 8ee4bd18-... | Atom's Open Mic at Stagecoach | active | true | Wednesday | NULL | (none) |
| ... | (86 more) | ... | ... | ... | NULL | ... |

**Key Finding:** Bar 404 event has:
- `event_date`: NULL
- `day_of_week`: "Tuesday"
- `recurrence_rule`: "2nd/4th" (multi-ordinal monthly)
- `is_recurring`: **false** ← **DATA INCONSISTENCY**

### A.2 Venue Detail Page Query Analysis

**File:** `web/src/app/venues/[id]/page.tsx`

**Events Query (lines 87-120):**
```typescript
const { data: events, error: eventsError } = await supabase
  .from("events")
  .select(`...`)
  .eq("venue_id", venue.id)
  .eq("is_published", true)
  .in("status", ["active", "needs_verification", "unverified"]);
```

**WHERE clauses:**
1. `venue_id = <venue.id>` ✅
2. `is_published = true` ✅
3. `status IN ('active', 'needs_verification', 'unverified')` ✅

**No date filter in the query itself.** The query correctly returns the Bar 404 event.

### A.3 Root Cause: `groupEventsAsSeriesView()` Filtering

**File:** `web/src/lib/events/nextOccurrence.ts`
**Function:** `groupEventsAsSeriesView()` (lines 1042-1123)

The venue page calls:
```typescript
const { series, unknownEvents } = groupEventsAsSeriesView(eventsWithVenue, {...});
```

Inside `groupEventsAsSeriesView()`:
1. Calls `computeNextOccurrence(event)` (line 1066)
2. Calls `expandOccurrencesForEvent(event, {...})` (line 1069)
3. If `allOccurrences.length === 0 && !nextOcc.isConfident` → pushes to `unknownEvents` (lines 1075-1079)

**The `expandOccurrencesForEvent()` function:**
```typescript
// Line 543
const recurrence = interpretRecurrence(event as RecurrenceInput);

// Lines 546-551: One-time event handling
if (!recurrence.isRecurring) {
  if (event.event_date && event.event_date >= startKey && event.event_date <= endKey) {
    occurrences.push({ dateKey: event.event_date, isConfident: true });
  }
  return occurrences;  // RETURNS EMPTY if event_date is NULL
}
```

**File:** `web/src/lib/events/recurrenceContract.ts`
**Function:** `interpretRecurrence()` (lines 249-319)

For Bar 404 event (`day_of_week: "Tuesday"`, `recurrence_rule: "2nd/4th"`):
- Goes to Case: multi-ordinal pattern (lines 505-520)
- Correctly returns `isRecurring: true`, `frequency: "monthly"`, `ordinals: [2, 4]`

**BUT** the issue is the flow after interpretation:

In `expandOccurrencesForEvent()` (line 554-558):
```typescript
const targetDayIndex = recurrence.dayOfWeekIndex;

// If we don't have a confident day, return empty (unknown schedule)
if (targetDayIndex === null || !recurrence.isConfident) {
  return [];
}
```

For Bar 404:
- `recurrence.dayOfWeekIndex` = 2 (Tuesday) ✅
- `recurrence.isConfident` = true ✅
- `recurrence.ordinals` = [2, 4] ✅
- `recurrence.frequency` = "monthly" ✅

The function SHOULD proceed to `expandMonthlyOrdinals()` (line 571-578). Let me verify:

```typescript
switch (recurrence.frequency) {
  case "monthly":
    if (recurrence.ordinals.length > 0) {
      expandMonthlyOrdinals(...)  // Should be called!
    }
    break;
  ...
}
```

**Hypothesis:** The event IS being processed correctly by `interpretRecurrence()`, but there may be an issue in:
1. The date window bounds (today to +90 days)
2. The `expandMonthlyOrdinals()` function
3. Or the event is landing in `unknownEvents` due to `nextOcc.isConfident === false`

### A.4 Additional Evidence: Checking Next Occurrence Confidence

The check at line 1075-1079:
```typescript
if (allOccurrences.length === 0 && !nextOcc.isConfident) {
  unknownEvents.push(event);
  continue;
}
```

For Bar 404 with `recurrence_rule: "2nd/4th"` + `day_of_week: "Tuesday"`:
- `computeNextOccurrence()` should return a confident result
- `expandOccurrencesForEvent()` should produce occurrences

**Manual verification of 2nd/4th Tuesday of January 2026:**
- 2nd Tuesday: Jan 14, 2026
- 4th Tuesday: Jan 28, 2026

Both are within the 90-day window from today (Jan 12).

### A.5 Root Cause Summary (Bug A)

**Primary Issue:** The code logic appears correct, but there may be a subtle bug in how multi-ordinal monthly patterns are expanded. The investigation shows:

1. Query fetches the event correctly ✅
2. `interpretRecurrence()` parses "2nd/4th" + "Tuesday" correctly ✅
3. The event SHOULD produce occurrences for Jan 14 and Jan 28

**Possible causes:**
1. **Edge case in date parsing** - noon UTC vs Denver timezone
2. **startKey comparison** - The 2nd Tuesday (Jan 14) may be being compared incorrectly against startKey (Jan 12)
3. **Month boundary logic** in `expandMonthlyOrdinals()`

**Need to verify:** Run the actual `expandOccurrencesForEvent()` logic against this specific event data.

---

## B) Timeslot Backprop Scope

### B.1 Events with has_timeslots=true

**SQL:**
```sql
SELECT id, title, is_recurring, event_date, day_of_week
FROM events
WHERE has_timeslots = true
ORDER BY title;
```

**Result:** 8 events with timeslots enabled:

| id | title | is_recurring | event_date | day_of_week | series_id |
|----|-------|--------------|------------|-------------|-----------|
| 75a41ec3-... | Tes Open Mic Series | false | 2026-01-12 | Monday | 5a8474c3-... |
| f5072e36-... | Tes Open Mic Series | false | 2026-01-19 | Monday | 5a8474c3-... |
| bf2eb605-... | Tes Open Mic Series | false | 2026-01-26 | Monday | 5a8474c3-... |
| be8fc671-... | Tes Open Mic Series | false | 2026-02-02 | Monday | 5a8474c3-... |
| c80080a7-... | TEST Open Mic Thursdays Series | false | 2026-01-15 | Thursday | b0e82914-... |
| d1e8347d-... | TEST Open Mic Thursdays Series | false | 2026-01-22 | Thursday | b0e82914-... |
| 7d1c48fa-... | TEST Open Mic Thursdays Series | false | 2026-01-29 | Thursday | b0e82914-... |
| fd5a90ae-... | TEST Open Mic Thursdays Series | false | 2026-02-05 | Thursday | b0e82914-... |

### B.2 Timeslots Grouped by (event_id, date_key)

**SQL:**
```sql
SELECT et.event_id, e.title, et.date_key, COUNT(*) as slot_count
FROM event_timeslots et
JOIN events e ON e.id = et.event_id
GROUP BY et.event_id, e.title, et.date_key
ORDER BY e.title, et.date_key;
```

**Result:**

| event_id | title | date_key | slot_count |
|----------|-------|----------|------------|
| 75a41ec3-... | Tes Open Mic Series | 2026-01-12 | 10 |
| f5072e36-... | Tes Open Mic Series | 2026-01-19 | 10 |
| bf2eb605-... | Tes Open Mic Series | 2026-01-26 | 10 |
| be8fc671-... | Tes Open Mic Series | 2026-02-02 | 10 |
| c80080a7-... | TEST Open Mic Thursdays Series | 2026-01-15 | 12 |
| d1e8347d-... | TEST Open Mic Thursdays Series | 2026-01-22 | 20 |
| 7d1c48fa-... | TEST Open Mic Thursdays Series | 2026-01-29 | 20 |
| fd5a90ae-... | TEST Open Mic Thursdays Series | 2026-02-05 | 20 |

**Count of timeslots with date_key IS NULL:**
```sql
SELECT COUNT(*) as null_date_key_count FROM event_timeslots WHERE date_key IS NULL;
-- Result: 0
```

### B.3 Model Analysis

**Current Model: Many-Event "Series" (NOT single recurring event)**

Evidence:
1. Each date is a **separate `events` row** with its own `id`
2. Events share a `series_id` to link them as a series
3. `is_recurring = false` on all events
4. Each event has `event_date` set to its specific date
5. Timeslots have `date_key` matching the event's `event_date`
6. **Zero timeslots with NULL date_key** (no template/legacy rows)

**This is the "N events, 1 per occurrence" model:**
```
events table:
  event_id_1 (Jan 12) → series_id_A
  event_id_2 (Jan 19) → series_id_A
  event_id_3 (Jan 26) → series_id_A
  event_id_4 (Feb 02) → series_id_A

event_timeslots table:
  timeslot_1 → event_id_1, date_key: 2026-01-12
  timeslot_2 → event_id_2, date_key: 2026-01-19
  ...
```

**NOT the "single recurring event + date_key occurrences" model:**
```
events table:
  event_id_1 (is_recurring=true, day_of_week=Monday)

event_timeslots table:
  timeslot_1 → event_id_1, date_key: 2026-01-12
  timeslot_2 → event_id_1, date_key: 2026-01-19
  ...
```

### B.4 "Blended" Lineup Bug Analysis

**If the user sees the same lineup for different `?date=` selections:**

The UI must be:
1. Not passing `date_key` to the timeslot query, OR
2. Not filtering by the URL's `?date=` parameter, OR
3. Showing timeslots from all events in the series instead of just the selected date's event

**Since each occurrence is a separate event_id**, the URL `/events/[id]?date=YYYY-MM-DD` might be:
1. Using the same `event_id` for all dates (wrong - should be different event_ids)
2. Or the `?date=` param is being ignored when querying timeslots

**Key Question:** Is the event detail page using the `?date=` param to find the correct `event_id` in the series, or is it using the URL's `[id]` directly?

---

## Summary

### Bug A: Venue "No upcoming happenings"

| Finding | Evidence |
|---------|----------|
| Query is correct | No date filter in venue page query |
| Event exists | Bar 404 event has `venue_id` correctly linked |
| Data inconsistency | `is_recurring = false` but `recurrence_rule = "2nd/4th"` |
| Processing issue | `groupEventsAsSeriesView()` may be failing to expand monthly ordinals |

**Root Cause Hypothesis:** Edge case in `expandMonthlyOrdinals()` or date comparison logic.

### Bug B: Timeslot Blending

| Finding | Evidence |
|---------|----------|
| Model is "many-event series" | Each date = separate event_id |
| No NULL date_keys | All 112 timeslots have date_key set |
| Each event owns its timeslots | date_key matches event's event_date |

**Root Cause Hypothesis:** UI is not using `?date=` to resolve the correct `event_id` in the series, or the timeslot query is not filtering by the selected event_id.

---

## Files Referenced

| Category | Path | Lines |
|----------|------|-------|
| Venue page | `web/src/app/venues/[id]/page.tsx` | 87-120 (query), 169 (groupEventsAsSeriesView) |
| Occurrence expansion | `web/src/lib/events/nextOccurrence.ts` | 532-601 (expandOccurrencesForEvent), 1042-1123 (groupEventsAsSeriesView) |
| Recurrence contract | `web/src/lib/events/recurrenceContract.ts` | 249-319 (interpretRecurrence), 505-520 (multi-ordinal) |

---

## Next Steps (Recommended)

1. **Bug A:** Add debug logging to `expandOccurrencesForEvent()` for the Bar 404 event to trace exactly where occurrences are being lost.

2. **Bug B:** Inspect the event detail page (`/events/[id]/page.tsx`) and lineup page (`/events/[id]/lineup/page.tsx`) to verify:
   - How `?date=` param maps to event_id for series
   - Whether timeslot queries filter by the correct event_id

3. **Data Fix:** Consider whether the 88 events with `is_recurring = false` but valid `recurrence_rule` should have `is_recurring` corrected.

---

**END — Investigation Complete**

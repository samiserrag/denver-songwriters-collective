# Phase 4.50a: Happenings "Past" Tab Shows Zero Events — STOP-GATE Investigation

> **Status:** Investigation complete. Awaiting Sami's approval before implementation.
> **Date:** 2026-01-07

---

## Problem Statement

The "Past" tab on `/happenings` shows "0 events across 0 dates (next 90 days)" even when past events exist in the database. The label still says "(next 90 days)" which is incorrect for Past mode.

---

## Root Cause Analysis

### 1. Where the 90-day constraint is applied

**File:** `web/src/app/happenings/page.tsx` (lines 73-75, 92-93, 234-250, 421)

```typescript
const today = getTodayDenver();
// 90-day window for occurrence expansion
const windowEnd = addDaysDenver(today, 90);
```

The window is ALWAYS `[today, today+90]` regardless of timeFilter.

**For Past filter (lines 156-158):**
```typescript
if (timeFilter === "past") {
  query = query.lt("event_date", today);
}
```

This DB query correctly fetches events with `event_date < today`, BUT...

**The occurrence expansion (lines 242-250) still uses the forward-looking window:**
```typescript
const { groupedEvents, ... } = expandAndGroupEvents(
  list as any[],
  {
    startKey: today,      // <-- PROBLEM: starts at today
    endKey: windowEnd,    // <-- PROBLEM: ends at today+90
    maxOccurrences: 40,
    overrideMap,
  }
);
```

**Result:** Past events are fetched from DB, but `expandAndGroupEvents()` only produces occurrences >= today, so they're all filtered out.

### 2. Occurrence overrides query also uses forward window (lines 89-93)

```typescript
const { data: overridesData } = await supabase
  .from("occurrence_overrides")
  .select(...)
  .gte("date_key", today)      // <-- Only future overrides
  .lte("date_key", windowEnd);
```

### 3. UI label hardcoded (line 421)

```typescript
{" "}(next 90 days)
```

This label appears regardless of which tab is selected.

### 4. Result ordering

`expandAndGroupEvents()` sorts groups chronologically (oldest first). For Past, we want newest past first (reverse chronological).

---

## Fix Options

### Option A: Date-aware window selection (RECOMMENDED)

Change the window based on timeFilter:

| timeFilter | startKey | endKey | Ordering |
|------------|----------|--------|----------|
| `upcoming` | today | today+90 | ASC (chronological) |
| `past` | oldest_event_date | today-1 | DESC (newest past first) |
| `all` | oldest_event_date | today+90 | ASC |

**Pros:**
- Clean separation of concerns
- Past shows all historical events
- Minimal code changes

**Cons:**
- Need to determine "oldest_event_date" (one additional query or hardcode a reasonable bound like 2020-01-01)

### Option B: Compute bounds once via aggregate

Add a lightweight query to get min/max event dates:
```sql
SELECT MIN(event_date), MAX(event_date) FROM events WHERE is_published = true
```

**Pros:**
- Dynamic, adapts to data
- Single fast query

**Cons:**
- Extra DB round-trip (though cached result would work)

### Option C: Hardcoded past bound

Use a fixed past start date like `2020-01-01`:
```typescript
const pastStart = "2020-01-01";
```

**Pros:**
- Simplest, no extra query
- Fast

**Cons:**
- Arbitrary bound
- Won't show events before that date (unlikely issue)

---

## Recommended Implementation (Option A + C hybrid)

```typescript
// Determine date window based on time filter
let windowStart: string;
let windowEnd: string;
let sortDescending = false;

if (timeFilter === "past") {
  // Past: oldest reasonable date to yesterday
  windowStart = "2020-01-01"; // Reasonable past bound
  windowEnd = addDaysDenver(today, -1); // Yesterday
  sortDescending = true; // Newest past first
} else if (timeFilter === "all") {
  // All: oldest to future
  windowStart = "2020-01-01";
  windowEnd = addDaysDenver(today, 90);
} else {
  // Upcoming (default): today to 90 days
  windowStart = today;
  windowEnd = addDaysDenver(today, 90);
}
```

**For occurrence expansion:**
```typescript
const { groupedEvents, ... } = expandAndGroupEvents(
  list as any[],
  {
    startKey: windowStart,
    endKey: windowEnd,
    ...
  }
);
```

**For override query:**
```typescript
const { data: overridesData } = await supabase
  .from("occurrence_overrides")
  .select(...)
  .gte("date_key", windowStart)
  .lte("date_key", windowEnd);
```

**For UI label:**
```typescript
const windowLabel = timeFilter === "past"
  ? "past events"
  : timeFilter === "all"
    ? "all time"
    : "next 90 days";

// In JSX:
{" "}({windowLabel})
```

**For result ordering (in `expandAndGroupEvents` or post-processing):**
```typescript
// Sort groups by date
const sortedGroups = [...filteredGroups.entries()].sort((a, b) =>
  sortDescending
    ? b[0].localeCompare(a[0])  // DESC for past
    : a[0].localeCompare(b[0])  // ASC for upcoming
);
```

---

## Files to Change

| File | Change |
|------|--------|
| `web/src/app/happenings/page.tsx` | Window logic, label, override query bounds |
| `web/src/lib/events/nextOccurrence.ts` | Add optional `sortDescending` to `expandAndGroupEvents` (or handle in page) |
| `web/src/components/happenings/DateJumpControl.tsx` | Allow past dates when Past tab active |

---

## DateJumpControl for Past Mode

Currently, DateJumpControl constrains to `[today, windowEnd]`. For Past mode:
- Should allow dates from `windowStart` to `yesterday`
- Presets could be: "Last Week", "Last Month", "Pick a date"

---

## Tests Required

1. Past tab returns >0 events when DB has past events
2. Past events ordered newest first (DESC by date)
3. Upcoming tab still works (today onwards, ASC)
4. All tab shows both past and future
5. UI label matches active tab ("past events" / "next 90 days" / "all time")
6. DateJumpControl allows past dates in Past mode
7. Filters (type, days, DSC, etc.) still apply in Past mode
8. Occurrence overrides load for past dates

---

## STOP-GATE APPROVAL

**Awaiting Sami's approval before proceeding.**

Questions:
1. **Past bound:** Use hardcoded `2020-01-01` or compute from DB?
   - Recommendation: Hardcoded (simpler, no extra query)

2. **Past date jump presets:** "Last Week", "Last Month", "Pick a date"?
   - Recommendation: Keep simple, just enable past date selection

3. **Proceed with recommended approach?**

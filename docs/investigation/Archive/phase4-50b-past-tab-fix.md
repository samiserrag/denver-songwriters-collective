# Phase 4.50b: Past Tab Fix

**Date:** 2026-01-07
**Status:** Implemented
**Issue:** Happenings "Past" tab showed 0 events

---

## Problem

The `/happenings?time=past` filter showed 0 events despite past events existing in the database.

### Root Cause

The occurrence expansion and overrides query used a **hardcoded forward-looking window**:

```typescript
// BEFORE (bug)
const today = getTodayDenver();
const windowEnd = addDaysDenver(today, 90);

// Overrides query - ALWAYS forward-looking
.gte("date_key", today)
.lte("date_key", windowEnd)

// Expansion - ALWAYS forward-looking
expandAndGroupEvents(list, {
  startKey: today,        // Bug: always today
  endKey: windowEnd,      // Bug: always today+90
})
```

When `timeFilter === "past"`, the DB query filtered for `event_date < today`, but the expansion still used a forward window, dropping all past events.

---

## Solution

### 1. Date-Aware Window Selection

Window bounds now depend on `timeFilter`:

| Mode | Window Start | Window End |
|------|--------------|------------|
| `upcoming` | today | today+90 |
| `past` | yesterday-90 (or minEventDate) | yesterday |
| `all` | minEventDate | today+90 |

### 2. MIN(event_date) Query

For past/all modes, query the earliest event_date to determine the window start:

```typescript
const { data: minDateResult } = await supabase
  .from("events")
  .select("event_date")
  .order("event_date", { ascending: true })
  .limit(1)
  .single();

const minDate = minDateResult?.event_date || addDaysDenver(today, -365);
```

### 3. Progressive Loading

Past mode uses chunked loading to prevent unbounded queries:
- `pastOffset=0`: yesterday-90 to yesterday (most recent past)
- `pastOffset=1`: yesterday-180 to yesterday-90
- `pastOffset=2`: yesterday-270 to yesterday-180
- etc.

"Load older" button shown when `hasMorePastEvents = windowStart > minDate`.

### 4. Past Ordering (DESC)

Past events sorted newest-first (reverse chronological):

```typescript
if (timeFilter === "past") {
  filteredGroups = new Map(
    [...expandedGroups.entries()]
      .filter(([dateKey]) => dateKey < today)
      .sort(([a], [b]) => b.localeCompare(a)) // DESC
  );
}
```

### 5. Dynamic Label

Replaced hardcoded `"(next 90 days)"` with context-aware label:
- upcoming: `(next 90 days)`
- past: `(past events)` or `(past events, showing older)`
- all: `(all time)`

### 6. DateJumpControl Past Support

- Window bounds now use `windowStartKey` and `windowEndKey` (not hardcoded today)
- Date picker allows selecting dates within the past window
- Future presets (Today, Tomorrow, This Weekend) show warning in past mode

---

## Files Changed

| File | Changes |
|------|---------|
| `app/happenings/page.tsx` | Window calculation, MIN query, progressive loading, ordering, label |
| `components/happenings/StickyControls.tsx` | New props: `windowStartKey`, `timeFilter` |
| `components/happenings/DateJumpControl.tsx` | Support for past date selection |
| `__tests__/phase4-50b-past-tab-fix.test.ts` | 19 new tests |

---

## Test Coverage

**19 new tests** covering:
- Window bounds calculation
- Past ordering (DESC)
- Upcoming ordering (ASC)
- Dynamic label per timeFilter
- Overrides query bounds
- Progressive loading logic
- DateJumpControl past support

---

## Verification

1. Visit `/happenings?time=past` — should show past events, newest first
2. Click "Load older" — should load earlier events
3. Date picker should allow selecting past dates
4. Label should say "(past events)" not "(next 90 days)"

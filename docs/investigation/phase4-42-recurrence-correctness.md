# Phase 4.42 Investigation: Recurrence Correctness + Series UX Safety

**Date:** 2026-01-04
**Status:** Root cause identified, fix plan proposed

---

## Executive Summary

An event labeled "Every Monday" was generating only one occurrence on a **Tuesday** (Jan 6, 2026). The root cause is a mismatch between `day_of_week` (used for labels) and `event_date` (used for occurrence generation), with no validation to ensure they align.

---

## 1. Evidence

### Database State

Event ID: `42d7e4c6-49e9-4169-830e-040d6a911c62`

```sql
SELECT id, title, event_date, day_of_week, recurrence_rule, start_time
FROM events
WHERE id = '42d7e4c6-49e9-4169-830e-040d6a911c62';
```

| Field | Value |
|-------|-------|
| `id` | `42d7e4c6-49e9-4169-830e-040d6a911c62` |
| `title` | TEST TIME SLOT EVENT |
| `event_date` | **2026-01-06** (Tuesday) |
| `day_of_week` | **Monday** |
| `recurrence_rule` | weekly |
| `start_time` | 19:00:00 |
| `status` | active |
| `source` | community |

**Key observation:** `event_date` is Tuesday but `day_of_week` says Monday.

---

## 2. Root Cause Analysis

### 2.1 Label Path (What Users See)

File: `web/src/lib/recurrenceHumanizer.ts`

```typescript
// Line 288
if (r === "weekly") return d ? `Every ${d}` : "Weekly";
```

When `recurrence_rule = "weekly"` and `day_of_week = "Monday"`:
- Output: **"Every Monday"**
- Uses `day_of_week` directly, ignores `event_date`

### 2.2 Generator Path (What Dates Are Computed)

File: `web/src/lib/events/nextOccurrence.ts`

```typescript
// Lines 346-354
if (event.event_date) {
  const eventDateKey = event.event_date;
  return {
    date: eventDateKey,  // Returns event_date directly
    isConfident: true,
  };
}
```

When `event_date` is set:
- **Short-circuits all recurrence logic**
- Returns `event_date` as the only occurrence
- Never checks `day_of_week`

### 2.3 Event Creation Path (Where the Mismatch Originates)

File: `web/src/app/api/my-events/route.ts`

```typescript
// Lines 96-107
function generateSeriesDates(startDate: string, count: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00");

  for (let i = 0; i < count; i++) {
    const eventDate = new Date(start);
    eventDate.setDate(start.getDate() + (i * 7)); // Weekly
    dates.push(eventDate.toISOString().split("T")[0]);
  }

  return dates;
}
```

**The bug:**
1. User selects `day_of_week = "Monday"` and `start_date = "2026-01-06"` (Tuesday)
2. No validation that `start_date` matches `day_of_week`
3. API stores both values as-is, creating the mismatch

---

## 3. The Architectural Conflict

The codebase supports **two recurrence models**:

### Model A: Abstract Pattern (No event_date)
- Uses: `day_of_week`, `recurrence_rule`
- Example: "Every Monday" with `event_date = null`
- Generator expands pattern into dates
- Works correctly

### Model B: Concrete Dates (With event_date)
- Uses: `event_date` as anchor
- `day_of_week` exists but is only for labeling
- Generator returns `event_date` directly
- Works correctly IF `day_of_week` matches `event_date`

### The Problem
When both fields are set with **conflicting values**:
- Label shows Model A interpretation ("Every Monday")
- Generator uses Model B interpretation (returns the specific date)

---

## 4. Recurrence Contract (Proposed)

### 4.1 Authoritative Fields

| Field | Purpose | Authority |
|-------|---------|-----------|
| `event_date` | Series anchor date (first occurrence) | Authoritative for concrete dates |
| `day_of_week` | Day of week for pattern display | Derived from `event_date` when both exist |
| `recurrence_rule` | Pattern type (weekly, monthly, etc.) | Defines recurrence type |
| `recurrence_end_date` | End of series | Limits expansion window |

### 4.2 Hard Invariants (To Enforce)

1. **Day Consistency:** If `event_date` is set and `day_of_week` is set, they MUST refer to the same weekday
2. **Pattern Alignment:** If `recurrence_rule = "weekly"` and we have `day_of_week`, generated dates must fall on that day
3. **Single Source of Truth:** When `event_date` is set, derive `day_of_week` from it (or validate they match)

### 4.3 Validation Rules

At write-time (create/edit):
```typescript
// If both event_date and day_of_week are set, they must match
if (event_date && day_of_week) {
  const eventDay = new Date(event_date).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'America/Denver'
  });
  if (eventDay.toLowerCase() !== day_of_week.toLowerCase()) {
    throw new Error(`Date ${event_date} is ${eventDay}, not ${day_of_week}`);
  }
}
```

---

## 5. Fix Plan

### Phase 1: Immediate Validation (Prevents Future Bugs)

**Goal:** Block creation of events with mismatched `event_date`/`day_of_week`

**Changes:**
1. Add validation to `POST /api/my-events` (create)
2. Add validation to `PATCH /api/my-events/[id]` (edit)
3. Reject if `day_of_week` doesn't match the weekday of `start_date`

**Files to modify:**
- `web/src/app/api/my-events/route.ts`
- `web/src/app/api/my-events/[id]/route.ts`

### Phase 2: Fix Existing Data

**Goal:** Correct the 4 "TEST TIME SLOT EVENT" entries

**Query to identify affected events:**
```sql
SELECT id, title, event_date, day_of_week,
       to_char(event_date, 'Day') as actual_day
FROM events
WHERE event_date IS NOT NULL
  AND day_of_week IS NOT NULL
  AND trim(to_char(event_date, 'Day')) != initcap(day_of_week);
```

**Fix options:**
1. Set `day_of_week` to match `event_date` (Tuesday)
2. Set `event_date` to the correct Monday
3. Delete test events (since they're TEST data)

### Phase 3: Generator Alignment (Future Enhancement)

**Goal:** When `event_date` is set, use it as anchor for pattern expansion (not as the only date)

**Current behavior:**
```typescript
if (event.event_date) {
  return { date: event.event_date, ... };  // Returns only this date
}
```

**Proposed behavior:**
```typescript
if (event.event_date && event.recurrence_rule === 'weekly') {
  // Use event_date as ANCHOR, expand weekly from there
  return expandWeeklyFromAnchor(event.event_date, window);
}
```

This is a larger change and may be deferred to Phase 4.43.

### Phase 4: UX Guardrails (Future Enhancement)

**Goal:** Preview what dates will be generated before saving

**Features:**
- Show "Next 4 occurrences:" preview in event form
- Highlight if any dates fall on unexpected days
- Warn if pattern seems wrong

---

## 6. Regression Tests (To Add)

```typescript
describe('Recurrence correctness', () => {
  describe('Validation', () => {
    it('rejects event where start_date is Tuesday but day_of_week is Monday', () => {
      const event = {
        start_date: '2026-01-06', // Tuesday
        day_of_week: 'Monday',
        recurrence_rule: 'weekly',
      };
      expect(validateRecurrence(event)).toEqual({
        valid: false,
        error: 'Date 2026-01-06 is Tuesday, not Monday'
      });
    });

    it('accepts event where start_date matches day_of_week', () => {
      const event = {
        start_date: '2026-01-05', // Monday
        day_of_week: 'Monday',
        recurrence_rule: 'weekly',
      };
      expect(validateRecurrence(event)).toEqual({ valid: true });
    });
  });

  describe('Label/Generator alignment', () => {
    it('label and generator produce consistent weekday', () => {
      const event = {
        event_date: '2026-01-06', // Tuesday
        day_of_week: 'Tuesday',
        recurrence_rule: 'weekly',
      };
      const label = humanizeRecurrence(event.recurrence_rule, event.day_of_week);
      const occurrences = expandOccurrencesForEvent(event, { maxOccurrences: 4 });

      expect(label).toBe('Every Tuesday');
      occurrences.forEach(occ => {
        const dayName = new Date(occ.dateKey).toLocaleDateString('en-US', { weekday: 'long' });
        expect(dayName).toBe('Tuesday');
      });
    });
  });
});
```

---

## 7. Affected Events Query

```sql
-- Find all events with potential mismatch
SELECT
  id,
  title,
  event_date,
  day_of_week,
  trim(to_char(event_date, 'Day')) as actual_day,
  recurrence_rule,
  status
FROM events
WHERE event_date IS NOT NULL
  AND day_of_week IS NOT NULL
ORDER BY created_at DESC;
```

---

## 8. Decision Log

| Decision | Rationale |
|----------|-----------|
| Validate at write-time | Prevents future mismatches without affecting reads |
| Derive `day_of_week` from `event_date` | Single source of truth avoids conflicts |
| Fix test data via script | 4 known test events, safe to correct |
| Defer generator changes | Larger scope, needs separate phase |

---

## 9. Implementation Order

1. **Add validation helper** - `validateRecurrenceFields()`
2. **Add to create endpoint** - Reject mismatched events
3. **Add to edit endpoint** - Reject mismatched edits
4. **Add regression tests** - Cover the bug class
5. **Fix existing data** - Script to correct mismatches
6. **Update CLAUDE.md** - Document the contract

---

## Appendix: Related Code Locations

| File | Purpose |
|------|---------|
| `web/src/lib/recurrenceHumanizer.ts` | Label generation |
| `web/src/lib/events/nextOccurrence.ts` | Occurrence computation |
| `web/src/app/api/my-events/route.ts` | Event creation |
| `web/src/app/api/my-events/[id]/route.ts` | Event editing |
| `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` | Form UI |

# STOP-GATE Report: Bug #1 (Recurrence Mismatch) + Bug #3 (Today Missing)

**Date:** January 24, 2026
**Status:** ✅ RESOLVED — All phases executed successfully

---

## 1. Repro Pack

### Bug #1: Monthly Ordinal Event with Missing day_of_week

**Event:** Lone Tree Open Mic
- **ID:** `04cf0d1f-bfb9-44b4-b857-aec2b9c217f1`
- **Observed Behavior:** Event did NOT appear in happenings, even though today (Jan 24, 2026) is the 4th Saturday
- **Expected Behavior:** Should appear today and on all future 4th Saturdays
- **Resolution:** ✅ Fixed — Event now appears correctly

### Bug #3: Event with Today's Date Not Appearing

**Status:** NOT CONFIRMED as a separate bug

After investigation, the only event with `event_date='2026-01-24'` is either:
1. Lone Tree Open Mic (Bug #1 — already covered)
2. Zymos Brewing Open Mic — one-time event that DOES appear correctly

Bug #3 was originally hypothesized as "today's occurrence missing from happenings even when date computation is correct." However, I could not find a concrete production event exhibiting this. The original Zymos Brewing event is a one-time event and the system handles it correctly.

---

## 2. Execution Summary

### Phase 0: Discover day_of_week Encoding ✅
- **Finding:** `day_of_week` uses Title Case text encoding
- **Values:** `Sunday`, `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`
- **Database type:** TEXT (not enum, not integer)

### Phase 1: Fix Lone Tree Open Mic ✅
- **SQL Executed:**
```sql
UPDATE events
SET day_of_week = 'Saturday'
WHERE id = '04cf0d1f-bfb9-44b4-b857-aec2b9c217f1'
  AND day_of_week IS NULL;
```
- **Result:** 1 row updated
- **Verification:** Event now appears in happenings for 4th Saturdays

### Phase 2: Scan & Backfill All Affected Events ✅
- **Scan Query:**
```sql
SELECT id, title, recurrence_rule, day_of_week, event_date
FROM events
WHERE recurrence_rule IN ('1st', '2nd', '3rd', '4th', '5th', 'last', '1st/3rd', '2nd/4th', '2nd/3rd', '1st and 3rd', '2nd and 4th', '1st and Last', 'monthly')
  AND day_of_week IS NULL;
```
- **Result:** Only 1 event found (Lone Tree Open Mic, already fixed in Phase 1)
- **No additional backfill needed**

### Phase 3: Server-Side Canonicalization ✅
- **New File:** `web/src/lib/events/recurrenceCanonicalization.ts`
- **Functions Added:**
  - `isOrdinalMonthlyRule()` — Checks if recurrence rule requires day_of_week
  - `deriveDayOfWeekFromDate()` — Extracts day name from YYYY-MM-DD date
  - `canonicalizeDayOfWeek()` — Main entry point for canonicalization
- **Integration Points:**
  - POST `/api/my-events` — Creates events with derived day_of_week
  - PATCH `/api/my-events/[id]` — Updates events with derived day_of_week

### Phase 4: Defensive Interpretation Fallback ✅
- **Modified:** `web/src/lib/events/recurrenceContract.ts`
- **Change:** `interpretLegacyRule()` now derives day from `event_date` when `day_of_week` is missing
- **Safety Net:** If an event somehow gets saved without day_of_week, it will still render correctly

### Phase 5: Add Tests ✅
- **New Test File:** `web/src/__tests__/recurrence-canonicalization.test.ts` (19 tests)
- **Updated Test File:** `web/src/__tests__/bug1-diagnosis.test.ts` (now tests FIX behavior)
- **Total Tests:** 2528 passing

### Phase 6: Update Documentation ✅
- **This file:** Updated to RESOLVED status with execution details
- **CLAUDE.md:** Updated in Recent Changes section

---

## 3. Files Modified/Created

| File | Change |
|------|--------|
| `web/src/lib/events/recurrenceCanonicalization.ts` | **NEW** — Server-side canonicalization helpers |
| `web/src/app/api/my-events/route.ts` | Integrated canonicalization in POST (event creation) |
| `web/src/app/api/my-events/[id]/route.ts` | Integrated canonicalization in PATCH (event update) |
| `web/src/lib/events/recurrenceContract.ts` | Added defensive fallback in `interpretLegacyRule()` |
| `web/src/__tests__/bug1-diagnosis.test.ts` | Updated to test FIX behavior (not bug behavior) |
| `web/src/__tests__/recurrence-canonicalization.test.ts` | **NEW** — 19 tests for canonicalization |

---

## 4. Root Cause Analysis

### Why Did This Happen?

**Root Cause:** Event row had `recurrence_rule='4th'` but `day_of_week=NULL`.

The recurrence contract expects BOTH fields for monthly ordinal patterns:
- `recurrence_rule` = ordinal ("4th", "1st/3rd", etc.)
- `day_of_week` = target day ("Saturday", "Thursday", etc.)

When `day_of_week` was NULL:
1. `interpretRecurrence()` returned `isConfident=false`
2. `expandOccurrencesForEvent()` returned `[]` (empty array)
3. Event was silently excluded from happenings

**How It Got Into This State:**
Most likely created or modified through direct SQL import without setting day_of_week.

### Prevention

The fix includes **three layers of protection**:

1. **Server-side canonicalization (Phase 3):** API routes automatically derive `day_of_week` from `event_date` when saving ordinal monthly events with missing day_of_week.

2. **Defensive interpretation fallback (Phase 4):** `interpretRecurrence()` derives the day from `event_date` at render time if `day_of_week` is still somehow missing.

3. **Test coverage (Phase 5):** Tests ensure the canonicalization and fallback logic work correctly.

---

## 5. Rollback Plan

If issues are discovered:

### Rollback Data Fix (Phase 1)
```sql
UPDATE events
SET day_of_week = NULL
WHERE id = '04cf0d1f-bfb9-44b4-b857-aec2b9c217f1';
```

### Rollback Code Changes (Phases 3-4)
```bash
git revert <commit-hash>
```

### Rollback Test Changes (Phase 5)
Tests can remain — they document correct behavior.

---

## 6. Verification

### Quality Gates
- ✅ All 2528 tests passing
- ✅ Lint: 0 errors, 0 warnings
- ✅ Build: Success

### Manual Verification
- Visit `/happenings` — Lone Tree Open Mic should appear on 4th Saturdays
- Create new event with `recurrence_rule='4th'` and no `day_of_week` — should auto-derive

---

## 7. Appendix: Key Code

### Canonicalization Helper (`recurrenceCanonicalization.ts`)

```typescript
const ORDINAL_MONTHLY_RULES = new Set([
  "1st", "2nd", "3rd", "4th", "5th", "last",
  "1st/3rd", "2nd/3rd", "2nd/4th", "1st and 3rd",
  "2nd and 4th", "1st and Last", "monthly",
]);

export function canonicalizeDayOfWeek(
  recurrenceRule: string | null | undefined,
  dayOfWeek: string | null | undefined,
  anchorDate: string | null | undefined
): string | null {
  if (dayOfWeek) return dayOfWeek;
  if (!isOrdinalMonthlyRule(recurrenceRule)) return null;
  return deriveDayOfWeekFromDate(anchorDate);
}
```

### Defensive Fallback (`recurrenceContract.ts`)

```typescript
// Phase 4.83: If day_of_week is missing but event_date exists,
// derive the day from the anchor date.
if (!dayInfo && event_date) {
  dayInfo = getDayOfWeekFromDate(event_date);
}
```

---

**Resolution Date:** January 24, 2026
**Resolved By:** Claude (with Sami's approval)

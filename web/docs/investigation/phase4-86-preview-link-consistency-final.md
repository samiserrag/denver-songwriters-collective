# Phase 4.86: Preview/Link Consistency Fix Pack — Final Report

**Date:** 2026-01-26
**Status:** COMPLETED — Awaiting STOP-GATE 2 Approval
**Quality Gates:** ✅ Lint 0, ✅ Tests 2544, ✅ Build Success

---

## Summary

Phase 4.86 addressed preview label drift and link consistency issues across EventForm and related dashboard surfaces. All work items completed successfully.

---

## Work Items Completed

### Work Item A: EventForm Preview Label Unification ✅

**Problem:** EventForm manually constructed `recurrence_rule` strings for monthly patterns (lines 301-303), duplicating logic that exists in the shared recurrence contract.

**Solution:**
1. Added two new centralized functions to `recurrenceContract.ts`:
   - `buildRecurrenceRuleFromOrdinals(ordinals: number[]): string` — Builds canonical rule string (e.g., `[1, 3]` → `"1st/3rd"`)
   - `parseOrdinalsFromRecurrenceRule(rule: string): number[]` — Parses ordinals from rule (e.g., `"1st/3rd"` → `[1, 3]`)

2. Updated `EventForm.tsx` to use centralized function:
   ```typescript
   // Before (manual):
   const ordinalWords = { 1: "1st", 2: "2nd", ... };
   previewRecurrenceRule = ordinalTexts.join("/");

   // After (shared contract):
   previewRecurrenceRule = buildRecurrenceRuleFromOrdinals(selectedOrdinals);
   ```

**Files Modified:**
- `web/src/lib/events/recurrenceContract.ts` — Added centralized ordinal conversion functions
- `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` — Uses centralized functions

---

### Work Item B: Edit-Mode Ordinal Parsing Round-Trip ✅

**Problem:** Edit mode initialized `selectedOrdinals` state using manual parsing logic at lines 239-246, creating potential drift from save behavior.

**Solution:** Updated initialization to use centralized `parseOrdinalsFromRecurrenceRule()`:
```typescript
// Before (manual parsing):
const ordinalMap: Record<string, number> = { "1st": 1, "2nd": 2, ... };
const parsed = parts.map(p => ordinalMap[p]).filter(...);

// After (shared contract):
const parsed = parseOrdinalsFromRecurrenceRule(event.recurrence_rule);
```

This ensures **round-trip consistency**: DB → form state (parse) → preview (build) → save (build) → DB.

**Files Modified:**
- `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx`

---

### Work Item C: View Public Page Date Parameter Anchoring ✅

**Problem:** "View Public Page" and "Preview as visitor" links in dashboard didn't include `?date=YYYY-MM-DD` parameter, causing users to land on the default/next occurrence instead of the occurrence they're editing.

**Solution:**
1. Added `nextOccurrenceDate` prop to `CreatedSuccessBanner` component
2. Updated all "View Public Page" / "Preview as visitor" links to include date param
3. Computed next occurrence server-side using `computeNextOccurrence()`

**Links Updated:**
- `CreatedSuccessBanner.tsx` line 43: `/events/${slug}` → `/events/${slug}?date=${date}`
- `my-events/[id]/page.tsx` lines 199, 207: Both "View Public Page" and "Preview as visitor" links

**Files Modified:**
- `web/src/app/(protected)/dashboard/my-events/[id]/_components/CreatedSuccessBanner.tsx`
- `web/src/app/(protected)/dashboard/my-events/[id]/page.tsx`

---

### Work Item D: Today Occurrence Missing Proof ✅

**Problem:** Need tests proving that when "today" matches a recurrence pattern, today's occurrence appears in the timeline (not skipped or excluded).

**Solution:** Added 5 new tests to `recurrence-unification.test.ts`:

| Test | Verifies |
|------|----------|
| Weekly: today IS included | `startKey=2026-01-05` (Monday) → first occurrence is Monday |
| Monthly ordinal: today IS included | `startKey=2026-01-13` (2nd Tuesday) → first occurrence is 2nd Tuesday |
| One-time: today IS included | `event_date=today` → returns today |
| Custom dates: today IS included | `today in custom_dates` → today is first occurrence |
| Boundary test | `startKey` exactly on occurrence date → that date included |

**Files Modified:**
- `web/src/__tests__/recurrence-unification.test.ts` — Added 5 tests (total now 29)

---

### Work Item E: Confirmed/Unconfirmed Preview Consistency ✅

**Status:** Already implemented (previous "Bug #4 fix")

**Verification:** Lines 326-328 of EventForm.tsx correctly pass `last_verified_at` to preview:
```typescript
// Bug #4 fix: Include last_verified_at so preview shows correct verification state
// When editing an existing verified event, the preview should show "Confirmed" not "Unconfirmed"
last_verified_at: event?.last_verified_at ?? null,
```

**Behavior:**
- **Edit mode (verified event):** Uses actual `last_verified_at` from DB → shows "Confirmed"
- **Create mode (new event):** `event` is undefined, so `null` → shows "Unconfirmed" (correct — new events ARE unconfirmed)

No changes required.

---

## Quality Gate Results

| Gate | Status |
|------|--------|
| Lint | ✅ 0 errors, 0 warnings |
| Tests | ✅ 2544 passing |
| Build | ✅ Success |

---

## Files Changed Summary

| File | Change Type |
|------|-------------|
| `lib/events/recurrenceContract.ts` | Added `buildRecurrenceRuleFromOrdinals()`, `parseOrdinalsFromRecurrenceRule()` |
| `dashboard/my-events/_components/EventForm.tsx` | Uses centralized ordinal functions, imports |
| `dashboard/my-events/[id]/page.tsx` | Added `computeNextOccurrence()`, date-anchored links |
| `dashboard/my-events/[id]/_components/CreatedSuccessBanner.tsx` | Added `nextOccurrenceDate` prop, date-anchored link |
| `__tests__/recurrence-unification.test.ts` | Added 5 "today occurrence" tests |

---

## Key Contract Additions

### `buildRecurrenceRuleFromOrdinals(ordinals: number[]): string`

Canonical function to build recurrence rule strings from ordinal arrays:
- `[1]` → `"1st"`
- `[1, 3]` → `"1st/3rd"`
- `[2, -1]` → `"2nd/last"`
- `[]` → `""`

### `parseOrdinalsFromRecurrenceRule(rule: string): number[]`

Parses ordinals from rule strings (inverse of build):
- `"1st"` → `[1]`
- `"1st/3rd"` → `[1, 3]`
- `"2nd/last"` → `[2, -1]`
- `"weekly"` → `[]`
- `null` → `[]`

---

## STOP-GATE 2: Awaiting Approval

All work items completed. Ready for Sami approval before merge.

**No UX redesign, route renaming, or unrelated refactors were performed.**

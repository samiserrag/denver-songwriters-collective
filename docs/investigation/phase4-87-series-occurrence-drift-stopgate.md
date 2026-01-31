# Phase 4.87: Series/Occurrence Preview Consistency — STOP-GATE Investigation

**Date:** 2026-01-26
**Status:** STOP-GATE 1 COMPLETE — Awaiting Sami Approval

---

## Executive Summary

Investigation confirms the recurrence system is **well-centralized** after Phase 4.86. The core contract (`interpretRecurrence`, `labelFromRecurrence`, `buildRecurrenceRuleFromOrdinals`, `parseOrdinalsFromRecurrenceRule`) is consistently used across all critical surfaces.

**Key Findings:**

| Area | Status | Notes |
|------|--------|-------|
| Recurrence Labels | ✅ Centralized | All surfaces use `recurrenceContract.ts` via `recurrenceHumanizer.ts` |
| Ordinal Build/Parse | ✅ Centralized | EventForm uses new contract functions (Phase 4.86) |
| Today Inclusion | ✅ Working | `>=` comparisons ensure today is included when applicable |
| Date Anchoring | ⚠️ GAP | HappeningCard links missing `?date=` parameter |
| OG Route Labels | ℹ️ Intentional | Manual abbreviated labels (space-constrained) |

**One actionable gap found:** HappeningCard's `getDetailHref()` does not include `?date=` parameter, so clicking a card in the timeline doesn't anchor to the specific occurrence.

---

## 1. Repro Table: Event Types × UI Surfaces

### 1.1 Monthly Ordinal Events

| Test Case | DB Fields | Expected Label | Actual Label | Status |
|-----------|-----------|----------------|--------------|--------|
| 4th Saturday | `recurrence_rule="4th"`, `day_of_week="Saturday"` | "4th Saturday of the Month" | "4th Saturday of the Month" | ✅ |
| 1st/3rd Thursday | `recurrence_rule="1st/3rd"`, `day_of_week="Thursday"` | "1st & 3rd Thursday of the Month" | "1st & 3rd Thursday of the Month" | ✅ |
| 2nd/4th Tuesday | `recurrence_rule="2nd/4th"`, `day_of_week="Tuesday"` | "2nd & 4th Tuesday of the Month" | "2nd & 4th Tuesday of the Month" | ✅ |
| Last Friday | `recurrence_rule="last"`, `day_of_week="Friday"` | "Last Friday of the Month" | "Last Friday of the Month" | ✅ |

### 1.2 Weekly Events

| Test Case | DB Fields | Expected Label | Actual Label | Status |
|-----------|-----------|----------------|--------------|--------|
| Weekly Monday | `recurrence_rule="weekly"`, `day_of_week="Monday"` | "Every Monday" | "Every Monday" | ✅ |
| Biweekly Saturday | `recurrence_rule="biweekly"`, `day_of_week="Saturday"` | "Every Other Saturday" | "Every Other Saturday" | ✅ |

### 1.3 Custom & One-Time Events

| Test Case | DB Fields | Expected Label | Actual Label | Status |
|-----------|-----------|----------------|--------------|--------|
| Custom dates | `recurrence_rule="custom"`, `custom_dates=["2026-01-15", "2026-02-01"]` | "Specific Dates" | "Specific Dates" | ✅ |
| One-time | `recurrence_rule=null`, `event_date="2026-02-14"` | No recurrence label | No recurrence label | ✅ |

### 1.4 Label Consistency Across Surfaces

| Surface | Source | Status |
|---------|--------|--------|
| EventForm preview | `labelFromRecurrence()` via `recurrenceContract.ts` | ✅ |
| /happenings SeriesCard | `getRecurrenceSummary()` via `recurrenceHumanizer.ts` → `recurrenceContract.ts` | ✅ |
| /happenings HappeningCard | `getRecurrenceSummary()` via same path | ✅ |
| /events/[slug]?date= | `labelFromRecurrence()` via same contract | ✅ |
| OG social cards | Manual construction (intentional abbreviation) | ℹ️ See §4 |

---

## 2. Root Cause Map

### 2.1 Architecture (Post-Phase 4.86)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      recurrenceContract.ts                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │interpretRecurrence│ │labelFromRecurrence│ │buildRecurrenceRule│ │
│  │  → RecurrenceData│ │  → Human label   │ │FromOrdinals         │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────┬───────────┘ │
│           │                    │                      │             │
└───────────┼────────────────────┼──────────────────────┼─────────────┘
            │                    │                      │
            ▼                    ▼                      ▼
   nextOccurrence.ts   recurrenceHumanizer.ts    EventForm.tsx
   (expansion logic)   (getRecurrenceSummary)    (preview labels)
            │                    │                      │
            ▼                    ▼                      ▼
   ┌─────────────┐      ┌─────────────────┐    ┌─────────────────┐
   │ happenings  │      │  SeriesCard     │    │ Live Preview    │
   │ page.tsx    │      │  HappeningCard  │    │ Panel           │
   └─────────────┘      └─────────────────┘    └─────────────────┘
```

### 2.2 Surfaces Verified

| File | Uses Contract | Notes |
|------|---------------|-------|
| `lib/events/recurrenceContract.ts` | Source | Core contract functions |
| `lib/recurrenceHumanizer.ts` | ✅ | Wraps `interpretRecurrence` + `labelFromRecurrence` |
| `lib/events/nextOccurrence.ts` | ✅ | Uses `interpretRecurrence` for expansion |
| `EventForm.tsx` | ✅ | Uses `buildRecurrenceRuleFromOrdinals`, `parseOrdinalsFromRecurrenceRule` |
| `SeriesCard.tsx` | ✅ | Uses `getRecurrenceSummary` |
| `HappeningCard.tsx` | ✅ | Uses `getRecurrenceSummary` |
| `events/[id]/page.tsx` | ✅ | Uses `labelFromRecurrence` |
| `SeriesEditingNotice.tsx` | ✅ | Uses `getRecurrenceSummary` |
| `og/event/[id]/route.tsx` | ❌ | Manual (intentional) — see §4 |

---

## 3. Today Inclusion Audit

### 3.1 Expansion Logic Analysis

The `expandOccurrencesForEvent()` function in `nextOccurrence.ts` uses `>=` comparisons throughout:

| Function | Line | Comparison | Today Included? |
|----------|------|------------|-----------------|
| `expandOccurrencesForEvent` (one-time) | 574 | `event.event_date >= startKey` | ✅ Yes |
| `expandOccurrencesForEvent` (custom) | 583 | `dateKey >= startKey` | ✅ Yes |
| `expandWeekly` | 720 | `daysUntil < 0 → daysUntil += 7` (wraps to include today if match) | ✅ Yes |
| `expandMonthlyOrdinals` | 783 | `dateKey >= startKey` | ✅ Yes |

### 3.2 Test Coverage (Phase 4.86)

Tests in `__tests__/recurrence-unification.test.ts` explicitly verify "today IS included":

| Test | Scenario | Status |
|------|----------|--------|
| Weekly: today IS included | `startKey=Monday`, target=Monday | ✅ Passing |
| Monthly ordinal: today IS included | `startKey=2nd Tuesday`, target=2nd Tuesday | ✅ Passing |
| One-time: today IS included | `event_date=today` | ✅ Passing |
| Custom dates: today IS included | `today in custom_dates` | ✅ Passing |
| Boundary: startKey exactly on occurrence | `startKey=occurrence date` | ✅ Passing |

**Conclusion:** Today inclusion is working correctly. 29/29 tests pass.

---

## 4. Rogue Codepath Inventory

### 4.1 OG Route Manual Labels (INTENTIONAL)

**File:** `web/src/app/og/event/[id]/route.tsx` (lines 69-91)

**Behavior:** Constructs abbreviated labels for social card previews:
- Full: "1st & 3rd Thursday of the Month"
- OG: "1st & 3rd Thu"

**Rationale:** Space-constrained social cards need abbreviated day names. Using `DAY_ABBREVS` map for "Thu", "Sat", etc.

**Status:** Intentional divergence. Not a bug.

### 4.2 HappeningCard Link Missing `?date=` (GAP)

**File:** `web/src/components/happenings/HappeningCard.tsx` (lines 273-280)

**Current:**
```typescript
function getDetailHref(event: HappeningEvent): string {
  const identifier = event.slug || event.id;
  if (event.event_type === "open_mic") {
    return `/open-mics/${identifier}`;
  }
  return `/events/${identifier}`;
}
```

**Problem:** When a user clicks on a happening card in the timeline (e.g., for Jan 18 occurrence), the link goes to `/events/my-event` without `?date=2026-01-18`. This means:
- User lands on the event's next/default occurrence, not the clicked one
- For series, this creates navigation confusion

**Impact:** Medium — affects timeline view click-through to event detail.

**Fix (for STOP-GATE 2):** Update `getDetailHref` to accept occurrence date and include `?date=` when available.

### 4.3 All Other Surfaces

| Surface | Link Format | Status |
|---------|-------------|--------|
| SeriesCard date pills | `/events/${identifier}?date=${occ.dateKey}` | ✅ Correct |
| DatePillRow | `/events/${identifier}?date=${dateKey}` | ✅ Correct |
| CreatedSuccessBanner | `/events/${slug}?date=${nextOccurrenceDate}` | ✅ Correct (Phase 4.86) |
| Edit page "View Public Page" | `/events/${slug}?date=${nextOccurrenceDate}` | ✅ Correct (Phase 4.86) |
| RSVP emails | `/events/${slug}?date=${dateKey}` | ✅ Correct |
| Notification links | `/events/${slug}?date=${dateKey}#anchor` | ✅ Correct |
| OccurrenceEditor | `/events/${identifier}?date=${occ.dateKey}` | ✅ Correct |

---

## 5. Fix Plan (STOP-GATE 2)

### 5.1 Required Changes

| Item | Priority | Effort | Risk |
|------|----------|--------|------|
| A. HappeningCard `getDetailHref` add `?date=` | High | Low | Low |

**A. HappeningCard Link Fix**

Update `getDetailHref` to accept occurrence date from props:

```typescript
// Before
function getDetailHref(event: HappeningEvent): string {
  const identifier = event.slug || event.id;
  return `/events/${identifier}`;
}

// After
function getDetailHref(event: HappeningEvent, dateKey?: string): string {
  const identifier = event.slug || event.id;
  const base = event.event_type === "open_mic"
    ? `/open-mics/${identifier}`
    : `/events/${identifier}`;
  return dateKey ? `${base}?date=${dateKey}` : base;
}

// Usage (line 391)
const detailHref = getDetailHref(effectiveEvent, precomputedOccurrence?.date);
```

### 5.2 No Changes Needed

| Item | Reason |
|------|--------|
| OG route abbreviations | Intentional design for space constraints |
| Recurrence labels | Already centralized |
| Today inclusion | Already working correctly |
| Edit form ordinal sync | Fixed in Phase 4.86 |

---

## 6. Risk List & Rollback

### 6.1 Risks

| Risk | Mitigation |
|------|------------|
| Breaking existing links | `?date=` is additive; pages handle missing param gracefully |
| Regression in occurrence expansion | 29 existing tests + 5 new "today" tests provide coverage |
| Label changes in unexpected places | All label surfaces traced to single contract |

### 6.2 Rollback Plan

If issues arise after STOP-GATE 2 implementation:
1. Revert HappeningCard changes (single file)
2. Links will fall back to default behavior (no `?date=`)
3. No data changes required

---

## 7. QA Matrix

### 7.1 Pre-Implementation Checklist

| Check | Status |
|-------|--------|
| All recurrence tests pass (29/29) | ✅ |
| Build succeeds | ✅ |
| Lint 0 warnings | ✅ |
| No type errors | ✅ |

### 7.2 Post-Implementation Test Plan (STOP-GATE 2)

| Test | Expected |
|------|----------|
| Click timeline card for Jan 18 occurrence | Lands on `/events/slug?date=2026-01-18` |
| Click timeline card for one-time event | Lands on `/events/slug?date=2026-02-14` |
| Click series card date pill | Lands on `/events/slug?date=YYYY-MM-DD` (unchanged) |
| View Public Page from edit | Lands on `/events/slug?date=next-occurrence` (unchanged) |
| OG cards show abbreviated labels | "1st & 3rd Thu" format preserved |

---

## 8. Contract Invariants (Lock-In)

### 8.1 Recurrence Label Contract

> **All user-facing recurrence labels MUST flow through `recurrenceContract.ts`.**
>
> - `interpretRecurrence()` for structured data
> - `labelFromRecurrence()` for human-readable strings
> - `buildRecurrenceRuleFromOrdinals()` for form → DB
> - `parseOrdinalsFromRecurrenceRule()` for DB → form

**Exception:** OG route may use abbreviated day names for space constraints.

### 8.2 Link Anchoring Contract

> **All occurrence-specific links MUST include `?date=YYYY-MM-DD` parameter.**
>
> - SeriesCard date pills ✅
> - DatePillRow ✅
> - HappeningCard timeline clicks (NEEDS FIX)
> - Dashboard "View Public Page" ✅
> - Email links ✅
> - Notification links ✅

### 8.3 Today Inclusion Contract

> **`expandOccurrencesForEvent()` MUST include today's occurrence when startKey=today and the pattern matches.**
>
> - Uses `>=` comparisons (not `>`)
> - Covered by 5 explicit tests in `recurrence-unification.test.ts`

---

## WAITING FOR SAMI APPROVAL — DO NOT IMPLEMENT YET

**Summary:**
- Investigation complete
- One gap found: HappeningCard links missing `?date=`
- Fix is low-risk, single-file change
- All other systems verified as working correctly

**Next Step:** Sami approval → STOP-GATE 2 implementation

# Phase 5.05: Monthly Series Day-of-Week Edit Missing

> **STOP-GATE 1: Investigation Report**
> **Status:** Complete — Awaiting approval before STOP-GATE 2
> **Date:** 2026-01-28

---

## Problem Statement

When editing a monthly recurring event series (e.g., "Wild Sky Brewery Littleton - Open Mic" with "4th Thursday" pattern), there is **no way to change the day of week** from the edit form.

**User Report:** Cannot change from Thursday to Wednesday for a seeded monthly event being edited from the admin/my-events dashboard.

---

## Root Cause Analysis

### Finding 1: Edit Mode Missing Date Picker for Monthly Series

In `EventForm.tsx`, **create mode** for monthly series has a "First Event Date" field that derives `day_of_week`:

```typescript
// Lines 1390-1454 (CREATE mode)
{mode === "create" && formData.series_mode === "monthly" && (
  // "Choose which week(s) of the month..."
  // "The day of week is set by your First Event Date below."
  <input type="date" ... onChange={...weekdayNameFromDateMT(value)...} />
)}
```

But **edit mode** for monthly series is **missing this field entirely**:

```typescript
// Lines 940-1146 (EDIT mode for monthly/weekly/custom)
{!occurrenceMode && mode === "edit" && (formData.series_mode === "monthly" || ...) && (
  // Series Settings section
  // - Ordinal checkboxes (1st, 2nd, 3rd, 4th, Last)
  // - Pattern summary (e.g., "4th Thursday of the month")
  // - Series Length (ongoing vs finite)
  //
  // ❌ NO First Event Date field
  // ❌ NO way to change day_of_week
)}
```

### Finding 2: Day of Week Dropdown Only Shown for Weekly Mode

```typescript
// Line 876
{!occurrenceMode && ((mode === "edit" && formData.series_mode === "weekly") ||
                     (mode === "create" && formData.series_mode === "weekly")) && (
  // Day of Week dropdown...
)}
```

This explicitly excludes monthly mode from showing the Day of Week dropdown.

### Finding 3: Series Mode Detection is Correct

The series mode detection correctly identifies ordinal rules (like "4th") as monthly:

```typescript
// Lines 186-189
series_mode: (mode === "edit" && event?.recurrence_rule
  ? (event.recurrence_rule === "weekly" || event.recurrence_rule === "biweekly" ? "weekly"
    : event.recurrence_rule === "custom" ? "custom" : "monthly")
  : "single") as "single" | "weekly" | "monthly" | "custom"
```

---

## Entry Points Audit

All entry points to EventForm were audited to confirm the issue affects all edit paths:

| Entry Point | Path | Mode | Issue Present? |
|-------------|------|------|----------------|
| Admin Edit (legacy) | `/dashboard/admin/events/[id]/edit` | Redirects to canonical | N/A (redirect) |
| My Events Edit | `/dashboard/my-events/[id]` | `mode="edit"` | ✅ YES |
| Create New | `/dashboard/my-events/new` | `mode="create"` | ❌ No (has date picker) |
| Occurrence Edit | `/dashboard/my-events/[id]/overrides/[dateKey]` | `occurrenceMode=true` | N/A (correct - per-date only) |

**Conclusion:** The issue affects ALL edit paths for monthly series. The admin route redirects to `/dashboard/my-events/[id]`, so both admin and user dashboard paths are affected.

---

## What Was Documented vs What Exists

### CLAUDE.md Documentation (Edit Form Series Controls, January 2026):

```
| recurrence_rule | Detected Mode | Controls Shown |
|-----------------|---------------|----------------|
| `"3rd"` / `"1st/3rd"` / etc. | monthly | Ordinal checkboxes + Pattern summary + Series Length |
```

The documentation says "Pattern summary" but does NOT mention a date picker or way to change day_of_week.

### Recurrence Canonicalization (Phase 4.83):

The canonicalization layer **derives** `day_of_week` from `event_date` when missing:

```typescript
// recurrenceCanonicalization.ts
if (isOrdinalMonthlyRule(recurrence_rule) && !day_of_week) {
  return deriveDayOfWeekFromDate(event_date);
}
```

But this only works on **create/save** - it doesn't help users who want to **change** the day of week for existing events.

---

## Comparison: Create vs Edit Mode

| Feature | Create Mode (Monthly) | Edit Mode (Monthly) |
|---------|----------------------|---------------------|
| Ordinal Checkboxes | ✅ | ✅ |
| Pattern Summary | ✅ | ✅ |
| Series Length | ✅ | ✅ |
| First Event Date | ✅ | ❌ MISSING |
| Day of Week Derivation | ✅ (from date) | ❌ IMPOSSIBLE |

---

## Design Intent (Inferred)

The original design appears to have intended:
1. **Create mode:** User picks a date, system derives day_of_week automatically
2. **Edit mode:** Day of week is "locked" to preserve RSVPs/overrides tied to specific occurrence dates

However, this creates a **dead-end UX** where:
- Seeded/imported events may have wrong day_of_week
- Users cannot correct mistakes
- The only workaround is to delete and recreate the series (losing all RSVPs, comments, etc.)

---

## Proposed Fix: Add "First Event Date" to Monthly Edit Mode

### Option A: Add Date Picker (Recommended)

Add the same "First Event Date" field to edit mode for monthly series that exists in create mode:

1. **Location:** Between ordinal checkboxes and series length in edit mode monthly section
2. **Initialization:** `event.event_date` (the anchor date)
3. **Behavior:** When date changes, derive new `day_of_week` via `weekdayNameFromDateMT()`
4. **Warning:** Show amber banner: "Changing the anchor date will shift all future occurrences to {new_day}"

### Option B: Add Day of Week Dropdown (Alternative)

Show the Day of Week dropdown for monthly mode too (like weekly mode):

```typescript
// Change line 876 from:
formData.series_mode === "weekly"
// To:
(formData.series_mode === "weekly" || formData.series_mode === "monthly")
```

**Pros:** Simpler change
**Cons:** Less intuitive (user picks day without seeing how it affects dates)

### Recommendation: Option A

Option A (date picker) is more consistent with create mode and provides better UX feedback about which dates will be affected.

---

## Impact Assessment

### Database Changes
- None required - `day_of_week` and `event_date` columns already exist

### Files to Modify

| File | Change |
|------|--------|
| `dashboard/my-events/_components/EventForm.tsx` | Add date picker to monthly edit mode section |

### Test Coverage Needed

| Test | Description |
|------|-------------|
| Monthly edit shows date picker | Edit mode for monthly series shows First Event Date field |
| Date change updates day_of_week | Changing date in edit mode updates `formData.day_of_week` |
| Warning shown on day change | Amber warning appears when day of week will change |
| Submit sends updated day_of_week | PATCH request includes new `day_of_week` value |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| User accidentally changes day, breaking RSVPs | Warning banner explains impact; user must explicitly change |
| Past RSVPs/overrides orphaned on day change | Past data preserved (no cascade delete); only future occurrences shift |
| Bi-directional sync complexity | Use same pattern as create mode; date → day_of_week derivation only |

---

## STOP-GATE 2: Implementation Plan Preview

Pending approval, the implementation will:

1. Add "First Event Date" field to edit mode monthly section (lines 940-1146)
2. Initialize with `event.event_date`
3. On change, derive `day_of_week` via `weekdayNameFromDateMT()`
4. Show warning banner when derived day differs from current day
5. Add tests for the new behavior
6. Update CLAUDE.md documentation

---

## Checked Against DSC UX Principles

- **§7 (UX Friction):** Current state creates friction (can't fix wrong day); fix removes friction
- **§8 (Dead States):** Current state is a dead-end (no path to correct day); fix provides escape hatch
- **§10 (Defaults):** Existing day_of_week remains default until user explicitly changes

---

## Summary

| Item | Status |
|------|--------|
| Issue confirmed | ✅ Monthly edit mode missing date picker |
| Root cause identified | ✅ Create mode has field, edit mode does not |
| Entry points audited | ✅ All paths affected (admin redirects to same form) |
| Fix proposed | ✅ Add date picker to edit mode |
| Awaiting approval | ⏳ STOP-GATE 1 complete |

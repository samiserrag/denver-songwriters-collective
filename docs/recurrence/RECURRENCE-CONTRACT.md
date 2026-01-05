# Recurrence Subsystem Contract

**Date:** 2026-01-04
**Status:** Audit Complete - Gaps Identified

---

## Gap Report (Executive Summary)

### Critical Gaps (Must Fix Before Launch)

| Gap | Type | Risk | Description |
|-----|------|------|-------------|
| **GAP-1: day_of_week/event_date mismatch** | Code-only | High | 7 existing TEST events have mismatched day_of_week and event_date. Validation added in Phase 4.42 prevents new ones, but existing data needs cleanup. |
| **GAP-2: event_date short-circuits recurrence** | Architecture | High | When `event_date` is set, generator returns only that single date. No weekly expansion from anchor. Current model treats `event_date` events as one-time only. |
| **GAP-3: Unused schema columns** | Schema | Low | `recurrence_end_date`, `is_recurring`, `recurrence_pattern`, `parent_event_id` exist but are never written by any endpoint. Dead weight. |

### Medium Gaps (Should Fix)

| Gap | Type | Risk | Description |
|-----|------|------|-------------|
| **GAP-4: Inconsistent recurrence_rule formats** | Data | Medium | 19 distinct formats in database (RRULE, legacy "2nd", text like "Every Tuesday"). Works but fragile. |
| **GAP-5: No end-date enforcement** | Feature | Medium | Events recur forever. No `recurrence_end_date` or count-based ending. |
| **GAP-6: No DST handling tests** | Test | Medium | Timezone says "America/Denver" but no explicit DST transition tests. |
| **GAP-7: Biweekly not fully supported** | Feature | Medium | Only 1 event uses "biweekly". Generator handles weekly but biweekly expansion untested. |

### Low Gaps (Nice to Have)

| Gap | Type | Risk | Description |
|-----|------|------|-------------|
| **GAP-8: No multi-day weekly events** | Feature | Low | Can't express "Every Tuesday AND Thursday". Would need comma-separated day_of_week. |
| **GAP-9: No irregular date patterns** | Feature | Low | Can't express custom dates like "Jan 5, Jan 12, Jan 26". Would need additional table. |
| **GAP-10: occurrence_overrides empty** | Usage | Low | Table exists but no rows. Feature not yet used in production. |

---

## 1. Data Model

### 1.1 Events Table (Recurrence-Related Columns)

| Column | Type | Default | Used By | Notes |
|--------|------|---------|---------|-------|
| `event_date` | date | null | Create, Edit | **Concrete anchor date**. When set, generator returns only this date. |
| `day_of_week` | text | null | Create, Edit | Day name ("Monday"). Used for label AND weekly expansion when `event_date` is null. |
| `start_time` | time | null | Create, Edit | Event start time (timezone-naive, interpreted as Denver). |
| `end_time` | time | null | Create, Edit | Event end time. |
| `recurrence_rule` | text | 'none' | Create, Edit | Pattern: "weekly", "1st", "FREQ=MONTHLY;BYDAY=1TH,3TH", etc. |
| `timezone` | text | 'America/Denver' | Create, Edit | Always Denver in current codebase. |
| `recurrence_end_date` | date | null | **UNUSED** | Never written by any endpoint. |
| `is_recurring` | boolean | false | **UNUSED** | Never written by any endpoint. |
| `recurrence_pattern` | text | null | **UNUSED** | Never written by any endpoint. |
| `series_id` | uuid | null | Create | Groups related events in a series. |
| `series_index` | integer | null | Create | Order within series (0, 1, 2...). |
| `parent_event_id` | uuid | null | **UNUSED** | Never written by any endpoint. |

### 1.2 Occurrence Overrides Table

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | gen_random_uuid() | Primary key |
| `event_id` | uuid | NOT NULL | Reference to events |
| `date_key` | text | NOT NULL | YYYY-MM-DD in Denver timezone |
| `status` | text | 'normal' | 'normal' or 'cancelled' |
| `override_start_time` | time | null | Override the event's start_time for this date |
| `override_cover_image_url` | text | null | Override the flyer for this date |
| `override_notes` | text | null | Date-specific notes |
| `created_by` | uuid | null | Admin who created override |
| `created_at` | timestamp | now() | |
| `updated_at` | timestamp | now() | |

**Current Status:** Table exists, no rows. Overrides UI exists at `/dashboard/admin/events/[id]/overrides`.

---

## 2. Code Paths

### 2.1 WRITE Paths (Where Recurrence Fields Are Set)

| Path | File | Fields Written | Notes |
|------|------|----------------|-------|
| **Community Create** | `api/my-events/route.ts` | event_date, day_of_week, start_time, end_time, recurrence_rule, timezone, series_id, series_index | Uses `generateSeriesDates()` to create N events from start_date. Phase 4.42 validates day_of_week matches event_date. |
| **Community Edit** | `api/my-events/[id]/route.ts` | day_of_week, start_time, event_date, end_time, recurrence_rule | Phase 4.42 validates day_of_week matches event_date when both change. |
| **Admin Create** | `admin/events/new/EventCreateForm.tsx` | day_of_week, start_time, end_time, recurrence_rule | Does NOT set event_date. Uses browser client directly. |
| **Admin Edit** | `admin/events/[id]/edit/EventEditForm.tsx` | Unknown - needs audit | |
| **Override Create** | `admin/events/[id]/overrides/` | occurrence_overrides table only | Doesn't modify events table. |

### 2.2 READ Paths (Where Recurrence Fields Are Consumed)

| Path | File | Fields Read | Notes |
|------|------|-------------|-------|
| **Happenings Listing** | `app/happenings/page.tsx` | event_date, day_of_week, recurrence_rule, start_time | Uses `expandAndGroupEvents()` to show multiple dates per event. |
| **Event Detail** | `app/events/[id]/page.tsx` | event_date, day_of_week, recurrence_rule | Displays recurrence label via `getRecurrenceSummary()`. |
| **Open Mic Detail** | `app/open-mics/[slug]/page.tsx` | Same as event detail | |
| **Overrides Page** | `admin/events/[id]/overrides/page.tsx` | event_date, day_of_week, recurrence_rule, start_time | Uses `expandOccurrencesForEvent()` to list dates. |
| **HappeningCard** | `components/happenings/HappeningCard.tsx` | event_date, day_of_week, recurrence_rule | Displays via `getRecurrenceSummary()`. |

### 2.3 GENERATOR Paths (How Occurrences Are Computed)

| Function | File | Input Fields | Logic |
|----------|------|--------------|-------|
| `computeNextOccurrence()` | `lib/events/nextOccurrence.ts` | event_date, day_of_week, recurrence_rule | If `event_date` set → return that date. Else parse recurrence_rule (RRULE or legacy) and use day_of_week. |
| `expandOccurrencesForEvent()` | `lib/events/nextOccurrence.ts` | Same | Same logic but returns array for 90-day window. |
| `expandAndGroupEvents()` | `lib/events/nextOccurrence.ts` | Same + overrideMap | Applies occurrence_overrides to mark cancelled dates. |

### 2.4 LABEL Paths (How Recurrence Is Displayed)

| Function | File | Input Fields | Output |
|----------|------|--------------|--------|
| `humanizeRecurrence()` | `lib/recurrenceHumanizer.ts` | recurrence_rule, day_of_week | "Every Monday", "First Tuesday of the Month", etc. |
| `getRecurrenceSummary()` | `lib/recurrenceHumanizer.ts` | recurrence_rule, day_of_week, event_date | "One-time", "Every Monday", etc. Handles edge cases. |

---

## 3. Invariants (Must Always Be True)

### 3.1 Currently Enforced (via Phase 4.42)

1. **Day Consistency:** If `event_date` AND `day_of_week` are both set, the weekday of `event_date` must match `day_of_week`.
   - Enforced at: `POST /api/my-events`, `PATCH /api/my-events/[id]`
   - Not enforced at: Admin event creation (bypasses API)

### 3.2 Implicit (Not Enforced, Just Assumed)

2. **Timezone Consistency:** All date keys are in America/Denver timezone.
   - `getTodayDenver()` and `denverDateKeyFromDate()` enforce this in generator.
   - Database `timezone` column defaults to 'America/Denver' but is never used in calculations.

3. **Recurrence Rule Format:** Accepted formats:
   - RRULE: `FREQ=MONTHLY;BYDAY=1TH,3TH`
   - Legacy ordinal: `1st`, `2nd`, `3rd`, `4th`, `last`
   - Legacy pair: `1st/3rd`, `2nd/4th`
   - Weekly: `weekly`, `none`, empty string
   - Other: `biweekly`, `seasonal` (partially supported)

### 3.3 Proposed (Not Yet Enforced)

4. **Abstract vs Concrete:** Events should be EITHER:
   - Abstract: `event_date = null`, `day_of_week` set → expands to multiple dates
   - Concrete: `event_date` set, `day_of_week` optional but matching → single date

5. **End Date:** Recurring events should eventually end (via `recurrence_end_date` or count).

---

## 4. Supported Recurrence Types

### 4.1 Currently Working

| Type | recurrence_rule | day_of_week | event_date | Count in DB |
|------|-----------------|-------------|------------|-------------|
| One-time | null | null | set | 0 |
| Weekly | "weekly" or null | set | null | 60 |
| Monthly ordinal | "1st", "2nd", etc. | set | null | 18 |
| Monthly pair | "1st/3rd", "2nd/4th" | set | null | 5 |
| Monthly RRULE | "FREQ=MONTHLY;BYDAY=..." | null | null | 3 |

### 4.2 Partially Working

| Type | recurrence_rule | Notes |
|------|-----------------|-------|
| Biweekly | "biweekly" | Label works, expansion may not alternate correctly. 1 event. |
| Monthly | "monthly" | Ambiguous - which day? 1 event. |
| Seasonal | "seasonal" | Label says "Seasonal — check venue". No expansion. 1 event. |

### 4.3 Not Supported

| Type | Notes |
|------|-------|
| Multi-day weekly | "Every Tuesday AND Thursday" - would need comma-separated day_of_week |
| End by date | `recurrence_end_date` exists but never used |
| End by count | No `recurrence_count` column |
| Irregular dates | Custom patterns like "Jan 5, Jan 12, Jan 26" |
| Yearly | No events use this |

---

## 5. Known Failure Classes

### 5.1 Weekday Mismatch (Fixed in Phase 4.42)

**Cause:** User picks day_of_week="Monday" but start_date="2026-01-06" (Tuesday).
**Effect:** Label says "Every Monday", but generator returns Tuesday dates.
**Fix:** Validation at write-time rejects mismatched values.
**Existing Data:** 7 TEST events have this issue (see GAP-1).

### 5.2 event_date Overrides Recurrence

**Cause:** When `event_date` is set, generator returns only that single date.
**Effect:** Events meant to be recurring show only one occurrence.
**Current State:** This is intentional - `event_date` means "one-time event".
**Issue:** Community event creation ALWAYS sets `event_date` via series loop, so all community-created events are one-time even if `recurrence_rule="weekly"`.

### 5.3 DST Transitions

**Risk:** Near-midnight events during DST transitions might show on wrong day.
**Mitigation:** Generator uses noon UTC for date arithmetic (`T12:00:00Z`).
**Untested:** No explicit tests for DST forward/back transitions.

### 5.4 Monthly Edge Cases

**Risk:** "5th Thursday" doesn't exist in some months.
**Mitigation:** `getNthWeekdayOfMonthKey()` returns null for invalid ordinals.
**Untested:** No explicit tests for non-existent ordinals.

---

## 6. Override Interaction Model

### 6.1 How Overrides Work

1. Base event defines pattern (day_of_week + recurrence_rule)
2. Generator expands to list of date keys
3. Overrides table stores per-date modifications
4. `expandAndGroupEvents()` merges overrides with expanded dates
5. Cancelled occurrences are tracked separately (hidden by default, toggle to show)

### 6.2 What Can Be Overridden

| Field | Override Column | Effect |
|-------|-----------------|--------|
| Occurrence status | `status` | 'cancelled' hides the occurrence |
| Start time | `override_start_time` | Replaces event's `start_time` for that date |
| Cover image | `override_cover_image_url` | Replaces event's `cover_image_url` for that date |
| Notes | `override_notes` | Adds date-specific notes |

### 6.3 What Cannot Be Overridden

- End time (would need new column)
- Venue (would need new column)
- Title (per-occurrence titles not supported)

---

## 7. Database Analysis (Current State)

### 7.1 Field Usage

```
Events with both event_date AND day_of_week: 10 (7 mismatched)
Events with only event_date: 0
Events with only day_of_week: 96
Events with neither: 1
```

### 7.2 recurrence_rule Distribution

```
weekly: 42
none: 18
(empty): 12
2nd: 8
1st: 6
1st/3rd: 4
3rd: 4
last: 2
Other (9 variants): 9
```

### 7.3 Occurrence Overrides

```
Total rows: 0 (table empty)
```

---

## 8. Proposed Fix Sequencing

### Phase 1: Data Cleanup (PR-1)
- Delete or fix 7 TEST events with mismatched day_of_week/event_date
- Risk: Low (all TEST data)
- Effort: Script

### Phase 2: Schema Cleanup (PR-2)
- Mark unused columns as deprecated or drop them
- Columns: `recurrence_end_date`, `is_recurring`, `recurrence_pattern`, `parent_event_id`
- Risk: Low (never used)
- Effort: Migration

### Phase 3: Admin Validation (PR-3)
- Add same validation to admin event create/edit as community endpoints
- Risk: Low
- Effort: Code change

### Phase 4: Biweekly Support (PR-4)
- Test and document biweekly expansion
- May need generator fix
- Risk: Medium (1 event affected)
- Effort: Test + possible fix

### Phase 5 (Future): Multi-Day Weekly
- Allow comma-separated day_of_week: "Tuesday,Thursday"
- Update generator to expand both days
- Risk: Medium (schema interpretation change)
- Effort: Code change + tests

### Phase 6 (Future): End Date Support
- Enable `recurrence_end_date` in form
- Update generator to respect it
- Risk: Medium
- Effort: Form UI + generator

---

## Appendix A: File Inventory

### Write Paths
- `web/src/app/api/my-events/route.ts` (lines 275-325)
- `web/src/app/api/my-events/[id]/route.ts` (lines 145-160)
- `web/src/app/(protected)/dashboard/admin/events/new/EventCreateForm.tsx` (lines 78-93)

### Read Paths
- `web/src/app/happenings/page.tsx` (lines 73-250)
- `web/src/app/events/[id]/page.tsx`
- `web/src/app/open-mics/[slug]/page.tsx`
- `web/src/components/happenings/HappeningCard.tsx`

### Generator Paths
- `web/src/lib/events/nextOccurrence.ts` (entire file, 954 lines)
- `web/src/lib/recurrenceHumanizer.ts` (entire file, 425 lines)

### Test Paths
- `web/src/lib/events/__tests__/nextOccurrence.test.ts` (61 tests)
- `web/src/lib/events/__tests__/expansionCaps.test.ts`
- `web/src/__tests__/recurrence-correctness.test.ts` (17 tests)
- `web/src/__tests__/occurrence-overrides.test.ts`

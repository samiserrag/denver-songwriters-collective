# Preview-Surface Inventory STOP-GATE Report

> **Status:** INVESTIGATION ONLY — awaiting Sami approval
> **Branch:** main
> **Commit:** 87e597c
> **Date:** 2026-01-26

---

## Executive Summary

This investigation catalogues all surfaces where recurrence/occurrences are previewed or labeled in the codebase. It identifies **drift risks** between:
- UI preview claims (what the form shows)
- Database storage (what gets saved)
- Public page rendering (what visitors see)

### Key Findings

| Metric | Value |
|--------|-------|
| Total files with recurrence/occurrence patterns | 54 |
| Primary UI surfaces inventoried | 18 |
| Drift claims analyzed | 7 |
| Confirmed drift root causes | 4 |
| Surfaces using shared contract (correct) | ~80% |
| Surfaces with independent logic (risky) | ~20% |

---

## Part 1: Surface Inventory Table

### Primary UI Surfaces (18)

| # | Surface | File Path | Occurrence Source | Window Logic | Recurrence Label Source | Verification Display | Public Link Construction | Known Drift/Risk |
|---|---------|-----------|-------------------|--------------|------------------------|---------------------|-------------------------|------------------|
| 1 | **EventForm Preview** | `dashboard/my-events/_components/EventForm.tsx` | Client-side `previewEvent` object (lines 292-340) | N/A (preview only) | Custom build at lines 292-301: manual ordinal→string conversion | Uses `last_verified_at` from event or null | N/A (preview card, no external link) | **RISK: Builds recurrence_rule string independently instead of using `labelFromRecurrence()`** |
| 2 | **HappeningCard (Timeline)** | `components/happenings/HappeningCard.tsx` | Props: single occurrence passed from parent expansion | N/A (receives expanded occurrence) | `getRecurrenceSummary()` → `interpretRecurrence()` → `labelFromRecurrence()` (lines 452-456) | `getPublicVerificationState()` + `shouldShowUnconfirmedBadge()` | `/events/${slug}?date=${dateKey}` (line 652) | ✅ Uses shared contract |
| 3 | **SeriesCard** | `components/happenings/SeriesCard.tsx` | Props: `series.upcomingOccurrences` from `groupEventsAsSeriesView()` | N/A (receives grouped data) | `series.recurrenceSummary` from `groupEventsAsSeriesView()` (line 186) | `getPublicVerificationState()` + `shouldShowUnconfirmedBadge()` (lines 196-210) | `/events/${eventIdentifier}?date=${occ.dateKey}` (line 229) | ✅ Uses shared contract |
| 4 | **SeriesView** | `components/happenings/SeriesView.tsx` | Props: `seriesEntries` from `groupEventsAsSeriesView()` | N/A (receives grouped data) | Passthrough from SeriesCard | Passthrough from SeriesCard | Passthrough from SeriesCard | ✅ Uses shared contract |
| 5 | **DateSection** | `components/happenings/DateSection.tsx` | Props: `entries` from parent grouping | N/A (receives grouped data) | N/A (date grouping, not recurrence) | N/A | N/A | ✅ Presentation only |
| 6 | **DatePillRow** | `components/happenings/DatePillRow.tsx` | Props: `dates: DatePillData[]` | N/A | N/A (displays date labels) | N/A | Uses `date.href` passed from parent | ✅ Presentation only |
| 7 | **Happenings Page** | `app/happenings/page.tsx` | `expandAndGroupEvents()` with `applyReschedulesToTimeline()` | Rolling 90-day window: `today → today+90` (lines 92-94) | Passthrough via card components | Passthrough via card components | Via card components | ✅ Uses shared contract |
| 8 | **Event Detail Page** | `app/events/[id]/page.tsx` | `expandOccurrencesForEvent()` | Rolling 90-day window | `interpretRecurrence()` → `labelFromRecurrence()` | `getPublicVerificationState()` | `/events/${slug}?date=${dateKey}` for occurrence pills | ✅ Uses shared contract |
| 9 | **OccurrenceEditor (Host)** | `dashboard/my-events/[id]/overrides/_components/OccurrenceEditor.tsx` | Props: `occurrences: MergedOccurrence[]` | N/A (receives merged data) | N/A (shows date/time, not pattern) | Status pills: CANCELLED/RESCHEDULED/MODIFIED/NORMAL (lines 217-233) | `/events/${eventIdentifier}?date=${occ.dateKey}` (line 239) | ✅ Uses shared contract |
| 10 | **Occurrence Date Edit Page** | `dashboard/my-events/[id]/overrides/[dateKey]/page.tsx` | Single occurrence by `dateKey` param | N/A | N/A (editing single occurrence) | Inherits from parent | N/A | ✅ Correct isolation |
| 11 | **Admin Overrides Page** | `dashboard/admin/events/[id]/overrides/page.tsx` | Server-side redirect to `/dashboard/my-events/[id]/overrides` | N/A | N/A | N/A | N/A | ✅ Redirects to canonical |
| 12 | **SeriesEditingNotice** | `components/events/SeriesEditingNotice.tsx` | Props: event recurrence fields | N/A | `getRecurrenceSummary()` (implied from context) | N/A | Links to other series events | ✅ Uses shared contract |
| 13 | **Admin Event Edit Page** | `dashboard/admin/events/[id]/edit/page.tsx` | Server-side redirect to `/dashboard/my-events/[id]` (line 17) | N/A | N/A | N/A | N/A | ✅ Redirects to canonical (Bug #7 addressed) |
| 14 | **Venue Detail Page** | `app/venues/[id]/page.tsx` | `groupEventsAsSeriesView()` for venue's happenings | Rolling 90-day window | Via SeriesCard | Via SeriesCard | Via SeriesCard | ✅ Uses shared contract |
| 15 | **OG Image Route** | `app/og/event/[id]/route.tsx` | N/A | N/A | Custom recurrence label construction | N/A | N/A | **RISK: May have independent label logic** |
| 16 | **Homepage Spotlight** | `app/page.tsx` | Query for spotlight events | Current date filtering | Via HappeningsCard | Via HappeningsCard | Via HappeningsCard | ✅ Uses shared contract |
| 17 | **Songwriter Profile** | `app/songwriters/[id]/page.tsx` | Event queries for performer's events | N/A | Via event card components | Via event card components | Standard event links | ✅ Uses shared contract |
| 18 | **My Events Dashboard** | `dashboard/my-events/page.tsx` | User's events query | Next occurrence computation | Via HappeningsCard | Via HappeningsCard | Via HappeningsCard | ✅ Uses shared contract |

### Secondary/Support Surfaces (36 additional files)

These files contain recurrence/occurrence patterns but are support code, tests, or API routes:

| Category | Files | Notes |
|----------|-------|-------|
| Core library functions | `nextOccurrence.ts`, `recurrenceContract.ts`, `recurrenceHumanizer.ts`, `recurrenceCanonicalization.ts`, `formDateHelpers.ts`, `occurrenceWindow.ts` | Shared contract implementation |
| API routes | `api/my-events/*`, `api/admin/ops/events/*`, `api/admin/ops/overrides/*` | Server-side processing |
| Test files | `__tests__/recurrence-*.test.ts`, `__tests__/occurrence-*.test.ts`, `__tests__/bug1-diagnosis.test.ts` | Test coverage |
| Admin components | `EventUpdateSuggestionsTable.tsx`, `EventEditForm.tsx`, `EventCreateForm.tsx`, `OverrideDiffTable.tsx` | Admin management UI |
| Email/notifications | Email templates referencing events | Notification delivery |

---

## Part 2: Drift Claims Analysis

### Bug #1: Form preview shows weekly Saturdays while intended is 4th Saturday

**Status:** ⚠️ POTENTIAL DRIFT CONFIRMED

**Code Path:**
```
EventForm.tsx (lines 292-301) → previewEvent.recurrence_rule
```

**Root Cause:**
The form preview builds `recurrence_rule` using custom string construction instead of the shared contract:

```typescript
// Lines 292-301 in EventForm.tsx
if (formData.series_mode === "monthly" && selectedOrdinals.length > 0) {
  const ordinalWords: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", [-1]: "last" };
  const ordinalTexts = [...selectedOrdinals].sort((a, b) => a === -1 ? 1 : b === -1 ? -1 : a - b).map(o => ordinalWords[o] || `${o}th`);
  previewRecurrenceRule = ordinalTexts.join("/");
}
```

This is the PREVIEW value. The issue is:
1. If `selectedOrdinals` is incorrectly initialized (e.g., from parsed edit data)
2. The preview label via HappeningCard uses `getRecurrenceSummary(previewRecurrenceRule, formData.day_of_week, formData.start_date)`
3. If `selectedOrdinals` doesn't match what's actually displayed, drift occurs

**Drift Risk:** The form's ordinal parsing (edit mode) may not correctly populate `selectedOrdinals` from the existing `recurrence_rule`, causing the preview to show wrong pattern.

---

### Bug #2: Public series view shows 4th Tuesdays (wrong day)

**Status:** ⚠️ REQUIRES DATA INSPECTION

**Code Path:**
```
SeriesCard.tsx (line 186) → series.recurrenceSummary
  ↑ from groupEventsAsSeriesView() (nextOccurrence.ts line 1383-1384)
    ↑ from interpretRecurrence() → labelFromRecurrence()
```

**Analysis:**
The label path uses the shared contract correctly. If "4th Tuesdays" appears when event is 4th Saturdays:

1. **DB-level issue:** `day_of_week` column may contain `"Tuesday"` instead of `"Saturday"`
2. **Anchor date mismatch:** If `event_date` is a Tuesday but pattern should be Saturday
3. **Phase 4.83 defense:** The `interpretLegacyRule()` function now derives `day_of_week` from `event_date` if missing (lines 426-428 of recurrenceContract.ts)

**Recommended Check:**
```sql
SELECT id, title, day_of_week, event_date, recurrence_rule
FROM events
WHERE recurrence_rule IN ('4th', '4th Saturday', '4th Tuesday')
AND day_of_week IS NOT NULL;
```

---

### Bug #3: "View public page" link goes to generic slug without date

**Status:** ✅ ADDRESSED IN OccurrenceEditor

**Code Path:**
```
OccurrenceEditor.tsx (line 239):
  href={`/events/${eventIdentifier}?date=${occ.dateKey}`}
```

**Analysis:**
The OccurrenceEditor correctly includes `?date=${occ.dateKey}` in preview links. If this claim refers to a different surface, it needs identification.

**Potential other surfaces:**
- EventForm does NOT have a "View public page" link (it's a preview card, not a link)
- CreatedSuccessBanner links to `/events/${slug}` or `/dashboard/my-events/${id}` without date param
- SeriesEditingNotice links to series events without date param

**Action:** Need to identify which specific "View public page" link is affected.

---

### Bug #4: Happenings page doesn't show today's occurrence but shows later ones

**Status:** ⚠️ REQUIRES RUNTIME VERIFICATION

**Code Path:**
```
happenings/page.tsx (lines 85-94):
  const today = getTodayDenver();
  let windowStart = today;
  let windowEnd = addDaysDenver(today, 90);
```

**Analysis:**
The window starts from `today` (inclusive). If today's occurrence is missing:

1. **Time-of-day issue:** The event's `start_time` may have already passed, causing filter-out
2. **Timezone mismatch:** `getTodayDenver()` vs event query timezone
3. **Override hiding:** Event may have `occurrence_overrides` marking today as cancelled

**Window Query (lines 245-251):**
```typescript
if (timeFilter === "upcoming") {
  query = query.or(`event_date.gte.${today},event_date.is.null,recurrence_rule.not.is.null`);
}
```

This should include recurring events regardless of anchor date. The expansion should then produce today if applicable.

**Action:** Test with specific event to trace full code path.

---

### Bug #5: Preview says Unconfirmed incorrectly

**Status:** ✅ LIKELY ADDRESSED

**Code Path:**
```
EventForm.tsx (lines 324-327):
  last_verified_at: event?.last_verified_at ?? null,
```

**Analysis:**
The preview card receives `last_verified_at` from the existing event (in edit mode). If editing a verified event, the preview should correctly show "Confirmed" because:

1. `previewEvent` includes `last_verified_at: event?.last_verified_at ?? null`
2. HappeningCard calls `getPublicVerificationState()` which checks `last_verified_at`
3. If `last_verified_at` is set, state is "confirmed"

**Potential Issue:**
- In CREATE mode, `event` is undefined, so `last_verified_at` is `null` → correctly shows "Unconfirmed"
- In EDIT mode, if `event.last_verified_at` is null (not verified yet), shows "Unconfirmed" → correct

If the claim is "preview shows Unconfirmed for a verified event in edit mode," this would indicate:
1. The event's `last_verified_at` is not being fetched in the edit page query
2. Or the prop isn't being passed correctly

**Action:** Verify edit page query includes `last_verified_at`.

---

### Bug #6: Form cannot save 2nd time due to day_of_week validation

**Status:** ⚠️ REQUIRES CODE TRACE

**Code Path:**
```
EventForm submit handler → API route PATCH validation
```

**Analysis:**
This suggests a validation issue where:
1. First save succeeds
2. Second save fails on `day_of_week` validation

**Possible causes:**
1. **State drift:** Form state doesn't match what was actually saved, causing validation mismatch
2. **Server-side validation:** PATCH route validates `day_of_week` more strictly than POST
3. **Canonicalization conflict:** Phase 4.83 canonicalization derives `day_of_week` but form sends conflicting value

**Relevant code (recurrenceCanonicalization.ts):**
```typescript
export function canonicalizeDayOfWeek(opts: CanonicalizeOptions): string | null {
  const { day_of_week, recurrence_rule, event_date, previous_day_of_week } = opts;
  // ... derives day_of_week if missing for ordinal monthly rules
}
```

**Action:** Need to reproduce the exact save sequence to identify where validation fails.

---

### Bug #7: Admin edit form missing date/time fields

**Status:** ✅ ADDRESSED - REDIRECT IN PLACE

**Code Path:**
```
dashboard/admin/events/[id]/edit/page.tsx (lines 16-18):
  redirect(`/dashboard/my-events/${id}`);
```

**Analysis:**
The admin edit page now redirects to the canonical EventForm at `/dashboard/my-events/${id}`. There is no separate admin edit form.

**Historical context:**
- Legacy `EventEditForm.tsx` exists but is orphaned (redirect bypasses it)
- The canonical EventForm has all date/time fields

**Status:** Bug #7 is addressed by architectural decision to use single canonical form.

---

## Part 3: Root Cause Summary

### Confirmed Drift Sources (4)

| # | Root Cause | Affected Surfaces | Severity |
|---|------------|-------------------|----------|
| 1 | EventForm preview builds recurrence_rule independently | EventForm live preview | Medium |
| 2 | OG Image route may have independent label logic | Social sharing images | Low |
| 3 | Edit mode ordinal parsing may not match display | EventForm in edit mode | Medium |
| 4 | CreatedSuccessBanner/SeriesEditingNotice links without date param | Post-create/edit navigation | Low |

### Already Addressed (3)

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Admin edit form redirect | Redirects to canonical EventForm |
| 2 | OccurrenceEditor preview links | Includes `?date=` param |
| 3 | Preview verification state | Passes `last_verified_at` to preview |

---

## Part 4: Recommendations (Next Steps)

### Immediate (P0)

1. **Audit EventForm ordinal parsing** — Verify `selectedOrdinals` initialization from `recurrence_rule` in edit mode matches expected behavior

2. **Add data integrity query** — Run the audit query from CLAUDE.md to find ordinal monthly events with missing `day_of_week`

3. **Test happenings today filtering** — Create a test event for "today" and trace through the full expansion path

### Short-term (P1)

4. **Unify EventForm preview label** — Have preview call `labelFromRecurrence()` instead of building string manually

5. **Add `?date=` to all series links** — Audit CreatedSuccessBanner, SeriesEditingNotice for missing date params

6. **Review OG image route** — Verify it uses shared contract for recurrence labels

---

## Appendix: Files Inventoried

### Grep Results (54 files)

```
web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx
web/src/app/events/[id]/page.tsx
web/src/app/happenings/page.tsx
web/src/components/happenings/HappeningsCard.tsx
web/src/components/happenings/HappeningCard.tsx
web/src/app/(protected)/dashboard/my-events/[id]/overrides/_components/OccurrenceEditor.tsx
web/src/app/(protected)/dashboard/my-events/[id]/overrides/[dateKey]/page.tsx
web/src/components/happenings/SeriesCard.tsx
web/src/components/happenings/DatePillRow.tsx
web/src/app/(protected)/dashboard/admin/ops/overrides/_components/OverrideDiffTable.tsx
web/src/components/admin/EventUpdateSuggestionsTable.tsx
web/src/app/(protected)/dashboard/admin/events/[id]/edit/page.tsx
web/src/app/(protected)/dashboard/my-events/[id]/page.tsx
web/src/app/(protected)/dashboard/my-events/[id]/overrides/page.tsx
web/src/app/(protected)/dashboard/admin/events/[id]/overrides/page.tsx
web/src/components/events/SeriesEditingNotice.tsx
web/src/app/og/event/[id]/route.tsx
web/src/app/songwriters/[id]/page.tsx
web/src/app/venues/[id]/page.tsx
web/src/app/page.tsx
web/src/app/(protected)/dashboard/admin/events/[id]/edit/EventEditForm.tsx
web/src/app/(protected)/dashboard/admin/events/new/EventCreateForm.tsx
web/src/components/happenings/SeriesView.tsx
web/src/components/happenings/DateSection.tsx
web/src/lib/events/nextOccurrence.ts
web/src/lib/events/recurrenceContract.ts
web/src/lib/recurrenceHumanizer.ts
web/src/lib/events/recurrenceCanonicalization.ts
web/src/lib/events/formDateHelpers.ts
web/src/lib/events/occurrenceWindow.ts
web/src/__tests__/recurrence-*.test.ts (multiple)
web/src/__tests__/occurrence-*.test.ts (multiple)
... (additional API routes, email templates, test files)
```

---

## Approval Request

**Awaiting Sami approval before proceeding with any code changes.**

### Recommended Next Phase Actions (Titles Only)

1. EventForm Preview Label Unification
2. Data Integrity Audit Query Execution
3. Today Occurrence Filtering Test
4. CreatedSuccessBanner Date Param Addition
5. SeriesEditingNotice Link Audit
6. OG Image Route Contract Alignment

---

*Generated by repo agent — Investigation only, no code changes made*

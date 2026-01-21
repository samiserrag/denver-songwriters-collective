# Phase 4.54 Investigation: Series View for Happenings

**Status:** STOP-GATE — Awaiting Sami approval before execution

**Goal:** Add a second list mode on `/happenings` that groups recurring events as one row per series, with next occurrence + expandable upcoming dates.

---

## 1. Current Architecture Summary

### 1.1 Recurrence Model (Runtime Expansion)

The codebase uses **runtime occurrence expansion**, NOT persistent per-occurrence DB rows:

| Aspect | Current Implementation |
|--------|------------------------|
| Event storage | Single row per recurring series |
| Occurrence generation | Computed at page load via `expandOccurrencesForEvent()` |
| Window | 90-day rolling window |
| Overrides | Stored in `occurrence_overrides` table (per event_id + date_key) |

**Key files:**
- `lib/events/nextOccurrence.ts` — Occurrence expansion logic
- `lib/events/recurrenceContract.ts` — Unified recurrence interpretation
- `lib/recurrenceHumanizer.ts` — Human-readable recurrence labels

### 1.2 Relevant Schema Fields

**events table:**

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `series_id` | UUID | Links events in same series (rarely used — only 3 events have this) |
| `series_index` | INT | Position in series |
| `day_of_week` | TEXT | Weekday name for weekly events |
| `recurrence_rule` | TEXT | RFC 5545 RRULE or legacy format |
| `event_date` | TEXT | YYYY-MM-DD start date |
| `recurrence_end_date` | TEXT | Optional end date |
| `is_recurring` | BOOL | Optimization hint |

**Current data:**
- 98 published events total
- 98 have recurrence data (day_of_week or recurrence_rule)
- Only 3 events have `series_id` set (test data)

### 1.3 Current Happenings Display

The happenings page currently:
1. Fetches all published events matching filters
2. Expands each recurring event into multiple occurrences (up to 40 per event)
3. Groups by date (`Map<dateKey, EventOccurrenceEntry[]>`)
4. Renders with `DateSection` headers and `HappeningCard` per occurrence

**Result:** A weekly event appears 13+ times in the 90-day window (once per week).

---

## 2. Series View Design

### 2.1 Canonical Series Key

Since `series_id` is rarely populated, the series key must be **derived**:

**Proposed grouping key:** `event.id` (the event's primary key)

**Rationale:**
- Each recurring event is already a single DB row representing the entire series
- No need for synthetic grouping — the event IS the series
- Events with `series_id` (form-created series with multiple DB rows) are edge cases we can address later

**Decision:** For Phase 4.54, use `event.id` as the series key. One row per recurring event.

### 2.2 Series Row Data Requirements

Each series row needs:

| Data | Source | Notes |
|------|--------|-------|
| Title | `event.title` | |
| Venue | `event.venue` or custom location | |
| Recurrence summary | `labelFromRecurrence()` | e.g., "Every Monday", "2nd & 4th Thursday" |
| Next occurrence date | `computeNextOccurrence()` | YYYY-MM-DD + formatted display |
| Next occurrence time | `event.start_time` | Override if present |
| Upcoming count | Count from `expandOccurrencesForEvent()` | Within window |
| Cover image | `event.cover_image_card_url` | |
| Event type badge | `event.event_type` | |
| Verification status | `getPublicVerificationState()` | |
| DSC badge | `event.is_dsc_event` | |

**Expandable section (on click):**
- List of upcoming occurrence dates with formatted display
- Each can link to the event detail page (with `?date=YYYY-MM-DD` if needed)

### 2.3 UI Plan

**Toggle Control:**

Add a view mode toggle to `StickyControls`:

```
[Timeline] [Series]
```

- **Timeline** (default): Current behavior — grouped by date
- **Series**: One row per recurring event

**Series Row Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ [Image]  Title                          [Every Monday] [DSC]│
│          Venue Name                                         │
│          Next: Mon, Jan 13 @ 7pm        ▼ 12 more dates    │
└─────────────────────────────────────────────────────────────┘
```

On expand (`▼ 12 more dates`):

```
┌─────────────────────────────────────────────────────────────┐
│ [Image]  Title                          [Every Monday] [DSC]│
│          Venue Name                                         │
│          Next: Mon, Jan 13 @ 7pm        ▲ Hide dates       │
│          ┌─────────────────────────────────────────────────┐│
│          │ • Mon, Jan 20 @ 7pm                             ││
│          │ • Mon, Jan 27 @ 7pm                             ││
│          │ • Mon, Feb 3 @ 7pm                              ││
│          │ ... (scrollable if many)                        ││
│          └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**One-time events in series view:**
- Still appear as individual rows
- Show "One-time" badge instead of recurrence summary
- Date shown directly (not "Next:")

### 2.4 Sorting in Series View

| Option | Implementation |
|--------|----------------|
| Default | Sort by next occurrence date (ascending) |
| Alternative | Sort by recurrence frequency (weekly first, then monthly, then one-time) |

**Recommendation:** Sort by next occurrence date. Most useful for discovery.

---

## 3. Implementation Approach

### 3.1 Query Strategy

**No query changes needed.** The current query already fetches all events with their recurrence fields. The difference is only in how we group/render.

### 3.2 New Function: `groupEventsAsSeriesView()`

Create a new function in `nextOccurrence.ts`:

```typescript
interface SeriesEntry<T> {
  event: T;
  nextOccurrence: NextOccurrenceResult;
  upcomingOccurrences: ExpandedOccurrence[];
  recurrenceSummary: string;
}

function groupEventsAsSeriesView<T extends EventForOccurrence>(
  events: T[],
  options?: ExpansionOptions
): SeriesEntry<T>[] {
  // For each event:
  // 1. Compute next occurrence
  // 2. Expand all occurrences in window
  // 3. Get recurrence summary label
  // Return sorted by next occurrence date
}
```

### 3.3 Component Changes

| Component | Change |
|-----------|--------|
| `StickyControls.tsx` | Add view mode toggle (timeline/series) |
| `happenings/page.tsx` | Conditional rendering based on view mode |
| `SeriesCard.tsx` (NEW) | Series row component with expand/collapse |
| `SeriesView.tsx` (NEW) | Container for series mode rendering |

### 3.4 URL Param

Add `view` param to search params:

- `?view=timeline` (default, current behavior)
- `?view=series` (new series view)

---

## 4. Risk Analysis

### 4.1 Performance

| Concern | Mitigation |
|---------|------------|
| Double expansion (timeline + series) | Only expand for active view mode |
| Large event counts | Existing caps apply (200 events, 500 total occurrences) |
| Client-side expansion | Already client-side; no additional overhead |

### 4.2 UX Considerations

| Concern | Mitigation |
|---------|------------|
| User confusion | Clear toggle labels; persist preference in localStorage |
| Filter interaction | All existing filters apply equally to both views |
| Mobile layout | Series rows should be touch-friendly with larger tap targets |

### 4.3 Breaking Changes

**None.** This is additive:
- Timeline view remains default
- All existing URLs work unchanged
- SEO unaffected (server renders timeline by default)

---

## 5. Test Plan

### 5.1 Unit Tests

| Test | Description |
|------|-------------|
| `groupEventsAsSeriesView` returns one entry per event | |
| Next occurrence computed correctly | |
| Upcoming occurrences list populated | |
| Recurrence summary matches expansion | |
| One-time events handled correctly | |
| Cancelled occurrences excluded from upcoming | |

### 5.2 Integration Tests

| Test | Description |
|------|-------------|
| View toggle switches between modes | |
| Filters apply to series view | |
| Sorting by next occurrence works | |
| Expand/collapse functionality | |
| URL param persistence | |

### 5.3 Visual Tests

| Test | Description |
|------|-------------|
| Series card layout matches design | |
| Mobile responsiveness | |
| Expand animation smooth | |
| Long occurrence lists scrollable | |

---

## 6. Implementation Steps

1. Add `groupEventsAsSeriesView()` to `nextOccurrence.ts`
2. Add `view` param to `HappeningsSearchParams`
3. Create `SeriesCard.tsx` component
4. Create `SeriesView.tsx` container
5. Add toggle to `StickyControls.tsx`
6. Conditional rendering in `happenings/page.tsx`
7. Add localStorage preference persistence
8. Write tests
9. Update CLAUDE.md

**Estimated scope:** ~300-400 lines of new code

---

## 7. Open Questions for Approval

1. **Toggle placement:** In StickyControls next to filters, or as a separate control?

2. **Expand behavior:** Should clicking anywhere on the series row go to event detail, or only the title? (Expand via chevron only?)

3. **Date linking:** Should expanded dates link to event detail with `?date=YYYY-MM-DD` for override display, or just the base event URL?

4. **Default view:** Should series view ever be the default (e.g., for certain filter combinations)?

---

## 8. STOP-GATE Checklist

- [x] Schema fields identified
- [x] Grouping rule defined (event.id)
- [x] Query plan documented (no changes)
- [x] UI plan detailed
- [x] Test plan outlined
- [x] No auth/admin uncertainty

**Approved and Implemented.**

---

## 9. Implementation Notes

**Implemented:** January 2026

**Approved Decisions:**
1. Toggle in StickyControls next to date jump control
2. Expand/collapse via chevron only (row click navigates to event detail)
3. Date links use base event URL without `?date=` param (deferred feature)
4. Timeline remains default, Series view via `?view=series`
5. Cap expanded dates at 12 (SERIES_VIEW_MAX_UPCOMING)

**Deferred:**
- `?date=YYYY-MM-DD` param support for event detail pages (would show occurrence-specific overrides)

**Files Created:**
- `components/happenings/SeriesCard.tsx` - Individual series row component
- `components/happenings/SeriesView.tsx` - Container for series mode
- `__tests__/phase4-54-series-view.test.ts` - Test suite (27 tests)

**Files Modified:**
- `lib/events/nextOccurrence.ts` - Added `groupEventsAsSeriesView()`, `SeriesEntry`, `SeriesViewResult`
- `components/happenings/StickyControls.tsx` - Added Timeline/Series toggle
- `app/happenings/page.tsx` - Conditional rendering based on view mode

# Phase ABC #4: Venue Pages Should Show Happenings

**Status:** RESOLVED (Implemented)
**Created:** January 2026
**Purpose:** Fix venue pages not showing happenings, and design series UX for venues

---

## Problem Statement

Venue detail pages (`/venues/[id]`) show "No upcoming happenings at this venue" even when the venue clearly has events in the database. Additionally, the UX needs to support the "series view" pattern where recurring events are shown as series rather than individual date occurrences.

---

## 1. Root Cause Analysis

### Current Implementation (Broken)

**File:** `web/src/app/venues/[id]/page.tsx` (lines 68-102)

```typescript
// Query upcoming events at this venue
const { data: events } = await supabase
  .from("events")
  .select(`...`)
  .eq("venue_id", id)
  .eq("is_published", true)
  .in("status", ["active", "needs_verification"])
  .or(`event_date.gte.${today},event_date.is.null`)  // <-- BUG HERE
  .order("event_date", { ascending: true, nullsFirst: false });
```

**Problem:** The query filters by `event_date.gte.${today}` which:
1. Excludes recurring events that have a past `event_date` as their anchor
2. Does NOT expand recurring events to multiple occurrences
3. Misunderstands the recurrence model

### Recurrence Model (Correct)

Per the recurrence contract (`lib/events/recurrenceContract.ts`):

| Field | Meaning |
|-------|---------|
| `event_date` | Anchor date (first occurrence OR one-time date) |
| `day_of_week` | Recurring day (e.g., "Monday") |
| `recurrence_rule` | Frequency (e.g., "weekly", "monthly") |
| `is_recurring` | Whether event repeats |

**A recurring event with `event_date=2025-12-01` and `day_of_week=Monday` should still appear on future Mondays.**

The current query breaks this by filtering `event_date >= today`.

### Happenings Page (Working)

**File:** `web/src/app/happenings/page.tsx` (lines 300-316)

The happenings page correctly uses `expandAndGroupEvents()`:

```typescript
const {
  groupedEvents: expandedGroups,
  cancelledOccurrences,
  unknownEvents,
  metrics: expansionMetrics,
} = expandAndGroupEvents(
  list as any[],
  {
    startKey: windowStart,
    endKey: windowEnd,
    maxOccurrences: 40,
    overrideMap,
  }
);
```

This function:
1. Takes raw event records
2. Expands recurring events to individual date occurrences
3. Applies occurrence overrides (cancellations, time changes)
4. Groups by date for timeline view

---

## 2. Data Surface

### Database Counts

| Metric | Value |
|--------|-------|
| Total venues | 87 |
| Venues with happenings | 72 |
| Total events | 78 |
| Recurring events | 16 |

### Sample Venues with Happenings

| Venue | Happening Count | Recurring |
|-------|-----------------|-----------|
| Rails End Beer Company | 2 | 0 |
| Brewery Rickoli | 2 | 0 |
| Node Arts Collective | 2 | 1 |
| A-Lodge Lyons / The Rock Garden | 2 | 0 |
| The Pearl Denver | 2 | 0 |
| The Pearl / Mercury Cafe | 2 | 0 |

---

## 3. Proposed Fix Options

### Option A: Timeline View (Match Happenings Page)

Import and use `expandAndGroupEvents()` to show individual date occurrences.

**Pros:**
- Consistent with `/happenings` page UX
- Shows specific dates users can attend
- Easy to understand

**Cons:**
- Potentially many cards for weekly recurring events (13+ per event)
- May overwhelm small venues with few events
- Duplicates visual information

### Option B: Series View (One Card Per Series)

Use `groupEventsAsSeriesView()` to show one card per event series.

**Pros:**
- Cleaner UX for recurring events
- Shows "Every Monday at 7pm" as one item
- Already implemented in `/happenings?view=series`

**Cons:**
- Requires adapting SeriesCard for venue context
- Less specific (no exact dates shown)
- Different from happenings default

### Option C: Hybrid (Series + Next Occurrence)

Show series view with "Next: Jan 15" badge on each card.

**Pros:**
- Clean presentation + actionable date
- Best of both worlds
- Matches user mental model

**Cons:**
- More complex implementation
- Requires new component logic

---

## 4. Recommended Approach

**Option B (Series View)** with enhancements:

1. Import `groupEventsAsSeriesView()` from `nextOccurrence.ts`
2. Query all events at venue (remove `event_date >= today` filter)
3. Filter to only show events with future occurrences
4. Render using `SeriesCard` component
5. Sort by next occurrence date

This matches the established pattern in SeriesView.tsx (Phase 4.54/4.57).

---

## 5. Implementation Plan

### Step 1: Fix Query (Remove Date Filter)

```typescript
// BEFORE (broken)
.or(`event_date.gte.${today},event_date.is.null`)

// AFTER (correct)
// Remove this filter entirely - let occurrence expansion handle dates
```

### Step 2: Add Occurrence Expansion

```typescript
import {
  groupEventsAsSeriesView,
  buildOverrideMap,
  getTodayDenver,
  addDaysDenver
} from "@/lib/events/nextOccurrence";

const today = getTodayDenver();
const windowEnd = addDaysDenver(today, 90);

// Query overrides for this venue's events
const { data: overridesData } = await supabase
  .from("occurrence_overrides")
  .select("event_id, date_key, status, override_start_time")
  .in("event_id", eventIds)
  .gte("date_key", today)
  .lte("date_key", windowEnd);

const overrideMap = buildOverrideMap(overridesData || []);

// Expand to series view
const { series, unknownEvents } = groupEventsAsSeriesView(
  events,
  { startKey: today, endKey: windowEnd, overrideMap }
);
```

### Step 3: Render SeriesCard

```tsx
{series.map((entry) => (
  <SeriesCard
    key={entry.event.id}
    event={entry.event}
    upcomingDates={entry.upcomingDates}
  />
))}
```

### Step 4: Handle Unknown Schedule

Show "Schedule Unknown" section for events without computable next occurrence.

---

## 6. Files to Modify

| File | Change |
|------|--------|
| `app/venues/[id]/page.tsx` | Remove date filter, add expansion, use SeriesCard |
| (none) | `groupEventsAsSeriesView` already exported from `nextOccurrence.ts` |
| (none) | `SeriesCard` already exported from happenings components |

---

## 7. FK / Schema Impact

**None.** This is a query and presentation fix only. No database changes required.

---

## 8. Risks

| Risk | Mitigation |
|------|------------|
| Performance (many events) | Cap at 40 occurrences (existing limit) |
| Visual regression | Use existing SeriesCard component |
| Edge cases (no events) | Already handled with empty state UI |

---

## 9. Test Coverage Needed

| Test | Description |
|------|-------------|
| `venue-happenings-expansion.test.ts` | Verify recurring events appear on venue page |
| | Verify one-time events appear correctly |
| | Verify past anchor dates don't exclude recurring events |
| | Verify cancelled occurrences are hidden |
| | Verify series view shows "Every X" pattern |

---

## 10. Implementation Complete

**Status:** IMPLEMENTED (January 2026)

### Changes Made

**File:** `web/src/app/venues/[id]/page.tsx`

| Change | Description |
|--------|-------------|
| Removed date filter | Removed `.or(\`event_date.gte.${today},event_date.is.null\`)` |
| Added fields | Added `is_recurring`, `ordinal_pattern` to event query |
| Override query | Query `occurrence_overrides` for venue's events within 90-day window |
| Series grouping | Use `groupEventsAsSeriesView()` to create series entries |
| Separate sections | "Recurring Series" and "One-Time Events" sections |
| Unknown schedule | "Schedule Unknown" section for uncomputable events |
| SeriesCard render | Uses existing `SeriesCard` component from happenings |

### UI Structure

```
Happenings at [Venue Name]
├── Recurring Series
│   └── [SeriesCard: "Every Monday" with expandable dates]
├── One-Time Events (or "Upcoming Events" if no recurring)
│   └── [SeriesCard: specific date]
└── Schedule Unknown (if any)
    └── [Simple link cards]
```

### Test Coverage

**File:** `web/src/__tests__/venue-series-view.test.ts`

| Test | Description |
|------|-------------|
| Recurring with past anchor | Weekly event with past event_date appears with future occurrences |
| Multiple occurrences | Weekly events show ~13 occurrences in 90-day window |
| One-time future | Future one-time events appear correctly |
| One-time past | Past one-time events excluded (no upcoming occurrences) |
| Mixed categorization | Correctly separates recurring from one-time |
| Sort by next occurrence | Events sorted by soonest upcoming date |
| Unknown schedule | Events without computable schedule go to unknownEvents |
| Override support | Function accepts overrideMap for cancellations |
| Empty venue | Handles venue with no events gracefully |
| Integration pattern | Validates recurring/one-time filtering pattern |

**Test count:** 10 new tests (1624 total passing)

### Verification Checklist

- [x] Recurring event with past anchor date appears on venue page
- [x] SeriesCard shows recurrence summary (e.g., "Every Monday")
- [x] Expand chevron shows upcoming dates
- [x] One-time events appear in separate section
- [x] Empty state shows when no happenings
- [x] Clicking event links to `/events/[slug]` detail page

---

**END OF INVESTIGATION — RESOLVED**

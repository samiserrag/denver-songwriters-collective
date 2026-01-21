# Phase ABC7 Investigation: Admin & Host Date-Awareness for Per-Occurrence Data

> **Status: RESOLVED** — Implementation complete January 2026.

## Executive Summary

Phase ABC6 introduced per-occurrence data scoping with `date_key` (YYYY-MM-DD Denver timezone) for RSVPs, comments, timeslots, and guest verifications. The public-facing surfaces were updated to be date-aware.

**This investigation audits all admin and host surfaces** to identify which remain "series-blended" — querying by `event_id` only without `date_key` scoping. These surfaces will show misleading aggregated data or perform incorrect actions now that data is occurrence-scoped.

### Key Findings (Post-Implementation)

| Category | Total Surfaces | Series-Blended | Date-Aware | Notes |
|----------|----------------|----------------|------------|-------|
| Host Dashboard | 6 | 2 | **4** | Lineup + TV display + counts fixed |
| Admin Dashboard | 4 | **4** | 0 | Deferred (acceptable series-level) |
| User Dashboard | 3 | 1 | **2** | RSVPCard + My RSVPs fixed |
| API Endpoints | 8 | 1 | **7** | Host RSVP API fixed |
| CSV Exports | 2 | 1 | 1 | Events CSV correct as series-level |
| **Total** | 23 | 9 | **14** | 6 surfaces fixed in ABC7 |

**Issues Fixed in ABC7:**
1. ~~**My Events RSVP counts**~~ — **FIXED**: Shows next-occurrence count only
2. ~~**Lineup control page**~~ — **FIXED**: Date selector + filter by date_key
3. ~~**RSVPCard cancel action**~~ — **FIXED**: Passes `date_key` to DELETE
4. ~~**My RSVPs page**~~ — **FIXED**: Includes date_key, displays occurrence date
5. ~~**Host RSVP API**~~ — **FIXED**: Accepts date_key param, filters RSVPs
6. ~~**TV display page**~~ — **FIXED**: Accepts ?date= param, filters by date_key

**Deferred (Acceptable):**
- Admin verification queue — Series totals are acceptable for admin overview
- MyEventsFilteredList — Can be enhanced later if needed
- Events CSV export — Series-level is correct (events are series entities)

---

## 1. Inventory Table: Admin/Host Entry Points

### 1.1 Host Dashboard Surfaces

| Surface | Path | Role | Status |
|---------|------|------|--------|
| My Events list | `/dashboard/my-events/page.tsx` | Host | Series-blended |
| My Events edit | `/dashboard/my-events/[id]/page.tsx` | Host | Series-blended |
| Lineup control | `/events/[id]/lineup/page.tsx` | Host | Series-blended |
| TV display | `/events/[id]/display/page.tsx` | Host | Series-blended |
| Host RSVP list API | `/api/my-events/[id]/rsvps/route.ts` | Host | Series-blended |
| MyEventsFilteredList | `MyEventsFilteredList.tsx` | Host | Series-blended |

### 1.2 Admin Dashboard Surfaces

| Surface | Path | Role | Status |
|---------|------|------|--------|
| Manage Happenings | `/dashboard/admin/events/page.tsx` | Admin | Series-level (no per-occurrence data) |
| Verification Queue | `/dashboard/admin/open-mics/page.tsx` | Admin | Series-blended (RSVP/claim counts) |
| EventSpotlightTable | `EventSpotlightTable.tsx` | Admin | No occurrence data shown |
| VerificationQueueTable | `VerificationQueueTable.tsx` | Admin | Series-blended counts |

### 1.3 User Dashboard Surfaces

| Surface | Path | Role | Status |
|---------|------|------|--------|
| My RSVPs | `/dashboard/my-rsvps/page.tsx` | User | Series-blended |
| RSVPCard | `RSVPCard.tsx` | User | Series-blended (cancel action) |
| Main Dashboard | `/dashboard/page.tsx` | User | Series-blended counts |

### 1.4 Public Surfaces (Already Date-Aware)

| Surface | Path | Status |
|---------|------|--------|
| Event detail page | `/events/[id]/page.tsx` | Date-aware |
| AttendeeList | `AttendeeList.tsx` | Date-aware (accepts `dateKey` prop) |
| EventComments | `EventComments.tsx` | Date-aware |
| RSVPButton | `RSVPButton.tsx` | Date-aware |
| RSVPSection | `RSVPSection.tsx` | Date-aware |
| TimeslotSection | `TimeslotSection.tsx` | Date-aware |

---

## 2. Query Shape Analysis

### 2.1 Series-Blended Queries (MUST FIX)

#### My Events RSVP Count (`/dashboard/my-events/page.tsx`)
```typescript
// Line ~75 (within query or aggregation)
const { count } = await supabase
  .from("event_rsvps")
  .select("*", { count: "exact", head: true })
  .eq("event_id", event.id)
  .eq("status", "confirmed");
// ❌ Missing: .eq("date_key", effectiveDateKey)
```
**Impact:** Shows total RSVPs across ALL occurrences. A weekly event could show "50 RSVPs" when each occurrence only has 5-10.

#### Host RSVP List API (`/api/my-events/[id]/rsvps/route.ts`)
```typescript
// Line ~25-30
const { data: rsvps, error } = await supabase
  .from("event_rsvps")
  .select("*")
  .eq("event_id", eventId)
  .order("status", { ascending: true });
// ❌ Missing: .eq("date_key", dateKey)
```
**Impact:** Returns RSVPs from ALL occurrences mixed together. Host can't see who's coming to which date.

#### Lineup Control Page (`/events/[id]/lineup/page.tsx`)
```typescript
// Line ~45-50
const { data: slots } = await supabase
  .from("event_timeslots")
  .select("id, slot_index, start_offset_minutes, duration_minutes")
  .eq("event_id", eventId)
  .order("slot_index");
// ❌ Missing: .eq("date_key", dateKey)
```
**Impact:** Shows timeslots from ALL occurrences. Host can't manage lineup for specific date.

#### TV Display Page (`/events/[id]/display/page.tsx`)
```typescript
// Same pattern as lineup - queries timeslots/claims by event_id only
// ❌ Missing: .eq("date_key", dateKey)
```
**Impact:** Display shows performers from wrong occurrences.

#### Admin Verification Queue (`/dashboard/admin/open-mics/page.tsx`)
```typescript
// Line ~85-90
const { data: rsvpCounts } = await serviceClient
  .from("event_rsvps")
  .select("event_id")
  .in("event_id", eventIds);
// ❌ Aggregates series-level, no date_key grouping
```
**Impact:** Shows inflated RSVP counts across all occurrences.

#### My RSVPs Page (`/dashboard/my-rsvps/page.tsx`)
```typescript
// Line ~48-57
const { data } = await supabase
  .from("event_rsvps")
  .select(`id, status, waitlist_position, offer_expires_at, created_at,
    event:events(id, title, event_date, ...)`)
  .eq("user_id", userId)
  .in("status", ["confirmed", "waitlist", "offered"]);
// ❌ Missing: date_key in select and filtering
// ❌ Cannot distinguish which occurrence the RSVP is for
```
**Impact:** User can't tell which occurrence their RSVP applies to.

#### RSVPCard Cancel Action (`RSVPCard.tsx`)
```typescript
// Line ~112-114
const res = await fetch(`/api/events/${event.id}/rsvp`, {
  method: "DELETE",
});
// ❌ Missing: ?date_key=${rsvp.date_key}
```
**Impact:** DELETE endpoint needs date_key to know which RSVP to cancel. Currently relies on API to resolve effective date_key, which may be wrong.

### 2.2 Date-Aware Queries (Already Fixed in ABC6)

#### Public RSVP API (`/api/events/[id]/rsvp/route.ts`)
```typescript
// GET handler - Line ~36
const providedDateKey = url.searchParams.get("date_key");
const dateKeyResult = await resolveEffectiveDateKey(eventId, providedDateKey);
// ...
.eq("date_key", effectiveDateKey)  // ✅ Scoped by date_key

// POST handler - Line ~94-99
const dateKeyResult = await validateDateKeyForWrite(eventId, providedDateKey);
.eq("date_key", effectiveDateKey)  // ✅ Scoped by date_key

// DELETE handler - Line ~252
const providedDateKey = url.searchParams.get("date_key");
.eq("date_key", effectiveDateKey)  // ✅ Scoped by date_key
```

#### Public Comments API (`/api/events/[id]/comments/route.ts`)
```typescript
// GET handler - Line ~22-30
const providedDateKey = url.searchParams.get("date_key");
const dateKeyResult = await resolveEffectiveDateKey(eventId, providedDateKey);
.eq("date_key", effectiveDateKey)  // ✅ Scoped by date_key

// POST handler - Line ~96-100
const dateKeyResult = await validateDateKeyForWrite(eventId, providedDateKey);
.eq("date_key", effectiveDateKey)  // ✅ Scoped by date_key
```

---

## 3. Action Safety Audit

### 3.1 BLOCKING — Write Actions Without Date Scoping

These actions modify data and MUST have correct date_key scoping:

| Action | Location | Risk | Severity |
|--------|----------|------|----------|
| Cancel RSVP | `RSVPCard.tsx:112` | May cancel wrong occurrence | **BLOCKING** |
| Delete draft | `MyEventsFilteredList.tsx:127` | Safe (drafts don't have RSVPs) | Low |
| Verify event | `VerificationQueueTable.tsx` | Series-level (correct) | Safe |
| Cancel event | Admin routes | Series-level (correct) | Safe |

#### RSVPCard Cancel — BLOCKING Issue

```typescript
// Current code (RSVPCard.tsx:112)
const res = await fetch(`/api/events/${event.id}/rsvp`, {
  method: "DELETE",
});

// The API endpoint uses resolveEffectiveDateKey() which computes
// the NEXT occurrence date if no date_key provided.
// This could cancel the WRONG RSVP if user has multiple RSVPs
// for different occurrences of the same series.
```

**Fix Required:** RSVPCard must include `date_key` in the DELETE request:
```typescript
const res = await fetch(`/api/events/${event.id}/rsvp?date_key=${rsvp.date_key}`, {
  method: "DELETE",
});
```

### 3.2 NON-BLOCKING — Read-Only Aggregations

These show misleading data but don't corrupt:

| Surface | Issue | Severity |
|---------|-------|----------|
| My Events RSVP count | Shows total across all occurrences | Medium |
| Admin queue counts | Shows inflated series totals | Medium |
| My RSVPs list | Missing occurrence context | Medium |
| Lineup control | Shows all-date timeslots | High |
| TV display | Wrong performers shown | High |

---

## 4. CSV/Export Audit

### 4.1 Events CSV Export (`/lib/ops/eventCsvParser.ts`)

```typescript
export const EVENT_CSV_HEADERS = [
  "id", "title", "event_type", "status", "is_recurring",
  "event_date", "day_of_week", "start_time", "end_time",
  "venue_id", "is_published", "notes",
] as const;
// ❌ No date_key column - exports are series-level
```

**Impact:** Events CSV exports the series definition, not per-occurrence data. This is **correct** — events are series-level entities.

**However:** If admin wants to export RSVPs or comments, those would need a separate export with `date_key` column.

### 4.2 Overrides CSV Export (`/lib/ops/overrideCsvParser.ts`)

```typescript
export const OVERRIDE_CSV_HEADERS = [
  "event_id", "date_key", "status",
  "override_start_time", "override_notes", "override_cover_image_url",
] as const;
// ✅ date_key is the second column - occurrence-aware
```

**Status:** Overrides CSV is already date-aware. This is correct as overrides are per-occurrence.

### 4.3 Missing Exports

No CSV export exists for:
- RSVPs (would need date_key column)
- Comments (would need date_key column)
- Timeslot claims (would need date_key from joined timeslot)

---

## 5. UX Date Selection Model

### 5.1 Current State

| Surface | Date Selection | Default Behavior |
|---------|----------------|------------------|
| Event detail page | `?date=YYYY-MM-DD` query param | Next occurrence |
| AttendeeList | `dateKey` prop | Required by caller |
| RSVPButton | Gets date from page context | Page provides it |
| My RSVPs page | None | Shows all RSVPs |
| My Events page | None | Shows series-level |
| Lineup control | None | Shows all dates mixed |

### 5.2 Required Changes

For per-occurrence host/admin surfaces:

1. **My Events → Individual Event**
   - Edit page needs occurrence selector
   - "View RSVPs for: [Jan 18] [Jan 25] [Feb 1]..." date pills
   - Selected date passed to RSVP list API

2. **Lineup Control**
   - Must have date selector at top
   - Default to next occurrence
   - Only show timeslots/claims for selected date

3. **TV Display**
   - Must accept `?date=YYYY-MM-DD` param
   - Only show performers for that date

4. **My RSVPs**
   - Include RSVP `date_key` in query
   - Display occurrence date in card
   - Pass `date_key` to cancel action

---

## 6. Summary: Surfaces That Must Change in ABC7

### 6.1 BLOCKING — Must Fix Before Safe Use

| Surface | File | Issue | Fix | Status |
|---------|------|-------|-----|--------|
| RSVPCard cancel | `RSVPCard.tsx` | No date_key in DELETE | Pass `rsvp.date_key` to API | **FIXED in ABC7** |
| My RSVPs query | `my-rsvps/page.tsx` | Missing date_key select | Add `date_key` to select | **FIXED in ABC7** |

### 6.2 HIGH PRIORITY — Misleading UX

| Surface | File | Issue | Fix | Status |
|---------|------|-------|-----|--------|
| Lineup control | `/events/[id]/lineup/page.tsx` | All-date timeslots | Add date selector + filter | **FIXED in ABC7** |
| TV display | `/events/[id]/display/page.tsx` | All-date performers | Add date param + filter | **FIXED in ABC7** |
| Host RSVP API | `/api/my-events/[id]/rsvps/route.ts` | All-date RSVPs | Accept + use date_key | **FIXED in ABC7** |

### 6.3 MEDIUM PRIORITY — Cosmetic Aggregation Issues

| Surface | File | Issue | Fix | Status |
|---------|------|-------|-----|--------|
| My Events RSVP count | `my-events/page.tsx` | Series total | Show next-occurrence count | **FIXED in ABC7** |
| MyEventsFilteredList | `MyEventsFilteredList.tsx` | Series total | Show next-occurrence count | DEFERRED |
| Admin queue counts | `open-mics/page.tsx` | Series totals | Optional: per-occurrence breakdown | DEFERRED |

### 6.4 LOW PRIORITY — Acceptable as Series-Level

| Surface | File | Status |
|---------|------|--------|
| Events CSV export | `eventCsvParser.ts` | Series-level is correct |
| Event verification | Admin routes | Series-level is correct |
| Event cancellation | Admin routes | Series-level is correct |

---

## 7. Schema Reference (from ABC6)

Tables with `date_key` column (YYYY-MM-DD):
- `event_rsvps.date_key` — Required
- `event_comments.date_key` — Required
- `event_timeslots.date_key` — Required
- `guest_verifications.date_key` — Required

Tables that inherit date scoping via FK:
- `timeslot_claims` — via `timeslot_id` → `event_timeslots`

---

## 8. Recommendations

### 8.1 Immediate Actions (ABC7 Implementation)

1. **Fix RSVPCard cancel action** (BLOCKING)
   - Add `date_key` to RSVPCard props
   - Pass to DELETE request

2. **Update My RSVPs page**
   - Include `date_key` in RSVP select
   - Display occurrence date
   - Pass to RSVPCard

3. **Add date selector to Lineup Control**
   - Date picker/pills UI
   - Filter timeslots by date_key
   - Default to next occurrence

4. **Add date param to TV Display**
   - Accept `?date=` param
   - Filter display data

5. **Update Host RSVP list API**
   - Accept `date_key` query param
   - Return filtered RSVPs

### 8.2 Optional Improvements

- My Events page: Show RSVP count breakdown by occurrence
- Admin queue: Add per-occurrence drill-down
- New export: RSVPs CSV with date_key column

---

## 9. STOP-GATE Checklist

- [x] All admin/host surfaces inventoried
- [x] Query shapes documented
- [x] Write actions audited for safety
- [x] CSV exports reviewed
- [x] UX date selection model documented
- [x] BLOCKING vs NON-BLOCKING categorized
- [x] **BLOCKING fixes implemented**
- [x] **HIGH priority fixes implemented**
- [x] **MEDIUM priority fixes: My Events counts implemented, others deferred**

**Status: RESOLVED** — ABC7 implementation complete.

---

*Investigation completed: January 2026*
*Implementation completed: January 2026*
*Author: Claude Code Agent*

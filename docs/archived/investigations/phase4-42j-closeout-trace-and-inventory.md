# Phase 4.42j Closeout: Trace, Inventory & UX Map

**Investigation Date:** January 2026
**Status:** Complete — Final pre-execution investigation

---

## 1. Create → Publish → Happenings Visibility Trace

### Query Chain: Which Code Runs Where?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: EventForm Submit (Create)                                          │
│  File: EventForm.tsx → POST /api/my-events                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: API Creates Event(s)                                               │
│  File: app/api/my-events/route.ts                                           │
│                                                                              │
│  Fields Set on INSERT:                                                       │
│  ├── host_id: session.user.id                                               │
│  ├── title, description, event_type, ...                                    │
│  ├── status: is_published ? "active" : "draft"                              │
│  ├── is_published: true/false                                               │
│  ├── published_at: is_published ? NOW() : null                              │
│  ├── source: "community"  ← ALWAYS for EventForm creates                    │
│  ├── last_verified_at: NOT SET (DB default: null)                           │
│  ├── event_date: from generateSeriesDates() ← BUGGY                         │
│  ├── series_id: UUID if count > 1, else null                                │
│  └── series_index: 0, 1, 2... for series                                    │
│                                                                              │
│  CRITICAL: last_verified_at is NEVER set on create                          │
│  → ALL new events are "unconfirmed" by verification.ts logic                │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Redirect to Edit Page                                              │
│  File: app/(protected)/dashboard/my-events/[id]/page.tsx                    │
│                                                                              │
│  Query:                                                                      │
│  supabase.from("events").select("*, venues(...), event_hosts(...)")         │
│    .eq("id", eventId).single()                                              │
│                                                                              │
│  NO FILTERS on is_published or status                                       │
│  → Owner can always see their own event                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Public Event Page                                                  │
│  File: app/events/[id]/page.tsx                                             │
│                                                                              │
│  Query:                                                                      │
│  supabase.from("events").select("*, venues(...), event_hosts(...)")         │
│    .eq("id", id) OR .eq("slug", id)                                         │
│    .single()                                                                │
│                                                                              │
│  VISIBILITY CHECK (lines 195-205):                                          │
│  if (!event.is_published && !isOwner && !isAdmin) → 404                     │
│                                                                              │
│  VERIFICATION BANNER (line 532):                                            │
│  if (isUnconfirmed && !isCancelled) → shows amber banner                    │
│  Banner text: "imported from an external source" ← BUG                      │
│  Should check: source === "import" vs source === "community"                │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: Happenings Listing                                                 │
│  File: app/happenings/page.tsx                                              │
│                                                                              │
│  BASE QUERY (lines 78-85):                                                  │
│  supabase.from("events")                                                    │
│    .select("*, venues!left(...)")                                           │
│    .eq("is_published", true)     ← REQUIRED                                 │
│    .in("status", ["active", "needs_verification"])  ← REQUIRED              │
│                                                                              │
│  OPTIONAL FILTERS:                                                          │
│  ├── event_type (if ?type=open_mic)                                         │
│  ├── is_dsc_event (if ?dsc=1)                                               │
│  ├── location_mode (if ?location=...)                                       │
│  ├── is_free (if ?cost=...)                                                 │
│  └── event_date < today (if ?time=past)                                     │
│                                                                              │
│  NOT FILTERED BY:                                                           │
│  ├── last_verified_at (verification status doesn't affect visibility)       │
│  ├── source (community/import doesn't affect visibility)                    │
│  └── host_id (any published event shows)                                    │
│                                                                              │
│  OCCURRENCE EXPANSION (lines 237-250):                                      │
│  expandAndGroupEvents() processes events through nextOccurrence.ts          │
│  → Events must have computable dates within 90-day window                   │
│  → Uses MT-safe helpers (getTodayDenver, addDaysDenver)                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why a Published Event Might NOT Appear on Happenings

| Check | DB Field | Required Value | Fails If |
|-------|----------|----------------|----------|
| Published | `is_published` | `true` | Still `false` (draft) |
| Active | `status` | `"active"` or `"needs_verification"` | `"draft"` or `"cancelled"` |
| Date in window | `event_date` | Within 90 days from today | Date shifted (bug) or too far future |
| Computable date | `event_date` OR (`day_of_week` + recurrence) | At least one | Neither set → "Schedule unknown" |

### Trace for a Newly Created Event

**Expected DB state after create with `is_published=true`:**

```sql
SELECT id, slug, status, is_published, published_at, source,
       last_verified_at, event_date, series_id, series_index
FROM events WHERE id = '<new_event_id>';

-- Expected result:
id:               <uuid>
slug:             <auto-generated>
status:           "active"
is_published:     true
published_at:     "2026-01-05T..."
source:           "community"      ← Set by API
last_verified_at: null             ← NOT set (causes "unconfirmed")
event_date:       "2026-01-12"     ← May be shifted if timezone bug hit
series_id:        null OR <uuid>
series_index:     null OR 0
```

**Visibility verdict:**

| Page | Shows? | Reason |
|------|--------|--------|
| /dashboard/my-events | ✅ Yes | Owner always sees |
| /events/[id] | ✅ Yes | is_published=true |
| /happenings | ✅ Yes* | is_published=true, status="active" |

*If not showing: check `event_date` is within 90-day window and not shifted.

---

## 2. Unsafe Date Pattern Inventory

### `toISOString().split("T")[0]` Occurrences

| File | Line | Context | Risk Level | Fix Needed |
|------|------|---------|------------|------------|
| `api/my-events/route.ts` | 103 | Series date generation | **CRITICAL** | Replace with `addDaysDenver()` |
| `lib/events/recurrenceContract.ts` | 389 | RRULE UNTIL parsing | Low | Edge case only |
| `app/page.tsx` | 148-149 | Highlights date filter | Low | Server-side, uses `new Date()` |
| `dashboard/my-rsvps/page.tsx` | 36 | Today comparison | Low | Server-side |
| `api/admin/highlights/route.ts` | 80 | Default start_date | Low | Admin-only |
| `admin/highlights/AdminHighlightsClient.tsx` | 63, 119 | Form default | Low | Client-side default |
| `EventForm.tsx` | 799 | Min date for picker | Low | Display only |
| `__tests__/event-creation-ux.test.ts` | 27 | Test mock | None | Test file |
| `lib/events/nextOccurrence.ts` | 22 | Comment warning | None | Documentation |

### `new Date(event.event_date)` Without Safe Suffix

| File | Line | Context | Risk Level | Fix Needed |
|------|------|---------|------------|------------|
| `api/search/route.ts` | 140 | Date display in search | **MEDIUM** | Add `T12:00:00Z` |
| `lib/events/verification.ts` | 94 | Date formatting | Low | Timestamp field |
| `components/admin/OpenMicStatusTable.tsx` | 183 | Admin display | Low | Timestamp field |
| `components/blog/BlogComments.tsx` | 176 | Comment date | None | Timestamp field |
| `components/CompactListItem.tsx` | 53 | Display | Low | Should add suffix |
| `components/events/RSVPCard.tsx` | 36 | RSVP date | Low | Should add suffix |
| Various admin tables | Multiple | Admin display | Low | Timestamp fields |

### `.getDate()` Without Timezone Context

| File | Line | Context | Risk Level | Fix Needed |
|------|------|---------|------------|------------|
| `events/[id]/display/page.tsx` | 204 | Day number display | **MEDIUM** | Use MT formatting |
| `MyEventsFilteredList.tsx` | 286, 394 | Day number display | **MEDIUM** | Use MT formatting |

### Summary: Priority Fixes

```
P0 (CRITICAL - Must fix):
  └── api/my-events/route.ts:103 — generateSeriesDates() UTC bug

P1 (Should fix):
  ├── events/[id]/display/page.tsx:204 — .getDate() local timezone
  ├── MyEventsFilteredList.tsx:286,394 — .getDate() local timezone
  └── api/search/route.ts:140 — missing T suffix

P2 (Low priority):
  └── Various display-only locations
```

---

## 3. EventForm UX Map

### Required Fields (HTML5 `required` attribute)

| Field | Line | Selector | Browser Behavior |
|-------|------|----------|------------------|
| Title | 460 | `<input required>` | Scroll + native tooltip |
| Description | 543 | `<textarea required>` | Scroll + native tooltip |
| Venue | 620 | `<select required>` | Scroll + native tooltip |
| Day of Week | 729 | `<select required>` | Scroll + native tooltip |
| Start Time | 745 | `<select required>` | Scroll + native tooltip |
| Online URL (conditional) | 892 | `<input required>` | Only when location_mode=online/hybrid |

### Custom Validation (JavaScript)

| Check | Lines | Error Message | Behavior |
|-------|-------|---------------|----------|
| Online URL for online/hybrid | 283-286 | "Online URL is required for online or hybrid events" | Sets `error`, stops submit |
| Custom location name | 290-293 | "Location name is required for custom locations" | Sets `error`, stops submit |
| Publish confirmation | 302-305 | "Please confirm you're ready to publish..." | Sets `error`, stops submit |

### Publish Action Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PUBLISH TOGGLE (lines 1070-1105)                                           │
│                                                                              │
│  UI Element: Toggle switch with "Draft" / "Published" label                 │
│                                                                              │
│  State Change:                                                               │
│  onClick → setFormData({ is_published: !is_published })                     │
│                                                                              │
│  Confirmation Gate (lines 1105-1125):                                       │
│  When is_published=true AND event wasn't previously published:              │
│  → Shows checkbox: "Ready to publish"                                        │
│  → Must check before submit succeeds                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SUBMIT HANDLER (lines 276-380)                                             │
│                                                                              │
│  1. e.preventDefault() — stops native form submit                           │
│  2. setLoading(true), setError("")                                          │
│  3. Custom validation checks (online URL, custom location, publish confirm) │
│  4. If validation fails → setError(message), return                         │
│  5. If passes → fetch(API) with formData                                    │
│  6. On success → redirect to edit page                                      │
│  7. On error → setError(err.message)                                        │
│                                                                              │
│  NOTE: Native HTML5 validation happens BEFORE this handler                  │
│  → Browser scrolls to first invalid field                                   │
│  → No custom error message shown                                            │
│  → User sees "nothing happened" if they don't notice the scroll             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Silent Validation Problem

```
User Experience When Title is Empty:

1. User clicks "Create Event" button
2. Browser's native validation fires
3. Browser scrolls to Title field
4. Browser shows native tooltip: "Please fill out this field"
5. Form does NOT submit
6. No custom error message in UI
7. If user doesn't see the scroll/tooltip → "nothing happened"

Root Cause:
- Form has `required` attributes on fields
- No `noValidate` on <form> element
- No custom validation summary component
- Relies entirely on browser behavior

Proposed Fix (not yet approved):
1. Add `noValidate` to <form>
2. Add validateForm() before submit
3. Show error summary: "Please fill in: Title, Day of Week, Start Time"
4. Add aria-invalid + red border to invalid fields
```

---

## 4. Acceptance Tests Mapped to Symptoms

### Symptom → Test Mapping

| Symptom | Root Cause | Acceptance Test |
|---------|-----------|-----------------|
| "Nothing happens" on Create | HTML5 validation scrolls silently | TEST-011: Custom validation error summary |
| Monday shows as Sunday | `toISOString().split("T")[0]` | TEST-004: Series creation no date shift |
| "Imported" banner on new events | Copy doesn't check `source` | TEST-008: Verification banner copy |
| "Missing details" on complete events | `is_free=null` triggers | TEST-007: Missing details banner |
| Event not on Happenings | Date shift or draft status | TEST-006: Published event visibility |
| Can't manage series after create | `series_id` not in detection | TEST-005: Series edit page shows context |

### Additional Acceptance Tests (From Phase 4.42i)

```
TEST-011: Custom Validation Error Summary
  Given: User leaves Title empty
  When: User clicks "Create Event"
  Then: Error summary shows "Please fill in: Title"
  And: Title field has red border
  And: Focus moves to Title field

TEST-012: Publish Confirmation Gate
  Given: User fills all required fields
  And: Publish toggle is ON
  When: User clicks "Create Event" without checking "Ready to publish"
  Then: Error shows "Please confirm you're ready to publish..."
  And: Form does not submit

TEST-013: Source Field Set Correctly
  Given: User creates event via EventForm
  When: Event is saved
  Then: source="community" in database

TEST-014: Date Display Consistency
  Given: Event has event_date="2026-01-12"
  When: User views event from UTC+9 timezone
  Then: Date displays as "January 12" (not "January 11")
  And: Day number shows "12" (not "11")
```

---

## 5. Decision Confirmation Required

Before any code changes, please confirm:

### Decision A: Verification Behavior

**Your stated rule:** "New events created via EventForm should default to confirmed."

**Implementation options:**
- [ ] **A1:** Set `last_verified_at = NOW()` on create for `source="community"`
- [ ] **A2:** Introduce new `auto_verified` boolean flag
- [ ] **A3:** Change banner copy only (keep unconfirmed but show "Awaiting verification")

### Decision B: Missing Details Banner

**Your stated rule:** Remove false-positive for optional fields.

**Implementation options:**
- [ ] **B1:** Remove `is_free` from missing details check entirely
- [ ] **B2:** Make `is_free` required in form with explicit options

### Decision C: Series Edit UX

**Your stated rule:** Series membership must always be visible.

**Implementation options:**
- [ ] **C1:** Add `series_id` to SeriesEditingNotice detection (quick fix)
- [ ] **C2:** Add "Other events in series" links (enhancement)
- [ ] **C3:** Both C1 and C2

### Decision D: Date Handling

**Your stated rule:** Single canonical rule everywhere.

**Implementation options:**
- [ ] **D1:** Fix only `api/my-events/route.ts` (critical path)
- [ ] **D2:** Fix all P1 hotspots (display pages)
- [ ] **D3:** Full standardization audit

---

## Stop Point

**Investigation complete.** This document provides:

1. ✅ Create → Publish → Happenings trace with query details
2. ✅ Complete inventory of `toISOString().split("T")[0]` usage
3. ✅ EventForm UX map with required fields and validation flow
4. ✅ Symptom → Test mapping

**No code changes made.** Reply with decision selections (e.g., "A1, B1, C3, D2") to proceed with execution.

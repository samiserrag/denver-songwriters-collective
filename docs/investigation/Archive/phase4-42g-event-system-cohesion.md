# Phase 4.42g Investigation Report: Event System Cohesion

**Investigation Date:** January 2026
**Status:** Complete - Awaiting Sami approval for execution plan

---

## Executive Summary

This investigation identifies why the event creation → listing → series management flow feels broken. The system has **5 interconnected issues** that create a poor user experience:

1. **All new events show "imported/unconfirmed"** — Copy doesn't distinguish community-created from imported events
2. **"Missing details" triggers on optional fields** — `is_free=null` always triggers the banner
3. **Series panel disappears after creation** — Edit mode hides series UI; `series_id` not reflected
4. **Silent validation scroll** — HTML5 required fields fail without visible error feedback
5. **Date conversion timezone bug** — `toISOString().split("T")[0]` can shift dates for non-UTC users

The root cause is **Phase 4.40's design decision** (all events unconfirmed until admin verifies) combined with **UI copy that predates this change** and **series creation using individual events without recurring semantics**.

---

## Source-of-Truth Map

### What Decides "Confirmed" vs "Unconfirmed"?

| Column | Location | Logic |
|--------|----------|-------|
| `last_verified_at` | events table | `NOT NULL` = confirmed |
| `verified_by` | events table | Admin user ID who verified |
| `status` | events table | `"cancelled"` overrides verification |
| `source` | events table | Set to `"community"` for user-created, but NOT used in verification logic |

**File:** `lib/events/verification.ts`

```typescript
// Rule 2: Confirmed if last_verified_at is set
if (event.last_verified_at !== null && event.last_verified_at !== undefined) {
  return { state: "confirmed", ... };
}
// Rule 3: Everything else is unconfirmed (default state)
return { state: "unconfirmed", ... };
```

**Problem:** User-created events get `source: "community"` but `last_verified_at: null` (DB default), so they are "unconfirmed."

### What Decides "Missing Details"?

| Field | Required? | Triggers Banner If |
|-------|-----------|-------------------|
| `venue_id` OR `custom_location_name` | Yes (for venue mode) | Both null |
| `online_url` | Yes (for online/hybrid) | Null when needed |
| `is_free` | **No** | **Always triggers if null** |
| `age_policy` | No (DSC events only) | Null for DSC events |

**File:** `lib/events/missingDetails.ts:80-83`

```typescript
// Rule 5: Unknown cost (is_free is null)
if (event.is_free === null || event.is_free === undefined) {
  reasons.push("Cost information unknown");
}
```

**Problem:** `is_free` defaults to `null` in form state (line 127 in EventForm.tsx), and most users don't set it, triggering "Missing details."

### What Decides "Appears on Happenings"?

| Filter | Condition | Default |
|--------|-----------|---------|
| `is_published` | `= true` | Required |
| `status` | `IN ("active", "needs_verification")` | Required |
| `is_dsc_event` | Only if `dsc=1` param | Not filtered by default |
| `event_date` | Within 90-day window OR recurring expansion | Required for display |

**File:** `app/happenings/page.tsx:78-85`

```typescript
let query = supabase
  .from("events")
  .select(`*, venues!left(...)`)
  .eq("is_published", true)
  .in("status", ["active", "needs_verification"]);
```

**Conclusion:** A published event with `status="active"` SHOULD appear. If not appearing, check:
1. Is `is_published` actually `true`?
2. Is `event_date` in the 90-day window?
3. Is the date correctly stored (not shifted)?

### What Decides "Series" UI Visibility?

| Condition | Edit Page Shows |
|-----------|-----------------|
| `mode === "create"` | Series panel with date picker |
| `mode === "edit"` | **No series panel** |
| `is_recurring` OR `recurrence_rule` | SeriesEditingNotice |
| `series_id` (only) | **Nothing** — not recognized as series |

**File:** `EventForm.tsx:773`

```typescript
{mode === "create" && formData.day_of_week && (
  // Series panel only in create mode
)}
```

**File:** `SeriesEditingNotice.tsx:40-43`

```typescript
const isRecurring =
  event.is_recurring ||
  event.recurrence_rule ||
  (event.day_of_week && !event.event_date);
```

**Problem:** Series creation sets `series_id` and `event_date` but NOT `is_recurring` or `recurrence_rule`. The SeriesEditingNotice check doesn't include `series_id`.

---

## Root Cause Analysis Per Symptom

### Symptom 1: "Imported/Unconfirmed" Message for User-Created Events

**Root Cause:** UI copy hardcoded for imported events, but Phase 4.40 made ALL events unconfirmed.

**Evidence:**
```typescript
// events/[id]/page.tsx:540
This event was imported from an external source and hasn't been verified yet.
```

This appears whenever `isUnconfirmed && !isCancelled` — which is true for ALL new events since `last_verified_at` is null.

**Contract Violation:** User expectation is that their own event is "real" and doesn't need external verification messaging.

---

### Symptom 2: "Missing Details" Banner on Complete Events

**Root Cause:** `is_free=null` is treated as "missing" even though it's optional.

**Evidence:**
```typescript
// lib/events/missingDetails.ts:80-83
if (event.is_free === null || event.is_free === undefined) {
  reasons.push("Cost information unknown");
}
```

Form default:
```typescript
// EventForm.tsx:127
is_free: event?.is_free ?? null,
```

**Contract Violation:** Form doesn't require `is_free`, but UI shames users for not setting it.

---

### Symptom 3: Series Panel Disappears After Creation

**Root Cause:** Series panel is `mode === "create"` only. `series_id` is not used in any edit UI.

**Evidence:**
```typescript
// EventForm.tsx:773
{mode === "create" && formData.day_of_week && (
```

After creation, navigating to edit page uses `mode="edit"`, hiding the panel entirely.

SeriesEditingNotice doesn't recognize `series_id`:
```typescript
// SeriesEditingNotice.tsx:40-43
const isRecurring =
  event.is_recurring ||
  event.recurrence_rule ||
  (event.day_of_week && !event.event_date);
// ❌ series_id not checked
```

**Contract Violation:** Users create a series expecting to manage occurrences; instead, they see a single-event edit page with no series awareness.

---

### Symptom 4: Silent Validation Scroll

**Root Cause:** HTML5 `required` attributes cause browser scroll without custom feedback.

**Evidence:** Form has 6 fields with `required`:
- Title (line 460)
- Description (line 543)
- Venue selector (line 620)
- Day of Week (line 729)
- Start Time (line 745)
- Online URL for online mode (line 892)

When `required` fails, browser scrolls to field but shows no inline error.

**Contract Violation:** Users click "Create Event" and see nothing happen — just a scroll. No error message, no highlighted field.

---

### Symptom 5: Date Shift (Monday → Sunday)

**Root Cause:** `generateSeriesDates()` uses `toISOString().split("T")[0]` which converts local time to UTC.

**Evidence:**
```typescript
// api/my-events/route.ts:96-103
function generateSeriesDates(startDate: string, count: number): string[] {
  const start = new Date(startDate + "T00:00:00"); // LOCAL time parse
  for (let i = 0; i < count; i++) {
    const eventDate = new Date(start);
    eventDate.setDate(start.getDate() + (i * 7));
    dates.push(eventDate.toISOString().split("T")[0]); // UTC conversion!
  }
}
```

**Failure scenario:**
- User in Asia (UTC+8) picks Monday Jan 12
- `new Date("2026-01-12T00:00:00")` = Jan 12 00:00 local = Jan 11 16:00 UTC
- `.toISOString()` = `"2026-01-11T16:00:00.000Z"`
- `.split("T")[0]` = `"2026-01-11"` (Sunday!)

**Safe pattern already exists:** `lib/events/formDateHelpers.ts` uses `addDaysDenver()` which is timezone-safe.

---

## Proposed Unified Contract

### 1. Verification Semantics

**Current:** All events unconfirmed until admin sets `last_verified_at`.

**Proposed Options:**

| Option | Behavior | Tradeoff |
|--------|----------|----------|
| A | User-created events auto-confirm (`last_verified_at = NOW()` on create) | No admin gate; trust users |
| B | User-created events show neutral copy ("Awaiting verification") | Keeps admin gate; better UX |
| C | Separate "imported" check (`source = 'import'`) from "unconfirmed" check | Most accurate but complex |

**Recommendation:** Option B or C. Option A removes admin oversight entirely.

### 2. Missing Details Semantics

**Current:** `is_free=null` triggers "Missing details."

**Proposed Options:**

| Option | Behavior | Tradeoff |
|--------|----------|----------|
| A | Remove `is_free` from missing details check | Cleaner UX; less info nudge |
| B | Rename banner to "More details helpful" instead of "Missing details" | Honest; less alarming |
| C | Make `is_free` required in form with "Unknown" option | Explicit choice; more clicks |

**Recommendation:** Option A or B. "Missing details" should mean "required info missing," not "nice-to-have missing."

### 3. Series Management Semantics

**Current:** Creates N separate events with `series_id`. Edit shows single event with no series context.

**Proposed Options:**

| Option | Behavior | Tradeoff |
|--------|----------|----------|
| A | Add "Other events in series" list to edit page | Simple; navigates to siblings |
| B | Add `series_id` to SeriesEditingNotice check | Quick fix; partial awareness |
| C | Convert to recurring model (1 event + occurrence overrides) | Major refactor; matches model |

**Recommendation:** Option A + B for near-term. Option C requires significant architecture change.

### 4. Form Validation Semantics

**Current:** HTML5 required causes silent scroll.

**Proposed:**

| Change | Behavior |
|--------|----------|
| Add `noValidate` to form | Disable browser validation |
| Add custom `validateForm()` before submit | Return field-specific errors |
| Show error summary at top | "Please fill in: Title, Start Time" |
| Add `aria-invalid` + red border to fields | Visual indicator |

### 5. Date Handling Semantics

**Current:** Mix of local time, UTC, and MT helpers.

**Proposed Contract:**

| Context | Pattern |
|---------|---------|
| Parse date-only string | `new Date(dateKey + "T12:00:00Z")` (noon UTC) |
| Generate series dates | Use `addDaysDenver()` from `formDateHelpers.ts` |
| Display date | Always use `timeZone: "America/Denver"` |
| Store date | `YYYY-MM-DD` string (no timezone suffix) |

---

## Visibility Matrix: What Shows Where?

| State | Happenings | Event Detail Page | My Events Dashboard |
|-------|------------|-------------------|---------------------|
| Draft + Unverified | ❌ | ❌ (404) | ✅ "Draft" badge |
| Published + Unverified | ✅ | ✅ + "Unconfirmed" banner | ✅ "Live" badge |
| Published + Verified | ✅ | ✅ + green badge | ✅ "Live" badge |
| Cancelled | ❌ | ✅ + red "Cancelled" | ✅ "Cancelled" badge |

**Expected vs Actual:**
- **Expected:** User publishes → event appears on Happenings immediately
- **Actual:** If `is_published=true` and `status="active"`, it SHOULD appear. The "not appearing" report needs DB verification.

---

## Decision Menu (Requires Sami Approval)

Before Phase 4.42h execution, please approve/reject each:

### Decision 1: Verification Copy for User-Created Events

- [ ] **A:** Auto-confirm user-created events (set `last_verified_at`)
- [ ] **B:** Keep unconfirmed but change copy to "Awaiting verification" (remove "imported" language)
- [ ] **C:** Check `source` field — show "imported" only if `source='import'`

### Decision 2: Missing Details Banner

- [ ] **A:** Remove `is_free` from missing details check entirely
- [ ] **B:** Rename banner to "More details helpful" with softer styling
- [ ] **C:** Make `is_free` required with explicit "Unknown" option

### Decision 3: Series Edit UX

- [ ] **A:** Add "Other events in this series" section to edit page
- [ ] **B:** Only fix SeriesEditingNotice to recognize `series_id`
- [ ] **C:** Defer series UX improvements to separate phase

### Decision 4: Form Validation

- [ ] **A:** Add custom validation with error summary + inline field indicators
- [ ] **B:** Just add error message at top without inline indicators
- [ ] **C:** Keep HTML5 validation (current behavior)

### Decision 5: Date Bug Fix Scope

- [ ] **A:** Fix `generateSeriesDates()` in API route only
- [ ] **B:** Fix all 5 hotspots identified (API route, display page, search, form preview, highlights admin)
- [ ] **C:** Full audit and standardize on MT helpers everywhere

---

## Minimal Stepwise Execution Plan (NOT YET APPROVED)

### Phase 4.42h-1: Date Bug Fixes (Priority 1)

1. Replace `generateSeriesDates()` in `api/my-events/route.ts` with MT-safe implementation using `addDaysDenver()`
2. Fix `display/page.tsx:204` `.getDate()` to use timezone-safe formatting
3. Fix `search/route.ts:140` date parsing to use `T12:00:00Z` pattern

### Phase 4.42h-2: Copy Fixes (Priority 2)

4. Update `events/[id]/page.tsx:540` banner copy based on Decision 1
5. Update `missingDetails.ts` based on Decision 2

### Phase 4.42h-3: Validation UX (Priority 3)

6. Add custom form validation with error summary based on Decision 4

### Phase 4.42h-4: Series UX (Priority 4)

7. Add series awareness to edit page based on Decision 3

---

## Stop Point

**Investigation complete.** Awaiting Sami's decisions on the 5 options above before any code changes.

No code has been modified. This document is read-only analysis.

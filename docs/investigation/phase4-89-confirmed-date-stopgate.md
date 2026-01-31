# Phase 4.89 — Auto Confirmed Date Updates on Save

> **STOP-GATE 1: Investigation Report**
>
> Created: 2026-01-26
> Status: STOP-GATE 1 COMPLETE — Awaiting approval for STOP-GATE 2 (Design Decision)

---

## Executive Summary

This investigation documents the current state of the confirmation system and identifies all touch points for implementing "auto-bump confirmed date on save" behavior. The system is simpler than anticipated with a clear central verification module and only 4 write paths that modify `last_verified_at`.

**Key Finding:** Occurrence overrides do NOT currently have any confirmation-specific fields. Adding per-occurrence `confirmed_at` would require a migration to add a new column to `occurrence_overrides`.

---

## STOP-GATE 1A: Where Confirmation Currently Lives

### Core Verification Module

**File:** `web/src/lib/events/verification.ts`

| Function | Purpose | Lines |
|----------|---------|-------|
| `getPublicVerificationState()` | Determines confirmed/unconfirmed/cancelled | 44-72 |
| `isConfirmed()` | Helper: `last_verified_at !== null` | 80-82 |
| `isUnconfirmed()` | Helper: `last_verified_at === null && status !== "cancelled"` | 87-92 |
| `formatVerifiedDate()` | Formats date for display (Denver timezone, "Jan 26, 2026") | 97-106 |
| `shouldShowUnconfirmedBadge()` | Suppresses badge for DSC TEST events | 111-127 |

**Logic (lines 44-72):**
```typescript
export function getPublicVerificationState(event: VerificationInput): VerificationResult {
  if (event.status === "cancelled") {
    return { state: "cancelled", reason: "Event has been cancelled", ... };
  }
  if (event.last_verified_at !== null && event.last_verified_at !== undefined) {
    return { state: "confirmed", lastVerifiedAt: event.last_verified_at, verifiedBy: event.verified_by };
  }
  return { state: "unconfirmed", reason: buildUnconfirmedReason(event), ... };
}
```

### UI Rendering Locations

| Surface | File | Lines | What's Displayed |
|---------|------|-------|------------------|
| HappeningCard | `components/happenings/HappeningCard.tsx` | 720-732, 804-814 | Confirmed/Unconfirmed chip with checkmark/warning icon |
| SeriesCard | `components/happenings/SeriesCard.tsx` | 343-360 | Same chip pattern |
| Event Detail Page | `app/events/[id]/page.tsx` | 849-862, 886-902 | Badge + "Confirmed: [date]" or warning banner |
| EventForm Preview | `dashboard/my-events/_components/EventForm.tsx` | 326-328 | Passes `last_verified_at` to preview card |
| Admin Events Table | `dashboard/admin/events/page.tsx` | Multiple | Checkbox for admin verification |
| Admin Open Mics Table | `dashboard/admin/open-mics/page.tsx` | Multiple | Status column |
| OG Image | `app/og/event/[id]/route.tsx` | Query | Uses verified state |

### Database Schema

**Table:** `events`

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `last_verified_at` | `timestamp with time zone` | `NULL` | When event was last confirmed |
| `verified_by` | `uuid` | `NULL` | Who verified (NULL = auto-confirmed) |

**Confirmed = `last_verified_at IS NOT NULL`**

---

## STOP-GATE 1B: Write Paths That Change Confirmation

### 1. PATCH `/api/my-events/[id]` — Main Event Update Route

**File:** `web/src/app/api/my-events/[id]/route.ts`

**Path A: Admin verify/unverify action (lines 254-263)**
```typescript
if (body.verify_action !== undefined && isAdmin) {
  if (body.verify_action === "verify") {
    updates.last_verified_at = now;
    updates.verified_by = session.user.id;
  } else if (body.verify_action === "unverify") {
    updates.last_verified_at = null;
    updates.verified_by = null;
  }
}
```
- **Trigger:** Admin explicitly sets `verify_action: "verify"` or `"unverify"` in request body
- **When:** Admin clicks verify checkbox in EventForm or admin table

**Path B: Auto-confirm on publish (lines 335-351)**
```typescript
if (body.is_published === true) {
  if (!wasPublished && body.verify_action === undefined) {
    // Auto-confirm on first publish (Phase 4.73)
    updates.last_verified_at = now;
    // verified_by remains null to indicate auto-confirmed
  }
  if (!prevEvent?.published_at) {
    updates.published_at = now;
  }
}
```
- **Trigger:** Event transitions from unpublished → published
- **Condition:** `verify_action` NOT explicitly set (respects admin intent)
- **Key:** `verified_by = null` indicates auto-confirmed (not admin-verified)

### 2. PublishButton Component — Direct DB Update

**File:** `web/src/app/(protected)/dashboard/my-events/[id]/_components/PublishButton.tsx` (lines 30-41)

```typescript
const updates: { is_published: boolean; status?: string; last_verified_at?: string } = {
  is_published: !isPublished,
};
if (!isPublished) {
  updates.status = "active";
  // Phase 4.73: Auto-confirm on publish (including republish)
  updates.last_verified_at = new Date().toISOString();
}
```
- **Trigger:** User clicks "Publish Event" button
- **Note:** This bypasses the API route and updates Supabase directly
- **Gap:** Does NOT set `verified_by = null` (implicit in schema default)

### 3. POST `/api/admin/ops/events/bulk-verify` — Bulk Verify/Unverify

**File:** `web/src/app/api/admin/ops/events/bulk-verify/route.ts` (lines 67-76)

```typescript
const updatePayload =
  action === "verify"
    ? {
        last_verified_at: new Date().toISOString(),
        verified_by: user.id,
      }
    : {
        last_verified_at: null,
        verified_by: null,
      };
```
- **Trigger:** Admin bulk action from Ops Console
- **Access:** Admin-only (checkAdminRole)

### 4. POST `/api/my-events` — Event Creation

**File:** `web/src/app/api/my-events/route.ts`

- **Auto-confirm on create+publish:** Sets `last_verified_at: publishedAt` when event is created already published
- **Pattern:** Same as PATCH auto-confirm on publish

### Summary Table: Write Paths

| Path | File | Trigger | Sets verified_by? |
|------|------|---------|-------------------|
| Admin verify action | `api/my-events/[id]/route.ts:254-263` | Admin explicit action | Yes (admin ID) |
| Auto-confirm on publish | `api/my-events/[id]/route.ts:335-351` | Publish transition | No (null) |
| PublishButton | `PublishButton.tsx:30-41` | Publish button click | No (implicit) |
| Bulk verify | `api/admin/ops/events/bulk-verify/route.ts:67-76` | Admin bulk action | Yes (admin ID) |
| Event creation | `api/my-events/route.ts` | Create + publish | No (null) |

---

## STOP-GATE 1C: Occurrence Override Merge Logic

### Current Override System

**Table:** `occurrence_overrides`

| Column | Type | Purpose |
|--------|------|---------|
| `event_id` | uuid | FK to events |
| `date_key` | text | YYYY-MM-DD occurrence date |
| `status` | text | "normal" or "cancelled" |
| `override_start_time` | time | Per-occurrence time change |
| `override_cover_image_url` | text | Per-occurrence flyer |
| `override_notes` | text | Per-occurrence notes |
| `override_patch` | jsonb | Flexible per-occurrence field overrides |

**IMPORTANT:** There is NO `confirmed_at` column on `occurrence_overrides`.

### Allowed Override Fields

**File:** `web/src/lib/events/nextOccurrence.ts` (lines 914-942)

```typescript
export const ALLOWED_OVERRIDE_FIELDS = new Set([
  "title", "description", "event_date", "start_time", "end_time",
  "venue_id", "location_mode", "custom_location_name", "custom_address",
  "custom_city", "custom_state", "online_url", "location_notes",
  "capacity", "has_timeslots", "total_slots", "slot_duration_minutes",
  "is_free", "cost_label", "signup_url", "signup_deadline",
  "age_policy", "external_url", "categories", "cover_image_url",
  "host_notes", "is_published",
]);
```

**NOT included:** `last_verified_at`, `verified_by`, `confirmed_at`

### Merge Function

**File:** `web/src/lib/events/nextOccurrence.ts` (lines 954-983)

```typescript
export function applyOccurrenceOverride<T extends Record<string, unknown>>(
  baseEvent: T,
  override: OccurrenceOverride | null | undefined
): T {
  if (!override) return baseEvent;

  const result = { ...baseEvent };

  // 1. Apply legacy columns
  if (override.override_start_time) {
    (result as Record<string, unknown>).start_time = override.override_start_time;
  }
  // ... cover_image_url, host_notes

  // 2. Apply override_patch (allowlisted keys only)
  if (override.override_patch && typeof override.override_patch === "object") {
    for (const [key, value] of Object.entries(override.override_patch)) {
      if (ALLOWED_OVERRIDE_FIELDS.has(key)) {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }

  return result;
}
```

### Where Merge Happens

1. **expandAndGroupEvents()** — `nextOccurrence.ts:1055-1169`
   - Builds override map, checks status for cancellations
   - Does NOT apply field overrides (just tracks override object)

2. **HappeningCard** — `components/happenings/HappeningCard.tsx`
   - Applies override_patch fields directly in component
   - Uses `override_patch?.start_time`, etc.

3. **Event Detail Page** — `app/events/[id]/page.tsx`
   - Fetches occurrence override by date_key
   - Applies overrides to display variables

---

## Current Behavior Summary

| Scenario | What Happens |
|----------|--------------|
| User creates event and publishes | `last_verified_at = now`, `verified_by = null` (auto-confirmed) |
| User saves draft | `last_verified_at` unchanged (stays null) |
| User saves published event | `last_verified_at` unchanged (no auto-bump) |
| Admin verifies | `last_verified_at = now`, `verified_by = admin_id` |
| Admin unverifies | `last_verified_at = null`, `verified_by = null` |
| User edits occurrence override | Base event `last_verified_at` unchanged |

---

## Where Drift Might Occur

### Gap 1: Saving a Confirmed Event Does NOT Bump Timestamp

When a host saves changes to an already-confirmed event, `last_verified_at` is not updated. The displayed "Confirmed: Jan 1, 2026" becomes stale.

**User expectation:** "I just updated this, so it should show today's date"
**Current behavior:** Shows original confirmation date

### Gap 2: Occurrence Overrides Have No Confirmation Field

If we want per-occurrence confirmation dates:
- Need migration to add `confirmed_at` column to `occurrence_overrides`
- Or use `override_patch.confirmed_at` (blocked by allowlist)
- Merge function would need to surface this for display

### Gap 3: Two Write Paths for Publish

PublishButton and PATCH route both set `last_verified_at` on publish. If we add auto-bump on save:
- Need to update BOTH paths
- Or consolidate PublishButton to use the API route

### Gap 4: Admin Unverify Clears Everything

When admin unverifies:
- `last_verified_at = null` globally
- No per-occurrence tracking
- If we add per-occurrence, need to decide: does admin unverify clear all occurrence dates?

---

## Proposed Minimal Implementation Points

### For "Base Event Auto-Bump on Save":

1. **PATCH `/api/my-events/[id]/route.ts`** (lines ~335)
   - Add: If event is already confirmed (`last_verified_at !== null`), bump to `now`
   - Condition: When meaningful fields change (not just host_notes?)
   - Keep: `verified_by` unchanged (preserve admin attribution)

2. **PublishButton.tsx** (line 40)
   - Already sets `last_verified_at = now` on publish
   - May need: Set on unpublish→republish too (already does this)

### For "Occurrence-Level Confirmation":

1. **Migration needed:** Add `confirmed_at TIMESTAMP` to `occurrence_overrides`

2. **Override route** (`api/my-events/[id]/overrides/route.ts`)
   - On save: If base event is confirmed, set `confirmed_at = now` on override

3. **Merge function** (`nextOccurrence.ts:applyOccurrenceOverride`)
   - No change needed (confirmed_at is display-only, not a base event field)

4. **UI display** (`HappeningCard.tsx`, `events/[id]/page.tsx`)
   - When displaying occurrence: use override `confirmed_at` if present, else base `last_verified_at`

### For "Admin Unverify Clears Both":

1. **Bulk unverify route:** Clear base event `last_verified_at`
2. **Question:** Should it also clear all `occurrence_overrides.confirmed_at`?
   - Option A: Yes, cascade clear
   - Option B: No, keep per-occurrence dates (shows when that occurrence was last touched)

---

## Files That Would Need Changes

| File | Change Type | Reason |
|------|-------------|--------|
| `api/my-events/[id]/route.ts` | Code | Add auto-bump logic |
| `api/my-events/[id]/overrides/route.ts` | Code | Set occurrence confirmed_at |
| `nextOccurrence.ts` | Types | Add confirmed_at to OccurrenceOverride interface |
| `HappeningCard.tsx` | Display | Show occurrence confirmed date |
| `events/[id]/page.tsx` | Display | Show occurrence confirmed date |
| `verification.ts` | Helper | Add function for occurrence-level verification |
| Migration | Schema | Add `confirmed_at` to occurrence_overrides |

---

## Questions for STOP-GATE 2 Decision

1. **Scope of "meaningful change":** Should auto-bump happen on ANY save, or only when certain fields change?
   - Option A: Any save bumps timestamp
   - Option B: Only "public-facing" field changes (title, time, venue, description)

2. **Occurrence confirmation column:**
   - Option A: Add `confirmed_at` timestamp to `occurrence_overrides` table
   - Option B: Store in `override_patch.confirmed_at` (requires allowlist update)

3. **Admin unverify cascade:**
   - Option A: Unverify clears both base and all occurrence confirmed_at
   - Option B: Unverify only clears base; occurrences keep their dates

4. **Display format:**
   - "Confirmed: Jan 26, 2026" (current)
   - "Updated: Jan 26, 2026" (implies not "verified" but "touched")
   - Keep as "Confirmed" since it implies the data is current?

---

## STOP-GATE 1 Status: COMPLETE

Ready for STOP-GATE 2 (Design Decision) when Sami approves.

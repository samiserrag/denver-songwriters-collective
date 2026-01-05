# Phase 4.36 Investigation: Publish Confirmation + Attendee Update Notifications

**Date:** 2026-01-04
**Status:** Investigation Complete — Awaiting Approval

---

## 1. Publish Write Paths (Host + Admin)

### Host Create — `POST /api/my-events`
**File:** `web/src/app/api/my-events/route.ts:233-266`

```typescript
// Line 233-234
const eventStatus = body.is_published === true ? "active" : "draft";
const publishedAt = body.is_published === true ? new Date().toISOString() : null;

// Line 265-266
is_published: body.is_published ?? false,
published_at: publishedAt,
```

**No confirmation checkbox required.** Toggle freely sets `is_published`.

### Host Update — `PATCH /api/my-events/[id]`
**File:** `web/src/app/api/my-events/[id]/route.ts:244-259`

```typescript
// Line 244-259
if (body.is_published === true) {
  // Only set published_at if not already published
  const { data: existingEvent } = await supabase
    .from("events")
    .select("published_at")
    .eq("id", eventId)
    .single();

  if (!existingEvent?.published_at) {
    updates.published_at = now;
  }
  // Also set status to active when publishing
  if (!updates.status) {
    updates.status = "active";
  }
}
```

**No confirmation checkbox required.** Host can toggle `is_published` at will.

### Admin Update — `EventEditForm.tsx`
**File:** `web/src/app/(protected)/dashboard/admin/events/[id]/edit/EventEditForm.tsx:87-103`

Admin edit uses **direct Supabase client update** (not API route):
```typescript
const { error: updateError } = await supabase
  .from("events")
  .update({
    title: form.title,
    venue_id: form.venue_id || null,
    day_of_week: form.day_of_week,
    start_time: form.start_time || null,
    // ... other fields
    status: form.status,  // Can set: active, inactive, cancelled, duplicate
  })
  .eq("id", event.id);
```

**Admin does NOT have `is_published` in the form.** They edit `status` directly. No `published_at` or `last_verified_at` is touched.

---

## 2. Verification Model Fields + Writers

### Database Columns
**File:** `supabase/migrations/20251216000001_v030_verification_system.sql:6-11`

| Column | Type | Purpose |
|--------|------|---------|
| `last_verified_at` | TIMESTAMPTZ | Timestamp of last admin verification |
| `verified_by` | UUID FK profiles(id) | Admin who verified |
| `source` | TEXT | Origin: `community`, `venue`, `admin`, `import` |

### Who Writes Verification Fields

**Only Admin API route writes these:**
**File:** `web/src/app/api/admin/open-mics/[id]/status/route.ts:104-105`

```typescript
updateData.last_verified_at = timestamp;
updateData.verified_by = user.id;
```

This is triggered when admin sets status to `active` via the OpenMicStatusTable.

**Hosts never write verification fields.** When a host publishes, only `is_published`, `published_at`, and `status` change.

### Status Values
**File:** `supabase/migrations/20251228_event_status_invariants.sql:74`

```sql
CHECK (status IN ('draft', 'active', 'needs_verification', 'unverified', 'inactive', 'cancelled'))
```

**UI Display:**
- `active` — Verified, visible (green badge)
- `needs_verification` — Imported, needs review (amber badge)
- `unverified` — Community submitted, not checked (amber badge)
- `inactive` — Temporarily hidden
- `cancelled` — Permanently closed

### Key Finding
**`active` is currently used as both "published" and "verified".** There's no separate `confirmed` status. When host publishes, status becomes `active` automatically.

---

## 3. Signup Tables + Attendee Enumeration

### Tables for "Signed Up Users"

| Table | Purpose | Status Column |
|-------|---------|---------------|
| `event_rsvps` | General event attendance | `confirmed`, `waitlist`, `cancelled`, `offered` |
| `timeslot_claims` | Performer slot signups | `confirmed`, `waitlist`, `cancelled`, `offered`, `performed` |

### Query Pattern for All Attendees

**RSVP Query:**
**File:** `web/src/app/api/my-events/[id]/route.ts:367-371`
```typescript
.from("event_rsvps")
.select("user_id")
.eq("event_id", eventId)
.in("status", ["confirmed", "waitlist"]);
```

**Timeslot Claims Query:**
**File:** `web/src/app/api/my-events/[id]/route.ts:284-289`
```typescript
.from("timeslot_claims")
.select("*", { count: "exact", head: true })
.in("timeslot_id", slotIds)
.in("status", ["confirmed", "performed", "waitlist"]);
```

### Complete Attendee Enumeration

To notify all signed-up users:
1. Query `event_rsvps` where `event_id = X` and `status IN ('confirmed', 'waitlist', 'offered')`
2. Query `event_timeslots` → `timeslot_claims` where `status IN ('confirmed', 'waitlist', 'offered')`
3. Union the `user_id` values (deduplicate)

**Note:** Timeslot claims may have `member_id` (authenticated) or `guest_email` (unauthenticated guests).

---

## 4. Existing `eventUpdated` Email Behavior

### Template Exists — NOT Wired
**File:** `web/src/lib/email/templates/eventUpdated.ts:4-6`

```typescript
/**
 * Sent when a host updates event details (time, location, etc.).
 * Template only - sending trigger not yet implemented.
 */
```

### Template Interface
**File:** `web/src/lib/email/templates/eventUpdated.ts:21-38`

```typescript
export interface EventUpdatedEmailParams {
  userName?: string | null;
  eventTitle: string;
  eventId: string;
  eventSlug?: string | null;
  changes: {
    date?: { old: string; new: string };
    time?: { old: string; new: string };
    venue?: { old: string; new: string };
    address?: { old: string; new: string };
  };
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress?: string;
}
```

### Current Features
- Shows old → new values with strikethrough
- Includes `eventCard()` and `rsvpsDashboardLink()`
- Has cancel RSVP link
- **Preference category:** `event_updates` (per `preferences.ts:111`)

### Wiring Status
**No API route or trigger calls this template.** Searched `web/src/app/api` for `eventUpdated` — zero matches.

---

## 5. URL Helpers for Event + Dashboard Links

### Canonical URL Helper
**File:** `web/src/lib/events/urls.ts:21-28`

```typescript
export function getEventUrl(event: Event): string {
  // Prefer slug for SEO-friendly URLs, fallback to id
  const identifier = (event as any).slug || event.id;
  if (event.event_type === "open_mic") {
    return getOpenMicUrl(identifier);
  }
  return getDscEventUrl(identifier);
}
```

### Email-Specific Helpers
**File:** `web/src/lib/email/render.ts:240-262`

```typescript
// Event card with link
export function eventCard(eventTitle: string, eventUrl: string): string

// RSVPs dashboard link
export function rsvpsDashboardLink(): string {
  const rsvpsUrl = `${SITE_URL}/dashboard/my-rsvps`;
}
```

### How to Fetch Slug Server-Side

When sending emails, fetch event with slug:
```typescript
const { data: event } = await supabase
  .from("events")
  .select("id, slug, title, ...")
  .eq("id", eventId)
  .single();

const eventUrl = `${SITE_URL}/events/${event.slug || event.id}`;
```

---

## 6. Details Changed — Diff Rule Candidate Fields

### Host Editable Fields (via PATCH)
**File:** `web/src/app/api/my-events/[id]/route.ts:144-153`

```typescript
const allowedFields = [
  "title", "description", "event_type", "capacity", "host_notes",
  "day_of_week", "start_time", "event_date",
  "end_time", "status", "recurrence_rule", "cover_image_url", "is_published",
  "timezone", "location_mode", "online_url", "is_free", "cost_label",
  "signup_mode", "signup_url", "signup_deadline", "age_policy",
  "has_timeslots", "total_slots", "slot_duration_minutes"
];
```

Plus location fields handled separately:
- `venue_id`, `venue_name`, `venue_address`
- `custom_location_name`, `custom_address`, `custom_city`, `custom_state`
- `location_notes`

### Admin Editable Fields (direct update)
**File:** `web/src/app/(protected)/dashboard/admin/events/[id]/edit/EventEditForm.tsx:89-101`

```typescript
title, venue_id, day_of_week, start_time, end_time, signup_time,
recurrence_rule, notes, description, category, status, event_type
```

### Proposed "Attendee-Visible Details" (Candidates)

| Field | Category | Rationale |
|-------|----------|-----------|
| `event_date` | Date | Directly affects attendance |
| `start_time` | Time | When to show up |
| `end_time` | Time | When it ends |
| `day_of_week` | Date | Recurring schedule |
| `venue_id` / `venue_name` | Location | Where to go |
| `custom_location_name` | Location | Where to go |
| `venue_address` / `custom_address` | Location | Navigation |
| `location_mode` | Location | Online vs in-person |
| `online_url` | Location | Virtual attendance |
| `status` (→ cancelled) | Status | Event exists or not |

**Excluded from notifications:**
- `title`, `description` — Minor text changes
- `capacity`, `cost_label`, `is_free` — Nice to know but not critical
- `host_notes`, `cover_image_url` — Internal/visual only
- Timeslot config changes — Separate flow exists

### Existing "Major Change" Tracking
**File:** `web/src/app/api/my-events/[id]/route.ts:228-233`

```typescript
const majorFields = ["event_date", "start_time", "end_time", "venue_id", "location_mode", "day_of_week"];
const hasMajorChange = majorFields.some(field => body[field] !== undefined);
if (hasMajorChange) {
  updates.last_major_update_at = now;
}
```

This existing `majorFields` list is a strong candidate for notification triggers.

---

## 7. Risks / Edge Cases

### Recurring Series vs Single Occurrence

**Risk:** Changing `day_of_week` or `recurrence_rule` affects ALL future occurrences.
- Should we notify ALL RSVPs (including for past occurrences)?
- Or only RSVPs for future occurrences?

**Current behavior:** `SeriesEditingNotice` component warns host, but no attendee notification exists.

### Occurrence Overrides

**Risk:** `occurrence_overrides` can cancel or modify a single date without changing the series.
- These changes currently send `occurrenceModifiedHost` and `occurrenceCancelledHost` emails
- But those go to **hosts**, not attendees
- Attendees for that specific date should be notified

### Cancelled Status

**Risk:** Setting `status = 'cancelled'` already sends notifications via the DELETE handler.
- Don't double-notify if we add update notifications
- Check: if `status` changed to `cancelled`, skip update notification (cancellation handler covers it)

### Draft → Published (First Publish)

**Risk:** First publish sets `is_published = true` and `status = 'active'`.
- No existing RSVPs at publish time (event was draft)
- No notification needed for first publish
- Only trigger updates for already-published events

### Preference Gating

**File:** `web/src/lib/email/sendWithPreferences.ts`

All emails must use `sendEmailWithPreferences()` to respect user settings:
- Dashboard notification always created (canonical)
- Email only sent if user preference allows

---

## 8. Recommended Implementation Approach

### Publish Confirmation Checkbox

1. Add boolean state `hostConfirmed` to EventForm
2. Show checkbox when `is_published` toggle is on
3. Block submit if `is_published && !hostConfirmed`
4. On publish, optionally set `last_verified_at = now()` (auto-verify host-published events)

### Attendee Update Notifications

1. In `PATCH /api/my-events/[id]`, after successful update:
   - Compare `majorFields` between request and current event
   - If any major field changed AND event is published:
     - Query all `event_rsvps` + `timeslot_claims` for attendees
     - For each attendee, call `sendEmailWithPreferences()` with `eventUpdated` template
2. Skip if `status` changed to `cancelled` (handled elsewhere)
3. Skip if event was not previously published (`is_published` was false)

### New Email Template for Attendee Updates

The existing `eventUpdated.ts` template is ready to use. Just wire it up.

---

## Deliverables Summary

| # | Item | Status |
|---|------|--------|
| 1 | Publish write paths | Documented |
| 2 | Verification fields + writers | Documented |
| 3 | Signup tables + enumeration | Documented |
| 4 | eventUpdated behavior | Template exists, NOT wired |
| 5 | URL helpers | Documented |
| 6 | Diff rule candidates | Listed |
| 7 | Risks/edge cases | Analyzed |

---

**Awaiting approval before implementation.**

# Phase ABC5: Per-Occurrence Event Model Investigation

> **Status:** STOP-GATE REVIEW
> **Author:** Claude Agent
> **Date:** January 11, 2026
> **Approval Required From:** Sami

---

## Executive Summary

This document investigates the architectural changes needed to support **per-occurrence data** (RSVPs, comments, photos) for recurring events. Currently, when a user RSVPs to a recurring event (e.g., "Every Saturday Open Mic"), they RSVP to the **entire series** - a single record in `event_rsvps` tied to the event template.

**The User Request:** Each occurrence date should be a separate "happening detail page" with its own RSVPs, comments, management, and photos. Clicking "Sat, Jan 24" from the series should navigate to that specific occurrence's detail page.

**Risk Level:** HIGH - This is a fundamental data model change affecting 13+ intertwined systems.

**Estimated Effort:** 340-400 engineering hours (8-10 weeks for 1 developer)

---

## Current Architecture

### How Recurring Events Work Today

```
┌─────────────────────────────────────────────────────────────────┐
│                        events table                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ id: abc123                                               │    │
│  │ title: "Saturday Open Mic"                               │    │
│  │ event_date: 2025-12-01 (anchor)                          │    │
│  │ day_of_week: "Saturday"                                  │    │
│  │ recurrence_rule: "weekly"                                │    │
│  │ start_time: 20:00                                        │    │
│  │ capacity: 20                                             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Computed at runtime
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Expanded Occurrences (in-memory)                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ 2026-01-11 │ │ 2026-01-18 │ │ 2026-01-25 │ │ 2026-02-01 │   │
│  │ Saturday   │ │ Saturday   │ │ Saturday   │ │ Saturday   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Per-occurrence exceptions only
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               occurrence_overrides table                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ event_id: abc123                                         │    │
│  │ date_key: 2026-01-18                                     │    │
│  │ status: cancelled  ← Only this occurrence                │    │
│  │ override_start_time: null                                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Current Data Model Limitations

| Table | Has date_key? | Behavior |
|-------|--------------|----------|
| `event_rsvps` | **NO** | RSVPs apply to entire series |
| `event_comments` | **NO** | Comments apply to entire series |
| `timeslot_claims` | **NO** | Lineup applies to entire series |
| `gallery_images` | **NO** | Photos linked to event, not occurrence |
| `occurrence_overrides` | **YES** | Only stores cancellations/modifications |

**Key Insight:** Occurrences are computed in-memory, not persisted. The `occurrence_overrides` table only stores exceptions to the default pattern.

---

## Systems Affected

### 1. RSVP System (HIGH RISK)

**Files:**
- `app/api/events/[id]/rsvp/route.ts` (lines 57-361)
- `app/api/guest/rsvp/request-code/route.ts`
- `app/api/guest/rsvp/verify-code/route.ts` (lines 150-412)
- `lib/waitlistOffer.ts` (waitlist promotion logic)
- `components/events/RSVPButton.tsx`
- `components/events/RSVPSection.tsx`
- `components/events/AttendeeList.tsx`

**Current Behavior:**
```typescript
// One RSVP per user per series
UNIQUE(event_id, user_id)

// Capacity checked at series level
const { count } = await supabase
  .from("event_rsvps")
  .select("*", { count: "exact" })
  .eq("event_id", eventId)
  .eq("status", "confirmed");
```

**Required Changes:**
- New table: `occurrence_rsvps` with composite key `(event_id, date_key, user_id)`
- Capacity logic must check per-occurrence, not per-series
- Waitlist promotion must be per-occurrence
- Guest RSVP flow needs `date_key` parameter
- Duplicate prevention: user can RSVP to multiple occurrences of same series

### 2. Notification System (MEDIUM RISK)

**Files:**
- `app/api/events/[id]/rsvp/route.ts` (lines 306-361) - Host notifications
- `app/api/guest/rsvp/verify-code/route.ts` (lines 342-412) - Guest RSVP notifications
- `app/api/events/[id]/comments/route.ts` (lines 173-228) - Comment notifications
- `lib/notifications/preferences.ts`
- `lib/email/sendWithPreferences.ts`

**Current Behavior:**
- Fan-out: event_hosts → events.host_id → event_watchers
- One RSVP = one notification to hosts

**Required Changes:**
- Notification links need `?date=` parameter for deep-linking
- Per-occurrence RSVP = notification includes occurrence date context
- Add `occurrence_date_key` column to `notifications` table (optional)

### 3. Email System (HIGH RISK)

**Templates Affected:**

| Template | File | Change Required |
|----------|------|-----------------|
| rsvpConfirmation | `lib/email/templates/rsvpConfirmation.ts` | Add occurrence date |
| rsvpHostNotification | `lib/email/templates/rsvpHostNotification.ts` | Add occurrence context |
| eventReminder | `lib/email/templates/eventReminder.ts` | **RESTRUCTURE** for per-occurrence |
| eventUpdated | `lib/email/templates/eventUpdated.ts` | Clarify affected occurrences |
| eventCancelled | `lib/email/templates/eventCancelled.ts` | Series vs occurrence cancel |
| waitlistPromotion | `lib/email/templates/waitlistPromotion.ts` | Add occurrence context |

**Critical Issue - Event Reminders:**

Current: Cron job finds events with `event_date = tomorrow` and sends ONE reminder.

New: Must expand all recurring events, find ALL occurrences with `date_key = tomorrow`, and send reminders per-occurrence. Could result in 4x email volume.

### 4. Timeslot/Performer Signup (MEDIUM RISK)

**Files:**
- `app/api/events/[id]/timeslots/route.ts`
- `app/api/guest/timeslot-claim/verify-code/route.ts` (lines 136-175)
- `components/events/TimeslotSection.tsx`

**Current Behavior:**
- Timeslots defined at series level
- Same 5 slots every week (or admin manually updates)

**Required Changes:**
- Add `occurrence_date_key` to `timeslot_claims`
- Different lineup per occurrence
- Guest claiming must specify which occurrence

### 5. Admin Tools (LOW-MEDIUM RISK)

**Files:**
- `dashboard/admin/events/[id]/overrides/page.tsx` - Already per-occurrence
- `dashboard/admin/ops/events/page.tsx` - Bulk operations

**Current:**
- Occurrence override editor EXISTS and works
- No per-occurrence RSVP management

**Required Changes:**
- Add RSVP management per-occurrence
- Add timeslot lineup per-occurrence view
- Bulk operations may need date_key awareness

### 6. Event Detail Page (MEDIUM RISK)

**File:** `app/events/[id]/page.tsx`

**Current:**
- URL: `/events/[slug]` - No date parameter
- Shows all RSVPs for entire series
- Shows all comments for entire series
- Date pills link to `/happenings?date=...`

**Required Changes:**
- Accept `?date=` query parameter
- Filter RSVPs to show only that occurrence
- Filter comments to show only that occurrence (if per-occurrence comments)
- Date pills link to `/events/[slug]?date=YYYY-MM-DD`
- Or: New route `/events/[slug]/[date]`

### 7. Venue Page (LOW RISK - BUGFIX)

**File:** `app/venues/[id]/page.tsx`

**Current Bug:** Query uses slug instead of UUID for venue_id filter.

**Fix Applied:** Changed `.eq("venue_id", id)` to `.eq("venue_id", venue.id)`

This is independent of per-occurrence model and should be merged separately.

---

## Database Migrations Required

### New Tables

```sql
-- occurrence_rsvps: Per-occurrence RSVPs
CREATE TABLE occurrence_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  occurrence_date_key TEXT NOT NULL, -- YYYY-MM-DD
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'waitlist', 'cancelled', 'offered')),
  waitlist_position INTEGER,
  guest_name TEXT,
  guest_email TEXT,
  guest_verified BOOLEAN DEFAULT false,
  guest_verification_id UUID,
  offer_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Composite unique: one RSVP per user per occurrence
  CONSTRAINT occurrence_rsvps_unique UNIQUE (event_id, occurrence_date_key, user_id)
);

-- Indexes
CREATE INDEX occurrence_rsvps_event_date ON occurrence_rsvps(event_id, occurrence_date_key);
CREATE INDEX occurrence_rsvps_user ON occurrence_rsvps(user_id);
```

### Modified Tables

```sql
-- Add date_key to timeslot_claims
ALTER TABLE timeslot_claims
ADD COLUMN occurrence_date_key TEXT;

-- Add date_key to guest_verifications
ALTER TABLE guest_verifications
ADD COLUMN occurrence_date_key TEXT;

-- Add date_key to notifications (optional, for deep-linking)
ALTER TABLE notifications
ADD COLUMN occurrence_date_key TEXT;
```

### Data Migration

```sql
-- Backfill existing series-level RSVPs to all future occurrences
-- WARNING: This requires application-layer logic to expand occurrences
-- Cannot be done in pure SQL without recurrence expansion logic
```

**Migration Complexity:** The expansion logic lives in TypeScript (`nextOccurrence.ts`). Backfilling existing RSVPs requires either:
1. Port expansion logic to SQL (complex)
2. Run migration script in Node.js (downtime risk)
3. Dual-write for transition period (complexity)

---

## Edge Cases & Data Integrity

### Edge Case 1: Occurrence Cancelled After RSVPs

**Scenario:**
1. User RSVPs to "Sat, Jan 18"
2. Admin cancels Jan 18 via occurrence_overrides
3. What happens to RSVP?

**Solution:** Database trigger auto-cancels RSVPs when occurrence_overrides.status = 'cancelled'

```sql
CREATE OR REPLACE FUNCTION cancel_rsvps_on_occurrence_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE occurrence_rsvps
    SET status = 'cancelled', updated_at = now()
    WHERE event_id = NEW.event_id
    AND occurrence_date_key = NEW.date_key
    AND status != 'cancelled';
    -- TODO: Send cancellation emails
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Edge Case 2: Series Time Change

**Scenario:** Event's start_time changes from 8 PM to 7 PM.

**Options:**
- A: All occurrences now at 7 PM (breaking for existing RSVPs)
- B: Only future occurrences at 7 PM (complex tracking)
- C: Create overrides preserving 8 PM for past RSVPs

**Recommendation:** Option C - preserve existing expectations via overrides.

### Edge Case 3: Capacity Per-Occurrence vs Per-Series

**Question:** Does `capacity: 20` mean:
- 20 spots per occurrence (recommended)
- 20 spots total across all occurrences forever

**Recommendation:** Per-occurrence capacity. Otherwise, a weekly event would be "full" after 20 weeks.

### Edge Case 4: Waitlist Promotion

**Current:** One waitlist per series.

**New:** Separate waitlist per occurrence. Waitlist #1 for Jan 18 doesn't auto-get Jan 25 spot.

### Edge Case 5: Existing RSVPs During Migration

**Question:** If user has series-level RSVP, should migration:
- A: RSVP them to ALL future occurrences (generous)
- B: RSVP them to NEXT occurrence only (conservative)
- C: Flag as "legacy" and let them re-RSVP

**Recommendation:** Option A - honor user's intent when they RSVPed to series.

---

## Proposed Solution Approaches

### Option A: Full Per-Occurrence Model (User Request)

**Pros:**
- Each occurrence truly independent
- Clean data model
- Matches user's mental model

**Cons:**
- 340+ hours of work
- Complex migration
- Risk of email over-sending
- Admin tool gaps

**Effort:** 8-10 weeks

### Option B: Series + Per-Occurrence Overrides Only (Lighter)

Keep `event_rsvps` as series-level. Only add per-occurrence:
- Cancellations (already exists)
- Time/venue modifications (already exists)
- Capacity overrides (new)

**Pros:**
- 80% of benefit, 30% of effort
- No data migration needed
- RSVPs still work as "I'm coming to this series"

**Cons:**
- Can't see "who's coming to Jan 18 specifically"
- Capacity is still series-level

**Effort:** 2-3 weeks

### Option C: Hybrid with Date Query Parameter

Keep series-level RSVPs but add optional filtering:
- `/events/[slug]?date=2026-01-18` shows occurrence-focused view
- RSVPs still series-level but displayed contextually
- Comments remain series-level

**Pros:**
- Minimal migration
- URL supports deep-linking
- UI can show "upcoming dates" with context

**Cons:**
- RSVPs still not truly per-occurrence
- Attendee list doesn't filter by date

**Effort:** 1-2 weeks

---

## Immediate Bugfixes (Independent of Architecture Decision)

The following bugs should be fixed regardless of the per-occurrence decision:

### Bug 1: Venue Page Not Showing Happenings

**File:** `app/venues/[id]/page.tsx` line 118

**Issue:** Query uses `id` (slug) instead of `venue.id` (UUID)

**Fix:**
```typescript
// Before
.eq("venue_id", id)

// After
.eq("venue_id", venue.id)
```

**Status:** Fix applied in current session, not yet committed.

### Bug 2: RSVP Button Possibly Not Rendering

**Symptom:** Screenshot shows gray skeleton where RSVP button should be

**Possible Causes:**
1. `isLoggedIn === null` stuck (Suspense fallback)
2. Client-side hydration issue
3. Auth session check failing silently

**Investigation Needed:** Check browser console for errors on event detail page.

---

## Recommendation

**For Stop-Gate Review, I recommend:**

1. **Approve Option C (Hybrid) as MVP** - 1-2 weeks
   - Add `?date=` parameter to event detail page
   - Date pills link to `/events/[slug]?date=YYYY-MM-DD`
   - No database migration needed
   - RSVPs remain series-level but UI is occurrence-aware

2. **Defer Option A (Full Per-Occurrence) to Phase 2**
   - Requires product decision: Do users need to RSVP to specific dates?
   - Complex migration with downtime risk
   - Should be its own project with proper planning

3. **Merge venue page bugfix immediately**
   - Independent of architecture decision
   - Currently blocking venue pages from showing happenings

---

## Questions for Stop-Gate Review

1. **Is per-occurrence RSVP a hard user requirement or nice-to-have?**
   - If nice-to-have: Option C (hybrid) is fastest
   - If required: Option A with 8-10 week timeline

2. **What's the expected behavior for existing RSVPs during migration?**
   - Expand to all future occurrences?
   - Limit to next N occurrences?

3. **Should email reminders be per-occurrence?**
   - Current: One reminder per series
   - New: One reminder per occurrence user RSVPed to
   - Volume concern: 4x more emails for monthly events

4. **Is series-level capacity acceptable?**
   - "20 spots" = 20 per week? Or 20 forever?

5. **What's the rollback plan if migration fails?**
   - Downtime acceptable?
   - Dual-write transition period?

---

## Files Ready to Commit (Bugfixes)

```
modified: web/src/app/venues/[id]/page.tsx  # venue_id query fix
```

## Files NOT Ready (Pending Decision)

```
web/src/app/events/[id]/page.tsx           # Date pills linking
web/src/components/events/RSVPButton.tsx   # Per-occurrence RSVP
supabase/migrations/                        # New tables
```

---

**Next Steps:**
1. Sami reviews this document
2. Decide: Option A, B, or C
3. If Option C: I can implement in 1-2 days
4. If Option A: Create detailed implementation plan with phases

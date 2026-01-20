# Phase ABC6: Per-Occurrence RSVPs, Comments, and Timeslots

## Goal

Make RSVPs, comments, and timeslots apply to **specific occurrence dates** rather than the entire series. When a user RSVPs on `/events/foo?date=2026-01-18`, their RSVP should only apply to January 18th, not all dates in the series.

## Current State

### Schema (No `date_key`)

| Table | Key Columns | Issue |
|-------|-------------|-------|
| `event_rsvps` | `event_id`, `user_id` | RSVP applies to entire series |
| `event_comments` | `event_id`, `user_id` | Comment shown on all dates |
| `event_timeslots` | `event_id`, `slot_index` | Slots shared across all dates |
| `timeslot_claims` | `timeslot_id`, `member_id` | Claim applies to entire series |

### Current Unique Constraints

- `event_rsvps`: `UNIQUE(event_id, user_id)` - one RSVP per user per series
- `event_timeslots`: `UNIQUE(event_id, slot_index)` - one set of slots per series
- `timeslot_claims`: partial unique on `timeslot_id` where status is active

---

## Proposed Schema Changes

### 1. `event_rsvps` - Add `date_key`

```sql
-- Add date_key column (nullable for backward compatibility)
ALTER TABLE event_rsvps
  ADD COLUMN date_key TEXT;

-- Drop old unique constraint
ALTER TABLE event_rsvps
  DROP CONSTRAINT event_rsvps_event_id_user_id_key;

-- Add new unique constraint (event_id, user_id, date_key)
-- This allows same user to RSVP to multiple dates of same series
ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_event_user_date_key
  UNIQUE (event_id, user_id, date_key);

-- Update guest email unique index similarly
DROP INDEX idx_event_rsvps_guest_email_event;
CREATE UNIQUE INDEX idx_event_rsvps_guest_email_event_date
  ON event_rsvps (event_id, lower(guest_email), date_key)
  WHERE guest_email IS NOT NULL AND status <> 'cancelled';

-- Add index for date-based queries
CREATE INDEX idx_event_rsvps_date ON event_rsvps (event_id, date_key);
```

### 2. `event_comments` - Add `date_key`

```sql
-- Add date_key column (nullable - NULL means shown on all dates for backward compat)
ALTER TABLE event_comments
  ADD COLUMN date_key TEXT;

-- Add index for date-based queries
CREATE INDEX idx_event_comments_date ON event_comments (event_id, date_key);
```

### 3. `event_timeslots` - Add `date_key`

```sql
-- Add date_key column
ALTER TABLE event_timeslots
  ADD COLUMN date_key TEXT;

-- Drop old unique constraint
ALTER TABLE event_timeslots
  DROP CONSTRAINT event_timeslots_event_id_slot_index_key;

-- Add new unique constraint (event_id, date_key, slot_index)
-- This allows separate slot lineups per occurrence date
ALTER TABLE event_timeslots
  ADD CONSTRAINT event_timeslots_event_date_slot_key
  UNIQUE (event_id, date_key, slot_index);

-- Add index for date-based queries
CREATE INDEX idx_event_timeslots_date ON event_timeslots (event_id, date_key);
```

---

## API Changes Required

### RSVP API (`/api/events/[id]/rsvp`)

| Method | Current | New |
|--------|---------|-----|
| GET | Fetch by `event_id + user_id` | Fetch by `event_id + user_id + date_key` (from query param) |
| POST | Create with `event_id` | Create with `event_id + date_key` |
| DELETE | Delete by `event_id + user_id` | Delete by `event_id + user_id + date_key` |

**Breaking Change:** API must accept `date_key` parameter. Request body or query param: `{ date_key: "2026-01-18" }`

### Comments API (`/api/events/[id]/comments`)

| Method | Current | New |
|--------|---------|-----|
| GET | Fetch all by `event_id` | Fetch by `event_id` WHERE `date_key = ?` OR `date_key IS NULL` |
| POST | Create with `event_id` | Create with `event_id + date_key` |

### Guest RSVP API (`/api/guest/rsvp/*`)

- `request-code`: Accept `date_key` in body
- `verify-code`: Store `date_key` in RSVP record

### Guest Comment API (`/api/guest/event-comment/*`)

- `request-code`: Accept `date_key` in body
- `verify-code`: Store `date_key` in comment record

### Timeslot API

- `event_timeslots` creation: Include `date_key`
- `timeslot_claims`: Inherit `date_key` from timeslot

---

## UI Changes Required

### Event Detail Page (`app/events/[id]/page.tsx`)

1. **RSVPSection**: Pass `dateKey` prop from `effectiveSelectedDate`
2. **EventComments**: Pass `dateKey` prop, filter comments by date
3. **TimeslotSection**: Pass `dateKey` prop, fetch/create slots for specific date
4. **AttendeeList**: Filter by `date_key`

### Components to Update

| Component | Change |
|-----------|--------|
| `RSVPSection.tsx` | Add `dateKey` prop, pass to API calls |
| `RSVPButton.tsx` | Include `date_key` in POST body |
| `EventComments.tsx` | Add `dateKey` prop, filter comments |
| `TimeslotSection.tsx` | Add `dateKey` prop, fetch date-specific slots |
| `AttendeeList.tsx` | Add `dateKey` prop, filter attendees |
| `GuestTimeslotClaimForm.tsx` | Include `date_key` in claim |

### Remove Series-Level Notices

Remove the "Series RSVP/comments/lineup" notices added in previous commit since they will no longer apply.

---

## Migration Strategy

### Phase 1: Schema Migration (Additive)
1. Add `date_key` columns (nullable, no constraints changed yet)
2. Deploy - existing functionality unchanged

### Phase 2: API Updates
1. Update APIs to accept optional `date_key` parameter
2. If `date_key` provided, use it; if not, fall back to series behavior
3. Deploy - backward compatible

### Phase 3: UI Updates
1. Update components to pass `date_key` from URL
2. Deploy - new behavior for users accessing via `?date=`

### Phase 4: Constraint Migration
1. Update unique constraints to include `date_key`
2. This is the breaking change - old RSVPs without date_key treated as "all dates"

---

## Data Migration Considerations

### Existing RSVPs
- Existing RSVPs have `date_key = NULL`
- Decision needed:
  - **Option A:** NULL means "all dates" (backward compat but confusing)
  - **Option B:** Migrate existing to next occurrence date
  - **Option C:** Clear existing RSVPs (disruptive but clean)

### Existing Comments
- Existing comments have `date_key = NULL`
- Show NULL-dated comments on ALL dates (backward compat)
- New comments get specific date

### Existing Timeslots
- More complex - timeslots need to be duplicated per date
- Or: Generate timeslots on-demand when first accessed for a date

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking existing RSVPs | High | Phase migration, backward compat for NULL |
| Performance (more rows) | Medium | Proper indexing on date_key |
| Waitlist complexity | High | Waitlist now per-date, need careful testing |
| Email notifications | Medium | Include date in all notification emails |
| Capacity tracking | Medium | Capacity now per-occurrence, not per-series |

---

## Questions for Approval

1. **Existing RSVPs:** What to do with RSVPs that have no date_key?
   - Show on all dates?
   - Migrate to next upcoming date?
   - Clear them?

2. **Capacity:** Is capacity per-occurrence or per-series?
   - If 20 capacity and 10 dates, is it 20 total or 20 per date?

3. **Timeslots:** Generate slots per-date on demand, or pre-generate for all dates in window?

4. **Scope:** All three (RSVP + comments + timeslots) or just RSVP first?

---

## Recommendation

Start with **RSVPs only** as Phase ABC6a:
1. Lowest risk (comments are less critical, timeslots more complex)
2. Most impactful for user experience
3. Can iterate on comments/timeslots in ABC6b/ABC6c

---

## Files to Modify

### Migration
- `supabase/migrations/YYYYMMDD_add_date_key_to_rsvps.sql`

### API Routes
- `app/api/events/[id]/rsvp/route.ts`
- `app/api/guest/rsvp/request-code/route.ts`
- `app/api/guest/rsvp/verify-code/route.ts`

### Components
- `components/events/RSVPSection.tsx`
- `components/events/RSVPButton.tsx`
- `components/events/AttendeeList.tsx`
- `app/events/[id]/page.tsx`

### Remove
- Series-level notices from `app/events/[id]/page.tsx`

---

## Estimated Scope

| Area | Files | Complexity |
|------|-------|------------|
| Migration | 1 | Low |
| RSVP API | 3 | Medium |
| Components | 4 | Medium |
| Testing | 1 | Medium |
| **Total** | ~9 files | Medium |

---

**STOP: Awaiting approval before proceeding with implementation.**

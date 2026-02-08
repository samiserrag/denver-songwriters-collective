# Events System Deep Dive Audit

**Audit Date:** December 2025
**Status:** Investigation Complete

---

## Executive Summary

The events system has evolved organically with **two distinct event paradigms** that have become somewhat conflated:

1. **Open Mics (Community Directory)** - A curated directory of recurring open mic nights at various venues, created via public submission and admin approval
2. **DSC Events (Collective-Organized)** - One-time or recurring events organized by The Colorado Songwriters Collective, with RSVP/timeslot booking

These are currently stored in the same `events` table with the `is_dsc_event` boolean distinguishing them, but they have **fundamentally different workflows, permissions, and display contexts**.

---

## Part 1: Event Type Taxonomy

### 1.1 Database Event Types

**`event_type` enum values:**
```
{open_mic,showcase,song_circle,workshop,other}
```

**Current Data Distribution:**
| event_type | Count | is_dsc_event |
|-----------|-------|--------------|
| open_mic | ~100+ | mostly false |
| showcase | few | true |
| song_circle | few | true |
| workshop | few | true |
| other | few | mixed |

### 1.2 The Two Event Paradigms

#### Paradigm A: Open Mic Directory Events
| Attribute | Value |
|-----------|-------|
| `is_dsc_event` | `false` |
| `event_type` | `open_mic` |
| Creator | Anyone (via submission) or Admin |
| Approval | Required (via `event_update_suggestions`) |
| Has Timeslots | Never (external signup systems) |
| Has RSVP | Never |
| Recurring | Yes (day_of_week based, no event_date) |
| Display Location | `/open-mics` only |
| Detail Page | `/open-mics/[slug]` |

#### Paradigm B: DSC Community Events
| Attribute | Value |
|-----------|-------|
| `is_dsc_event` | `true` |
| `event_type` | Any (showcase, song_circle, workshop, open_mic, other) |
| Creator | Approved Host or Admin |
| Approval | Not required |
| Has Timeslots | Optional (for signups) |
| Has RSVP | Yes (when no timeslots) |
| Recurring | Optional (via series creation) |
| Display Location | `/events` (Happenings) only |
| Detail Page | `/events/[id]` |

### 1.3 Key Differentiators

| Feature | Open Mic Directory | DSC Event |
|---------|-------------------|-----------|
| **Purpose** | Venue/host promotion | Collective organizing |
| **event_date** | Usually null (recurring) | Required (specific date) |
| **venue_id** | Required | Required |
| **is_published** | Controls visibility | Controls visibility |
| **status** | active/inactive/cancelled/needs_verification | active/cancelled |
| **Timeslots** | Not used | Optional |
| **RSVPs** | Not used | Optional |
| **Host Controls** | None | Full (lineup page, TV display) |

---

## Part 2: Database Schema Analysis

### 2.1 Events Table (Complete Schema)

```sql
                                          Table "public.events"
         Column          |           Type           | Nullable |      Purpose
-------------------------+--------------------------+----------+------------------------------------
 id                      | uuid                     | not null | Primary key
 title                   | text                     | not null | Event name
 description             | text                     |          | Long description
 notes                   | text                     |          | Admin/internal notes
 event_type              | event_type               |          | open_mic/showcase/song_circle/workshop/other
 is_dsc_event            | boolean                  | default false | DSC vs directory event

 -- Venue info (denormalized + FK)
 venue_id                | uuid                     |          | FK to venues table
 venue_name              | text                     |          | Denormalized venue name
 venue_address           | text                     |          | Denormalized address

 -- Scheduling
 day_of_week             | text                     |          | For recurring (Monday, Tuesday, etc.)
 start_time              | time                     |          | Event start time
 end_time                | time                     |          | Event end time
 signup_time             | time                     |          | When signups begin (open mics)
 event_date              | date                     |          | Specific date (DSC events)

 -- Recurrence
 recurrence_rule         | text                     |          | Human-readable ("Every Monday")
 is_recurring            | boolean                  | default false | Recurring event flag
 recurrence_pattern      | text                     |          | weekly/biweekly/monthly
 recurrence_end_date     | date                     |          | When recurring series ends
 parent_event_id         | uuid                     |          | FK to parent event (recurring instances)

 -- Series (for DSC events)
 series_id               | uuid                     |          | Groups related events
 series_index            | integer                  |          | Position in series

 -- Capacity/Booking
 capacity                | integer                  |          | Max attendees
 has_timeslots           | boolean                  | default false | Enable timeslot booking
 total_slots             | integer                  |          | Number of performance slots
 slot_duration_minutes   | integer                  |          | Length of each slot
 allow_guest_slots       | boolean                  | default false | Allow non-member signups

 -- Publishing
 status                  | text                     | default 'active' | active/inactive/cancelled/etc.
 is_published            | boolean                  | default true | Public visibility

 -- Media
 cover_image_url         | text                     |          | Event image
 category                | text                     |          | music/comedy/poetry/variety/other
 slug                    | text                     |          | URL-friendly identifier

 -- Verification (open mics)
 last_verified_at        | timestamp                |          | Last community verification
 verified_by             | uuid                     |          | Who verified

 -- Metadata
 created_at              | timestamp                | not null | Creation time
 updated_at              | timestamp                |          | Last update
 host_id                 | uuid                     |          | Legacy host reference (unused?)

Indexes:
    "events_pkey" PRIMARY KEY (id)
    "events_slug_key" UNIQUE (slug)
    "idx_events_slug" (slug)
    "idx_events_venue_id" (venue_id)

Foreign Keys:
    "events_venue_id_fkey" FOREIGN KEY (venue_id) REFERENCES venues(id)
    "events_parent_event_id_fkey" FOREIGN KEY (parent_event_id) REFERENCES events(id)
```

### 2.2 Related Tables

#### event_timeslots
```sql
                                   Table "public.event_timeslots"
     Column      |           Type           | Nullable |      Purpose
-----------------+--------------------------+----------+------------------------------------
 id              | uuid                     | not null | Primary key
 event_id        | uuid                     | not null | FK to events
 slot_index      | integer                  | not null | Position (1, 2, 3...)
 start_offset_min| integer                  |          | Minutes from event start
 duration_minutes| integer                  | not null | Slot length
 status          | text                     | default 'available' | available/claimed/performed
 created_at      | timestamp                | not null |
```

#### timeslot_claims
```sql
                                   Table "public.timeslot_claims"
     Column      |           Type           | Nullable |      Purpose
-----------------+--------------------------+----------+------------------------------------
 id              | uuid                     | not null | Primary key
 timeslot_id     | uuid                     | not null | FK to event_timeslots
 member_id       | uuid                     |          | FK to profiles (null for guests)
 guest_name      | text                     |          | Guest performer name
 guest_email     | text                     |          | Guest email (for verification)
 status          | text                     | not null | confirmed/waitlist/cancelled/performed/no_show
 created_at      | timestamp                | not null |
 updated_at      | timestamp                |          |

Indexes:
    "idx_timeslot_claims_event_id" (via join through timeslots)
    "idx_timeslot_claims_status" (status)
    "idx_open_mic_claims_profile_id" (member_id) -- legacy name
```

#### event_rsvps
```sql
                                      Table "public.event_rsvps"
       Column        |           Type           | Nullable |      Purpose
---------------------+--------------------------+----------+------------------------------------
 id                  | uuid                     | not null | Primary key
 event_id            | uuid                     | not null | FK to events
 user_id             | uuid                     | not null | FK to auth.users
 status              | text                     | not null | confirmed/waitlist/cancelled/offered
 waitlist_position   | integer                  |          | Position in waitlist
 notes               | text                     |          | User notes
 offer_expires_at    | timestamp                |          | 24-hour claim window
 created_at          | timestamp                | not null |
 updated_at          | timestamp                |          |
```

#### event_hosts
```sql
                                     Table "public.event_hosts"
      Column       |           Type           | Nullable |      Purpose
-------------------+--------------------------+----------+------------------------------------
 id                | uuid                     | not null | Primary key
 event_id          | uuid                     | not null | FK to events
 user_id           | uuid                     | not null | FK to auth.users
 role              | text                     | not null | host/cohost
 invitation_status | text                     | not null | pending/accepted/declined
 invited_by        | uuid                     |          | Who invited
 invited_at        | timestamp                |          |
 responded_at      | timestamp                |          |
 created_at        | timestamp                | not null |
```

#### event_update_suggestions
```sql
                              Table "public.event_update_suggestions"
       Column        |           Type           | Nullable |      Purpose
---------------------+--------------------------+----------+------------------------------------
 id                  | uuid                     | not null | Primary key
 event_id            | uuid                     |          | FK to existing event (null for new)
 _new_event          | jsonb                    |          | Full new event data (for submissions)
 suggestion_type     | text                     |          | update/new/discontinue

 -- What's being suggested
 suggested_day       | text                     |          |
 suggested_time      | time                     |          |
 suggested_venue     | text                     |          |
 suggested_description| text                    |          |

 -- Submitter info
 submitter_name      | text                     |          |
 submitter_email     | text                     |          |

 -- Review status
 status              | text                     | default 'pending' | pending/approved/rejected/needs_info
 admin_response      | text                     |          |
 reviewed_by         | uuid                     |          |
 reviewed_at         | timestamp                |          |
 created_at          | timestamp                | not null |
```

#### event_lineup_state
```sql
                                  Table "public.event_lineup_state"
     Column      |           Type           | Nullable |      Purpose
-----------------+--------------------------+----------+------------------------------------
 id              | uuid                     | not null | Primary key
 event_id        | uuid                     | not null | FK to events
 current_slot_id | uuid                     |          | Currently performing slot
 status          | text                     | default 'not_started' | not_started/in_progress/completed
 updated_at      | timestamp                |          |
 updated_by      | uuid                     |          |
```

#### approved_hosts
```sql
                                   Table "public.approved_hosts"
     Column     |           Type           | Nullable |      Purpose
----------------+--------------------------+----------+------------------------------------
 id             | uuid                     | not null | Primary key
 user_id        | uuid                     | not null | FK to auth.users
 approved_by    | uuid                     |          | Who approved
 approved_at    | timestamp                |          |
 status         | text                     | default 'active' | active/suspended/revoked
 notes          | text                     |          |
 created_at     | timestamp                | not null |
```

#### host_requests
```sql
                                    Table "public.host_requests"
      Column       |           Type           | Nullable |      Purpose
-------------------+--------------------------+----------+------------------------------------
 id                | uuid                     | not null | Primary key
 user_id           | uuid                     | not null | Who is requesting
 message           | text                     |          | Why they want to be a host
 status            | text                     | default 'pending' | pending/approved/rejected
 reviewed_by       | uuid                     |          |
 reviewed_at       | timestamp                |          |
 rejection_reason  | text                     |          |
 created_at        | timestamp                | not null |
```

---

## Part 3: Creation Flows Audit

### 3.1 Open Mic Submission Flow (Community)

**Entry Point:** `/submit-open-mic`
**Who Can Use:** Anyone (no auth required)
**Result:** Creates `event_update_suggestions` record with `_new_event` JSON

**Flow:**
1. User fills out form (venue, day, time, description)
2. Data stored in `event_update_suggestions._new_event` as JSON
3. Admin reviews at `/dashboard/admin/event-update-suggestions`
4. If approved, admin manually creates event in `/dashboard/admin/events/new`

**Key Issue:** There's no automated flow from approved suggestion → event creation. Admin must manually copy data.

### 3.2 Admin Event Creation Flow

**Entry Point:** `/dashboard/admin/events/new`
**Who Can Use:** Admins only
**Component:** `EventCreateForm.tsx`

**Creates events with:**
- Basic event info (title, venue, times)
- Event type selection
- Status management
- **Does NOT create timeslots**
- **Does NOT set `is_dsc_event`**

**Key Issue:** This form is designed for open mic directory entries, not DSC events. No timeslot or RSVP configuration.

### 3.3 DSC Event Creation Flow (Host/Admin)

**Entry Point:** `/dashboard/my-events/new`
**Who Can Use:** Approved Hosts (via `approved_hosts` table) or Admins
**API Endpoint:** `POST /api/my-events`
**Component:** `EventForm.tsx` with `SlotConfigSection.tsx`

**Creates events with:**
- `is_dsc_event: true`
- Timeslot configuration (when enabled)
- Series creation (multiple dates)
- Host assignment via `event_hosts` table
- Automatically generates `event_timeslots` via RPC

**Flow:**
1. Check `checkHostStatus()` - must be admin or in `approved_hosts`
2. Create event record
3. Insert into `event_hosts` with role "host"
4. If `has_timeslots`, call `generate_event_timeslots()` RPC
5. Return event ID(s)

### 3.4 Member Gig/Showcase Creation

**Status:** NOT IMPLEMENTED

There is no way for members to create their own gigs/showcases. The only paths are:
- Be an approved host → create DSC events
- Submit to open mic directory → requires admin approval

**Gap:** Members cannot self-promote their own shows.

---

## Part 4: Management Flows Audit

### 4.1 Admin Capabilities

| Capability | Location | Status |
|-----------|----------|--------|
| View all events | `/dashboard/admin/events` | ✅ Works |
| Create events | `/dashboard/admin/events/new` | ✅ Works (open mic style) |
| Edit any event | `/dashboard/admin/events/[id]/edit` | ⚠️ Needs verification |
| Delete events | Via table actions | ⚠️ Needs verification |
| Review suggestions | `/dashboard/admin/event-update-suggestions` | ✅ Works |
| Manage open mic status | `/dashboard/admin/open-mics` | ✅ Works |
| Assign hosts | Not implemented | ❌ Gap |
| View all RSVPs | Not centralized | ❌ Gap |
| Manage timeslots globally | Not implemented | ❌ Gap |

### 4.2 Host/Creator Capabilities

| Capability | Location | Status |
|-----------|----------|--------|
| View own events | `/dashboard/my-events` | ✅ Works |
| Create events | `/dashboard/my-events/new` | ✅ Works (requires approval) |
| Edit own events | `/dashboard/my-events/[id]` | ✅ Works |
| Manage timeslots | `/events/[id]/lineup` | ✅ Works |
| View RSVPs | `/api/my-events/[id]/rsvps` | ✅ API exists |
| Cancel events | Via publish/unpublish | ⚠️ Partial |
| Transfer ownership | Not implemented | ❌ Gap |
| Invite co-hosts | `/api/my-events/[id]/cohosts` | ✅ API exists |

### 4.3 Open Mic Host Capabilities

**Status:** LIMITED

Open mic hosts (community directory) have NO special capabilities:
- Cannot edit their own open mic
- Cannot manage performers
- Cannot claim/verify events

**Reason:** Open mic directory events don't have a host ownership model - they're just listings.

---

## Part 5: RSVP System Audit

### 5.1 RSVP Flow

**Applicable To:** DSC events where `has_timeslots = false`

**Flow:**
1. User visits `/events/[id]`
2. `RSVPSection` component shows RSVP button
3. User clicks → `POST /api/events/[id]/rsvp`
4. Creates `event_rsvps` record with status `confirmed` or `waitlist`
5. If at capacity, joins waitlist with position

### 5.2 Waitlist Offer System

**Documented in:** `docs/stream-3-rsvp-flow.md`

When someone cancels:
1. Next waitlist person gets status = `offered`
2. `offer_expires_at` set to 24 hours
3. User has 24h to confirm via `/events/[id]?confirm=true`
4. If not confirmed, offer moves to next person

### 5.3 RSVP Management

| Capability | Status |
|-----------|--------|
| User can RSVP | ✅ Works |
| User can cancel | ✅ Works (modal) |
| User sees their RSVPs | ✅ `/dashboard/my-rsvps` |
| Host views RSVPs | ⚠️ API only, no UI |
| Export attendee list | ❌ Not implemented |
| Manual RSVP add | ❌ Not implemented |

---

## Part 6: Timeslot/Booking System Audit

### 6.1 Timeslot Creation

**Trigger:** Event creation with `has_timeslots: true`
**RPC:** `generate_event_timeslots(p_event_id)`

Creates timeslots based on:
- `total_slots` - number of slots
- `slot_duration_minutes` - length per slot
- `start_time` - event start (calculates offsets)

### 6.2 Performer Booking Flow

**Component:** `TimeslotSection.tsx`

**Flow:**
1. User views `/events/[id]`
2. `TimeslotSection` fetches timeslots + claims
3. Available slots show "Claim Slot" button
4. User clicks → inserts `timeslot_claims` with status `confirmed`
5. UI updates optimistically

**Key Features:**
- One claim per user per event
- Claimed slots show performer name with profile link
- Slot owner sees "Release Slot" option

### 6.3 Guest Booking

**Status:** PARTIALLY IMPLEMENTED

Schema supports:
- `allow_guest_slots` flag on events
- `guest_name`, `guest_email` on timeslot_claims

**Missing:**
- Guest verification flow (see `docs/future-specs/progressive-identity.md`)
- Guest email confirmation
- Guest claim management

### 6.4 Day-of Management

**Lineup Control Page:** `/events/[id]/lineup`

**Features:**
- Mark performer as "now playing"
- Track completed performances
- **Status:** Basic implementation exists

**Missing:**
- Walk-in addition
- Performer reordering
- No-show marking
- Real-time updates

### 6.5 TV Display

**Display Page:** `/events/[id]/display`

**Status:** EXISTS (basic)

Shows:
- Current performer
- Up next queue

**Missing:**
- QR code for signups
- Countdown timer
- Fullscreen mode

---

## Part 7: Public Display Audit

### 7.1 Events Listing Pages

| Page | Content | Query Filter |
|------|---------|--------------|
| `/events` | DSC events + other non-open-mic | `event_type != 'open_mic' OR is_dsc_event = true` |
| `/open-mics` | Open mic directory only | `event_type = 'open_mic' AND is_published = true AND status = 'active'` |

**Issue:** The Events page logic is confusing:
```typescript
// Upcoming events excluding open mics AND DSC events
.neq('event_type', 'open_mic')
.neq('is_dsc_event', true)

// Then separately fetches DSC events
.eq("is_dsc_event", true)
```

This means non-DSC, non-open-mic events (member gigs?) would appear. But there's no way to create those.

### 7.2 Filtering & Discovery

**Open Mics Page:**
- ✅ Day of week filter
- ✅ Status filter (active/unverified/inactive)
- ✅ City filter
- ✅ Text search
- ✅ List/Grid view toggle
- ⚠️ Map view (button exists, unclear if functional)

**Events Page:**
- ❌ No filters
- ❌ No search
- ❌ No date range

### 7.3 Detail Pages

| Event Type | Detail Page | Features |
|-----------|-------------|----------|
| Open Mic | `/open-mics/[slug]` | Venue info, map, recurrence |
| DSC Event | `/events/[id]` | RSVP/Timeslots, hosts, calendar add |

---

## Part 8: User Permissions Matrix

| Action | Guest | Member | Approved Host | Admin |
|--------|-------|--------|---------------|-------|
| View public events | ✅ | ✅ | ✅ | ✅ |
| RSVP to DSC event | ❌ | ✅ | ✅ | ✅ |
| Sign up for timeslot | ❌ | ✅ | ✅ | ✅ |
| Submit open mic | ✅ | ✅ | ✅ | ✅ |
| Create DSC event | ❌ | ❌ | ✅ | ✅ |
| Create open mic (direct) | ❌ | ❌ | ❌ | ✅ |
| Edit own DSC event | - | ❌ | ✅ | ✅ |
| Edit any event | ❌ | ❌ | ❌ | ✅ |
| Delete own event | - | ❌ | ⚠️ | ✅ |
| Delete any event | ❌ | ❌ | ❌ | ✅ |
| Manage own timeslots | - | ❌ | ✅ | ✅ |
| Manage any timeslots | ❌ | ❌ | ❌ | ✅ |
| View own RSVPs | - | ✅ | ✅ | ✅ |
| View event RSVPs | ❌ | ❌ | ✅ (own) | ✅ |
| Approve submissions | ❌ | ❌ | ❌ | ✅ |
| Assign hosts | ❌ | ❌ | ❌ | ❌ (not impl) |
| Request host status | - | ✅ | - | - |

---

## Part 9: Edge Cases & Scenarios

### 9.1 Open Mic Scenarios

| Scenario | Current Behavior | Issue |
|----------|-----------------|-------|
| User submits open mic → admin approves | Suggestion marked approved, admin manually creates event | No automation |
| User submits open mic → admin rejects | Suggestion marked rejected, email sent | ✅ Works |
| Host claims existing open mic | NOT POSSIBLE | No claim system for directory events |
| Host edits their open mic | NOT POSSIBLE | No ownership model |
| Open mic status changes | Admin updates in `/dashboard/admin/open-mics` | ✅ Works |

### 9.2 Event Lifecycle

| Scenario | Current Behavior | Issue |
|----------|-----------------|-------|
| Event created as draft | `is_published: false`, not shown publicly | ✅ Works |
| Event published | `is_published: true` | ✅ Works |
| Event cancelled | `status: cancelled` | Unclear if RSVPs notified |
| Event past date | Still shows in past events section | ✅ Works |
| Recurring series cancelled | Each instance has own status | Must cancel individually |

### 9.3 Booking Scenarios

| Scenario | Current Behavior | Issue |
|----------|-----------------|-------|
| Slot fills up → user tries to book | Error message "This slot is already taken" | ✅ Works |
| User books slot → wants to cancel | Can release slot | ✅ Works |
| Guest books slot | Schema supports, UI doesn't | Progressive Identity not implemented |
| Walk-in added day-of | NOT POSSIBLE | No UI for this |
| User books multiple slots | Allowed (no limit) | May want to restrict |

### 9.4 Permission Edge Cases

| Scenario | Current Behavior | Issue |
|----------|-----------------|-------|
| User becomes admin | Immediate host privileges | ✅ Works |
| Host approval revoked | `status: revoked` in approved_hosts | Need to verify event access blocked |
| Member banned | NOT IMPLEMENTED | No ban system |

---

## Part 10: UX Pain Points

### 10.1 Navigation Confusion

1. **"Host an event" goes to open mic submission** - Button on Events page links to `/submit-open-mic`, but user might want to create a DSC event
2. **No way to find "My Events" from navigation** - Must go to Dashboard first
3. **Open Mics vs Events** - Unclear to users why these are separate pages

### 10.2 Unclear Permissions

1. **"Become a Host" messaging** - Shows on My Events but doesn't explain what hosts can do
2. **No indication of approval status** - After submitting host request, no visibility into status
3. **Admin-only features not hidden** - Some pages may show loading then "access denied"

### 10.3 Missing Feedback

1. **Open mic submission success** - Unclear what happens next
2. **Host request status** - No way to check pending status
3. **RSVP waitlist position** - User doesn't know where they are

### 10.4 Inconsistent Patterns

1. **Two different event creation forms** - Admin form vs Host form
2. **Different detail pages** - `/open-mics/[slug]` vs `/events/[id]`
3. **Different data models** - Open mics use `day_of_week`, DSC events use `event_date`

### 10.5 Mobile Issues

1. **Timeslot grid may be cramped** on small screens
2. **Filter dropdowns** - Many options on open mics page

---

## Part 11: Gap Analysis

### 11.1 Missing Features

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Automated suggestion → event creation | High | Medium | Admin workflow improvement |
| Host event claim system | Medium | Medium | Let hosts claim open mic ownership |
| Member gig/showcase creation | Medium | Low | Allow self-promotion |
| Guest slot booking (Progressive Identity) | Medium | High | Already spec'd in docs |
| RSVP admin UI | Medium | Low | View/manage attendees |
| Walk-in management | Low | Medium | Day-of operations |
| TV display polish | Low | Low | Fullscreen, QR codes |

### 11.2 Schema Gaps

| Missing | Purpose | Impact |
|---------|---------|--------|
| `created_by` on events | Track original creator | Can't identify who created open mic submissions |
| `claimed_by` / ownership model | Let hosts claim open mics | Open mics have no owner |
| Event categories/tags | Better filtering | Limited to `category` field |
| Venue verification status | Trust indicator | All venues treated equally |

### 11.3 UI Gaps

| Gap | Priority |
|-----|----------|
| Unified event creation wizard | Medium |
| Host dashboard with RSVPs | Medium |
| Centralized admin event search | Low |
| Event calendar view | Low |
| Performer queue management UI | Low |

---

## Part 12: Recommended Architecture

### 12.1 Clarify the Two Event Types

**Option A: Keep Merged, Add Clearer Flags**
- Add `submission_type: 'community' | 'dsc' | 'member'`
- Better document the `is_dsc_event` distinction
- Unified creation flow with type selection

**Option B: Separate Tables** (More Breaking)
- `open_mic_listings` - Community directory (no RSVPs, no timeslots)
- `dsc_events` - Collective events (full booking)
- Shared `venues` and `profiles` tables

**Recommendation:** Option A - less migration, clearer code paths

### 12.2 Add Ownership Model to Open Mics

1. Add `host_profile_id` to events for claimed open mics
2. Create claiming flow with admin approval
3. Let verified hosts edit their open mic details

### 12.3 Unified Event Creation Flow

```
/dashboard/events/new
  ↓
[Select Event Type]
  ├── Community Open Mic → Simplified form, goes to suggestions queue
  ├── DSC Event → Full form with timeslots/RSVP, immediate creation
  └── Member Gig → Medium form, listed on Events page
```

### 12.4 Better Admin Tools

1. **Event Search** - Admin can search all events
2. **Bulk Status Updates** - Mark multiple open mics as verified
3. **RSVP Export** - CSV download for event organizers
4. **Suggestion → Event Pipeline** - One-click approval creates event

---

## Part 13: Implementation Roadmap

### Phase 1: Quick Wins (1-2 weeks)
- [ ] Add `created_by` field to events table
- [ ] Build admin RSVP viewer for hosts
- [ ] Add "What happens next" messaging to open mic submission
- [ ] Link "Host an event" to proper flow based on user role

### Phase 2: Host Improvements (2-3 weeks)
- [ ] Create open mic claim/ownership system
- [ ] Let claimed hosts edit their own open mic
- [ ] Add host verification badges to listings
- [ ] Build host dashboard with event stats

### Phase 3: Member Features (2-3 weeks)
- [ ] Enable member gig/showcase creation
- [ ] Add member gig approval queue (optional)
- [ ] Display member gigs on Events page
- [ ] Profile integration (show upcoming gigs on profile)

### Phase 4: Booking Polish (3-4 weeks)
- [ ] Implement Progressive Identity for guest slots
- [ ] Build walk-in management UI
- [ ] Add performer reordering during event
- [ ] Polish TV display with QR codes

### Phase 5: Admin Tools (2-3 weeks)
- [ ] Unified event search/filter
- [ ] Bulk status updates
- [ ] Suggestion → Event automation
- [ ] RSVP/attendee export

---

## Appendix: Key File Locations

| Purpose | File Path |
|---------|-----------|
| Event types TypeScript | `web/src/types/events.ts` |
| Database types | `web/src/lib/supabase/database.types.ts` |
| Admin auth helpers | `web/src/lib/auth/adminAuth.ts` |
| Open mic page | `web/src/app/open-mics/page.tsx` |
| Events page | `web/src/app/events/page.tsx` |
| DSC event detail | `web/src/app/events/[id]/page.tsx` |
| Open mic detail | `web/src/app/open-mics/[slug]/page.tsx` |
| Admin events | `web/src/app/(protected)/dashboard/admin/events/` |
| Host event form | `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` |
| Timeslot section | `web/src/components/events/TimeslotSection.tsx` |
| RSVP section | `web/src/components/events/RSVPSection.tsx` |
| My Events API | `web/src/app/api/my-events/route.ts` |
| RSVP API | `web/src/app/api/events/[id]/rsvp/route.ts` |

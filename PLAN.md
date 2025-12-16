# Event Signup System Enhancements - Implementation Plan

## Overview
Enhance the existing RSVP system with calendar integration, improved user experience, cancellation management, and timeslot-based signups for open mics.

---

## Current State (Already Implemented)
- RSVPButton component with confirmed/waitlist states
- Waitlist auto-promotion when spots open
- Email notifications for RSVP confirmation and waitlist promotion
- In-app notifications via `notifications` table
- Host dashboard with RSVP/attendee lists
- Capacity management and waitlist positioning

---

## Phase 1: Calendar Integration & Confirmation UX

### 1.1 Add to Calendar Functionality

**New Component:** `AddToCalendarButton.tsx`
- Generate .ics file download (works with all calendar apps)
- Google Calendar link (opens in new tab)
- Apple Calendar link (webcal:// protocol)
- Outlook Calendar link

**Implementation:**
```typescript
// Props needed from event
interface CalendarEventProps {
  title: string;
  description: string;
  startDate: string; // ISO date
  startTime: string; // HH:MM:SS
  endTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  eventUrl: string; // Link back to event page
}

// Generate ICS file content
function generateICS(event: CalendarEventProps): string {
  // RFC 5545 compliant iCalendar format
}

// Generate Google Calendar URL
function getGoogleCalendarUrl(event: CalendarEventProps): string {
  // https://calendar.google.com/calendar/render?action=TEMPLATE&...
}
```

**Display Locations:**
1. RSVPButton - Show "Add to Calendar" dropdown after successful RSVP
2. Email confirmation - Include calendar links/attachment
3. Dashboard "My RSVPs" page - Calendar button per event

### 1.2 RSVP Confirmation Message Enhancement

**Update RSVPButton confirmed state to show:**
```
✓ You're going!
We'll see you there

[Add to Calendar ▼]

📧 Confirmation sent to your email
Please cancel if you can't make it to release your spot for others.
```

**Update waitlist state to show:**
```
⏳ On waitlist (#3)
We'll notify you if a spot opens

📧 Confirmation sent to your email
```

### 1.3 Email Template Enhancements

**Update `getRsvpConfirmationEmail`:**
- Add .ics attachment for confirmed RSVPs
- Add "Add to Google Calendar" button
- Add prominent cancellation link: `/events/{id}?cancel=true`
- Add reminder message about canceling if unable to attend

**New Email Content:**
```html
<!-- After event details -->
<div style="margin: 24px 0; text-align: center;">
  <a href="{googleCalendarUrl}" style="...">Add to Google Calendar</a>
  <a href="{outlookCalendarUrl}" style="...">Add to Outlook</a>
</div>

<div style="margin: 24px 0; padding: 16px; background: #FEF3C7; border-radius: 8px;">
  <p style="margin: 0; color: #92400E;">
    <strong>Can't make it?</strong> Please cancel your RSVP to release your spot for someone else.
  </p>
  <a href="{cancelUrl}" style="color: #DC2626;">Cancel RSVP →</a>
</div>
```

---

## Phase 2: User Dashboard - My RSVPs

### 2.1 New Dashboard Page: `/dashboard/my-rsvps`

**Purpose:** Show all events user has RSVP'd to (confirmed + waitlisted)

**Features:**
- List of upcoming events with RSVP status
- "Add to Calendar" button per event
- "Cancel RSVP" button per event
- Show waitlist position if waitlisted
- Filter: Upcoming / Past / Cancelled
- Empty state with link to events page

**UI Layout:**
```
My RSVPs
─────────────────────────────────────

[Upcoming] [Past] [Cancelled]

┌─────────────────────────────────────┐
│ 🎸 Wednesday Song Circle            │
│ Dec 18, 2024 • 7:00 PM             │
│ The Venue Name • Denver, CO         │
│                                     │
│ Status: ✓ Confirmed                 │
│                                     │
│ [Add to Calendar ▼] [Cancel RSVP]   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 📚 Songwriting Workshop             │
│ Dec 20, 2024 • 6:30 PM             │
│ Another Venue • Aurora, CO          │
│                                     │
│ Status: ⏳ Waitlist (#2)            │
│                                     │
│ [Leave Waitlist]                    │
└─────────────────────────────────────┘
```

### 2.2 API Endpoint: `/api/my-rsvps`

**GET:** Returns all RSVPs for authenticated user with event details
```typescript
interface MyRsvpResponse {
  id: string;
  status: 'confirmed' | 'waitlist' | 'cancelled';
  waitlist_position: number | null;
  created_at: string;
  event: {
    id: string;
    title: string;
    event_type: string;
    event_date: string | null;
    day_of_week: string | null;
    start_time: string | null;
    end_time: string | null;
    venue_name: string | null;
    venue_address: string | null;
  };
}
```

### 2.3 Navigation Update

Add "My RSVPs" to dashboard sidebar navigation (after "My Events" for hosts)

---

## Phase 3: Enhanced Cancellation Flow

### 3.1 Cancel via URL Parameter

**Event Detail Page Enhancement:**
- Check for `?cancel=true` query param
- If present and user has RSVP, show cancellation confirmation modal
- Auto-open modal on page load

### 3.2 Cancellation Confirmation Modal

**New Component:** `CancelRsvpModal.tsx`
```
┌─────────────────────────────────────┐
│         Cancel Your RSVP?           │
│                                     │
│ Are you sure you want to cancel     │
│ your RSVP for "Song Circle"?        │
│                                     │
│ ℹ️ If someone is on the waitlist,   │
│ they'll automatically get your spot │
│                                     │
│    [Keep My Spot]  [Yes, Cancel]    │
└─────────────────────────────────────┘
```

### 3.3 Post-Cancellation Message

After cancellation, show:
```
Your RSVP has been cancelled.

Thank you for letting us know! This helps others join.

[Browse Other Events]
```

---

## Phase 4: Timeslot System for Open Mics

### 4.1 Database Schema

**New Table: `event_timeslots`**
```sql
CREATE TABLE event_timeslots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL,
  start_time TIME, -- Optional: specific time for this slot
  duration_minutes INTEGER DEFAULT 10,
  performer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  performer_name TEXT, -- For non-registered performers
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'claimed', 'performed', 'no_show')),
  claimed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, slot_number)
);

CREATE INDEX idx_event_timeslots_event ON event_timeslots(event_id);
CREATE INDEX idx_event_timeslots_performer ON event_timeslots(performer_id);
```

**Events Table Additions:**
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS
  signup_type TEXT DEFAULT 'rsvp' CHECK (signup_type IN ('rsvp', 'timeslots', 'none'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS
  total_slots INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS
  slot_duration_minutes INTEGER DEFAULT 10;
ALTER TABLE events ADD COLUMN IF NOT EXISTS
  slots_open_at TIMESTAMPTZ; -- When signup opens
ALTER TABLE events ADD COLUMN IF NOT EXISTS
  allow_waitlist_slots BOOLEAN DEFAULT true;
```

**Waitlist for Timeslots: `timeslot_waitlist`**
```sql
CREATE TABLE timeslot_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);
```

### 4.2 EventForm Updates

**When event_type = 'open_mic':**
- Show "Signup Type" selector: "Timeslots" vs "General RSVP"
- If Timeslots selected:
  - Number of slots input
  - Slot duration (minutes)
  - "Slots open at" datetime picker (optional)
  - Toggle: "Allow waitlist when full"

### 4.3 Timeslot Signup Component

**New Component:** `TimeslotSignup.tsx`

**UI for Available Slots:**
```
Performance Slots
─────────────────────────────────────

Signup opens: Dec 15, 2024 at 12:00 PM
8 of 12 slots available

┌─────────────────────────────────────┐
│ Slot 1  • 7:00 PM  │ Sarah M.      │
│ Slot 2  • 7:12 PM  │ John D.       │
│ Slot 3  • 7:24 PM  │ [Claim Slot]  │ ← User can claim
│ Slot 4  • 7:36 PM  │ Available     │
│ Slot 5  • 7:48 PM  │ Available     │
│ ...                                 │
└─────────────────────────────────────┘

Already claimed a slot? [Release My Slot]
```

**UI when all slots claimed:**
```
All Slots Filled
─────────────────────────────────────

All 12 performance slots have been claimed.

[Join Waitlist] - You're #3 on the waitlist

We'll notify you if a slot opens up.
```

### 4.4 Timeslot API Endpoints

**`/api/events/[id]/timeslots`**
- **GET:** List all timeslots with performer info
- **POST:** Claim a specific slot (body: `{ slot_number }`)
- **DELETE:** Release your claimed slot

**`/api/events/[id]/timeslots/waitlist`**
- **GET:** Get user's waitlist position
- **POST:** Join timeslot waitlist
- **DELETE:** Leave waitlist

### 4.5 Auto-Promotion Logic for Timeslots

When a slot is released:
1. Check if there's anyone on `timeslot_waitlist`
2. Get first person (lowest position)
3. Send notification: "A slot opened up! Claim it now before someone else does"
4. Don't auto-assign - let them choose which slot
5. Set a claim window (e.g., 30 minutes) before notifying next person

### 4.6 Host Timeslot Management

**Host View Additions:**
- See all slots with performer names
- Mark performers as "performed" or "no_show"
- Manually assign/unassign slots
- Reorder slots (drag and drop)
- Add notes per slot

---

## Phase 5: Reminder System (Future Enhancement)

### 5.1 Event Reminders

**Reminder Types:**
- 24 hours before event
- 2 hours before event (configurable)

**Implementation Options:**
1. **Supabase Edge Functions** - Cron job to check upcoming events
2. **External Service** - Inngest, Trigger.dev, or similar
3. **User Preference** - Let users opt-in/out of reminders

**Reminder Content:**
```
Reminder: Song Circle Tomorrow!

You're confirmed for tomorrow's Song Circle at The Venue.

📅 Wednesday, Dec 18 at 7:00 PM
📍 The Venue Name, 123 Main St, Denver

Can't make it anymore? Please cancel to free up your spot.
[Cancel RSVP] [View Event Details]
```

---

## Implementation Order

### Sprint 1: Core UX Improvements (3-4 days)
1. ✅ Add to Calendar button component
2. ✅ Update RSVPButton with calendar + cancellation messaging
3. ✅ Update email templates with calendar links and cancel link
4. ✅ Create `/dashboard/my-rsvps` page
5. ✅ Add cancellation confirmation modal

### Sprint 2: Timeslot System Foundation (4-5 days)
1. ✅ Database migrations for timeslots
2. ✅ Update EventForm for open mic timeslot config
3. ✅ Create TimeslotSignup component
4. ✅ Create timeslot API endpoints
5. ✅ Timeslot waitlist logic

### Sprint 3: Host Management & Polish (2-3 days)
1. ✅ Host timeslot management UI
2. ✅ Email notifications for timeslot claims
3. ✅ Calendar integration for timeslots
4. ✅ Testing and bug fixes

### Sprint 4: Reminders (Future)
1. Set up scheduled job infrastructure
2. Implement reminder logic
3. User preference settings

---

## File Structure (New Files)

```
web/src/
├── components/
│   ├── events/
│   │   ├── AddToCalendarButton.tsx      # NEW
│   │   ├── CancelRsvpModal.tsx          # NEW
│   │   ├── TimeslotSignup.tsx           # NEW
│   │   ├── TimeslotGrid.tsx             # NEW
│   │   └── RSVPButton.tsx               # UPDATE
│   └── ui/
│       └── Dropdown.tsx                 # NEW (for calendar menu)
├── app/
│   ├── api/
│   │   ├── my-rsvps/
│   │   │   └── route.ts                 # NEW
│   │   └── events/[id]/
│   │       ├── timeslots/
│   │       │   ├── route.ts             # NEW
│   │       │   └── waitlist/
│   │       │       └── route.ts         # NEW
│   │       └── calendar/
│   │           └── route.ts             # NEW (generates .ics)
│   └── (protected)/dashboard/
│       └── my-rsvps/
│           └── page.tsx                 # NEW
├── lib/
│   ├── calendar.ts                      # NEW (calendar generation utils)
│   └── emailTemplates.ts                # UPDATE
└── types/
    └── events.ts                        # UPDATE (add timeslot types)

supabase/migrations/
└── YYYYMMDD_timeslot_system.sql         # NEW
```

---

## Questions for Review

1. **Timeslot Claim Window:** When a slot opens and we notify the waitlist, how long should they have to claim before we notify the next person? (Suggested: 30 minutes)

2. **Performer Names:** Should non-registered users be able to claim slots with just a name, or require account creation?

3. **Slot Visibility:** Should performer names be visible to everyone, or just to hosts until the event?

4. **Reminder Timing:** What reminder schedule makes sense? (24h + 2h suggested)

5. **Calendar Attachment:** Should we attach .ics file to confirmation emails, or just provide links?

---

## Success Metrics

- Reduced no-shows (cancellation rate before event)
- Increased calendar adoption (track clicks on "Add to Calendar")
- Waitlist conversion rate (% of waitlisted users who get promoted and attend)
- Timeslot claim rate for open mics
- User feedback on signup flow

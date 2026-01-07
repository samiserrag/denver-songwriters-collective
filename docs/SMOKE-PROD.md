# Production Smoke Test Checklist

> **Required:** Any execution phase must end by running this checklist. Add new items when new subsystems ship.

Quick verification checklist for production deployments. Run after each deploy to `main`.

See [docs/GOVERNANCE.md](./GOVERNANCE.md) for the full quality gates and stop-gate workflow.

## Prerequisites

- Production site: https://denversongwriterscollective.org
- Valid test user credentials (or create a new account)

---

## Core Functionality Checks

### 1. RSVP Lane Renders for RSVP Events

**URL:** `/events/{event-id}` (any DSC event with `has_timeslots=false` and `capacity` set)

**Expected:**
- "RSVP Now" button appears
- "X spots left" chip displays
- Clicking RSVP prompts login (if not authenticated)

**Pass Criteria:** RSVP button visible and clickable

---

### 2. Timeslot Lane Renders for Timeslot Events

**URL:** `/events/{event-id}` (any DSC event with `has_timeslots=true`)

**Expected:**
- "Tonight's Lineup" or slot list appears
- Slots show start time and duration
- "Claim" button visible for available slots (if authenticated)
- Slot claiming works (claim + release)

**Pass Criteria:** Timeslot section renders with slot list

---

### 3. /open-mics Redirect for DSC Events

**URL:** `/open-mics/{uuid}` (a DSC event UUID)

**Expected:**
- Page redirects to `/events/{uuid}`
- Final URL shows `/events/{uuid}` in browser

**Pass Criteria:** Redirect happens (check final URL in browser)

---

### 4. Claim Flow Works (Timeslot Events)

**Precondition:** Logged in as a member

**Steps:**
1. Navigate to a timeslot event with available slots
2. Click "Claim" on an available slot
3. Verify slot shows "You" or your name
4. Click "Release" to unclaim
5. Verify slot is available again

**Pass Criteria:** Claim and release both succeed

---

### 5. Host/Admin No-Signup Warning (Phase 4.32)

**Precondition:** Logged in as event host or admin

**URL:** `/events/{event-id}` (DSC event with `has_timeslots=true` but no slots, OR `has_timeslots=false` and `capacity=null`)

**Expected:**
- Warning banner appears: "No sign-up method configured"
- "Fix Sign-up" button links to dashboard edit page

**Pass Criteria:** Banner visible to host/admin only

---

### 6. Publish Confirmation Gate (Phase 4.36)

**Precondition:** Logged in as host

**Steps:**
1. Create a new event OR edit an existing draft event
2. Toggle "Published" ON without checking the confirmation checkbox
3. Click Save

**Expected:**
- Inline error appears: "Please confirm you are ready to publish"
- Save is blocked

4. Check the "I confirm this event is real and happening" checkbox
5. Click Save

**Expected:**
- Event publishes successfully
- No error

**Pass Criteria:** Publish blocked without confirmation, succeeds with confirmation

---

### 7. Verification Status Display (Phase 4.40)

**After running reset script:**

**URL:** `/happenings`

**Expected:**
- ALL events show "Unconfirmed" amber badge
- No events show "Confirmed" green badge (unless admin has verified since reset)

**After admin verifies one event:**

**URL:** `/happenings` or `/events/{verified-event-slug}`

**Expected:**
- Verified event shows "Confirmed" green badge with checkmark
- Other events still show "Unconfirmed"

**Pass Criteria:** Reset causes all Unconfirmed; admin verify causes Confirmed

---

### 8. Event Updated Notifications (Phase 4.36)

**Precondition:**
- Logged in as host
- Pick a **published** event with at least 1 RSVP or 1 timeslot claim

**Steps:**
1. Edit the event and change a "major" field (start_time, venue, event_date, etc.)
2. Save the event

**Expected:**
- Dashboard notification created for each signed-up attendee
- If attendee has event update emails enabled → email arrives (uses `eventUpdated` template)
- If attendee disabled event update emails → NO email, but dashboard notification still appears

**Pass Criteria:** Dashboard notification exists; email respects user preference

---

## Quick Verification Script

Run from repo root:

```bash
./scripts/smoke-prod.sh
```

See `scripts/smoke-prod.sh` for automated checks.

---

### 9. Event Form UX (Phase 4.44c)

**Precondition:** Logged in as host

**Steps:**
1. Navigate to `/dashboard/my-events` and click "Create Event"
2. Verify Event Type is the FIRST section (above Title)
3. Select "Open Mic" as event type

**Expected:**
- Inline notification appears below Event Type: "Performer slots enabled"
- Notification has info icon and explains slots were auto-enabled

4. Scroll down to find "Advanced Options"

**Expected:**
- Advanced Options section is COLLAPSED by default
- Click to expand reveals: Timezone, Cost, External Signup URL, Age Policy, DSC Toggle, Host Notes

5. Create a draft event (do NOT publish)
6. On edit page, find header buttons

**Expected:**
- "Preview as visitor →" link appears (styled muted, not primary)
- Clicking opens `/events/{slug}` in new tab showing preview

**Pass Criteria:** Form structure is intent-first; Advanced collapsed; Preview link works for drafts

---

## Manual Browser Checks

For UI verification that requires authentication or visual inspection:

1. **Theme Contrast**
   - Switch to Sunrise theme
   - Verify "Claim" buttons have readable text
   - Verify "X spots left" chip is readable

2. **Mobile Responsiveness**
   - Open site on mobile viewport
   - Verify happenings grid is single column
   - Verify cards are readable

3. **Dashboard Navigation**
   - Navigate to `/dashboard/my-events`
   - Verify Live/Drafts tabs work
   - Verify Cancelled disclosure expands/collapses

---

## Failure Escalation

If any check fails:
1. Check Vercel deployment logs for build errors
2. Check browser console for JS errors
3. Check Supabase logs for database errors
4. Create GitHub issue with reproduction steps

---

### 10. Guest RSVP Flow (Phase 4.48b)

**Precondition:** NOT logged in (incognito window recommended)

**URL:** `/events/{event-id}` (any public event)

**Steps:**
1. Find the RSVP section
2. Click "RSVP as guest (no account needed)"

**Expected:**
- Guest form expands with Name + Email fields
- "Send Code" button appears

3. Enter test name and email, click "Send Code"

**Expected:**
- Form changes to code entry view
- Message shows email was sent

4. Enter 6-digit code from email (or check dev console logs)

**Expected:**
- Success message: "You're going!" or "You're on the waitlist!"
- Check email for RSVP confirmation (includes cancel link)

**Pass Criteria:** Guest can RSVP without account; receives confirmation email with cancel URL

---

### 11. AttendeeList Shows Guests (Phase 4.48b)

**Precondition:** Event has at least one guest RSVP and one member RSVP

**URL:** `/events/{event-id}` (event with mixed RSVPs)

**Expected:**
- "Who's Coming" section appears
- Member names are clickable (link to profile)
- Guest names have "(guest)" label and are NOT clickable
- Both show avatar or initial

**Pass Criteria:** Members are linked, guests are plain text with "(guest)" label

---

### 12. Success Banner Contrast (Phase 4.48b)

**Precondition:** Logged in OR guest RSVP completed

**URL:** `/events/{event-id}` after confirming RSVP

**Theme:** Switch to Sunrise (light) theme

**Expected:**
- Success banner ("You're going!") has readable contrast
- Text is dark (not green-on-green)
- Badge uses theme tokens (not hardcoded emerald)

**Pass Criteria:** Success banner is readable in both Night and Sunrise themes

---

## Gallery Smoke Checks (To Be Added in Gallery Track)

_Placeholder: Gallery-specific smoke tests will be added when the Gallery track ships._

---

## Profiles Smoke Checks (To Be Added in Profiles Track)

_Placeholder: Profile-specific smoke tests will be added when the Profiles track ships._

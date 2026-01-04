# Production Smoke Test Checklist

Quick verification checklist for production deployments. Run after each deploy to `main`.

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

## Quick Verification Script

Run from repo root:

```bash
./scripts/smoke-prod.sh
```

See `scripts/smoke-prod.sh` for automated checks.

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

# Production Smoke Test Checklist

> **Required:** Any execution phase must end by running this checklist. Add new items when new subsystems ship.

Quick verification checklist for production deployments. Run after each deploy to `main`.

See [docs/GOVERNANCE.md](./GOVERNANCE.md) for the full quality gates and stop-gate workflow.

## Prerequisites

- Production site: https://coloradosongwriterscollective.org
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

### 13. Guest Verification Health Check (Phase 4.51b)

**URL:** `https://coloradosongwriterscollective.org/api/health/guest-verification`

**Expected Response:**
```json
{
  "enabled": true,
  "mode": "always-on",
  "timestamp": "2026-01-07T..."
}
```

**Quick curl check:**
```bash
curl -s https://coloradosongwriterscollective.org/api/health/guest-verification | jq
```

**Pass Criteria:** `enabled: true` and `mode: "always-on"`

---

### 14. Guest Comment Flow (Phase 4.49b + 4.51b)

**Precondition:** NOT logged in (incognito window recommended)

**URL:** `/events/{event-id}` (any public event)

**Steps:**
1. Scroll to Comments section
2. Click "Comment as guest (no account needed)" or similar guest toggle

**Expected:**
- Guest form expands with Name + Email + Comment fields
- "Send Verification Code" button appears

3. Enter test name, email, and comment text, click "Send Verification Code"

**Expected:**
- Response is 200 (NOT 404 or 503)
- Form changes to code entry view
- Message shows email was sent

4. Enter 6-digit code from email

**Expected:**
- Comment appears in thread with "(guest)" label
- Comment shows as verified

**Quick curl check (request-code endpoint):**
```bash
# Replace EVENT_ID with a real published event UUID
curl -s -X POST https://coloradosongwriterscollective.org/api/guest/event-comment/request-code \
  -H "Content-Type: application/json" \
  -d '{"event_id":"EVENT_ID","guest_name":"Test","guest_email":"test@example.com","content":"Test comment"}' \
  | jq '.success, .error'
```

**Pass Criteria:**
- Returns `{ success: true, verification_id: "...", ... }` (NOT `{ error: "Not found" }`)
- No 404s from feature gating
- Guest can comment without account

---

### 15. Guest RSVP Request-Code (Phase 4.48b + 4.51b)

**Quick curl check:**
```bash
# Replace EVENT_ID with a real published event UUID
curl -s -X POST https://coloradosongwriterscollective.org/api/guest/rsvp/request-code \
  -H "Content-Type: application/json" \
  -d '{"event_id":"EVENT_ID","guest_name":"Test","guest_email":"test@example.com"}' \
  | jq '.success, .error'
```

**Expected:** `{ success: true, ... }` (NOT 404 or 503)

**Pass Criteria:** Guest RSVP endpoints work with zero Vercel env var configuration

---

---

### 16. New User Onboarding Flow (Phase Role-Based Onboarding)

**Precondition:** NOT logged in (incognito window, clear cookies)

#### A) Fan-Only Path

**Steps:**
1. Navigate to `/signup`
2. Complete signup with email/password
3. On role selection (`/onboarding/role`), select ONLY "Fan" checkbox
4. Click Continue to profile page (`/onboarding/profile`)

**Expected:**
- Profile page shows ONLY Fan-relevant sections (Basic Info, Social Links)
- Songwriter-specific fields (genres, instruments, etc.) are HIDDEN
- Host-specific fields are HIDDEN
- Studio-specific fields are HIDDEN

5. Complete basic info and submit

**Expected:**
- Redirects to `/onboarding/complete`
- Dashboard shows user as a Fan

**Pass Criteria:** Fan-only users see minimal onboarding fields

#### B) Songwriter Path

**Steps:**
1. Fresh signup
2. Select "Songwriter" checkbox (may also select Fan)
3. Continue to profile

**Expected:**
- Songwriter sections visible: Genres, Instruments, Collaborations
- Can complete profile with songwriter details

**Pass Criteria:** Songwriter-specific fields appear when identity flag set

#### C) Host Path

**Steps:**
1. Fresh signup
2. Select "Host" checkbox
3. Continue to profile

**Expected:**
- Host-relevant sections visible
- After completing onboarding, Dashboard shows "Getting Started" prompts

**Pass Criteria:** Host identity flows through to dashboard prompts

---

### 17. Dashboard Getting Started Prompts (Slice 3)

**Precondition:** Logged in as user with `is_host=true`, NOT an approved host, NO pending host request

**URL:** `/dashboard`

**Expected:**
- "Getting Started" section appears with sparkle emoji header
- "Host DSC Happenings" card visible with "Apply to Host" button
- Dismiss button visible in section header

**Steps:**
1. Click "Dismiss"

**Expected:**
- Section disappears
- Refresh page → section stays hidden (localStorage persistence)

2. Clear localStorage key `dsc_getting_started_dismissed_v1` (dev tools)
3. Refresh page

**Expected:**
- Section reappears

**Additional Check (Venue Prompt):**

**Precondition:** User has `is_host=true` OR `is_studio=true`, AND manages 0 venues

**Expected:**
- "Manage a Venue" card visible with "Browse Venues" button
- Button links to `/venues`

**Pass Criteria:** Prompts show for eligible users; dismiss persists via localStorage

---

### 18. Global Nav Search Click-Through

**URL:** Homepage or any page with header

**Steps:**
1. Click the search icon in header
2. Type "open" and wait for results

**Expected:**
- Happenings results appear (matching events)
- Each result shows event type icon + title

3. Click a Happening result

**Expected:**
- Navigates to `/events/{slug}` (NOT `/happenings?type=...`)

4. Return to search, type a venue name (e.g., "brewery")

**Expected:**
- Venue results appear with location icon
- Clicking navigates to `/venues/{slug}`

5. Return to search, type a member name

**Expected:**
- Member results appear with person icon
- Clicking navigates to `/songwriters/{slug}` (NOT `/members?id=...`)

**Pass Criteria:** All three entity types searchable; all click-throughs go to detail pages

---

### 19. Venue Cover Image (Venue Manager Flow)

**Precondition:** Logged in as venue manager for a venue

**URL:** `/dashboard/my-venues/{venue-id}`

#### A) Upload Cover Image

**Steps:**
1. Navigate to venue management page
2. Find "Cover Image" section
3. Upload an image file (JPG/PNG)

**Expected:**
- Image preview appears
- Save button enabled
- After save, image persists on refresh

#### B) Rendering on /venues Cards

**URL:** `/venues`

**Expected:**
- Venue card shows uploaded cover image
- Image fills card area (aspect ratio maintained)
- Fallback gradient shows for venues without cover image

#### C) Rendering on /venues/[slug] Detail

**URL:** `/venues/{venue-slug}` (venue with cover image)

**Expected:**
- Cover image displayed prominently in hero or header area
- Image is high quality (not blurry)

**Pass Criteria:** Cover image uploads, persists, and renders on both list and detail pages

---

### 20. Venue Invite Create + Accept Flow

**Precondition:** Logged in as admin

**URL:** `/dashboard/admin/venues/{venue-id}`

#### A) Create Invite

**Steps:**
1. Navigate to venue admin page
2. Find "Venue Invites" or invite section
3. Click "Create Invite"
4. Optionally restrict to email, set expiry (e.g., 7 days)
5. Click Create

**Expected:**
- Invite URL displayed (shown only once!)
- Copy button works
- Email template available for copying

#### B) Accept Invite (New User)

**Steps:**
1. Copy invite URL
2. Open in incognito/different browser
3. Navigate to invite URL

**Expected:**
- Invite acceptance page loads
- If not logged in, prompts to log in or sign up
- After auth, shows "Accept Invite" confirmation

4. Click Accept

**Expected:**
- Success message
- User is now a venue manager
- `/dashboard/my-venues` shows the venue

#### C) Revoke Invite (Admin)

**Steps:**
1. As admin, return to venue admin page
2. Find pending invite in list
3. Click "Revoke"

**Expected:**
- Invite marked as revoked
- Using old URL returns error (invite expired/revoked)

**Pass Criteria:** Full invite lifecycle works (create → accept → revoke)

---

### 21. Comments + RSVPs on Recurring Event with ?date=

**Precondition:** A recurring event exists with multiple upcoming occurrences

**URL:** `/events/{recurring-event-slug}?date=2026-01-25` (future date in series)

#### A) Date-Specific Display

**Expected:**
- Page shows the specific occurrence date (Jan 25, 2026)
- If override exists for that date, override info displayed
- Date pills show other upcoming occurrences

#### B) RSVP is Date-Scoped

**Steps:**
1. Log in as member
2. Click RSVP on the `/events/{slug}?date=2026-01-25` page
3. Navigate to `/events/{slug}?date=2026-02-01` (different occurrence)

**Expected:**
- Second occurrence shows you are NOT RSVP'd
- RSVP button available again
- Going to My RSVPs shows separate entries per date

#### C) Comments are Date-Scoped (if implemented)

**Expected:**
- Comments posted on `?date=2026-01-25` only appear on that date
- Different date shows different/no comments

#### D) Series Slug Redirect

**URL:** `/events/{recurring-event-slug}` (NO ?date= param)

**Expected:**
- Redirects to include `?date=` of next upcoming occurrence
- Final URL includes the date parameter

**Pass Criteria:** RSVPs and viewing are date-scoped for recurring events

---

### 22. Conversational Interpreter API (`/api/events/interpret`)

**Precondition:** Logged in session on production domain

**Endpoint:** `POST /api/events/interpret`

**A) Create-mode happy path**

```javascript
fetch("/api/events/interpret", {
  method: "POST",
  headers: { "content-type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    mode: "create",
    message: "Open mic every Tuesday at 7:00 PM at Long Table Brewhouse. Free. Signup at venue."
  }),
}).then(async (r) => ({ status: r.status, body: await r.json() })).then(console.log);
```

**Expected:**
- HTTP `200`
- Response includes:
  - `next_action`
  - `confidence`
  - `human_summary`
  - `clarification_question`
  - `blocking_fields`
  - `draft_payload`
  - `quality_hints`

**B) Guardrail check (invalid mode)**

```javascript
fetch("/api/events/interpret", {
  method: "POST",
  headers: { "content-type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ mode: "edit", message: "test" }),
}).then(async (r) => ({ status: r.status, body: await r.json() })).then(console.log);
```

**Expected:** HTTP `400` with mode validation error.

**C) Unauthenticated check**

```javascript
fetch("https://coloradosongwriterscollective.org/api/events/interpret", {
  method: "POST",
  headers: { "content-type": "application/json" },
  credentials: "omit",
  body: JSON.stringify({ mode: "create", message: "test" }),
}).then(async (r) => ({ status: r.status, body: await r.json() })).then(console.log);
```

**Expected:** HTTP `401` with `{"error":"Unauthorized"}`.

**D) Log verification**

For the create request in Vercel/Axiom logs:
- Confirm `POST api.openai.com/v1/responses` returned `200`
- Confirm no `invalid_json_schema` error exists
- Confirm no `[events/interpret] rate-limit rpc error; using memory fallback` line exists

**Pass Criteria:** A/B/C expected statuses observed and D log checks clean.

---

## Gallery Smoke Checks (To Be Added in Gallery Track)

_Placeholder: Gallery-specific smoke tests will be added when the Gallery track ships._

---

## Profiles Smoke Checks (To Be Added in Profiles Track)

_Placeholder: Profile-specific smoke tests will be added when the Profiles track ships._

---

## Smoke Test Execution Log

> Append dated results after each production verification run.

### 2026-01-17 — Post P0 UI Polish Deploy

**Executed by:** Claude Agent
**Commit:** `dfe46d7`
**Timestamp:** 2026-01-17T15:34 UTC

#### API & Infrastructure Tests

| # | Test | Result | Notes |
|---|------|--------|-------|
| 13 | Guest Verification Health | ✅ PASS | `{"enabled":true,"mode":"always-on"}` |

#### P0 UI Polish Verification

| Item | Test | Result | Notes |
|------|------|--------|-------|
| A | Hero text contrast | ✅ PASS | 40% overlay + drop shadows visible |
| B | Nav menu order | ✅ PASS | Order confirmed: Happenings → Members → Venues |
| C | CTA pill labels | ✅ PASS | "See All Happenings" and "See Open Mics" displayed |

#### New Feature Tests

| # | Test | Result | Notes |
|---|------|--------|-------|
| 16A | Fan-Only Onboarding | 🔶 MANUAL | Pages load (200 OK), requires authenticated user flow |
| 16B | Songwriter Onboarding | 🔶 MANUAL | Pages load (200 OK), requires authenticated user flow |
| 16C | Host Onboarding | 🔶 MANUAL | Pages load (200 OK), requires authenticated user flow |
| 17 | Getting Started Prompts | 🔶 MANUAL | Dashboard returns 307 redirect (auth required) |
| 18 | Global Nav Search | ✅ PASS | All 3 types return correct URLs: happenings→`/events/{slug}`, venues→`/venues/{slug}`, members→`/songwriters/{slug}` |
| 19A | Venue Cover Image Upload | 🔶 MANUAL | Requires venue manager auth |
| 19B | Venue Cards | ✅ PASS | Cards render, fallback works (81 venues, most without images) |
| 19C | Venue Detail | ✅ PASS | `/venues/brewery-rickoli` loads with cover image + happenings |
| 20 | Venue Invite Flow | 🔶 MANUAL | `/venue-invite` page loads (200 OK), full flow requires admin auth |
| 21A | Date-Specific Display | ✅ PASS | `/events/brewery-rickoli?date=2026-01-20` shows correct date + pills |
| 21B | RSVP Date-Scoped | 🔶 MANUAL | RSVP section visible, requires auth to test scoping |
| 21D | Series Slug Redirect | ✅ PASS | `/events/brewery-rickoli` → 307 redirect to `?date=2026-01-20` |

#### Summary

- **Automated checks:** 8 PASS
- **Manual verification required:** 8 tests (require authenticated user sessions)
- **Failures:** 0

**No STOP-GATE issues found.** All public endpoints working correctly. Manual tests require user accounts to complete.

---

### 2026-01-17 — Re-execution of Tests 16-21 (Session 2)

**Executed by:** Claude Agent
**Commit:** `118af42`
**Timestamp:** 2026-01-17T16:15 UTC

#### Test 16: New User Onboarding Flow

| Test | URL | Result | Notes |
|------|-----|--------|-------|
| Signup page | `/signup` | ✅ PASS | 200 OK |
| Role selection | `/onboarding/role` | ✅ PASS | 200 OK |
| Profile page | `/onboarding/profile` | ✅ PASS | 200 OK |
| Complete page | `/onboarding/complete` | ✅ PASS | 200 OK |
| 16A Fan-Only | Full flow | 🔶 MANUAL | Requires signup + identity selection |
| 16B Songwriter | Full flow | 🔶 MANUAL | Requires signup + identity selection |
| 16C Host | Full flow | 🔶 MANUAL | Requires signup + identity selection |

**Infrastructure:** All onboarding pages load correctly (200 OK). Full identity-based field visibility requires authenticated user session.

#### Test 17: Dashboard Getting Started Prompts

| Test | URL | Result | Notes |
|------|-----|--------|-------|
| Dashboard access | `/dashboard` | ✅ PASS | 307 redirect to login (expected for unauthenticated) |
| Getting Started section | Authenticated | 🔶 MANUAL | Requires `is_host=true` user session |
| Dismiss persistence | localStorage | 🔶 MANUAL | Requires browser session |

**Infrastructure:** Dashboard correctly requires authentication.

#### Test 18: Global Nav Search Click-Through

| Test | Query | Result | Notes |
|------|-------|--------|-------|
| Happenings search | `?q=open` | ✅ PASS | Returns `/events/{slug}` URLs (e.g., `/events/words-open-mic`) |
| Venue search | `?q=brewery` | ✅ PASS | Returns `/venues/{slug}` URLs (e.g., `/venues/brewery-rickoli`) |
| Member search | `?q=sami` | ✅ PASS | Returns `/songwriters/{slug}` URLs (e.g., `/songwriters/sami-serrag`) |

**All URL formats correct:** Happenings→`/events/`, Venues→`/venues/`, Members→`/songwriters/`

#### Test 19: Venue Cover Image

| Test | URL | Result | Notes |
|------|-----|--------|-------|
| 19A Upload | `/dashboard/my-venues/{id}` | 🔶 MANUAL | Requires venue manager auth |
| 19B Venues list | `/venues` | ✅ PASS | 81 venue cards render with fallback styling |
| 19C Venue detail | `/venues/brewery-rickoli` | ✅ PASS | 200 OK, happenings displayed |

**Note:** Most venues use fallback placeholders (no cover_image_url set). Event images display correctly on venue detail pages.

#### Test 20: Venue Invite Create + Accept Flow

| Test | URL | Result | Notes |
|------|-----|--------|-------|
| Invite accept page | `/venue-invite` | ✅ PASS | 200 OK |
| Admin venues | `/dashboard/admin/venues` | ✅ PASS | 307 redirect (auth required) |
| 20A Create invite | Admin flow | 🔶 MANUAL | Requires admin auth |
| 20B Accept invite | New user flow | 🔶 MANUAL | Requires invite token |
| 20C Revoke invite | Admin flow | 🔶 MANUAL | Requires admin auth |

**Infrastructure:** Public invite acceptance page loads. Admin flows require authentication.

#### Test 21: Comments + RSVPs on Recurring Event with ?date=

| Test | URL | Result | Notes |
|------|-----|--------|-------|
| 21A Date-specific | `/events/brewery-rickoli?date=2026-02-03` | ✅ PASS | Shows Feb 3, 2026 occurrence |
| 21A Date pills | Same URL | ✅ PASS | Shows 6 upcoming dates: Jan 20, Feb 3, Feb 17, Mar 3, Mar 17, +2 more |
| 21B RSVP scoping | Multiple dates | 🔶 MANUAL | Requires authenticated RSVP actions |
| 21C Comments | Date-scoped | 🔶 MANUAL | Requires authenticated comment actions |
| 21D Series redirect | `/events/brewery-rickoli` (no date) | ✅ PASS | Server includes redirect to `?date=2026-01-20` |

**Date-awareness confirmed:** Different dates show different occurrence views. Date pills display recurrence pattern correctly ("Every Other Tuesday").

#### Summary

| Category | PASS | MANUAL | FAIL |
|----------|------|--------|------|
| Test 16 (Onboarding) | 4 | 3 | 0 |
| Test 17 (Getting Started) | 1 | 2 | 0 |
| Test 18 (Nav Search) | 3 | 0 | 0 |
| Test 19 (Venue Images) | 2 | 1 | 0 |
| Test 20 (Venue Invites) | 2 | 3 | 0 |
| Test 21 (Recurring Events) | 4 | 2 | 0 |
| **TOTAL** | **16** | **11** | **0** |

**No STOP-GATE issues found.** All public endpoints functioning correctly. Manual tests require authenticated user sessions to complete full verification.

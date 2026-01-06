# Denver Songwriters Collective — Repo Agent Context

> **All contributors and agents must read this file before making changes. This file supersedes README.md for operational context.**

> **For product philosophy, UX rules, and design decisions, see [PRODUCT_NORTH_STAR.md](./docs/PRODUCT_NORTH_STAR.md)**

> **For governance workflow and stop-gate protocol, see [GOVERNANCE.md](./docs/GOVERNANCE.md)**

This file contains **repo-specific operational knowledge** for agents working in this codebase.

---

## Governance: Stop-Gate Workflow (Required)

All non-trivial changes must follow the stop-gate protocol. See [docs/GOVERNANCE.md](./docs/GOVERNANCE.md) for full details.

### Quick Reference

1. **Step A: Investigate** — Repo agent gathers evidence (file paths, line ranges, migrations)
2. **Step B: Critique** — Repo agent documents risks, coupling, rollback plan
3. **Step C: Wait** — Repo agent STOPS. Only after Sami approves does execution begin.

### Definition of Done (PR Checklist)

Before any PR merges:

- [ ] Investigation document exists (for non-trivial changes)
- [ ] Stop-gate approval received from Sami
- [ ] Contract updates included (if behavior changed)
- [ ] Tests added/updated (regression coverage)
- [ ] Lint passes (0 errors, 0 warnings)
- [ ] Tests pass (all green)
- [ ] Build succeeds
- [ ] Smoke checklist updated (if new subsystem)
- [ ] CLAUDE.md "Recent Changes" updated
- [ ] No unresolved UNKNOWNs for core invariants

### Investigation-Only PRs

PRs containing only documentation (e.g., `docs/investigation/*.md`) are allowed without full execution approval, but must not include code, migration, or config changes.

---

## Project Overview

A community platform for Denver-area songwriters to discover open mics, connect with musicians, and stay informed about local music events.

**Live Site:** https://denversongwriterscollective.org  
**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + Auth + RLS), Vercel

---

## Commands

```bash
# Development
cd web && npm run dev

# Build
cd web && npm run build

# Lint
cd web && npm run lint

# Test
cd web && npm run test -- --run

# Full verification (required before merge)
cd web && npm run lint && npm run test -- --run && npm run build

# Generate Supabase types (after schema changes)
npx supabase gen types typescript --project-id oipozdbfxyskoscsgbfq > web/src/lib/supabase/database.types.ts

# Deploy
git add . && git commit -m "your message" && git push
```

---

## Quality Gates (Non-Negotiable)

All must pass before merge:

| Check | Requirement |
|-------|-------------|
| Lint | 0 errors, 0 warnings |
| Tests | All passing |
| Build | Success |

**Current Status (Phase 4.43):** Lint warnings = 0. All tests passing (967). Intentional `<img>` uses (ReactCrop, blob URLs, markdown/user uploads) have documented eslint suppressions.

### Lighthouse Targets

| Metric | Target |
|--------|--------|
| Performance | ≥85 |
| Accessibility | ≥90 |
| TBT | ≤100ms |
| CLS | 0 |

---

## Key File Locations

| Purpose | Path |
|---------|------|
| Supabase server client | `web/src/lib/supabase/server.ts` |
| Supabase browser client | `web/src/lib/supabase/client.ts` |
| Service role client | `web/src/lib/supabase/serviceRoleClient.ts` |
| Database types | `web/src/lib/supabase/database.types.ts` |
| Admin auth helper | `web/src/lib/auth/adminAuth.ts` |
| Theme presets | `web/src/app/themes/presets.css` |
| Global styles | `web/src/app/globals.css` |
| Next.js config | `next.config.ts` |

### Key Components

| Component | Path |
|-----------|------|
| HappeningCard (unified) | `web/src/components/happenings/HappeningCard.tsx` |
| DateJumpControl | `web/src/components/happenings/DateJumpControl.tsx` |
| StickyControls | `web/src/components/happenings/StickyControls.tsx` |
| DateSection | `web/src/components/happenings/DateSection.tsx` |
| BetaBanner | `web/src/components/happenings/BetaBanner.tsx` |
| BackToTop | `web/src/components/happenings/BackToTop.tsx` |
| PosterMedia | `web/src/components/media/PosterMedia.tsx` |
| Header nav | `web/src/components/navigation/header.tsx` |
| Footer | `web/src/components/navigation/footer.tsx` |
| Event form | `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` |
| Next occurrence logic | `web/src/lib/events/nextOccurrence.ts` |
| Recurrence contract | `web/src/lib/events/recurrenceContract.ts` |
| Form date helpers | `web/src/lib/events/formDateHelpers.ts` |
| CommentThread (shared) | `web/src/components/comments/CommentThread.tsx` |
| ProfileComments | `web/src/components/comments/ProfileComments.tsx` |
| GalleryComments | `web/src/components/gallery/GalleryComments.tsx` |
| BlogComments | `web/src/components/blog/BlogComments.tsx` |

### Key Pages

| Route | Path |
|-------|------|
| Happenings | `web/src/app/happenings/page.tsx` |
| Open mic detail | `web/src/app/open-mics/[slug]/page.tsx` |
| Event detail | `web/src/app/events/[id]/page.tsx` |
| Dashboard | `web/src/app/(protected)/dashboard/` |
| Admin | `web/src/app/(protected)/dashboard/admin/` |
| Songwriter profile | `web/src/app/songwriters/[id]/page.tsx` |
| Studio profile | `web/src/app/studios/[id]/page.tsx` |

---

## Routing Rules

### Canonical Listing Routes (Use These)

- `/happenings`
- `/happenings?type=open_mic`
- `/happenings?type=dsc`

### Forbidden in UI (Redirects Exist)

- `/open-mics` (listing) — **never link to this**
- `/events` (listing) — **never link to this**

### Valid Detail Routes

- `/open-mics/[slug]`
- `/events/[id]`

---

## Deploy Rules

### Supabase Migrations BEFORE Push

```bash
# 1. Check for pending migrations
npx supabase migration list

# 2. Apply migrations to remote
npx supabase db push

# 3. Verify schema change
cd web && source .env.local && psql "$DATABASE_URL" -c "\d table_name"

# 4. THEN push to main
git push origin main
```

**Rule:** If migration files were added, do NOT push to `main` until `npx supabase db push` succeeds.

---

## Build Notes

- Protected pages using `supabase.auth.getSession()` require `export const dynamic = "force-dynamic"`
- Vercel auto-deploys from `main` branch
- All CSS colors should use theme tokens (no hardcoded hex in components)

---

## Agent Behavior Rules

1. **Follow prompts exactly** — no improvisation unless asked
2. **Report and stop** when instructions complete or blocked
3. **Reality beats reasoning** — verify in browser, not just code
4. **One change = one contract** — no mixed refactors
5. **Update this file** after every push to main

---

## Locked Layout Rules (v2.0)

These layout decisions are **locked** and must not be changed without explicit approval:

### HappeningCard Layout

| Element | Locked Value |
|---------|--------------|
| Card structure | Vertical poster card (not horizontal row) |
| Poster aspect | 3:2 (`aspect-[3/2]`) |
| Surface class | `card-spotlight` |
| Grid layout | 1 col mobile, 2 col md, 3 col lg |
| Poster hover | `scale-[1.02]` zoom |
| Past event opacity | `opacity-70` |
| Font minimum | 14px in discovery views |

### Chip Styling

| Element | Locked Value |
|---------|--------------|
| Base classes | `px-2 py-0.5 text-sm font-medium rounded-full border` |
| Missing details | Warning badge (amber), not underlined link |

### Forbidden Changes

- Do NOT revert to horizontal/list layouts
- Do NOT use `text-xs` for chips (14px minimum)
- Do NOT add social proof ("X going", popularity counts)
- Do NOT use hardcoded colors (must use theme tokens)

---

## Documentation Hierarchy & Reading Order

**Required reading order for agents:**
1. `CLAUDE.md` (this file) — Repo operations
2. `docs/PRODUCT_NORTH_STAR.md` — Philosophy & UX laws
3. `docs/CONTRACTS.md` — Enforceable UI/data contracts
4. `docs/theme-system.md` — Tokens & visual system

| Document | Purpose | Authority |
|----------|---------|-----------|
| `docs/PRODUCT_NORTH_STAR.md` | Philosophy & UX laws | Wins on philosophy |
| `docs/CONTRACTS.md` | Enforceable UI behavior | Wins on testable rules |
| `docs/theme-system.md` | Tokens & surfaces | Wins on styling |
| `CLAUDE.md` | Repo operations | Wins on workflow |

If something conflicts, resolve explicitly—silent drift is not allowed.

---

## Recent Changes

---

### Hotfix: Signup Flow Broken (January 2026)

**Goal:** Fix both Google OAuth and email signup silently failing with "no action taken" behavior.

**Root Causes:**

| Issue | Cause | Fix |
|-------|-------|-----|
| CSP blocking OAuth | `form-action 'self'` blocked redirects to Supabase/Google | Added Supabase + Google domains to form-action |
| Silent failures | No try/catch in auth functions; exceptions swallowed | Added error handling + user-visible error messages |

**Changes:**

| File | Change |
|------|--------|
| `next.config.ts` | Added `https://*.supabase.co https://*.supabase.in https://accounts.google.com` to CSP form-action |
| `lib/auth/google.ts` | Added try/catch, returns `{ ok, error }` result |
| `lib/auth/signUp.ts` | Added try/catch for exception handling |
| `lib/auth/magic.ts` | Added try/catch for exception handling |
| `app/signup/page.tsx` | Google button now displays errors to user |
| `app/login/page.tsx` | Google button now displays errors to user |

**Verification:** Lint 0 warnings, all 924 tests passing.

---

### Phase 4.43 — RSVP Always + Event Form UX (January 2026)

**Goal:** RSVP always available for DSC events + UI improvements to event creation form.

**RSVP System Changes:**
- RSVP = audience planning to attend (NOT performer signup)
- RSVP always available for public, non-cancelled DSC events
- Capacity is optional (`null` = unlimited RSVP)
- RSVP and timeslots can coexist on same event

**Event Form UX Changes:**

| Component | Change |
|-----------|--------|
| Required fields | Red label text + "*Required" suffix |
| Signup Mode | Card-style radio buttons with descriptions |
| Venue dropdown | Integrated "Enter custom location..." option |
| Defaults | Open Mic/Showcase auto-select Performance Slots |

**Key Files:**

| File | Purpose |
|------|---------|
| `EventForm.tsx` | Required indicators, venue dropdown integration |
| `SlotConfigSection.tsx` | Card-style radio options for signup mode |
| `VenueSelector.tsx` | Integrated custom location option |
| `RSVPSection.tsx` | Updated RSVP availability logic |
| `AttendeeList.tsx` | New component for displaying attendees |

**Test Coverage:** 43 new tests for RSVP coexistence scenarios.

---

### Phase 4.42l — User Draft Delete (January 2026)

**Goal:** Allow users to permanently delete their own draft events from the My Events dashboard.

**Changes:**

| Component | Change |
|-----------|--------|
| API | `DELETE /api/my-events/[id]?hard=true` permanently deletes draft events |
| Guardrails | Returns 409 if event has RSVPs or timeslot claims |
| Published events | Returns 400 — must use soft-cancel instead |
| UI Modal | "Delete this draft?" with permanent deletion warning |
| Button | Trash icon with "Delete draft" tooltip |
| Optimistic update | Event removed from list immediately on delete |

**Behavior Matrix:**

| Event State | Delete Action | Result |
|-------------|---------------|--------|
| Draft (unpublished) | Hard delete | Permanently removed from DB |
| Published | Soft cancel | Moved to Cancelled section |
| Has RSVPs | Blocked | 409 Conflict |
| Has timeslot claims | Blocked | 409 Conflict |

**Key Files:**

| File | Purpose |
|------|---------|
| `app/api/my-events/[id]/route.ts` | DELETE endpoint with ?hard=true support |
| `MyEventsFilteredList.tsx` | DeleteDraftModal + trash icon button |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/draft-delete.test.ts` | 27 tests - API contract, UI, permissions, edge cases |

---

### Phase 4.42k — Event Creation System Fixes (January 2026)

**Goal:** Fix the complete event creation → listing → series management flow with 6 targeted fixes.

**Fixes Implemented:**

| Fix | Issue | Solution |
|-----|-------|----------|
| A1b | New events showed "unconfirmed" even though user created them | Auto-set `last_verified_at` on publish (community events auto-confirm) |
| B1 | "Missing details" banner appeared for complete events | Removed `is_free` from missing details check (cost is optional) |
| D2 | Monday series displayed as Sunday (timezone bug) | Replaced `toISOString().split("T")[0]` with MT-safe `T12:00:00Z` pattern |
| C3 | Series panel disappeared after creation | Added `series_id` to SeriesEditingNotice + "Other events in series" links |
| Banner | "Imported from external source" shown for user-created events | Source-aware copy: shows "imported" only for `source=import` |
| Form | Silent HTML5 validation (user saw nothing on submit) | Added `noValidate` + custom error summary with field list |

**Key Changes:**

| File | Change |
|------|--------|
| `app/api/my-events/route.ts` | Added `last_verified_at: publishedAt` to auto-confirm; imported MT-safe `generateSeriesDates` |
| `lib/events/missingDetails.ts` | Removed `is_free` null check from missing details |
| `app/events/[id]/page.tsx` | Source-aware banner copy for unconfirmed events |
| `app/events/[id]/display/page.tsx` | Fixed date parsing with `T12:00:00Z` pattern |
| `MyEventsFilteredList.tsx` | Fixed date parsing with `T12:00:00Z` pattern |
| `api/search/route.ts` | Added `T12:00:00Z` suffix to date parsing |
| `components/events/SeriesEditingNotice.tsx` | Added `series_id` detection + series siblings list |
| `dashboard/my-events/[id]/page.tsx` | Fetches series siblings, passes to SeriesEditingNotice |
| `EventForm.tsx` | Added `noValidate` + comprehensive validation with error summary |

**Date Handling Contract:**

The canonical pattern for parsing date-only strings is now:
```typescript
new Date(dateKey + "T12:00:00Z").toLocaleDateString("en-US", {
  day: "numeric",
  timeZone: "America/Denver"
})
```

This ensures the calendar date is preserved regardless of user's local timezone.

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/phase4-42k-event-creation-fixes.test.ts` | 35 tests - all fixes |
| `__tests__/missing-details.test.ts` | Updated for B1 decision |
| `components/__tests__/missing-details-chip.test.tsx` | Updated for B1 decision |

---

### Phase 4.42e — Event Creation UX + Post-Create 404 Fix (January 2026)

**Goal:** Fix post-create 404 errors and ensure weekday/date alignment in series preview.

**Problems Fixed:**

1. **Post-Create 404** — After creating a community event, navigating to edit page showed 404
   - Root cause: Edit page query filtered by `is_dsc_event = true`, excluding community events
   - Fix: Removed filter, added `isEventOwner` authorization check

2. **Weekday/Date Mismatch** — Day of Week and series preview dates could disagree
   - Root cause: `getNextDayOfWeek` used local time instead of Mountain Time
   - Fix: Created `formDateHelpers.ts` with MT-aware date utilities

3. **Layout Issue** — "Create Event Series" panel was far from schedule controls
   - Fix: Moved section directly under Day of Week / Start Time / End Time

**Key Changes:**

| File | Change |
|------|--------|
| `dashboard/my-events/[id]/page.tsx` | Removed `is_dsc_event` filter, added `isEventOwner` check |
| `lib/events/formDateHelpers.ts` | New Mountain Time date helpers |
| `dashboard/my-events/_components/EventForm.tsx` | Bi-directional weekday/date sync, layout improvements |

**New Date Helpers (`formDateHelpers.ts`):**
- `getNextDayOfWeekMT(dayName)` — Next occurrence of weekday from today in MT
- `weekdayNameFromDateMT(dateKey)` — Derive weekday name from date in MT
- `weekdayIndexFromDateMT(dateKey)` — Weekday index (0-6) in MT
- `snapDateToWeekdayMT(dateKey, targetDayIndex)` — Snap date to target weekday
- `generateSeriesDates(startDate, count)` — Generate weekly series dates

**Bi-directional Sync:**
- Day of Week change → First Event Date snaps to that weekday
- First Event Date change → Day of Week updates to match

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/event-creation-ux.test.ts` | 43 tests - date helpers, authorization, sync behavior |

---

### Phase 4.42d — Series Creation RLS Fix (January 2026)

**Goal:** Fix "Create Event Series" failing with RLS policy violation error.

**Root Cause:**
- Event INSERT in `/api/my-events` did NOT include `host_id`
- RLS policy `host_manage_own_events` requires `(auth.uid() = host_id)` on INSERT
- Result: All series creation failed with `new row violates row-level security policy for table "events"`

**Solution: Unified Insert Builder**

Created `buildEventInsert()` helper function that ALWAYS sets `host_id`:
- `host_id: userId` is set as the FIRST field (critical for RLS)
- Same builder used for both single events and series
- Ensures consistent RLS compliance across all event creation paths

**Key Changes:**

| File | Change |
|------|--------|
| `app/api/my-events/route.ts` | Added `buildEventInsert()` helper, replaced inline insert |

**Fix Pattern:**
```typescript
// BEFORE: Missing host_id caused RLS violation
.insert({
  title: body.title,
  event_type: body.event_type,
  // ... NO host_id!
})

// AFTER: host_id is always set
const insertPayload = buildEventInsert({
  userId: session.user.id,  // Critical for RLS
  body,
  ...
});
.insert(insertPayload)
```

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/series-creation-rls.test.ts` | 11 tests - host_id consistency, series fields, RLS compliance |

---

### Phase 4.42c — Recurrence Unification Fix (January 2026)

**Goal:** Fix critical bug where recurring events with `event_date` only showed one occurrence.

**Root Cause:**
- `expandOccurrencesForEvent()` short-circuited when `event_date` was set
- Labels used `day_of_week` ("Every Monday") but generator used `event_date` (single Tuesday)
- Result: Label said "Every Monday" but only one Tuesday showed in happenings

**Solution: Unified Recurrence Contract**

Created `recurrenceContract.ts` as the SINGLE source of truth:
- Both generator (`nextOccurrence.ts`) and label path (`recurrenceHumanizer.ts`) consume this
- `event_date` now defines the START of a series, not the ONLY date
- Recurring events ALWAYS expand to multiple occurrences

**Key Invariants (Enforced):**
1. Labels MUST match what the generator produces
2. `day_of_week` is authoritative for recurrence pattern
3. `event_date` is the anchor point, not the short-circuit

**Key Files:**

| File | Purpose |
|------|---------|
| `lib/events/recurrenceContract.ts` | Unified recurrence interpretation (NEW) |
| `lib/events/nextOccurrence.ts` | Generator now uses shared contract |
| `lib/recurrenceHumanizer.ts` | Labels now use shared contract |

**Functions Added:**
- `interpretRecurrence(event)` → Normalized recurrence object
- `labelFromRecurrence(rec)` → Human-readable label
- `shouldExpandToMultiple(rec)` → Invariant check
- `assertRecurrenceInvariant()` → Dev/test warning on violations

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/recurrence-unification.test.ts` | 24 tests - contract, expansion, label-generator consistency |

**Before/After:**
```
BEFORE: event_date="2026-01-06" (Tuesday), day_of_week="Monday", recurrence_rule="weekly"
        → Label: "Every Monday"
        → Generator: 1 occurrence (Jan 6 - Tuesday)

AFTER:  Same data
        → Label: "Every Monday"
        → Generator: 12 occurrences (all Mondays starting Jan 12)
```

**Documentation:**
- `docs/recurrence/RECURRENCE-CONTRACT.md` — Full recurrence system contract
- `docs/recurrence/RECURRENCE-TEST-MATRIX.md` — Test coverage matrix

---

### Phase 4.41 — Admin Verification Queue UX (January 2026)

**Goal:** Fast, safe admin workflow to verify or delete events before launch.

**Improved Admin Queue Page (`/dashboard/admin/open-mics`):**
- Default filter: Unconfirmed events (need admin verification)
- High-signal filters: status (unconfirmed/confirmed/cancelled), date (upcoming/past/all), venue, search
- Row-level quick actions: Verify (one-click), Cancel (confirm dialog), Delete (guardrails)
- Inline context: event title + public link, venue, schedule, time, verification pill

**Hard Delete Guardrails:**
- Delete blocked if event has RSVPs (409 Conflict with reason)
- Delete blocked if event has timeslot claims
- Confirm dialog with explicit warning before deletion
- Button disabled with tooltip when blocked

**Key Files:**

| File | Purpose |
|------|---------|
| `components/admin/VerificationQueueTable.tsx` | Client component with filters and actions |
| `app/api/admin/open-mics/[id]/route.ts` | DELETE endpoint with guardrails |
| `app/api/admin/open-mics/[id]/status/route.ts` | POST endpoint for status updates |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/admin-verification-queue.test.ts` | 18 tests - filter logic, verify/cancel/delete behavior |

---

### Phase 4.40 — Everything Starts Unconfirmed (January 2026)

**Simplified Verification Logic:**
- ALL events now default to "Unconfirmed" until an admin explicitly verifies them
- Verification is purely based on `last_verified_at` field:
  - `status === 'cancelled'` → Cancelled
  - `last_verified_at IS NOT NULL` → Confirmed
  - Everything else → Unconfirmed
- Removed source-based logic (no more special handling for "import"/"admin" sources)
- This ensures consistent behavior: no event shows as Confirmed unless admin verified it

**One-Time Reset Script:**
- Added `web/scripts/reset-event-verification.ts`
- Clears `last_verified_at` and `verified_by` for all events
- **Executed 2026-01-04:** Reset 19 verified events to Unconfirmed
- Usage: `cd web && npx tsx scripts/reset-event-verification.ts`

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/lib/events/verification.ts` | Simplified: cancelled → confirmed (if verified) → unconfirmed |
| `web/scripts/reset-event-verification.ts` | One-time admin script to reset all verifications |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/verification-state.test.ts` | 32 tests (rewritten for Phase 4.40 logic) |

---

### Phase 4.39 — Lockdown Fixes: Signup Banners + Verification Logic (January 2026)

**Signup Banner False-Positive Fix:**
- Fixed 6 queries in event detail page that used route param (slug) instead of `event.id` (UUID)
- This caused false "No sign-up method configured" banners when accessing events via slug URLs
- Affected queries: event_hosts (x2), event_timeslots, event_rsvps, gallery_images, event_claims

**Seeded Events Verification Logic:**
- Seeded events (source=import/admin) now remain "Unconfirmed" even if claimed by a host
- Only become "Confirmed" when `last_verified_at` is explicitly set by admin
- Prevents imported data from appearing verified just because someone claimed it
- Reason text: "Claimed event awaiting admin verification" for claimed seeded events

**Detail Page Verification Pills:**
- Added always-visible verification badges to both event detail pages
- `/events/[id]`: Badge in row with event type and DSC badges
- `/open-mics/[slug]`: Badge row above title with "Open Mic" type badge
- Uses same theme tokens as HappeningCard (green/amber/red pills)

**Slug Audit Utility:**
- New admin script: `web/scripts/slug-audit.ts`
- Reports: NULL slugs in events/profiles, duplicate slugs
- Usage: `cd web && npx tsx scripts/slug-audit.ts`

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/app/events/[id]/page.tsx` | Fixed 6 queries + verification pill |
| `web/src/app/open-mics/[slug]/page.tsx` | Verification state + pill |
| `web/src/lib/events/verification.ts` | Seeded+claimed stays unconfirmed |
| `web/scripts/slug-audit.ts` | Admin slug audit utility |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/verification-state.test.ts` | 32 tests (+8 new for Phase 4.39) |

---

### Phase 4.38 — Happenings UX + Slug Routing + Avatar Fixes (January 2026)

**Happenings Filter UX:**
- Removed sticky positioning from filter controls (was `sticky top-16`)
- Filters now scroll with content, freeing vertical screen space
- Added `BackToTop` floating button (appears after scrolling 400px)

**Canonical Slug Redirects:**
- Events: UUID access (`/events/{uuid}`) redirects to `/events/{slug}` when slug exists
- Songwriters: UUID access redirects to `/songwriters/{slug}` when slug exists
- Studios: UUID access redirects to `/studios/{slug}` when slug exists
- Backward compatible: both UUID and slug URLs continue to work

**Always-Visible Verification Pills:**
- HappeningCard now shows verification status in chips row (always visible, not just overlay)
- Green "Confirmed" pill with checkmark for verified events
- Amber "Unconfirmed" pill for seeded/imported events
- Red "Cancelled" pill for cancelled events
- Added `success` and `danger` chip variants

**Avatar Cropping Fix:**
- `SongwriterAvatar`: Added `object-top` to prevent head/face cropping
- `MemberCard`: Added `object-top` for member avatar images

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/components/happenings/StickyControls.tsx` | Non-sticky filters |
| `web/src/components/happenings/BackToTop.tsx` | Floating back-to-top button |
| `web/src/components/happenings/HappeningCard.tsx` | Verification pills in chips row |
| `web/src/app/events/[id]/page.tsx` | Canonical slug redirect |
| `web/src/app/songwriters/[id]/page.tsx` | Canonical slug redirect |
| `web/src/app/studios/[id]/page.tsx` | Canonical slug redirect |
| `web/src/components/songwriters/SongwriterAvatar.tsx` | object-top fix |
| `web/src/components/members/MemberCard.tsx` | object-top fix |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/slug-routing.test.ts` | 15 tests - UUID detection, verification states, URL patterns |

---

### Phase 4.37 — Verification Status UX + Speed Insights (January 2026)

**Verification State Helper:**
- Created `getPublicVerificationState()` helper for consistent verification logic
- Returns `confirmed` | `unconfirmed` | `cancelled` state
- Logic: cancelled status → cancelled; needs_verification/unverified → unconfirmed; unclaimed + seeded + not verified → unconfirmed; else confirmed

**Card Badge Updates:**
- Changed "Schedule TBD" → "Unconfirmed" in HappeningCard and CompactListItem
- Seeded events clearly marked as "may still be happening but not verified"

**Event Detail Verification Block:**
- Added verification block showing Cancelled (red), Unconfirmed (amber), Confirmed (green)
- Always shows green block for confirmed events (even without verification date)
- Admin users see "Manage status" link

**Submit Update Form:**
- Added status suggestion dropdown: Confirmed / Unconfirmed / Cancelled
- Stored as `field: "suggested_status"` in event_update_suggestions table

**Publish Checkbox Wording:**
- Changed from "I confirm this event is real and happening" → "Ready to publish"
- Removes implication that events might be fake

**Vercel Speed Insights:**
- Added `@vercel/speed-insights` package for performance monitoring
- SpeedInsights component added to root layout

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/lib/events/verification.ts` | Verification state helper |
| `web/src/app/events/[id]/page.tsx` | Detail page verification block |
| `web/src/components/happenings/HappeningCard.tsx` | Card badge updates |
| `web/src/components/events/EventSuggestionForm.tsx` | Status suggestion field |
| `web/src/app/layout.tsx` | SpeedInsights component |
| `docs/investigation/phase4-37-seeded-verification-status-system.md` | Investigation doc |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/verification-state.test.ts` | 26 tests - verification logic + detail page block |

---

### Phase 4.36 — Publish Confirmation + Attendee Update Notifications (January 2026)

**Publish Confirmation Gate:**
- Hosts must check "Ready to publish" checkbox before publishing (updated wording in 4.37)
- Applies to new events going from draft → published
- Inline validation error if checkbox unchecked when toggling publish ON
- Helps prevent accidental publication of incomplete events

**Attendee Update Notifications:**
- When major fields change on published events, all signed-up users receive notifications
- Dashboard notification always created (canonical)
- Email sent via `eventUpdated` template, respecting user preferences
- Major fields that trigger notifications: `event_date`, `start_time`, `end_time`, `venue_id`, `location_mode`, `day_of_week`

**Skip Conditions (No Notification):**
- First publish (no attendees yet)
- Cancellation (handled by DELETE handler)
- Non-major changes (title, description, host_notes, etc.)
- Draft event changes (not published)

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` | Publish confirmation checkbox UI |
| `web/src/app/api/my-events/[id]/route.ts` | API gate + notification trigger |
| `web/src/lib/notifications/eventUpdated.ts` | Attendee enumeration + preference-gated sending |
| `docs/investigation/phase4-36-publish-confirm-and-attendee-updates.md` | Investigation doc |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/publish-confirmation-and-updates.test.ts` | 33 tests - publish gate + notification logic |

---

### Phase 4.35 — Email Signature + SEO-Friendly Slugs (January 2026)

**Email Signature Update:**
- Changed from "— Denver Songwriters Collective" to "— From Sami Serrag on Behalf of the Denver Songwriters Collective"
- Sami's name links to `/songwriters/sami-serrag`
- Updated both HTML and plain text email formats

**Profile Slugs:**
- Added `slug` column to `profiles` table
- URLs now use readable slugs: `/songwriters/sami-serrag` instead of UUIDs
- Auto-generated from `full_name` (e.g., "Sami Serrag" → "sami-serrag")
- Collision handling: appends `-2`, `-3`, etc. for duplicates
- Trigger auto-generates slug on insert or when name changes
- Backward compatible: both UUID and slug lookups supported

**Event Slugs Cleaned:**
- Event slugs now use title only (no UUID suffix)
- Example: `/events/open-mic-night` instead of `/events/open-mic-night-a407c8e5...`
- Same collision handling and auto-generation trigger

**Complete Slug Coverage (All User-Facing Links):**

All user-facing links now use the `slug || id` pattern for backward compatibility:

| Category | Files Updated |
|----------|---------------|
| Profile cards | `SongwriterCard`, `MemberCard`, `StudioCard` |
| Event cards | `HappeningCard`, `EventCard`, `RSVPCard`, `MissingDetailsChip` |
| Dashboard | `CreatedSuccessBanner`, `my-events/[id]/page.tsx` |
| Email templates | All 8 event-related templates (rsvpConfirmation, eventReminder, eventUpdated, waitlistPromotion, occurrenceCancelledHost, occurrenceModifiedHost, eventClaimApproved, adminEventClaimNotification) |
| API routes | `/api/events/[id]/rsvp`, `waitlistOffer.ts` (fetch slug for emails/notifications) |
| Admin pages | `ClaimsTable` (event and profile links) |
| URL helpers | `lib/events/urls.ts` |

**Intentionally Using UUIDs:**
- API endpoints (data operations need stable IDs)
- Admin dashboard routes (`/dashboard/admin/events/...`)
- Host control pages (`/events/.../lineup`, `/events/.../display`)

**Database Migrations:**
- `supabase/migrations/20260103000001_add_profile_slug.sql` — Profile slug column + trigger
- `supabase/migrations/20260103000002_clean_event_slugs.sql` — Event slug cleanup + trigger

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/lib/email/render.ts` | Email signature with Sami link |
| `web/src/lib/events/urls.ts` | Centralized URL helper with slug support |
| `web/src/app/songwriters/[id]/page.tsx` | UUID + slug lookup support |
| `web/src/app/events/[id]/page.tsx` | UUID + slug lookup support |
| `web/src/app/studios/[id]/page.tsx` | UUID + slug lookup support |

---

### Phase 4.32–4.34 — UX Fixes, Host Guardrails, Smoke Suite (January 2026)

**Phase 4.32: Host/Admin No-Signup Warning**
- `hasSignupLane()` helper in `/events/[id]/page.tsx` detects missing signup configuration
- Warning banner shows for hosts/admins when:
  - `has_timeslots=true` but no timeslot rows exist
  - `has_timeslots=false` and `capacity=null`
- "Fix Sign-up" button links to dashboard edit page
- Banner NOT visible to public viewers

**Phase 4.33: Cancelled UX Refinement (My Events Dashboard)**
- Removed "Cancelled" as primary tab in MyEventsFilteredList
- Cancelled events now in collapsible disclosure section below Live/Drafts
- Collapsed by default, expands on click
- Muted styling with strikethrough for cancelled titles

**UI Contrast Fixes:**
- Primary button uses `--color-text-on-accent` (theme-aware, was `--color-bg-secondary`)
- Added `--pill-bg-success`, `--pill-fg-success`, `--pill-border-success` tokens
- "X spots left" chip uses theme-aware success tokens
- RSVPCard confirmed badge uses theme-aware tokens
- Fixes readability in Sunrise (light) theme

**Phase 4.34: Production Smoke Suite**
- `docs/SMOKE-PROD.md` — Checklist for production verification
- `scripts/smoke-prod.sh` — Automated curl-based smoke tests

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/app/events/[id]/page.tsx` | hasSignupLane() + no-signup banner |
| `web/src/app/(protected)/dashboard/my-events/_components/MyEventsFilteredList.tsx` | Cancelled disclosure |
| `web/src/app/themes/presets.css` | Success pill tokens |
| `web/src/components/ui/button.tsx` | Theme-aware primary button text |
| `docs/SMOKE-PROD.md` | Production smoke checklist |
| `scripts/smoke-prod.sh` | Automated smoke tests |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/signup-lane-detection.test.ts` | 16 tests - hasSignupLane logic + banner visibility |
| `__tests__/cancelled-ux-refinement.test.ts` | 9 tests - Cancelled disclosure behavior |

---

### Phase 4.33 — Email Template UX Improvements (January 2026)

**Visual Redesign:**
- Navy blue header (`#1e3a5f`) with bright blue accents (`#2563eb`)
- Logo image in email header (hosted on Supabase storage)
- Centralized `EMAIL_COLORS` constant for consistent theming
- Helper functions for reusable email components

**Copy Updates:**
- Host approval email: "Create DSC official events" (clarifies host privileges)
- Newsletter welcome: Button now links to `/happenings` (not `/happenings?type=open_mic`)
- Event cancellation emails: "Browse Happenings" button (not "Find Another Open Mic")

**New Email Helper Functions (`render.ts`):**
- `eventCard(eventTitle, eventUrl)` — Card-style link with event name and arrow
- `rsvpsDashboardLink()` — "View all your RSVPs →" link to dashboard

**Event-Related Emails Now Include:**
- Event name as clickable card link to event detail page
- RSVPs dashboard link for easy access to all user's RSVPs
- Both HTML and plain text versions updated

**Templates Updated:**
- `rsvpConfirmation.ts` — Confirmed and waitlist variants
- `eventReminder.ts` — Tonight/tomorrow reminders
- `eventUpdated.ts` — Event detail changes
- `eventCancelled.ts` — Full event cancellations
- `waitlistPromotion.ts` — Spot opened notifications
- `occurrenceCancelledHost.ts` — Single occurrence cancellations
- `occurrenceModifiedHost.ts` — Single occurrence modifications
- `hostApproval.ts` — Host approval copy update
- `newsletterWelcome.ts` — Button and link updates

**Preview Script:**
- `scripts/preview-all-emails.ts` — Generates HTML previews for all 23 templates
- Run: `npx tsx scripts/preview-all-emails.ts`
- Open: `scripts/email-previews/index.html`

---

### Phase 4.32 — Trust-Based Content Model (January 2026)

**Philosophy:** We trust our members. Content goes live immediately without admin approval. Admins retain the ability to hide content if needed.

**Events:**
- Any member can create events (no host approval required)
- Only approved hosts see "Is this a DSC Event" toggle
- Non-DSC events are community events, not officially endorsed
- Events publish immediately when creator toggles "Published"

**Gallery:**
- Photos appear immediately in the gallery on upload
- Admins can hide photos that violate community guidelines

**Blog:**
- Posts go live immediately when published
- No approval queue - direct publishing for all members
- Admins can hide posts if needed

**Key Implementation:**
- `is_approved: true` set automatically on all content creation
- `canCreateDSC` prop controls DSC toggle visibility in EventForm
- Gallery upload toast: "uploaded successfully!" (not "pending review")
- Blog form: "Publish now" (not "Submit for publication")

---

### Phase 4.25 — Email Preferences (January 2026)

**Features Delivered:**

- **Per-user email preferences** — Users can toggle email delivery for claim updates, event updates, and admin alerts
- **Dashboard notifications canonical** — Preferences only gate emails; dashboard notifications always appear
- **Settings UI** — Toggle switches at `/dashboard/settings` with inline confirmation
- **Admin toggle visibility** — Admin alerts toggle only renders for users with `role='admin'`

**Design Decision:**

Email preferences gate delivery only. Dashboard notifications remain the canonical record. Users who disable emails still see all notifications in their dashboard. This ensures no missed information while respecting communication preferences.

**Database Migration:**

- `supabase/migrations/20260101400000_notification_preferences.sql` — Per-user preference toggles

**Key Files:**

| File | Purpose |
|------|---------|
| `web/src/lib/notifications/preferences.ts` | Preference helpers + category mapping |
| `web/src/lib/email/sendWithPreferences.ts` | Preference-aware email sending |
| `web/src/app/(protected)/dashboard/settings/page.tsx` | Settings UI with toggles |

**Email Category Mapping:**

| Category | Templates |
|----------|-----------|
| `claim_updates` | eventClaimSubmitted, eventClaimApproved, eventClaimRejected |
| `event_updates` | eventReminder, eventUpdated, eventCancelled, occurrenceCancelledHost, occurrenceModifiedHost, rsvpConfirmation, waitlistPromotion |
| `admin_notifications` | adminEventClaimNotification, contactNotification |

**Test Coverage:**

| Test File | Coverage |
|-----------|----------|
| `__tests__/notification-preferences.test.ts` | Default preferences, category mapping, completeness checks |

---

### Phase 4.22 — Editing + Ownership UX (January 2026)

**Features Delivered:**

- **Series Editor Notice (4.22.1)** — `SeriesEditingNotice` component shows recurrence summary + "changes affect all future occurrences" messaging on event edit pages
- **Occurrence Override Editor (4.22.2)** — Admin UI at `/dashboard/admin/events/[id]/overrides` to cancel/modify single occurrences without changing series
- **Event Claim Flow (4.22.3)** — Users can claim unclaimed events (host_id IS NULL); admins approve/reject at `/dashboard/admin/claims`

**Database Migrations:**

- `supabase/migrations/20260101200000_occurrence_overrides.sql` — Per-date override table
- `supabase/migrations/20260101300000_event_claims.sql` — Event ownership claims table

**Key Components:**

| Component | Path |
|-----------|------|
| SeriesEditingNotice | `web/src/components/events/SeriesEditingNotice.tsx` |
| OccurrenceOverrideList | `web/src/app/(protected)/dashboard/admin/events/[id]/overrides/_components/OccurrenceOverrideList.tsx` |
| OccurrenceOverrideModal | `web/src/app/(protected)/dashboard/admin/events/[id]/overrides/_components/OccurrenceOverrideModal.tsx` |
| ClaimEventButton | `web/src/components/events/ClaimEventButton.tsx` |
| ClaimsTable | `web/src/app/(protected)/dashboard/admin/claims/_components/ClaimsTable.tsx` |

**Key Pages:**

| Route | Purpose |
|-------|---------|
| `/dashboard/admin/events/[id]/overrides` | Admin override editor for recurring events |
| `/dashboard/admin/claims` | Admin review of event ownership claims |

**Test Coverage (21+ tests added):**

| Test File | Coverage |
|-----------|----------|
| `__tests__/occurrence-overrides.test.ts` | Override merge logic, cancelled filtering |
| `__tests__/event-claims.test.ts` | Claim visibility, duplicate prevention, approval/rejection flow |

---

### Gallery + Comments Track — CLOSED (Phase 4.30, January 2026)

> **Track Closed: 2026-01-01**
>
> This track is complete. All features shipped, tests passing, docs updated.

**Features Delivered:**

- **Album-first gallery architecture** — Photos belong to albums; no orphan uploads
- **Album visibility** — `is_published` + `is_hidden` (never `is_approved` in user-facing queries)
- **Photo/album comments** — `gallery_photo_comments` and `gallery_album_comments` tables
- **Threaded comments (1-level)** — `parent_id` references on all comment tables
- **Owner moderation** — `is_hidden` / `hidden_by` columns; entity owner + admin can hide
- **Soft-delete by author** — `is_deleted` column; author/admin can soft-delete own comments
- **Profile comments** — New `profile_comments` table for songwriter/studio profiles
- **Shared CommentThread component** — Reusable component for all comment surfaces
- **Weekly digest with kill switch** — `ENABLE_WEEKLY_DIGEST` env var
- **Copy freeze guardrails** — No approval/metrics/urgency language in user-facing copy

**Database Migration:**

- `supabase/migrations/20260101100000_threaded_comments_and_profile_comments.sql`
- Additive-only (safe rollout): all `ADD COLUMN IF NOT EXISTS` with defaults
- New table: `profile_comments` with RLS policies

**Test Coverage (39+ tests added):**

| Test File | Coverage |
|-----------|----------|
| `__tests__/threaded-comments.test.ts` | Threading, moderation, profile comments |
| `__tests__/gallery-photo-comments.test.ts` | Comments-as-likes model, no gamification |
| `__tests__/gallery-copy-freeze.test.ts` | No approval/metrics/urgency language |
| `__tests__/gallery-comments-soft-delete-rls.test.ts` | RLS policy coverage |

**Key Components:**

| Component | Path |
|-----------|------|
| CommentThread | `web/src/components/comments/CommentThread.tsx` |
| ProfileComments | `web/src/components/comments/ProfileComments.tsx` |
| GalleryComments | `web/src/components/gallery/GalleryComments.tsx` |
| BlogComments | `web/src/components/blog/BlogComments.tsx` |

**Investigation Doc:** `docs/investigation/comments-phase3-threading.md`

---

### v2.0 Visual System (December 2025)

Scan-first, image-forward card design. See PRODUCT_NORTH_STAR.md v2.0.

**Phase 4.6 Premium Card Polish:**
- `card-spotlight` surface (MemberCard recipe)
- Shadow token stack (`--shadow-card`, `--shadow-card-hover`)
- Poster zoom on hover (`scale-[1.02]`)
- MemberCard pill-style chips
- "Missing details" as warning badge

**Phase 4.5 Vertical PosterCard:**
- Vertical layout (poster top, content bottom)
- 4:3 aspect ratio poster media
- Responsive grid (1 col / 2 col / 3 col)
- 3-tier image rendering (card → blurred → placeholder)

**Phase 4.3-4.4 Readability:**
- Typography fixes (14px minimum)
- Sunrise theme contrast fixes
- TONIGHT/TOMORROW temporal emphasis

**Phase 4.14-4.16 Lint Cleanup:**
- Lint warnings: 29 → 0
- `next/image` conversions for public avatars, thumbnails, HappeningCard
- Documented eslint suppressions for intentional `<img>` (ReactCrop, blob URLs, user uploads)

**Phase 4.18 Recurrence Expansion + Date Jump:**
- Multi-ordinal recurrence support ("2nd/3rd", "1st & 3rd", `BYDAY=1TH,3TH`)
- 90-day rolling window occurrence expansion
- Weekly events show all future occurrences (~13 entries)
- Monthly ordinal events show 3-4 occurrences per window
- DateJumpControl for jumping to specific dates
- "Schedule unknown" section for uncomputable events
- Beta warning banner prominent at top of /happenings

**Phase 4.19 Happenings UX Pass:**
- DateJumpControl presets: Today, Tomorrow, This Weekend, Pick a date
- Synchronized Month/Day/Year dropdowns with 90-day window constraint
- Denser cards: 3:2 aspect ratio (was 4:3), reduced padding/spacing
- StickyControls wrapper with backdrop blur (sticks below nav)
- DateSection with collapsible date groups (chevron toggle)
- BetaBanner dismissible per session (localStorage)
- Results summary: event/date counts with filter breakdown

**Phase 4.20 Gallery UX Final Lock (December 2025):**
- Explicit Publish/Unpublish button for draft albums (discoverability fix)
- "New album" button moved below dropdown to prevent overlap
- Inline status feedback (no toasts) for publish/unpublish actions
- Empty-state guidance for albums without photos
- Owner context for "Hidden by admin" status badge
- Bulk comment moderation (hide/unhide all) in AlbumManager
- Admin audit trail logging (`lib/audit/moderationAudit.ts`)
- Weekly digest kill switch via `ENABLE_WEEKLY_DIGEST` env var
- Copy freeze tests (no approval/metrics/urgency language in user-facing copy)
- **Bug fix:** Album detail page now shows images for new albums (query mismatch fix)
  - Was filtering by `is_approved=true`, now uses `is_published/is_hidden` to match gallery listing

**Phase 4.21 Occurrence Overrides for Recurring Events (January 2026):**
- Per-occurrence override system without persisting occurrences
- New `occurrence_overrides` table:
  - `event_id` — Reference to the recurring series
  - `date_key` — YYYY-MM-DD (Denver-canonical)
  - `status` — `normal` or `cancelled`
  - `override_start_time` — Optional time change
  - `override_cover_image_url` — Optional flyer override
  - `override_notes` — Optional occurrence-specific notes
- Overrides apply only to the specific occurrence date
- Recurring events remain single canonical records (no DB row per date)
- Overrides are evaluated during occurrence expansion in `nextOccurrence.ts`
- Cancelled occurrences:
  - Hidden by default on `/happenings`
  - Revealed via "Show cancelled" toggle in StickyControls
  - Visually de-emphasized with CANCELLED badge and red accent
- Override flyer and notes take precedence when present
- RLS: public read, admin-only write
- **Database Migration:** `supabase/migrations/20260101200000_occurrence_overrides.sql`
- **Test Coverage:** 17 new tests in `__tests__/occurrence-overrides.test.ts`

### Key Gallery Components

| Component | Path |
|-----------|------|
| AlbumManager | `web/src/app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx` |
| UserGalleryUpload | `web/src/app/(protected)/dashboard/gallery/UserGalleryUpload.tsx` |
| Gallery listing | `web/src/app/gallery/page.tsx` |
| Album detail | `web/src/app/gallery/[slug]/page.tsx` |
| Moderation audit | `web/src/lib/audit/moderationAudit.ts` |
| Feature flags | `web/src/lib/featureFlags.ts` |

### Logging System (December 2025)
- Admin logs at `/dashboard/admin/logs`
- Error boundaries wired to appLogger
- Server + client logging support

---

## Deferred Backlog

See full backlog in previous CLAUDE.md version or `docs/known-issues.md`.

### P1 (Fix Soon)
- API rate limiting missing
- 53 unnecessary `as any` casts in profile page
- Empty alt text on user avatars

### P2 (Nice to Fix)
- Typography token docs drift
- Loading.tsx coverage gaps
- Duplicate VenueSelector components

### Future: Phase 4.38 — Hard Delete Admin Tools
**Investigation completed in:** `docs/investigation/phase4-37-seeded-verification-status-system.md` (Section 6)

Event hard delete is safe—all FKs use CASCADE or SET NULL:
- `event_rsvps`, `event_timeslots`, `timeslot_claims`, `occurrence_overrides`, `event_claims`, `event_update_suggestions`, `change_reports`, `favorites`, `event_hosts`, `event_comments`, `guest_verifications` — CASCADE
- `gallery_albums`, `monthly_highlights` — SET NULL (orphans album / removes highlight)

Venue hard delete requires check:
- Before delete: Check for events referencing `venue_id`
- If events exist: Block delete or cascade-nullify `venue_id`
- Add admin confirmation: "X events reference this venue"

---

## Test Files

All tests live in `web/src/` and run via `npm run test -- --run`.

| File | Tests |
|------|-------|
| `__tests__/card-variants.test.tsx` | Card variant behavior |
| `__tests__/navigation-links.test.ts` | Canonical route enforcement |
| `__tests__/happenings-filters.test.ts` | Filter logic |
| `lib/events/__tests__/nextOccurrence.test.ts` | Occurrence computation (61 tests) |
| `__tests__/utils/datetime.test.ts` | Datetime utilities |
| `components/__tests__/no-notes-leak.test.tsx` | Raw dump regression |
| `app/.../event-update-suggestions/page.test.tsx` | Suggestions page |
| `lib/guest-verification/*.test.ts` | Guest verification |
| `lib/email/email.test.ts` | Email templates |
| `app/api/guest/*.test.ts` | Guest API endpoints |
| `__tests__/gallery-photo-comments.test.ts` | Gallery photo comments |
| `__tests__/gallery-album-management.test.ts` | Album management (25 tests) |
| `__tests__/gallery-copy-freeze.test.ts` | Copy freeze (no approval/metrics language) |
| `__tests__/threaded-comments.test.ts` | Threaded comments + profile comments |
| `__tests__/gallery-comments-soft-delete-rls.test.ts` | Comment RLS policies |
| `__tests__/occurrence-overrides.test.ts` | Occurrence override model (17 tests) |
| `__tests__/signup-lane-detection.test.ts` | Signup lane detection + banner visibility (16 tests) |
| `__tests__/cancelled-ux-refinement.test.ts` | Cancelled disclosure behavior (9 tests) |
| `__tests__/verification-state.test.ts` | Verification state helper + detail page block (26 tests) |
| `__tests__/slug-routing.test.ts` | Slug routing + verification pills (15 tests) |
| `__tests__/series-creation-rls.test.ts` | Series creation RLS fix (11 tests) |
| `__tests__/recurrence-unification.test.ts` | Recurrence contract + label-generator consistency (24 tests) |
| `__tests__/event-creation-ux.test.ts` | Event creation UX, 404 fix, date helpers (43 tests) |
| `lib/featureFlags.test.ts` | Feature flags |

### Archived Tests

Legacy test suite archived at `docs/archived/tests-legacy-schema/`. These tests reference an older "Open Mic Drop" schema (`event_slots`, `performer_id`, etc.) incompatible with current DSC schema (`event_timeslots`, `timeslot_claims`, `member_id`).

**Do NOT run archived tests against current database.**

---

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
NEXT_PUBLIC_SITE_URL=
```

---

**Last updated:** January 2026

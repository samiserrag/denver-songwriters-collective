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

## Vercel API Access (IMPORTANT)

**The repo agent has direct access to Vercel deployment logs and status via the Vercel REST API.**

### Available Capabilities

| Capability | API Endpoint | Status |
|------------|--------------|--------|
| List deployments | `GET /v6/deployments` | ✅ Working |
| Deployment status | `GET /v13/deployments/{id}` | ✅ Working |
| Build logs | `GET /v3/deployments/{id}/events` | ✅ Working |
| Project info | `GET /v9/projects` | ✅ Working |
| Runtime logs | Streaming endpoint | ⚠️ Requires Log Drains |

### How to Use

The agent can query Vercel directly to debug production issues:

```bash
# Get latest deployment
curl -s "https://api.vercel.com/v6/deployments?limit=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '.deployments[0]'

# Get deployment status
curl -s "https://api.vercel.com/v13/deployments/{deployment_id}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '{readyState, url, createdAt}'

# Get build logs
curl -s "https://api.vercel.com/v3/deployments/{deployment_id}/events" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '.[].text'
```

### Token Location

The Vercel API token is available in the conversation context. If the agent needs to debug production issues:
1. Query deployment status to confirm latest deploy
2. Check build logs for compilation errors
3. Test endpoints directly with `curl`

### Runtime Logs (Not Yet Available)

Runtime logs (function invocations, errors) require either:
1. **Log Drains** — Configure a webhook URL in Vercel dashboard to receive logs
2. **Vercel CLI** — `vercel logs <url> --follow` (requires interactive terminal)

**To enable runtime logs:** Set up a Log Drain in Vercel Dashboard → Project → Settings → Log Drains. This would allow the agent to see actual 500 errors, request/response details, and console.log output from production.

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

**Current Status (Phase 4.65):** Lint warnings = 0. All tests passing (1604). Intentional `<img>` uses (ReactCrop, blob URLs, markdown/user uploads) have documented eslint suppressions.

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
| VenueSelector | `web/src/components/ui/VenueSelector.tsx` |
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

- `/events/[id]` — Canonical event detail page (supports both UUID and slug)
- `/open-mics/[slug]` — Legacy entrypoint, redirects to `/events/[id]`

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

### Phase 4.65 — Venue Profile Buttons Fix (January 2026)

**Goal:** Fix "Get Directions" and "View on Maps" buttons opening the same URL, and add Website button.

**Problem 1:** When venue has `google_maps_url`, both "Get Directions" and "View on Maps" opened the same place page URL. "Get Directions" should open Google Maps in directions mode.

**Problem 2:** When venue has both `google_maps_url` AND `website_url`, only the Maps button showed. Website button was missing.

**Solution:**

| Button | Behavior |
|--------|----------|
| Get Directions | Always uses `/maps/dir/?api=1&destination=...` (directions mode) |
| View on Maps | Uses `google_maps_url` (place page with reviews, hours, photos) |
| Website | Shows when venue has `website_url` AND `google_maps_url` |

**Files Added:**

| File | Purpose |
|------|---------|
| `lib/venue/getDirectionsUrl.ts` | Pure helper for Google Maps Directions URL |
| `__tests__/venue-directions-url.test.ts` | 13 tests for URL generation |

**Files Modified:**

| File | Change |
|------|--------|
| `app/venues/[id]/page.tsx` | Uses `getVenueDirectionsUrl()`, added Website button |

**Test Coverage:** 1604 tests passing (13 new).

---

### Phase 4.64 — Venue CSV Quote-Safe Parsing Fix (January 2026)

**Goal:** Fix venue CSV re-upload validation failure when fields contain commas.

**Bug:** Admin → Ops Console → Venues → Export CSV → re-upload same file failed with "expected 10 columns, got 11/12/14" on rows containing commas inside quoted fields (e.g., notes like "Great venue, friendly staff").

**Root Cause:** `venueCsvParser.ts` used naive `line.split(",")` which ignored RFC 4180 quoting rules. The serializer correctly quoted commas, but the parser didn't respect those quotes.

**Fix:** Added `parseCsvLine()` helper (same pattern as `eventCsvParser.ts`) that properly handles:
- Quoted fields containing commas: `"Foo, Bar"` → `Foo, Bar`
- Escaped quotes: `"He said ""hello"""` → `He said "hello"`

**Files Modified:**

| File | Change |
|------|--------|
| `lib/ops/venueCsvParser.ts` | Added `parseCsvLine()` helper, replaced `split(",")` calls |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/venue-csv-quote-safe.test.ts` | 19 tests for round-trip, quoted commas, edge cases |

**Test Coverage:** 1591 tests passing (19 new).

**Invariants Preserved:**
- Schema unchanged (10 columns in same order)
- Row numbering unchanged (1-indexed for display)
- CRLF/LF handling preserved
- Multi-line cell STOP-GATE preserved

---

### Phase 4.63 — ABC Track Completion: Ops Console Discoverability + Events→Happenings (January 2026)

**Goal:** Make Ops Console discoverable from Admin Hub and align admin terminology with "Happenings" branding.

**Changes:**

| Area | Change |
|------|--------|
| Admin Hub | Added "Operations" section with Ops Console link |
| Manage Happenings | "Bulk operations →" cross-link to `/dashboard/admin/ops/events` |
| Venue Management | "Bulk operations →" cross-link to `/dashboard/admin/ops/venues` |
| Terminology | "Events" → "Happenings" in admin UI copy (not URLs/DB/types) |
| Legacy cleanup | Deleted `/dashboard/admin/dsc-events` page (superseded by events page) |

**Files Modified:**

| File | Change |
|------|--------|
| `/dashboard/admin/page.tsx` | Operations section, Happenings terminology |
| `/dashboard/admin/events/page.tsx` | "Manage Happenings" heading + bulk ops link |
| `/dashboard/admin/events/new/page.tsx` | "Back to Happenings", "Add New Happening" |
| `/dashboard/admin/venues/AdminVenuesClient.tsx` | Bulk ops link, "venues for happenings" |
| `/dashboard/admin/ops/page.tsx` | "Happening Bulk Management" card |
| `/dashboard/admin/ops/events/page.tsx` | "Happenings Bulk Management" heading/stats |
| `/dashboard/admin/ops/overrides/page.tsx` | "← Happenings Ops" nav link |

**Deleted:**
- `/dashboard/admin/dsc-events/page.tsx` — Legacy DSC-only event list (zero code references)

**Navigation Path:**
- Admin Hub → Operations → Ops Console
- Manage Happenings → Bulk operations → Happenings Ops
- Venue Management → Bulk operations → Venue Ops

**Terminology Note:**
"Happenings" is used in user-facing copy only. URLs remain `/events/`, DB tables remain `events`, TypeScript types remain `Event*`. This is a copy-only change for brand consistency.

---

### Phase 4.62 — Ops Console v1: Events + Overrides Bulk Management (January 2026)

**Goal:** Admin-only bulk management for events and occurrence overrides via CSV export/import.

**How to Use Events Ops Console:**
1. Navigate to `/dashboard/admin/ops/events`
2. **Export:** Filter by status/type/venue/recurring, click "Download CSV"
3. **Edit:** Open CSV in Excel/Sheets, update fields (title, status, times, etc.)
4. **Preview:** Upload edited CSV, review diff before applying
5. **Apply:** Confirm changes to update database
6. **Bulk Verify:** Select events, click "Verify Selected" to mark as admin-verified

**How to Use Overrides Ops Console:**
1. Navigate to `/dashboard/admin/ops/overrides`
2. **Export:** Filter by event_id or date range, click "Download CSV"
3. **Edit/Create:** Add new rows or edit existing ones (upsert behavior)
4. **Preview:** Upload CSV, see which overrides will be created vs updated
5. **Apply:** Confirm to create new overrides and update existing ones

**Events CSV Schema (12 columns):**
```
id,title,event_type,status,is_recurring,event_date,day_of_week,start_time,end_time,venue_id,is_published,notes
```
- `notes` maps to `host_notes` database column
- No verification timestamps (verification via UI only)
- Update-only (no event creation via CSV)

**Overrides CSV Schema (6 columns):**
```
event_id,date_key,status,override_start_time,override_notes,override_cover_image_url
```
- Upsert behavior: creates new or updates existing
- Composite key: `(event_id, date_key)` identifies overrides
- No id column needed

**Files Added:**

| File | Purpose |
|------|---------|
| `docs/OPS_BACKLOG.md` | Deferred features backlog |
| `lib/ops/eventCsvParser.ts` | Event CSV parse/serialize |
| `lib/ops/eventValidation.ts` | Event row validation |
| `lib/ops/eventDiff.ts` | Event diff computation |
| `lib/ops/overrideCsvParser.ts` | Override CSV parse/serialize |
| `lib/ops/overrideValidation.ts` | Override row validation |
| `lib/ops/overrideDiff.ts` | Override diff with upsert support |
| `api/admin/ops/events/export/route.ts` | GET - Events CSV download |
| `api/admin/ops/events/preview/route.ts` | POST - Preview diff |
| `api/admin/ops/events/apply/route.ts` | POST - Apply changes |
| `api/admin/ops/events/bulk-verify/route.ts` | POST - Bulk verify/unverify |
| `api/admin/ops/overrides/export/route.ts` | GET - Overrides CSV download |
| `api/admin/ops/overrides/preview/route.ts` | POST - Preview diff (upsert) |
| `api/admin/ops/overrides/apply/route.ts` | POST - Apply changes (upsert) |
| `dashboard/admin/ops/events/page.tsx` | Events bulk management UI |
| `dashboard/admin/ops/overrides/page.tsx` | Overrides bulk management UI |

**Test Coverage:** 98 new tests (1572 total).

| Test File | Tests |
|-----------|-------|
| `ops-event-csv.test.ts` | 21 tests - Event CSV parsing |
| `ops-event-validation.test.ts` | 26 tests - Event validation |
| `ops-event-diff.test.ts` | 15 tests - Event diff computation |
| `ops-override-csv.test.ts` | 36 tests - Override CSV/validation/diff |

**Key Design Decisions:**
1. **No verification in CSV:** Verification timestamps excluded to prevent spreadsheet mistakes. Use UI bulk actions instead.
2. **Override upsert:** Creates new overrides if (event_id, date_key) not found, updates if found.
3. **Notes → host_notes mapping:** CSV uses `notes` column, maps to `host_notes` DB column.
4. **Event type validation:** Warns on unknown types (forward compatibility) but errors on invalid status.

---

### Phase 4.61 — Ops Console v1: Venue Bulk Management (January 2026)

**Goal:** Admin-only bulk management for venues via CSV export/import.

**How to Use Ops Console v1:**
1. Navigate to `/dashboard/admin/ops/venues`
2. **Export:** Click "Download CSV" to get all venues
3. **Edit:** Open CSV in Excel/Sheets, update `google_maps_url` or other fields
4. **Preview:** Upload edited CSV, review diff before applying
5. **Apply:** Confirm changes to update database

**Google Maps URL Helper:**
- Select venue missing `google_maps_url` from dropdown
- Click generated search URL to find venue on Google Maps
- Copy the place URL and paste into CSV

**Files Added:**

| File | Purpose |
|------|---------|
| `scripts/data-health.ts` | CLI health report (`cd web && npx tsx scripts/data-health.ts`) |
| `lib/ops/venueValidation.ts` | Row-level CSV validation |
| `lib/ops/venueCsvParser.ts` | CSV parse/serialize |
| `lib/ops/venueDiff.ts` | Diff computation |
| `lib/ops/googleMapsHelper.ts` | URL generation helper |
| `lib/audit/opsAudit.ts` | Audit logging for ops actions |
| `api/admin/ops/venues/export/route.ts` | GET - CSV download |
| `api/admin/ops/venues/preview/route.ts` | POST - Preview diff |
| `api/admin/ops/venues/apply/route.ts` | POST - Apply changes |
| `dashboard/admin/ops/page.tsx` | Ops Console landing |
| `dashboard/admin/ops/venues/page.tsx` | Venue bulk management UI |

**Test Coverage:** 71 new tests (1474 total).

**Constraints:**
- Update-only (no venue creation via CSV)
- Admin-only (uses `checkAdminRole()`)
- Simple CSV parser (no multi-line cells)

---

### Phase 4.60 — Get Directions Venue Name Fallback (January 2026)

**Goal:** Fix "Get Directions" to find the actual venue on Google Maps, not just the building address.

**Problem:**
- 76 of 91 venues don't have `google_maps_url` set
- Fallback searched by address only (e.g., "10040 W 26th Ave")
- Google Maps showed the building, not the venue (Tavern on 26th)

**Solution:**
- Fallback now searches "Venue Name Address" (e.g., "Tavern on 26th 10040 W 26th Ave")
- Google Maps finds the actual place with reviews, hours, photos

**Priority Order:**
1. `venue.google_maps_url` (valid http/https)
2. lat/lng (for custom locations)
3. venue name + address search
4. address-only search
5. name-only search
6. null (disabled)

**Files Modified:**

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | `getGoogleMapsUrl()` now accepts `venueName` parameter, handles all edge cases |
| `app/venues/[id]/page.tsx` | Fallback URL includes venue name, handles name-only case |

**Files Added:**

| File | Purpose |
|------|---------|
| `__tests__/phase4-60-google-maps-fallback.test.ts` | 24 tests for URL generation priority and edge cases |

**Before/After:**
- Before: `maps.google.com/search/?query=10040+W+26th+Ave` (shows building)
- After: `maps.google.com/search/?query=Tavern+on+26th+10040+W+26th+Ave` (shows venue)

**Edge Cases Handled:**
- Name-only search when address is null
- Address-only search when name is null
- Unicode venue names (properly encoded)
- Special characters (apostrophes, ampersands)
- Custom locations use lat/lng when available

**Test Coverage:** 1403 tests passing (24 new tests).

---

### Phase 4.59 — Kindred Groups + Jam Sessions Filter Pills (January 2026)

**Goal:** Add quick-access filter pills for Kindred Songwriter Groups and new Jam Sessions event type on /happenings page.

**New Event Type:**

| Type | Label | Description | Icon |
|------|-------|-------------|------|
| `jam_session` | Jam Session | Casual music gathering for jamming and improvisation | 🎸 |

**Database Migration:**

| Migration | Purpose |
|-----------|---------|
| `20260111000002_add_jam_session_event_type.sql` | Adds `jam_session` to `event_type` PostgreSQL enum |

**New Filter Pills:**

| Pill | Event Type | Icon |
|------|------------|------|
| Kindred | `kindred_group` | HeartIcon (hand-drawn heart) |
| Jams | `jam_session` | GuitarIcon (electric guitar) |

**Filter Pills Layout:**
- Changed from 3-column grid to flexible wrap layout
- 5 pills total: Open Mics, DSC, Shows, Kindred, Jams
- Responsive: wraps naturally on narrow screens

**Files Added:**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260111000002_add_jam_session_event_type.sql` | Enum extension |

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/HappeningsFilters.tsx` | Added HeartIcon, GuitarIcon, Kindred + Jams pills, flex wrap layout |
| `app/happenings/page.tsx` | Added `jam_session` query handling and page title |
| `types/events.ts` | Added `jam_session` to EventType union and EVENT_TYPE_CONFIG |
| `components/happenings/HappeningCard.tsx` | Added `jam_session` to EVENT_TYPE_LABELS and DEFAULT_EVENT_IMAGES |
| `components/happenings/SeriesCard.tsx` | Added `jam_session` to DEFAULT_EVENT_IMAGES |

**Event Types Now Supported (9 total):**
- `song_circle`, `workshop`, `meetup`, `showcase`, `open_mic`, `gig`, `kindred_group`, `jam_session`, `other`

**Dashboard Support:**
- Event creation form automatically includes new types via `EVENT_TYPE_CONFIG` iteration
- All dashboards use fallback pattern: `EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.other`

**Test Coverage:** 1379 tests passing.

---

### Phase 4.58 — Venue Directory MVP (January 2026)

**Goal:** Public venue directory pages for discovering venues hosting happenings.

**New Routes:**

| Route | Purpose |
|-------|---------|
| `/venues` | Index page showing all venues in alphabetical grid |
| `/venues/[id]` | Detail page with venue info + happenings at venue |

**New Components:**

| Component | Path | Purpose |
|-----------|------|---------|
| VenueCard | `components/venue/VenueCard.tsx` | Card with name, location, event count, link icons |
| VenueGrid | `components/venue/VenueGrid.tsx` | Responsive grid layout (1/2/3/4 cols) |

**Features:**
- Event count badge shows upcoming happenings per venue ("0 upcoming", "1 happening", "12 happenings")
- Get Directions button (prefers `google_maps_url`, falls back to address-based Google Maps link)
- Website/phone links when available
- Accessibility notes and parking notes displayed on detail page
- HappeningCard grid for venue's upcoming events
- Uses existing `card-spotlight` surface pattern

**Security:**
- `venues.notes` field NOT exposed on public pages (admin-only)
- No new RLS needed (public SELECT already exists on venues table)

**Data:**
- 91 venues in database
- 15/91 (16%) have `google_maps_url`
- 45/91 (49%) have `website_url`

**Files Added:**

| File | Purpose |
|------|---------|
| `app/venues/page.tsx` | Index page |
| `app/venues/[id]/page.tsx` | Detail page |
| `components/venue/VenueCard.tsx` | Card component |
| `components/venue/VenueGrid.tsx` | Grid wrapper |
| `docs/investigation/venue-directory-mvp.md` | Investigation doc |

**Files Modified:**

| File | Change |
|------|--------|
| `types/index.ts` | Added `zip`, `neighborhood`, `contact_link`, `accessibility_notes`, `parking_notes` to Venue type |

**Test Coverage:** 1379 tests passing (11 new for series venue links).

**Series → Venue Cross-Linking:**
- SeriesCard venue names now link to `/venues/[id]` when `venue_id` exists
- Custom locations render as plain text (no venue_id to link)
- Uses internal `<Link>` component, not external VenueLink

**Navigation:**
- Added "Venues" to main navigation (desktop + mobile)
- Positioned after "Happenings" in nav order

**Files Modified (Cross-Linking):**

| File | Change |
|------|--------|
| `components/happenings/SeriesCard.tsx` | Venue names link to /venues/[id] |
| `components/navigation/header.tsx` | Added Venues to navLinks array |
| `__tests__/phase4-58-series-venue-links.test.ts` | 11 new tests for venue link logic |

**Deferred:**
- Search/filter on venues index
- Map view (requires lat/lng migration)
- Venue engagement v1 (claims, tags, photos) - STOP-GATE for later

---

### Phase 4.57 — Series View Sliding Day Headers (January 2026)

**Goal:** Add sticky day-of-week headers to Series view, matching the Timeline view's DateSection behavior.

**Key Changes:**

| Feature | Implementation |
|---------|----------------|
| Day grouping | Series entries grouped by `day_of_week` field |
| Sticky headers | Same styling as DateSection: `sticky top-[120px] z-20` with backdrop blur |
| Day ordering | Days ordered starting from today (e.g., if Friday, shows Fri → Sat → Sun → Mon...) |
| Collapsible sections | Each day section has chevron toggle to collapse/expand |
| One-time events | Events without recurring day grouped as "One-time" |
| Schedule Unknown | Events with incomplete schedule info shown at bottom with amber accent |

**SeriesView.tsx Restructure:**
- Added `DaySection` component with sticky header and collapse toggle
- Added `getDayOrderFromToday()` for relative day ordering
- Groups series by `day_of_week` using `React.useMemo`
- Matches DateSection styling exactly

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/SeriesView.tsx` | Complete restructure with day grouping and sticky headers |

**Test Coverage:** 1368 tests passing.

---

### Phase 4.56 — Kindred Songwriter Groups Event Type (January 2026)

**Goal:** Add new event type for happenings hosted by other local songwriter communities (non-DSC groups).

**Key Changes:**

| Feature | Implementation |
|---------|----------------|
| New event type | `kindred_group` added to EventType union |
| Label | "Kindred Songwriter Groups" |
| Icon | 🤝 (handshake emoji) |
| Filter support | Added to HappeningsFilters TYPE_OPTIONS dropdown |
| Card labels | Added to HappeningCard and SeriesCard EVENT_TYPE_LABELS |
| Default image | Uses song-circle.svg (similar community vibe) |
| Claim CTA | Help text added: "Do you host one of these happenings? Click to claim as host" |

**Database Migration (`20260111000001_add_event_types.sql`):**
- Added `gig` to event_type enum
- Added `meetup` to event_type enum
- Added `kindred_group` to event_type enum

**Files Modified:**

| File | Change |
|------|--------|
| `types/events.ts` | Added `kindred_group` to EventType and EVENT_TYPE_CONFIG |
| `components/happenings/HappeningsFilters.tsx` | Added to TYPE_OPTIONS |
| `components/happenings/HappeningCard.tsx` | Added to EVENT_TYPE_LABELS and DEFAULT_EVENT_IMAGES |
| `components/happenings/SeriesCard.tsx` | Added to DEFAULT_EVENT_IMAGES |
| `app/happenings/page.tsx` | Added filter handling, page title, filter summary, claim CTA |
| `lib/supabase/database.types.ts` | Regenerated with new enum values |

**Test Coverage:** 1368 tests passing.

---

### Phase 4.55 — Happenings Page UX Redesign (January 2026)

**Goal:** Transform the Happenings page from a "database GUI" feel into an inviting discovery experience for songwriters, music fans, and venues.

**Key Changes:**

| Feature | Implementation |
|---------|----------------|
| ViewModeSelector | Hero-level visual cards for Timeline/Series selection |
| Progressive disclosure | All advanced filters collapsed by default in a card |
| Quick filter cards | Compact Open Mics, DSC Happenings, Shows buttons |
| Polished search | Larger (py-3), rounded-xl, improved focus states |
| Humanized summary | "X tonight · Y this weekend · Z in next 3 months" |
| Terminology fix | Remaining "event" → "happening" changes |

**ViewModeSelector Component (new):**
- Two large cards side-by-side (Timeline vs Series)
- Visual icon + headline + 1-line description
- Active state: `card-spotlight` styling with gold glow
- Uses `--shadow-card-hover` for active state

**HappeningsFilters Redesign:**
- Quick filter cards at top (smaller than before: py-3 vs py-4)
- Search bar enhanced: py-3, rounded-xl, focus ring
- Filters collapsed by default in `<details>` element
- Filter summary in collapsed header (e.g., "Mon, Tue · Free")
- Active filter count badge on collapsed section
- Days, When, Type, Cost in organized grid when expanded

**Humanized Results Summary:**
- Default view: "X tonight · Y this weekend · Z this week · Total in next 3 months"
- Filtered views: "X happenings across Y dates (context)"

**Files Added:**

| File | Purpose |
|------|---------|
| `components/happenings/ViewModeSelector.tsx` | Hero-level view mode cards |

**Files Modified:**

| File | Change |
|------|--------|
| `components/happenings/HappeningsFilters.tsx` | Redesigned with progressive disclosure |
| `components/happenings/StickyControls.tsx` | Removed inline toggle, uses ViewModeSelector |
| `app/happenings/page.tsx` | Humanized results summary, time period counts |
| `app/page.tsx` | Fixed "DSC Events" → "DSC Happenings" |
| `__tests__/happenings-filters.test.ts` | Updated for new UI structure |

**Test Coverage:** 1368 tests passing.

---

### Phase 4.53 — Comment Editing + Guest Comment Deletion (January 2026)

**Goal:** Enable comment editing for all logged-in users and allow guests to delete their own comments via email verification.

**Comment Editing:**

| Feature | Implementation |
|---------|----------------|
| Edit endpoint | `PATCH /api/comments/[id]` for all comment types |
| Authorization | Only comment author can edit (not admin, not moderator) |
| UI | Edit button appears on hover, inline textarea with Save/Cancel |
| Indicator | "(edited)" shown next to timestamp for edited comments |
| Guest comments | Cannot be edited (no way to re-authenticate) |

**Guest Comment Deletion:**

| Feature | Implementation |
|---------|----------------|
| Request code | `POST /api/guest/comment-delete/request-code` |
| Verify code | `POST /api/guest/comment-delete/verify-code` |
| Validation | Guest must enter same email used when posting comment |
| Action | Soft-delete (`is_deleted = true`) preserves data |
| UI | Modal with email input → verification code input |

**Database Migrations:**

| Migration | Purpose |
|-----------|---------|
| `20260110200000_add_comment_edited_at.sql` | Adds `edited_at` column to all 5 comment tables |
| `20260110210000_add_delete_comment_action_type.sql` | Adds `delete_comment` to valid action types |

**Files Added:**

| File | Purpose |
|------|---------|
| `app/api/comments/[id]/route.ts` | PATCH endpoint for editing comments |
| `app/api/guest/comment-delete/request-code/route.ts` | Guest deletion verification request |
| `app/api/guest/comment-delete/verify-code/route.ts` | Guest deletion verification + soft-delete |

**Files Modified:**

| File | Change |
|------|--------|
| `components/comments/CommentThread.tsx` | Edit UI, guest delete modal, `edited_at` display |

**Comment Tables Supported:**
- `blog_comments`
- `gallery_photo_comments`
- `gallery_album_comments`
- `profile_comments`
- `event_comments`

**Permission Matrix:**

| Action | Logged-in Author | Admin | Guest (via email) |
|--------|------------------|-------|-------------------|
| Edit | Yes | No | No |
| Delete | Yes | Yes | Yes (soft-delete) |

---

### Phase 4.51j — Page Scroll Reset (January 2026)

**Goal:** Fix pages loading scrolled down instead of at the top.

**Problem:** Pages (especially profile pages like `/songwriters/[id]`) were loading with a slight scroll offset instead of starting at the top.

**Root Cause:** Browser scroll restoration combined with `scroll-behavior: smooth` could cause pages to restore a previous scroll position from navigation history.

**Solution:** Created `ScrollReset` client component that:
1. Tracks back/forward navigation via `popstate` event listener
2. Fresh navigation (clicking links): Scrolls to top
3. Back/forward buttons: Allows browser to restore previous scroll position
4. Hash anchors (e.g., `#comments`): Browser handles natively

**Files Added:**

| File | Purpose |
|------|---------|
| `components/layout/ScrollReset.tsx` | Client component to reset scroll position |

**Files Modified:**

| File | Change |
|------|--------|
| `app/layout.tsx` | Added `<ScrollReset />` to root layout |

---

### Phase 4.51i — Homepage Copy, Notification Deep-Linking, Supabase Types & Maps Fix (January 2026)

**Goal:** Homepage copy updates, notification deep-linking for all notification types, Supabase type regeneration, and Google Maps link fix.

**Homepage Copy Updates:**

| Change | Details |
|--------|---------|
| New audience segment | Added "🌀 a fan of songs and songwriters" to "Join us if you're..." section |
| Live music venue | Changed "an open mic host or venue" → "an open mic host or live music venue" |
| Grid layout | Changed from 4 to 5 columns to accommodate new item |

**Notification Deep-Linking:**

All notification types now include hash anchors so users land directly on the relevant content:

| Notification Type | Deep-Link Target |
|-------------------|------------------|
| Event RSVP | `#attendees` |
| Event Comment | `#comments` |
| Timeslot Claim | `#lineup` |
| Gallery Photo Comment | `#comments` |
| Gallery Album Comment | `#comments` |
| Blog Comment | `#comments` |
| Profile Comment | `#comments` |
| Waitlist Offer | `#rsvp` |

**Anchor IDs Added to Components:**

| Component | Anchor ID |
|-----------|-----------|
| `TimeslotSection.tsx` | `id="lineup"` |
| `RSVPSection.tsx` | `id="rsvp"` |
| `BlogComments.tsx` | `id="comments"` |
| `GalleryComments.tsx` | `id="comments"` |
| `ProfileComments.tsx` | `id="comments"` |

**Supabase Type Regeneration:**

- Regenerated `database.types.ts` with `event_watchers` table now included
- Removed all `(supabase as any)` type casts from:
  - `app/api/events/[id]/watch/route.ts`
  - `app/api/events/[id]/rsvp/route.ts`
  - `app/api/events/[id]/comments/route.ts`
  - `app/api/guest/rsvp/verify-code/route.ts`
  - `app/api/guest/event-comment/verify-code/route.ts`
  - `app/events/[id]/page.tsx`
- Updated test documentation in `phase4-51d-union-fanout-watch.test.ts`

**Google Maps Link Fix:**

Fixed "Get Directions" button not appearing when event had `venue_id` but NULL `venue_address`:

| Before | After |
|--------|-------|
| Only fetched venue if `venue_name` was NULL | Fetches venue if `venue_name` OR `venue_address` is NULL |
| Events with name but no address showed no maps link | Maps link now appears for all events with venue |

**Files Modified:**

| File | Change |
|------|--------|
| `app/page.tsx` | Homepage copy updates |
| `app/events/[id]/page.tsx` | Venue fetch fix, type cast removal |
| `app/api/guest/timeslot-claim/verify-code/route.ts` | `#lineup` deep-link |
| `app/api/guest/gallery-*/verify-code/route.ts` | `#comments` deep-links |
| `app/api/guest/blog-comment/verify-code/route.ts` | `#comments` deep-links |
| `app/api/guest/profile-comment/verify-code/route.ts` | `#comments` deep-links |
| `lib/waitlistOffer.ts` | `#rsvp` deep-link |
| `components/events/TimeslotSection.tsx` | Added `id="lineup"` |
| `components/events/RSVPSection.tsx` | Added `id="rsvp"` |
| `components/blog/BlogComments.tsx` | Added `id="comments"` |
| `components/gallery/GalleryComments.tsx` | Added `id="comments"` |
| `components/comments/ProfileComments.tsx` | Added `id="comments"` |
| `lib/supabase/database.types.ts` | Regenerated with event_watchers |

---

### Phase 4.51h — Featured Blog Posts + Homepage Layout (January 2026)

**Goal:** Allow admin to feature a blog post on the homepage, creating a 4-card layout for the blog section.

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| Featured blog toggle | Admin can mark one blog post as "featured" (only one at a time) |
| Homepage 4-card layout | Featured post + 2 latest non-featured posts + Share Your Story CTA |
| Featured badge | ★ Featured badge displayed on featured post cards |
| Auto-unfeaturing | When featuring a post, all others are automatically unfeatured |

**Database Migration (`20260110100000_add_blog_featured.sql`):**

| Table | Changes |
|-------|---------|
| `blog_posts` | Added `is_featured` boolean column (default false) |
| Index | Added partial index on `is_featured WHERE is_featured = true` |

**Files Modified:**

| File | Change |
|------|--------|
| `app/(protected)/dashboard/admin/blog/BlogPostsTable.tsx` | Added Featured column with toggle button |
| `app/(protected)/dashboard/admin/blog/page.tsx` | Added `is_featured` to query select |
| `app/page.tsx` | Separate queries for featured + latest, 4-column grid layout |

**Homepage Blog Section Logic:**
1. Query featured blog post (if any)
2. Query latest 2 non-featured, published posts
3. Combine: featured first (if exists) + latest posts
4. Display in 4-column grid with Share Your Story CTA as final card

---

### Phase 4.51g — Guest Timeslot Claim Confirmation Emails (January 2026)

**Goal:** Send proper confirmation emails to guests who claim timeslots, and fix host notification messaging.

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| Guest confirmation email | Sent to guest after successful timeslot claim |
| Host notification email | Properly says "signed up for slot X" (not "left a comment") |
| Cancel link | Guest confirmation includes cancel URL |
| Slot details | Shows slot number, time, venue, event info |

**New Email Templates:**

| Template | Path | Purpose |
|----------|------|---------|
| timeslotClaimConfirmation | `lib/email/templates/timeslotClaimConfirmation.ts` | Confirmation sent to guest after claim |
| timeslotSignupHostNotification | `lib/email/templates/timeslotSignupHostNotification.ts` | Notification to host when someone claims slot |

**Files Modified:**

| File | Change |
|------|--------|
| `app/api/guest/timeslot-claim/verify-code/route.ts` | Uses new email templates, added helper functions |

**Guest Confirmation Email Contents:**
- Performer name greeting
- Slot number and time
- Event title, date, time
- Venue name and address
- Link to event page
- Cancel booking link

**Host Notification Email Contents:**
- Performer name with "(guest)" label if applicable
- Slot number and time
- Event title
- "View Lineup" button
- Notification preference reminder

---

### Phase 4.51f — Guest Comments Everywhere + Guest Timeslot Claiming (January 2026)

**Goal:** Enable guest commenting (with email verification) on all content types: gallery photos, gallery albums, blog posts, and member profiles. Also enable guests to claim timeslots at events.

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| Guest gallery photo comments | Email verification → comment creation → notify uploader |
| Guest gallery album comments | Email verification → comment creation → notify album owner |
| Guest blog comments | Email verification → comment creation → notify blog author |
| Guest profile comments | Email verification → comment creation → notify profile owner |
| Guest timeslot claiming | Email verification → slot claim → notify event host |
| Reply notifications | Parent comment author notified when guest replies |
| Shared GuestCommentForm | Reusable component for all guest comment flows |

**Database Migration (`20260108100000_guest_comments_everywhere.sql`):**

| Table | Changes |
|-------|---------|
| `gallery_photo_comments` | Added `guest_name`, `guest_email`, `guest_verified`, `guest_verification_id`; made `user_id` nullable |
| `gallery_album_comments` | Added `guest_name`, `guest_email`, `guest_verified`, `guest_verification_id`; made `user_id` nullable |
| `blog_comments` | Added `guest_name`, `guest_email`, `guest_verified`, `guest_verification_id`; made `author_id` nullable |
| `profile_comments` | Added `guest_name`, `guest_email`, `guest_verified`, `guest_verification_id`; made `author_id` nullable |
| `guest_verifications` | Added `gallery_image_id`, `gallery_album_id`, `blog_post_id`, `profile_id` target columns |
| `guest_verifications` | Extended `valid_action_type` constraint to include new action types |

**New API Endpoints:**

| Endpoint | Purpose |
|----------|---------|
| `POST /api/guest/gallery-photo-comment/request-code` | Request verification for photo comment |
| `POST /api/guest/gallery-photo-comment/verify-code` | Verify & create photo comment |
| `POST /api/guest/gallery-album-comment/request-code` | Request verification for album comment |
| `POST /api/guest/gallery-album-comment/verify-code` | Verify & create album comment |
| `POST /api/guest/blog-comment/request-code` | Request verification for blog comment |
| `POST /api/guest/blog-comment/verify-code` | Verify & create blog comment |
| `POST /api/guest/profile-comment/request-code` | Request verification for profile comment |
| `POST /api/guest/profile-comment/verify-code` | Verify & create profile comment |
| `POST /api/guest/timeslot-claim/request-code` | Request verification for timeslot claim |
| `POST /api/guest/timeslot-claim/verify-code` | Verify & create timeslot claim |

**New Components:**

| Component | Path | Purpose |
|-----------|------|---------|
| GuestCommentForm | `components/comments/GuestCommentForm.tsx` | Shared guest comment UI with email verification flow |
| GuestTimeslotClaimForm | `components/events/GuestTimeslotClaimForm.tsx` | Guest timeslot claim UI with verification |

**Files Modified:**

| File | Change |
|------|--------|
| `lib/email/templates/contentCommentNotification.ts` | Added "event" content type |
| `lib/email/templates/verificationCode.ts` | Added new verification purposes |
| `components/comments/CommentThread.tsx` | Guest comment support via `guestCommentType` prop |
| `components/blog/BlogComments.tsx` | Integrated GuestCommentForm for logged-out users |
| `components/events/TimeslotSection.tsx` | Guest timeslot claiming UI |

**Notification Flow:**

| Trigger | Recipient | Notification Type |
|---------|-----------|-------------------|
| Guest comments on photo | Photo uploader | `gallery_comment` |
| Guest comments on album | Album owner | `gallery_comment` |
| Guest comments on blog | Blog author | `blog_comment` |
| Guest comments on profile | Profile owner | `profile_comment` |
| Guest claims timeslot | Event host | `event_signup` |
| Guest replies to comment | Parent comment author | Same type as parent |

**Type Casting Note:**

New database columns (`gallery_image_id`, `gallery_album_id`, `blog_post_id`, `profile_id`, `guest_*` columns) are not yet in generated Supabase types. All routes use `(supabase as any)` type casts until types are regenerated.

**Build Status:** Passing. Migration must be applied with `npx supabase db push` before deploy.

---

### Phase 4.51e — Notification Management UX (January 2026)

**Goal:** Add full notification management for users who may accumulate hundreds/thousands of notifications.

**Features:**

| Feature | Implementation |
|---------|----------------|
| Type filtering | Dropdown to filter by notification type (RSVPs, Comments, Waitlist, etc.) |
| Unread only toggle | Checkbox to show only unread notifications |
| Mark all read | Bulk action to mark all notifications as read |
| Delete read | Bulk action to delete all read notifications |
| Delete older than 30 days | Bulk action to clean up old notifications |
| Cursor pagination | Load more button with server-side pagination |
| Total/unread counts | Shows total count and unread count in header |
| Email preferences link | Direct link to `/dashboard/settings` for email preference management |
| Dashboard link | "Manage all →" link always visible in dashboard notification widget |

**Comment Notification Title Fix:**

Comment notifications now show who made the comment instead of generic "New comment on...":
- Member comments: `"{name} commented on "{event}""` or `"{name} replied to your comment"`
- Guest comments: `"{name} (guest) commented on "{event}""`

**Type Cast Fix:**

Fixed intermittent query failures for `event_watchers` table:
- Changed from `.from("event_watchers" as "events")` aggressive cast
- To `(supabase as any).from("event_watchers")` simple cast (matches working routes)

**Files Changed:**

| File | Change |
|------|--------|
| `app/api/notifications/route.ts` | Added cursor pagination, type filter, DELETE endpoint |
| `dashboard/notifications/NotificationsList.tsx` | Complete rewrite with filters, pagination, bulk actions |
| `dashboard/notifications/page.tsx` | Added initialCursor and initialTotal props |
| `dashboard/page.tsx` | "Manage all →" link always visible |
| `app/api/events/[id]/comments/route.ts` | Comment notification title shows commenter name |
| `app/api/guest/event-comment/verify-code/route.ts` | Guest comment notification title shows name |
| `app/api/guest/rsvp/verify-code/route.ts` | Fixed type cast for event_watchers query |
| `app/api/events/[id]/watch/route.ts` | Fixed type cast for event_watchers queries |

**Email Preferences Coverage:**

Verified the 3 email preference categories cover all notification types:

| Category | Templates |
|----------|-----------|
| `claim_updates` | eventClaimSubmitted, eventClaimApproved, eventClaimRejected |
| `event_updates` | eventReminder, eventUpdated, eventCancelled, rsvpConfirmation, waitlistPromotion, eventCommentNotification, rsvpHostNotification, occurrenceCancelledHost, occurrenceModifiedHost |
| `admin_notifications` | adminEventClaimNotification, contactNotification |

**Test Coverage:** All 1281 tests passing.

**Data Seeding (One-Time):**

Seeded default open mic image to 97 events without cover images:
- Image URL: Supabase signed URL (expires 2036)
- All 105 events now have `cover_image_url` set

**HappeningCard Image Fix:**

Changed Tier 2 image rendering from blurred letterbox to standard cover:
- Removed blur background effect (`filter: blur(12px) brightness(0.7)`)
- Changed `object-contain` to `object-cover` (fills card, crops if needed)
- Now consistent with Tier 1 and Tier 3 rendering

**Image Cropping Alignment (object-top):**

Added `object-top` to all image displays so cropping shows top of image (cuts bottom):
- HappeningCard: All 3 tiers (card image, cover image, default image)
- EventCard: Deprecated but updated for consistency
- ImageUpload: Preview thumbnail matches card display
- This preserves faces/heads in photos with people

**Empty Time Field Error Fix:**

Fixed "invalid input syntax for type time: ''" error when using "Use Original Image":
- PATCH `/api/my-events/[id]` now converts empty strings to null for time fields
- Affected fields: `start_time`, `end_time`
- Root cause: PostgreSQL time type cannot accept empty string ""

---

### Phase 4.51d — Union Fan-out + Admin Watch/Unwatch (January 2026)

**Goal:** Change notification fan-out from fallback pattern to union pattern, and add admin-only Watch/Unwatch button.

**Problem: Admin not receiving notifications for events they watch**

When admin was in `event_watchers` for an event that also had a `host_id` set, the admin didn't receive notifications. The fan-out pattern was `hosts OR watchers (fallback)` - watchers were only notified when no hosts existed.

**Fix:** Changed to union pattern with deduplication:
- Fan-out order: `event_hosts` ∪ `events.host_id` ∪ `event_watchers` (union with dedupe)
- All three sources are checked regardless of whether previous sources had entries
- Uses `Set<string>` to deduplicate (user in multiple categories gets ONE notification)
- Actor suppression preserved (don't notify the person who triggered the action)

**Admin Watch/Unwatch Feature:**
- New API endpoint: `GET/POST/DELETE /api/events/[id]/watch`
- GET: Check if current user is watching (returns `{ watching: boolean }`)
- POST: Add watcher (admin-only, returns 403 for non-admins)
- DELETE: Remove watcher (any authenticated user)
- New `WatchEventButton` client component
- Button appears in admin section of event detail page

**Files Changed:**

| File | Change |
|------|--------|
| `app/api/events/[id]/rsvp/route.ts` | Union fan-out for member RSVP notifications |
| `app/api/guest/rsvp/verify-code/route.ts` | Union fan-out for guest RSVP notifications |
| `app/api/events/[id]/comments/route.ts` | Union fan-out for member comment notifications |
| `app/api/guest/event-comment/verify-code/route.ts` | Union fan-out for guest comment notifications |
| `app/api/events/[id]/watch/route.ts` | NEW: Watch API endpoint (GET/POST/DELETE) |
| `components/events/WatchEventButton.tsx` | NEW: Admin-only watch toggle button |
| `app/events/[id]/page.tsx` | Watcher status query + WatchEventButton |
| `__tests__/phase4-51d-union-fanout-watch.test.ts` | 37 tests for fan-out, dedupe, watch API |

**Type Cast Note:** `event_watchers` table exists but not in generated TypeScript types. Uses `(supabase as any).from("event_watchers")` type cast in all files that query it (fixed in Phase 4.51e).

**Test Coverage:** 37 new tests.

**Commit:** `859e42f`

---

### Phase 4.51c — Guest-First CTA + Guest RSVP Notifications + Functional Notifications (January 2026)

**Goal:** Improve guest RSVP discoverability, fix missing host/watcher notifications for guest RSVPs, and add functional notification controls.

**Problem 1: Guest RSVP CTA was not discoverable**

When logged out, the prominent "RSVP Now" button redirected to `/login`, while the guest RSVP option was a small text link below that users missed.

**Fix:** Guest-first CTA pattern when logged out:
- Primary button: "RSVP as Guest" (same styling as member button)
- Secondary link: "Have an account? Log in" (subtle text below)
- When logged in: "RSVP Now" unchanged

**Problem 2: Guest RSVPs didn't notify hosts/watchers**

Guest RSVP verify-code endpoint created the RSVP but did NOT send any host/watcher notifications. Member RSVPs did.

**Fix:** Added `notifyHostsOfGuestRsvp()` to guest verify-code endpoint:
- Uses EXACT same notification type (`"event_rsvp"`) as member RSVP
- Uses EXACT same templateKey (`"rsvpHostNotification"`) as member RSVP
- Fan-out order: `event_hosts` → `events.host_id` → `event_watchers` (fallback)
- Guest name includes "(guest)" label in notification title/message

**Problem 3: RSVP and Comment notifications looked identical**

Both notification types displayed the same default bell icon (🔔), making it impossible to distinguish them at a glance.

**Fix:** Added distinct emoji icons per notification type:
- `event_rsvp` → ✅ (checkmark)
- `event_comment` → 💬 (speech bubble)
- `waitlist_promotion` → 🎉 (celebration)
- Default → 🔔 (bell)

**Problem 4: Notifications had no user controls**

Notifications auto-marked as read on mount, no way to mark all read, no way to filter read/unread, and no deep-links to specific sections.

**Fix:** Functional notification controls:
- **Click to mark read:** Notifications only mark as read when clicked (removed auto-mark on mount)
- **Mark all read:** Button to mark all unread notifications as read with optimistic UI
- **Hide read toggle:** Client-side filter to show only unread notifications
- **Deep-links:** RSVP notifications link to `#attendees`, Comment notifications link to `#comments`

**Files Changed:**

| File | Change |
|------|--------|
| `components/events/RSVPButton.tsx` | Guest-first CTA when logged out |
| `app/api/guest/rsvp/verify-code/route.ts` | Host/watcher notification logic + `#attendees` deep-link |
| `app/api/events/[id]/rsvp/route.ts` | RSVP notification link includes `#attendees` |
| `dashboard/notifications/NotificationsList.tsx` | Distinct icons, mark-on-click, mark-all, hide-read |
| `components/events/AttendeeList.tsx` | Added `id="attendees"` anchor for deep-linking |
| `__tests__/phase4-51c-guest-rsvp-discoverability.test.ts` | 17 tests for guest-first CTA |
| `__tests__/phase4-51c-guest-rsvp-notifications.test.ts` | 19 tests for notification parity |
| `__tests__/notification-icons.test.ts` | 14 tests for distinct icons |
| `__tests__/notification-interactions.test.ts` | 21 tests for functional controls |

**Test Coverage:** 71 new tests (17 CTA + 19 notifications + 14 icons + 21 interactions).

**Commits:**
- `34d8d69` — Guest-first CTA (Phase 4.51c)
- `544336c` — Guest RSVP host/watcher notifications
- `81b9fe5` — Distinct icons for RSVP vs Comment notifications
- `cc01914` — Functional notifications (mark-on-click, mark-all, hide-read, deep-links)

---

### Phase 4.51b — Guest Verification Always-On + Hotfixes (January 2026)

**Goal:** Remove feature flag gating from guest endpoints. Guest RSVP + Guest Comments work in Production by default with zero manual Vercel env vars.

**Key Change:** Guest verification is now **always enabled**. No `ENABLE_GUEST_VERIFICATION` env var required.

**Emergency Kill Switch (if needed):**
- Set `DISABLE_GUEST_VERIFICATION=true` to disable guest verification
- Returns 503 (not 404) with clear message
- Only use for emergencies - guest features are core UX

**Health Endpoint:**
- `GET /api/health/guest-verification`
- Returns: `{ enabled: true, mode: "always-on", timestamp: "..." }`
- No authentication required

**Hotfix 1: Database Constraint (commit `1002d67`)**

Production guest comments were failing with 500 error:
```
new row for relation "guest_verifications" violates check constraint "valid_action_type"
```

**Root Cause:** Original constraint only allowed `('confirm', 'cancel')` but guest comments use `action_type = 'comment'`.

**Fix:** Migration `20260107000005_fix_guest_verification_action_type.sql` expands constraint:
```sql
CHECK (action_type IS NULL OR action_type IN ('confirm', 'cancel', 'comment', 'cancel_rsvp'))
```

**Hotfix 2: Alphanumeric Verification Codes (commit `7dd7b65`)**

Users could only type 1 character in verification code input.

**Root Cause:** Input used `/\D/g` regex (digits only) but codes contain letters (e.g., `5GGRYK`).

**Fix:** Changed to `/[^A-Za-z0-9]/g` regex with auto-uppercase. Updated placeholder from `000000` to `ABC123`.

**Hotfix 3: Context-Aware Verification Emails (commit `f2a774b`)**

Guest comment verification emails incorrectly said "claim a slot" instead of "post a comment".

**Fix:** Added `purpose` parameter to `getVerificationCodeEmail()` template:
- `slot`: "claim a slot at" (default)
- `rsvp`: "RSVP to"
- `comment`: "post a comment on"

**Hotfix 4: Guest Comments Notify Watchers (commit `68ef1e7`)**

Guest comments weren't notifying event watchers (only checked hosts).

**Fix:** Added event_watchers fallback to `/api/guest/event-comment/verify-code` notification flow.

**Hotfix 5: Notification Function Broken (commit `1a6db3f`)**

ALL dashboard notifications were silently failing with "type notifications does not exist".

**Root Cause:** `create_user_notification` function had `SET search_path TO ''` (empty), so it couldn't resolve the `public.notifications` type.

**Fix:** Migration `20260108000001_fix_notification_function_search_path.sql`:
```sql
SET search_path TO 'public'  -- was ''
```

This affected ALL 5 places that create notifications:
- `sendWithPreferences.ts` (comments, RSVPs, etc.)
- `waitlistOffer.ts`
- `invitations/[id]/route.ts`
- `my-events/[id]/route.ts`
- `my-events/[id]/cohosts/route.ts`

**Files Changed:**

| File | Change |
|------|--------|
| `lib/guest-verification/config.ts` | Renamed to `isGuestVerificationDisabled()`, 503 response, relaxed rate limits |
| `app/api/guest/*/route.ts` | Updated to use kill switch (7 files) |
| `app/api/health/guest-verification/route.ts` | NEW health endpoint |
| `migrations/20260107000005_fix_guest_verification_action_type.sql` | Expanded valid_action_type constraint |
| `migrations/20260108000001_fix_notification_function_search_path.sql` | Fixed search_path |
| `components/events/EventComments.tsx` | Alphanumeric code input fix |
| `components/events/RSVPButton.tsx` | Alphanumeric code input fix |
| `lib/email/templates/verificationCode.ts` | Added `purpose` parameter |
| `app/api/guest/event-comment/request-code/route.ts` | Pass `purpose: "comment"` |
| `app/api/guest/rsvp/request-code/route.ts` | Pass `purpose: "rsvp"` |
| `app/api/guest/event-comment/verify-code/route.ts` | Added watcher fallback |
| `__tests__/phase4-51b-guest-always-on.test.ts` | 22 tests for always-on behavior |
| `docs/SMOKE-PROD.md` | Added smoke tests #13, #14, #15 |

**Test Coverage:** 22 new tests proving guest endpoints work without any env var set.

**Debugging Note:** These issues were diagnosed using direct Vercel API access (build logs, deployment status) and production database queries via psql. See "Vercel API Access" section above.

**Known Issue (Deferred):** 60 files use `supabase.auth.getSession()` which Supabase warns is insecure (reads from cookies without server verification). Should migrate to `supabase.auth.getUser()` for sensitive operations. This is a larger refactor to be planned separately.

---

### Phase 4.51a — Event Watchers (January 2026)

**Goal:** Notification backstop for unowned events using a "watcher" model.

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| `event_watchers` table | Composite PK `(event_id, user_id)` |
| Auto-cleanup trigger | Removes watchers when `host_id` assigned |
| Comment notifications | Falls back to watchers if no hosts |
| RSVP notifications (NEW) | Hosts/watchers notified on RSVP |
| Email template | `rsvpHostNotification.ts` created |
| Backfill | Sami watching all 97 unowned events |

**Notification Fan-Out Order:**
1. `event_hosts` (accepted hosts)
2. `events.host_id` (legacy host)
3. `event_watchers` (fallback only when no hosts exist)

**Key Files:**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260107000004_event_watchers.sql` | Schema + trigger + backfill |
| `app/api/events/[id]/comments/route.ts` | Watcher fallback for comments |
| `app/api/events/[id]/rsvp/route.ts` | Host/watcher RSVP notifications |
| `lib/email/templates/rsvpHostNotification.ts` | RSVP notification email |
| `lib/notifications/preferences.ts` | Added rsvpHostNotification mapping |
| `__tests__/phase4-51a-event-watchers.test.ts` | 25 tests |

**Test Coverage:** 25 tests covering schema, fan-out logic, auto-cleanup, and RLS policies.

---

### Phase 4.50b — Past Tab Fix (January 2026)

**Goal:** Fix Happenings "Past" tab showing 0 events.

**Root Cause:** Occurrence expansion and overrides query used hardcoded forward-looking window (`today → today+90`) regardless of `timeFilter`.

**Solution:**

| Change | Implementation |
|--------|----------------|
| Date-aware windows | Window bounds depend on timeFilter (upcoming/past/all) |
| MIN(event_date) query | Past/all modes query earliest event_date for window start |
| Progressive loading | Past mode uses chunked loading (90 days per chunk) |
| Past ordering | DESC (newest-first) instead of ASC |
| Dynamic label | `(next 90 days)` / `(past events)` / `(all time)` |
| DateJumpControl | Now supports past date selection |

**Window Bounds by Mode:**

| Mode | Window Start | Window End |
|------|--------------|------------|
| `upcoming` | today | today+90 |
| `past` | yesterday-90 (or minEventDate) | yesterday |
| `all` | minEventDate | today+90 |

**Key Files:**

| File | Change |
|------|--------|
| `app/happenings/page.tsx` | Window calculation, MIN query, progressive loading, ordering, label |
| `components/happenings/StickyControls.tsx` | New props: `windowStartKey`, `timeFilter` |
| `components/happenings/DateJumpControl.tsx` | Support for past date selection |
| `__tests__/phase4-50b-past-tab-fix.test.ts` | 19 new tests |

**Test Coverage:** 19 new tests covering window bounds, ordering, dynamic labels, progressive loading, and DateJumpControl.

---

### Phase 4.49b — Event Comments Everywhere (January 2026)

**Goal:** Enable comments on ALL event pages (DSC + community) with guest support and notifications.

**Key Features:**

| Feature | Implementation |
|---------|----------------|
| Comments on all events | Removed DSC-only gate from `/api/events/[id]/comments` |
| Guest comment support | Email verification flow via request-code/verify-code endpoints |
| Host notifications | Dashboard + email when someone comments on their event |
| Reply notifications | Dashboard + email when someone replies to your comment |
| Threaded display | 1-level threading with reply forms inline |

**Schema Changes (Migration `20260107000002`):**

| Change | Details |
|--------|---------|
| `user_id` nullable | Guest comments have `user_id = null` |
| `guest_name` | Display name for guest commenters |
| `guest_email` | Private, used for verification |
| `guest_verified` | Whether email was verified |
| `guest_verification_id` | FK to `guest_verifications` |
| `is_deleted` | Soft delete for moderation |
| CHECK constraint | Must have `user_id` OR `(guest_name AND guest_email)` |

**Key Files:**

| File | Purpose |
|------|---------|
| `supabase/migrations/20260107000002_event_comments_guest_support.sql` | Schema changes |
| `app/api/events/[id]/comments/route.ts` | GET/POST with notifications |
| `app/api/guest/event-comment/request-code/route.ts` | Guest verification request |
| `app/api/guest/event-comment/verify-code/route.ts` | Guest verification + comment creation |
| `lib/email/templates/eventCommentNotification.ts` | Email template |
| `components/events/EventComments.tsx` | UI with threading + guest form |
| `app/events/[id]/page.tsx` | Mounted EventComments component |

**Notification Flow:**

| Trigger | Recipients | Category |
|---------|------------|----------|
| Top-level comment | Event host(s) | `event_updates` |
| Reply | Parent comment author | `event_updates` |
| Guest comments | No notifications (verification email only) | — |

**Test Coverage:** 34 new tests in `__tests__/phase4-49b-event-comments.test.ts`

---

### Phase 4.48c — AttendeeList FK Fix (January 2026)

**Goal:** Fix FK relationship hint for AttendeeList user profile lookups.

**Problem:** AttendeeList was failing to fetch user profiles due to incorrect FK hint.

**Solution:** Updated PostgREST FK hint from generic to explicit `!event_rsvps_user_id_fkey`.

---

### Phase 4.48b — Guest RSVP Support (January 2026)

**Goal:** Allow guests to RSVP to events without an account via email verification.

**Key Features:**
- Guest RSVP via email verification (6-digit code)
- Reuses `guest_verifications` table pattern
- Guest RSVPs appear in AttendeeList with "(guest)" label
- Cancel link sent via email for guest RSVPs

---

### Phase 4.47 — Performer Slots Opt-In + Value Framing (January 2026)

**Goal:** Make performer slots fully opt-in for ALL event types — no auto-enable based on event type.

**Key Decisions:**

| Decision | Implementation |
|----------|----------------|
| No auto-enable | Removed `TIMESLOT_EVENT_TYPES` constant and all references |
| Default state | ALL event types start with `has_timeslots: false` |
| Manual opt-in | Host must explicitly toggle to enable performer slots |
| Value framing | When slots are OFF, show benefits to encourage opt-in |

**What Was Removed:**
- `TIMESLOT_EVENT_TYPES` export from SlotConfigSection
- `useEffect` that auto-enabled timeslots based on eventType in EventForm
- Auto-notification UI ("Performer slots auto-enabled for Open Mic")
- `timeslotsAutoEnabled` state and `previousEventTypeRef` ref

**Value Framing Copy (when slots are OFF):**
> **Enable performer slots to:**
> - Let performers sign up in advance
> - Get automatic lineup management
> - Reduce day-of coordination
>
> *You can turn this on or off anytime.*

**Key Files:**

| File | Change |
|------|--------|
| `dashboard/my-events/_components/SlotConfigSection.tsx` | Removed TIMESLOT_EVENT_TYPES, added value framing copy |
| `dashboard/my-events/_components/EventForm.tsx` | Removed import, useEffect, auto-notification UI |
| `__tests__/phase4-47-performer-slots-opt-in.test.ts` | 6 new tests |

**Test Coverage:** 6 new tests covering no auto-enable behavior, value framing copy, and manual opt-in requirement.

---

### Phase 4.46 — Join & Signup UX Spotlight (January 2026)

**Goal:** Make "Join & Signup" the star differentiator vs Meetup with clear RSVP + performer slots presentation.

**Changes:**

| Feature | Implementation |
|---------|----------------|
| Section header | "🎤 Join & Signup" with descriptive subtitle |
| Audience RSVP | Always visible subsection with "Always Available" badge |
| Performer Slots | Optional subsection with explicit "Optional" badge + toggle |
| Mini preview | Shows what attendees will see (RSVP + slots if enabled) |
| Custom location copy | Now explicitly says "(this event only)" everywhere |
| Venue wrong? link | Non-admin: mailto / Admin: link to `/dashboard/admin/venues` |

**Key Files:**

| File | Change |
|------|--------|
| `components/ui/VenueSelector.tsx` | Custom location dropdown text updated |
| `dashboard/my-events/_components/EventForm.tsx` | Custom location header + helper text + "Venue wrong?" link |
| `dashboard/my-events/_components/SlotConfigSection.tsx` | Restructured as "Join & Signup" section with mini preview |
| `__tests__/phase4-46-join-signup-ux.test.tsx` | 13 new tests |
| `docs/investigation/phase4-46-join-signup-ux-spotlight.md` | Investigation document |

**Mini Preview Shows:**
- "✓ RSVP Available (unlimited)" or "✓ RSVP Available (X spots)"
- "🎤 N performer slots (M min each)" — only when enabled

**Test Coverage:** 13 new tests covering custom location copy, venue wrong link behavior, section structure, mini preview content, and authorization.

---

### Phase 4.45b — Venue Selector UX Improvements (January 2026)

**Goal:** Improve venue dropdown UX by moving action items to top and fixing RLS mismatch.

**Problems Fixed:**

1. **Action items buried at bottom** — With 65+ venues, "Add new venue" and "Enter custom location" were at the bottom of a long scrollable list
2. **RLS mismatch** — VenueSelector allowed any user to try creating venues, but RLS blocked non-admins (silent failure)
3. **No venue issue reporting** — Users had no way to report incorrect venue data

**Solution:**

| Change | Implementation |
|--------|----------------|
| Reorder dropdown | Actions at TOP: placeholder → + Add new venue → ✎ Enter custom location → separator → venues A-Z |
| Authorization gate | `canCreateVenue` prop controls "Add new venue" visibility (admin-only) |
| Helper text | Non-admins see: "Can't find your venue? Use Custom Location for one-time or approximate locations." |
| Report link | "Report a venue issue" mailto link for non-admins |
| Microcopy | New venue form shows "Creates a reusable venue for future events" |

**Key Files:**

| File | Change |
|------|--------|
| `components/ui/VenueSelector.tsx` | Reordered dropdown, added `canCreateVenue` prop, helper text, microcopy |
| `dashboard/my-events/_components/EventForm.tsx` | Added `canCreateVenue` prop, passes to VenueSelector |
| `dashboard/my-events/new/page.tsx` | Passes `canCreateVenue={isAdmin}` |
| `dashboard/my-events/[id]/page.tsx` | Passes `canCreateVenue={isAdmin}` |
| `__tests__/venue-selector-phase445b.test.tsx` | 17 new tests for Phase 4.45b |
| `docs/investigation/phase4-45a-venue-dropdown-location-workflow.md` | Investigation document |

**Authorization Matrix:**

| Role | Can Create Venue | Can Use Custom Location |
|------|------------------|-------------------------|
| Admin | Yes | Yes |
| Approved Host | No | Yes |
| Member | No | Yes |

**Deferred (Future Phases):**
- Venue lat/lng columns (schema migration)
- Map picker UI
- Geocoding integration
- Combobox refactor (searchable dropdown)

**Test Coverage:** 17 new tests covering dropdown order, authorization, helper text visibility, and venue vs custom location distinction.

---

### Phase 4.44c — Event Form UX Improvements (January 2026)

**Goal:** Improve event creation UX with intent-first form structure and progressive disclosure.

**Changes:**

| Feature | Implementation |
|---------|----------------|
| Intent-first ordering | Form sections reordered: Type → Title → Schedule → Location → Description/Cover → Attendance → Advanced → Publish |
| Auto-timeslot notification | Inline alert below Event Type when switching to open_mic/showcase: "Performer slots enabled" |
| Progressive disclosure | Advanced Options section collapsed by default, expands on click |
| Preview draft link | Edit page shows "Preview as visitor →" for unpublished events |

**Key Files:**

| File | Change |
|------|--------|
| `EventForm.tsx` | Restructured section order, added `showAdvanced` state, auto-timeslot detection |
| `dashboard/my-events/[id]/page.tsx` | Added "Preview as visitor" link for draft events |
| `__tests__/event-form-ux-phase444c.test.tsx` | 17 new tests for form UX contract |
| `docs/SMOKE-PROD.md` | Added Phase 4.44c smoke test section |

**Advanced Section Contents:**
- Timezone
- Cost (is_free, ticket_price)
- External Signup URL
- Age Policy
- DSC Toggle (for approved hosts only)
- Host Notes

**Test Coverage:** 17 new tests covering form order, auto-timeslot logic, advanced collapse, and preview link visibility.

---

### Phase 4.43c/d — RSVP for All Public Events (January 2026) — CLOSED

**Goal:** Enable RSVP for ALL public events, not just DSC events.

**Problem:** RSVPSection and AttendeeList were gated by `is_dsc_event`. All seeded/community open mics have `is_dsc_event=false`, so RSVP never appeared for them. Additionally, `/open-mics/[slug]` had no RSVP UI at all.

**Solution (Phase 4.43c):** Removed `is_dsc_event` gates:
- RSVPSection now renders for any `canRSVP` event (published, not cancelled, not past)
- AttendeeList renders for all events (component handles empty state internally)
- RSVP API accepts RSVPs for all public events

**Solution (Phase 4.43d):** All events redirect from `/open-mics/[slug]` to `/events/[id]`:
- `/open-mics/[slug]` serves as the slug entrypoint for legacy URLs and SEO
- `/events/[id]` is the canonical detail page with RSVP, attendee list, etc.

**Key Changes:**

| File | Change |
|------|--------|
| `app/events/[id]/page.tsx` | Removed `is_dsc_event` gate from RSVPSection (line 678) and AttendeeList (line 749) |
| `app/api/events/[id]/rsvp/route.ts` | Removed `is_dsc_event` restriction from RSVP API |
| `app/open-mics/[slug]/page.tsx` | Simplified to redirect-only (~300 lines removed) |
| `__tests__/phase4-43-rsvp-always.test.ts` | 13 new tests for Phase 4.43c |
| `__tests__/open-mics-redirect.test.ts` | 12 new tests for redirect behavior |

**What Remains DSC-Only:**
- HostControls (host management features)
- TimeslotSection (performer signup slots)
- "No signup method" warning banner

**Verification:**
- Visit `/events/words-open-mic` → RSVP button visible for community open mic
- Visit `/open-mics/words-open-mic` → redirects to `/events/words-open-mic`
- All 979 tests passing

---

### Hotfix: Signup Flow Broken (January 2026)

**Goal:** Fix both Google OAuth and email signup silently failing with "no action taken" behavior.

**Root Causes:**

| Issue | Cause | Fix |
|-------|-------|-----|
| CSP blocking OAuth | `form-action 'self'` blocked redirects to Supabase/Google | Added Supabase + Google domains to form-action |
| Silent failures | No try/catch in auth functions; exceptions swallowed | Added error handling + user-visible error messages |
| **Missing DB function** | `generate_profile_slug` function not in production DB | Migration not applied; added `SECURITY DEFINER` to migration |

**Changes:**

| File | Change |
|------|--------|
| `next.config.ts` | Added `https://*.supabase.co https://*.supabase.in https://accounts.google.com` to CSP form-action |
| `lib/auth/google.ts` | Added try/catch, returns `{ ok, error }` result |
| `lib/auth/signUp.ts` | Added try/catch for exception handling |
| `lib/auth/magic.ts` | Added try/catch for exception handling |
| `app/signup/page.tsx` | Google button now displays errors to user |
| `app/login/page.tsx` | Google button now displays errors to user |
| `app/auth/callback/route.ts` | Added OAuth error param handling + debug logging |
| `migrations/20260103000001_add_profile_slug.sql` | Added `SECURITY DEFINER` to functions for auth context |

**Database Fix Applied:**

The profile slug migration was never applied to production. The trigger on `profiles` table called `generate_profile_slug()` which didn't exist, causing "Database error saving new user" on every signup attempt.

**Critical:** Functions called by auth triggers MUST use `SECURITY DEFINER` to run with elevated permissions.

```sql
-- Required pattern for functions called by auth triggers:
CREATE FUNCTION public.my_function(...)
RETURNS ... AS $$ ... $$
LANGUAGE plpgsql SECURITY DEFINER;
```

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
| `__tests__/venue-selector-phase445b.test.tsx` | Venue selector UX, authorization, dropdown order (17 tests) |
| `__tests__/phase4-46-join-signup-ux.test.tsx` | Join & Signup section, mini preview, custom location (13 tests) |
| `__tests__/phase4-49b-event-comments.test.ts` | Event comments everywhere, guest support, notifications (34 tests) |
| `__tests__/notification-icons.test.ts` | Distinct notification icons by type (14 tests) |
| `__tests__/notification-interactions.test.ts` | Notification controls: mark-on-click, mark-all, hide-read, deep-links (21 tests) |
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

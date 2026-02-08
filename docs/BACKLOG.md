# Product Backlog — Denver Songwriters Collective

> **This is the CANONICAL backlog.** All other TODO sources defer to this document.
>
> **Last Updated:** 2026-02-07
> **Next Milestone:** Invite ~20 Test Users (READY — see `docs/runbooks/invite-20-admin-runbook.md`)

---

## Document Audit Summary

| File | Purpose | Status |
|------|---------|--------|
| `docs/BACKLOG.md` | **CANONICAL** — All TODOs live here | ACTIVE |
| `docs/NORTH_STAR.md` | Long-term platform north star (multi-region + white-label) | ACTIVE |
| `docs/backlog/post-gtm-3-1-active-backlog.md` | Curated active queue view (index only) | ACTIVE (non-canonical) |
| `docs/backlog/DOCS_ALIGNMENT_RULES.md` | Canonicalization guardrails for backlog docs | ACTIVE |
| `docs/OPS_BACKLOG.md` | Ops Console features | DEPRECATED → merged here |
| `docs/DEFERRED-HIGH-PRIORITY.md` | Member profile enhancements | DEPRECATED → merged here |
| `docs/known-issues.md` | Bug tracking | ACTIVE (bugs only, no features) |
| `docs/future-specs/PLAN.md` | Dual-track strategy | ARCHIVED (long-term vision) |
| `CLAUDE.md` | Repo operations + recent changes | ACTIVE (operational, not backlog) |

---

## Milestone: Invite ~20 Test Users

### P0 — MUST FIX BEFORE INVITES

| Item | Status | Evidence | Owner |
|------|--------|----------|-------|
| **Nav search correctness + navigation** | DONE | Commits `a92613b`, `b5d0af8`, `2449fd6` | Sami |
| **Remove "Unconfirmed" badges from DSC TEST series** | DONE | Commit `04ca056` | Sami |
| **Sign-up link clarity ("Join us" → link)** | DONE | Commits `d4b4227`, `f6b2019` | Sami |
| **DSC TEST events appearing in happenings list** | DONE | Commits `58d5979`, `43f64e4` | Sami |
| **Role-Based Onboarding & Profile Personalization** | PLANNED | See detailed spec below | Sami |

### P1 — STRONGLY RECOMMENDED

| Item | Status | Evidence | Owner |
|------|--------|----------|-------|
| **Homepage hero text contrast** | DONE | Commit `dfe46d7` — 40% black overlay added | Sami |
| **Nav reorder: Members after Happenings** | DONE | Commit `dfe46d7` — Nav order: Happenings → Members → Venues | Sami |
| **Homepage CTA pills text update** | DONE | Commit `dfe46d7` — "See All Happenings" / "See Open Mics" | Sami |
| **Member pages basic completeness** | OPEN | See Member Pages section below | Sami |
| **[GROWTH-01] Community Invite / Referral Growth Loop (Phase 7B)** | PARTIAL DONE | 7B.1 share-first shipped; 7B.2 managed invite email deferred behind separate STOP-GATE (`docs/investigation/phase7b-community-invite-growth-stopgate.md`) | Sami |

### P2 — NICE TO HAVE

| Item | Status | Evidence | Owner |
|------|--------|----------|-------|
| **Visual polish pass** | OPEN | Minor UI refinements | — |

---

## P0 Spec: Role-Based Onboarding & Profile Personalization

**Priority:** P0 (Pre-Test User Readiness)
**Status:** Planned / Not Started

### Description

Add a role-selection step to signup onboarding that dynamically controls which onboarding fields, profile sections, and claim/approval flows are shown. Roles are NOT mutually exclusive and may be changed later.

This is a structural UX realignment to better support performers, hosts, venues, and fans without forcing irrelevant questions.

**Important:** This item must be completed BEFORE inviting external test users, but does NOT control or schedule test-user rollout. Sami explicitly controls when test users are invited.

### Onboarding Prompt (First Step)

> "How would you like to participate in the Collective?"
> (Select any that apply)

**Selectable Roles:**
- Songwriter / Performer
- Open Mic Host / Organizer
- Venue Manager
- Original Music Fan

### Rules

- Only name is required; all other onboarding fields remain optional
- Selected roles determine which subsequent onboarding fields appear
- Multiple roles merge fields (no duplication, no conflicts)
- Roles can be updated later in profile settings

### Role-Specific Behavior

| Role | Behavior |
|------|----------|
| **Songwriter / Performer** | Instruments, originals/covers, links, performance-oriented fields |
| **Open Mic Host / Organizer** | Prompt to claim or create an open mic → admin approval required |
| **Venue Manager** | Prompt to claim or accept venue invite → admin approval required |
| **Original Music Fan** | Fan-centric fields (genres followed, venues frequented, support style) |

### Approval & States

- Host/Venue selections create a "pending approval" state
- Admin receives notification email
- Profile displays "Pending approval" badge until approved
- Approval grants existing permissions (reuse current systems)

### Explicit Non-Goals

- No trust/reputation scoring
- No monetization changes
- No forced identity locking

### Deliverables

1. Investigation doc (audit current onboarding + profile schema)
2. Role → onboarding field matrix
3. Claim/approval state confirmation
4. UX spec for profile cards and badges
5. Implementation + tests

---

## P0 Spec: Member Profile Enhancements (Pre-Invite)

**Priority:** P0 (Pre-Test User Readiness)
**Status:** Investigation Complete — Awaiting Approval
**Investigation Doc:** `docs/investigation/phase-member-profile-enhancements.md`

### Summary

Polish member profiles before external test users see them. Three scope areas:

| Scope | Description | Status |
|-------|-------------|--------|
| **A: Quick Wins** | Badge unification, empty states, social links ordering | Investigation complete |
| **B: Profile Gallery** | Member-managed photos on profile (reuse gallery infra) | Investigation complete — DEFERRED (requires migration) |
| **C: Activity Sections** | Blog posts, photos, events by user | Investigation complete |

### PR Slice Order (Recommended)

| Slice | Scope | Description | Complexity |
|-------|-------|-------------|------------|
| 1 | A5 | Social Links Fix — Add Twitter, reorder to musician-centric | Low (1 file) |
| 2 | A1 | Badge Row Unification — Shared IdentityBadgeRow component | Low |
| 3 | A2 | Empty State Polish — Consistent empty states | Low |
| 4 | A3+A4 | Card/Detail Consistency + Fan Polish | Low |
| 5 | A6 | Canonicalization Audit — Verify redirects | Low |
| 6 | A8 | Profile Completeness Indicator | Low |
| 7 | C | Blog Posts Activity Section | Low |
| 8 | C | Photos Activity Section | Medium |

### DEFERRED Items

| Item | Reason |
|------|--------|
| Profile Gallery (B) | Requires DB migration for `album_type` column |
| Follow CTA (A7) | P2 — Not needed for initial test users |

### Next Step

**Slice 1: Social Links Fix** — Smallest change with immediate benefit.
- Single file: `components/profile/ProfileIcons.tsx`
- Fixes Twitter/X bug, reorders to Spotify → YouTube → Instagram first
- ~10 lines changed, 5 tests

---

## Completed Work (Ground Truth)

### Admin Operations: Social Links + Host Visibility (February 2026) — COMPLETE

| Item | Description | Status |
|------|-------------|--------|
| Global site social links persistence | Applied `site_settings.social_links` migration and enabled admin save path at `/dashboard/admin/site-social-links` | DONE |
| Admin host column parity | `/dashboard/admin/events` now resolves accepted hosts from `event_hosts` + `profiles` (not only `events.host_id`) | DONE |
| Build/type regression fix | Restored full event row typing in admin host normalization to satisfy production TypeScript build | DONE |

### Phase 5.07 — Venue Map Buttons (January 2026) — COMPLETE

| Item | Description | Status |
|------|-------------|--------|
| Two-button system | "Directions" + "Venue Page on Google Maps" buttons on event detail | DONE |
| Venue block layout | Three-line layout: Venue Name → Address+Buttons → Hosted by | DONE |
| Host avatar cards | Hosts displayed with profile pics and links | DONE |
| Override venue support | Buttons update when occurrence overrides change venue | DONE |
| Tests | 9 tests covering all button scenarios | DONE |

**Files Modified:** `app/events/[id]/page.tsx`, `__tests__/phase5-07-venue-map-buttons.test.ts`

### Phase 5.06 — UX Polish (January 2026) — COMPLETE

| Item | Description | Status |
|------|-------------|--------|
| City/State visibility | Fixed PostgREST alias from `venues` to `venue` for HappeningCard/SeriesCard | DONE |
| Monthly day-of-week edit | Added anchor date picker to edit mode for monthly series | DONE |
| Directions URL fix | Event detail now uses `getVenueDirectionsUrl()` for directions mode | DONE |
| Tests | 26 tests covering all goals | DONE |

**Investigation Doc:** `docs/investigation/phase5-06-ux-polish-stopgate.md`

### Phase 5.04 — Signup Time UX (January 2026) — PARTIALLY COMPLETE

| Item | Description | Status |
|------|-------------|--------|
| `signup_time` column | DB column exists for performer signup time display | DONE |
| API support | PATCH/POST routes handle `signup_time` field | DONE |
| **Form UI** | **Create/edit form input for signup_time** | **NOT IMPLEMENTED** |
| Public display | Event detail shows signup time when set | DONE |

**Note:** The `signup_time` field exists in the database and is displayed on event detail pages, but no form UI exists for hosts to set it during event creation/editing. This requires adding a time input to EventForm.tsx.

### Phase 5.03 — Occurrence Cancellation UX (January 2026) — COMPLETE

| Item | Description | Status |
|------|-------------|--------|
| Cancelled dates visible | Cancelled occurrences stay in UI with red styling + ✕ prefix | DONE |
| Restore button | "Restore" button for cancelled occurrences | DONE |
| Optimistic UI | Immediate feedback with server reconciliation | DONE |
| Public pages | Cancelled pills show with line-through + opacity | DONE |
| Tests | 17 tests covering all parts | DONE |

**Investigation Doc:** `docs/investigation/phase5-03-occurrence-cancellation-ux-stopgate.md`

### Phase 5.02 — Timeslots Host Dashboard (January 2026) — COMPLETE

| Item | Description | Status |
|------|-------------|--------|
| Future-only blocking | Only future claims block slot config changes | DONE |
| Future-only regeneration | Past timeslots preserved, only future regenerated | DONE |
| TimeslotClaimsTable | Host-visible claims management component | DONE |
| Date-scoped RSVPList | Date selector for recurring events | DONE |
| Actionable errors | Error messages with links to claims management | DONE |
| Tests | 28 tests covering all parts | DONE |

**Investigation Doc:** `docs/investigation/phase5-02-timeslots-rsvp-host-dashboard-stopgate.md`

### Public Changelog Page (January 2026) — DONE

| Item | Description | Status |
|------|-------------|--------|
| `/changelog` page | TypeScript-backed changelog with date, title, bullets, optional tags | DONE |
| Entry format | Each entry has ISO date, title, 1-3 bullets, optional tags (feature/fix/improvement) | DONE |
| Historical placement | Changelog link originally lived on Early Contributors thank-you page | DONE |
| Tests | 10 tests covering tag validation, entry format, link structure | DONE |

**Note:** Changelog is NOT linked from main navigation. Early Contributors routes were retired in Phase 7B.1b and now redirect to `/`.

### Early Contributors Testing Flow (January 2026) — DONE

| Item | Description | Status |
|------|-------------|--------|
| `/early-contributors` page | Role-based 20-minute mission chooser (Songwriter, Host, Venue, Visitor) | DONE (historical) |
| `/early-contributors/thanks` page | Post-feedback thank you page with navigation links | DONE (historical) |
| Feedback URL prefill | `/feedback` now accepts `category`, `subject`, `pageUrl` query params | DONE |
| Retirement | Early Contributors links removed from active UX; routes now redirect to homepage (`/`) | DONE |
| Tests | 18 tests covering mission structure, URL prefill, footer link, thanks page | DONE |

### Get Involved Page Polish (January 2026) — DONE

| Item | Description | Status |
|------|-------------|--------|
| Test Features → Feedback link | "Test Website Features" card now links to `/feedback` | DONE |
| Financial support CTA | "Support the Collective" button links to `/tip-jar` | DONE (already present) |
| Role framing | Ways to Help section covers: host events, find venues, update info, spread word, connect partners, test features | DONE |

### Phase 4.65–4.69 (January 2026) — Venue + Performance Fixes

| Item | Evidence | Commit/PR |
|------|----------|-----------|
| Series date routing + recurrence correctness | Tests pass | PR #108 (`532ccb8`) |
| Venue occurrence count alignment | Venue cards accurate | PR #110 (`dbf2063`) |
| DatePillRow + SeriesCard UI unification | Visual consistency | PR #111 (`e9eb189`) |
| Comments API parsing fix | Comments load correctly | `b761eca` |
| Venue cover image feature | Upload + display works | `f6554fa` + migration |
| Timeslot/RSVP performance scoping by date_key | <1s load time | `bebeadf` |

### Member Profile Quick Wins (January 2026) — RESOLVED

| Item | Description | Status |
|------|-------------|--------|
| Owner-only CTAs | "Edit profile" + "Manage photos" buttons on profile pages, visible only to owner | DONE |
| Photo ordering | Avatar photo appears first in public photo gallery, remaining sorted newest-first | DONE |
| Hosted Happenings split | Split into "Upcoming" and "Past" subsections with 3-item caps each | DONE |

**Files Added:**
- `lib/profile/sortProfileImages.ts` — Avatar-first sorting helper
- `lib/profile/splitHostedHappenings.ts` — Upcoming/past split helper
- `__tests__/member-profile-quick-wins.test.ts` — 18 tests

**Files Modified:**
- `app/songwriters/[id]/page.tsx` — Owner CTAs, photo ordering, hosted happenings split
- `app/members/[id]/page.tsx` — Owner CTAs, photo gallery section, photo ordering, hosted happenings split
- `app/(protected)/dashboard/profile/page.tsx` — Added `id="photos"` anchor for deep-linking

**Test Coverage:** 18 new tests (2206 total passing)

### Venue Invites Track (January 2026) — RESOLVED

| Item | Evidence | Commit |
|------|----------|--------|
| RLS INSERT WITH CHECK fix | Invites create successfully | `a0bd17d` |
| Drop users_see_own_invites policy | No permission errors | `89009ab` |
| Production SITE_URL for invite links | No localhost URLs | `2c7c550` |
| Service role client for acceptance | Invites accept successfully | `e3816ae` |
| Integration tests + runbook | 20 tests passing | `b2e0345` |

### ABC Track (January 2026) — RESOLVED

| Phase | Description | Status | Evidence |
|-------|-------------|--------|----------|
| ABC3 | Duplicate venue merge | DONE | `docs/investigation/Archive/phase-abc3-duplicate-venue-merge.md` |
| ABC4 | Venue slugs + series view fix | DONE | `7ce4891`, `8244b01` |
| ABC5 | Occurrence-aware event detail | DONE | `82fe0a4` |
| ABC6 | Per-occurrence date_key columns | DONE | `70cd947` |
| ABC7 | Admin/host date-awareness | DONE | Merged in ABC6 |
| ABC8 | Venue claiming + invites | DONE | `186a14e` |
| ABC9 | Venue manager controls | DONE | Merged in ABC8/10 |
| ABC10 | RLS tightening + audit | DONE | Migrations applied |
| ABC11 | Admin venue invite UI | DONE | `186a14e` |

### Events Ops Console (Phase 4.61–4.62) — RESOLVED

| Item | Status | Evidence |
|------|--------|----------|
| Venue CSV export/import | DONE | 71 tests |
| Events CSV export/import | DONE | 98 tests |
| Overrides CSV export/import | DONE | Upsert behavior works |
| Bulk verify actions | DONE | UI buttons work |

### Earlier Completed Phases

| Phase | Description | Status | Evidence |
|-------|-------------|--------|----------|
| 4.21 | Occurrence overrides | DONE | `occurrence-overrides.test.ts` (17 tests) |
| 4.22 | Event claims + ownership | DONE | `event-claims.test.ts` (13 tests) |
| 4.30 | Gallery + comments track | DONE | Track closed 2026-01-01 |
| 4.32–4.34 | Trust-based content + smoke suite | DONE | `SMOKE-PROD.md` |
| 4.35 | Email signature + profile slugs | DONE | Slugs in use |
| 4.36–4.40 | Verification + notifications | DONE | Multiple tests |
| 4.41–4.47 | Event creation UX | DONE | Full flow works |
| 4.48–4.51 | Guest RSVP + comments | DONE | Guest flows work |

---

## Open TODOs

### Strategic Platform Architecture (Parallel, Non-Blocking)

| ID | Item | Priority | Status | Notes |
|----|------|----------|--------|-------|
| STRAT-01 | Multi-Region + White-Label Rebrand Architecture | P0 (Strategic) | OPEN — docs-only foundation in place, code deferred | Canonical strategic tract spanning rebrand + region/community abstraction |
| STRAT-01A | Colorado rebrand naming strategy (urgent, reversible) | P0 | OPEN — highest urgency | Working naming target: The Colorado Songwriters Collective; domain `.com` vs `.org` intentionally undecided; Denver remains primary region instance |
| STRAT-01A-DOMAIN | Domain strategy + TLD-agnostic architecture | P0 (Strategic) | OPEN — docs-only | Primary domains (working assumption): coloradosongwriterscollective.org, songwriterscollective.org; Optional .com variants deferred; Codebase must remain TLD-agnostic to support future .org → .com switch without refactor |
| STRAT-01B | Region abstraction (routing + data boundaries) | P1 | PLANNED | Region becomes first-class without codebase forks |
| STRAT-01C | Admin scoping + licensing model | P1 | PLANNED | Global/regional/community admin scope contract, enforcement deferred |
| STRAT-01D | White-label theming + content taxonomy | P1 | PLANNED | Songwriters default; comedians/sports/community variants supported |
| STRAT-01E | Mobile-first parity + API contracts | P2 | PLANNED | Native mobile compatibility via stable API/domain contracts |
| STRAT-01F | Internationalization readiness (locale + language) | P2 | PLANNED | Locale/language + regional formatting contracts |

**Strategic References:**
- North star: `docs/NORTH_STAR.md`
- STOP-GATE: `docs/investigation/strat-01-multi-region-whitelabel-stopgate.md`
- Contract alignment: `docs/CONTRACTS.md` (Region + Community Platform Architecture section)

### Homepage / Navigation / UX

| ID | Item | Priority | Status |
|----|------|----------|--------|
| UX-01 | Remove "Unconfirmed" badges from two existing DSC TEST series (cards + detail pages) | P0 | DONE |
| UX-02 | Fix homepage hero text contrast over background image | P1 | DONE |
| UX-03 | Reorder nav: Members immediately after Happenings | P1 | DONE |
| UX-04 | Homepage CTA pills text: "See all happenings" / "See open mics" | P1 | DONE |
| UX-05 | Make "Join us" heading a link to sign-up page (with hover effect) | P0 | DONE |
| UX-06 | Side tract: Homepage "Unconfirmed + Missing details" mismatch vs event detail "Confirmed" after one-time → custom series edit | P0 | DONE — homepage mapper now preserves verification/location fields for DSC rail cards; regression tests added (`docs/investigation/phase7b-side-tract-homepage-confirmed-mismatch-stopgate.md`, `web/src/__tests__/phase7b-homepage-dsc-rail-confirmed.test.tsx`) |
| UX-07 | Homepage vs `/happenings` "Tonight" list consistency | P1 | DONE — Phase 6 complete (`docs/investigation/phase6-cross-surface-consistency-stopgate.md`, PR #118) |
| UX-08 | Mobile event card metadata truncation (city/state/time/cost visibility) | P1 | DONE — Phase 6 complete (`docs/investigation/phase6-cross-surface-consistency-stopgate.md`, PR #118) |
| UX-09 | Cross-surface consistency rules contract for discovery surfaces | P1 | DONE — Contracted in `docs/CONTRACTS.md` § Cross-Surface Event Consistency |

### Search (HIGH PRIORITY)

| ID | Item | Priority | Status |
|----|------|----------|--------|
| SEARCH-01 | Global nav search must search happenings, venues, AND members | P0 | DONE |
| SEARCH-02 | Search results must navigate to correct detail pages for ALL result types | P0 | DONE |
| SEARCH-03 | Fix current behavior where even working results don't navigate | P0 | DONE |

### Member Pages

| ID | Item | Priority | Status | Notes |
|----|------|----------|--------|-------|
| MEMBER-00 | Fix fan-only member profile 404s / add /members/[id] route | P0 | DONE | 24 tests, MemberCard routing fixed |
| MEMBER-01 | Profile completeness / visibility rules | P1 | OPEN | From DEFERRED-HIGH-PRIORITY.md |
| MEMBER-02 | Member discovery / directory UX | P1 | OPEN | Search + filters |
| MEMBER-03 | Member ↔ event ↔ venue linking | P2 | OPEN | Cross-linking |
| MEMBER-04 | Upcoming Performances (member-managed external links) | P2 | OPEN | From DEFERRED-HIGH-PRIORITY.md |
| MEMBER-05 | Profile Updates / Announcements section | P2 | OPEN | From DEFERRED-HIGH-PRIORITY.md |
| MEMBER-06 | Collaboration Messaging CTA | P2 | OPEN | From DEFERRED-HIGH-PRIORITY.md |
| MEMBER-07 | Profile Gallery + Media Control | P3 | OPEN | From DEFERRED-HIGH-PRIORITY.md |
| MEMBER-08 | Embedded Media (Spotify / YouTube) | P3 | OPEN | From DEFERRED-HIGH-PRIORITY.md |

### Interested Button Feature (NEW)

| ID | Item | Priority | Status | Notes |
|----|------|----------|--------|-------|
| INT-01 | Add "Interested" button to happening cards (always visible) | P2 | OPEN | Distinct from RSVP |
| INT-02 | Add "Interested" button to happenings detail pages | P2 | OPEN | Above/alongside RSVP |
| INT-03 | New "My Happenings" category in member dashboard | P2 | OPEN | Shows interested events |
| INT-04 | Notify host when member marks interested (dashboard only, no email) | P2 | OPEN | Dashboard notification |
| INT-05 | Show location address on always-visible happening cards | P2 | OPEN | Currently venue name only |

---

## Community Marketplace & Services Hub (Future)

### MARKETPLACE-01 — Classifieds + Service Listings

**Status:** OPEN (Docs-only, no implementation)
**Priority:** P1 (Future major feature)
**Added:** 2026-02-07

**Problem Statement:**
Community members need a way to discover opportunities, gear, services, and collaborations beyond events. Currently, no platform surface exists for posting gigs, selling equipment, finding teachers, or advertising services.

**User Value:**
- Songwriters can find paid gig opportunities
- Members can buy/sell music gear within the community
- Service providers (teachers, studios) can reach local musicians
- Community can discover local music businesses and resources
- Reduces reliance on Facebook Marketplace/Craigslist for music-specific transactions

**Scope (Classifieds — Members + Limited Guest Posting):**

| Feature | Description |
|---------|-------------|
| Image uploads | Multiple images per listing (gallery-style) |
| External URL | Link to external listing, shop, or portfolio |
| Video embeds | YouTube/Vimeo for demos, tours, performances |
| Audio embeds | Spotify, SoundCloud playlists/tracks |
| Rich description | Markdown or rich text for details |
| Comments | Discussion thread per listing |
| Moderation | Hide/delete capabilities for admins + listing owner |

**Posting Permissions:**
- **Members:** Full capabilities (images, embeds, external links, unlimited duration)
- **Guests:** Limited posting (text + 1 image, shorter duration, admin approval required)

**Key Design Constraints:**
- Must support moderation without approval queue bottlenecks
- Guest posts require email verification (reuse existing guest verification pattern)
- Comments reuse existing threaded comment system
- No built-in payment/transaction handling (external URLs only)

**Dependencies:** Media embed infrastructure (EMBED-01 or similar), moderation audit patterns

---

### MARKETPLACE-02 — Service-Based Profile Pages

**Status:** OPEN (Docs-only, no implementation)
**Priority:** P1 (Future major feature)
**Added:** 2026-02-07

**Problem Statement:**
Music teachers, studios, stores, festivals, and other songwriter groups lack dedicated profile pages on the platform. These entities are distinct from individual members and venues but need similar discoverability and engagement surfaces.

**User Value:**
- Teachers can showcase credentials, availability, and student testimonials
- Studios can display services, rates, and booking links
- Stores can list inventory categories and link to online shops
- Festivals can promote lineups, ticket sales, and past events
- Songwriter groups can build community visibility and recruit members

**Service Types (Each with Dedicated Profile Page Type):**

| Type | Description | Key Features |
|------|-------------|--------------|
| Music Teachers | Individual instructors or schools | Instruments taught, rates, availability calendar links, student testimonials |
| Music Stores | Retail shops (physical + online) | Inventory categories, external shop link, location/hours, special offers |
| Music Studio Services | Recording, mixing, mastering studios | Service list, rates, external booking link, portfolio (audio/video embeds) |
| Festivals | Music festivals and concert series | Event dates, lineup announcements, ticket links, past event galleries |
| Songwriting Groups | Other local songwriter communities | Mission/focus, meeting schedule, external signup link, event cross-promotion |

**Profile Creation Requirements:**
- **Account required** — Each service type requires a registered account to create/manage
- Acts like a hybrid profile + listings page
- Publicly viewable (no login required to view)
- Supports external links (website, booking, shop, tickets)
- Supports embedded media (videos, audio samples)
- Supports comments for questions/reviews

**Key Design Constraints:**
- Service profiles are NOT venues (different schema, different permissions)
- Service profiles are NOT member profiles (separate entity type)
- Service profile owners may also have personal member profiles (separate accounts allowed)
- Cross-linking between service profiles and events/venues is supported but not required

**Dependencies:** Profile architecture patterns, media embed infrastructure, moderation tools

---

### MARKETPLACE-03 — Unified Navigation Surface

**Status:** OPEN (Docs-only, no implementation)
**Priority:** P1 (Future major feature)
**Added:** 2026-02-07

**Navigation UX Decision:**
All marketplace and service surfaces will live under **one top-level navigation item** that expands to show sub-categories.

**Proposed Navigation Structure:**

```
Main Nav Bar:
- Happenings
- Members
- Venues
- [Marketplace] ← New top-level item (expandable)
  ↳ Classifieds
  ↳ Teachers
  ↳ Studios
  ↳ Stores
  ↳ Festivals
  ↳ Groups
```

**Design Rationale:**
- Keeps main navigation clean (no clutter with 6 new items)
- Groups related discovery surfaces under a single semantic parent
- Expandable menu pattern already used elsewhere in the app
- Clear hierarchy: core platform (Happenings/Members/Venues) vs marketplace/services

**Non-Goals:**
- No mega-menu implementation (simple dropdown/flyout is sufficient)
- No separate "Services" top-level item (keep consolidated)
- No marketplace branding separate from platform branding

**Dependencies:** None (navigation decision is independent of implementation)

---

## Deferred (Future Phases)

### Map-Based Event Discovery View

**Status:** OPEN
**Priority:** P2
**Added:** 2026-01-28

**Problem Statement:**
Users who want to find happenings near a specific location (their neighborhood, a venue they like, or when traveling) have no spatial way to browse. The current list/timeline view requires scanning venue names and mentally mapping locations.

**User Value:**
- Enables location-first discovery ("what's happening near me tonight?")
- Supports users exploring new neighborhoods or visiting from out of town
- Visual clustering shows event density at popular venues
- Natural complement to existing timeline/series views

**Scope:**
| Item | Description |
|------|-------------|
| Map view toggle | Third view option alongside Timeline and Series |
| Venue clustering | Events at same venue cluster into single marker |
| Full filter support | All existing filters (day, type, cost, etc.) work on map |
| Click-to-detail | Click marker → event card popup → link to detail page |
| Mobile responsive | Touch-friendly pan/zoom on mobile |

**Risk Level:** Medium
- Requires geocoding venues (lat/lng columns exist but many are NULL)
- Map library selection (Mapbox vs Google Maps vs Leaflet)
- Performance with 100+ markers
- Mobile UX complexity

**Dependencies:** Venue lat/lng backfill, map library integration

---

### EMBED-01 — External Event Embeds (Phase-1)

**Status:** DONE
**Priority:** P2
**Added:** 2026-01-28
**Completed:** 2026-02-08

**Delivered:**
- Events-only external embed endpoint shipped:
  - `/embed/events/{event-id-or-slug}`
- Shared query contract shipped:
  - `theme=light|dark|auto`
  - `view=card|compact`
  - `show=badges,meta,cta`
  - `date=YYYY-MM-DD` (optional)
- Kill switch validated in production:
  - `ENABLE_EXTERNAL_EMBEDS=false` -> `503` disabled response
  - `ENABLE_EXTERNAL_EMBEDS=true` -> `200` rendered embed response
- Production mismatch fix shipped:
  - Removed `events.cover_image_card_url` from embed query (`c744f52`) because column does not exist in production schema.

**Evidence:**
- Closeout + validation log:
  - `docs/investigation/embed-01-external-embeds-stopgate.md` (Section 14)

---

### EMBED-02 — Non-Event External Embeds (Venues, Members, Blogs, Galleries)

**Status:** OPEN (STOP-GATE complete, implementation deferred)
**Priority:** P2
**Added:** 2026-02-08

**Scope:**
- EMBED-02A: Venue embeds
- EMBED-02B: Member profile embeds
- EMBED-02C: Blog post embeds
- EMBED-02D: Gallery album embeds

**Contract requirement:**
- Reuse the EMBED-01 query contract (`theme`, `view`, `show`) with read-only iframe delivery.
- Preserve route-scoped framing policy and kill-switch behavior.

**STOP-GATE:**
- `docs/investigation/embed-02-non-event-embeds-stopgate.md`

---

### TV Display / Lineup Control Audit & Reliability Fixes

**Status:** OPEN
**Priority:** P1
**Added:** 2026-01-28

**Problem Statement:**
The TV Display and Lineup Control features are live but have not been stress-tested under real event conditions. Unknown failure modes exist around network interruptions, browser memory over multi-hour displays, and concurrent host control access.

**User Value:**
- Hosts can trust the display won't freeze or crash during a 3-hour event
- Multiple co-hosts can coordinate lineup without conflicts
- Clear recovery path when issues occur
- Reduced host anxiety about technical failures

**Scope:**
| Item | Description |
|------|-------------|
| Connection health audit | Test reconnection after network drops |
| Memory profiling | Ensure 4+ hour display sessions don't leak memory |
| Concurrent access | Define behavior when 2+ hosts control simultaneously |
| Error recovery | Clear UI feedback and recovery actions when things fail |
| Stress testing | Simulate 50+ performer lineups, rapid slot changes |

**Risk Level:** Medium
- Requires dedicated testing time with real hardware
- May surface architectural issues with polling/websockets
- Some fixes may require breaking changes to lineup state model

**Dependencies:** Access to test hardware (TV, projector), dedicated QA time

---

### Signup Time Field UX Completion — RESOLVED

**Status:** DONE (resolved after Phase 5.04)
**Priority:** P1
**Added:** 2026-01-28

**Historical Problem Statement:**
The `signup_time` field originally lacked create/edit form controls. That gap has been closed and should be treated as regression-protected behavior.

**User Value:**
- Hosts can communicate when performer signups open (e.g., "6:30 PM")
- Attendees know when to arrive to get on the list
- Reduces "when do I sign up?" questions to hosts
- Completes a partially-shipped feature

**Scope:**
| Item | Description |
|------|-------------|
| Form field | Time input in EventForm.tsx (create + edit modes) |
| Field placement | In "Join & Signup" section near timeslots config |
| Validation | Optional field, must be valid time format if provided |
| Display confirmation | Preview card shows signup time when set |
| Tests | Form behavior, API round-trip, display |

**Risk Level:** Low
- Form field addition (well-understood pattern)
- No schema changes needed
- Single-file change to EventForm.tsx

**Dependencies:** None (closed)

---

### Community Profile Activity Visibility Decision

**Status:** DEFERRED (needs product decision)
**Added:** 2026-01-19
**Context:** Phase B - Private Profile Activity Sections

| Item | Description |
|------|-------------|
| Opt-in public RSVPs | Allow members to make their RSVP history publicly visible on their profile |
| Opt-in public performances | Allow members to share their performer slot history publicly |
| Community activity visibility | Let community see who's attending/performing at happenings |

**Decision Needed:**
- Should RSVPs ever be visible to other community members?
- Should performance history be public by default or opt-in?
- What privacy controls should users have?

**Current Implementation:**
- "My RSVPs" and "My Performances" are PRIVATE (owner-only)
- No data is exposed to other users
- Privacy-first approach until product decision is made

**When to Revisit:**
- After gathering feedback from test users about privacy expectations
- Before building any "social" or "community activity" features

---

### ABC12 — Venue Change Approval Gating

**Status:** Investigation complete, awaiting approval
**Document:** `docs/investigation/Archive/phase-abc12-venue-change-approval-gating.md`

| Item | Description |
|------|-------------|
| Tier classification | Which fields require approval |
| `venue_pending_edits` table | Queue for Tier 3 changes |
| Admin approval UI | Review + approve/reject |
| Rate limiting | Prevent abuse |

### Host Attendee Messaging

**Status:** Approved as next after Events Ops v1
**From:** `docs/OPS_BACKLOG.md`

| Item | Description |
|------|-------------|
| Send update to RSVPs/performers | Per-occurrence messaging |
| Email delivery | Respects preferences |
| Public comment/update | Visible to non-email recipients |

### Enhanced Venue Features

**Status:** Deferred (post-ABC)
**From:** `docs/OPS_BACKLOG.md`

- Venue updates/announcements
- API enrichments (Google Places)
- Comments on venue pages

### Gallery Ops Console

**Status:** Deferred
**From:** `docs/OPS_BACKLOG.md`

- Bulk album/photo management
- Moderation workflows
- CSV export of metadata

### Members Export/Import

**Status:** Deferred
**From:** `docs/OPS_BACKLOG.md`

- Member directory CSV export
- Profile bulk updates
- Role management via CSV

---

## Legacy Items — Status Mapping

### From OPS_BACKLOG.md

| Original Item | Current Status | Notes |
|---------------|----------------|-------|
| Events Ops Console v1 | DONE | Phase 4.61–4.62 |
| Venue Ops Console v1 | DONE | Phase 4.61 |
| Host Attendee Messaging | OPEN | Deferred section |
| Venue Manager/Claim System | DONE | ABC8 |
| Enhanced Venue Features | OPEN | Deferred section |

### From DEFERRED-HIGH-PRIORITY.md

| Original Item | Current Status | Notes |
|---------------|----------------|-------|
| Upcoming Performances | OPEN | MEMBER-04 |
| Profile Updates | OPEN | MEMBER-05 |
| Collaboration Messaging | OPEN | MEMBER-06 |
| Profile Gallery | OPEN | MEMBER-07 |
| Embedded Media | OPEN | MEMBER-08 |

### From ABC Investigation Docs

| Phase | Original Item | Current Status | Notes |
|-------|---------------|----------------|-------|
| ABC12 | Venue approval gating | OPEN | Full investigation complete, awaiting approval |
| ABC9 | Manager controls beyond MVP | DONE | Merged in ABC10 |

---

## Superseded / Dropped Items

| Item | Reason |
|------|--------|
| `anyone_can_lookup_by_token` RLS policy | Removed in ABC10b (security) |
| `users_see_own_invites` RLS policy | Removed in 20260114000000 (permission issue) |
| Auto-enable timeslots for open_mic/showcase | Removed in Phase 4.47 (opt-in only) |

---

## Quality Gates

Before any milestone:

| Check | Requirement |
|-------|-------------|
| Lint | 0 errors, 0 warnings |
| Tests | All passing |
| Build | Success |

**Current Status:** 2921 tests passing, 0 lint warnings.

---

*This document reconciles all TODO sources as of 2026-01-28. See git history for changes.*

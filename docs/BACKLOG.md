# Product Backlog — Denver Songwriters Collective

> **This is the CANONICAL backlog.** All other TODO sources defer to this document.
>
> **Last Updated:** 2026-01-17
> **Next Milestone:** Invite ~20 Test Users (READY — see `docs/runbooks/invite-20-admin-runbook.md`)

---

## Document Audit Summary

| File | Purpose | Status |
|------|---------|--------|
| `docs/BACKLOG.md` | **CANONICAL** — All TODOs live here | ACTIVE |
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

### Phase 4.65–4.69 (January 2026) — Venue + Performance Fixes

| Item | Evidence | Commit/PR |
|------|----------|-----------|
| Series date routing + recurrence correctness | Tests pass | PR #108 (`532ccb8`) |
| Venue occurrence count alignment | Venue cards accurate | PR #110 (`dbf2063`) |
| DatePillRow + SeriesCard UI unification | Visual consistency | PR #111 (`e9eb189`) |
| Comments API parsing fix | Comments load correctly | `b761eca` |
| Venue cover image feature | Upload + display works | `f6554fa` + migration |
| Timeslot/RSVP performance scoping by date_key | <1s load time | `bebeadf` |

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

### Homepage / Navigation / UX

| ID | Item | Priority | Status |
|----|------|----------|--------|
| UX-01 | Remove "Unconfirmed" badges from two existing DSC TEST series (cards + detail pages) | P0 | DONE |
| UX-02 | Fix homepage hero text contrast over background image | P1 | DONE |
| UX-03 | Reorder nav: Members immediately after Happenings | P1 | DONE |
| UX-04 | Homepage CTA pills text: "See all happenings" / "See open mics" | P1 | DONE |
| UX-05 | Make "Join us" heading a link to sign-up page (with hover effect) | P0 | DONE |

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

## Deferred (Future Phases)

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

**Current Status:** 2005 tests passing, 0 lint warnings.

---

*This document reconciles all TODO sources as of 2026-01-17. See git history for changes.*

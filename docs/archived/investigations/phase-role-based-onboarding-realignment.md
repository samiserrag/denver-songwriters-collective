# Investigation — Role-Based Onboarding Realignment

**Status:** INVESTIGATION COMPLETE
**Date:** January 2026
**Author:** Claude (Agent)
**Mode:** Investigation only — no code changes

---

## Executive Summary

The current onboarding collects identity flags but presents them as a simple checklist without role-specific field collection. This investigation documents how to implement a **conditional wizard** that shows relevant fields based on selected identities, without making roles mutually exclusive.

**Key Finding:** The existing approval systems (Host via `approved_hosts`, Venue Manager via `venue_managers`) are mature and should be preserved. The onboarding wizard should guide users toward these existing approval paths rather than create new ones.

---

## Section A: Current Onboarding Audit

### Flow Structure

| Route | Purpose | Current State |
|-------|---------|---------------|
| `/onboarding/role` | Role selection | **Just redirects to /onboarding/profile** |
| `/onboarding/profile` | All field collection | Single-page wizard (839 lines) |
| `/onboarding/complete` | Success confirmation | **Just redirects to /dashboard** |

### Current Steps (in profile/page.tsx)

| Step | Content |
|------|---------|
| 0 | Name (required) |
| 1 | Identity selection (4 checkboxes: Songwriter, Host, Studio, Fan) |
| 2 | Bio |
| 3 | Social links (6 fields) |
| 4 | Tipping info (3 fields) |
| 5 | Collaboration preferences (2 checkboxes) |
| 6 | Instruments |
| 7 | Genres |

### Fields Collected (18 total)

| Category | Fields |
|----------|--------|
| Required | `name` |
| Identity | `is_songwriter`, `is_host`, `is_studio`, `is_fan` |
| Bio | `bio` |
| Social | `instagram_url`, `spotify_url`, `youtube_url`, `website_url`, `tiktok_url` |
| Tipping | `venmo_handle`, `cashapp_handle`, `paypal_url` |
| Collaboration | `open_to_collabs`, `interested_in_cowriting` |
| Arrays | `instruments`, `genres` |

### Fields NOT in Onboarding (Available in Profile Edit)

| Field | Type | Notes |
|-------|------|-------|
| `city` | string | Location info |
| `state` | string | Location info |
| `available_for_hire` | boolean | Studio-relevant |
| `specialties` | string[] | Studio-relevant |
| `favorite_open_mic` | string | Fan/Songwriter-relevant |
| `song_links` | string[] | Songwriter-relevant |
| `featured_song_url` | string | Songwriter-relevant |

---

## Section B: Identity Flag Usage Across Codebase

### Files Using Identity Flags (45 files total)

| Category | Files | Primary Usage |
|----------|-------|---------------|
| Listing pages | `members/page.tsx`, `songwriters/page.tsx`, `studios/page.tsx`, `performers/page.tsx` | Query filters |
| Detail pages | `songwriters/[id]`, `studios/[id]`, `performers/[id]`, `members/[id]` | Display logic |
| Cards | `MemberCard.tsx` | Badge display |
| Search | `api/search/route.ts` | Search filters |
| Admin | `UserDirectoryTable.tsx`, `admin/studios/page.tsx`, `admin/performers/page.tsx` | Admin views |
| Profile | `dashboard/profile/page.tsx`, `lib/profile/completeness.ts` | Editing, scoring |
| Onboarding | `onboarding/profile/page.tsx`, `api/onboarding/route.ts` | Collection, persistence |
| Comments | `api/events/[id]/comments/route.ts`, migrations | Author display |

### Identity → Feature Matrix

| Identity | Discovery Page | Can Create Events | Can Create DSC Events | Profile Type |
|----------|---------------|-------------------|----------------------|--------------|
| Songwriter | `/songwriters` | Yes (any member can) | Only if approved host | Songwriter profile |
| Host | `/members` (filtered) | Yes | Only if approved host | Member profile |
| Studio | `/studios` | Yes | Only if approved host | Studio profile |
| Fan | `/members` (filtered) | Yes | Only if approved host | Member profile |

**Important:** `is_host` flag ≠ approved host status. The flag is a self-declaration ("I host events"). Actual hosting privileges require `approved_hosts` table entry.

---

## Section C: Existing Approval Workflows

### 1. Host Approval Flow (Happenings Host)

**Purpose:** Grant ability to create "DSC Official" events (events with `is_dsc_event=true`)

**Tables:**
- `host_requests` — User request queue (pending → approved/rejected)
- `approved_hosts` — Active host privileges

**Flow:**
```
User selects is_host=true in onboarding
                ↓
User visits /dashboard → sees "Become a DSC Host" prompt (if not approved)
                ↓
POST /api/host-requests (creates pending request with optional message)
                ↓
Admin reviews at /dashboard/admin/host-requests
                ↓
PATCH /api/admin/host-requests/[id] with action=approve
                ↓
Inserts into approved_hosts + sends email
                ↓
User can now toggle "Is this a DSC Event" when creating events
```

**Key Files:**
- `api/host-requests/route.ts` — User submission
- `api/admin/host-requests/[id]/route.ts` — Admin approval
- `dashboard/my-events/_components/EventForm.tsx` — DSC toggle gated by approved status

### 2. Venue Manager Flow

**Purpose:** Grant ability to edit venue details and manage venue-specific settings

**Tables:**
- `venue_claims` — User claim queue (pending → approved/rejected/cancelled)
- `venue_managers` — Active venue access (role: owner | manager)
- `venue_invites` — Token-based invites (for adding managers without claim flow)

**Flow:**
```
User visits /venues/[slug] → sees "Claim this venue" button (if unclaimed)
                ↓
POST /api/venues/[id]/claim (creates pending claim with optional message)
                ↓
Admin reviews at /dashboard/admin/venue-claims
                ↓
POST /api/admin/venue-claims/[id]/approve
                ↓
Inserts into venue_managers with role=owner + sends email
                ↓
User sees venue in /dashboard/my-venues
```

**Key Files:**
- `api/venues/[id]/claim/route.ts` — User claim submission
- `api/admin/venue-claims/[id]/approve/route.ts` — Admin approval
- `lib/venue/managerAuth.ts` — Authorization helpers

### 3. Event Claim Flow (for unclaimed events)

**Purpose:** Assign ownership of existing events with `host_id IS NULL`

**Tables:**
- `event_claims` — Claim queue (pending → approved/rejected)

**Flow:**
```
User visits /events/[slug] for event with host_id=NULL
                ↓
Sees "Claim this event" button
                ↓
POST /api/events/[id]/claim
                ↓
Admin reviews at /dashboard/admin/claims
                ↓
On approval: sets events.host_id = requester_id
```

---

## Section D: Role → Field Relevance Matrix

### Which Fields Matter to Which Identity?

| Field | Songwriter | Host | Studio | Fan | Notes |
|-------|------------|------|--------|-----|-------|
| **bio** | High | High | High | Medium | Universal, but framing differs |
| **instagram_url** | High | Medium | High | Low | Artists need social proof |
| **spotify_url** | High | Low | High | Low | Music discovery |
| **youtube_url** | High | Medium | High | Low | Performance videos |
| **tiktok_url** | High | Low | Medium | Low | Younger audience |
| **website_url** | High | High | High | Low | Professional presence |
| **venmo_handle** | High | Medium | Low | Low | Tipping at events |
| **cashapp_handle** | High | Medium | Low | Low | Tipping at events |
| **paypal_url** | High | Medium | Low | Low | Tipping at events |
| **open_to_collabs** | High | Low | Low | Low | Songwriter-specific |
| **interested_in_cowriting** | High | Low | Low | Low | Songwriter-specific |
| **instruments** | High | Low | Low | Medium | Musical profile |
| **genres** | High | Low | Low | High | Discovery matching |

### Recommended Field Groups by Identity

| Identity | Core Fields | Optional Fields | Skip |
|----------|-------------|-----------------|------|
| **Songwriter** | bio, social links, tipping, genres, instruments, collab prefs | — | — |
| **Host** | bio, website_url, instagram_url | tipping | spotify, collab prefs |
| **Studio** | bio, website_url, instagram_url, specialties* | — | tipping, collab prefs |
| **Fan** | bio (optional), genres | instagram | tipping, collab prefs, instruments |

*`specialties` not currently in onboarding — could add

---

## Section E: Existing Member Impact Analysis

### Current Member Stats

| Metric | Count |
|--------|-------|
| Onboarded members | 12 |
| With `is_songwriter` | 8 (67%) |
| With `is_host` | 5 (42%) |
| With `is_studio` | 0 (0%) |
| With `is_fan` | 6 (50%) |
| Approved hosts (in `approved_hosts`) | 0 |
| Active venue managers | 1 |

### Overlap Patterns

Most members have selected multiple identities (e.g., Songwriter + Fan, Songwriter + Host). This confirms:
1. Identities are NOT mutually exclusive (correct design)
2. Users understand they can select multiple
3. "Fan" is commonly selected alongside other roles

### Fan Implicit vs Explicit Decision

**Option A: Fan is Implicit (Everyone is a Fan)**
- Remove `is_fan` checkbox from onboarding
- Set `is_fan=true` for all members automatically
- Pro: Simpler onboarding, everyone can access fan features
- Con: Can't filter to "just fans" in discovery

**Option B: Fan is Explicit (Current State)**
- Keep `is_fan` checkbox
- Pro: Users who select it are more engaged fans
- Con: Some users forget to check it

**Recommendation:** Keep explicit for now. 50% selection rate suggests users find it meaningful.

---

## Section F: Terminology Decisions

### Current Labels

| Internal | Current UI Label | Proposed Label |
|----------|------------------|----------------|
| `is_host` | "I'm a Host" | "I host happenings" |
| `is_songwriter` | "I'm a Songwriter" | "I write songs" |
| `is_studio` | "I'm a Studio" | "I run a recording studio" |
| `is_fan` | "I'm a Fan" | "I support local music" |

### "Happenings Host" vs "DSC Host"

| Term | Meaning | When to Use |
|------|---------|-------------|
| **Happenings Host** | Self-declared: "I run/host open mics or events" | Onboarding, profile badges |
| **DSC Host** | Approved: Can create events with `is_dsc_event=true` | Admin UI, approval emails |
| **Event Host** | Assigned: Listed as host on a specific event | Event detail pages |

**Recommendation:**
- Onboarding: "I host happenings" (verb form)
- Profile badges: "Happenings Host"
- Admin approval: "DSC Happenings Host" (makes distinction clear)

---

## Section G: Implementation Slices

### Slice 1: Conditional Step Display (Low Risk)

**Goal:** Show/skip onboarding steps based on selected identities

**Changes:**
- Add `getRelevantSteps(identities)` function
- Skip steps with no relevant fields for selected identities
- Example: Fan-only user skips tipping and collab preference steps

**Files to Modify:**
- `onboarding/profile/page.tsx` — Step navigation logic

**No Database Changes**

### Slice 2: Role Selection Landing Page (Medium Risk)

**Goal:** Make `/onboarding/role` a real selection page before profile wizard

**Changes:**
- Replace redirect with actual role selection UI
- Visual cards for each identity with descriptions
- Allow multi-select (not radio buttons)
- "Continue" saves selections to state, navigates to /onboarding/profile

**Files to Modify:**
- `onboarding/role/page.tsx` — New UI
- `onboarding/profile/page.tsx` — Read initial selections from query params or context

**No Database Changes**

### Slice 3: Post-Onboarding Approval Prompts (Low Risk)

**Goal:** After completing onboarding, prompt users toward relevant approval flows

**Changes:**
- If user selected `is_host`, show "Want to host DSC happenings?" prompt with link to host request
- If user selected `is_studio`, show "Claim your studio listing" prompt (if feature exists)
- Display on `/dashboard?welcome=1` page

**Files to Modify:**
- `dashboard/page.tsx` — Welcome flow prompts
- Could add `HostOnboardingPrompt.tsx` component

**No Database Changes**

---

## Section H: Explicit UNKNOWNs

| # | Unknown | Impact | Resolution Path |
|---|---------|--------|-----------------|
| 1 | Should Studios have a claiming flow like Venues? | Affects studio onboarding | Product decision |
| 2 | Should approved hosts get `is_host` auto-set? | Affects profile completeness | Already decoupled — keep separate |
| 3 | What happens if someone selects ONLY Fan? | Minimal profile needed | They can skip most steps — fine |
| 4 | Should we add `specialties` to onboarding for Studios? | Affects Studio UX | Could defer to profile edit |

---

## STOP-GATE Section

### Decisions Sami Must Make

1. **Slice Priority Order?**
   - Slice 1 (conditional steps) is lowest risk, fastest value
   - Slice 2 (role landing page) provides better UX but more work
   - Slice 3 (approval prompts) connects to existing systems
   - **Recommendation:** 1 → 3 → 2

2. **Fan Implicit or Explicit?**
   - Current: Explicit checkbox (50% select it)
   - Options: Keep explicit, make implicit, or make implicit but let users opt-out
   - **Recommendation:** Keep explicit (working fine)

3. **Terminology: "Happenings Host" Acceptable?**
   - Used in onboarding: "I host happenings"
   - Used on profile badges: "Happenings Host"
   - DSC-approved hosts: "DSC Happenings Host" (admin-only distinction)
   - **Needs confirmation**

4. **Should Venue Manager appear in onboarding?**
   - Currently: Venue claiming is separate flow from /venues/[slug]
   - Option: Add "I manage a venue" to identities → links to venue claiming
   - **Recommendation:** Keep separate (venue claiming is venue-specific, not identity)

### Safest Next Slice

**Slice 1: Conditional Step Display**

Scope:
1. Add `getRelevantSteps()` function that maps identities → step indices
2. Modify step navigation to skip irrelevant steps
3. No API changes, no schema changes

Effort: ~2 hours
Risk: Very low (display logic only)
Test: Manual — select Fan only, verify tipping/collab steps skipped

---

## Files Referenced

| File | Purpose |
|------|---------|
| `onboarding/role/page.tsx` | Currently just redirects |
| `onboarding/profile/page.tsx` | Main wizard (839 lines) |
| `api/onboarding/route.ts` | Persistence API |
| `api/host-requests/route.ts` | Host request submission |
| `api/admin/host-requests/[id]/route.ts` | Host approval |
| `api/venues/[id]/claim/route.ts` | Venue claim submission |
| `api/admin/venue-claims/[id]/approve/route.ts` | Venue claim approval |
| `lib/venue/managerAuth.ts` | Venue manager auth helpers |
| `lib/profile/completeness.ts` | Profile scoring logic |
| `migrations/20251209100002_host_permission_system.sql` | Host tables schema |

---

## Appendix: Profile Completeness Scoring

Current scoring breakdown (100 points total):

| Section | Points | Condition |
|---------|--------|-----------|
| Identity | 20 | Any of is_songwriter, is_host, is_studio, is_fan |
| Bio | 15 | bio is not empty |
| Social | 25 | Any social URL set |
| Tipping | 15 | Any tipping method set |
| Genres | 10 | genres array has items |
| Instruments | 15 | instruments array has items |

**Implication:** If we make certain steps optional for certain identities, we may need to adjust scoring weights or make them identity-aware.

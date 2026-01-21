# Role-Based Onboarding Audit

> **Investigation Only — No Code Changes**
>
> Date: 2026-01-16
> Status: Complete
> Scope: Factual audit of signup/onboarding, profile schema, role assumptions, and migration impact

---

## Table of Contents

1. [Current Signup / Onboarding Flow Map](#1-current-signup--onboarding-flow-map)
2. [Current Profile Data Model (Schema + Storage)](#2-current-profile-data-model-schema--storage)
3. [Rendering Surfaces & Assumptions](#3-rendering-surfaces--assumptions)
4. [Existing Host / Organizer Concept (Current State)](#4-existing-host--organizer-concept-current-state)
5. [Venue Manager & Claims System (Current State)](#5-venue-manager--claims-system-current-state)
6. [External-Link Happenings Feasibility (Facts Only)](#6-external-link-happenings-feasibility-facts-only)
7. [Role Model Clarification (Facts, Not Decisions)](#7-role-model-clarification-facts-not-decisions)
8. [Existing Members Alignment Check](#8-existing-members-alignment-check)
9. [Terminology Note (No Decision)](#9-terminology-note-no-decision)
10. [Findings Summary](#10-findings-summary)

---

## 1. Current Signup / Onboarding Flow Map

### Entry Routes

| Route | Purpose | File Path |
|-------|---------|-----------|
| `/signup` | Primary signup page | `web/src/app/signup/page.tsx` |
| `/login` | Login (has signup link) | `web/src/app/login/page.tsx` |
| `/login/magic` | Magic link login | `web/src/app/login/magic/page.tsx` |

### Authentication Methods

1. **Email + Password** — `lib/auth/signUp.ts` → `supabase.auth.signUp()`
2. **Magic Link** — `lib/auth/magic.ts` → `supabase.auth.signInWithOtp()`
3. **Google OAuth** — `lib/auth/google.ts` → `supabase.auth.signInWithOAuth()`

### Post-Auth Callback Flow

**File:** `web/src/app/auth/callback/route.ts` (lines 6-100)

```
User authenticates
    ↓
/auth/callback receives code + type params
    ↓
Exchange code for session (line 51)
    ↓
Query profiles table for onboarding_complete (lines 64-68)
    ↓
needsOnboarding = !profile?.onboarding_complete (line 70)
    ↓
Route based on auth type:
  - Google OAuth → /onboarding/profile?google=1 OR /dashboard?google=1
  - Magic Link → /onboarding/profile?magic=1 OR /dashboard?magic=1
  - Signup → /onboarding/profile?signup=1 (ALWAYS for new signups)
  - Default → /onboarding/profile OR /dashboard
```

### Onboarding Wizard

**File:** `web/src/app/onboarding/profile/page.tsx` (839 lines)

#### Steps / Screens (Single Page with Collapsible Sections)

| Order | Section | Fields | Required | Stored In |
|-------|---------|--------|----------|-----------|
| 1 | **Name** | `full_name` | **Yes** (only required field) | `profiles.full_name` |
| 2 | Primary Actions | "Let's go!" / "I'll finish this later" | N/A | N/A |
| 3 | How you identify | `is_songwriter`, `is_host`, `is_studio`, `is_fan` | No | `profiles.is_*` flags |
| 4 | Instruments & Genres | `instruments[]`, `genres[]` | No | `profiles.instruments`, `profiles.genres` |
| 5 | About | `bio` | No | `profiles.bio` |
| 6 | Social links | `instagram_url`, `spotify_url`, `youtube_url`, `tiktok_url`, `website_url` | No | `profiles.*_url` |
| 7 | Tipping | `venmo_handle`, `cashapp_handle`, `paypal_url` | No | `profiles.*` |
| 8 | Collaboration | `open_to_collabs`, `interested_in_cowriting` | No | `profiles.*` |

#### Data Flow

**Save Endpoint:** `POST /api/onboarding` (`web/src/app/api/onboarding/route.ts`)

**Payload sent (line 121-127):**
```typescript
{
  full_name: name.trim() || null,
  is_songwriter: isSongwriter,
  is_host: isHost,
  is_studio: isStudio,
  is_fan: isFan,
}
```

**NOTE:** The onboarding page collects more fields in state (bio, social links, instruments, genres, collaboration flags) but the API route only saves the 5 fields above. The other fields are NOT persisted during onboarding.

**Evidence:** `api/onboarding/route.ts` lines 32-43 — only updates `full_name`, `is_songwriter`, `is_host`, `is_studio`, `is_fan`, `onboarding_complete`, `updated_at`.

#### What Marks Onboarding Complete

**File:** `web/src/app/api/onboarding/route.ts` line 40

```typescript
onboarding_complete: true,
```

Set when user clicks either "Let's go!" or "I'll finish this later" — both trigger the same API call.

### Stub Routes (Redirects)

| Route | Redirects To | File Path |
|-------|--------------|-----------|
| `/onboarding/role` | `/onboarding/profile` | `web/src/app/onboarding/role/page.tsx` |
| `/onboarding/complete` | `/dashboard?welcome=1` | `web/src/app/onboarding/complete/page.tsx` |

---

## 2. Current Profile Data Model (Schema + Storage)

### profiles Table Schema

**Source:** `web/src/lib/supabase/database.types.ts` (lines 2253-2389)

#### Core Identity Fields

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `id` | UUID | No | Primary key (FK to auth.users) |
| `slug` | text | Yes | SEO-friendly URL slug |
| `full_name` | text | Yes | Display name |
| `email` | text | Yes | Contact email |
| `is_public` | boolean | No | Visibility in directory |

#### Identity Flags (Current Role System)

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `is_songwriter` | boolean | Yes | false | Musician/performer identity |
| `is_host` | boolean | Yes | false | Open mic host identity |
| `is_studio` | boolean | Yes | false | Recording studio operator |
| `is_fan` | boolean | Yes | false | Music supporter/fan |
| `role` | user_role enum | Yes | null | **Legacy** — "member" \| "songwriter" \| "performer" \| "host" \| "studio" \| "fan" \| "admin" |

#### Profile Content

| Column | Type | Nullable | Written By | Rendered At |
|--------|------|----------|------------|-------------|
| `bio` | text | Yes | Profile edit page | Profile detail, MemberCard |
| `avatar_url` | text | Yes | Profile edit (ImageUpload) | All profile surfaces |
| `city` | text | Yes | Profile edit page | Profile detail, MemberCard |
| `state` | text | Yes | Profile edit page | Profile detail |

#### Musical Profile Fields

| Column | Type | Nullable | Written By | Rendered At |
|--------|------|----------|------------|-------------|
| `instruments` | text[] | Yes | Profile edit page | Profile detail, MemberCard |
| `genres` | text[] | Yes | Profile edit page | Profile detail, MemberCard |
| `specialties` | text[] | Yes | Profile edit page | Profile detail |
| `featured_song_url` | text | Yes | Profile edit page | Profile detail |
| `song_links` | text[] | Yes | Profile edit page | Profile detail |

#### Social Links

| Column | Type | Nullable | Rendered At |
|--------|------|----------|-------------|
| `instagram_url` | text | Yes | Profile detail |
| `facebook_url` | text | Yes | Profile detail |
| `twitter_url` | text | Yes | Profile detail |
| `tiktok_url` | text | Yes | Profile detail |
| `youtube_url` | text | Yes | Profile detail |
| `spotify_url` | text | Yes | Profile detail |
| `website_url` | text | Yes | Profile detail |

#### Tipping / Support

| Column | Type | Nullable | Rendered At |
|--------|------|----------|-------------|
| `venmo_handle` | text | Yes | Profile detail ("Support This Songwriter") |
| `cashapp_handle` | text | Yes | Profile detail |
| `paypal_url` | text | Yes | Profile detail |

#### Collaboration Flags

| Column | Type | Nullable | Rendered At |
|--------|------|----------|-------------|
| `open_to_collabs` | boolean | Yes | Profile detail, MemberCard |
| `interested_in_cowriting` | boolean | Yes | Profile detail, MemberCard |
| `available_for_hire` | boolean | Yes | Profile detail, MemberCard |

#### Admin / Featured

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `is_featured` | boolean | Yes | Featured on homepage/directory |
| `featured_at` | timestamp | Yes | When featured |
| `featured_rank` | integer | Yes | Sort order among featured |

#### State Management

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `onboarding_complete` | boolean | Yes | Gates redirect to onboarding |
| `last_active_at` | timestamp | Yes | Activity tracking |
| `no_show_count` | integer | Yes | Reliability tracking |

### Implicit "Roles" and Assumptions

1. **`role` enum is legacy** — New code uses `is_*` boolean flags
2. **Queries check BOTH** — e.g., `or("is_songwriter.eq.true,role.eq.performer")` for backward compatibility
3. **`is_public` controls visibility** — Must be `true` to appear in directory
4. **At least one flag required for directory** — Query uses `or("is_songwriter.eq.true,is_host.eq.true,is_studio.eq.true,is_fan.eq.true")`

---

## 3. Rendering Surfaces & Assumptions

### Member Card Component

**File:** `web/src/components/members/MemberCard.tsx` (207 lines)

#### Required Fields for Rendering

| Field | Required | Fallback |
|-------|----------|----------|
| `id` or `slug` | Yes | N/A (link generation) |
| `full_name` | No | "Anonymous Member" |
| `avatar_url` | No | Initials placeholder |
| Identity flag(s) | No | Label = "Member" |

#### Label Logic (lines 66-83)

```typescript
function getLabel(member: Member): string {
  if (isMemberStudio(member)) return "Studio";
  if (isMemberSongwriter(member) && isMemberHost(member)) return "Songwriter & Host";
  if (isMemberSongwriter(member)) return "Songwriter";
  if (isMemberHost(member)) return "Host";
  if (isMemberFan(member)) return "Fan";
  return "Member";
}
```

#### Profile Link Routing (lines 89-96)

```typescript
function getProfileLink(member: Member): string {
  const identifier = member.slug || member.id;
  if (isMemberStudio(member)) return `/studios/${identifier}`;
  return `/songwriters/${identifier}`;  // All others go to /songwriters
}
```

**Finding:** Fan-only members route to `/songwriters/[id]` — the route name assumes "songwriter."

### Member Detail Page

**File:** `web/src/app/songwriters/[id]/page.tsx` (200+ lines)

#### Query Filter (lines 29-41)

```typescript
.or("is_songwriter.eq.true,is_host.eq.true,role.in.(performer,host)")
```

**Finding:** Fan-only profiles are NOT accessible at `/songwriters/[id]` — the query filters them out.

#### Songwriter-Specific Sections Rendered

| Section | Condition | Line |
|---------|-----------|------|
| Identity badges | Always shown if flags set | 81-102 |
| Collaboration badges | `open_to_collabs`, `interested_in_cowriting`, `available_for_hire` | 104-131 |
| About (bio) | Always | 157-162 |
| Genres | `genres?.length > 0` | 168-182 |
| Instruments & Skills | `instruments?.length > 0` | 185-199 |
| Specialties | `specialties?.length > 0` | Not shown in first 200 lines |
| Listen to My Music | `song_links` present | Later in file |
| Support This Songwriter | Tip links present | Later in file |
| Upcoming Performances | Placeholder | Later in file |
| Profile Comments | Always | Later in file |

### Members Listing Page

**File:** `web/src/app/members/page.tsx` (96 lines)

#### Query (lines 60-67)

```typescript
.from("profiles")
.select("*")
.eq("is_public", true)
.or("is_songwriter.eq.true,is_host.eq.true,is_studio.eq.true,is_fan.eq.true")
.order("is_featured", { ascending: false })
.order("featured_rank", { ascending: true })
.order("full_name", { ascending: true });
```

**Finding:** Fan-only members DO appear in `/members` listing (if `is_public=true` and `is_fan=true`).

### Songwriters Listing Page

**File:** `web/src/app/songwriters/page.tsx` (62 lines)

#### Query (lines 31-38)

```typescript
.from("profiles")
.select("*")
.eq("is_public", true)
.or("is_songwriter.eq.true,role.eq.performer")
```

**Finding:** This page only shows songwriters — hosts, studios, and fans are excluded.

### What Becomes Irrelevant for Fan-Only Members

| Field/Section | Relevance for Fan | Current Behavior |
|---------------|-------------------|------------------|
| `instruments` | Irrelevant | Still shown if populated (shouldn't be) |
| `genres` | Irrelevant | Still shown if populated |
| `specialties` | Irrelevant | Still shown if populated |
| `song_links` | Irrelevant | Still shown if populated |
| `featured_song_url` | Irrelevant | Still shown if populated |
| Tip links | Irrelevant | Still shown if populated |
| Collaboration badges | Irrelevant | Still shown if set |

### Profile Edit Page Conditional Rendering

**File:** `web/src/app/(protected)/dashboard/profile/page.tsx`

| Section | Condition | Lines |
|---------|-----------|-------|
| Music & Skills | `formData.is_songwriter` | 538 |
| Collaboration & Availability | `formData.is_songwriter` | 841 |
| Featured Song | `formData.is_songwriter` | 909 |
| Additional Songs | `formData.is_songwriter` | 932 |
| View Public Profile link | `formData.is_songwriter` | 1149 |

**Finding:** Profile edit page correctly hides songwriter-specific sections when `is_songwriter=false`. However, profile detail page does NOT have these guards — it will show any populated fields.

---

## 4. Existing Host / Organizer Concept (Current State)

### How "Host" is Represented Today

#### A) Profile Identity Flag

| Column | Table | Purpose |
|--------|-------|---------|
| `is_host` | `profiles` | Self-declared "I host open mics" identity |

**Set during:** Onboarding (checkbox) or profile edit
**Grants:** Badge display only — does NOT grant event creation permissions

#### B) Event Ownership

| Column | Table | Purpose |
|--------|-------|---------|
| `host_id` | `events` | Primary host/owner of an event |

**Set during:** Event creation (auto-assigned to creator) or claim approval
**Grants:** Full edit access to event

#### C) Co-Host Table

**Table:** `event_hosts` (database.types.ts)

| Column | Type | Purpose |
|--------|------|---------|
| `event_id` | UUID | FK to events |
| `user_id` | UUID | FK to profiles |
| `role` | enum | "host" \| "cohost" |
| `invitation_status` | enum | "pending" \| "accepted" \| "declined" |

**Purpose:** Track co-hosts invited by primary host

#### D) Approved Hosts Table

**Table:** `approved_hosts` (database.types.ts lines 100-129)

| Column | Type | Purpose |
|--------|------|---------|
| `user_id` | UUID | FK to profiles |
| `status` | text | "active" \| other |
| `approved_by` | UUID | Admin who approved |
| `approved_at` | timestamp | When approved |

**Purpose:** Grant DSC event creation permission

### Approved Host Check

**File:** `web/src/lib/auth/adminAuth.ts` lines 57-76

```typescript
export async function checkHostStatus(supabase, userId): Promise<boolean> {
  // Admins are automatically hosts
  const isAdmin = await checkAdminRole(supabase, userId);
  if (isAdmin) return true;

  // Check approved_hosts table
  const { data: hostStatus } = await supabase
    .from("approved_hosts")
    .select("status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return !!hostStatus;
}
```

### What Approved Host Grants

**File:** `web/src/app/(protected)/dashboard/my-events/new/page.tsx` lines 16-24

```typescript
const isApprovedHost = await checkHostStatus(supabase, session.user.id);
const isAdmin = profile?.role === "admin";
const canCreateDSC = isApprovedHost || isAdmin;
```

**Permission:** `canCreateDSC` controls visibility of "Is this a DSC Event?" toggle in EventForm

### "Open Mic Host" vs "Happenings Host"

**Current Label (profile detail):** "🎤 Open Mic Host" (lines 87-90 in songwriters/[id]/page.tsx)

**Label in onboarding:** "I host open mics" with helper text "I host or co-host open mic nights" (onboarding/profile/page.tsx lines 329-336)

**No explicit "Happenings Host" concept exists** — the system conflates:
1. Self-declared identity (`is_host` flag)
2. Event hosting permission (approved_hosts table)
3. Event ownership (events.host_id)

### Gaps Relative to Generalized "Happenings Host" Role

| Gap | Current State | Impact |
|-----|---------------|--------|
| Label says "open mic" | UI copy locked to "open mic host" | Misleading for non-open-mic hosts |
| `is_host` description | "I host or co-host open mic nights" | Excludes showcase, workshop, gig hosts |
| No role differentiation | All hosts treated identically | Cannot distinguish event type expertise |
| Permission model | `approved_hosts` grants DSC toggle only | "Host" identity separate from permissions |

---

## 5. Venue Manager & Claims System (Current State)

### Tables

| Table | Purpose | Migration |
|-------|---------|-----------|
| `venue_managers` | Links users to venues with roles | `20260112000000_abc8_venue_claiming.sql` |
| `venue_claims` | Tracks claim requests | Same |
| `venue_invites` | Admin-issued invite tokens | Same |

### venue_managers Schema

| Column | Type | Purpose |
|--------|------|---------|
| `venue_id` | UUID | FK to venues |
| `user_id` | UUID | FK to profiles |
| `role` | enum | "owner" \| "manager" |
| `grant_method` | enum | "claim" \| "invite" \| "admin" |
| `revoked_at` | timestamp | Soft-delete |

### Claim Flow

1. User clicks "Claim this venue" (`ClaimVenueButton.tsx`)
2. Creates `venue_claims` row with status="pending"
3. Admin reviews at `/dashboard/admin/venue-claims`
4. Approve → creates `venue_managers` row with role="owner", grant_method="claim"
5. Reject → updates claim status, sends rejection email

### Invite Flow

1. Admin creates invite at `/dashboard/admin/venues/[id]`
2. Creates `venue_invites` row with hashed token
3. User clicks invite URL
4. Accept → creates `venue_managers` row with role="manager", grant_method="invite"

### Authorization Helper

**File:** `web/src/lib/venue/managerAuth.ts`

| Function | Purpose |
|----------|---------|
| `isVenueManager(supabase, venueId, userId)` | Check any role |
| `isVenueOwner(supabase, venueId, userId)` | Check owner role only |
| `canEditVenue(supabase, venueId, userId)` | Edit permission check |
| `getManagedVenues(supabase, userId)` | Get user's venues |

### How Venue Manager Differs from Host

| Concept | Host | Venue Manager |
|---------|------|---------------|
| **Target entity** | Events | Venues |
| **Permission storage** | `approved_hosts` + `events.host_id` + `event_hosts` | `venue_managers` |
| **Claim approval** | `event_claims` table | `venue_claims` table |
| **Invite system** | Co-host invitations only | Admin-issued venue invites |
| **Roles** | host \| cohost | owner \| manager |
| **Self-declared identity** | `profiles.is_host` | No equivalent flag (no `is_venue_manager`) |

---

## 6. External-Link Happenings Feasibility (Facts Only)

### Fields Supporting External URLs

| Column | Table | Purpose | Form Field |
|--------|-------|---------|------------|
| `signup_url` | `events` | External signup link | "Signup URL" |
| `signup_mode` | `events` | "walk_in" \| "in_person" \| "online" \| "both" | "External Signup Method" |
| `online_url` | `events` | Online event URL (for virtual events) | Not in current form |

### RSVP/Comments/Timeslots Binding

All three systems bind to `event_id` (and `date_key` for recurring events):

| Table | Foreign Key | Binding |
|-------|-------------|---------|
| `event_rsvps` | `event_id` | On-site RSVP tracking |
| `event_comments` | `event_id` | On-site comments |
| `event_timeslots` | `event_id` | Performer slot management |
| `timeslot_claims` | `timeslot_id` → `event_timeslots.id` | Performer claims |

**Evidence:** `app/events/[id]/page.tsx` lines 497-535 show queries binding by `event_id`

### Can an Event Function as Directory Listing + Internal Features?

**Yes.** The presence of `signup_url` does NOT disable internal features:

| Feature | Availability | Condition |
|---------|--------------|-----------|
| On-site RSVP | Available | Event is published, not cancelled, has capacity or unlimited |
| On-site Comments | Available | Event exists |
| On-site Timeslots | Available | `has_timeslots=true` |
| External signup link | Available | `signup_url` is set |

**Evidence:** HappeningCard (line 86) shows `signup_url` as a field but doesn't gate any features.

### Blockers / Constraints

| Constraint | Description | Impact |
|------------|-------------|--------|
| No `signup_url` display | HappeningCard doesn't render external signup link | Users must go to detail page |
| No external ticketing | No Eventbrite/Ticketmaster integration | Manual URL entry only |
| No deduplication | Same event could exist on DSC and external platform | Potential confusion |

### Schema Adequacy

**Verdict:** Current schema supports "directory listing + internal features" pattern without modification.

---

## 7. Role Model Clarification (Facts, Not Decisions)

### Proposed Role Model (from BACKLOG.md P0 spec)

> "Everyone is inherently a 'fan' of original music. Some users are fan-only. Others are fans + performers / hosts / venue managers."

### Current System Behavior

#### Where "Fan" is Implicit/Invisible

| Surface | Behavior | Evidence |
|---------|----------|----------|
| Onboarding | Fan is optional checkbox, not default | `onboarding/profile/page.tsx` line 361 |
| Profile edit | Fan checkbox alongside others | `dashboard/profile/page.tsx` line 523 |
| Member listing query | `is_fan.eq.true` is one of four options | `members/page.tsx` line 64 |
| Songwriters listing | Fan NOT included | `songwriters/page.tsx` line 35 |
| Profile completeness | Any identity flag counts | `completeness.ts` line 72-74 |

#### Current Identity Flag Semantics

| Flag | Meaning | Exclusive? |
|------|---------|------------|
| `is_songwriter` | "I write, perform, or record music" | No |
| `is_host` | "I host or co-host open mic nights" | No |
| `is_studio` | "I offer recording, mixing, or production services" | No |
| `is_fan` | "I love live music and supporting local artists" | No |

**Multiple flags can be true simultaneously.**

### What Would Change for "Fan-Only" to be Explicit

| Current | Proposed Change |
|---------|-----------------|
| User with no flags = "Member" | User with only `is_fan=true` = "Fan" |
| Fan badge only shows if ONLY `is_fan` is true | Fan is implicit for everyone |
| Profile detail shows songwriter sections | Hide sections for fan-only users |
| Profile detail route is `/songwriters/[id]` | Needs fan-friendly route or universal `/members/[id]` |

### Evidence: Fan Badge Suppression Logic

**File:** `app/songwriters/[id]/page.tsx` lines 96-101

```typescript
{/* Fan badge - low prominence, only show if no other badges */}
{songwriter.is_fan && !songwriter.is_songwriter && !songwriter.is_host && !songwriter.is_studio && (
  <span className="...">Music Supporter</span>
)}
```

**Finding:** Fan badge intentionally de-emphasized — only appears if user has NO other identities.

---

## 8. Existing Members Alignment Check

### Expected Member Count

Based on BACKLOG.md: "~6 expected members"

### Current Schema Query Requirements

To identify existing members functionally, we need to check:
1. `profiles` table entries with `onboarding_complete=true` OR any identity flag set
2. `approved_hosts` table for host permissions
3. `venue_managers` table for venue management

### Role Determination Matrix

| Profile State | Functional Role(s) |
|---------------|-------------------|
| `is_songwriter=true` | Songwriter |
| `is_host=true` | Host (identity only) |
| `approved_hosts.status='active'` | Approved Host (permission) |
| `venue_managers` entry exists | Venue Manager |
| `is_fan=true` only | Fan |
| `role='admin'` | Admin |

### Migration / Alignment Requirements

| Scenario | Action Required |
|----------|-----------------|
| User has `is_songwriter=true` | None — already categorized |
| User has `is_host=true` | None — already categorized |
| User has approved_hosts entry | None — permission separate from identity |
| User has venue_managers entry | **UNKNOWN** — no `is_venue_manager` flag exists |
| User has no identity flags | Could add `is_fan=true` as default |

### Key Question: Can Existing Members Remain Unchanged?

**Yes, with caveats:**

1. **Identity flags are additive** — Adding role selection doesn't invalidate existing data
2. **No schema migration required** — All role flags already exist
3. **Default fan assumption** — Could treat all existing members as implicit fans without storing
4. **Venue manager gap** — No profile flag for venue manager identity

### UNKNOWN: Actual Member Data

To complete this section, need to query production database:
```sql
SELECT
  id, full_name, is_songwriter, is_host, is_studio, is_fan, role,
  (SELECT status FROM approved_hosts WHERE user_id = profiles.id) as host_status,
  (SELECT COUNT(*) FROM venue_managers WHERE user_id = profiles.id AND revoked_at IS NULL) as venue_count
FROM profiles
WHERE onboarding_complete = true OR is_songwriter = true OR is_host = true OR is_studio = true OR is_fan = true;
```

---

## 9. Terminology Note (No Decision)

### Backlog Preference

From BACKLOG.md P0 spec:
> "Note backlog preference to rename: 'Open Mic Host / Organizer' → 'Happenings Host / Organizer'"

### Current "Open Mic Host" Label Locations

| File | Line | Current Text |
|------|------|--------------|
| `app/songwriters/[id]/page.tsx` | 88 | "🎤 Open Mic Host" |
| `app/performers/[id]/page.tsx` | 62 | "🎤 Open Mic Host" |
| `app/page.tsx` | 315 | "🎤 an open mic host or live music venue" |
| `app/spotlight/page.tsx` | 81 | "Open Mic Host" |
| `components/hosts/HostCard.tsx` | 62 | "Open Mic Host" |
| `components/forms/VolunteerSignupForm.tsx` | 14 | "Open Mic Hosting" |
| `app/onboarding/profile/page.tsx` | 331 | "I host open mics" |
| `app/(protected)/dashboard/profile/page.tsx` | 504 | "I host open mics" |

### Other Host-Related Text

| File | Text | Context |
|------|------|---------|
| `onboarding/profile/page.tsx` | "I host or co-host open mic nights" | Helper text |
| `dashboard/profile/page.tsx` | "I host or co-host open mic nights" | Helper text |

---

## 10. Findings Summary

### Key Constraints

1. **Onboarding only saves 5 fields** — Other collected data (bio, social, instruments) is NOT persisted
2. **Fan-only profiles inaccessible** — `/songwriters/[id]` query excludes `is_fan`-only profiles
3. **Route naming assumes songwriter** — `/songwriters` route used for all non-studio profiles
4. **No venue manager identity flag** — `is_venue_manager` doesn't exist in profiles
5. **Host terminology locked to "open mic"** — 8+ files have hardcoded "open mic host" text

### Key Coupling Points

| Coupling | Files Affected |
|----------|----------------|
| Profile → Member listing | `members/page.tsx`, `songwriters/page.tsx` |
| Profile → Detail page access | `songwriters/[id]/page.tsx` query filter |
| Profile → Card routing | `MemberCard.tsx` `getProfileLink()` |
| Profile flags → Completeness | `completeness.ts` identity check |
| approved_hosts → DSC toggle | `adminAuth.ts`, `new/page.tsx` |

### Explicit UNKNOWNs

| Unknown | How to Resolve |
|---------|----------------|
| Actual existing member count and data | Query production database |
| Whether onboarding data loss is intentional | Check git history / ask Sami |
| Profile completeness for fan-only users | Review if current weights make sense |
| Whether `/songwriters` route should be renamed | Product decision |

---

## Key File Paths Index

### Signup / Onboarding

| File | Purpose |
|------|---------|
| `web/src/app/signup/page.tsx` | Signup form |
| `web/src/app/auth/callback/route.ts` | Auth callback routing |
| `web/src/app/onboarding/profile/page.tsx` | Onboarding wizard |
| `web/src/app/api/onboarding/route.ts` | Onboarding save endpoint |

### Profile Schema & Types

| File | Purpose |
|------|---------|
| `web/src/lib/supabase/database.types.ts` | Generated types |
| `web/src/types/index.ts` | Application types |
| `web/src/lib/profile/completeness.ts` | Scoring logic |
| `web/src/lib/profile/options.ts` | Instrument/genre lists |

### Profile Rendering

| File | Purpose |
|------|---------|
| `web/src/app/songwriters/page.tsx` | Songwriters listing |
| `web/src/app/songwriters/[id]/page.tsx` | Profile detail |
| `web/src/app/members/page.tsx` | Members listing |
| `web/src/components/members/MemberCard.tsx` | Member card component |
| `web/src/app/(protected)/dashboard/profile/page.tsx` | Profile edit |

### Host / Organizer System

| File | Purpose |
|------|---------|
| `web/src/lib/auth/adminAuth.ts` | Host permission checks |
| `web/src/app/(protected)/dashboard/my-events/new/page.tsx` | Event creation |
| `web/src/components/events/HostControls.tsx` | Host controls UI |
| `web/src/components/events/ClaimEventButton.tsx` | Event claiming |

### Venue Manager System

| File | Purpose |
|------|---------|
| `web/src/lib/venue/managerAuth.ts` | Venue permissions |
| `web/src/components/venue/ClaimVenueButton.tsx` | Venue claiming |
| `web/src/app/(protected)/dashboard/my-venues/page.tsx` | User's venues |

### Events / External Links

| File | Purpose |
|------|---------|
| `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` | Event form with signup_url |
| `web/src/components/happenings/HappeningCard.tsx` | Card rendering |
| `web/src/app/events/[id]/page.tsx` | Event detail with RSVP/comments/timeslots |

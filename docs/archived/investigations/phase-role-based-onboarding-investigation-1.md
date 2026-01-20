# Investigation #1 — Role-Based Onboarding + Existing Members Alignment + Terminology

**Status:** INVESTIGATION COMPLETE
**Date:** January 2026
**Author:** Claude (Agent)
**Mode:** Investigation only — no code changes

---

## Executive Summary

This investigation builds on the Phase Role-Based Onboarding Audit to provide:
1. A complete mapping of role flags and permissions
2. Routing accessibility analysis for different user types
3. SQL queries for existing member alignment checks
4. Terminology rename plan ("Open Mic Host" → "Happenings Host")
5. Role-based onboarding spec readiness checklist

**Critical Finding:** Fan-only profiles have no accessible detail page. The `/members/[id]` route does NOT exist — only `/members` (listing page) exists.

---

## Task A: Role Flags + Permissions Model

### Identity Flags (profiles table)

| Flag | Column | Default | Purpose |
|------|--------|---------|---------|
| Songwriter | `is_songwriter` | `false` | Primary creative identity |
| Host | `is_host` | `false` | Can host happenings |
| Studio | `is_studio` | `false` | Recording studio identity |
| Fan | `is_fan` | `true` | Music supporter identity |

**Key Discovery:** `is_fan` defaults to `true` for new users. This ensures all members appear in `/members` listing regardless of other flags.

### Legacy Role Enum (profiles.role)

| Value | Current Usage |
|-------|---------------|
| `performer` | Legacy, mapped to songwriter in UI |
| `songwriter` | Legacy, mapped to songwriter in UI |
| `host` | Legacy, mapped to host in UI |
| `studio` | Legacy, mapped to studio in UI |
| `fan` | Legacy, mapped to fan in UI |
| `member` | Default fallback |
| `admin` | **ACTIVE** — Used for admin authorization checks |

**File Reference:** `web/src/lib/auth/adminAuth.ts:28-43`
```typescript
export async function checkAdminRole(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return profile.role === "admin";
}
```

### Permission Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `approved_hosts` | Host approval status | `user_id`, `status` ("pending"/"active"/"revoked") |
| `venue_managers` | Venue management rights | `user_id`, `venue_id`, `role` ("owner"/"manager") |
| `event_hosts` | Per-event host assignments | `event_id`, `user_id`, `is_primary` |

### Authorization Check Functions

| Function | File | Purpose |
|----------|------|---------|
| `isSuperAdmin(email)` | `adminAuth.ts:16-18` | Check super admin by email |
| `checkAdminRole(supabase, userId)` | `adminAuth.ts:28-43` | Check admin role from profiles |
| `checkHostStatus(supabase, userId)` | `adminAuth.ts:57-76` | Check if user can act as host |

**Host Status Logic** (`adminAuth.ts:57-76`):
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

---

## Task B: Routing + Accessibility Analysis

### Profile Detail Routes

| Route | Query Filter | Who Can Access |
|-------|--------------|----------------|
| `/songwriters/[id]` | `is_songwriter.eq.true,is_host.eq.true,role.in.(performer,host)` | Songwriters, Hosts (legacy included) |
| `/performers/[id]` | `is_songwriter.eq.true,is_host.eq.true,role.in.(performer,host)` | Same as songwriters (redirects) |
| `/studios/[id]` | `is_studio.eq.true,role.eq.studio` | Studios only |
| `/members/[id]` | **DOES NOT EXIST** | N/A |

### Profile Listing Routes

| Route | Query Filter | Who Appears |
|-------|--------------|-------------|
| `/songwriters` | `is_songwriter.eq.true,is_host.eq.true,role.in.(performer,host)` | Songwriters + Hosts |
| `/members` | `is_songwriter.eq.true,is_host.eq.true,is_studio.eq.true,is_fan.eq.true` | ALL with any identity flag |
| `/studios` | `is_studio.eq.true` | Studios only |

### Critical Accessibility Gap

**Fan-Only Profile Detail Access:**

A user with ONLY `is_fan=true` (no other identity flags):
- ✅ Appears in `/members` listing
- ❌ Cannot access `/songwriters/[id]` (query filter excludes)
- ❌ Cannot access `/studios/[id]` (query filter excludes)
- ❌ `/members/[id]` route does not exist

**MemberCard Link Routing** (`MemberCard.tsx:89-96`):
```typescript
function getProfileLink(member: Member): string {
  const identifier = member.slug || member.id;
  if (isMemberStudio(member)) return `/studios/${identifier}`;
  // All other members (songwriters, hosts, fans) go to /songwriters/[id]
  return `/songwriters/${identifier}`;
}
```

**Result:** MemberCard links fan-only users to `/songwriters/[id]`, which returns 404 because the query filter excludes them.

### Host-Only Users

A user with ONLY `is_host=true`:
- ✅ Appears in `/members` listing
- ✅ Can access `/songwriters/[id]` (query includes `is_host.eq.true`)
- ✅ MemberCard links correctly to `/songwriters/[id]`

### Venue Manager Users

Venue managers have no special profile visibility. They appear based on their identity flags, not their venue management status.

---

## Task C: Existing Members Alignment SQL Queries

### Query 1: All Members with Identity Flags

```sql
-- Copy/paste ready for Supabase SQL Editor
SELECT
  id,
  full_name,
  email,
  role,
  is_songwriter,
  is_host,
  is_studio,
  is_fan,
  is_public,
  onboarding_complete,
  created_at
FROM profiles
WHERE
  is_songwriter = true
  OR is_host = true
  OR is_studio = true
  OR is_fan = true
ORDER BY created_at DESC;
```

### Query 2: Fan-Only Members (Accessibility Issue)

```sql
-- Members who ONLY have is_fan=true (will have broken profile links)
SELECT
  id,
  full_name,
  email,
  is_fan,
  is_songwriter,
  is_host,
  is_studio
FROM profiles
WHERE
  is_fan = true
  AND is_songwriter = false
  AND is_host = false
  AND is_studio = false;
```

### Query 3: Legacy Role vs Identity Flag Mismatch

```sql
-- Check for mismatches between legacy role and identity flags
SELECT
  id,
  full_name,
  role AS legacy_role,
  is_songwriter,
  is_host,
  is_studio,
  is_fan,
  CASE
    WHEN role = 'performer' AND is_songwriter = false THEN 'MISMATCH: role=performer but is_songwriter=false'
    WHEN role = 'songwriter' AND is_songwriter = false THEN 'MISMATCH: role=songwriter but is_songwriter=false'
    WHEN role = 'host' AND is_host = false THEN 'MISMATCH: role=host but is_host=false'
    WHEN role = 'studio' AND is_studio = false THEN 'MISMATCH: role=studio but is_studio=false'
    ELSE 'OK'
  END AS alignment_status
FROM profiles
WHERE role IN ('performer', 'songwriter', 'host', 'studio');
```

### Query 4: Approved Hosts Status

```sql
-- All approved hosts with their profile identity flags
SELECT
  ah.user_id,
  ah.status AS approved_host_status,
  p.full_name,
  p.is_host AS profile_is_host,
  p.role AS legacy_role
FROM approved_hosts ah
LEFT JOIN profiles p ON ah.user_id = p.id
ORDER BY ah.status, p.full_name;
```

### Query 5: Venue Managers

```sql
-- All venue managers with their venues
SELECT
  vm.user_id,
  vm.venue_id,
  vm.role AS venue_role,
  v.name AS venue_name,
  p.full_name,
  p.is_host AS profile_is_host
FROM venue_managers vm
LEFT JOIN venues v ON vm.venue_id = v.id
LEFT JOIN profiles p ON vm.user_id = p.id
WHERE vm.revoked_at IS NULL
ORDER BY v.name, vm.role;
```

### Query 6: Profile Completeness Check

```sql
-- Profile completeness for existing members
SELECT
  id,
  full_name,
  CASE WHEN avatar_url IS NOT NULL THEN 1 ELSE 0 END AS has_avatar,
  CASE WHEN bio IS NOT NULL AND LENGTH(bio) >= 50 THEN 1 ELSE 0 END AS has_bio,
  CASE WHEN genres IS NOT NULL AND array_length(genres, 1) > 0 THEN 1 ELSE 0 END AS has_genres,
  CASE WHEN instruments IS NOT NULL AND array_length(instruments, 1) > 0 THEN 1 ELSE 0 END AS has_instruments,
  is_public,
  onboarding_complete
FROM profiles
WHERE
  is_songwriter = true
  OR is_host = true
  OR is_studio = true
ORDER BY full_name;
```

---

## Task D: Terminology Rename Plan

### Current State: "Open Mic Host" Terminology

Found in **11 files**:

| File | Line(s) | Current Text |
|------|---------|--------------|
| `app/page.tsx` | 315 | "an open mic host or live music venue" |
| `app/spotlight/page.tsx` | 81 | "Open Mic Host" |
| `app/songwriters/[id]/page.tsx` | 88 | "Open Mic Host" |
| `app/performers/[id]/page.tsx` | 62 | "Open Mic Host" |
| `app/onboarding/profile/page.tsx` | 331, 334 | "Open Mic Host" |
| `app/(protected)/dashboard/profile/page.tsx` | 504, 505 | "Open Mic Host" |
| `components/hosts/HostCard.tsx` | 62 | "Open Mic Host" |
| `components/forms/VolunteerSignupForm.tsx` | 14 | "Open Mic Host" |

### Proposed Change: "Open Mic Host" → "Happenings Host"

**Rationale:**
- DSC hosts various event types, not just open mics
- "Happenings" is the canonical term used throughout the site
- Broader term covers: open mics, showcases, jam sessions, kindred groups, etc.

### Impacted Surfaces

| Surface | File | Change Required |
|---------|------|-----------------|
| Homepage | `app/page.tsx:315` | "a happenings host or live music venue" |
| Spotlight page | `app/spotlight/page.tsx:81` | "Happenings Host" |
| Songwriter profile badge | `app/songwriters/[id]/page.tsx:88` | "Happenings Host" |
| Performer profile badge | `app/performers/[id]/page.tsx:62` | "Happenings Host" |
| Onboarding wizard | `app/onboarding/profile/page.tsx:331,334` | "Happenings Host" |
| Dashboard profile | `dashboard/profile/page.tsx:504,505` | "Happenings Host" |
| Host card component | `components/hosts/HostCard.tsx:62` | "Happenings Host" |
| Volunteer form | `components/forms/VolunteerSignupForm.tsx:14` | "Happenings Host" |

### Implementation Plan (Single PR)

1. Create find/replace script or manual edits
2. Change all instances of "Open Mic Host" → "Happenings Host"
3. Change "an open mic host" → "a happenings host" (grammar)
4. Update any related copy mentioning "open mic" in host context
5. Run lint + tests
6. Single PR with all changes

**Estimated Effort:** 30 minutes (copy changes only, no logic changes)

---

## Task E: Role-Based Onboarding Spec Readiness Checklist

### Pre-requisites (Must Complete Before Spec)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Decide fan-only profile accessibility | ❌ DECISION NEEDED | Create `/members/[id]` or require secondary identity? |
| 2 | Decide if legacy `role` enum can be deprecated | ❌ DECISION NEEDED | Currently only used for admin checks |
| 3 | Confirm identity flag combinations | ❌ DECISION NEEDED | Can user be both songwriter AND studio? |
| 4 | Define host approval workflow | ⚠️ EXISTS | `approved_hosts` table exists but UI unclear |
| 5 | Audit onboarding data persistence | ✅ AUDITED | Only 5 fields saved (data loss for bio, links, etc.) |

### Readiness Checklist

| # | Spec Section | Ready? | Blockers |
|---|--------------|--------|----------|
| 1 | User personas | ⚠️ Partial | Fan-only accessibility TBD |
| 2 | Onboarding flow diagram | ⚠️ Partial | Data persistence gap must be fixed |
| 3 | Identity selection UI | ✅ Ready | Component exists in `onboarding/profile/page.tsx` |
| 4 | Profile completeness scoring | ✅ Ready | `lib/profile/completeness.ts` complete |
| 5 | Routing rules by identity | ❌ Blocked | Fan-only profile route decision needed |
| 6 | Permission matrix | ⚠️ Partial | Venue manager permissions need clarification |
| 7 | Host approval flow | ⚠️ Partial | UI exists but flow unclear |
| 8 | Database schema | ✅ Ready | Tables exist, schema documented |
| 9 | API contracts | ⚠️ Partial | Onboarding API needs expansion for all fields |
| 10 | Test coverage | ⚠️ Partial | Need tests for routing edge cases |

### Data Persistence Gap (Critical)

**Current State:** Onboarding UI collects 15+ fields but API only saves 5.

| Collected in UI | Persisted? |
|-----------------|------------|
| `full_name` | ✅ Yes |
| `is_songwriter` | ✅ Yes |
| `is_host` | ✅ Yes |
| `is_studio` | ✅ Yes |
| `is_fan` | ✅ Yes |
| `bio` | ❌ NO |
| `instruments` | ❌ NO |
| `genres` | ❌ NO |
| `instagram_url` | ❌ NO |
| `twitter_url` | ❌ NO |
| `website_url` | ❌ NO |
| `available_for_hire` | ❌ NO |
| `interested_in_cowriting` | ❌ NO |

**Impact:** Users complete onboarding expecting data to be saved, then find empty profiles.

---

## Explicit UNKNOWNs

| # | Unknown | Impact | Resolution Path |
|---|---------|--------|-----------------|
| 1 | Should fan-only users have profile detail pages? | Broken links in production | Create `/members/[id]` or enforce secondary identity |
| 2 | Can a user select multiple identities (songwriter + studio)? | UI allows but edge cases untested | Product decision needed |
| 3 | What happens when approved host loses approval? | `revoked` status exists but UI unclear | Audit revocation flow |
| 4 | Are venue managers automatically hosts? | Unclear from code | Product decision needed |
| 5 | Why is onboarding data not persisted? | Bug or intentional? | Fix API or update UI |

---

## STOP-GATE Section

### Decisions Sami Must Make Next

1. **Fan-Only Profile Accessibility**
   - Option A: Create `/members/[id]` route (new development)
   - Option B: Require fan-only users to select additional identity
   - Option C: Hide fan-only profiles from `/members` listing
   - **Recommendation:** Option A (most inclusive, matches platform philosophy)

2. **Legacy Role Enum**
   - Option A: Keep for admin checks, deprecate for all else
   - Option B: Migrate admin check to dedicated `is_admin` flag
   - Option C: No change (maintain dual system)
   - **Recommendation:** Option B (cleaner long-term)

3. **Terminology Rename**
   - Confirm "Open Mic Host" → "Happenings Host" change
   - **Recommendation:** Approve (aligns with branding)

4. **Onboarding Data Persistence**
   - Option A: Fix API to save all collected fields
   - Option B: Remove unsaved fields from UI
   - **Recommendation:** Option A (users expect data to be saved)

5. **Identity Combinations**
   - Can someone be both songwriter AND studio?
   - Can someone be host AND NOT songwriter?
   - **Recommendation:** Allow all combinations (flexibility)

### Safest Next Implementation Slice

**Recommended First PR: Fix Fan-Only Profile 404s**

Scope:
1. Create `/members/[id]/page.tsx` route
2. Query: `SELECT * FROM profiles WHERE id = $1 AND is_public = true`
3. Display: Name, bio, avatar, social links (no songwriter-specific fields)
4. Update `MemberCard.tsx` routing logic to link fans to `/members/[id]`

Effort: ~2-3 hours
Risk: Low (additive, no breaking changes)
Test: Create fan-only test account, verify profile loads

### Risks + Regressions to Guard

| Risk | Mitigation |
|------|------------|
| Breaking existing profile links | Add redirect from old to new routes if needed |
| Query performance | Use existing index on `is_public` |
| Permission escalation | Ensure `/members/[id]` respects `is_public` flag |
| UI inconsistency | Use shared profile components where possible |
| Test coverage gaps | Add routing tests for all identity combinations |

---

## Files Referenced in This Investigation

| File | Purpose |
|------|---------|
| `web/src/lib/auth/adminAuth.ts` | Authorization check functions |
| `web/src/components/members/MemberCard.tsx` | Profile link routing |
| `web/src/app/members/page.tsx` | Members listing query |
| `web/src/app/songwriters/[id]/page.tsx` | Songwriter detail query |
| `web/src/app/onboarding/profile/page.tsx` | Onboarding wizard UI |
| `web/src/app/api/onboarding/route.ts` | Onboarding API (5 fields only) |
| `web/src/lib/profile/completeness.ts` | Profile completeness scoring |
| `web/src/app/page.tsx` | Homepage ("open mic host" text) |
| `web/src/app/spotlight/page.tsx` | Spotlight page |
| `web/src/components/hosts/HostCard.tsx` | Host card component |
| `web/src/components/forms/VolunteerSignupForm.tsx` | Volunteer form |
| `web/src/app/(protected)/dashboard/profile/page.tsx` | Dashboard profile |

---

## Appendix: Identity Flag Helper Functions

From `MemberCard.tsx:27-41`:

```typescript
function isMemberSongwriter(member: Member): boolean {
  return member.isSongwriter || member.role === "performer" || member.role === "songwriter";
}

function isMemberHost(member: Member): boolean {
  return member.isHost || member.role === "host";
}

function isMemberStudio(member: Member): boolean {
  return member.isStudio || member.role === "studio";
}

function isMemberFan(member: Member): boolean {
  return member.isFan || member.role === "fan";
}
```

These helpers maintain backward compatibility with the legacy `role` enum while preferring the new identity flags.

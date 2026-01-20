# Investigation: Member Profile Enhancements (Pre-Invite)

> **Status:** Investigation Complete — Awaiting Approval
> **Priority:** P0 (Pre-Test User Readiness)
> **Date:** 2026-01-17

---

## Executive Summary

This investigation covers three scope areas for member profile enhancements before the first external test user cohort:

- **SCOPE A:** 8 quick win PRs (badge row, empty states, card/detail consistency, fan polish, social ordering, canonicalization audit, follow CTA)
- **SCOPE B:** Member-managed profile image gallery (reuse existing gallery infrastructure)
- **SCOPE C:** Profile activity sections (blogs, galleries, events, RSVPs, timeslot claims)

All items are **investigation-only** — no code changes until Sami approves execution.

---

## SCOPE A: Quick Wins (8 PRs)

### A1. Badge Row Unification

**Problem:** Identity badges render inconsistently between MemberCard and detail pages.

**Evidence:**

| Location | File | Line | Current Behavior |
|----------|------|------|------------------|
| MemberCard | `components/members/MemberCard.tsx` | 66-83 | Combined label logic: `Songwriter & Host`, single pill |
| /members/[id] | `app/members/[id]/page.tsx` | 96-117 | Separate pills per identity, different styling |
| /songwriters/[id] | `app/songwriters/[id]/page.tsx` | 160-186 | Only shows Songwriter/Host pills, no Fan |

**Card Logic (MemberCard.tsx:66-83):**
```typescript
function getBadgeLabel(member: Member): string {
  const isSongwriter = isMemberSongwriter(member);
  const isHost = isMemberHost(member);
  // Combined labels like "Songwriter & Host"
}
```

**Detail Logic (/members/[id]/page.tsx:96-117):**
```typescript
{hasSongwriter && <span>Songwriter</span>}
{hasHost && <span>Host</span>}
{hasFan && <span>Fan</span>}
// Separate pills, different styling
```

**Fix Plan:**
1. Create shared `IdentityBadgeRow` component
2. Extract badge styling to shared CSS classes
3. Use in MemberCard, /members/[id], /songwriters/[id], /studios/[id]

**Files to Modify:**
- `components/members/MemberCard.tsx:66-83` — Extract logic
- `app/members/[id]/page.tsx:96-117` — Use shared component
- `app/songwriters/[id]/page.tsx:160-186` — Use shared component
- NEW: `components/profile/IdentityBadgeRow.tsx`

**Test Coverage:** Add 8-10 tests for combined identity scenarios.

---

### A2. Empty State Polish

**Problem:** Detail pages show inconsistent empty states for optional fields.

**Evidence:**

| Field | Location | Line | Current Empty State |
|-------|----------|------|---------------------|
| Bio | /songwriters/[id] | 160 | "This songwriter hasn't added a bio yet." |
| Genres | /songwriters/[id] | 180 | Silently hidden |
| Instruments | /songwriters/[id] | 192 | Silently hidden |
| Social Links | /members/[id] | 122-140 | Silently hidden |
| Featured Song | /songwriters/[id] | 234-256 | Section hidden entirely |

**Fix Plan:**
1. Define consistent empty state pattern: show field label + helpful prompt
2. Add "Add your [field]" CTA for profile owner viewing their own page
3. For non-owners, show muted "(Not provided)" text

**Files to Modify:**
- `app/members/[id]/page.tsx:122-140` — Add empty state patterns
- `app/songwriters/[id]/page.tsx:160-256` — Consistent empty states
- `app/studios/[id]/page.tsx` — Apply same patterns

---

### A3. Card/Detail Consistency Audit

**Problem:** Fields shown on cards may not match detail pages.

**Audit Results:**

| Field | MemberCard | /members/[id] | /songwriters/[id] |
|-------|------------|---------------|-------------------|
| Avatar | ✅ | ✅ | ✅ |
| Name | ✅ | ✅ | ✅ |
| Identity Badge | ✅ (combined) | ✅ (separate) | ✅ (partial) |
| Location | ✅ (city, state) | ✅ | ✅ |
| Bio | ✅ (truncated) | ✅ | ✅ |
| Genres | ✅ (pills) | ❌ hidden | ✅ |
| Instruments | ✅ (pills) | ❌ hidden | ✅ |
| Social Links | ✅ | ✅ | ✅ |
| Availability | ✅ (collabs, hire) | ? | ✅ |
| Featured Song | ❌ | ❌ | ✅ |

**Fix Plan:**
1. Add genres/instruments display to /members/[id] (currently missing)
2. Ensure field visibility matches between card preview and detail page

**Files to Modify:**
- `app/members/[id]/page.tsx` — Add genres/instruments sections

---

### A4. Fan Profile Polish

**Problem:** Fan-only profiles (/members/[id]) lack personality and value.

**Evidence:**
- `app/members/[id]/page.tsx` — Fan-only route for users without songwriter/host/studio identity
- Currently shows: avatar, name, badges, bio, social links, location
- Missing: "What I'm looking for", "Favorite venues", "Support preferences"

**Fix Plan:**
1. Add "How I Support" section for fans (currently no fan-specific fields in DB)
2. **STOP-GATE:** Requires DB migration for fan-specific fields (DEFERRED to SCOPE C)
3. For now: polish existing fields, add empty state prompts

**Database Schema (profiles table — `database.types.ts:2253-2298`):**
- `favorite_open_mic: string | null` — Already exists, can display
- No `support_style` or `venues_frequented` fields yet

**Minimal Fix (no migration):**
- Display `favorite_open_mic` on fan profiles
- Add "Favorite Open Mic" field to fan onboarding (already collected in role-based onboarding)

**Files to Modify:**
- `app/members/[id]/page.tsx` — Add favorite_open_mic display

---

### A5. Social Links Ordering

**Problem:** Social links display order is hardcoded and may not match user preference.

**Evidence (`components/profile/ProfileIcons.tsx:83-101`):**
```typescript
export function buildSocialLinks(profile: {...}): SocialLink[] {
  return [
    { type: "instagram", url: profile.instagram_url ?? null, label: "Instagram" },
    { type: "facebook", url: profile.facebook_url ?? null, label: "Facebook" },
    { type: "youtube", url: profile.youtube_url ?? null, label: "YouTube" },
    { type: "spotify", url: profile.spotify_url ?? null, label: "Spotify" },
    { type: "tiktok", url: profile.tiktok_url ?? null, label: "TikTok" },
    { type: "website", url: profile.website_url ?? null, label: "Website" },
  ].filter((link) => link.url) as SocialLink[];
}
```

**Current Order:** Instagram → Facebook → YouTube → Spotify → TikTok → Website

**Note:** Twitter/X is in the icons but **NOT in buildSocialLinks()** — this is a bug.

**Fix Plan:**
1. Add Twitter/X to buildSocialLinks()
2. Reorder to musician-centric priority: Spotify → YouTube → Instagram → TikTok → Twitter → Facebook → Website

**Files to Modify:**
- `components/profile/ProfileIcons.tsx:83-101` — Update array order, add Twitter

---

### A6. Canonicalization Audit

**Problem:** Ensure all profile routes have proper UUID→slug redirects.

**Evidence:**

| Route | File | Line | Redirect Logic |
|-------|------|------|----------------|
| /members/[id] | `app/members/[id]/page.tsx` | 54-57 | ✅ Has redirect |
| /songwriters/[id] | `app/songwriters/[id]/page.tsx` | 54-62 | ✅ Has redirect |
| /studios/[id] | `app/studios/[id]/page.tsx` | ? | Need to verify |
| /performers/[id] | `app/performers/[id]/page.tsx` | ? | Legacy, need to verify |

**Redirect Pattern (/members/[id]/page.tsx:54-57):**
```typescript
if (member.slug && id !== member.slug && !isUuid) {
  redirect(`/members/${member.slug}`);
}
```

**Fix Plan:**
1. Audit all 4 profile routes for consistent redirect logic
2. Ensure /performers/[id] redirects to /songwriters/[slug] (legacy cleanup)

**Files to Audit:**
- `app/studios/[id]/page.tsx`
- `app/performers/[id]/page.tsx`

---

### A7. Follow CTA (Placeholder)

**Problem:** No way for users to "follow" or express interest in another member.

**Current State:** No follow/bookmark system exists.

**Fix Plan (P2 — DEFERRED):**
1. Add `profile_follows` table
2. Add "Follow" button to profile pages
3. Add "Following" section to dashboard

**This item is P2** — Document as future enhancement, not part of pre-invite scope.

---

### A8. Profile Completeness Indicator

**Problem:** Users don't know what fields they're missing.

**Evidence (`components/profile/ProfileCompleteness.tsx`):**
- Component exists but may not be used on public profiles

**Fix Plan:**
1. Add completeness indicator to dashboard profile page
2. Show "X% complete" with list of missing fields
3. Link each missing field to edit form

**Files to Modify:**
- `app/(protected)/dashboard/profile/page.tsx` — Add ProfileCompleteness component

---

## SCOPE B: Member-Managed Profile Image Gallery

### Current Gallery Infrastructure

**Gallery Upload System (`dashboard/gallery/UserGalleryUpload.tsx`):**
- Storage bucket: `gallery-images`
- Path pattern: `{userId}/{timestamp}-{index}.{ext}`
- Max file size: 10MB
- Supported formats: JPG, PNG, WebP
- Features: drag-and-drop, batch upload, reordering, album association

**Database Tables:**
- `gallery_images` — Image records with `uploaded_by` FK to profiles
- `gallery_albums` — Album containers with `created_by` FK to profiles

**Key Code (UserGalleryUpload.tsx:348-385):**
```typescript
// Upload to storage
const fileName = `${userId}/${Date.now()}-${i}.${fileExt}`;
const { error: storageError } = await supabase.storage
  .from("gallery-images")
  .upload(fileName, uploadFile.file);

// Insert into database
const { error: insertError } = await supabase
  .from("gallery_images")
  .insert({
    image_url: publicUrl,
    uploaded_by: userId,
    is_approved: true, // Trust members
  });
```

### Profile Gallery Implementation Plan

**Option 1: Reuse Gallery Album (RECOMMENDED)**
- Create a special "Profile Photos" album per user
- Album is hidden from public gallery but photos appear on profile
- Reuses existing upload UI, storage, and permissions

**Option 2: Separate Profile Images Table**
- New `profile_images` table with `profile_id` FK
- Separate storage bucket `profile-images`
- More isolation but duplicates infrastructure

**Recommendation:** Option 1 — Reuse existing gallery infrastructure with a special album type.

**Implementation Steps:**
1. Add `album_type` enum to `gallery_albums`: `public` | `profile`
2. Profile album: `is_published: false`, `album_type: profile`
3. Profile page queries user's profile album for photos
4. Dashboard shows "My Profile Photos" section linking to album manager

**Files to Create/Modify:**
- Migration: Add `album_type` column to `gallery_albums`
- `app/songwriters/[id]/page.tsx` — Add gallery section
- `app/members/[id]/page.tsx` — Add gallery section
- `app/(protected)/dashboard/gallery/page.tsx` — Surface profile album

**STOP-GATE:** Requires DB migration. Do NOT proceed without approval.

---

## SCOPE C: Profile Activity Sections

### Activity Relationships

**Database FK Analysis:**

| Table | FK to profiles | Relationship |
|-------|----------------|--------------|
| `blog_posts` | `author_id` | Profile → authored posts |
| `gallery_images` | `uploaded_by` | Profile → uploaded photos |
| `gallery_albums` | `created_by` | Profile → created albums |
| `event_rsvps` | `user_id` | Profile → event RSVPs |
| `timeslot_claims` | `member_id` | Profile → performance signups |
| `events` | `host_id` | Profile → hosted events |
| `event_hosts` | `user_id` | Profile → co-hosted events |

### Activity Sections to Add

**1. "Blog Posts by [Name]"**
- Query: `blog_posts.author_id = profile.id AND is_published = true`
- Display: Post title, excerpt, date
- Location: /songwriters/[id], /members/[id]

**2. "Photos by [Name]"**
- Query: `gallery_images.uploaded_by = profile.id AND is_approved = true`
- Display: Photo grid (4-6 recent), link to full gallery
- Location: All profile pages

**3. "Upcoming Events"**
- For hosts: Query `events.host_id = profile.id OR event_hosts.user_id = profile.id`
- Display: Event cards with dates
- Location: /songwriters/[id] (already has placeholder at line 290-294)

**4. "Recent RSVPs" (Public)**
- Query: `event_rsvps.user_id = profile.id AND status = 'confirmed'`
- Display: Upcoming events user has RSVP'd to
- Privacy consideration: Only show public events, allow user to hide

**5. "Performance History" (Songwriters)**
- Query: `timeslot_claims.member_id = profile.id`
- Display: Events performed at with dates
- Location: /songwriters/[id]

### Existing Placeholder Evidence

**Upcoming Performances Section (`app/songwriters/[id]/page.tsx:290-294`):**
```tsx
{/* Upcoming Performances placeholder */}
<div className="space-y-4">
  <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
    Upcoming Performances
  </h2>
  <p className="text-[var(--color-text-secondary)]">Check back soon</p>
</div>
```

### Implementation Priority

| Section | Priority | Complexity | Migration Needed |
|---------|----------|------------|------------------|
| Blog Posts | P1 | Low | No |
| Photos by User | P1 | Medium | No |
| Upcoming Events (hosts) | P1 | Low | No |
| Performance History | P2 | Medium | No |
| Recent RSVPs | P3 | Medium | Privacy considerations |

---

## PR Slicing Plan

### Slice 1: Social Links Fix (A5) — SMALLEST, FASTEST
- **Scope:** Fix buildSocialLinks() to include Twitter, reorder to musician-centric
- **Files:** `components/profile/ProfileIcons.tsx`
- **Tests:** 5 new tests
- **Risk:** Low
- **Estimate:** 1 file, ~10 lines changed

### Slice 2: Badge Row Unification (A1)
- **Scope:** Create shared IdentityBadgeRow component
- **Files:** 4 files (1 new, 3 modified)
- **Tests:** 8-10 new tests
- **Risk:** Low

### Slice 3: Empty State Polish (A2)
- **Scope:** Consistent empty states across profile pages
- **Files:** 3 files
- **Tests:** 5-8 tests
- **Risk:** Low

### Slice 4: Card/Detail Consistency (A3) + Fan Polish (A4)
- **Scope:** Add genres/instruments to /members/[id], favorite_open_mic display
- **Files:** 1 file
- **Tests:** 4 tests
- **Risk:** Low

### Slice 5: Canonicalization Audit (A6)
- **Scope:** Verify/fix redirects in studios and performers routes
- **Files:** 2 files
- **Tests:** 4 tests
- **Risk:** Low

### Slice 6: Profile Completeness (A8)
- **Scope:** Add completeness indicator to dashboard
- **Files:** 1 file (use existing component)
- **Tests:** 3 tests
- **Risk:** Low

### Slice 7: Blog Posts Activity Section (SCOPE C)
- **Scope:** Add "Blog Posts by [Name]" to profile pages
- **Files:** 2-3 files
- **Tests:** 5 tests
- **Risk:** Low

### Slice 8: Photos Activity Section (SCOPE C)
- **Scope:** Add "Photos by [Name]" grid to profile pages
- **Files:** 2-3 files
- **Tests:** 5 tests
- **Risk:** Low

### DEFERRED: Profile Gallery (SCOPE B)
- **Requires:** DB migration for `album_type` column
- **Scope:** Full profile photo gallery feature
- **STOP-GATE:** Do NOT start without explicit approval

### DEFERRED: Follow CTA (A7)
- **Requires:** New `profile_follows` table
- **P2 priority** — Not needed for initial test users

---

## Next Execution Recommendation

**Start with Slice 1: Social Links Fix (A5)**

This is the smallest, lowest-risk change with immediate user benefit:
1. Single file change (`components/profile/ProfileIcons.tsx`)
2. ~10 lines of code
3. No migration needed
4. No new components
5. Improves UX for musicians (Spotify/YouTube first)
6. Fixes Twitter/X bug

**Estimated effort:** 15-30 minutes including tests.

---

## STOP-GATE Checklist

Before ANY execution:

- [ ] Sami approves this investigation
- [ ] PR slice identified and scoped
- [ ] Tests planned
- [ ] No DB migrations without explicit approval

---

*Investigation completed: 2026-01-17*

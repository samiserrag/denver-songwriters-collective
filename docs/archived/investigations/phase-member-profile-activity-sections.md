# Investigation: Member Profile Activity Sections (Slice 6)

**Status:** STOP-GATE — Awaiting Approval
**Author:** Claude
**Date:** 2026-01-18
**Mode:** Read-only investigation (no code changes)

---

## Goal

Add activity sections to member profile pages (`/songwriters/[id]`):
1. Galleries Created — Public albums by this member
2. Blogs Written — Published blog posts by this member
3. Hosted Happenings — ✅ Already implemented (confirm alignment)
4. RSVPs (Upcoming + Past) — Events this member has RSVP'd to
5. Timeslot Claims (Upcoming + Past) — Performances this member has signed up for

---

## 1. Schema Analysis

### A. Tables & Columns Required

| Table | Key Columns | Owner FK | Date Field for Upcoming/Past |
|-------|-------------|----------|------------------------------|
| `gallery_albums` | `id`, `name`, `slug`, `cover_image_url`, `is_published`, `is_hidden` | `created_by` → `profiles(id)` | `created_at` (for ordering) |
| `blog_posts` | `id`, `title`, `slug`, `excerpt`, `cover_image_url`, `is_published`, `published_at` | `author_id` → `profiles(id)` | `published_at` (for ordering) |
| `events` | Full SeriesEvent fields (see existing pattern) | `host_id` → `profiles(id)` | 90-day window via `groupEventsAsSeriesView()` |
| `event_rsvps` | `id`, `event_id`, `user_id`, `status`, `date_key`, `created_at` | `user_id` → `profiles(id)` | **`date_key`** (YYYY-MM-DD, Denver tz) |
| `timeslot_claims` | `id`, `timeslot_id`, `member_id`, `status`, `claimed_at` | `member_id` → `profiles(id)` | Via `event_timeslots.date_key` (join required) |
| `event_timeslots` | `id`, `event_id`, `date_key`, `slot_index`, `duration_minutes` | — | **`date_key`** (YYYY-MM-DD, Denver tz) |

### B. Zero-Migration Confirmation

**No migrations required.** All necessary columns and FKs already exist:

- ✅ `gallery_albums.created_by` — FK to profiles
- ✅ `blog_posts.author_id` — FK to profiles
- ✅ `event_rsvps.user_id` — FK to profiles
- ✅ `event_rsvps.date_key` — Added in Phase ABC6 migration `20260111200000`
- ✅ `timeslot_claims.member_id` — FK to profiles
- ✅ `event_timeslots.date_key` — Added in Phase ABC6 migration `20260111200000`

### C. Date Key Usage (Phase ABC6)

Per-occurrence date handling is already implemented:

```sql
-- event_rsvps: date_key = specific occurrence date (YYYY-MM-DD)
-- event_timeslots: date_key = specific occurrence date (YYYY-MM-DD)
-- Both use Denver timezone canonical dates
```

**Upcoming vs Past Logic:**
```typescript
const today = getTodayDenver(); // Returns "2026-01-18" in Denver tz

// Upcoming: date_key >= today
.gte("date_key", today)

// Past: date_key < today
.lt("date_key", today)
```

---

## 2. Privacy Rules

### A. Profile Visibility Gate

The songwriters listing page already filters by `is_public`:

```typescript
// web/src/app/songwriters/page.tsx:34
.eq("is_public", true)
```

**Rule:** Activity sections should ONLY appear on public profiles OR when viewing your own profile.

### B. Visibility Matrix

| Activity Type | Public Profile View | Private Profile View | Own Profile View |
|---------------|---------------------|----------------------|------------------|
| Galleries Created | ✅ Show (published only) | ❌ Hidden | ✅ Show all |
| Blogs Written | ✅ Show (published only) | ❌ Hidden | ✅ Show all |
| Hosted Happenings | ✅ Show (published only) | ❌ Hidden | ✅ Show all |
| RSVPs | ❌ **Hidden** (privacy) | ❌ Hidden | ✅ Show all |
| Timeslot Claims | ❌ **Hidden** (privacy) | ❌ Hidden | ✅ Show all |

**Critical Decision:** RSVPs and Timeslot Claims are **private by default**. Only the profile owner sees their own attendance history. This prevents strangers from seeing "where you'll be" (safety concern).

### C. RLS Policies (Existing)

All tables have appropriate RLS policies:

```sql
-- gallery_albums: Public can see published, non-hidden albums
CREATE POLICY "gallery_albums_select_public" ON gallery_albums
  FOR SELECT USING (is_published = true AND is_hidden = false);

-- blog_posts: Public can see published posts
CREATE POLICY "blog_posts_select_public" ON blog_posts
  FOR SELECT USING (is_published = true);

-- event_rsvps: Users can see their own RSVPs
-- (No public read policy - intentionally private)
```

---

## 3. Existing Pattern: Hosted Happenings

### A. Implementation Location

**File:** `web/src/app/songwriters/[id]/page.tsx` (lines 83-156)

### B. Pattern Summary

```typescript
// 1. Get 90-day window
const today = getTodayDenver();
const windowEnd = addDaysDenver(today, 90);

// 2. Query events where host_id matches profile
const { data: hostedEvents } = await supabase
  .from("events")
  .select(`id, slug, title, event_type, event_date, day_of_week,
           start_time, end_time, recurrence_rule, is_recurring, status,
           cover_image_url, is_dsc_event, is_free, last_verified_at,
           verified_by, source, host_id, location_mode, venue_id,
           venue_name, venue_address`)
  .eq("host_id", songwriter.id)
  .eq("is_published", true)
  .in("status", ["active", "needs_verification", "unverified"]);

// 3. Query occurrence overrides
const { data: overridesData } = await supabase
  .from("occurrence_overrides")
  .select("event_id, date_key, status, ...")
  .in("event_id", eventIds)
  .gte("date_key", today)
  .lte("date_key", windowEnd);

// 4. Build override map
const overrideMap = buildOverrideMap(overridesData);

// 5. Group as series view
const { series: hostedSeries } = groupEventsAsSeriesView(eventsForSeries, {
  startKey: today,
  endKey: windowEnd,
  overrideMap,
});

// 6. Cap to 3 visible
const visibleHostedSeries = hostedSeries.slice(0, 3);
```

### C. Rendering

Uses `<SeriesCard series={entry} />` component for each recurring series.

### D. Alignment Confirmation

✅ Hosted Happenings is already implemented correctly and needs no changes.

---

## 4. Proposed Queries

### A. Galleries Created

```typescript
// Query: Published, non-hidden albums by this profile
const { data: albums } = await supabase
  .from("gallery_albums")
  .select("id, name, slug, description, cover_image_url, created_at")
  .eq("created_by", profileId)
  .eq("is_published", true)
  .eq("is_hidden", false)
  .order("created_at", { ascending: false })
  .limit(6);
```

**Display:** Grid of album cards (3 max visible, "See all X albums" link)

### B. Blogs Written

```typescript
// Query: Published blog posts by this profile
const { data: blogPosts } = await supabase
  .from("blog_posts")
  .select("id, title, slug, excerpt, cover_image_url, published_at")
  .eq("author_id", profileId)
  .eq("is_published", true)
  .order("published_at", { ascending: false })
  .limit(6);
```

**Display:** List of blog post cards (3 max visible, "See all X posts" link)

### C. RSVPs (Own Profile Only)

```typescript
// Query: Upcoming RSVPs (date_key >= today)
const { data: upcomingRsvps } = await supabase
  .from("event_rsvps")
  .select(`
    id, status, date_key, created_at,
    event:events(id, slug, title, event_date, start_time, venue_name, cover_image_url)
  `)
  .eq("user_id", profileId)
  .in("status", ["confirmed", "waitlist", "offered"])
  .gte("date_key", today)
  .order("date_key", { ascending: true })
  .limit(10);

// Query: Past RSVPs (date_key < today)
const { data: pastRsvps } = await supabase
  .from("event_rsvps")
  .select(`
    id, status, date_key, created_at,
    event:events(id, slug, title, event_date, start_time, venue_name, cover_image_url)
  `)
  .eq("user_id", profileId)
  .in("status", ["confirmed"])
  .lt("date_key", today)
  .order("date_key", { ascending: false })
  .limit(10);
```

**Display:** Tabbed section (Upcoming/Past) using existing `<RSVPCard>` component

### D. Timeslot Claims (Own Profile Only)

```typescript
// Query: Upcoming performances via timeslot join
const { data: upcomingPerformances } = await supabase
  .from("timeslot_claims")
  .select(`
    id, status, claimed_at,
    timeslot:event_timeslots(
      id, slot_index, date_key, duration_minutes,
      event:events(id, slug, title, start_time, venue_name, cover_image_url)
    )
  `)
  .eq("member_id", profileId)
  .eq("status", "confirmed")
  .gte("timeslot.date_key", today)
  .order("timeslot.date_key", { ascending: true })
  .limit(10);

// Query: Past performances
const { data: pastPerformances } = await supabase
  .from("timeslot_claims")
  .select(`
    id, status, claimed_at,
    timeslot:event_timeslots(
      id, slot_index, date_key, duration_minutes,
      event:events(id, slug, title, start_time, venue_name, cover_image_url)
    )
  `)
  .eq("member_id", profileId)
  .eq("status", "confirmed")
  .lt("timeslot.date_key", today)
  .order("timeslot.date_key", { ascending: false })
  .limit(10);
```

**Note:** Nested join filter (`gte("timeslot.date_key", today)`) may need to be done client-side if Supabase doesn't support nested filtering. Alternative: fetch all, then filter.

---

## 5. UI Layout Order

Based on existing profile page structure:

```
/songwriters/[id]
├── Hero Section (avatar, name, badges, social links)
├── About (bio)
├── Photos (profile images - if any)
├── Instruments & Genres
├── Collaboration
├── Specialties (if any)
├── Favorite Open Mic (if any)
├── Song Links (if any)
├── Tip/Support Links (if any)
├── Hosted Happenings          ← Existing (line 392)
├── 📸 Galleries Created       ← NEW (public)
├── ✍️ Blogs Written           ← NEW (public)
├── 🎟️ My RSVPs                ← NEW (own profile only)
├── 🎤 My Performances         ← NEW (own profile only)
└── Profile Comments           ← Existing (line 412)
```

### Empty States

| Section | Empty State Text |
|---------|------------------|
| Galleries Created | "No photo albums yet." |
| Blogs Written | "No blog posts yet." |
| My RSVPs (Upcoming) | "No upcoming RSVPs. Browse happenings to find your next event!" |
| My RSVPs (Past) | "No past RSVPs yet." |
| My Performances (Upcoming) | "No upcoming performances. Sign up for a slot at an open mic!" |
| My Performances (Past) | "No past performances yet." |

---

## 6. File Changes Required

### A. Route: `/songwriters/[id]/page.tsx`

**Current lines:** ~418
**Estimated addition:** ~150-200 lines

| Change | Lines (estimate) |
|--------|------------------|
| Import additional types | +5 |
| Auth check for "is own profile" | +10 |
| Gallery albums query | +15 |
| Blog posts query | +15 |
| RSVPs query (if own profile) | +25 |
| Timeslot claims query (if own profile) | +25 |
| Galleries Created section | +30 |
| Blogs Written section | +30 |
| My RSVPs section | +40 |
| My Performances section | +40 |

### B. New Components (Optional)

Could extract reusable components, but NOT required for MVP:

- `ProfileAlbumCard` — Simple album preview card
- `ProfileBlogCard` — Simple blog post preview card
- `PerformanceCard` — Timeslot claim display card

**Recommendation:** Inline for MVP, extract later if needed.

### C. No New API Routes

All queries use existing Supabase RLS-protected tables. No custom API routes needed.

---

## 7. Test Plan

### A. New Test File

**File:** `web/src/__tests__/profile-activity-sections.test.ts`

### B. Test Cases

```typescript
describe("Profile Activity Sections", () => {
  describe("Galleries Created", () => {
    it("shows published albums for public profiles");
    it("hides unpublished albums");
    it("hides albums with is_hidden=true");
    it("shows empty state when no albums");
    it("caps to 3 visible with 'See all' link");
  });

  describe("Blogs Written", () => {
    it("shows published posts for public profiles");
    it("hides unpublished posts");
    it("shows empty state when no posts");
    it("orders by published_at descending");
    it("caps to 3 visible with 'See all' link");
  });

  describe("My RSVPs (Privacy)", () => {
    it("hidden when viewing someone else's profile");
    it("visible when viewing own profile");
    it("separates upcoming vs past using date_key");
    it("shows correct status badges (confirmed/waitlist/offered)");
    it("shows empty state for no upcoming RSVPs");
  });

  describe("My Performances (Privacy)", () => {
    it("hidden when viewing someone else's profile");
    it("visible when viewing own profile");
    it("separates upcoming vs past using timeslot.date_key");
    it("shows slot number and event title");
    it("shows empty state for no upcoming performances");
  });

  describe("Section Ordering", () => {
    it("renders sections in correct order");
    it("Hosted Happenings appears before new sections");
    it("Profile Comments appears last");
  });
});
```

**Estimated test count:** ~25 tests

### C. Existing Test Alignment

Existing test file `profile-hosted-happenings.test.ts` (17 tests) covers Hosted Happenings. New tests should follow the same patterns.

---

## 8. Edge Cases

### A. RSVP to Recurring Event with NULL event_date

**Scenario:** User RSVPs to a recurring event that has `event_date=NULL` but has a valid `recurrence_rule`.

**Solution:** `date_key` on the RSVP row is the source of truth. The RSVP is tied to a specific occurrence, not the series anchor.

```typescript
// date_key is always set on RSVP creation (Phase ABC6)
// Query uses date_key, not event.event_date
.gte("date_key", today)
```

### B. Timeslot Claim to Past Occurrence

**Scenario:** User claimed a slot that has already passed.

**Solution:** The join to `event_timeslots.date_key` handles this:

```typescript
// Filter by timeslot's date_key, not claim's created_at
.lt("timeslot.date_key", today)
```

### C. Private Profile Views Activity

**Scenario:** Profile has `is_public=false` but user navigates directly to `/songwriters/{id}`.

**Solution:** The profile page currently uses RLS which handles this. Activity sections for public content (galleries, blogs, hosted happenings) will also be gated by RLS policies that check the owner's `is_public` status.

### D. Guest RSVP/Claims (No user_id)

**Scenario:** Guest RSVPs have `user_id=NULL`.

**Solution:** Our queries filter by `user_id = profileId`, so guest RSVPs won't appear in any member's activity section. This is correct behavior.

---

## 9. SQL Verification Queries

### A. Check Existing Member Activity

```sql
-- Members with RSVPs (upcoming)
SELECT
  p.full_name,
  COUNT(r.id) as upcoming_rsvps
FROM profiles p
LEFT JOIN event_rsvps r ON r.user_id = p.id
  AND r.status IN ('confirmed', 'waitlist')
  AND r.date_key >= CURRENT_DATE
WHERE p.is_songwriter = true OR p.is_host = true
GROUP BY p.id, p.full_name
ORDER BY upcoming_rsvps DESC
LIMIT 20;

-- Members with Timeslot Claims (upcoming)
SELECT
  p.full_name,
  COUNT(tc.id) as upcoming_performances
FROM profiles p
LEFT JOIN timeslot_claims tc ON tc.member_id = p.id AND tc.status = 'confirmed'
LEFT JOIN event_timeslots ts ON ts.id = tc.timeslot_id
WHERE (p.is_songwriter = true OR p.is_host = true)
  AND ts.date_key >= CURRENT_DATE
GROUP BY p.id, p.full_name
ORDER BY upcoming_performances DESC
LIMIT 20;

-- Members with Blog Posts
SELECT
  p.full_name,
  COUNT(bp.id) as blog_posts
FROM profiles p
LEFT JOIN blog_posts bp ON bp.author_id = p.id AND bp.is_published = true
WHERE p.is_songwriter = true OR p.is_host = true
GROUP BY p.id, p.full_name
HAVING COUNT(bp.id) > 0
ORDER BY blog_posts DESC;

-- Members with Gallery Albums
SELECT
  p.full_name,
  COUNT(ga.id) as albums
FROM profiles p
LEFT JOIN gallery_albums ga ON ga.created_by = p.id
  AND ga.is_published = true AND ga.is_hidden = false
WHERE p.is_songwriter = true OR p.is_host = true
GROUP BY p.id, p.full_name
HAVING COUNT(ga.id) > 0
ORDER BY albums DESC;
```

### B. Verify date_key Columns Exist

```sql
-- Confirm date_key columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'event_rsvps' AND column_name = 'date_key';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'event_timeslots' AND column_name = 'date_key';
```

---

## 10. Risk Assessment

### Low Risk

| Risk | Mitigation |
|------|------------|
| Query performance | Queries are indexed by FK columns; limit to 10 rows |
| Privacy leak | RSVPs/Performances only shown to profile owner |
| Breaking changes | Additive-only; no changes to existing sections |

### Medium Risk

| Risk | Mitigation |
|------|------------|
| Nested join filtering | Test Supabase nested filter support; fallback to client-side filter |
| Component size | Profile page grows significantly; can extract components later |

### Rollback Plan

1. **Feature flag approach:** Add `ENABLE_PROFILE_ACTIVITY_SECTIONS` env var
2. **Conditional rendering:** `{featureEnabled && <ActivitySections />}`
3. **Instant rollback:** Set env var to false, redeploy

**Recommended:** Skip feature flag for MVP since changes are additive and don't modify existing functionality.

---

## 11. PR Plan (Smallest Safe PR)

### Phase A: Public Activity Sections (No Privacy Concerns)

**Files:**
- `web/src/app/songwriters/[id]/page.tsx` — Add Galleries + Blogs sections

**Changes:**
- Add gallery_albums query
- Add blog_posts query
- Add "Galleries Created" section (below Hosted Happenings)
- Add "Blogs Written" section (below Galleries)

**Test file:** `web/src/__tests__/profile-activity-sections.test.ts` (public sections only)

**Estimated:** ~100 lines added, ~15 tests

### Phase B: Private Activity Sections (Own Profile Only)

**Files:**
- `web/src/app/songwriters/[id]/page.tsx` — Add RSVPs + Performances sections

**Changes:**
- Add auth check: `const isOwnProfile = session?.user.id === songwriter.id`
- Add event_rsvps queries (upcoming + past)
- Add timeslot_claims queries (upcoming + past)
- Add "My RSVPs" section (tabs: Upcoming/Past)
- Add "My Performances" section (tabs: Upcoming/Past)

**Test file:** Extend `profile-activity-sections.test.ts` (privacy tests)

**Estimated:** ~150 lines added, ~15 tests

---

## 12. STOP-GATE Summary

### Approval Required For:

1. ✅ **Zero migrations** — All schema exists
2. ✅ **Privacy model** — RSVPs/Performances private by default
3. ✅ **Section order** — Galleries, Blogs after Hosted Happenings; Private sections before Comments
4. ✅ **Query patterns** — Use date_key for upcoming/past logic
5. ✅ **Test plan** — ~25 tests in new test file

### Questions for Sami:

1. **Privacy confirmation:** RSVPs and Performances should be private (own profile only)?
2. **Display caps:** 3 items per section with "See all" link, or different number?
3. **Phase A/B split:** Ship public sections first, or all at once?

---

**STOP-GATE: Awaiting approval before implementation.**

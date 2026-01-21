# Unified Happenings Page Architecture Plan

**Investigation Date:** December 2025
**Status:** Planning Complete - Ready for Review

---

## Executive Summary

This document plans the transition from separate `/open-mics` and `/events` pages to a unified `/happenings` page that displays all event types (DSC events, open mics, and member gigs) in one cohesive experience.

**Key Decisions Required:**
1. Keep `/open-mics` as primary or merge into `/happenings`?
2. Add member gig creation for all users or keep host-only?
3. Unified detail page or keep separate (`/open-mics/[slug]` vs `/events/[id]`)?

---

## Part 1: Current Site Architecture

### 1.1 Files That Reference Events/Open-Mics

#### Navigation Components (MUST UPDATE)
| File | Current Links | Update Required |
|------|---------------|-----------------|
| `web/src/components/navigation/header.tsx:17-18` | `/events` (Happenings), `/open-mics` | Decide unified vs separate |
| `web/src/components/navigation/footer.tsx:48-49` | `/open-mics`, `/events` (Happenings) | Same |
| `web/src/components/navigation/mobile-menu.tsx` | Uses navLinks from header | Auto-updates |

#### Homepage (MUST UPDATE)
| File | Current Behavior | Lines |
|------|-----------------|-------|
| `web/src/app/page.tsx:226-237` | Two CTAs: "See events" → `/events`, "See open mics" → `/open-mics` | Hero section |
| `web/src/app/page.tsx:254-267` | "Host an event" → `/submit-open-mic` | Join us section |
| `web/src/app/page.tsx:282-294` | "See open mics", "Submit an open mic" | Open mic directory section |
| `web/src/app/page.tsx:373` | "See what's coming up" → `/events` | Happenings section |
| `web/src/app/page.tsx:481` | "Explore the directory" → `/open-mics` | Spotlight open mics |

#### Dashboard Pages (MUST UPDATE)
| File | Links | Purpose |
|------|-------|---------|
| `web/src/app/(protected)/dashboard/page.tsx:134` | `/events` | "Browse Events" |
| `web/src/app/(protected)/dashboard/page.tsx:156` | `/dashboard/my-events` | "My Events" |
| `web/src/app/(protected)/dashboard/page.tsx:186` | `/events` | "Find Open Mic Slots" |
| `web/src/app/(protected)/dashboard/my-rsvps/page.tsx:205` | `/events` | Empty state link |

#### Other Pages (MUST UPDATE)
| File | Links | Context |
|------|-------|---------|
| `web/src/app/about/page.tsx:26,215` | `/events` | CTA buttons |
| `web/src/app/get-involved/page.tsx:178` | `/open-mics` | Volunteer section |
| `web/src/app/favorites/page.tsx:72` | `/open-mics` | Empty state |
| `web/src/app/blog/page.tsx:62` | `/events` | Related link |
| `web/src/app/gallery/page.tsx:89` | `/events` | Related link |
| `web/src/app/submit-open-mic/page.tsx:190,239,295` | `/open-mics` | Return links |

#### Event Detail/Display Pages (ARCHITECTURE DECISION)
| File | Current Route | Purpose |
|------|---------------|---------|
| `web/src/app/events/[id]/page.tsx` | `/events/[id]` | DSC event detail |
| `web/src/app/events/[id]/lineup/page.tsx` | `/events/[id]/lineup` | Host lineup control |
| `web/src/app/events/[id]/display/page.tsx` | `/events/[id]/display` | TV display |
| `web/src/app/open-mics/[slug]/page.tsx` | `/open-mics/[slug]` | Open mic detail |
| `web/src/app/open-mics/map/page.tsx` | `/open-mics/map` | Map view |

#### Admin Pages (REVIEW NEEDED)
| File | Current Route | Purpose |
|------|---------------|---------|
| `web/src/app/(protected)/dashboard/admin/events/page.tsx` | `/dashboard/admin/events` | Manage all events |
| `web/src/app/(protected)/dashboard/admin/open-mics/page.tsx` | `/dashboard/admin/open-mics` | Open mic status queue |
| `web/src/app/(protected)/dashboard/admin/dsc-events/page.tsx` | `/dashboard/admin/dsc-events` | DSC events management |
| `web/src/app/(protected)/dashboard/admin/event-update-suggestions/page.tsx` | `/dashboard/admin/event-update-suggestions` | Suggestion review |

#### Components That Link to Events
| Component | Links To | Context |
|-----------|----------|---------|
| `web/src/components/EventCard.tsx:259` | `/open-mics/[slug]` or `/open-mics/[id]` | Open mic cards |
| `web/src/components/events/EventCard.tsx:60` | `/events/[id]` | DSC event cards |
| `web/src/components/events/RSVPCard.tsx:186,269` | `/events/[id]` | RSVP display |
| `web/src/components/events/HostControls.tsx:91,101` | `/events/[id]/lineup`, `/events/[id]/display` | Host tools |
| `web/src/components/admin/EventSpotlightTable.tsx:155,163,171` | `/dashboard/admin/events/[id]/edit`, `/events/[id]/display`, `/events/[id]/lineup` | Admin table |
| `web/src/components/admin/OpenMicStatusTable.tsx:280` | `/open-mics/[slug]` or `/open-mics/[id]` | Admin status table |
| `web/src/components/admin/EventUpdateSuggestionsTable.tsx:163` | `/open-mics/[slug]` | Suggestion review |
| `web/src/components/admin/ChangeReportsTable.tsx:156` | `/open-mics/[slug]` | Change reports |

### 1.2 Current Route Structure

```
PUBLIC ROUTES:
/events                    → DSC events only (is_dsc_event=true)
/events/[id]               → DSC event detail (UUID-based)
/events/[id]/lineup        → Host lineup control
/events/[id]/display       → TV display for venue

/open-mics                 → Open mic directory (event_type=open_mic, is_dsc_event=false)
/open-mics/[slug]          → Open mic detail (slug-based, with UUID redirect)
/open-mics/map             → Map view

/submit-open-mic           → Public submission form

PROTECTED ROUTES:
/dashboard/my-events       → Host's events
/dashboard/my-events/new   → Create new DSC event
/dashboard/my-events/[id]  → Edit DSC event
/dashboard/my-rsvps        → User's RSVPs

ADMIN ROUTES:
/dashboard/admin/events    → Manage ALL events (both types)
/dashboard/admin/open-mics → Open mic status review queue
/dashboard/admin/dsc-events → DSC events moderation
/dashboard/admin/event-update-suggestions → Suggestion queue
```

---

## Part 2: Data Model Analysis

### 2.1 Query Differences

**Open Mics Query** (`/open-mics/page.tsx`):
```typescript
supabase
  .from("events")
  .select("*, venues(*)")
  .eq("event_type", "open_mic")
  .eq("is_published", true)
  .eq("status", "active")  // Only active by default
  .order("day_of_week")    // Ordered by day, not date
```

Key fields used:
- `day_of_week` (recurring pattern)
- `start_time`, `end_time`, `signup_time`
- `venue_id` → joined `venues`
- `recurrence_rule`
- `status` (active/inactive/needs_verification)
- `slug` (for URLs)

**DSC Events Query** (`/events/page.tsx`):
```typescript
supabase
  .from("events")
  .select("*")
  .eq("is_dsc_event", true)
  .eq("is_published", true)
  .eq("status", "active")
  .order("event_date")     // Ordered by date
```

Key fields used:
- `event_date` (specific date)
- `start_time`, `end_time`
- `venue_name`, `venue_address` (denormalized)
- `capacity`, `has_timeslots`
- `cover_image_url`

### 2.2 Field Usage Comparison

| Field | Open Mics | DSC Events | Member Gigs (Proposed) |
|-------|-----------|------------|------------------------|
| `event_type` | `open_mic` | any | `gig` or `showcase` |
| `is_dsc_event` | `false` | `true` | `false` |
| `event_date` | Usually null | Required | Required |
| `day_of_week` | Required | Optional | Optional |
| `venue_id` | Required (FK) | Optional | Optional |
| `venue_name` | Via join | Denormalized | Denormalized |
| `slug` | Required | Optional | Optional |
| `has_timeslots` | Never | Optional | Never |
| `capacity` | Never | Optional | Never |
| `cover_image_url` | Rarely | Often | Optional |
| `host_id` | Legacy, unused | Used | Used (creator) |

### 2.3 Member Gig Data Model Proposal

**New event_type value:** `gig`

**Schema:**
```sql
-- Member gigs use existing events table
INSERT INTO events (
  title,
  description,
  event_type,        -- 'gig'
  is_dsc_event,      -- false (not DSC-organized)
  event_date,        -- required
  start_time,
  end_time,
  venue_name,        -- freeform text
  venue_address,     -- freeform text
  host_id,           -- creator's profile ID
  is_published,      -- true by default (auto-publish)
  status,            -- 'active'
  cover_image_url,   -- optional
  created_at
) VALUES (...);
```

**Key decisions:**
- No approval required (auto-publish)
- No timeslots or RSVPs
- Uses denormalized venue (not FK)
- Creator tracked via `host_id`
- Listed on unified happenings page

### 2.4 Unified Query Design

For a unified happenings page:

```typescript
// Option A: Single query with type discrimination
const { data } = await supabase
  .from("events")
  .select("*, venues(*)")
  .eq("is_published", true)
  .eq("status", "active")
  // Include: DSC events OR member gigs OR open mics
  .or(`is_dsc_event.eq.true,event_type.eq.gig,event_type.eq.open_mic`)
  .order("event_date", { ascending: true, nullsFirst: false });

// Challenge: How to sort when open mics have null event_date?
```

**Sorting Challenge:**
- DSC events and gigs have `event_date`
- Open mics have null `event_date` and use `day_of_week`

**Solutions:**
1. **Virtual date computation** - Calculate "next occurrence" for recurring events
2. **Separate sections** - "This Week" (open mics by day) + "Upcoming" (dated events)
3. **Tabs** - Filter by type, each with appropriate sort

**Recommendation:** Tabs with type filter (simplest, maintains current UX)

---

## Part 3: Component Analysis

### 3.1 Event Display Components

| Component | Location | Used For | Features |
|-----------|----------|----------|----------|
| `EventCard.tsx` (root) | `web/src/components/EventCard.tsx` | Open mics on `/open-mics` | day_of_week badge, map link, favorite, status badge, highlights search terms |
| `EventCard.tsx` (events/) | `web/src/components/events/EventCard.tsx` | DSC events on `/events` | Date badge, capacity/spots, image support |
| `OpenMicCard.tsx` | `web/src/components/open-mics/OpenMicCard.tsx` | Homepage spotlight | Minimal, spotlight badge |
| `EventGrid.tsx` | `web/src/components/events/EventGrid.tsx` | DSC events grid | Compact mode support |
| `CompactListItem.tsx` | `web/src/components/CompactListItem.tsx` | List view toggle | Row-style display |

**Can these be unified?**

The two EventCard components have different purposes:
- Root `EventCard.tsx` (279 lines) - Full-featured for open mic listings
- Events `EventCard.tsx` (207 lines) - Optimized for DSC events

**Recommendation:** Keep separate but create a discriminated union:
```tsx
<UnifiedEventCard event={event} variant={event.is_dsc_event ? "dsc" : "directory"} />
```

### 3.2 Filter Components

**Current Open Mics Filters** (`OpenMicFilters.tsx`):
- Text search
- Status filter (All, Active, Schedule TBD, Inactive)
- City filter (dynamic from data)

**Current Events Page Filters:**
- None

**Unified Page Filters Needed:**

| Filter | Type | Options |
|--------|------|---------|
| Event Type | Tabs or dropdown | All \| DSC Events \| Member Gigs \| Open Mics |
| Date Range | Date picker | Today, This Week, This Month, Custom |
| Day of Week | Checkbox/pills | Mon, Tue, Wed, Thu, Fri, Sat, Sun |
| City | Dropdown | Dynamic from data |
| Search | Text input | Title, venue, description |
| View | Toggle | Grid \| List |

### 3.3 Detail Page Components

**Open Mic Detail** (`/open-mics/[slug]/page.tsx`):
- Hero with venue info
- Schedule (day, time, signup time)
- Recurrence display
- Map link
- Description
- Category badge
- Verified status
- "Suggest Update" button

**DSC Event Detail** (`/events/[id]/page.tsx`):
- Hero with cover image
- Date/time
- Venue info
- Host info (from `event_hosts`)
- RSVP section or Timeslot section
- Host controls (if host/admin)
- Add to calendar button

**Can these be unified?**

Significant differences in functionality make unification complex:
- Open mics: Read-only, recurring, external signup
- DSC events: Interactive, dated, internal RSVP/timeslots

**Recommendation:** Keep separate detail pages, but unified listing page:
- `/happenings` - Lists all event types
- `/happenings/[slug]` - Redirects based on event type
  - Open mics → render with open mic template
  - DSC events → render with DSC template
  - Member gigs → render with simplified template

---

## Part 4: Member Gig Creation Flow

### 4.1 Entry Points (Options)

**Option A: Extend My Events**
- Location: `/dashboard/my-events/new`
- Who: All logged-in users (not just hosts)
- UI: Add "Member Gig" as event type option
- Pros: Reuses existing form
- Cons: Confusing for non-hosts

**Option B: New Dedicated Page**
- Location: `/dashboard/my-gigs/new`
- Who: All logged-in users
- UI: Simplified form
- Pros: Clear purpose, simpler form
- Cons: Another page to maintain

**Option C: Public Submission (like open mics)**
- Location: `/submit-event`
- Who: Anyone (with email for guests)
- UI: Public form with admin queue
- Pros: Lower barrier
- Cons: Admin overhead, spam risk

**Recommendation:** Option B with simplified form

### 4.2 Member Gig Form Fields

**Required:**
| Field | Type | Validation |
|-------|------|------------|
| Title | text | 3-100 chars |
| Date | date | Future dates only |
| Start Time | time | Required |
| Venue Name | text | 2-100 chars |

**Optional:**
| Field | Type | Default |
|-------|------|---------|
| End Time | time | null |
| Venue Address | text | null |
| Description | textarea | null |
| Cover Image | image upload | null |
| Ticket/Event Link | url | null |
| Other Performers | text | null |

### 4.3 Member Gig Management

**Location:** `/dashboard/my-gigs`

**Features:**
- List of user's created gigs
- Filter: Upcoming | Past
- Actions: Edit | Cancel | Delete
- No RSVPs to manage (external only)

**API Endpoints:**
```
GET  /api/my-gigs           → List user's gigs
POST /api/my-gigs           → Create new gig
GET  /api/my-gigs/[id]      → Get gig details
PUT  /api/my-gigs/[id]      → Update gig
DELETE /api/my-gigs/[id]    → Delete gig
```

---

## Part 5: Admin Considerations

### 5.1 Current Admin Structure

| Page | Purpose | Keep/Change |
|------|---------|-------------|
| `/dashboard/admin/events` | All events table | Keep - useful for global view |
| `/dashboard/admin/open-mics` | Open mic status queue | Keep - specialized workflow |
| `/dashboard/admin/dsc-events` | DSC events moderation | Keep or merge with events |
| `/dashboard/admin/event-update-suggestions` | Suggestion review | Keep |

### 5.2 New Admin Needs for Member Gigs

**Options:**

1. **Add to existing events page** - Filter by type
2. **Separate member gigs page** - `/dashboard/admin/member-gigs`
3. **No admin oversight** - Auto-publish, report-based moderation

**Recommendation:** Option 1 - Add type filter to existing events page

### 5.3 Admin Controls for Member Gigs

| Action | Allowed |
|--------|---------|
| View any member gig | Yes |
| Edit any member gig | Yes |
| Delete/hide member gig | Yes |
| Feature member gig | Yes |
| Convert to DSC event | Future |

---

## Part 6: Homepage Impact

### 6.1 Current Homepage Event Sections

1. **Hero CTA buttons** (lines 226-237)
   - "See events" → `/events`
   - "See open mics" → `/open-mics`

2. **"Join us if you're..."** section (lines 254-267)
   - "Host an event" → `/submit-open-mic`

3. **Open Mic Directory** section (lines 271-297)
   - Hero feature promoting the open mic directory
   - "See open mics" → `/open-mics`
   - "Submit an open mic" → `/submit-open-mic`

4. **Happenings** section (lines 357-400)
   - Shows `EventGrid` with DSC events
   - "See what's coming up" → `/events`

5. **Spotlight Open Mics** section (lines 470-520)
   - Featured open mic cards
   - "Explore the directory" → `/open-mics`

### 6.2 Proposed Changes

**Option A: Unified CTAs**
```
Hero:
- "See what's happening" → /happenings

Join Us:
- "See events" → /happenings
- "Add your event" → /dashboard/my-gigs/new (or /submit-event)

Happenings section:
- Shows mix of DSC events + member gigs
- "See all" → /happenings

Open Mic Directory:
- Keep as separate prominent feature
- "See open mics" → /happenings?type=open_mic
```

**Option B: Keep Separation**
- Keep current structure
- Add "Member Gigs" as third category
- More navigation items but clearer mental model

**Recommendation:** Option A with `/open-mics` as alias to `/happenings?type=open_mic`

---

## Part 7: SEO and Redirects

### 7.1 URLs to Preserve/Redirect

**Current URLs with external traffic:**
```
/open-mics              → Many external links
/open-mics/[slug]       → Indexed by Google, shared
/events                 → Footer labeled "Happenings"
/events/[id]            → Event-specific shares
```

### 7.2 Proposed Redirect Plan

**In `next.config.ts`:**
```typescript
async redirects() {
  return [
    // Keep /open-mics working but redirect to unified page with filter
    {
      source: "/open-mics",
      destination: "/happenings?type=open_mic",
      permanent: false,  // Temporary during transition
    },
    // Keep old event URLs working
    {
      source: "/events",
      destination: "/happenings",
      permanent: false,
    },
    // Existing redirects...
  ];
}
```

**Detail page strategy:**
- `/happenings/[id-or-slug]` - Universal detail page
- Detect if ID or slug, redirect if needed
- OR: Keep `/open-mics/[slug]` and `/events/[id]` forever (simplest)

### 7.3 Sitemap Strategy

Create `web/src/app/sitemap.ts`:
```typescript
export default async function sitemap() {
  const supabase = createServerClient();

  // Get all published events
  const { data: events } = await supabase
    .from("events")
    .select("id, slug, event_type, updated_at")
    .eq("is_published", true)
    .eq("status", "active");

  return [
    { url: "https://denver-songwriters-collective.vercel.app/happenings" },
    ...events.map(e => ({
      url: e.event_type === "open_mic"
        ? `https://denver-songwriters-collective.vercel.app/open-mics/${e.slug}`
        : `https://denver-songwriters-collective.vercel.app/events/${e.id}`,
      lastModified: e.updated_at,
    })),
  ];
}
```

---

## Part 8: Risk Assessment

### 8.1 Breaking Changes Risk Matrix

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Broken external links to `/open-mics` | High | Low | Redirect with query param |
| Broken bookmarks to `/events` | Medium | Low | Redirect |
| Shared event links 404 | High | Low | Keep old routes as aliases |
| SEO ranking drop | Medium | Medium | Proper 301 redirects, sitemap |
| Confused users | Medium | Medium | Clear nav, good UX |
| Database schema changes | Low | Low | Additive only |

### 8.2 Database Changes Required

**No breaking changes needed:**
- Add `gig` to `event_type` enum (if not already TEXT)
- Ensure `host_id` column is usable for gig creators

```sql
-- If event_type is an enum, add value:
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'gig';

-- Ensure host_id has proper FK (already exists)
-- No other schema changes required
```

### 8.3 Rollback Plan

**If something goes wrong:**

1. **Redirects break** → Remove from next.config.ts, deploy
2. **Unified page broken** → Quick fix or revert, old pages still exist
3. **Member gigs cause issues** → Disable creation, keep display

**Key principle:** Build new pages alongside old ones, add redirects last

---

## Part 9: Implementation Phases

### Phase 0: Preparation (Non-Breaking)
- [ ] Add `gig` to event_type if needed
- [ ] Create shared event utilities module
- [ ] Create unified event type definitions
- [ ] Design unified filter component

**Files to create:**
- `web/src/lib/events/unified.ts` - Shared query/filter logic
- `web/src/components/events/UnifiedEventCard.tsx` - Discriminated card
- `web/src/components/events/EventFilters.tsx` - Unified filters

**Estimated effort:** 1-2 days

### Phase 1: Member Gigs (Non-Breaking)
- [ ] Create `/dashboard/my-gigs` page
- [ ] Create `/dashboard/my-gigs/new` form
- [ ] Create `/api/my-gigs` endpoints
- [ ] Add member gigs to existing `/events` page (hidden behind feature flag)

**Files to create:**
- `web/src/app/(protected)/dashboard/my-gigs/page.tsx`
- `web/src/app/(protected)/dashboard/my-gigs/new/page.tsx`
- `web/src/app/(protected)/dashboard/my-gigs/[id]/page.tsx`
- `web/src/app/api/my-gigs/route.ts`
- `web/src/app/api/my-gigs/[id]/route.ts`

**Estimated effort:** 2-3 days

### Phase 2: Unified Happenings Page (New Route)
- [ ] Create `/happenings` page with unified query
- [ ] Implement event type tabs/filters
- [ ] Implement search and date filters
- [ ] Implement view toggle (grid/list)
- [ ] Test thoroughly

**Files to create:**
- `web/src/app/happenings/page.tsx`
- `web/src/app/happenings/[id]/page.tsx` - Universal detail (optional)

**Estimated effort:** 3-4 days

### Phase 3: Navigation Update
- [ ] Update header.tsx navLinks
- [ ] Update footer.tsx links
- [ ] Update homepage CTAs
- [ ] Update dashboard links
- [ ] Update all "Browse Events" type links

**Files to modify:** ~15 files (see Part 1)

**Estimated effort:** 1 day

### Phase 4: Redirects and Cleanup
- [ ] Add redirects to next.config.ts
- [ ] Create sitemap.ts
- [ ] Update any remaining hardcoded URLs
- [ ] Monitor for 404s
- [ ] Consider removing old pages after stability

**Estimated effort:** 1 day

### Phase 5: Polish and Documentation
- [ ] Update CLAUDE.md
- [ ] Update any user-facing help text
- [ ] Add analytics tracking for new pages
- [ ] Performance testing

**Estimated effort:** 1 day

---

## Part 10: Questions for Product Decision

Before implementing, please clarify:

### Event Display Questions
1. **Should `/open-mics` redirect or be an alias?**
   - Redirect: One canonical URL, simpler maintenance
   - Alias: SEO preservation, familiar URL for users

2. **Should detail pages be unified or separate?**
   - Unified `/happenings/[id]`: Consistent UX, complex implementation
   - Separate `/open-mics/[slug]` and `/events/[id]`: Current behavior, easier

3. **What sorting for mixed recurring + dated events?**
   - Tabs by type (recommended)
   - Computed "next occurrence" sorting
   - Separate sections

### Member Gigs Questions
4. **Who can create member gigs?**
   - All logged-in users (recommended)
   - Only users with `is_songwriter=true`
   - All users including guests (more work)

5. **Auto-publish or admin review?**
   - Auto-publish (recommended for MVP)
   - Admin queue (more overhead)

6. **Should member gigs support RSVPs?**
   - No (recommended - keep simple)
   - Optional RSVP (more complexity)

### Navigation Questions
7. **Keep "Open Mics" as primary nav item?**
   - Yes, important feature deserves visibility
   - No, consolidate under "Happenings"
   - Both: "Happenings" nav item with "Open Mics" submenu

8. **What happens to "Host an Event" button?**
   - Links to `/submit-open-mic` (current)
   - Links to `/dashboard/my-gigs/new` (if logged in)
   - Smart: Shows different options based on auth

---

## Complete File Inventory

### Files to CREATE
```
web/src/lib/events/unified.ts
web/src/components/events/UnifiedEventCard.tsx
web/src/components/events/EventFilters.tsx
web/src/app/happenings/page.tsx
web/src/app/happenings/[id]/page.tsx (optional)
web/src/app/(protected)/dashboard/my-gigs/page.tsx
web/src/app/(protected)/dashboard/my-gigs/new/page.tsx
web/src/app/(protected)/dashboard/my-gigs/[id]/page.tsx
web/src/app/api/my-gigs/route.ts
web/src/app/api/my-gigs/[id]/route.ts
web/src/app/sitemap.ts
```

### Files to MODIFY
```
web/src/components/navigation/header.tsx
web/src/components/navigation/footer.tsx
web/src/app/page.tsx
web/src/app/about/page.tsx
web/src/app/get-involved/page.tsx
web/src/app/favorites/page.tsx
web/src/app/blog/page.tsx
web/src/app/gallery/page.tsx
web/src/app/gallery/[slug]/page.tsx
web/src/app/submit-open-mic/page.tsx
web/src/app/(protected)/dashboard/page.tsx
web/src/app/(protected)/dashboard/my-rsvps/page.tsx
web/next.config.ts
web/src/types/events.ts
web/src/types/index.ts
```

### Files to POTENTIALLY DELETE (after Phase 5)
```
web/src/app/events/page.tsx (if redirecting)
# Keep detail pages for backward compatibility
```

---

## Summary

This transition is achievable with minimal risk by following the phased approach:
1. Build new features alongside existing ones
2. Add redirects last
3. Never break existing URLs

**Total estimated effort:** 10-12 days of development

**Recommended first step:** Get product decisions on the 8 questions above, then start with Phase 0 preparation work.

# Unified Happenings Page - Edge Cases & Gotchas

This document stress-tests the unified happenings page plan and identifies "unknown unknowns" that could cause issues during implementation.

**Investigation Date:** December 2025
**Related Documents:**
- [unified-happenings-page-plan.md](./unified-happenings-page-plan.md) - Implementation plan
- [events-system-audit.md](./events-system-audit.md) - Events system architecture

---

## 1. Database Anomalies Found

### 1.1 Identity Crisis Events

| Issue | Count | IDs | Impact |
|-------|-------|-----|--------|
| Open mic with `is_dsc_event=true` | 1 | `b7ec8f48-c484-492e-8814-004d7bd0e226` ("Test Open Mic 1") | Will show RSVP button instead of view-only |
| Event with both `day_of_week` AND `event_date` | 1 | Same as above | Sorting confusion - which takes precedence? |
| Orphaned event (no day_of_week or event_date) | 1 | `4f7fd4ac-2355-4e69-b7ac-8730537b38ac` | Won't appear in sorted lists properly |
| Events without `venue_id` | 3 | See below | Venue join queries will return nulls |

**Events without venue_id:**
```
- Node Arts Collective Music & Poetry Open Mic (venue_name: "Node Arts Collective")
- The Pearl Poetry Open Mic (venue_name: "The Pearl Denver")
- Jam B4 the Slam at The Pearl (venue_name: "The Pearl Denver")
```

**Resolution Required Before Unification:**
1. Clean up test event `b7ec8f48-c484-492e-8814-004d7bd0e226`
2. Link orphaned events to venue records or create venues for them
3. Establish rule: `is_dsc_event=true` events MUST have `event_date`, not `day_of_week`

### 1.2 Slug Statistics

| Metric | Value | Risk |
|--------|-------|------|
| Events with slug | 84 | Safe for `/happenings/[slug]` routing |
| Events without slug | 14 | Must support UUID fallback |
| Duplicate slugs | 0 | No collision risk |
| Slugs with special chars | 0 | No URL encoding issues |

### 1.3 Orphaned Venue

There is 1 venue ("The Pearl Denver") with no linked events. This is benign but indicates 3 events reference the venue by `venue_name` string rather than `venue_id` foreign key.

---

## 2. Component Compatibility Matrix

### 2.1 Two EventCard Components

| Feature | `EventCard.tsx` (root) | `events/EventCard.tsx` |
|---------|----------------------|----------------------|
| Purpose | Open Mic listings | DSC Event listings |
| Lines of code | 279 | 207 |
| Uses `use client` | Yes | Yes |
| URL pattern | `/open-mics/[slug]` or `/open-mics/[id]` | `/events/[id]` |
| Date display | `day_of_week` badge | `event_date` formatted |
| Time display | `start_time` / `end_time` with recurrence | `start_time` / `end_time` |
| Venue handling | Complex venue object parsing | Simple string display |
| Location display | City/State with "UNKNOWN" filtering | Address from venue |
| Status badges | active/inactive/cancelled/unverified/needs_verification/seasonal | Published/Draft/Status |
| Favorites button | Yes (with auth check) | No |
| Map link | Yes (with goo.gl filtering) | No |
| Category colors | music/comedy/poetry/mixed | comedy/poetry/all-acts |
| Capacity display | No | Yes (`spotsRemaining`) |
| Compact mode | No | Yes |
| Image handling | `PlaceholderImage type="open-mic"` | `ImagePlaceholder initials` |
| Search highlighting | Yes (`highlight()` function) | No |

### 2.2 Breaking Changes for Card Unification

To create a unified `HappeningsCard`:

1. **URL generation** - Must check `is_dsc_event` to determine `/happenings/[slug]` vs `/happenings/[id]`
2. **Date rendering** - Must handle both `day_of_week` (recurring) and `event_date` (one-time)
3. **Favorites** - Decide if DSC events get favorites too (currently only open mics)
4. **Capacity** - Only show for `is_dsc_event=true` with capacity set
5. **Map link** - Port the goo.gl filtering logic
6. **Category colors** - Merge both color schemes (5 total categories)
7. **Status badges** - Merge both status badge systems

### 2.3 OpenMicCard Component

A third card component exists at `web/src/components/open-mics/OpenMicCard.tsx` (115 lines):
- Minimal version used for homepage spotlight section
- Different interface (`SpotlightOpenMic` vs `Event`)
- Uses `is_featured` flag
- May need to be unified or kept separate for performance

---

## 3. URL Routing Conflicts

### 3.1 Current URL Structure

| Page | Current URL | New URL | Redirect Needed |
|------|-------------|---------|-----------------|
| Open Mic listing | `/open-mics` | `/happenings` (view=recurring) | Yes, 301 |
| Open Mic detail | `/open-mics/[slug]` | `/happenings/[slug]` | Yes, 301 |
| DSC Events listing | `/events` | `/happenings` (view=dated) | Yes, 301 |
| DSC Event detail | `/events/[id]` | `/happenings/[id]` | Yes, 301 |
| Event TV display | `/events/[id]/display` | `/happenings/[id]/display` | Yes, 301 |
| Event lineup control | `/events/[id]/lineup` | `/happenings/[id]/lineup` | Yes, 301 |

### 3.2 Slug vs UUID Collision Risk

Current system allows both:
- `/open-mics/mercury-cafe-open-mic` (slug)
- `/open-mics/550e8400-e29b-41d4-a716-446655440000` (UUID fallback)

With unified `/happenings/[identifier]`:
- If a slug happens to be a valid UUID format (unlikely but possible): collision
- Recommendation: Check UUID format first, then fall back to slug lookup

### 3.3 Query Parameter Conflicts

| Parameter | Open Mics | Events | Resolution |
|-----------|-----------|--------|------------|
| `city` | Yes | No | Keep - filter by venue city |
| `status` | Yes (active/unverified/inactive) | No | Keep for admin views |
| `search` | Yes | No | Port to unified |
| `cancel` | No | Yes (cancel RSVP) | Keep |
| `confirm` | No | Yes (confirm waitlist offer) | Keep |

**New parameter needed:**
- `view=recurring|dated|all` - Toggle between view modes

---

## 4. External Dependencies Audit

### 4.1 Email Templates with Hardcoded URLs

| Template | File | Hardcoded URL | Update Required |
|----------|------|---------------|-----------------|
| Host Rejection | `hostRejection.ts` | `/open-mics` | Yes |
| Suggestion Response | `suggestionResponse.ts` | `/open-mics` | Yes |
| Event Reminder | `eventReminder.ts` | `/events/${eventId}` | Yes |
| RSVP Confirmation | `rsvpConfirmation.ts` | `/events/${eventId}`, `/events/${eventId}?cancel=true` | Yes |
| Waitlist Promotion | `waitlistPromotion.ts` | `/events/${eventId}?confirm=true` | Yes |

**Risk:** Emails sent before transition will have old URLs. Need redirects to be permanent.

### 4.2 PWA Manifest Shortcuts

File: `web/public/manifest.json`
```json
"shortcuts": [
  { "name": "Open Mics", "url": "/open-mics" },
  { "name": "Events", "url": "/events" }
]
```

**Update required:** Change to single `/happenings` shortcut or add view parameter.

### 4.3 Global Search API

File: `web/src/app/api/search/route.ts`
- Returns URLs: `/open-mics/${om.slug || om.id}` and `/events/${event.id}`
- Must update to unified `/happenings/[identifier]` pattern

File: `web/src/components/search/GlobalSearch.tsx`
- Consumes search API results
- No changes needed if API returns correct URLs

### 4.4 Analytics/Tracking

- No Google Analytics (`gtag`) found in codebase
- No event tracking to update
- **Low risk**

---

## 5. State & Session Edge Cases

### 5.1 localStorage Usage

| Key | Purpose | Migration Impact |
|-----|---------|------------------|
| `dsc-theme` | Theme preference | None |
| `dsc-font` | Font preference | None |
| `dsc_guest_claim_*` | Guest timeslot claims | None - uses event ID |

**Finding:** No view preference storage exists. Adding `happenings-view` preference would be new functionality.

### 5.2 Filter State Persistence

Current behavior:
- Filters are URL query params (good for sharing)
- No localStorage persistence of filter selections
- Navigating away loses filter state

**Recommendation:** Keep URL-based filters for unified page.

### 5.3 Auth Session Impacts

Features requiring auth in current system:
- Favorites (open mics only)
- RSVP (DSC events only)
- Timeslot claims (DSC events only)
- Submit corrections

No session/auth changes needed for unification.

---

## 6. Admin Interface Complications

### 6.1 Separate Admin Pages

| Page | Path | Purpose | Unification Impact |
|------|------|---------|-------------------|
| Manage Events | `/dashboard/admin/events` | All events (mixed) | Keep - already unified |
| Open Mic Review | `/dashboard/admin/open-mics` | Status review queue | Consider merging |
| DSC Events | `/dashboard/admin/dsc-events` | Community events | Consider merging |

### 6.2 Admin Page Queries

**Admin Events (`/dashboard/admin/events`):**
- Fetches ALL events with venues join
- No `is_dsc_event` filter
- Already effectively "unified"

**Open Mic Review (`/dashboard/admin/open-mics`):**
- Filters: `event_type: 'open_mic'`, `is_published: true`, `venue_id not null`
- Specific to recurring open mics

**Recommendation:** Keep admin pages separate - different workflows for different event types.

### 6.3 EventSpotlightTable Component

- Used in admin events page
- Shows links to `/events/[id]/display` and `/events/[id]/lineup`
- Must update these links to `/happenings/[id]/display` and `/happenings/[id]/lineup`

---

## 7. SEO & Metadata Implications

### 7.1 Current Canonical URLs

| Page | Canonical Pattern |
|------|-------------------|
| Open Mic detail | `https://denver-songwriters-collective.vercel.app/open-mics/${slug}` |
| Event detail | Not explicitly set (uses og:url) |

### 7.2 Metadata Differences

**Open Mic Detail:**
- Title: `{title} | Open Mic in {city}`
- Rich description with day/time

**Event Detail:**
- Title: `{title} | {event_type label} | The Colorado Songwriters Collective`
- Description includes event type

### 7.3 Required Updates

1. **New canonical URLs:** All must update to `/happenings/[identifier]`
2. **301 redirects:** Critical for SEO - must preserve link equity
3. **Sitemap:** No sitemap.xml exists currently - consider adding during transition

---

## 8. Performance Projections

### 8.1 Query Complexity

**Current Open Mics page:**
```sql
SELECT events.*, venues.*
FROM events
LEFT JOIN venues ON events.venue_id = venues.id
WHERE event_type = 'open_mic' AND is_published = true
ORDER BY day_of_week, title
```

**Unified page would need:**
```sql
SELECT events.*, venues.*,
  (SELECT COUNT(*) FROM event_rsvps WHERE event_id = events.id AND status IN ('confirmed','waitlist')) as rsvp_count,
  (SELECT COUNT(*) FROM event_timeslots WHERE event_id = events.id) as slot_count
FROM events
LEFT JOIN venues ON events.venue_id = venues.id
WHERE is_published = true
ORDER BY
  CASE WHEN is_dsc_event THEN event_date ELSE NULL END,
  CASE WHEN NOT is_dsc_event THEN day_of_week_order ELSE NULL END,
  title
```

**Potential issues:**
- More complex sorting logic
- Additional subqueries for RSVP/slot counts
- May need indexes on `is_dsc_event`, `event_date`, `day_of_week`

### 8.2 Bundle Size Impact

Current separate pages:
- `/open-mics` - Loads OpenMicFilters, EventCard (root)
- `/events` - Loads events/EventCard

Unified page:
- Loads unified HappeningsCard with both feature sets
- Potentially larger initial bundle
- Consider code splitting by view mode if performance degrades

---

## 9. Member Gigs / Community Events Gotchas

### 9.1 Current State

| Table | Records | Status |
|-------|---------|--------|
| event_hosts | 0 | No host assignments exist |
| approved_hosts | 0 | No approved hosts |
| host_requests | 0 | No pending requests |
| open_mic_claims | 0 | Legacy table, unused |

**Finding:** Host/co-host system is defined but not actively used. Unification won't break existing host workflows (none exist).

### 9.2 Venue Submission Edge Cases

3 events reference venues by name only (no `venue_id`):
- Will display venue name correctly
- Map links will use Google search fallback
- Venue admin page won't show these events

**Recommendation:** Clean up venue references before or during transition.

### 9.3 Event Submission Spam Prevention

Current anti-spam measures:
- Event update suggestions require email (not necessarily authenticated)
- No rate limiting on submissions
- Admin approval required

**Risk:** With more unified visibility, spam submissions might increase.

---

## 10. Test Coverage Analysis

### 10.1 Existing Test Files

| File | Purpose |
|------|---------|
| `web/src/app/open-mics/page.test.tsx` | Open mics page tests |
| `web/src/app/events/page.test.tsx` | Events page tests |
| `web/src/lib/guest-verification/storage.test.ts` | Guest claim storage |

### 10.2 Test Migration Needs

1. Create new tests for `/happenings` page
2. Test view toggle between recurring/dated/all
3. Test unified card rendering for both event types
4. Test redirect handling from old URLs

---

## 11. Breaking Change Inventory

### 11.1 Critical (Must Fix Before Deploy)

| Change | Impact | Mitigation |
|--------|--------|------------|
| URL structure change | All bookmarks, shared links break | 301 redirects in next.config.ts |
| Email URLs | Sent emails have old URLs | Redirects + update templates |
| PWA shortcuts | Home screen shortcuts break | Update manifest.json |
| Search API | Search results link to old URLs | Update API responses |

### 11.2 High (Fix Within First Week)

| Change | Impact | Mitigation |
|--------|--------|------------|
| SEO canonical URLs | Search ranking impact | Update metadata + redirects |
| Admin links | Admin workflows break | Update EventSpotlightTable links |

### 11.3 Medium (Fix Before Full Launch)

| Change | Impact | Mitigation |
|--------|--------|------------|
| Data anomalies | Edge case display bugs | Clean up 4 problematic events |
| Venue orphans | 3 events missing venue links | Create/link venue records |

---

## 12. Recommended Mitigations

### 12.1 Pre-Implementation Checklist

- [ ] Clean up test event with identity crisis (`b7ec8f48...`)
- [ ] Link 3 orphaned events to proper venue records
- [ ] Add database indexes: `is_dsc_event`, `event_date`, `day_of_week`
- [ ] Create unified event type constants file

### 12.2 Implementation Checklist

- [ ] Implement 301 redirects before removing old pages
- [ ] Update all email templates in single commit
- [ ] Update manifest.json PWA shortcuts
- [ ] Update search API to return new URLs
- [ ] Create unified HappeningsCard with feature detection

### 12.3 Post-Implementation Checklist

- [ ] Verify all redirects working
- [ ] Monitor 404 errors in logs
- [ ] Check Google Search Console for crawl issues
- [ ] Test all email flows end-to-end
- [ ] Update admin documentation

---

## 13. Risk Matrix (Updated)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Broken bookmarks/links | High | High | 301 redirects |
| SEO ranking drop | Medium | Medium | Proper redirects + canonical |
| Email links broken | High (temporary) | Medium | Redirects handle this |
| Data display bugs | Medium | Low | Clean up anomalies first |
| Performance regression | Low | Medium | Monitor, add indexes |
| Admin workflow disruption | Low | Low | Update links proactively |
| Auth/session issues | Very Low | High | No session changes needed |

---

## 14. Decision Points Remaining

Before implementation, confirm:

1. **View toggle default:** Should `/happenings` default to `all`, `recurring`, or `dated`?
2. **Favorites for DSC events:** Should dated events get favorites too?
3. **Map links:** Add map links to DSC events or keep open mic only?
4. **Admin pages:** Keep separate or unify admin event management?
5. **URL format:** `/happenings/[slug]` for all, or distinguish somehow?

---

*Document created: December 2025*
*Last updated: December 2025*

# GTM-1 PREP Investigation Report

**Status:** STOP-GATE DOCUMENT — AWAITING APPROVAL
**Phase:** GTM-1 PREP (Expand to All Event Types)
**Author:** Repo Agent
**Date:** January 2026
**Source of Truth:** `docs/gtm/weekly-personalized-digest-north-star.md`

---

## Investigation 1: Current Digest Pipeline Audit

### Pipeline Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WEEKLY DIGEST PIPELINE                               │
└─────────────────────────────────────────────────────────────────────────────┘

[1] TRIGGER
    └── Vercel Cron: `0 3 * * 0` (Sunday 3:00 UTC = 8:00 PM Denver)
    └── Endpoint: `/api/cron/weekly-open-mics`
    └── Auth: `CRON_SECRET` header validation

[2] KILL SWITCH CHECK
    └── File: `lib/featureFlags.ts`
    └── Function: `isWeeklyDigestEnabled()`
    └── Env var: `ENABLE_WEEKLY_DIGEST === "true"`
    └── Fail behavior: Returns 200 OK with "disabled" message (silent)

[3] DATA FETCHING
    └── File: `lib/digest/weeklyOpenMics.ts`
    └── Function: `getUpcomingOpenMics(supabase, { todayKey })`
    └── Query filters:
        - event_type = 'open_mic'          <-- INJECTION POINT FOR GTM-1
        - is_published = true
        - status = 'active'
    └── Returns: DigestData { byDate, totalCount, venueCount, dateRange }

[4] OCCURRENCE EXPANSION
    └── Function: `expandOccurrencesForEvent()` from `nextOccurrence.ts`
    └── Window: 7 days (Sunday through Saturday)
    └── Handles: weekly, biweekly, monthly ordinal, custom dates
    └── Excludes: cancelled occurrences via `occurrence_overrides`

[5] RECIPIENT ENUMERATION
    └── File: `lib/digest/weeklyOpenMics.ts`
    └── Function: `getDigestRecipients(supabase)`
    └── Source: `profiles` table (registered users only)
    └── Filter: `email IS NOT NULL`
    └── Preference check: `notification_preferences.email_event_updates`
    └── Default: `true` if no preference row exists

[6] EMAIL GENERATION
    └── File: `lib/email/templates/weeklyOpenMicsDigest.ts`
    └── Function: `getWeeklyOpenMicsDigestEmail(params)`
    └── Inputs: firstName, byDate, totalCount, venueCount
    └── Outputs: { subject, html, text }
    └── Subject: "Open Mics This Week in Denver"   <-- CHANGE FOR GTM-1

[7] EMAIL SENDING
    └── File: `app/api/cron/weekly-open-mics/route.ts`
    └── Rate limiting: 100ms delay between emails
    └── Transport: Fastmail SMTP via `lib/email/mailer.ts`

[8] PREFERENCE GATING
    └── File: `lib/notifications/preferences.ts`
    └── Category: `weeklyOpenMicsDigest` -> `event_updates`
    └── Respects: `notification_preferences.email_event_updates`
```

### Key Files Inventory

| File | Purpose | GTM-1 Impact |
|------|---------|--------------|
| `lib/digest/weeklyOpenMics.ts` | Business logic | Must expand query filter |
| `lib/email/templates/weeklyOpenMicsDigest.ts` | Email template | Must rename and update copy |
| `app/api/cron/weekly-open-mics/route.ts` | Cron endpoint | May need rename or alias |
| `lib/featureFlags.ts` | Kill switch | Consider separate flag for all-events |
| `lib/notifications/preferences.ts` | Category mapping | Must add new template key |
| `lib/email/registry.ts` | Template registry | Must register new template |

### Personalization Injection Points

| Location | Current State | GTM-2 Extension Point |
|----------|---------------|----------------------|
| `fetchOpenMicEvents()` | Hardcoded `event_type = 'open_mic'` | Accept `eventTypes[]` param |
| `getUpcomingOpenMics()` | No preferences param | Accept `DigestPreferences` param |
| `getDigestRecipients()` | Returns all eligible users | Join with `digest_preferences` |

### Preference Gating Locations

| File | Line | Mechanism |
|------|------|-----------|
| `weeklyOpenMics.ts:331` | `prefMap.get(profile.id) ?? true` | Default true |
| `preferences.ts:122` | `EMAIL_CATEGORY_MAP.weeklyOpenMicsDigest` | Maps to `event_updates` |
| `cron/route.ts` (implied) | Uses registered template | Inherits category |

### Kill Switch Enforcement

| Check Point | File | Behavior |
|-------------|------|----------|
| Cron entry | `route.ts:25-30` | Returns 200 with message |
| Function | `featureFlags.ts:18-20` | Checks `ENABLE_WEEKLY_DIGEST` |

---

## Investigation 2: Email Template Capability Audit

### Current Email System Constraints

| Constraint | Value | Source |
|------------|-------|--------|
| Max width | 560px | `render.ts:51` (`EMAIL_MAX_WIDTH`) |
| Layout | Table-based | Required for email client compatibility |
| Fonts | Arial, Helvetica, sans-serif | `render.ts:40` (`EMAIL_FONT_FAMILY`) |
| Colors | `EMAIL_COLORS` object | `render.ts:21-34` |
| Line length | ~70 chars recommended | Plain text compatibility |

### Email vs Web Capability Matrix

| Feature | Email Support | Web Support | Parity Notes |
|---------|---------------|-------------|--------------|
| Card-like event blocks | Yes (table cells) | Yes (CSS) | Email uses nested tables |
| Day grouping headers | Yes | Yes | Same visual structure |
| Clickable links | Yes | Yes | Email requires full URLs |
| Emoji icons | Yes | Yes | UTF-8 supported |
| Responsive layout | Limited | Full | Email fixed-width |
| Images | Yes (external URLs only) | Yes | Email requires hosted images |
| Interactive filters | No | Yes | Fundamental limitation |
| Collapsible sections | No | Yes | Fundamental limitation |
| More than ~20 events | Problematic | Yes | Email length concern |

### Day-Grouped Layout Analysis

Current template structure (`weeklyOpenMicsDigest.ts:163-176`):

```typescript
// Iterates sorted date keys
for (const dateKey of sortedDates) {
  eventsHtml += formatDayHeaderHtml(dateKey);    // Day header row
  for (const occurrence of occurrences) {
    eventsHtml += formatOpenMicHtml(occurrence); // Event row
  }
}
```

This structure supports multiple event types without modification. The day grouping is date-based, not event-type-based.

### Scale Concerns

| Event Count | Email Size | Recommendation |
|-------------|------------|----------------|
| 1-10 | ~15KB | No issues |
| 11-20 | ~25KB | Acceptable |
| 21-40 | ~45KB | Consider pagination |
| 40+ | ~70KB+ | Must paginate or summarize |

Current open_mic count: ~12-18 per week (safe zone).
All event types estimate: ~25-40 per week (needs monitoring).

### Template Helper Functions Available

| Function | Location | Purpose |
|----------|----------|---------|
| `wrapEmailHtml(content)` | `render.ts:56` | Wraps in full HTML document |
| `wrapEmailText(content)` | `render.ts:87` | Adds footer to plain text |
| `getGreeting(firstName)` | `render.ts:96` | "Hi {name}," or "Hi there," |
| `createButton(text, url)` | `render.ts:103` | CTA button HTML |
| `eventCard(title, url)` | `render.ts:127` | Clickable event card |

---

## Investigation 3: UX Surface Mapping

### Digest CTA Surface Inventory

| Surface | Location | Current CTA | Target Table | Risk Level |
|---------|----------|-------------|--------------|------------|
| Homepage "Stay in the Loop" | `NewsletterSection.tsx` | "Join the DSC Newsletter" | `newsletter_subscribers` | Low |
| Footer "Stay Connected" | `newsletter-signup.tsx` | "Join" | `newsletter_subscribers` | Low |
| Dashboard Settings | `settings/page.tsx` | Toggle switches | `notification_preferences` | Low |
| Happenings Page | `happenings/page.tsx` | None currently | N/A | **GTM-2 addition** |
| Early Contributors | `early-contributors/page.tsx` | None currently | N/A | Low priority |

### Surface Details

**Homepage NewsletterSection (`components/navigation/NewsletterSection.tsx`)**
- Heading: "Stay in the Loop"
- Subheading: "Join the DSC Newsletter to receive updates on open mics, events, and more."
- CTA: Primary button "Join the DSC Newsletter"
- Target: `POST /api/newsletter` -> `newsletter_subscribers`
- Risk: Misaligned expectation (says "newsletter", delivers "digest")

**Footer NewsletterSignup (`components/navigation/newsletter-signup.tsx`)**
- Heading: "Stay Connected"
- Subheading: "Updates on open mics, events, and more."
- CTA: "Join" button
- Target: `POST /api/newsletter` -> `newsletter_subscribers`
- Risk: Same as above

**Dashboard Settings (`app/(protected)/dashboard/settings/page.tsx`)**
- Section: "Email Preferences"
- Toggles:
  - "Event claim updates" -> `email_claim_updates`
  - "Event updates" -> `email_event_updates` (controls digest)
  - "Admin alerts" -> `email_admin_notifications` (admin only)
- Copy: "Reminders and changes for events you're attending or hosting"
- Risk: Copy does not mention "weekly digest" explicitly

**Happenings Page (`app/happenings/page.tsx`)**
- Current: No digest CTA exists
- GTM-2 target: "Save as my digest" button on filters
- GTM-2 target: "Get this as an email" banner for non-subscribers
- Risk: Adding too many CTAs could feel spammy

### Filter Persistence Gap

Current state of happenings filters:

| Filter Type | URL Param | Persisted? | GTM-2 Need |
|-------------|-----------|------------|------------|
| Search | `q` | No | Optional |
| Time | `time` | No | No |
| Event type | `type` | No | Yes |
| DSC events | `dsc` | No | No |
| Days of week | `days` | No | Yes |
| City | `city` | No | Yes |
| ZIP | `zip` | No | Yes |
| Radius | `radius` | No | Yes |
| Cost | `cost` | No | Yes |
| View mode | `view` | No | No |

Key insight: Users must re-apply filters every visit. The "Save as my digest" feature requires filter preferences to be stored in `digest_preferences` table.

---

## Investigation 4: Personalization Feasibility Check

### Proposed Schema Review

From `weekly-personalized-digest-north-star.md:147-177`:

```sql
CREATE TABLE digest_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_types TEXT[] DEFAULT ARRAY['open_mic'],
  zip_code TEXT,
  city TEXT,
  radius_miles INTEGER DEFAULT 10,
  days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
  free_only BOOLEAN DEFAULT FALSE,
  favorite_venue_ids UUID[],
  digest_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Schema Validation

| Column | Type | Existing Infra Compatibility | Notes |
|--------|------|------------------------------|-------|
| `event_types TEXT[]` | Array | Compatible | Maps to `type` URL param |
| `zip_code TEXT` | String | Compatible | Maps to `zip` URL param |
| `city TEXT` | String | Compatible | Maps to `city` URL param |
| `radius_miles INTEGER` | Integer | Compatible | Maps to `radius` URL param (5/10/25/50) |
| `days_of_week INTEGER[]` | Array | Compatible | Maps to `days` URL param |
| `free_only BOOLEAN` | Boolean | Compatible | Maps to `cost=free` URL param |
| `favorite_venue_ids UUID[]` | Array | Requires join | Not in current URL params |
| `digest_enabled BOOLEAN` | Boolean | New control | Separate from `email_event_updates` |

### Dual Control Question

The schema introduces `digest_enabled` which is SEPARATE from `notification_preferences.email_event_updates`.

Current flow:
```
email_event_updates = false -> No digest sent
```

Proposed flow:
```
email_event_updates = false -> No digest sent (delivery gate)
digest_enabled = false -> No digest sent (content gate)
```

Recommendation: Keep `email_event_updates` as the master gate. Remove `digest_enabled` from schema to avoid confusion. If user wants to stop digest, they disable `email_event_updates`.

### Anonymous Subscriber Handling (GTM-4)

Current state:
- `newsletter_subscribers` table has no preference columns
- Cannot store event type, location, or day preferences
- Schema addition required: `digest_enabled BOOLEAN DEFAULT TRUE`

GTM-4 approach (from north star doc):
- Add `digest_enabled` column to `newsletter_subscribers`
- Send with sensible defaults (all Denver, all event types)
- No personalization for anonymous subscribers

Risk: Anonymous subscribers may churn if digest doesn't match their interests.

### Filter-to-Column Mapping

| Happenings Filter | digest_preferences Column | Default Value |
|-------------------|---------------------------|---------------|
| `type` | `event_types[]` | `['open_mic']` |
| `zip` | `zip_code` | `NULL` |
| `city` | `city` | `NULL` |
| `radius` | `radius_miles` | `10` |
| `days` | `days_of_week[]` | `[0,1,2,3,4,5,6]` |
| `cost=free` | `free_only` | `false` |

---

## Investigation 5: Web Digest Parity Investigation

### Proposed Route

From north star doc: `/digest/weekly`

### Architecture Sketch

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WEB DIGEST ARCHITECTURE                              │
└─────────────────────────────────────────────────────────────────────────────┘

[1] ROUTE: /digest/weekly
    ├── Auth: Optional (logged in = personalized, logged out = preview)
    └── Query params: ?preview=true (public preview mode)

[2] DATA FETCHING (SERVER COMPONENT)
    ├── Reuse: `getUpcomingOpenMics()` / `getUpcomingHappenings()`
    ├── If logged in: Fetch `digest_preferences` for user
    ├── If logged out + preview: Use sensible defaults
    └── If logged out + no preview: Redirect to login or show CTA

[3] RENDERING
    ├── Same day-grouped structure as email
    ├── Clickable event cards
    ├── Filter summary at top
    └── "Edit preferences" link (logged in only)

[4] CACHING
    ├── Option A: SSR every request (simplest, no cache)
    ├── Option B: Edge cache with user-key invalidation
    └── Recommendation: Start with Option A
```

### Reuse Opportunities

| Email Component | Web Reuse? | Notes |
|-----------------|------------|-------|
| `getUpcomingOpenMics()` | Yes | Core data fetching |
| `expandOccurrencesForEvent()` | Yes | Already shared |
| `formatDayHeader()` | Partial | Different styling |
| Day-grouped structure | Yes | Same grouping logic |
| Event row layout | No | Web uses components |

### Preview Mode Safety

| Mode | Auth Required | Data Shown | CTA |
|------|---------------|------------|-----|
| Logged in | Yes | Personalized digest | "Edit preferences" |
| `?preview=true` | No | Default Denver/all types | "Get this every Sunday" |
| Logged out (no param) | No | Redirect to preview | N/A |

Risk: Preview mode should NOT show real user data. Must use hardcoded defaults.

### Auth vs Anonymous Handling

| Scenario | Behavior |
|----------|----------|
| Logged in, has preferences | Show personalized digest |
| Logged in, no preferences | Show defaults, prompt to save |
| Anonymous, preview mode | Show sample digest with defaults |
| Anonymous, no preview | Redirect to `/digest/weekly?preview=true` |

---

## STOP-GATE REPORT: GTM-1 Readiness

### GTM-1 Scope Reminder

From north star doc:
> **GTM-1: Expand to All Event Types (2-3 days)**
> - Rename `weeklyOpenMicsDigest` to `weeklyHappeningsDigest` (or keep both)
> - Query all event types
> - Update email template subject/copy
> - Update cron job

### Readiness Assessment

| Item | Status | Blocker? |
|------|--------|----------|
| Query expansion code path identified | Ready | No |
| Template rename path clear | Ready | No |
| Registry update path clear | Ready | No |
| Preference category mapping ready | Ready | No |
| Kill switch pattern established | Ready | No |
| Email scale concerns | Needs monitoring | No |
| Test coverage plan | Documented below | No |

### GTM-1 Ready: YES

GTM-1 can proceed. No architectural blockers identified.

---

## EXECUTION ORDER PROPOSAL

### Phase GTM-1 Task Sequence

| Order | Task | Justification | Estimated Effort |
|-------|------|---------------|------------------|
| 1 | Create `lib/digest/weeklyHappenings.ts` | New file, no existing code risk | 1 hour |
| 2 | Expand query to all event types | Single line change in new file | 15 min |
| 3 | Create `lib/email/templates/weeklyHappeningsDigest.ts` | Copy and modify existing | 30 min |
| 4 | Update email subject and copy | Template text changes | 30 min |
| 5 | Register new template in `registry.ts` | Single line addition | 5 min |
| 6 | Add to `EMAIL_CATEGORY_MAP` in `preferences.ts` | Single line addition | 5 min |
| 7 | Create new cron route `/api/cron/weekly-happenings` | Copy existing with import change | 30 min |
| 8 | Update `vercel.json` cron config | JSON edit | 5 min |
| 9 | Add separate kill switch `ENABLE_WEEKLY_HAPPENINGS_DIGEST` | Optional, for rollout control | 15 min |
| 10 | Write tests for new module | Contract tests | 2 hours |
| 11 | Update `EMAIL_INVENTORY.md` | Documentation | 15 min |
| 12 | Update `CLAUDE.md` Recent Changes | Documentation | 10 min |

### Total Estimated Effort: 5-6 hours (within 2-3 day estimate)

### Parallel vs Sequential

Tasks 1-4 must be sequential (dependencies).
Tasks 5-6 can run in parallel.
Tasks 7-8 must be sequential.
Task 9 is optional and independent.
Tasks 10-12 can run in parallel after 1-8 complete.

---

## EDGE CASE REGISTER

### EC-1: Empty Digest

| Scenario | Current Behavior | Recommended Behavior |
|----------|------------------|---------------------|
| 0 events in 7-day window | Shows "No open mics scheduled this week" | Update copy to "No happenings scheduled this week" |
| User filters result in 0 events | N/A (no personalization yet) | GTM-2: "No happenings match your preferences. Expand your filters?" |

### EC-2: Over-Filtering (GTM-2+)

| Scenario | Risk | Mitigation |
|----------|------|------------|
| User selects ZIP with 0 venues | Empty digest every week | Show nearest events + "Expand your search" CTA |
| User selects unpopular event type | Sparse digest | Show "Also happening this week" section |
| User selects single day (e.g., only Wednesdays) | 0-2 events typical | Warning at preference save time |

### EC-3: Subscriber Churn

| Risk | Detection | Mitigation |
|------|-----------|------------|
| Unsubscribe spike after GTM-1 | Monitor unsubscribe rate week-over-week | A/B test subject line, add "Open Mics" section header for continuity |
| Low open rate | Track open rate in email analytics | Personalize subject line in GTM-2 |

### EC-4: CTA Overexposure

| Surface | Current State | Risk |
|---------|---------------|------|
| Homepage | 1 newsletter CTA | Low |
| Footer | 1 newsletter CTA | Low |
| Happenings (GTM-2) | 0 CTAs | Adding banner could feel pushy |
| Dashboard settings | Toggles only | Low |

Recommendation: For GTM-2, limit to ONE digest CTA on happenings page. Use dismissable banner, not inline interruption.

### EC-5: Multi-City Expansion

| Consideration | Current State | Future Requirement |
|---------------|---------------|-------------------|
| Digest subject line | "...in Denver" | Must parameterize city name |
| Default location | Hardcoded Denver coords | Must be configurable |
| Timezone | America/Denver | Must be parameterized |
| Event sources | Denver-area only | Must support city-specific data sources |

GTM-1 does NOT address multi-city. This is a future concern noted for architecture planning.

### EC-6: Email Deliverability

| Risk | Detection | Mitigation |
|------|-----------|------------|
| Bounce rate spike | Monitor via Fastmail analytics | Warm up sending gradually |
| Spam complaints | Monitor spam reports | Clear unsubscribe, respect preferences |
| Large email size | Monitor email byte size | Paginate if >50 events |

---

## APPROVAL CHECKLIST

Before proceeding to GTM-1 implementation, confirm:

### Architecture Decisions

- [ ] **Rename vs Alias:** Create new files (`weeklyHappenings.ts`, `weeklyHappeningsDigest.ts`) or modify existing?
  - Recommendation: Create new files, keep old for backward compatibility during rollout

- [ ] **Separate Kill Switch:** Add `ENABLE_WEEKLY_HAPPENINGS_DIGEST` or reuse `ENABLE_WEEKLY_DIGEST`?
  - Recommendation: Add new kill switch for independent rollout control

- [ ] **Template Registration:** Add `weeklyHappeningsDigest` to registry alongside or replacing `weeklyOpenMicsDigest`?
  - Recommendation: Add alongside, deprecate old after GTM-1 stable

### Copy Decisions

- [ ] **Subject Line:** Approve new subject: "Happenings This Week in Denver" (was "Open Mics This Week in Denver")

- [ ] **Email Intro:** Approve new copy: "Here are the happenings this week:" (was "Here are the open mics happening this week:")

- [ ] **Summary Line:** Approve format: "That's X happenings across Y venues this week." (was "open mics")

- [ ] **CTA Button:** Approve: "Browse All Happenings" (was "Browse All Open Mics")

- [ ] **Unsubscribe Text:** Approve: "You're receiving this because you opted in to event updates." (unchanged)

### Data Decisions

- [ ] **Event Types Included:** All active event types, or exclude certain types (e.g., `other`)?
  - Current types: `song_circle`, `workshop`, `meetup`, `showcase`, `open_mic`, `gig`, `kindred_group`, `jam_session`, `other`
  - Recommendation: Include all types in GTM-1 for maximum coverage

### Test Coverage

- [ ] **Unit Tests:** Require tests for new `weeklyHappenings.ts` module?
  - Recommendation: Yes, mirror existing `weeklyOpenMics` test coverage

- [ ] **Integration Tests:** Require email template snapshot tests?
  - Recommendation: Yes, for regression prevention

### Rollout Plan

- [ ] **Staged Rollout:** Deploy with kill switch off, enable after manual verification?
  - Recommendation: Yes

- [ ] **Monitoring:** Commit to monitoring unsubscribe rate and open rate for 2 weeks post-launch?

---

## Summary

GTM-1 is ready to proceed. The current pipeline is well-structured for expansion. Key changes are localized to:

1. Data fetching (expand event type filter)
2. Email template (copy updates)
3. Template registry (new entry)
4. Cron configuration (optional route rename)

No database migrations required for GTM-1.
No UI changes required for GTM-1.
No architectural changes required for GTM-1.

---

**STOP — AWAITING APPROVAL**

Please review the APPROVAL CHECKLIST above and provide explicit approval or modifications before GTM-1 implementation begins.

# GTM-3 Investigation: Editorial Layer + Newsletter Subscriber Unsubscribe

**Status:** COMPLETED (February 2026)
**Version:** 1.0
**Created:** February 2026
**Author:** Repo Agent
**Phase:** GTM-3

> **Note:** This investigation was approved and implemented. See `docs/gtm/gtm-3-implementation-plan.md` for the implementation plan and `CLAUDE.md` "GTM-3" section for delivery details.

---

## SECTION 1: Current State Inventory

### 1.1 Subscriber Pools

There are **two completely separate subscriber pools** in the system. They share no tables, no foreign keys, and no identity overlap.

#### Pool A: Registered Members

| Attribute | Value |
|-----------|-------|
| Identity table | `profiles` (FK to `auth.users`) |
| Preference table | `notification_preferences` (FK to `profiles.id`) |
| Identity key | UUID (`profiles.id`) |
| Has email | `profiles.email` (nullable) |
| Digest opt-out field | `notification_preferences.email_event_updates` (boolean, default `true` via `?? true` coalesce) |
| Currently receives digest | Yes — `getDigestRecipients()` queries this pool exclusively |

**Citation:** `web/src/lib/digest/weeklyHappenings.ts:297-347` — `getDigestRecipients()` queries `profiles` table, joins with `notification_preferences`, defaults to `true` at line 333.

#### Pool B: Newsletter Subscribers (Guests)

| Attribute | Value |
|-----------|-------|
| Identity table | `newsletter_subscribers` |
| Identity key | `email` (unique, normalized to lowercase) |
| Has user account | No — no FK to `auth.users` or `profiles` |
| Unsubscribe pattern | `unsubscribed_at` timestamp (soft-delete; set to `null` on re-subscribe) |
| Currently receives digest | **No** — never included in any digest send |

**Citation:** `web/src/app/api/newsletter/route.ts:22-45` — Operates on `newsletter_subscribers` table. Upserts by email. Uses `unsubscribed_at` for unsubscribe status (line 42). Zero connection to digest system.

#### Digest-Relevant Comparison

| Capability | Members (Pool A) | Newsletter Subscribers (Pool B) |
|------------|------------------|---------------------------------|
| Receives weekly digest | Yes | No |
| Has HMAC unsubscribe URL | Yes (userId-based) | No (no userId) |
| Has one-click opt-out | Yes (`/api/digest/unsubscribe`) | No |
| Has opt-back-in | Yes (`/dashboard/settings`) | No mechanism exists |
| Has notification preferences | Yes (`notification_preferences` table) | No |

### 1.2 Unsubscribe Flows

#### Current: Member Unsubscribe (Working)

The member unsubscribe flow is a 3-step chain:

1. **Token generation** — `generateUnsubscribeToken(userId)` produces HMAC-SHA256 of `"{userId}:unsubscribe_digest"` using `UNSUBSCRIBE_SECRET`.
   - **Citation:** `web/src/lib/digest/unsubscribeToken.ts:24-34` — Message format at line 30, HMAC at lines 31-33.

2. **URL construction** — `buildUnsubscribeUrl(userId)` creates `/api/digest/unsubscribe?uid={userId}&sig={hmac}`.
   - **Citation:** `web/src/lib/digest/unsubscribeToken.ts:68-78` — Full URL with `encodeURIComponent` at line 77.

3. **Opt-out action** — GET endpoint validates HMAC, then upserts `notification_preferences.email_event_updates = false` keyed by `user_id`.
   - **Citation:** `web/src/app/api/digest/unsubscribe/route.ts:36-56` — HMAC validation at line 36, UPSERT at lines 48-56.

4. **Confirmation** — Redirects to `/digest/unsubscribed?success=1` with warm copy and re-subscribe CTA linking to `/dashboard/settings`.
   - **Citation:** `web/src/app/api/digest/unsubscribe/route.ts:67`

#### Current: Newsletter Subscriber Unsubscribe (Does Not Exist)

There is **no unsubscribe flow** for newsletter subscribers. The `newsletter_subscribers` table has an `unsubscribed_at` column but:

- No API endpoint exists to set it
- No HMAC token scheme exists for email-based identity
- No links in any email point to a newsletter-specific unsubscribe endpoint
- Newsletter subscribers don't receive the digest, so the question is currently moot — but if GTM-4 (from the North Star doc) sends digests to this pool, an unsubscribe flow is a hard prerequisite

### 1.3 Email Rendering Pipeline

The digest email rendering follows a clean 3-layer separation:

#### Layer 1: Data Fetching

`getUpcomingHappenings(supabase)` fetches all published, active events in a 7-day window, expands occurrences, excludes cancelled dates.

**Citation:** `web/src/lib/digest/weeklyHappenings.ts:205-288` (approximate range for the full function).

#### Layer 2: Template Building

`getWeeklyHappeningsDigestEmail(params)` accepts `{ firstName, userId, byDate, totalCount, venueCount }` and returns `{ subject, html, text }`.

**Citation:** `web/src/lib/email/templates/weeklyHappeningsDigest.ts:163-293`

Key hardcoded elements (no editorial injection points today):

| Element | Location | Current Value |
|---------|----------|---------------|
| Subject line | Line 171 | `"Happenings This Week in Denver"` |
| Intro paragraph | Lines 203-205 | `"Here's what's happening in the Denver songwriter community this week."` |
| Summary line | Lines 196-198 | `"That's X happenings across Y venues this week."` |
| CTA button | Lines 217-225 | `"Browse All Happenings"` → `/happenings` |
| Aspirational copy | Lines 227-229 | `"Want to see more or tailor this to you?..."` |
| Footer | Lines 233-242 | Community copy + unsubscribe link + settings link |

#### Layer 3: Sending

`sendDigestEmails(params)` accepts a `buildEmail` callback and iterates over recipients. The callback is invoked per-recipient, making it the natural injection point for editorial content.

**Citation:** `web/src/lib/digest/sendDigest.ts:62-144` — The `buildEmail` callback at line 29 of the interface definition returns `{ subject, html, text }`.

#### Rendering Injection Point

The cron handler's `buildEmail` callback (where data meets template) is the correct place to inject editorial content:

**Citation:** `web/src/app/api/cron/weekly-happenings/route.ts:136-143` — The callback currently passes only `firstName`, `userId`, `byDate`, `totalCount`, `venueCount` to the template. Adding editorial fields here requires:
1. Fetching editorial data before the send loop
2. Passing it through the callback to the template
3. Extending the template to render editorial sections

### 1.4 Control Hierarchy (Existing)

| Priority | Layer | Implementation |
|----------|-------|----------------|
| 1 (highest) | Env var kill switch | `isWeeklyHappeningsDigestEnabled()` — `lib/featureFlags.ts` |
| 2 | DB toggle | `isDigestEnabled(supabase, "weekly_happenings")` — `lib/digest/digestSettings.ts:110-117` |
| 3 | Idempotency guard | `claimDigestSendLock()` — `lib/digest/digestSendLog.ts:75` |

**Citation:** `web/src/app/api/cron/weekly-happenings/route.ts:38-130` — Full control hierarchy in the cron handler.

---

## SECTION 2: Newsletter Subscriber Unsubscribe Support

### 2.1 Does It Work Today?

**No.** The current unsubscribe system cannot support newsletter subscribers for three structural reasons:

1. **Token generation requires `userId` (UUID).** `generateUnsubscribeToken(userId)` at `unsubscribeToken.ts:24` takes a UUID string. Newsletter subscribers have no UUID — they're identified by email address only.

2. **The unsubscribe endpoint writes to `notification_preferences`.** The UPSERT at `route.ts:48-56` targets `notification_preferences.user_id`. This table requires a FK to `profiles.id` (which requires `auth.users`). Newsletter subscribers have no row in either table.

3. **Newsletter subscribers are never sent digests.** `getDigestRecipients()` at `weeklyHappenings.ts:297-347` only queries `profiles`. Even if the unsubscribe worked, there's nothing to unsubscribe from today.

### 2.2 GTM-3 Proposal: Newsletter Subscriber Unsubscribe

If newsletter subscribers are to receive digests (per the North Star's GTM-4 plan, or earlier), they need their own parallel unsubscribe flow.

#### Token Format

Use HMAC-SHA256 with email as identity (same secret, different message format to prevent cross-use):

```
Message: "{email}:unsubscribe_newsletter"
Token:   HMAC-SHA256(UNSUBSCRIBE_SECRET, message)
URL:     /api/newsletter/unsubscribe?email={email}&sig={token}
```

The different message suffix (`unsubscribe_newsletter` vs `unsubscribe_digest`) ensures a member's digest token cannot be used on the newsletter endpoint and vice versa.

#### Endpoint Behavior

```
GET /api/newsletter/unsubscribe?email={email}&sig={token}
  1. Validate HMAC signature (constant-time comparison)
  2. UPDATE newsletter_subscribers SET unsubscribed_at = NOW() WHERE email = {email}
  3. Redirect to /newsletter/unsubscribed?success=1
```

Uses service role client (bypasses RLS, same pattern as member unsubscribe).

#### Abuse Prevention

| Vector | Mitigation |
|--------|------------|
| Token guessing | HMAC-SHA256 with 256-bit secret; computationally infeasible |
| Timing attacks | `timingSafeEqual` (same as member flow at `unsubscribeToken.ts:60`) |
| Enumeration | Endpoint does not reveal whether email exists (always redirects to same confirmation page) |
| Replay | Idempotent — calling multiple times on already-unsubscribed email is a no-op |

#### Opt-Back-In

Newsletter subscribers re-subscribe by submitting their email to the existing newsletter signup form (`/api/newsletter` POST). This already handles the re-subscribe case: it sets `unsubscribed_at = null` via the UPSERT at `newsletter/route.ts:42`.

The confirmation page (`/newsletter/unsubscribed`) should include:
- Warm community-forward copy (per Email Philosophy in CLAUDE.md)
- "Changed your mind?" CTA linking to the homepage newsletter signup section
- No guilt-based copy, no "are you sure?" gates

#### Member Account Interaction

| Scenario | Behavior |
|----------|----------|
| Newsletter subscriber creates an account later | No automatic merge. The two pools remain independent. Member digest preference (`email_event_updates`) governs member digests. Newsletter `unsubscribed_at` governs newsletter emails. |
| Member also signs up for newsletter | Both subscriptions are independent. Unsubscribing from one does not affect the other. |
| Same email in both pools | If both pools receive digests in the future, the user would get two emails. This should be handled by deduplication at send time (check if email exists in `profiles` before including from `newsletter_subscribers`). |

**Deduplication recommendation:** When newsletter subscribers start receiving digests, the send logic should skip any `newsletter_subscribers.email` that already appears in the member recipient list. Members take precedence.

#### Files That Would Change

| File | Change |
|------|--------|
| `lib/digest/unsubscribeToken.ts` | Add `generateNewsletterUnsubscribeToken(email)` and `validateNewsletterUnsubscribeToken(email, token)` with different message format |
| `app/api/newsletter/unsubscribe/route.ts` | **New** — GET endpoint: validate HMAC, set `unsubscribed_at`, redirect |
| `app/newsletter/unsubscribed/page.tsx` | **New** — Confirmation page with warm copy + re-subscribe CTA |
| Email templates (future newsletter digest) | Include newsletter unsubscribe URL in footer |

---

## SECTION 3: Editorial Layer Proposal

### 3.1 Goal

Allow Sami to add a personal editorial note, featured happenings, member/venue spotlights, and featured blog posts or gallery items to each weekly digest — without redeploying code.

### 3.2 Database Table: `digest_editorial`

```sql
CREATE TABLE digest_editorial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Keyed by week to match digest_send_log pattern
  week_key TEXT NOT NULL,                    -- e.g., "2026-W06" (same format as digestSendLog.ts:33)
  digest_type TEXT NOT NULL DEFAULT 'weekly_happenings',

  -- Editorial sections (all nullable — omit = don't show)
  intro_note TEXT,                           -- Sami's personal intro (renders above happenings list)
  featured_event_ids UUID[],                 -- Highlighted happenings (shown in special "Featured" section)
  spotlight_member_id UUID,                  -- Member spotlight (profile card with bio excerpt)
  spotlight_venue_id UUID,                   -- Venue spotlight (venue card with description)
  featured_blog_slug TEXT,                   -- Featured blog post (title + excerpt + link)
  featured_gallery_slug TEXT,                -- Featured gallery album (thumbnail + link)

  -- Subject line override (null = use default)
  subject_override TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),

  -- One editorial per week per digest type
  CONSTRAINT digest_editorial_week_type_unique UNIQUE (week_key, digest_type)
);

-- RLS: service role only (same pattern as digest_settings)
ALTER TABLE digest_editorial ENABLE ROW LEVEL SECURITY;
-- No policies = service role only access
```

#### Design Rationale

| Decision | Rationale |
|----------|-----------|
| Keyed by `week_key` | Matches `digest_send_log` pattern (`computeWeekKey()` at `digestSendLog.ts:33`). Admin writes for next week's key; cron reads it at send time. |
| All fields nullable | Every editorial section is optional. An empty row = normal digest with no editorial additions. No row for a week = also normal digest. |
| UUID arrays for featured events | Allows featuring 1-3 specific happenings. Resolved at render time via event query. |
| Single member/venue spotlight | One spotlight per type per week. Simple and focused. |
| Subject override | Allows "This Week: Special Showcase at Brewery Rickoli" instead of the default subject. |
| No HTML storage | Store plain text only. HTML rendering happens in the template layer (prevents XSS and ensures consistent styling). |
| Unique constraint on `(week_key, digest_type)` | Prevents duplicate editorial entries. Matches the idempotency pattern. |

### 3.3 Admin UI: Extension to `/dashboard/admin/email`

The existing Admin Email Control Panel (`/dashboard/admin/email`) already has toggle, send, preview, and history features. The editorial layer extends this page with a new section.

#### UI Structure

```
/dashboard/admin/email
├── [Existing] Automation toggles
├── [Existing] Send buttons (test, full, preview)
├── [Existing] Send history table
│
└── [NEW] "Editorial for Next Digest" section
    ├── Week selector (defaults to next week's key, computed from computeWeekKey())
    ├── Intro Note (textarea, max 500 chars)
    ├── Featured Happenings (multi-select dropdown from active events)
    ├── Member Spotlight (single-select from profiles)
    ├── Venue Spotlight (single-select from venues)
    ├── Featured Blog Post (single-select from published blog_posts)
    ├── Featured Gallery Album (single-select from published gallery_albums)
    ├── Subject Line Override (text input, placeholder shows default)
    ├── [Save Draft] button (upserts to digest_editorial)
    └── [Preview with Editorial] button (calls existing preview API with editorial data)
```

#### Fields Detail

| Field | Input Type | Max Length | Notes |
|-------|-----------|------------|-------|
| `intro_note` | Textarea | 500 chars | Plain text. Renders as styled paragraph above happenings list. |
| `featured_event_ids` | Multi-select | 3 events max | Dropdown of published, active events. Rendered in special "Featured This Week" section. |
| `spotlight_member_id` | Single-select | 1 | Dropdown of profiles with avatars. Renders as card with name, avatar, bio excerpt. |
| `spotlight_venue_id` | Single-select | 1 | Dropdown of venues. Renders as card with name, address, event count. |
| `featured_blog_slug` | Single-select | 1 | Dropdown of published blog posts. Renders as title + excerpt + "Read more" link. |
| `featured_gallery_slug` | Single-select | 1 | Dropdown of published gallery albums. Renders as thumbnail + "View album" link. |
| `subject_override` | Text input | 100 chars | If empty, default subject used. |

### 3.4 API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/admin/digest/editorial` | GET | Fetch editorial for a given `week_key` |
| `PUT /api/admin/digest/editorial` | PUT | Upsert editorial for a given `week_key` |

Both admin-only (same auth pattern as existing `/api/admin/digest/*` routes).

### 3.5 Precedence Rules

| Scenario | Behavior |
|----------|----------|
| No `digest_editorial` row for this week | Normal digest — no editorial sections rendered |
| Row exists but all fields null | Normal digest — no editorial sections rendered |
| `intro_note` present | Renders as styled paragraph between greeting and happenings list |
| `featured_event_ids` present | Renders "Featured This Week" section above the date-grouped list |
| `spotlight_member_id` present | Renders "Songwriter Spotlight" section after happenings list |
| `spotlight_venue_id` present | Renders "Venue Spotlight" section after happenings list |
| `featured_blog_slug` present | Renders "From the Blog" section after spotlights |
| `featured_gallery_slug` present | Renders "From the Gallery" section after blog |
| `subject_override` present | Replaces default subject line |

#### Rendering Order in Email

```
1. Greeting ("Hi {name},")
2. [Editorial] Intro Note (if present)
3. [Editorial] "Featured This Week" section (if featured_event_ids present)
4. "Here's what's happening..." intro
5. Date-grouped happenings list (existing)
6. Summary line (existing)
7. "Browse All Happenings" CTA (existing)
8. [Editorial] "Songwriter Spotlight" (if spotlight_member_id present)
9. [Editorial] "Venue Spotlight" (if spotlight_venue_id present)
10. [Editorial] "From the Blog" (if featured_blog_slug present)
11. [Editorial] "From the Gallery" (if featured_gallery_slug present)
12. Aspirational copy (existing)
13. Unsubscribe footer (existing)
```

### 3.6 Cron Integration

The cron handler at `weekly-happenings/route.ts` would add one step between fetching data and sending:

```
Current flow:
  Kill switch → Auth → DB toggle → Fetch happenings → Fetch recipients → Claim lock → Send

Proposed flow:
  Kill switch → Auth → DB toggle → Fetch happenings → Fetch recipients →
  [NEW] Fetch editorial (digest_editorial for this week_key) → Claim lock → Send
```

The editorial data would be passed to the `buildEmail` callback, which passes it to the template function. The template function receives a new optional `editorial` parameter and conditionally renders sections.

**Critical:** Editorial fetch must happen BEFORE the idempotency lock claim. If the lock is already claimed, we skip everything (no wasted queries). If it's not yet claimed, we need the editorial data ready for the send.

### 3.7 Preview Support

The existing preview API (`/api/admin/digest/preview`) uses `dryRun` mode in `sendDigestEmails()`. It should also fetch the editorial for the target week and include it in the preview. This lets Sami see exactly what the email will look like with editorial content before hitting "Send."

### 3.8 Files That Would Change

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_digest_editorial.sql` | **New** — Create table, RLS, unique constraint |
| `lib/digest/digestEditorial.ts` | **New** — CRUD helpers: `getEditorialForWeek()`, `upsertEditorial()` |
| `app/api/admin/digest/editorial/route.ts` | **New** — GET/PUT admin endpoint |
| `lib/email/templates/weeklyHappeningsDigest.ts` | Extend `WeeklyHappeningsDigestParams` with optional `editorial` field. Add conditional rendering for each section. |
| `app/api/cron/weekly-happenings/route.ts` | Fetch editorial before send, pass to `buildEmail` callback |
| `app/api/admin/digest/preview/route.ts` | Include editorial in preview rendering |
| `app/api/admin/digest/send/route.ts` | Include editorial in test/full sends |
| `app/(protected)/dashboard/admin/email/page.tsx` | Add editorial editor section |

---

## SECTION 4: Risks and Safety

### 4.1 Accidental Sends

| Risk | Mitigation |
|------|------------|
| Editorial saved for wrong week | UI defaults to next week's `computeWeekKey()` and displays the date range prominently. Admin must explicitly change the week selector. |
| Stale editorial from last week shows in new digest | Editorial is keyed by `week_key`. A new week = no editorial unless admin creates one. Cron reads editorial for the CURRENT week key only. |
| Typo in intro note sent to all recipients | Preview API must show editorial content. "Send test to me" should include editorial so admin sees it in their inbox before "Send to all." |
| Featured event cancelled between editorial save and send | Template should gracefully handle missing/cancelled events. If a featured event is no longer published or active at render time, skip it silently. |

### 4.2 Idempotency

The idempotency guard (`digest_send_log` unique constraint) is unaffected by this proposal. Editorial content is fetched and applied during the send phase, which occurs AFTER the lock is claimed. If the lock was already claimed (duplicate send attempt), the send is skipped entirely — editorial or not.

**Key invariant preserved:** Idempotency prevents duplicate sends regardless of editorial content.

### 4.3 Governance

| Principle | Compliance |
|-----------|------------|
| No dark patterns | Editorial is additive content only. Does not change unsubscribe behavior or opt-out flows. |
| Community infrastructure | Editorial sections highlight community members, venues, and content — consistent with community-forward philosophy. |
| Admin control | Editorial is admin-only write. No user-generated editorial content in digests. |
| Additive migration | New table only. No ALTER/DROP on existing tables. Safe rollback. |
| RLS compliance | `digest_editorial` table has RLS enabled with no policies = service role only (same pattern as `digest_settings` per `SECURITY.md`). |

### 4.4 Rollback Plan

| Level | Action |
|-------|--------|
| Disable editorial | Delete the `digest_editorial` row for the week. Template renders normally without editorial sections. |
| Emergency | Env var kill switch (`ENABLE_WEEKLY_HAPPENINGS_DIGEST=false`) blocks all sends. |
| Full revert | Remove editorial fetch from cron handler and template rendering. Table can remain (additive, no harm if unused). |

### 4.5 Newsletter Unsubscribe Risks

| Risk | Mitigation |
|------|------------|
| Token cross-use (member token used on newsletter endpoint) | Different HMAC message format: `"{userId}:unsubscribe_digest"` vs `"{email}:unsubscribe_newsletter"`. Mathematically impossible to cross-use. |
| Unsubscribe link enumeration | Endpoint always redirects to same confirmation page regardless of whether email exists. No information leakage. |
| Spam unsubscribe requests | Endpoint is idempotent (calling on already-unsubscribed email is a no-op). No rate limiting needed beyond standard server-level protection. |
| Email case sensitivity | Normalize to lowercase before HMAC generation and validation (match existing `newsletter/route.ts:19` pattern). |

---

## SECTION 5: Blocking Questions

1. **Should newsletter subscribers receive the weekly happenings digest in GTM-3, or defer to GTM-4?** The North Star doc places anonymous subscriber digests at GTM-4. If GTM-3 includes the editorial layer but NOT newsletter subscriber sends, then the newsletter unsubscribe flow is not needed until GTM-4. However, building it now (GTM-3) means it's ready when GTM-4 ships. Which sequencing do you prefer?

2. **Should the editorial layer support the open mics digest (`weekly_open_mics`) in addition to the happenings digest (`weekly_happenings`)?** The `digest_editorial` table supports multiple digest types via the `digest_type` column, but the UI and template work doubles if both digests get editorial support. Should we start with happenings-only?

3. **Should featured happenings in the editorial layer be pinned to the TOP of the email (before the date-grouped list), or highlighted inline within their date group with a visual badge?** Top-pinned is simpler to implement and ensures visibility. Inline badges preserve chronological ordering but require per-occurrence matching during rendering.

---

## Citations

| File | Lines | Purpose |
|------|-------|---------|
| `web/src/lib/digest/weeklyHappenings.ts` | 297-347 | `getDigestRecipients()` — queries `profiles` table only, defaults `email_event_updates` to `true` at line 333 |
| `web/src/lib/digest/weeklyHappenings.ts` | 205-288 | `getUpcomingHappenings()` — fetches all published+active events in 7-day window |
| `web/src/lib/digest/unsubscribeToken.ts` | 24-34 | `generateUnsubscribeToken()` — HMAC-SHA256 with `"{userId}:unsubscribe_digest"` message |
| `web/src/lib/digest/unsubscribeToken.ts` | 43-61 | `validateUnsubscribeToken()` — constant-time comparison via `timingSafeEqual` |
| `web/src/lib/digest/unsubscribeToken.ts` | 68-78 | `buildUnsubscribeUrl()` — constructs full URL with `uid` and `sig` params |
| `web/src/app/api/digest/unsubscribe/route.ts` | 23-74 | Unsubscribe endpoint — validates HMAC, upserts `notification_preferences.email_event_updates = false` |
| `web/src/app/api/digest/unsubscribe/route.ts` | 48-56 | The UPSERT targeting `notification_preferences` by `user_id` |
| `web/src/app/api/newsletter/route.ts` | 22-45 | Newsletter signup — operates on `newsletter_subscribers` table, email-based identity |
| `web/src/app/api/newsletter/route.ts` | 42 | Re-subscribe pattern: sets `unsubscribed_at: null` |
| `web/src/lib/digest/sendDigest.ts` | 25-38 | `SendDigestParams` interface — `buildEmail` callback is the injection point |
| `web/src/lib/digest/sendDigest.ts` | 62-144 | `sendDigestEmails()` — 3 modes: full, test, dryRun |
| `web/src/lib/email/templates/weeklyHappeningsDigest.ts` | 34-45 | `WeeklyHappeningsDigestParams` interface — current params (no editorial fields) |
| `web/src/lib/email/templates/weeklyHappeningsDigest.ts` | 163-293 | Template function — hardcoded subject (line 171), intro (line 204), footer (lines 233-242) |
| `web/src/app/api/cron/weekly-happenings/route.ts` | 34-166 | Full cron handler with control hierarchy, data fetch, and send |
| `web/src/app/api/cron/weekly-happenings/route.ts` | 136-143 | `buildEmail` callback — where editorial data would be injected |
| `web/src/lib/digest/digestSettings.ts` | 15-21 | `DigestSettings` interface — `is_enabled` toggle, no editorial fields |
| `web/src/lib/digest/digestSettings.ts` | 110-117 | `isDigestEnabled()` — fail-closed (returns false if settings missing) |
| `web/src/lib/digest/digestSendLog.ts` | 33 | `computeWeekKey()` — generates `YYYY-Www` format in Denver timezone |
| `web/src/lib/digest/digestSendLog.ts` | 75 | `claimDigestSendLock()` — INSERT with unique constraint as atomic lock |
| `web/src/lib/email/render.ts` | 81-128 | `wrapEmailHtml()` — shared email layout wrapper |
| `web/src/lib/email/render.ts` | 22-24 | `SITE_URL` — centralized URL constant with fallback chain |
| `docs/gtm/weekly-personalized-digest-north-star.md` | 82-90 | Two subscriber pools identified (newsletter_subscribers vs profiles) |
| `docs/gtm/weekly-personalized-digest-north-star.md` | 140-152 | Email Philosophy — 5 principles including one-click opt-out and dark pattern prohibition |
| `docs/gtm/weekly-personalized-digest-north-star.md` | 294-305 | GTM-4 plan for anonymous subscriber digests |

---

## Closeout (February 2026)

**Status:** COMPLETED

All items in this investigation have been implemented:

**Part A (Newsletter Unsubscribe):**
- ✅ Newsletter token functions added to `unsubscribeToken.ts`
- ✅ `/api/newsletter/unsubscribe` endpoint created
- ✅ `/newsletter/unsubscribed` confirmation page created
- ✅ Separate HMAC message family prevents cross-use attacks

**Part B (Editorial Layer):**
- ✅ `digest_editorial` table created with RLS
- ✅ Editorial CRUD helpers in `digestEditorial.ts`
- ✅ Admin editorial API routes (GET/PUT/DELETE)
- ✅ Email template extended with all 7 editorial sections
- ✅ Cron handler resolves editorial AFTER lock (Delta 1)
- ✅ Admin UI editorial editor with week navigation

**GTM-3.1 Polish:**
- ✅ URL-only inputs (no slugs/UUIDs)
- ✅ Baseball card renderer for all featured items
- ✅ Featured ordering: member → event → blog → gallery
- ✅ Intro note formatting preserves paragraphs and line breaks
- ✅ Blog cover image support

**Blocking Questions Resolved:**
1. Newsletter subscribers deferred to GTM-4 (only infrastructure built in GTM-3)
2. Editorial layer supports `weekly_happenings` only (happenings-only as decided)
3. Featured happenings pinned at TOP of email (before date-grouped list)

See CLAUDE.md "GTM-3: Editorial Layer + Newsletter Unsubscribe" section for full delivery details.

# CONTRACTS — Canonical Product & UI Contracts (v2.0)

## Purpose

This document defines **enforceable contracts** for product behavior and UI rendering.
If a rule can be tested, validated, or enforced, it belongs here.

This is **normative** (not descriptive).

> **Canonical UX rules:** [PRODUCT_NORTH_STAR.md](./PRODUCT_NORTH_STAR.md) is the authoritative source for philosophy and design decisions.

---

## Authority & Reading Order

- Principles and philosophy live in: `docs/PRODUCT_NORTH_STAR.md` (canonical)
- Visual tokens and theme system live in: `docs/theme-system.md` (canonical)
- Testable UI/data rules live here: `docs/CONTRACTS.md` (canonical)

If documents conflict:
1. PRODUCT_NORTH_STAR wins on philosophy
2. CONTRACTS wins on enforceable UI behavior
3. theme-system wins on tokens and surfaces

Any contradiction must be resolved explicitly; silent drift is not allowed.

## Change Control + Stop-Gate

Changes to contracts require:
- A short rationale ("why")
- Reference to user feedback or a concrete failure mode
- Updating related tests when applicable
- **Orchestrator approval before execution** (see [GOVERNANCE.md](./GOVERNANCE.md))

### Contract Update Requirements

When UI behavior changes:
1. Update the relevant contract in this document
2. Update or add tests that enforce the contract
3. Update CLAUDE.md "Recent Changes" section

**Contracts and tests must stay synchronized. Silent drift is not allowed.**

See [docs/GOVERNANCE.md](./GOVERNANCE.md) for the full stop-gate workflow.

---

## Contract: Event Discovery Surface

### Layout Contract (v2.0)

- Event discovery cards are **scan-first, image-forward**.
- Grid layouts are allowed **only** with poster-constrained cards (not row/classified layouts).
- Event cards must visually align with MemberCard quality (density, hover polish, clarity).

### Card Clickability Contract

- Entire card is clickable to details (no tiny "Details →" link required).
- Any secondary actions (e.g., favorite) must not break primary tap target.

---

## Contract: Event Poster Media

**Global Rule:** Posters are mandatory media for all events. Users are never required to crop, resize, or redesign images.

### Card Thumbnail Aspect Ratio

- Card thumbnails use a constrained aspect ratio: **3:2**.
- Card thumbnails must handle any source poster ratio:
  - Preferred: dedicated 3:2 card image if available (`cover_image_card_url`)
  - Otherwise: blurred background + contain foreground fallback (`cover_image_url`)
  - Otherwise: type-based default image fallback (if available)
  - Otherwise: neutral placeholder (gradient with music note icon)

### Detail Page Poster

- Detail pages may display the original poster in its native ratio.
- Rendered full width with natural height (`height: auto`)
- No cropping, no overlays, no forced aspect ratio
- All text content renders **below** the poster

### Upload Guidance Contract

- UI that accepts poster uploads must provide:
  - Recommended size guidance
  - Cropping tool expectations (if cropping exists)
  - A clear distinction between "card thumbnail" vs "full poster" behavior

### Data Notes

- No new schema fields required beyond existing `cover_image_url` and `cover_image_card_url`
- Cropping/resizing is a **presentation concern**, not a data concern
- Missing images render the designed gradient placeholder (never empty space)

---

## Contract: Media Upload Consistency

### Upload Size Standard

- Supported user-facing upload surfaces use a **10 MB max per image**.
- Surfaces in scope: profile photos, event cover/photo uploads, venue photos, blog images, community gallery.
- UI helper copy should use: `Max 10 MB`.

### Event Cover Path Contract

- Event cover uploads must use `event-images/{eventId}/{uuid}.{ext}`.
- Event cover uploads must create an `event_images` row (`event_id`, `image_url`, `storage_path`, `uploaded_by`).
- In create mode (no `eventId` yet), file upload is deferred until after event creation.

### Deletion and Visibility Contract

- `profile_images`, `event_images`, `venue_images` use soft-delete via `deleted_at`.
- `gallery_images` user deletion is soft-archive via `is_hidden = true` (not row deletion).
- User-facing media flows should not hard-delete DB rows directly.

### Aspect Ratio Contract by Surface

- Event cover and event photo uploader crop ratio: **3:2**
- Venue photo uploader crop ratio: **16:9**
- Profile photo uploader crop ratio: **1:1**

---

## Contract: Community Invite & Referral Attribution (Phase 7B.1)

### Scope Contract

- Phase 7B.1 is **share-only**:
  - Copy link
  - `mailto:` intent
  - Native share intent (when supported)
- No platform-sent invite email in 7B.1.
- Media embeds are out of scope for this tract.

### Clean Invite URL Contract

- Member-facing share links must point to the clean homepage URL:
  - `https://denversongwriterscollective.org/`
- Invite links should avoid visible tracking query params.
- The primary invite flow should feel like a personal recommendation, not a tracking funnel.

### Attribution Contract

- Referral params, when present from other channels, must survive auth callback and onboarding completion.
- Attribution persists to `profiles`:
  - `referred_by_profile_id`
  - `referral_via`
  - `referral_source`
  - `referral_captured_at`
- Existing non-null attribution values are not overwritten during later onboarding updates.

### CTA Surface Contract (7B.1)

- Invite CTA is required on approved surfaces:
  - Header (logged-in)
  - Mobile nav (logged-in)
  - Homepage community sections
  - `/happenings` community CTA block
  - Weekly digest templates (happenings + open mics)
- Invite CTA copy must remain consistent in tone across surfaces.

---

## Contract: Region + Community Platform Architecture (STRAT-01, Docs-Only)

> Strategic contract for future implementation phases. No enforcement code is introduced in this section.

### Domain Agnosticism Contract (Non-Negotiable)

**Invariant:** The codebase must remain **domain-agnostic** and **TLD-agnostic** at all times.

**Enforceable Rules:**

| Forbidden Pattern | Required Pattern |
|------------------|------------------|
| Hard-coded `.org` in URLs | Environment-driven domain config |
| Hard-coded `.com` in URLs | Environment-driven domain config |
| Hard-coded full domain strings | `process.env.NEXT_PUBLIC_SITE_URL` or equivalent |
| TLD-specific routing logic | Domain-neutral routing |
| Email templates with baked-in domains | Template variables for all domain references |

**Rationale:**
- Platform will launch with `.org` TLD (working assumption: `coloradosongwriterscollective.org`, `songwriterscollective.org`)
- Future switch to `.com` variants is explicitly supported
- Migration must be **DNS + configuration only** (no code refactor)

**Test Enforcement:**
- Any new URL generation code must use environment variables
- Any email template changes must use domain variables
- Any embed/iframe code must avoid hard-coded domains

**Non-Goals:**
- This contract does NOT prescribe which TLD to use (`.org` vs `.com`)
- This contract does NOT require immediate domain acquisition
- This contract does NOT imply a specific migration timeline

### Region as First-Class Concept

- The platform root is not a single city deployment.
- A region (example: Denver, Boulder, Austin, Nashville) is a first-class boundary for discovery, operations, and governance.
- Denver is treated as a region instance, not the product itself.

### Community Type as First-Class Concept

- Songwriters is the default community type.
- Additional community types (comedians, community sports leagues, and similar member-venue-event ecosystems) are supported as first-class variants.
- Community type differences should be implemented via configuration/contracts, not separate codebases.

### Admin Scope Contract

- Admin scopes are explicitly tiered:
  - Global platform admin
  - Regional admin
  - Community-specific admin
- Scope boundaries must be auditable and reversible.
- Scope expansion from one level to another requires explicit governance approval.

### Content Ownership Rules

- Core entities (members, events, venues, galleries, blogs) must have clear ownership and moderation boundaries.
- Ownership remains explicit even when content is region- or community-scoped.
- Cross-region/community visibility rules must be declared explicitly before implementation.

### Licensing Boundary Assumptions (No Enforcement Yet)

- Regional/community admin operation may be licensed by the core organization.
- Licensing assumptions are architecture constraints for future phases only.
- No licensing enforcement logic is authorized by this contract update.

### Non-Goals for This Contract Update

- No production URL/domain changes
- No schema/migration requirements
- No runtime permission rewrites
- No white-label runtime implementation

---

## Contract: Pill Hierarchy & Scan Signals (v2.0)

Pills exist to accelerate scanning. They must not become "badge soup".

### Tier 1 — Primary Signal Pills (Max 1–2)

**Purpose:** Urgency/trust/sponsorship

**Examples:** `TONIGHT`, `THIS WEEK`, `DSC`, `FREE` (policy: FREE currently remains plain text unless explicitly promoted later)

**Rules:**
- Filled pills
- Accent-muted backgrounds
- Explicit foreground token (never inherited)
- Must remain readable in Sunrise + Night themes

### Tier 2 — Recurrence & Pattern (Always Visible)

**Examples:** `Every Monday`, `Weekly`, `First Monday of the Month`, `Third Thursday`, `One-time`

**Rules:**
- Exactly one recurrence pill per card
- Always visible
- Neutral / soft styling (not accent)

### Tier 3 — Type & Context (De-emphasized)

**Examples:** `Open Mic`, `Showcase`, `Workshop`, `18+`

**Rules:**
- Muted styling
- Never louder than Tier 1 or title/date

### Chip Base Classes

All chips use MemberCard pill style:
```
px-2 py-0.5 text-sm font-medium rounded-full border
```

### Enforceable Rules

- All pill colors must use tokens (no hardcoded values)
- Only Tier 1 pills may use accent colors
- Time, venue, cost must be plain text (not pills)
- Cards must not become "badge soup"

---

## Contract: Missing Data Rendering

Decision-critical fields must never disappear silently.

### Always-Visible Fields on Event Cards

| Field | Requirement |
|-------|-------------|
| Date | Badge or overlay |
| Time | Show time or `NA` if missing |
| Venue | Show venue or `NA` if missing |
| Cost | `Free` or `NA` |
| Recurrence | Tier 2 pill |
| Event type | Tier 3 pill |
| Image | User/derived/default/placeholder |

### Missing Value Standard

| Field | If Missing |
|-------|------------|
| Time | `NA` |
| Venue | `NA` (or `Online` for online-only) |
| Cost | `NA` |
| Critical fields | "Missing details" warning badge |

**Rules:**
- Missing decision-critical values render as: **NA**
- Do not use TBD or em-dash for these fields.
- If labels are shown, use `Label: NA` (preferred) rather than bare `NA`.
- Never silently hide missing decision-critical data.

---

## Contract: Filtering Behavior

### Day-of-Week Filter (Lens, not sort)

- Day filter reduces visible cards but does not change ordering.
- Default: all days active
- Multi-select supported
- URL param is supported (example): `?days=mon,wed,fri`
- Sorting remains linear and date-based.

---

## Contract: Theme Contrast Safety

- Any filled surface (pills, buttons) must have explicit foreground tokens.
- Filled pills must never inherit text color.
- No orange/red text on light backgrounds unless contrast is proven safe.
- Token usage only; avoid hardcoded color classes for interactive components.

See `docs/theme-system.md` for full token definitions and Global Contrast Rule.

---

## Card Components

### HappeningCard (Unified Card — v2.0)

**File:** `web/src/components/happenings/HappeningCard.tsx`

> **v2.0 Visual System:** This is the single unified card component for ALL event types.
> Design matches MemberCard surface treatment. See PRODUCT_NORTH_STAR.md Section 6.

**Props:**
```typescript
interface HappeningCardProps {
  event: HappeningEvent;
  searchQuery?: string | null;
  className?: string;
}
```

**Layout (Vertical Poster Card):**

| Section | Content |
|---------|---------|
| **Top** | 3:2 aspect poster with overlays (date badge, favorite star, status) |
| **Bottom** | Title, meta line (time · venue · cost), chips row |

**Surface Treatment:**
- `card-spotlight` class (radial gradient background, shadow tokens, border radius)
- Hover: `shadow-card-hover` + `border-accent` + poster zoom `scale-[1.02]`
- Past events: `opacity-70`
- Tonight/Tomorrow: accent border highlight

**Scan Order:**
1. Poster image — visual anchor
2. Event title — what is this?
3. Date/time — when is this?
4. Chips — event type, DSC badge, age, signup, availability

**Grid Layout (Responsive):**
- Mobile: 1 column
- Tablet (md): 2 columns
- Desktop (lg): 3 columns

**Test:** `src/components/__tests__/card-variants.test.tsx`

---

### HappeningsCard (Wrapper)

**File:** `web/src/components/happenings/HappeningsCard.tsx`

**Behavior:**
- Thin wrapper around `HappeningCard`
- Passes through event data and search query
- Used by `/happenings` page date-grouped grid layout

---

### Legacy Components (Deprecated)

> **⚠️ DEPRECATED:** These components are kept for backward compatibility but should not be used in new code.

| Old Component | File | Replacement |
|---------------|------|-------------|
| `EventCard` (open mics) | `web/src/components/EventCard.tsx` | `HappeningCard` |
| `EventCard` (DSC events) | `web/src/components/events/EventCard.tsx` | `HappeningCard` |

---

## Page Contracts

### Happenings Page Layout (v2.0)

**File:** `web/src/app/happenings/page.tsx`

**Grid Layout:**
- Responsive card grid: 1 col (mobile) → 2 col (md) → 3 col (lg)
- Date-grouped sections with date headers
- Gap: `gap-4 lg:gap-5`

**Hero Rules:**

| URL | Hero Visible | Page Title Location |
|-----|--------------|---------------------|
| `/happenings` | **Yes** (inside hero) | Hero content |
| `/happenings?type=open_mic` | **No** | Inline h1 ("Open Mics") |
| `/happenings?type=dsc` | **No** | Inline h1 ("DSC Happenings") |

**Rationale:**
- Filtered views prioritize content density
- Unfiltered view provides welcoming entry point

---

## Routing Canonicalization

### Listing Routes

**Canonical listing routes (ONLY these should be linked in UI):**
- `/happenings`
- `/happenings?type=open_mic`
- `/happenings?type=dsc`

**Forbidden listing routes (NEVER link to these):**
- `/open-mics` — redirects, but should not appear in hrefs
- `/events` — redirects, but should not appear in hrefs

**Test:** `src/__tests__/navigation-links.test.ts`

### Detail Routes (Valid)

- `/open-mics/[slug]` — Individual open mic detail page
- `/events/[id]` — Individual DSC event detail page

---

## Navigation Contract

### Header Links

**File:** `web/src/components/navigation/header.tsx`

```typescript
const navLinks = [
  { href: "/happenings", label: "Happenings" },
  { href: "/happenings?type=open_mic", label: "Open Mics" },  // NOT /open-mics
  { href: "/members", label: "Members" },
  // ...
];
```

**Mobile menu** uses the same `navLinks` array.

### Footer Links

**File:** `web/src/components/navigation/footer.tsx`

Open Mics link must use `/happenings?type=open_mic`, not `/open-mics`.

---

## Data Source Contracts

### Open Mic Day Display

| Field | Source | Usage |
|-------|--------|-------|
| Day of week | `event.day_of_week` | Group headers, day badge |
| Recurrence | `event.recurrence_rule` | "Every Monday" text |
| Status | `event.status` | Status badge |

### DSC Event Date Display

| Field | Source | Usage |
|-------|--------|-------|
| Date label | `event.event_date` | "JAN 15" badge |
| Fallback | When `event_date` is null/invalid | "LIVE" |
| Start time | `event.start_time` | "7:00 PM" display |

---

## Contract: Cross-Surface Event Consistency (Phase 6)

> **Track Status:** February 2026

### Canonical Discovery Surfaces

| Surface | Path | Purpose |
|---------|------|---------|
| Homepage "Tonight" | `app/page.tsx` | Today's events preview |
| `/happenings` | `app/happenings/page.tsx` | Full discovery timeline/series/map |
| Weekly digest | `lib/digest/weeklyHappenings.ts` | Email digest (allowed divergence) |

### Shared Contract Module

**File:** `web/src/lib/happenings/tonightContract.ts`

All primary discovery surfaces (Homepage, `/happenings`) MUST use:

| Constant | Value | Purpose |
|----------|-------|---------|
| `DISCOVERY_STATUS_FILTER` | `["active", "needs_verification", "unverified"]` | Canonical status set for public display |
| `DISCOVERY_VENUE_SELECT` | `venue:venues!left(id, slug, name, address, city, state, google_maps_url, website_url)` | Standard venue join (no coords) |
| `DISCOVERY_VENUE_SELECT_WITH_COORDS` | Same + `latitude, longitude` | Extended venue join (map view) |

### Venue Join Alias Rule

PostgREST venue joins MUST use the singular alias `venue:venues!left(...)` so the result is `event.venue` (object), NOT `event.venues` (array). Components read `event.venue.city` / `event.venue.state`.

**Forbidden:** `venues!left(...)` (produces `event.venues` array — breaks HappeningCard city/state display).

### Status Filter Rule

Discovery surfaces MUST use `DISCOVERY_STATUS_FILTER` for their default query. Inline status arrays are forbidden on discovery surfaces.

**Allowed divergence:** The weekly digest intentionally uses `"active"` only. This is documented and permitted.

### Override Pipeline Rule

Any surface that displays "Tonight" or "Today" events from recurring series MUST:

1. Fetch `occurrence_overrides` for the relevant date range
2. Build an override map via `buildOverrideMap()`
3. Pass the map to `expandAndGroupEvents()` via the `overrideMap` option
4. Filter out `isCancelled` entries from public display
5. Pass `override`, `isCancelled`, and `overrideVenueData` props to card components

### Missing Value Standard (Cross-Surface)

All discovery surfaces MUST render missing decision-critical values as `NA`:

| Surface | Missing Venue | Missing Cost |
|---------|---------------|-------------|
| HappeningCard | `NA` | `NA` |
| SeriesCard | `NA` | N/A (no cost display) |
| Digest email | Omitted (allowed divergence) |

**Forbidden tokens for missing values:** `—` (em dash), `TBD`, `Location TBD`, blank/empty.

### Allowed vs Forbidden Cross-Surface Differences

| Difference | Allowed? | Rationale |
|------------|----------|-----------|
| Digest uses `"active"` only | Yes | Digest is curated; unverified events excluded by design |
| Digest omits unknown cost | Yes | Email space constraints; cosmetic-to-correctness boundary |
| Homepage caps at MAX_EVENTS before expansion | Yes | Performance guard for high-traffic page |
| `/happenings` includes lat/lng in venue select | Yes | Map view requires coordinates; homepage has no map |
| Homepage vs `/happenings` using different status sets | **No** | Must use shared `DISCOVERY_STATUS_FILTER` |
| Different venue join aliases across surfaces | **No** | Must use shared `DISCOVERY_VENUE_SELECT*` constants |
| Missing venue rendered differently per surface | **No** | Must use `NA` everywhere |

### Test Coverage

| Test File | Contracts Enforced |
|-----------|-------------------|
| `__tests__/phase6-cross-surface-consistency.test.ts` | Shared constants, status parity, venue alias, missing value normalization, override pipeline |

---

## Testing Enforcement

Tests that enforce these contracts:

| Contract | Test File |
|----------|-----------|
| Nav links use canonical routes | `src/__tests__/navigation-links.test.ts` |
| Card uses `card-spotlight` surface | `src/components/__tests__/card-variants.test.tsx` |
| Poster thumbnail 3-tier rendering | `src/components/__tests__/card-variants.test.tsx` |
| MemberCard pill-style chips | `src/components/__tests__/card-variants.test.tsx` |
| Past event opacity treatment | `src/components/__tests__/card-variants.test.tsx` |
| Cross-surface status/venue consistency | `src/__tests__/phase6-cross-surface-consistency.test.ts` |
| Missing value normalization (NA) | `src/__tests__/phase6-cross-surface-consistency.test.ts` |

**Rule:** If a contract affects rendering logic (NA, pill tiers, filters), it should have a test. Tests must enforce the contract language (not old v1 expectations). Stale or contradictory test descriptions must be updated.

**Rule:** Any change to these contracts must update both the implementation AND this documentation.

---

## Contract: Comments System (Phase 4.30)

> **Track Closed: 2026-01-01**

### Comments-as-Likes Model

Comments replace likes/reactions. Social engagement happens through conversation, not counters.

**Enforceable Rules:**

| Rule | Enforcement |
|------|-------------|
| No like/reaction buttons | Test: `gallery-photo-comments.test.ts` |
| No upvote/downvote | Test: `gallery-photo-comments.test.ts` |
| No comment counts in rankings | Test: `gallery-copy-freeze.test.ts` |
| No "most commented" sorting | Test: `gallery-copy-freeze.test.ts` |
| No popularity metrics | Test: `gallery-copy-freeze.test.ts` |
| No trending/leaderboard UI | Test: `threaded-comments.test.ts` |

### Threading Contract

- **1-level max nesting** — Replies attach to top-level comments only (no reply-to-reply)
- **Chronological order** — Comments sorted by `created_at`, not popularity
- **`parent_id` column** — All comment tables have `parent_id UUID REFERENCES self`

### Visibility Contract

- **Gallery albums/photos:** `is_published=true AND is_hidden=false` (never `is_approved`)
- **Hidden comments:** `is_hidden=true` visible only to moderators (owner/admin)
- **Deleted comments:** `is_deleted=true` visible only to admins with `[deleted]` badge

### Moderation Contract

| Actor | Can Hide | Can Unhide | Can Delete |
|-------|----------|------------|------------|
| Comment author | No | No | Yes (soft) |
| Entity owner | Yes | Yes | No |
| Admin | Yes | Yes | Yes |

**Audit trail:** `hidden_by` column tracks who hid the comment.

### Copy Freeze (Guardrails)

User-facing gallery/comments UI must NOT contain:

| Pattern | Reason |
|---------|--------|
| "pending approval" / "awaiting review" | Implies moderation queue |
| "most commented" / "most popular" | Gamification language |
| "trending" / "top 10" | Ranking language |
| "hurry" / "limited time" / "don't miss" | Urgency/FOMO language |

**Test:** `gallery-copy-freeze.test.ts`

### Test Coverage

| Test File | Contracts Enforced |
|-----------|-------------------|
| `__tests__/threaded-comments.test.ts` | Threading, moderation, profile comments |
| `__tests__/gallery-photo-comments.test.ts` | Comments-as-likes, no gamification |
| `__tests__/gallery-copy-freeze.test.ts` | Copy freeze patterns |
| `__tests__/gallery-comments-soft-delete-rls.test.ts` | RLS policy enforcement |

---

## Contract: Occurrence Overrides (Phase 4.21)

> **Track Status:** January 2026

### Core Principles

- Occurrences are never persisted as primary records
- Overrides are the sole mechanism for per-date changes
- Recurring events remain single canonical DB records

### Override Scope

An override applies only to:
- One `event_id`
- One `date_key` (YYYY-MM-DD, Denver-canonical)

### Enforceable Rules

| Rule | Description |
|------|-------------|
| No persisted occurrences | Individual dates are computed at render time, never stored as separate event rows |
| Cancelled occurrences isolated | Cancelling one date must not affect other occurrences or alter recurrence rules |
| Override precedence | When present, overrides take priority: `override_cover_image_url` > `cover_image_url`, `override_start_time` > `start_time` |
| Hidden by default | Cancelled occurrences are not shown unless user explicitly enables "Show cancelled" toggle |
| Admin-only write | Only admins can create, update, or delete overrides (RLS enforced) |

### Visibility Contract

| Toggle State | Cancelled Occurrences |
|--------------|----------------------|
| Default (off) | Hidden from `/happenings` |
| Enabled (`?showCancelled=1`) | Shown in separate "Cancelled" section |

### UI Display Contract

| Status | Card Treatment |
|--------|----------------|
| Cancelled | Reduced opacity (60%), red accent border, CANCELLED badge (top-left) |
| Override notes | "Note" chip in chips row |
| Override flyer | Card uses override flyer instead of event flyer |

### Test Coverage

| Test File | Contracts Enforced |
|-----------|-------------------|
| `__tests__/occurrence-overrides.test.ts` | Override map, cancelled separation, override attachment |

---

## Contract: Event Claims (Phase 4.22.3)

> **Track Status:** January 2026

### Core Principles

- Only unclaimed events (host_id IS NULL) can be claimed
- Claims are private (users see only their own claims)
- Admin approval required before ownership transfer

### Visibility Contract

| Condition | Claim Button Visible |
|-----------|---------------------|
| User signed in + host_id IS NULL | Yes |
| User signed in + host_id IS NOT NULL | No |
| User not signed in | No |
| User has pending claim | Show status, no new button |

### Claim Status Display

| Status | User Display |
|--------|-------------|
| `pending` | "Pending Approval" pill |
| `approved` | "Approved" pill |
| `rejected` | "Rejected" pill + rejection reason if present |

### Approval Flow Contract

| Step | Action |
|------|--------|
| Admin approves | Set claim status='approved', event host_id=requester_id, insert event_hosts |
| Event already claimed | Auto-reject with reason "Event was already claimed by another user" |
| Admin rejects | Set claim status='rejected', optional rejection_reason |

### RLS Contract

| Actor | Can Create | Can View Own | Can View All | Can Update |
|-------|-----------|--------------|--------------|------------|
| Authenticated user | Yes (own claims) | Yes | No | No |
| Admin | Yes | Yes | Yes | Yes |

### Test Coverage

| Test File | Contracts Enforced |
|-----------|-------------------|
| `__tests__/event-claims.test.ts` | Visibility rules, duplicate prevention, approval/rejection flow, RLS behavior |

---

## Contract: RSVP System (Phase 4.48b)

> **Track Status:** January 2026

### Core Principles

- RSVP = audience planning to attend (NOT performer signup)
- RSVP is available for ALL public events (no is_dsc_event gate)
- Both members and guests can RSVP
- Guests verify via email code before RSVP is confirmed

### Member vs Guest RSVPs

| Type | user_id | guest_name | guest_email | Profile Link |
|------|---------|------------|-------------|--------------|
| Member RSVP | Required | NULL | NULL | Yes (to /songwriters/[slug]) |
| Guest RSVP | NULL | Required | Required | No (plain text) |

### Schema Contract

```sql
-- event_rsvps table enforces member OR guest
CONSTRAINT member_or_guest_rsvp CHECK (
  user_id IS NOT NULL OR
  (guest_name IS NOT NULL AND guest_email IS NOT NULL)
)
```

### Guest Verification Flow

1. Guest enters name + email
2. System sends 6-digit verification code
3. Guest enters code to verify email
4. RSVP created on successful verification
5. Confirmation email includes cancel URL (action token)

### Attendee List Display

| Attendee Type | Display |
|---------------|---------|
| Member | Avatar + Name (linked to profile) |
| Guest | Initial + Name + "(guest)" label (no link) |

### Capacity & Waitlist

| Condition | Behavior |
|-----------|----------|
| `capacity IS NULL` | Unlimited RSVPs (confirmed status) |
| `confirmedCount < capacity` | New RSVP gets confirmed status |
| `confirmedCount >= capacity` | New RSVP gets waitlist status |
| Spot opens (cancel/decline) | Promote next waitlist person with offer |

### Theme Contrast Contract

Success banner must use theme tokens, not hardcoded colors:

| Element | Token |
|---------|-------|
| Background | `--pill-bg-success` |
| Foreground | `--pill-fg-success` |
| Border | `--pill-border-success` |

**Forbidden patterns:**
- `bg-emerald-100`, `bg-emerald-900/30`
- `text-emerald-800`, `text-emerald-300`
- `border-emerald-300`, `border-emerald-700`

### Test Coverage

| Test File | Contracts Enforced |
|-----------|-------------------|
| `__tests__/phase4-48b-guest-rsvp.test.ts` | Schema, verification flow, AttendeeList, theme tokens |

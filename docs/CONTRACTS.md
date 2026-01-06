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

- Card thumbnails use a constrained aspect ratio: **4:3**.
- Card thumbnails must handle any source poster ratio:
  - Preferred: dedicated 4:3 card image if available (`cover_image_card_url`)
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
| **Top** | 4:3 aspect poster with overlays (date badge, favorite star, status) |
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

## Testing Enforcement

Tests that enforce these contracts:

| Contract | Test File |
|----------|-----------|
| Nav links use canonical routes | `src/__tests__/navigation-links.test.ts` |
| Card uses `card-spotlight` surface | `src/components/__tests__/card-variants.test.tsx` |
| Poster thumbnail 3-tier rendering | `src/components/__tests__/card-variants.test.tsx` |
| MemberCard pill-style chips | `src/components/__tests__/card-variants.test.tsx` |
| Past event opacity treatment | `src/components/__tests__/card-variants.test.tsx` |

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

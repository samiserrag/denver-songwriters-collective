# Component Contracts

This document defines the contracts for key components in the codebase. These contracts ensure consistent behavior and prevent regressions.

> **Canonical UX rules:** [PRODUCT_NORTH_STAR.md](./PRODUCT_NORTH_STAR.md) is the authoritative source for card layout, field visibility, and design decisions. This document covers component implementation contracts only.

---

## Event Poster Media Contract (v2.0)

**Global Rule:** Posters are mandatory media for all events. Users are never required to crop, resize, or redesign images.

### Card Rendering (HappeningCard)

- **Aspect ratio:** 4:3 enforced via `aspect-[4/3]`
- **Image tiers:**
  1. `cover_image_card_url` — Optimized card thumbnail (object-cover)
  2. `cover_image_url` — Full poster with blurred background (object-contain)
  3. Gradient placeholder with music note icon (designed, not empty)
- **Surface:** `card-spotlight` class (radial gradient + shadow tokens)
- **Hover:** `scale-[1.02]` zoom on poster, `shadow-card-hover` on card

### Detail Pages

- Poster is **primary**
- Rendered full width with natural height (`height: auto`)
- No cropping, no overlays, no forced aspect ratio
- All text content renders **below** the poster

### Data Notes

- No new schema fields required beyond existing `cover_image_url` and `cover_image_card_url`
- Cropping/resizing is a **presentation concern**, not a data concern
- Missing images render the designed gradient placeholder (never empty space)

### Missing Field Display

Empty or missing critical fields render with explicit indicators:

| Field | If Missing |
|-------|------------|
| Time | `TBD` |
| Venue | `—` (em dash) |
| Cost | `—` (em dash) |
| Venue (online-only) | `Online` |
| Critical fields | "Missing details" warning badge |

**Rule:** Never silently hide missing decision-critical data.

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

**Chips Row (MemberCard pill style):**
- `px-2 py-0.5 text-sm font-medium rounded-full border`
- Event type, age policy, signup time, DSC badge, availability
- "Missing details" as warning badge (amber background)

### Pill Hierarchy & Scan Signals

For the full normative Visual Language & Scanning System, see `docs/theme-system.md`.

**Pill Tiers (Summary):**

| Tier | Purpose | Examples | Visual Weight |
|------|---------|----------|---------------|
| Tier 1 | Urgency/trust | `TONIGHT`, `FREE`, `DSC` | Accent-muted fill, high contrast |
| Tier 2 | Recurrence | `Every Monday`, `Weekly` | Neutral fill, always visible |
| Tier 3 | Type/context | `Open Mic`, `18+` | Muted border, de-emphasized |

**Always-Visible Fields:**
- Date, Time, Venue, Cost, Recurrence, Event type, Image
- Missing fields render as `NA` or `—`, never hidden

**Enforceable Rules:**
- All pill colors must use tokens (no hardcoded values)
- Only Tier 1 pills may use accent colors
- Time, venue, cost must be plain text (not pills)
- Cards must not become "badge soup"

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

**Rule:** Any change to these contracts must update both the implementation AND this documentation.

---

## Canonical UX Rules

Product philosophy and UX laws live in **[PRODUCT_NORTH_STAR.md](./PRODUCT_NORTH_STAR.md)**.

# Component Contracts

This document defines the contracts for key components in the codebase. These contracts ensure consistent behavior and prevent regressions.

> **Canonical UX rules:** [PRODUCT_NORTH_STAR.md](./PRODUCT_NORTH_STAR.md) is the authoritative source for card layout, field visibility, and design decisions. This document covers component implementation contracts only.

---

## Image Rendering Contract (Phase 3.1)

**Global Rule:** Users are never required to crop, resize, or redesign images. Ever.

### Cards (List View)
- Poster is **decorative**
- Bounded container with `object-fit: contain`
- Letterboxing allowed
- Card height controlled by text, not image

### Detail Pages
- Poster is **primary**
- Rendered full width with natural height (`height: auto`)
- No cropping, no overlays, no forced aspect ratio
- All text content renders **below** the poster

---

## Card Components

### HappeningCard (Unified Card — Phase 3.1)

**File:** `web/src/components/happenings/HappeningCard.tsx`

> **Phase 3.1 Migration:** This is the single unified card component for ALL event types.
> The old `EventCard.tsx` (open mics) and `events/EventCard.tsx` (DSC events) are deprecated.

**Props:**
```typescript
interface HappeningCardProps {
  event: HappeningEvent;
  searchQuery?: string | null;
  variant?: "grid" | "list";  // default: "grid"
  onClick?: () => void;
  className?: string;
}
```

> **⚠️ Grid Deprecated:** The `variant="grid"` option exists for legacy compatibility but is not used in production. All event listings use `variant="list"` per PRODUCT_NORTH_STAR.md. Do not introduce grid layouts without explicit approval.

**Variant Behavior:**

| Variant | Image Section | Badge Location | Recurrence Text | Padding |
|---------|---------------|----------------|-----------------|---------|
| `"grid"` | Visible (if `cover_image_url` exists) | Overlay on image | Visible | `p-5` |
| `"list"` | **Hidden** | Inline in content header | **Hidden** | `p-3` |

**Phase 3.1 Display Rules:**
- Image section only renders if `cover_image_url` or `imageUrl` exists (no placeholders)
- Images use `object-fit: contain` with bounded max-height (no cropping)
- **Decision-critical fields** (signup time, cost) show `NA` or `—` when missing. Non-critical fields are omitted. See PRODUCT_NORTH_STAR.md Section 10 for full rules.
- Location mode badges: "Online" (blue) or "Hybrid" (purple) for non-venue events

**Test:** `src/components/__tests__/card-variants.test.tsx`

---

### HappeningsCard (Wrapper)

**File:** `web/src/components/happenings/HappeningsCard.tsx`

**Behavior:**
- Thin wrapper around `HappeningCard`
- **Always passes `variant="list"`** for compact happenings page display
- Used by `/happenings` page grouping logic

---

### Legacy Components (Deprecated)

> **⚠️ DEPRECATED:** These components are kept for backward compatibility but should not be used in new code.

| Old Component | File | Replacement |
|---------------|------|-------------|
| `EventCard` (open mics) | `web/src/components/EventCard.tsx` | `HappeningCard` |
| `EventCard` (DSC events) | `web/src/components/events/EventCard.tsx` | `HappeningCard` |

---

## Page Contracts

### Happenings Page Hero Rules

**File:** `web/src/app/happenings/page.tsx`

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
| List variant hides media | `src/components/__tests__/card-variants.test.tsx` |
| Grid variant shows media | `src/components/__tests__/card-variants.test.tsx` |

**Rule:** Any change to these contracts must update both the implementation AND this documentation.

---

## Canonical UX Rules

Product philosophy and UX laws live in **[PRODUCT_NORTH_STAR.md](./PRODUCT_NORTH_STAR.md)**.

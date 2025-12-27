# Component Contracts

This document defines the contracts for key components in the codebase. These contracts ensure consistent behavior and prevent regressions.

---

## Card Components

### EventCard (Open Mic Cards)

**File:** `web/src/components/EventCard.tsx`

**Props:**
```typescript
interface EventCardProps {
  event: EventType;
  searchQuery?: string | null;
  variant?: "grid" | "list";  // default: "grid"
}
```

**Variant Behavior:**

| Variant | Media Section | Day Badge | Recurrence Text | Padding |
|---------|---------------|-----------|-----------------|---------|
| `"grid"` | Visible (`h-32`) | Visible (overlay) | Visible | `p-5` |
| `"list"` | **Hidden** | **Hidden** (group header shows day) | **Hidden** | `p-4` |

**Rationale:**
- In list mode, the group header (e.g., "Mondays") already shows the day, so day badge and recurrence text are redundant
- Media section is hidden to create compact rows

**Test:** `src/components/__tests__/card-variants.test.tsx`

---

### DscEventCard (DSC Event Cards)

**File:** `web/src/components/events/EventCard.tsx`

**Props:**
```typescript
interface EventCardProps {
  event: Event;
  onClick?: () => void;
  className?: string;
  compact?: boolean;        // default: false
  variant?: "grid" | "list"; // default: "grid"
}
```

**Variant Behavior:**

| Variant | Media Section | Date Badge Location | Text Alignment |
|---------|---------------|---------------------|----------------|
| `"grid"` | Visible (`aspect-[4/3]`) | Overlay on media | Center |
| `"list"` | **Hidden** | Inline in content header | Left |

**Date Badge Values:**
- Valid date: `"JAN 15"` (month + day)
- No date or invalid: `"LIVE"`

**Test:** `src/components/__tests__/card-variants.test.tsx`

---

### HappeningsCard (Wrapper)

**File:** `web/src/components/happenings/HappeningsCard.tsx`

**Behavior:**
- Delegates to `EventCard` for `event_type === "open_mic"`
- Delegates to `DscEventCard` for all other types
- **Always passes `variant="list"`** for compact happenings page display

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
| Date label | `event.date` | "JAN 15" badge |
| Fallback | When `date` is null/invalid | "LIVE" |
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

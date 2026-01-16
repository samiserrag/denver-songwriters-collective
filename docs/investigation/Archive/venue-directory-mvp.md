# Investigation: Venue Directory MVP

**Phase:** TBD (pending approval)
**Status:** STOP-GATE — Awaiting Sami approval before implementation
**Date:** January 2026

---

## 1. Schema + Data Model Findings

### Venues Table Schema (from `database.types.ts`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | string | Required |
| `address` | string | Required (empty string default) |
| `city` | string | Required (default "Denver") |
| `state` | string | Required (default "CO") |
| `zip` | string | Nullable |
| `neighborhood` | string | Nullable (0 of 91 venues have this) |
| `google_maps_url` | string | Nullable (15 of 91 have this) |
| `website_url` | string | Nullable (45 of 91 have this) |
| `phone` | string | Nullable |
| `contact_link` | string | Nullable |
| `map_link` | string | Nullable (legacy, prefer google_maps_url) |
| `accessibility_notes` | string | Nullable |
| `parking_notes` | string | Nullable |
| `notes` | string | Nullable (admin-only notes) |
| `created_at` | timestamp | Auto |
| `updated_at` | timestamp | Auto |

### Data Completeness (91 venues total)

| Field | Count with data |
|-------|-----------------|
| `google_maps_url` | 15 (16%) |
| `website_url` | 45 (49%) |
| `neighborhood` | 0 (0%) |

### Foreign Key Relationship

- `events.venue_id` → `venues.id` (91 venues have at least 1 event)
- `events.custom_location_name` — Non-venue one-off locations (not in venues table)

### RLS Policies (venues table)

| Policy | Command | Effect |
|--------|---------|--------|
| `venues_select_all` | SELECT | Public read (anonymous OK) |
| `Public read access` | SELECT | Public read (redundant) |
| `venues_insert_admin` | INSERT | Admin only |
| `venues_update_admin` | UPDATE | Admin only |
| `venues_delete_admin` | DELETE | Admin only |

**Key finding:** Venues are already publicly readable. No migration needed for MVP.

---

## 2. UI Surface Inventory

### Existing Components (reusable)

| Component | Path | Purpose |
|-----------|------|---------|
| `VenueLink` | `components/venue/VenueLink.tsx` | Name as clickable link (maps > website > plain text) |
| `chooseVenueLink()` | `lib/venue/chooseVenueLink.ts` | URL priority logic |
| `SongwriterCard` | `components/songwriters/SongwriterCard.tsx` | Card template (reuse pattern) |
| `SongwriterGrid` | `components/songwriters/SongwriterGrid.tsx` | Grid layout template |
| `StudioCard` | `components/studios/StudioCard.tsx` | Similar card pattern |
| `ImagePlaceholder` | `components/ui/ImagePlaceholder.tsx` | Fallback when no image |
| `PageContainer` | `components/layout/PageContainer.tsx` | Standard page wrapper |
| `HeroSection` | `components/layout/HeroSection.tsx` | Hero header (used by studios) |

### Existing Admin UI

| Path | Purpose |
|------|---------|
| `/dashboard/admin/venues` | Admin CRUD for venues |
| `AdminVenuesClient.tsx` | Full venue management UI |
| `/api/admin/venues` | Admin GET/POST endpoints |
| `/api/admin/venues/[id]` | Admin PUT/DELETE endpoints |

### Existing Types

```typescript
// types/index.ts - already exists
export interface Venue {
  id: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  map_link?: string | null;
  google_maps_url?: string | null;
  website?: string | null;  // legacy
  website_url?: string | null;
  phone?: string | null;
}
```

---

## 3. Proposed Routes + Minimal UX Spec

### `/venues` — Index Page

**Purpose:** Browse all venues hosting happenings in the Denver area.

**Layout:**
- Hero header (like `/studios`): "Venues" + subtitle
- Grid of VenueCard components (1/2/3/4 cols responsive)
- Sorted alphabetically by name

**VenueCard MVP Fields:**
- Venue name (clickable to detail page)
- City, State (e.g., "Denver, CO")
- Event count badge (e.g., "12 happenings")
- Website/Maps link icon row (if available)

**Empty state:** "No venues found."

### `/venues/[id]` — Detail Page

**Purpose:** Show venue info + all happenings at this venue.

**Layout:**
1. **Header Section:**
   - Venue name (h1)
   - Address (full street address, city, state, zip)
   - Website link (if available)
   - "Get Directions" button (if google_maps_url or address)
   - Phone number (if available)
   - Accessibility notes (if available)
   - Parking notes (if available)

2. **Happenings Section:**
   - "Happenings at [Venue Name]" (h2)
   - Grid of HappeningCard components
   - Upcoming only (filter by today onwards)
   - Sorted by next occurrence date

**404 case:** "Venue not found."

---

## 4. Query Plan (Avoid N+1)

### `/venues` Index Query

```typescript
// Single query with aggregated event count
const { data: venues } = await supabase
  .from("venues")
  .select(`
    id,
    name,
    address,
    city,
    state,
    google_maps_url,
    website_url,
    phone,
    events!venue_id(count)
  `)
  .order("name", { ascending: true });

// Note: events!venue_id(count) does a LEFT JOIN with COUNT
// Returns: { ...venue, events: [{ count: N }] }
```

**Alternative (if count syntax not supported):**
```typescript
// Fallback: Two queries
const { data: venues } = await supabase.from("venues").select("*").order("name");
const { data: counts } = await supabase.rpc("get_venue_event_counts");
// Merge client-side
```

### `/venues/[id]` Detail Query

```typescript
// Query 1: Venue details
const { data: venue } = await supabase
  .from("venues")
  .select("*")
  .eq("id", venueId)
  .single();

// Query 2: Events at this venue (upcoming only)
const { data: events } = await supabase
  .from("events")
  .select(`
    id, slug, title, event_type, event_date, day_of_week,
    start_time, end_time, recurrence_rule, status,
    cover_image_url, cover_image_card_url, is_dsc_event,
    is_free, cost_label
  `)
  .eq("venue_id", venueId)
  .eq("status", "active")
  .gte("event_date", todayKey)  // upcoming filter
  .order("event_date", { ascending: true });
```

**Note:** For recurring events without `event_date`, we'll show them regardless and let `HappeningCard` handle occurrence computation.

---

## 5. Edge Cases

| Scenario | Handling |
|----------|----------|
| **Venue with no events** | Show venue details, empty happenings section with "No upcoming happenings at this venue." |
| **Venue with no links** | `VenueLink` renders as plain text; no "Get Directions" button if no google_maps_url AND no address |
| **Custom locations** | These are NOT in venues table — `/venues` won't show them (correct behavior) |
| **Online-only events** | May have `venue_id = null` — won't appear in venue listings (correct) |
| **Hybrid events** | `location_mode = "hybrid"` with venue_id — appears at venue |
| **Venue ID not found** | Return 404 page with "Venue not found." |
| **0 venues in database** | Empty state on index page |

---

## 6. Permissions / Auth

### STOP-GATE Rule

**Public pages require NO authentication:**
- `/venues` — Anonymous read OK (RLS already allows SELECT for all)
- `/venues/[id]` — Anonymous read OK

**No admin features in MVP scope:**
- No create/edit/delete on public pages
- Admin CRUD already exists at `/dashboard/admin/venues`

**No new RLS policies needed.**

---

## 7. Files to Create / Modify

### New Files

| Path | Purpose |
|------|---------|
| `app/venues/page.tsx` | Index page (server component) |
| `app/venues/[id]/page.tsx` | Detail page (server component) |
| `components/venue/VenueCard.tsx` | Card component for grid |
| `components/venue/VenueGrid.tsx` | Grid layout wrapper |

### Files to Modify

| Path | Change |
|------|--------|
| `types/index.ts` | Add optional fields to Venue type (neighborhood, accessibility_notes, parking_notes, notes, zip) |
| `components/navigation/header.tsx` | Add "Venues" to nav (optional, pending nav audit) |

### No Changes Needed

- `lib/venue/chooseVenueLink.ts` — Already has URL priority logic
- `components/venue/VenueLink.tsx` — Already renders name as link
- RLS policies — Already allow public SELECT
- Database schema — No migration needed

---

## 8. Locked Rendering Rules

Following existing patterns from `HappeningCard`, `SongwriterCard`, `StudioCard`:

| Element | Locked Value |
|---------|--------------|
| Card surface | `card-spotlight` class |
| Card hover | `hover:-translate-y-1` |
| Grid layout | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6` |
| Font minimum | 14px (no `text-xs`) |
| Link target | `target="_blank" rel="noopener noreferrer"` for external links |
| Theme tokens | All colors via CSS variables (no hardcoded hex) |

---

## 9. Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| **N+1 query on event counts** | Use Supabase aggregate syntax OR batch query |
| **Slow page with 91 venues** | Pagination not needed for MVP (91 is manageable) |
| **Event count stale** | Accept eventual consistency (not critical for discovery) |
| **SEO missing** | Add metadata export with title/description |
| **Nav discoverability** | Defer nav changes to separate PR (avoid scope creep) |

---

## 10. Test Plan

### Unit Tests

| Test | Coverage |
|------|----------|
| `VenueCard` renders name, city, event count | Component rendering |
| `VenueCard` renders website link when available | Conditional rendering |
| `VenueCard` renders plain text when no links | Fallback behavior |
| `VenueGrid` renders correct number of cards | Grid layout |
| Index page shows all venues sorted by name | Page integration |
| Detail page shows venue info | Page integration |
| Detail page shows happenings | Event query integration |
| Detail page 404 for invalid ID | Error handling |

### Smoke Tests (Manual)

1. Visit `/venues` — Should show all 91 venues in grid
2. Click venue card — Should navigate to `/venues/[id]`
3. Detail page shows address, links, happenings
4. "Get Directions" button works (opens Google Maps)
5. Venue with no events shows empty state
6. Works when logged out (anonymous access)

### Contract Tests

- No hardcoded colors (theme tokens only)
- No `text-xs` (14px minimum)
- All external links have `target="_blank" rel="noopener noreferrer"`
- No admin-only data exposed (notes field excluded from public view)

---

## 11. Out of Scope (Future Phases)

- Search/filter on venues index
- Map view (requires lat/lng migration)
- Neighborhood grouping (0% data coverage)
- Venue images (not in schema)
- User venue submissions
- Favoriting venues
- Nav changes (separate PR)

---

## Decision Required

**STOP-GATE:** Awaiting Sami approval before implementation.

**Questions for approval:**
1. Is the MVP scope correct (index + detail pages only)?
2. Should "Venues" appear in main navigation, or defer?
3. Should venues with 0 events be shown on index page?
4. Is alphabetical sort correct, or prefer by event count?

---

**Estimated Implementation:** ~2-3 hours after approval

# Phase 4.52: Venue Links Everywhere (Stop-Gate Investigation)

**Status:** AWAITING APPROVAL
**Date:** January 2026
**Author:** Repo Agent

---

## Goal (Phase 1 Only)

Wherever a venue is displayed (HappeningCard, event detail, venue chips), make the venue name a clickable link:
1. **Preferred:** `google_maps_url` from venue record
2. **Fallback:** `website_url` from venue record
3. **No link:** Plain text if neither available

**NOT in scope for Phase 1:**
- Venue directory/listing pages
- Generating Google Maps URLs from address (existing `getGoogleMapsUrl()` remains for directions)
- Auto-populating missing `google_maps_url` via Google Places API

---

## A) Schema Summary

### Venues Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | Required |
| `address` | text | Required |
| `city` | text | Required |
| `state` | text | Required |
| `zip` | text | Optional |
| `google_maps_url` | text | **TARGET** - Direct venue link |
| `website_url` | text | **FALLBACK** - Venue website |
| `phone` | text | Optional |
| `neighborhood` | text | Optional |
| `parking_notes` | text | Optional |
| `accessibility_notes` | text | Optional |
| `notes` | text | Optional |
| `contact_link` | text | Optional |
| `map_link` | text | Legacy, unused |

**Key columns for Phase 1:** `google_maps_url`, `website_url`

### Events → Venues Relationship

| Events Column | Purpose |
|---------------|---------|
| `venue_id` | FK to `venues.id` (nullable) |
| `venue_name` | Denormalized venue name |
| `venue_address` | Denormalized venue address |
| `location_mode` | `venue` / `online` / `hybrid` |
| `custom_location_name` | For one-off locations |
| `custom_address`, `custom_city`, `custom_state` | Custom location details |

**Relationship:** `events.venue_id` → `venues.id` (nullable FK)

---

## B) Files to Modify

### Core UI Components (Venue Name Display)

| File | Current Behavior | Change Required |
|------|------------------|-----------------|
| `web/src/components/happenings/HappeningCard.tsx` | Displays `venueName` as plain text (line 680) | Wrap in `<VenueLink>` component |
| `web/src/app/events/[id]/page.tsx` | Displays `venueName` as plain text (lines 657-661) | Wrap in `<VenueLink>` component |
| `web/src/components/CompactListItem.tsx` | Displays venue with existing maps link logic | Update to use `chooseVenueLink()` |
| `web/src/components/events/EventCard.tsx` | Displays venue with maps link | Update to use `chooseVenueLink()` |

### Supporting Components (Venue Mentions)

| File | Notes |
|------|-------|
| `web/src/components/admin/VerificationQueueTable.tsx` | Admin table - shows venue name, could link |
| `web/src/components/admin/OpenMicStatusTable.tsx` | Admin table - shows venue name |
| `web/src/components/events/RSVPCard.tsx` | Shows venue in RSVP context |
| `web/src/components/events/EventSuggestionForm.tsx` | Form field, no link needed |

### New Files to Create

| File | Purpose |
|------|---------|
| `web/src/lib/venue/chooseVenueLink.ts` | Pure function: `chooseVenueLink(venue) => url \| null` |
| `web/src/components/venue/VenueLink.tsx` | Reusable `<VenueLink>` component |

---

## C) Rendering Rule (Priority Order)

```typescript
/**
 * chooseVenueLink - Determines the best link for a venue
 *
 * Priority:
 * 1. google_maps_url (if valid URL)
 * 2. website_url (if valid URL)
 * 3. null (no link available)
 *
 * Special cases:
 * - Online-only events: no venue link (location_mode === 'online')
 * - TBA/Custom locations: no venue link (venue_id is null)
 * - Private venues: no venue link (explicit opt-out, future feature)
 */
export function chooseVenueLink(venue: {
  google_maps_url?: string | null;
  website_url?: string | null;
} | null): string | null {
  if (!venue) return null;

  // Priority 1: Google Maps URL
  if (venue.google_maps_url && isValidUrl(venue.google_maps_url)) {
    return venue.google_maps_url;
  }

  // Priority 2: Website URL
  if (venue.website_url && isValidUrl(venue.website_url)) {
    return venue.website_url;
  }

  return null;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}
```

### VenueLink Component

```tsx
interface VenueLinkProps {
  name: string;
  venue?: {
    google_maps_url?: string | null;
    website_url?: string | null;
  } | null;
  className?: string;
}

export function VenueLink({ name, venue, className }: VenueLinkProps) {
  const href = chooseVenueLink(venue);

  if (!href) {
    return <span className={className}>{name}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "hover:underline text-[var(--color-link)]",
        className
      )}
    >
      {name}
    </a>
  );
}
```

### Handling Special Cases

| Case | Behavior |
|------|----------|
| `location_mode === 'online'` | No venue link (show "Online" text) |
| `venue_id === null` | No venue link (custom/TBA location) |
| Both URLs null | Plain text (no link) |
| Invalid URL format | Treat as null, plain text |

---

## D) Backfill Plan

### Current Data Reality

| Metric | Count |
|--------|-------|
| Total venues | 91 |
| With `google_maps_url` | 15 (16%) |
| With `website_url` | 45 (49%) |
| With any link | 48 (53%) |
| Missing both | 43 (47%) |

### Minimum: Manual Admin Workflow

The admin venue management page (`/dashboard/admin/venues`) already supports editing `google_maps_url` and `website_url`:

**File:** `web/src/app/(protected)/dashboard/admin/venues/AdminVenuesClient.tsx`

**Current capability:**
- ✅ Create venue with `google_maps_url` and `website_url` fields
- ✅ Edit existing venue links
- ✅ Delete venues

**Recommended admin workflow:**
1. Export venues missing links: `SELECT name, address, city FROM venues WHERE google_maps_url IS NULL AND website_url IS NULL ORDER BY name;`
2. Manually find Google Maps links for high-traffic venues first
3. Update via admin UI or direct SQL

### Optional: Backfill Script (Reviewable)

A script could generate Google Maps URLs from address:

```sql
-- Preview: Generate maps URLs from address (DRY RUN)
SELECT
  name,
  address || ', ' || city || ', ' || state AS full_address,
  'https://www.google.com/maps/search/?api=1&query=' ||
    encode(address || ', ' || city || ', ' || state, 'base64') AS proposed_url
FROM venues
WHERE google_maps_url IS NULL
LIMIT 10;
```

**Risks:**
- Address may be incomplete or incorrect
- URL encoding issues with special characters
- Should be reviewed venue-by-venue

**Recommendation:** Manual backfill for Phase 1. Script-assisted backfill can be Phase 2.

---

## E) Test Plan

### Unit Tests: `chooseVenueLink()`

```typescript
describe('chooseVenueLink', () => {
  it('returns google_maps_url when available', () => {
    const venue = {
      google_maps_url: 'https://maps.google.com/place/123',
      website_url: 'https://venue.com'
    };
    expect(chooseVenueLink(venue)).toBe('https://maps.google.com/place/123');
  });

  it('falls back to website_url when no maps URL', () => {
    const venue = {
      google_maps_url: null,
      website_url: 'https://venue.com'
    };
    expect(chooseVenueLink(venue)).toBe('https://venue.com');
  });

  it('returns null when no URLs available', () => {
    const venue = { google_maps_url: null, website_url: null };
    expect(chooseVenueLink(venue)).toBeNull();
  });

  it('returns null for null venue', () => {
    expect(chooseVenueLink(null)).toBeNull();
  });

  it('rejects invalid URLs', () => {
    const venue = {
      google_maps_url: 'not-a-url',
      website_url: 'also-invalid'
    };
    expect(chooseVenueLink(venue)).toBeNull();
  });

  it('rejects non-http URLs', () => {
    const venue = {
      google_maps_url: 'javascript:alert(1)',
      website_url: null
    };
    expect(chooseVenueLink(venue)).toBeNull();
  });
});
```

### Component Tests: `VenueLink`

```typescript
describe('VenueLink', () => {
  it('renders plain text when no venue link available', () => {
    render(<VenueLink name="Test Venue" venue={null} />);
    expect(screen.getByText('Test Venue')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders link when google_maps_url available', () => {
    const venue = { google_maps_url: 'https://maps.google.com/place/123' };
    render(<VenueLink name="Test Venue" venue={venue} />);
    const link = screen.getByRole('link', { name: 'Test Venue' });
    expect(link).toHaveAttribute('href', 'https://maps.google.com/place/123');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('opens in new tab with security attributes', () => {
    const venue = { website_url: 'https://venue.com' };
    render(<VenueLink name="Test Venue" venue={venue} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
```

### Integration Tests: Card Rendering

```typescript
describe('HappeningCard venue link', () => {
  it('renders venue as link when google_maps_url exists', () => {
    const event = mockEventWithVenue({
      google_maps_url: 'https://maps.google.com/place/123'
    });
    render(<HappeningCard event={event} />);
    expect(screen.getByRole('link', { name: /venue name/i })).toBeInTheDocument();
  });

  it('renders venue as plain text when no URLs', () => {
    const event = mockEventWithVenue({ google_maps_url: null, website_url: null });
    render(<HappeningCard event={event} />);
    expect(screen.getByText(/venue name/i)).toBeInTheDocument();
    // Venue name should not be a link
    expect(screen.queryByRole('link', { name: /venue name/i })).not.toBeInTheDocument();
  });

  it('renders "Online" for online-only events (no link)', () => {
    const event = mockOnlineEvent();
    render(<HappeningCard event={event} />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });
});
```

---

## F) Data Fetching Impact

### HappeningCard

Currently fetches venue via join:
```typescript
venue: {
  id?: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}
```

**Change:** Add `google_maps_url` and `website_url` to the join:
```typescript
venue: {
  // existing fields...
  google_maps_url?: string | null;
  website_url?: string | null;
}
```

**Query update location:** `web/src/app/happenings/page.tsx` (events query)

### Event Detail Page

Currently fetches venue separately when needed:
```typescript
const { data: venue } = await supabase
  .from("venues")
  .select("name, address, city, state")
  .eq("id", event.venue_id)
  .single();
```

**Change:** Add `google_maps_url`, `website_url` to select:
```typescript
.select("name, address, city, state, google_maps_url, website_url")
```

---

## G) Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Broken existing maps links | Low | `getGoogleMapsUrl()` remains for "Get Directions" |
| Invalid URLs in database | Medium | `isValidUrl()` validation before rendering |
| Performance (extra columns) | Low | Columns are small, already indexed |
| Event creation/editing breaks | Low | No changes to VenueSelector or forms |

---

## H) Rollback Plan

1. Revert `VenueLink` component imports to plain text
2. Remove `google_maps_url`, `website_url` from queries
3. No database changes required (reading existing columns)

---

## Approval Checklist

- [ ] Schema summary reviewed
- [ ] File list approved
- [ ] Rendering rule confirmed
- [ ] Backfill approach accepted
- [ ] Test plan sufficient

**Awaiting Sami's approval before execution.**

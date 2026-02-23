# Venue Geocode Backfill Audit (2026-02-23)

## Operator

- Codex (with user approval)

## Reason

- Map pins were falling back to city centroids for venues missing `latitude/longitude`.
- User-reported impact: Colorado Springs venues appeared pinned to city center instead of exact addresses.

## Scope

- One-time production data correction to backfill `public.venues.latitude/longitude`.
- No schema, migration, or RLS policy changes.

## Method

1. Query venues with missing coords and existing `google_maps_url`.
2. Resolve each `maps.app.goo.gl` short link by reading the HTTP `Location` redirect.
3. Extract coordinates from Google Maps URL patterns:
   - `!3d<lat>!4d<lng>` preferred
   - fallback `@<lat>,<lng>`
4. Update `venues` rows with resolved coordinates and set:
   - `geocode_source='api'`
   - `geocoded_at=now()`
   - `updated_at=now()`
5. Geocode final remaining venue (`Grossen Bart Brewery`) via Nominatim lookup, then update row.

## SQL/Data Corrections Executed

### Batch update (21 venues with `google_maps_url`)

- Iterative updates of this form:

```sql
UPDATE public.venues
SET
  latitude = <resolved_lat>,
  longitude = <resolved_lng>,
  geocode_source = 'api',
  geocoded_at = NOW(),
  updated_at = NOW()
WHERE id = '<venue_id>';
```

### Final single update (last missing venue)

```sql
UPDATE public.venues
SET
  latitude = 40.1542297,
  longitude = -105.1092105,
  geocode_source = 'api',
  geocoded_at = NOW(),
  updated_at = NOW()
WHERE id = '218a0d8d-8e26-48b3-a152-91f5291f9b8b';
```

## Verification Queries and Results

### Colorado Springs venue coordinates

```sql
SELECT id, name, city, latitude, longitude
FROM public.venues
WHERE city ILIKE 'Colorado Springs%'
ORDER BY name;
```

Result: all Colorado Springs venues now have non-null coordinates.

### Global missing-coordinates count

```sql
SELECT count(*) AS venues_missing_coords
FROM public.venues
WHERE latitude IS NULL OR longitude IS NULL;
```

Result: `0`

### Published events attached to missing-coordinate venues

```sql
SELECT count(DISTINCT e.id) AS published_events_on_missing_coords_venues
FROM public.events e
JOIN public.venues v ON v.id = e.venue_id
WHERE e.is_published = true
  AND (v.latitude IS NULL OR v.longitude IS NULL);
```

Result: `0`

## Outcome

- City-centroid fallback is no longer needed for currently published venue-based events.
- Colorado Springs map pins can now resolve to venue-level locations.

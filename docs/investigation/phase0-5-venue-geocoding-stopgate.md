# STOP-GATE 0.5 — Venue Coordinate Persistence Strategy

**Phase:** Investigation / Decision Doc
**Status:** Complete — Awaiting approval
**Prerequisite for:** Map View (STOP-GATE 1)

---

## 1. Current Data Reality (Proof)

### 1.1 Venues Table Schema

**Source:** Production database query (`information_schema.columns`)

```
     column_name     |        data_type         | is_nullable
---------------------+--------------------------+-------------
 id                  | uuid                     | NO
 name                | text                     | NO
 address             | text                     | NO
 city                | text                     | NO
 state               | text                     | NO
 zip                 | text                     | YES
 website_url         | text                     | YES
 phone               | text                     | YES
 google_maps_url     | text                     | YES
 created_at          | timestamp with time zone | YES
 updated_at          | timestamp with time zone | YES
 map_link            | text                     | YES
 contact_link        | text                     | YES
 notes               | text                     | YES
 neighborhood        | text                     | YES
 parking_notes       | text                     | YES
 accessibility_notes | text                     | YES
 slug                | text                     | YES
 cover_image_url     | text                     | YES
(19 rows)
```

**Finding:** ❌ **No `latitude` or `longitude` columns exist on the `venues` table.**

### 1.2 Events Table Coordinate Columns

**Source:** Production database query

```
     column_name      |    data_type     | is_nullable
----------------------+------------------+-------------
 custom_latitude      | double precision | YES
 custom_longitude     | double precision | YES
```

**Finding:** ✅ Events table has `custom_latitude` and `custom_longitude` for custom locations.

**Current usage:**
```sql
SELECT COUNT(*) FROM events WHERE custom_latitude IS NOT NULL;
-- Result: 0 rows
```

No events currently use custom coordinates. All events use venue references.

### 1.3 Existing Geocoding Infrastructure

**Searched for:** `geocod`, `getDirectionsUrl`, `getGoogleMapsUrl`

**Found utilities:**

| File | Purpose |
|------|---------|
| `lib/venue/getDirectionsUrl.ts` | Generates Google Maps directions URL from address components |
| `lib/venue/chooseVenueLink.ts` | Chooses best link for venue name (google_maps_url or website_url) |

**Finding:** No geocoding logic exists. Directions URLs are generated from address strings, not coordinates.

---

## 2. google_maps_url Format Audit

### 2.1 Coverage

```sql
SELECT COUNT(*) as total,
  COUNT(google_maps_url) as has_google_url,
  COUNT(*) - COUNT(google_maps_url) as missing_google_url
FROM venues;
```

| Metric | Count |
|--------|-------|
| Total venues | 77 |
| Has google_maps_url | 77 |
| Missing | 0 |

**Finding:** ✅ 100% of venues have a `google_maps_url` value.

### 2.2 Format Distribution

```sql
SELECT
  CASE
    WHEN google_maps_url LIKE 'https://maps.app.goo.gl/%' THEN 'maps.app.goo.gl (short link)'
    WHEN google_maps_url LIKE 'https://share.google/%' THEN 'share.google (short link)'
    ...
  END as url_format,
  COUNT(*) as count
FROM venues WHERE google_maps_url IS NOT NULL
GROUP BY 1;
```

| Format | Count | Percentage |
|--------|-------|------------|
| `maps.app.goo.gl` (short link) | 75 | 97.4% |
| `share.google` (short link) | 2 | 2.6% |

### 2.3 Sample URLs

```
https://maps.app.goo.gl/KpZ1kAcpqWwFeL3z8
https://maps.app.goo.gl/UjjCDarQxktDfYrf8
https://share.google/aIwNsqS2vPROncDlB
```

### 2.4 Format Analysis Summary

| Format | Count | Contains Coords? | Contains Place/CID? | Extractable? | Risk Level |
|--------|-------|------------------|---------------------|--------------|------------|
| `maps.app.goo.gl/*` | 75 | ❌ No | ❌ No (short link) | ❌ Requires redirect follow | HIGH |
| `share.google/*` | 2 | ❌ No | ❌ No (short link) | ❌ Requires redirect follow | HIGH |

**Critical Finding:**

All 77 `google_maps_url` values are **short links** that do NOT contain embedded coordinates or Place IDs. To extract coordinates, each URL would require:

1. Following the HTTP redirect (3xx response)
2. Parsing the destination URL for `@lat,lng` or `place_id` parameters
3. Potentially making a Places API call to resolve Place IDs to coordinates

**This makes runtime URL parsing unreliable and expensive.**

---

## 3. Options Analysis

### Option A — Persist Coordinates in Venues Table (RECOMMENDED)

**Description:** Add `latitude` and `longitude` columns to the `venues` table. One-time backfill via geocoding API, then ongoing manual correction by admin/host.

**Pros:**
- Single source of truth for venue locations
- Fast map rendering (no runtime API calls)
- Works with any map provider (Google, Mapbox, Leaflet/OSM)
- Override venue support already works (`override_patch.venue_id`)
- Cheap to query (indexed column lookup)

**Cons:**
- Requires geocoding API for initial backfill (~77 calls)
- Small ongoing cost for new venues
- Coordinates may drift from address if venue moves

**Failure modes:**
- Geocoding returns wrong location → Manual review list
- Geocoding API rate limited → Batch with delays
- Geocoding API unavailable → Defer backfill, venues show as "location pending"

**Security/privacy:**
- Coordinates are public data (derived from address)
- No PII concerns

**Interaction with per-occurrence venue overrides:**
- Already works: `override_patch.venue_id` points to a venue row
- Map view queries `venues.latitude/longitude` via the resolved `venue_id`

**Map provider flexibility:** ✅ Full flexibility — coordinates are provider-agnostic

**Cost estimate (one-time backfill):**
- Google Geocoding API: $5 per 1,000 requests = ~$0.39 for 77 venues
- Mapbox: 100,000 free requests/month, then $0.75/1,000

---

### Option B — Runtime Geocoding

**Description:** Geocode venue addresses on-demand when Map View loads.

**Pros:**
- No migration needed
- Always uses current address

**Cons:**
- Latency: 100-300ms per geocode request
- Cost: API calls on every page load (even if cached, cache invalidation is tricky)
- Rate limits: Easy to exceed during traffic spikes
- Caching complexity: Cache by what key? Address hash? What about address typos?
- Provider lock-in: Switching providers requires re-implementing geocoding logic

**Failure modes:**
- API down → Map view fails entirely
- Rate limited → Partial data or degraded UX
- Cache stale → Wrong locations shown

**Security/privacy:**
- Same as Option A (addresses are already public)

**Interaction with per-occurrence venue overrides:**
- Same complexity as Option A, but with runtime latency

**Map provider flexibility:** ❌ Tied to geocoding provider

**Cost estimate (runtime):**
- 1,000 page views × 10 venues visible = 10,000 geocode requests
- Google: $50/day at modest traffic
- Caching reduces this but adds complexity

**Verdict:** ❌ **Not recommended** — Too expensive, too fragile, too slow.

---

### Option C — Parse google_maps_url at Runtime

**Description:** Extract coordinates or Place IDs from `google_maps_url` values.

**Pros:**
- Uses existing data
- No geocoding API needed (if URLs contained coords)

**Cons:**
- **BLOCKING:** All 77 URLs are short links with no embedded coordinates
- Would require following redirects (network calls)
- Redirect destinations may change
- Short links may expire
- Extremely brittle

**Failure modes:**
- Short link expired → No location
- Redirect changed → Wrong location
- Google changes URL format → Parsing breaks

**Security/privacy:**
- Following redirects reveals server IP to Google

**Interaction with per-occurrence venue overrides:**
- Same as Option A

**Map provider flexibility:** ❌ Locked to Google Maps URLs

**Verdict:** ❌ **Not viable** — Short links cannot be parsed without network calls.

---

### Recommendation: **Option A — Persist Coordinates**

Option A is the only viable path:
- One-time effort with durable results
- Provider-agnostic
- Fast runtime performance
- Already compatible with override system

---

## 4. Proposed Data Model

### 4.1 Schema Changes

```sql
ALTER TABLE venues ADD COLUMN latitude double precision;
ALTER TABLE venues ADD COLUMN longitude double precision;
ALTER TABLE venues ADD COLUMN geocode_source text; -- 'manual' | 'api' | 'parsed'
ALTER TABLE venues ADD COLUMN geocoded_at timestamptz;
```

**Constraints:**
- `latitude`: nullable (venues without coords show as "Location pending" on map)
- `longitude`: nullable
- Valid range: latitude -90 to 90, longitude -180 to 180 (CHECK constraint optional)
- No UNIQUE constraint (multiple venues can share coordinates, e.g., same building)

**Index:**
```sql
CREATE INDEX idx_venues_coordinates ON venues (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

This supports future bounding-box queries like:
```sql
WHERE latitude BETWEEN $minLat AND $maxLat
  AND longitude BETWEEN $minLng AND $maxLng
```

### 4.2 RLS Implications

| Role | Can Read Coords | Can Write Coords |
|------|-----------------|------------------|
| Public | ✅ Yes (read-only) | ❌ No |
| Venue Manager | ✅ Yes | ✅ Yes (own venues only) |
| Admin | ✅ Yes | ✅ Yes (all venues) |

Existing `venues` RLS policies should cover this automatically since coords are just new columns.

### 4.3 Metadata Fields

| Column | Type | Purpose | Required? |
|--------|------|---------|-----------|
| `geocode_source` | text | How coords were obtained | Optional |
| `geocoded_at` | timestamptz | When coords were last updated | Optional |

**Values for `geocode_source`:**
- `manual` — Admin entered coordinates manually
- `api` — Geocoded from address via API
- `parsed` — Extracted from URL (not applicable for current data)

**Rationale:** These fields help with:
- Debugging: "Why is this venue in the wrong place?" → Check source
- Auditing: "When was this last verified?"
- Future automation: Re-geocode venues where `geocode_source = 'api'` and address changed

---

## 5. Backfill Strategy

### 5.1 Backfill Stages

**Stage 1: Parse URLs (Expected: 0% success)**

Attempt to extract coordinates from `google_maps_url`:
- Short links (`maps.app.goo.gl/*`, `share.google/*`) cannot be parsed without network calls
- Expected result: 0 venues geocoded from URLs

**Stage 2: Geocode from Address (Expected: 95%+ success)**

For each venue without coordinates:
1. Build address string: `{name}, {address}, {city}, {state} {zip}`
2. Call Google Geocoding API (or Mapbox)
3. Store result in `latitude`, `longitude`
4. Set `geocode_source = 'api'`, `geocoded_at = NOW()`

**Rate limiting:**
- Batch requests with 100ms delay between calls
- Total time for 77 venues: ~8 seconds

**Stage 3: Manual Review**

After automated backfill:
1. Query venues where `latitude IS NULL` → These failed geocoding
2. Query venues where geocoded location is outside Colorado → Suspicious
3. Admin manually corrects via dashboard

### 5.2 Verification Plan

1. **Spot check (10 random venues):**
   - Compare geocoded coords to Google Maps
   - Verify pin lands on correct building

2. **Boundary check:**
   - Colorado bounding box: lat 36.99-41.00, lng -109.05 to -102.05
   - Flag any coords outside this range (may be valid for border venues)

3. **Zero check:**
   - Flag any `(0, 0)` coordinates (indicates geocoding failure)

### 5.3 Rollback Plan

**If columns need to be removed:**
```sql
ALTER TABLE venues DROP COLUMN IF EXISTS latitude;
ALTER TABLE venues DROP COLUMN IF EXISTS longitude;
ALTER TABLE venues DROP COLUMN IF EXISTS geocode_source;
ALTER TABLE venues DROP COLUMN IF EXISTS geocoded_at;
```

**If backfill data is wrong:**
```sql
UPDATE venues SET latitude = NULL, longitude = NULL,
  geocode_source = NULL, geocoded_at = NULL
WHERE geocode_source = 'api';
```

**Snapshot option:**
Before running backfill, export current venue data:
```bash
pg_dump --table=venues --data-only > venues_backup_pre_geocode.sql
```

---

## 6. Map View Readiness Contract

### What STOP-GATE 1 Can Assume

Before Map View implementation begins, the following must be true:

| Requirement | Threshold | Verification |
|-------------|-----------|--------------|
| Schema deployed | 100% | `\d venues` shows lat/lng columns |
| Venues with coords | ≥95% (73/77) | `SELECT COUNT(*) WHERE latitude IS NOT NULL` |
| Coords in Colorado | 100% of geocoded | Boundary check query |
| No (0,0) coords | 0 | `WHERE latitude = 0 AND longitude = 0` |
| Manual review complete | 100% flagged venues reviewed | Admin sign-off |

### Handling Events Without Coordinates

| Scenario | Behavior |
|----------|----------|
| Event with venue that has coords | ✅ Show on map |
| Event with venue missing coords | ⚠️ Exclude from map, show in list with "Location pending" |
| Event with custom location + coords | ✅ Show on map (use `events.custom_latitude/longitude`) |
| Event with custom location, no coords | ⚠️ Exclude from map |
| Online-only event (no venue) | ❌ Exclude from map, clear messaging |

### UI Fallback Strategy

- Map View toggle only appears if ≥1 event has displayable coordinates
- Events without coords still appear in Timeline/Series views
- Map tooltip: "Some events not shown — location data pending"

---

## 7. STOP-GATE Verdict

### ✅ PROCEED to Phase 0.5 Execution (Migration + Backfill)

**Rationale:**
- Data reality is clear: venues have no coords, URLs are not parseable
- Option A (persist coords) is the only viable path
- Backfill is low-risk: ~$0.40 API cost, nullable columns, easy rollback
- 100% of venues have address data for geocoding

### Execution Checklist (Phase 0.5 Implementation)

1. [x] Create migration: `20260130011020_add_venue_coordinates.sql`
2. [x] Apply migration to production
3. [ ] Run geocoding backfill script (BLOCKED - needs API key)
4. [ ] Run verification queries
5. [ ] Admin reviews flagged venues
6. [ ] Update CLAUDE.md with Phase 0.5 completion
7. [ ] Open STOP-GATE 1 for Map View implementation

### Blockers for STOP-GATE 1

STOP-GATE 1 (Map View) cannot begin until:
- [x] Migration applied
- [ ] ≥95% venue coord coverage achieved
- [ ] Verification complete
- [ ] This document updated with "Phase 0.5 Complete" status

---

## 8. Execution Log

### 2026-01-30: Migration Applied

**Migration file:** `supabase/migrations/20260130011020_add_venue_coordinates.sql`

**Columns added:**
- `latitude double precision` (nullable)
- `longitude double precision` (nullable)
- `geocode_source text` (nullable, CHECK: 'manual' | 'api')
- `geocoded_at timestamptz` (nullable)

**Constraints added:**
- `venues_latitude_range` CHECK (-90 to 90)
- `venues_longitude_range` CHECK (-180 to 180)
- `venues_geocode_source_values` CHECK ('manual' | 'api')

**Index created:**
- `idx_venues_coordinates` partial index on (latitude, longitude) WHERE NOT NULL

**Current state:**
- 77 venues total
- 0 venues with coordinates
- 77 venues awaiting geocoding

### Backfill Script Ready

**Script:** `web/scripts/geocode-venues.js`

**Usage:**
```bash
cd web
node scripts/geocode-venues.js --key=YOUR_GOOGLE_API_KEY           # Dry-run
node scripts/geocode-venues.js --key=YOUR_GOOGLE_API_KEY --apply   # Apply
```

**BLOCKED:** Requires Google Geocoding API key. The key must be provided via `--key=` argument or `GOOGLE_GEOCODING_API_KEY` environment variable.

---

**Document created:** 2026-01-29
**Author:** Claude (repo agent)
**Migration applied:** 2026-01-30
**Status:** Migration complete, backfill blocked on API key

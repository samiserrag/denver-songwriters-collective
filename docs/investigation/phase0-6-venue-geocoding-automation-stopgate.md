# STOP-GATE 1 Report — Phase 0.6: Venue Geocoding Automation

**Investigation Date:** January 29, 2026
**Status:** ⏸️ AWAITING APPROVAL
**Phase 0.5 Status:** ✅ Complete (77/77 venues geocoded)

---

## 1. Executive Summary

Phase 0.6 adds automatic geocoding when venues are created or updated. This report documents the current permission model, proposes implementation changes, and identifies risks.

**Key Findings:**
- Hosts and co-hosts **CANNOT** edit venues today (completely separate system)
- Only **Admins** and **Venue Managers** can edit venues
- Coordinates (lat/lng) are **NOT** in the current editable fields allowlist
- All venue writes bypass RLS via service role client

**Recommendation:** Add geocoding as a server-side side-effect, NOT as user-editable fields.

---

## 2. Permission Truth Table

### Current State (Before Phase 0.6)

| Role | Can CREATE Venue | Can EDIT Venue | Can Edit Coordinates |
|------|-----------------|----------------|---------------------|
| **Admin** | ✅ Yes (POST /api/admin/venues, VenueSelector) | ✅ Yes (both /api routes) | ❌ No (not in allowlist) |
| **Venue Manager (owner)** | ❌ No | ✅ Yes (PATCH /api/venues/[id]) | ❌ No (not in allowlist) |
| **Venue Manager (manager)** | ❌ No | ✅ Yes (PATCH /api/venues/[id]) | ❌ No (not in allowlist) |
| **Event Host** | ❌ No | ❌ No | ❌ No |
| **Event Co-host** | ❌ No | ❌ No | ❌ No |
| **Member** | ❌ No | ❌ No | ❌ No |
| **Anonymous** | ❌ No | ❌ No | ❌ No |

### Proposed State (After Phase 0.6)

| Role | Can CREATE Venue | Can EDIT Venue | Can Trigger Geocode | Can Manual Override Coords |
|------|-----------------|----------------|--------------------|-----------------------------|
| **Admin** | ✅ Yes | ✅ Yes | ✅ Auto on address change | ✅ Yes (new UI fields) |
| **Venue Manager** | ❌ No | ✅ Yes | ✅ Auto on address change | ❌ No |
| **Event Host** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Event Co-host** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Member** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Anonymous** | ❌ No | ❌ No | ❌ No | ❌ No |

---

## 3. Host/Co-host → Venue Relationship Confirmation

### Finding: **NO RELATIONSHIP EXISTS**

Hosts and co-hosts are managed via `event_hosts` table, which links:
- `event_id` → events table
- `user_id` → profiles table

Venue managers are managed via `venue_managers` table, which links:
- `venue_id` → venues table
- `user_id` → profiles table

**These are completely separate authorization systems.**

An event can have:
- `venue_id` pointing to a venue
- `host_id` pointing to a primary host
- Entries in `event_hosts` for co-hosts

But there is **NO** automatic grant from "hosts this event at venue X" → "can edit venue X".

### Evidence

1. **managerAuth.ts** - `isVenueManager()` checks `venue_managers` table only
2. **PATCH /api/venues/[id]** - Uses `isVenueManager(supabase, venueId, user.id)`
3. **event_hosts table** - Has no foreign key to venues
4. **RLS policies** - venues table has admin-only INSERT/UPDATE/DELETE

### Implication for Phase 0.6

No changes needed to host/co-host system. Geocoding automation only affects:
- Admin venue creation
- Admin venue editing
- Venue manager editing (via PATCH /api/venues/[id])

---

## 4. Current Venue Create/Edit Surfaces

### 4.1 VenueSelector.tsx (Inline Create)

**Path:** `web/src/components/ui/VenueSelector.tsx`
**Authorization:** `canCreateVenue` prop (admin only)
**Method:** Direct Supabase insert via browser client
**Fields:** name, address, city, state, zip, phone, website_url, google_maps_url
**Missing:** latitude, longitude, geocode_source, geocoded_at

```typescript
// Line 77-88: Current insert payload
.insert({
  name: newVenue.name.trim(),
  address: newVenue.address.trim(),
  city: newVenue.city.trim() || "Denver",
  state: newVenue.state.trim() || "CO",
  zip: newVenue.zip.trim() || null,
  phone: newVenue.phone.trim() || null,
  website_url: newVenue.website_url.trim() || null,
  google_maps_url: newVenue.google_maps_url.trim() || null,
})
```

### 4.2 POST /api/admin/venues (Admin Create)

**Path:** `web/src/app/api/admin/venues/route.ts`
**Authorization:** `checkAdminRole(supabase, user.id)`
**Method:** Service role client (bypasses RLS)
**Currently:** Does NOT set lat/lng

### 4.3 PATCH /api/admin/venues/[id] (Admin Edit)

**Path:** `web/src/app/api/admin/venues/[id]/route.ts`
**Authorization:** `checkAdminRole(supabase, user.id)`
**Method:** Service role client
**Fields:** Uses `MANAGER_EDITABLE_VENUE_FIELDS` for consistency
**Missing:** latitude, longitude not in allowlist

### 4.4 PATCH /api/venues/[id] (Manager + Admin Edit)

**Path:** `web/src/app/api/venues/[id]/route.ts`
**Authorization:** `isVenueManager(supabase, venueId, user.id) OR checkAdminRole()`
**Method:** Service role client
**Fields:** Uses `sanitizeVenuePatch()` with `MANAGER_EDITABLE_VENUE_FIELDS`
**Missing:** latitude, longitude not in allowlist

### 4.5 POST /api/admin/ops/venues/apply (Bulk CSV Import)

**Path:** `web/src/app/api/admin/ops/venues/apply/route.ts`
**Authorization:** Admin only
**Method:** Service role client
**Currently:** Does NOT include geocoding

---

## 5. Proposed Implementation

### 5.1 Design Decision: Server-Side Geocoding

**Option A (Recommended):** Geocode server-side as a side-effect
- User edits address → server auto-geocodes before saving
- Coordinates are NOT directly editable by venue managers
- Only admins can manually override coordinates

**Option B (Rejected):** Add lat/lng to `MANAGER_EDITABLE_VENUE_FIELDS`
- Allows venue managers to set arbitrary coordinates
- Risk: Data integrity issues, accidental misplacement
- Adds complexity to validation

### 5.2 Geocoding Service Module

Create `web/src/lib/venue/geocoding.ts`:

```typescript
// Pseudocode - NOT implementation
export async function geocodeVenue(address: string, city: string, state: string, zip?: string): Promise<{
  latitude: number;
  longitude: number;
  geocode_source: 'api' | 'manual';
  geocoded_at: string;
} | null>

export function shouldRegeocode(oldVenue: Venue, newVenue: Partial<Venue>): boolean
// Returns true if address, city, state, or zip changed
```

### 5.3 Files to Modify

| File | Change |
|------|--------|
| `lib/venue/geocoding.ts` | **NEW** - Geocoding service with Google API |
| `api/admin/venues/route.ts` | Call geocoding on POST |
| `api/admin/venues/[id]/route.ts` | Call geocoding on PATCH if address changed |
| `api/venues/[id]/route.ts` | Call geocoding on PATCH if address changed |
| `components/ui/VenueSelector.tsx` | Call API route instead of direct insert (to get geocoding) |
| `lib/venue/managerAuth.ts` | No change to MANAGER_EDITABLE_VENUE_FIELDS |

### 5.4 Admin Manual Override UI

For Phase 0.6b (optional, can defer):
- Add lat/lng fields to admin venue edit form only
- NOT in `MANAGER_EDITABLE_VENUE_FIELDS`
- Separate admin-only validation

### 5.5 Admin UX Warning

On admin venue list and venue detail pages, show warning badge when:
- `latitude IS NULL OR longitude IS NULL`
- Badge: "📍 Missing coordinates"
- Tooltip: "This venue won't appear on the map view"

---

## 6. Risk Analysis

### 6.1 API Key Security

**Risk:** Google API key exposure
**Mitigation:**
- Store as `GOOGLE_GEOCODING_API_KEY` in server env only
- Never send to client
- Rate limit API calls

### 6.2 Geocoding Failures

**Risk:** Google API fails or returns no results
**Mitigation:**
- Silent failure - save venue without coordinates
- Log failures for admin review
- Don't block venue creation

### 6.3 Address Changes Breaking Coordinates

**Risk:** User fixes typo in address, geocoding returns different location
**Mitigation:**
- Only re-geocode if address/city/state/zip changed
- Keep `geocode_source: 'manual'` for admin overrides
- `geocode_source: 'api'` can be overwritten; 'manual' is preserved

### 6.4 VenueSelector Direct Insert

**Risk:** Current inline create bypasses server-side geocoding
**Mitigation:**
- Option A: Change to call API route (recommended)
- Option B: Add useEffect to geocode client-side (not recommended - exposes API key)

### 6.5 Bulk Import

**Risk:** Ops Console CSV import won't geocode
**Mitigation:**
- Add geocoding step to apply route
- Or document as known limitation (use scripts/geocode-venues.js after import)

---

## 7. Test Plan Outline

### 7.1 Unit Tests (lib/venue/geocoding.ts)

| Test | Description |
|------|-------------|
| `geocodeVenue returns coordinates` | Mock Google API success |
| `geocodeVenue returns null on failure` | Mock Google API error |
| `geocodeVenue handles rate limit` | Mock 429 response |
| `shouldRegeocode detects address change` | Compare old vs new venue |
| `shouldRegeocode ignores name change` | Name change should NOT trigger |
| `shouldRegeocode detects city change` | City change should trigger |

### 7.2 Integration Tests (API Routes)

| Test | Description |
|------|-------------|
| `POST /api/admin/venues geocodes on create` | New venue gets coordinates |
| `PATCH /api/admin/venues/[id] geocodes on address change` | Edit triggers geocode |
| `PATCH /api/admin/venues/[id] skips geocode on name change` | Name-only edit no geocode |
| `PATCH /api/venues/[id] geocodes for venue manager` | Manager edit triggers geocode |
| `Geocoding failure doesn't block venue save` | Venue saved without coords |

### 7.3 Manual Smoke Tests

1. Create venue via VenueSelector → verify coordinates populated
2. Edit venue address → verify coordinates updated
3. Edit venue name only → verify coordinates unchanged
4. Create venue with invalid address → verify venue saved, no coords
5. Admin manual override → verify 'manual' source preserved

---

## 8. Rollback Plan

### 8.1 Code Rollback

```bash
git revert <phase-0.6-commit>
```

### 8.2 Data Recovery

Coordinates are additive. No existing data is modified.
- If bad coordinates, run `UPDATE venues SET latitude = NULL, longitude = NULL WHERE geocode_source = 'api' AND geocoded_at > '<deploy_time>'`

### 8.3 Feature Flag (Optional)

Can add `ENABLE_AUTO_GEOCODING` env var:
- If false, skip geocoding calls
- Venues save without coordinates (same as current behavior)
- Allows quick disable without deploy

---

## 9. Implementation Order

1. **Phase 0.6a** - Server-side geocoding service
   - Create `lib/venue/geocoding.ts`
   - Integrate into POST/PATCH routes
   - Add tests

2. **Phase 0.6b** - VenueSelector migration (optional)
   - Change from direct insert to API call
   - Or accept limitation (inline creates won't geocode)

3. **Phase 0.6c** - Admin UX warning
   - Add "Missing coordinates" badge
   - Add manual override fields (admin only)

4. **Phase 0.6d** - Bulk import support (optional)
   - Add geocoding to Ops Console apply route
   - Or document limitation

---

## 10. Approval Checklist

- [ ] Permission truth table reviewed
- [ ] Risk analysis accepted
- [ ] Test plan approved
- [ ] Rollback plan confirmed
- [ ] Implementation order agreed

---

## 11. Questions for Sami

1. **VenueSelector migration priority:** Should we change inline create to use API route (ensures geocoding), or accept that admin inline creates won't auto-geocode?

2. **Manual override UI:** Should Phase 0.6 include admin manual coordinate entry, or defer to Phase 0.6c?

3. **Bulk import:** Should CSV import auto-geocode each row (slow but automatic), or require manual `geocode-venues.js` run after?

4. **Feature flag:** Add `ENABLE_AUTO_GEOCODING` kill switch, or trust code-based rollback?

---

**⛔ INVESTIGATION ONLY — NO IMPLEMENTATION UNTIL APPROVED**

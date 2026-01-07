# Phase 4.45a Investigation: Venue Dropdown + Location Workflow

**Date:** January 2026
**Status:** Investigation Complete — Ready for Approval
**Author:** Claude (Repo Agent)

---

## Executive Summary

The venue dropdown UX needs improvement: action items ("Add new venue" and "Enter custom location") are currently at the **bottom** of a long scrollable list (see screenshot). This investigation documents the current implementation and provides options for fixing it safely.

**Key Findings:**

1. Both VenueSelector components exist (UI + Admin) — the UI one is used in EventForm
2. Venue creation is **admin-only** via RLS, but the UI VenueSelector allows any logged-in user to create venues (will fail silently or error)
3. "Add new venue" and "Enter custom location" are **not redundant** — they serve different purposes
4. Lat/lng support exists on events (custom location) but **not on venues**
5. No venue suggestions/corrections workflow exists — only admin can edit venues directly

---

## 1. Current Dropdown Implementation

### File Locations

| Component | Path | Purpose |
|-----------|------|---------|
| UI VenueSelector | `web/src/components/ui/VenueSelector.tsx` | Used in EventForm (user-facing) |
| Admin VenueSelector | `web/src/components/admin/VenueSelector.tsx` | Used in admin pages only |
| EventForm integration | `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx:705-721` | Renders VenueSelector with custom location option |

### Dropdown Structure (Current)

```
┌─────────────────────────────────────┐
│ Select a venue...                   │ ← Default empty option
├─────────────────────────────────────┤
│ Same Cafe — Denver                  │ ← Venues sorted by name (A-Z)
│ Schoolhouse Kitchen — Arvada        │
│ Scruffy Murphy's — Denver           │
│ ... (65+ venues)                    │
│ Zymos Brewing — Littleton           │
├─────────────────────────────────────┤
│ ──────────────────                  │ ← Disabled separator
│ + Add new venue...                  │ ← Action (at BOTTOM)
│ ✎ Enter custom location...         │ ← Action (at BOTTOM)
└─────────────────────────────────────┘
```

**Problem:** With 65+ venues, users must scroll to the bottom to find the action items.

### Data Shape

**Venues (from database):**
```typescript
interface Venue {
  id: string;       // UUID
  name: string;     // Required
  address: string;  // Required (but may be "UNKNOWN")
  city: string;     // Required (but may be "UNKNOWN")
  state: string;    // Required (defaults to "CO")
  zip?: string;
  phone?: string;
  website_url?: string;
  google_maps_url?: string;
}
```

**Note:** Venues table does NOT have `lat/lng` columns.

### Ordering

- **Line 148-160** (`VenueSelector.tsx`): Options rendered in order received from props
- **EventForm.tsx:104-108**: Venues fetched with `.order("name", { ascending: true })`
- Action items are rendered AFTER the venue options (bottom)

---

## 2. Workflow Traces

### A) "Add new venue..." Workflow

**Location:** `VenueSelector.tsx:53-105` (inline form)

**Trigger:** User selects `__new__` from dropdown → `showNewVenueForm` state = true

**UI:** Inline collapsible form appears below dropdown with fields:
- Venue name * (required)
- Street address * (required)
- City (defaults to "Denver")
- State (defaults to "CO")
- ZIP (optional)
- Phone (optional)
- Website URL (optional)
- Google Maps URL (optional)

**API Call:** Direct Supabase insert (client-side)
```typescript
const { data, error } = await supabase
  .from("venues")
  .insert({ name, address, city, state, zip, phone, website_url, google_maps_url })
  .select("id, name, address, city, state")
  .single();
```

**After Success:**
1. New venue auto-selected (`onVenueChange(data.id)`)
2. Parent notified via `onVenueCreated(data)` callback
3. Form resets and closes

**RLS Issue:** VenueSelector attempts insert directly but RLS policy `venues_insert_admin` requires `public.is_admin()`. Non-admin users will get an error.

---

### B) "Enter custom location..." Workflow

**Location:** `EventForm.tsx:713-718` + `776-880`

**Trigger:** User selects `__custom__` from dropdown → `locationSelectionMode` = "custom"

**UI:** Custom location form appears with fields:
- Location Name * (required) — e.g., "Back room at Joe's Coffee"
- Street Address (optional)
- City (optional, defaults to Denver)
- State (optional, defaults to CO)
- Latitude (optional) — numeric input
- Longitude (optional) — numeric input
- Location Notes (optional) — e.g., "Meet at north entrance"

**Data Storage:** Event-level custom location fields
```typescript
custom_location_name: string | null;
custom_address: string | null;
custom_city: string | null;
custom_state: string | null;
custom_latitude: number | null;
custom_longitude: number | null;
location_notes: string | null;
```

**Key Difference from Venue:**
| Aspect | Venue | Custom Location |
|--------|-------|-----------------|
| Reusable | Yes (global) | No (event-only) |
| Lat/lng support | No | Yes |
| Location notes | No | Yes |
| Requires address | Yes | No |
| Who can create | Admin only | Any event creator |

---

### C) Redundancy Analysis

**"Add new venue" and "Enter custom location" are NOT redundant:**

| Use Case | Best Option |
|----------|-------------|
| New bar/café that will host multiple events | Add new venue |
| One-time park meetup | Custom location |
| Friend's backyard | Custom location |
| Place with incomplete address | Custom location (lat/lng) |
| Venue already exists but wrong info | Neither — needs admin fix |

---

## 3. Permissions Investigation

### Current RLS Policies on `venues`

**File:** `supabase/migrations/20251210100001_venues_rls.sql`

| Policy | Operation | Check |
|--------|-----------|-------|
| `venues_select_all` | SELECT | `true` (public read) |
| `venues_insert_admin` | INSERT | `public.is_admin()` |
| `venues_update_admin` | UPDATE | `public.is_admin()` |
| `venues_delete_admin` | DELETE | `public.is_admin()` |

**Implication:** Only admins can create, edit, or delete venues.

### Who Can Edit Venues Today?

| Role | Can Read | Can Create | Can Edit | Can Delete |
|------|----------|------------|----------|------------|
| Anonymous | Yes | No | No | No |
| Member | Yes | **RLS blocks** | No | No |
| Approved Host | Yes | **RLS blocks** | No | No |
| Admin | Yes | Yes | Yes | Yes |

**Bug Found:** `VenueSelector.tsx` attempts direct client-side INSERT for any logged-in user, but RLS blocks non-admins. The UI doesn't communicate this — it will silently fail or show a generic error.

### Existing "Suggest Update" Pattern

**File:** `event_update_suggestions` table (see `database.types.ts:750-815`)

```typescript
{
  id: number;
  event_id: string;
  field: string;
  old_value: string | null;
  new_value: string;
  status: string; // pending/approved/rejected
  batch_id: string;
  submitter_name: string | null;
  submitter_email: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_response: string | null;
  notes: string | null;
}
```

This pattern could be reused for venue suggestions.

---

## 4. Venue Edit Safety Analysis

**If a user could edit a venue directly:**
- Change affects ALL events referencing that venue (past and future)
- Seeded events (65+) would be silently modified
- No audit trail
- No way to revert

**Current Safe Path:**
1. User creates **custom location** on their event (event-scoped, not global)
2. Admin fixes venue via `/dashboard/admin/venues` (admin dashboard)

### Options for "Fix venue data globally"

| Option | Mechanism | Risk | UX |
|--------|-----------|------|-----|
| A. Direct edit (member) | Allow member UPDATE on venues | High — uncontrolled changes | Fast |
| B. Suggestion workflow | Create `venue_update_suggestions` table | Low — admin reviews | Slower |
| C. Admin-only + report link | Keep current RLS, add "Report issue" | Lowest — no DB changes for venues | Slowest |

**Recommendation:** Option B (suggestion workflow) or Option C (report link + admin fix).

---

## 5. Map Pin + No-Address Support

### Current Geo Support

| Entity | Has lat/lng? | Has address? | Has notes? |
|--------|--------------|--------------|------------|
| Venues | **No** | Yes (required) | No (has `notes` but not location-specific) |
| Events (custom) | **Yes** | Optional | Yes (`location_notes`) |

### Venues Schema (relevant columns)

```sql
-- From database.types.ts
venues: {
  address: string;     -- Required
  city: string;        -- Required
  state: string;       -- Required
  google_maps_url?: string;  -- Optional link
  map_link?: string;         -- Optional link
  -- NO lat/lng columns
}
```

### Events Custom Location Schema

```sql
-- From database.types.ts
events: {
  custom_location_name: string | null;
  custom_address: string | null;
  custom_city: string | null;
  custom_state: string | null;
  custom_latitude: number | null;  -- EXISTS
  custom_longitude: number | null; -- EXISTS
  location_notes: string | null;   -- EXISTS
}
```

### Map Component Status

- **`/open-mics/map`** redirects to `/happenings?type=open_mic` (no map implementation)
- No Mapbox or Google Maps SDK integration found
- No geocoding service configured
- Lat/lng fields exist but are **manual input only** (no map picker UI)

### Gaps Requiring Schema Changes

| Gap | Requires Migration? | Notes |
|-----|---------------------|-------|
| Venue lat/lng | Yes | Add `latitude`, `longitude` columns |
| Venue location notes | Yes | Add `location_notes` column |
| Map picker UI | No | Frontend only |
| Geocoding integration | No | API key + frontend |

---

## 6. UX Decision Framework: Top of Dropdown

### Current Native `<select>` Limitations

The VenueSelector uses a native HTML `<select>` element:
- Options are rendered in order
- Cannot have "action rows" that aren't selectable options
- Cannot have sticky headers
- Keyboard navigation works (↑↓ to scroll, type to filter)
- Mobile renders as native picker (good)

### Option A: Reorder within `<select>`

Move action items to top:

```html
<select>
  <option value="">Select a venue...</option>
  <option value="__new__">+ Add new venue...</option>
  <option value="__custom__">✎ Enter custom location...</option>
  <option disabled>──────────────</option>
  <!-- venues list -->
</select>
```

**Pros:** Minimal change, keyboard works, mobile works
**Cons:** Slightly awkward (actions before venues)

### Option B: Combobox Component (Headless UI / Radix)

Replace `<select>` with searchable combobox:

```
┌─────────────────────────────────────┐
│ 🔍 Search venues...                 │
├─────────────────────────────────────┤
│ + Add new venue                     │ ← Sticky action
│ ✎ Use custom location              │ ← Sticky action
├─────────────────────────────────────┤
│ Recently used                       │ ← Section header
│   Same Cafe — Denver                │
│   Velvet Banjo — Denver             │
├─────────────────────────────────────┤
│ All venues                          │ ← Section header
│   Same Cafe — Denver                │
│   Schoolhouse Kitchen — Arvada      │
│   ... (scrollable)                  │
└─────────────────────────────────────┘
```

**Pros:** Best UX, searchable, sections
**Cons:** Requires new dependency, more complex, mobile behavior changes

### Option C: Buttons Above `<select>`

Keep `<select>` for venues, add action buttons above:

```
[+ Add new venue] [✎ Custom location]
┌─────────────────────────────────────┐
│ Select a venue...              ▼    │
└─────────────────────────────────────┘
```

**Pros:** Clear separation, native select works
**Cons:** Takes more vertical space

### Recommendation

**Start with Option A** (reorder within select) as quickest fix. Consider Option B for future UX pass if search becomes necessary.

---

## 7. Edge Case Matrix

| User Action | Expected Outcome | Data Changes | Permissions | Failure Handling |
|-------------|------------------|--------------|-------------|------------------|
| Choose existing venue | Venue attached to event | `event.venue_id` set | Any logged-in | Show error if venue missing |
| Add new venue (admin) | Creates venue, auto-selects | `venues` INSERT | Admin only | Success |
| Add new venue (non-admin) | **Currently fails** | None (RLS blocks) | Blocked | Generic error (needs fix) |
| Enter custom location | Event uses custom fields | `event.custom_*` fields | Event creator | Validation errors |
| Park / no address | Use custom location with lat/lng | `custom_latitude`, `custom_longitude` | Event creator | Allow empty address |
| Venue info wrong | Cannot fix directly | None | Admin only | Show "Report issue" link |
| Seeded venue correction | Admin fixes in dashboard | `venues` UPDATE | Admin only | Audit via `updated_at` |

---

## 8. STOP-GATE

### VERIFIED

| Item | Status | Source |
|------|--------|--------|
| VenueSelector uses native `<select>` | ✅ Verified | `VenueSelector.tsx:142-161` |
| Actions at bottom of dropdown | ✅ Verified | `VenueSelector.tsx:156-160` |
| Venue RLS is admin-only for writes | ✅ Verified | `20251210100001_venues_rls.sql` |
| Events have lat/lng columns | ✅ Verified | `database.types.ts:829-831` |
| Venues do NOT have lat/lng | ✅ Verified | `database.types.ts:2410-2429` |
| No venue suggestions table exists | ✅ Verified | Schema search found none |
| EventForm uses both venue + custom | ✅ Verified | `EventForm.tsx:703-882` |
| Admin venue API exists | ✅ Verified | `/api/admin/venues/route.ts` |
| No map picker component exists | ✅ Verified | Only redirect at `/open-mics/map` |

### UNKNOWN (Needs Clarification)

| Item | Why Unknown | Impact |
|------|-------------|--------|
| Non-admin venue creation behavior | Need to test actual error message | UX clarity |
| Mobile dropdown usability | Need device testing | Combobox decision |
| Geocoding service preference | Mapbox vs Google? | Future implementation |

### Implementation Options

| Option | Scope | Risk | Effort |
|--------|-------|------|--------|
| **A. Reorder dropdown** | Move actions to top | Low | Small |
| **B. Fix RLS mismatch** | Either remove "Add venue" for non-admins OR allow host venue creation | Low | Small |
| **C. Add venue suggestions** | New table + admin review UI | Low | Medium |
| **D. Add venue lat/lng** | Schema migration | Low | Small |
| **E. Map picker component** | UI + geocoding API | Medium | Large |

### Recommended Phase 4.45b Scope

1. **Reorder dropdown** — actions at top (Option A)
2. **Fix RLS mismatch** — either:
   - Hide "Add new venue" for non-admins, OR
   - Allow approved hosts to create venues
3. **Add "Report venue issue" link** — opens email or creates suggestion (Option C partial)

**Defer to future:**
- Venue lat/lng columns
- Map picker UI
- Geocoding integration
- Full venue suggestions table

---

**Ready for Sami approval to proceed to Phase 4.45b implementation.**

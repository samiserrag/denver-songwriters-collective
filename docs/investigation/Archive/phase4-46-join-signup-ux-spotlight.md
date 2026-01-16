# Phase 4.46 Investigation: Join & Signup UX Spotlight

**Date:** January 2026
**Status:** Investigation Complete — Ready for Approval
**Author:** Claude (Repo Agent)

---

## Executive Summary

This investigation confirms all prerequisites for Phase 4.46 implementation:

1. **Admin venue edit UI EXISTS** at `/dashboard/admin/venues` — admins can be linked directly
2. **VenueSelector Phase 4.45b is in place** — actions at top, admin gating works
3. **Custom location fields exist** — includes `location_notes` for "notes first" pattern
4. **SlotConfigSection already handles RSVP + timeslots** — can be enhanced with mini preview

---

## A) Venue Edit Capability — FOUND

### Admin Venue Edit UI

| Item | Value |
|------|-------|
| Page Route | `/dashboard/admin/venues` |
| Page File | `web/src/app/(protected)/dashboard/admin/venues/page.tsx` |
| Client Component | `web/src/app/(protected)/dashboard/admin/venues/AdminVenuesClient.tsx` |
| API Routes | `GET/POST /api/admin/venues`, `GET/PATCH/DELETE /api/admin/venues/[id]` |

**Capabilities:**
- List all venues with name, address, city, state
- Edit any venue (modal form with all fields)
- Create new venues
- Delete venues (with confirmation)

**Edit Flow:**
1. Admin clicks "Edit" button on venue row
2. Modal opens with all venue fields pre-populated
3. Admin makes changes and clicks "Save Changes"
4. PATCH request to `/api/admin/venues/[venueId]`

**For Phase 4.46:** Admins can be linked to `/dashboard/admin/venues` to fix venue data globally. The page lists all venues, so admin can search/scroll to find the venue they want to edit.

---

## B) VenueSelector Behavior (Phase 4.45b Confirmed)

### File: `web/src/components/ui/VenueSelector.tsx`

**Verified Behaviors:**

| Feature | Status | Line(s) |
|---------|--------|---------|
| Dropdown action ordering at top | ✅ Confirmed | 152-162 |
| Admin gating for "Add new venue" | ✅ Confirmed | 154-156 (`canCreateVenue && ...`) |
| "Report venue issue" mailto link | ✅ Confirmed | 172-182 |
| Custom location option | ✅ Confirmed | 157-159 |

**Current Dropdown Order:**
```
1. "Select a venue..." (placeholder)
2. "+ Add new venue..." (if canCreateVenue=true)
3. "✎ Enter custom location..." (if showCustomLocationOption=true)
4. "──────────────" (separator, if any actions)
5. Venues A-Z
```

**Current Helper Text (non-admin):**
> "Can't find your venue? Use **Custom Location** for one-time or approximate locations. [Report a venue issue](mailto:...)"

### EventForm Usage

**File:** `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx`

**Line 711-723:**
```tsx
<VenueSelector
  venues={venues}
  selectedVenueId={formData.venue_id}
  onVenueChange={(id) => {
    updateField("venue_id", id);
    setLocationSelectionMode("venue");
  }}
  onVenueCreated={(newVenue) => setVenues(prev => [...prev, newVenue])}
  onCustomLocationSelect={() => setLocationSelectionMode("custom")}
  showCustomLocationOption={true}
  isCustomLocationSelected={locationSelectionMode === "custom"}
  canCreateVenue={canCreateVenue}
  required
/>
```

Props passed:
- `canCreateVenue` (from page props, `isAdmin`)
- `showCustomLocationOption={true}`
- `isCustomLocationSelected` (tracks custom mode)

---

## C) Custom Location Fields + Notes — CONFIRMED

### Event-Level Custom Location Fields

**File:** `EventForm.tsx` (formData state, lines 144-150)

| Field | Type | Purpose |
|-------|------|---------|
| `custom_location_name` | string | Location name (required when custom) |
| `custom_address` | string | Street address (optional) |
| `custom_city` | string | City (optional) |
| `custom_state` | string | State (optional) |
| `custom_latitude` | string → number | Lat coordinate (optional) |
| `custom_longitude` | string → number | Lng coordinate (optional) |
| `location_notes` | string | Additional instructions (optional) |

### Current Custom Location UI

**Lines 779-883:** When `locationSelectionMode === "custom"`, shows:
- Location Name (required, red label)
- Street Address (optional)
- City (optional)
- State (optional)
- Latitude (optional number input)
- Longitude (optional number input)
- Location Notes (optional, "Additional instructions for finding the location")

**Current Header:** "Custom Location" (no "event-only" clarification)

### Location Notes "Notes First" Pattern

Location notes already exists and is prominently placed at the bottom of custom location fields. The lat/lng fields exist but no map picker is implemented (manual entry only).

---

## D) RSVP + Timeslots UI Components — CONFIRMED

### Component: `SlotConfigSection`

**File:** `web/src/app/(protected)/dashboard/my-events/_components/SlotConfigSection.tsx`

**Current Structure:**
1. **"About RSVPs" info box** (lines 83-103)
   - Explains RSVP means attendance planning, not performer signup
   - States "RSVPs are always available for your event"

2. **Attendance Cap input** (lines 105-132)
   - Optional number field
   - "Leave blank for unlimited"

3. **Performer Slots toggle** (lines 134-171)
   - Toggle switch for `has_timeslots`
   - Shows "Recommended for Open Mic/Showcase" badge when applicable

4. **Slot Configuration** (lines 173-267, only when enabled)
   - Number of slots
   - Slot duration (5/10/15/20/30 min dropdown)
   - Allow Guest Sign-ups toggle
   - Info box showing total performance time calculation

**Props:**
```typescript
interface SlotConfigSectionProps {
  eventType: string;
  config: SlotConfig;
  onChange: (config: SlotConfig) => void;
  disabled?: boolean;
  capacity: number | null;
  onCapacityChange: (capacity: number | null) => void;
}
```

### Current Section Title

The section is rendered in EventForm at line 924-933 without a visible section header. It just appears as a block of UI.

---

## 2. Implementation Plan

### 2.1 "Join & Signup" Section Layout

**Rename/restructure SlotConfigSection to be the "Join & Signup" section:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎤 Join & Signup                                                │
│ How attendees and performers interact with your event           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 👥 Audience RSVP                                            ││
│ │ RSVPs are always available. Attendees can RSVP to let you   ││
│ │ know they're coming.                                        ││
│ │                                                             ││
│ │ Attendance Cap (optional): [___________] (unlimited)        ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 🎸 Performer Slots (optional)                    [Toggle]   ││
│ │ Allow performers to claim time slots.                       ││
│ │                                                             ││
│ │ [If enabled: slot count, duration, allow guests]            ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 📋 Preview: What attendees will see                         ││
│ │ ┌─────────────────────────────────────────────────────────┐││
│ │ │ ✓ RSVP Available (unlimited / X spots)                  │││
│ │ │ [if slots] 🎤 10 performer slots (10 min each)          │││
│ │ └─────────────────────────────────────────────────────────┘││
│ └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Mini Preview Content

**Elements shown in preview (no API calls, pure UI state):**

| Condition | Preview Text |
|-----------|--------------|
| capacity is null | "✓ RSVP Available (unlimited)" |
| capacity is set | "✓ RSVP Available ({capacity} spots)" |
| has_timeslots && total_slots | "🎤 {total_slots} performer slots ({duration} min each)" |
| !has_timeslots | (no performer slot line) |

### 2.3 Copy Changes for "Custom Location (event-only)"

**Dropdown option text:**
- Current: `✎ Enter custom location...`
- New: `✎ Custom location (this event only)...`

**Custom location section header:**
- Current: `Custom Location`
- New: `Custom Location (this event only)`

**Custom location helper text (add below header):**
- New: `This location applies only to this event and won't be added to the venue list.`

### 2.4 "Venue wrong?" Link Behavior

**When a venue is selected, add a link below the venue summary panel:**

**For non-admin:**
```
Venue info wrong? [Report an issue](mailto:hello@denversongwriterscollective.org?subject=Venue%20Issue%3A%20{venueName}&body=Event%3A%20{eventId}%0AVenue%3A%20{venueName}%20({venueId})%0A%0APlease%20describe%20the%20issue%3A)
```

**For admin:**
```
Venue info wrong? [Edit this venue](/dashboard/admin/venues) (Admin)
```

Note: The admin venues page is a list view. We link to the page rather than a specific venue since there's no direct `/dashboard/admin/venues/[id]` route. Admin can find the venue in the list.

---

## 3. Test Plan (12 tests)

### Dropdown & Location Tests (4 tests)

1. **Custom location dropdown option shows "this event only"**
   - Verify dropdown option text is `✎ Custom location (this event only)...`

2. **Custom location header shows "this event only"**
   - When custom location selected, section header is "Custom Location (this event only)"

3. **"Venue wrong?" link shows for non-admin (mailto)**
   - When venue selected and canCreateVenue=false, mailto link appears

4. **"Venue wrong?" link shows for admin (edit link)**
   - When venue selected and canCreateVenue=true, link to admin venues page appears

### Join & Signup Section Tests (5 tests)

5. **Section has "Join & Signup" header**
   - The SlotConfigSection renders with visible section heading

6. **Audience RSVP subsection always visible**
   - RSVP explanation and capacity field always shown

7. **Performer Slots toggle is optional**
   - Toggle exists and can be turned on/off

8. **Mini preview shows RSVP availability**
   - Preview box shows "✓ RSVP Available (unlimited)" when capacity null
   - Preview box shows "✓ RSVP Available (X spots)" when capacity set

9. **Mini preview shows performer slots when enabled**
   - When has_timeslots=true, preview shows slot count and duration

### Authorization Tests (3 tests)

10. **Non-admin cannot see "Add new venue"**
    - canCreateVenue=false hides "+ Add new venue..." option

11. **Admin can see "Add new venue"**
    - canCreateVenue=true shows "+ Add new venue..." option

12. **Venue edit link only for admin**
    - canCreateVenue gates the "Edit this venue" link vs mailto link

---

## 4. Files to Modify

| File | Changes |
|------|---------|
| `components/ui/VenueSelector.tsx` | Update custom location option text to include "(this event only)" |
| `dashboard/my-events/_components/EventForm.tsx` | Update custom location section header, add "Venue wrong?" link |
| `dashboard/my-events/_components/SlotConfigSection.tsx` | Add section header, restructure as "Join & Signup", add mini preview |
| `__tests__/phase4-46-join-signup-ux.test.tsx` | New test file with 12 tests |

---

## 5. STOP-GATE Checklist

### VERIFIED

| Item | Status | Source |
|------|--------|--------|
| Admin venue edit UI exists | ✅ | `/dashboard/admin/venues` |
| VenueSelector actions at top | ✅ | `VenueSelector.tsx:152-162` |
| canCreateVenue prop gates "Add new venue" | ✅ | `VenueSelector.tsx:154-156` |
| "Report venue issue" mailto exists | ✅ | `VenueSelector.tsx:172-182` |
| Custom location fields exist | ✅ | `EventForm.tsx:144-150` |
| location_notes field exists | ✅ | `EventForm.tsx:150` |
| SlotConfigSection handles RSVP + timeslots | ✅ | Full component verified |
| No map picker exists (confirmed, not adding) | ✅ | Only manual lat/lng inputs |

### Scope Constraints

- UI-only changes ✅
- No schema migrations ✅
- No map picker ✅

---

**Ready for Sami approval to proceed to Phase 4.46 implementation.**

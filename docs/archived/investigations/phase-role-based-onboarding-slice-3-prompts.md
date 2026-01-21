# Investigation — Slice 3: Post-Onboarding Action Prompts

**Status:** INVESTIGATION COMPLETE
**Date:** January 2026
**Author:** Claude (Agent)
**Mode:** Phase A (Investigation Only)

---

## Executive Summary

After onboarding completion, users who selected `is_host=true` should see a prompt to apply for DSC Happenings Host status. Users should also see an optional prompt to browse/claim venues. Both flows already exist — we just need to surface them prominently on the dashboard after onboarding.

**Key Finding:** The `RequestHostButton` component exists (`components/hosts/RequestHostButton.tsx`) but is **not used anywhere** in the app. The dashboard already queries `approved_hosts` status but stores it in an unused variable. Implementation is straightforward: add a "Getting Started" section to the dashboard that appears conditionally.

---

## Section 1: Current Onboarding Completion Flow

### Redirect Targets

| Action | Redirect URL | Trigger |
|--------|--------------|---------|
| "Let's go!" button | `/dashboard?welcome=1` | `handleSubmit()` line 245 |
| "I'll finish this later" button | `/dashboard` | `handleSkip()` line 293 |

### Dashboard Behavior on `?welcome=1`

The `WelcomeToast` component (line 89-91 in `dashboard/page.tsx`) shows a toast:
```
"Your email has been confirmed — welcome!"
```

**No other special welcome flow exists.** The toast disappears, and user sees the standard dashboard with Quick Actions grid.

---

## Section 2: Existing Host Approval Entrypoints

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/host-requests` | GET | Check user's host request status |
| `/api/host-requests` | POST | Submit new host request |
| `/api/admin/host-requests/[id]` | PATCH | Admin approve/reject |

### Existing Component

**`components/hosts/RequestHostButton.tsx`** (157 lines)

A fully functional component that:
1. Checks if user is logged in
2. Checks if user is already an approved host (shows "You're an approved host!" badge)
3. Checks if user has a pending request (shows "Pending review" badge)
4. Shows "Request to become a host" button with modal form

**Current Usage:** **NONE** — exported from `components/hosts/index.ts` but not imported anywhere in the app.

### Dashboard Query (Unused)

In `dashboard/page.tsx` lines 41-48:
```typescript
// Check host status (available for future use: isApprovedHost logic)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { data: _hostStatus } = await supabase
  .from("approved_hosts")
  .select("status")
  .eq("user_id", user.id)
  .eq("status", "active")
  .maybeSingle();
```

This is already queried but unused. We can leverage this.

---

## Section 3: Existing Venue Management Entrypoints

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/venues/[id]/claim` | POST | Submit venue claim |
| `/api/admin/venue-claims/[id]/approve` | POST | Admin approve claim |
| `/api/admin/venue-claims/[id]/reject` | POST | Admin reject claim |
| `/api/my-venues` | GET | List user's managed venues |

### Existing Components

**`components/venue/ClaimVenueButton.tsx`** (225 lines)
- Used on `/venues/[id]` pages
- Shows "Claim This Venue" button with modal form
- Handles pending/approved/rejected status display

### My Venues Dashboard

**`dashboard/my-venues/page.tsx`** (247 lines)
- Shows venues user manages
- Shows pending claims
- Empty state: "You don't manage any venues yet. Browse venues and claim one you manage, or accept an invite from an admin."
- Links to `/venues` for browsing

---

## Section 4: Proposed UI Surface

### Recommended Location: Dashboard "Getting Started" Section

Add a new section to `/dashboard/page.tsx` that appears when:
1. User has `?welcome=1` query param, OR
2. User has incomplete setup (host without request, host without venues)

Position: **After Profile Completeness card, before Quick Actions grid.**

### Section Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ ✨ Getting Started                                              │
│                                                                 │
│ ┌───────────────────────────┐  ┌───────────────────────────┐  │
│ │ 🎤 Host DSC Happenings    │  │ 📍 Manage a Venue         │  │
│ │                           │  │                           │  │
│ │ You marked yourself as a  │  │ Do you run or manage a   │  │
│ │ host. Apply to create     │  │ venue that hosts live    │  │
│ │ official DSC happenings.  │  │ music? Claim it here.    │  │
│ │                           │  │                           │  │
│ │ [Apply to Host →]         │  │ [Browse Venues →]         │  │
│ └───────────────────────────┘  └───────────────────────────┘  │
│                                                                 │
│ [Dismiss]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Visibility Conditions

#### Host Prompt

| Condition | Show Host Prompt |
|-----------|------------------|
| `is_host=false` | No |
| `is_host=true` AND is approved host | No |
| `is_host=true` AND has pending request | No (show "Request pending") |
| `is_host=true` AND no request | Yes |

#### Venue Prompt

| Condition | Show Venue Prompt |
|-----------|-------------------|
| `is_host=true` AND manages 0 venues | Yes |
| `is_host=false` AND `is_studio=false` | No |
| `is_studio=true` AND manages 0 venues | Yes |
| Manages 1+ venues | No |

### Links to Existing Flows

| Prompt | Link Target | Existing Component |
|--------|-------------|-------------------|
| Host CTA | Opens inline `RequestHostButton` OR links to `/get-involved` | `RequestHostButton` |
| Venue CTA | `/venues` | Browse + `ClaimVenueButton` on each page |

**Alternative:** Could link venue CTA to `/dashboard/my-venues` which has the "Browse All Venues" button and shows empty state.

---

## Section 5: Exact Files to Change

### Primary Changes

| File | Change |
|------|--------|
| `dashboard/page.tsx` | Add `GettingStartedSection` component import, add section JSX, expose `_hostStatus` |
| `dashboard/GettingStartedSection.tsx` | **NEW** — Client component for the prompts |

### Component Props (GettingStartedSection)

```typescript
interface Props {
  profile: {
    is_host: boolean;
    is_studio: boolean;
  };
  hostStatus: {
    isApproved: boolean;
    hasPendingRequest: boolean;
  };
  venueCount: number;
  showOnWelcome: boolean; // from ?welcome=1 query param
}
```

### Queries to Add

In `dashboard/page.tsx`, we need:

1. **Host Request Status** (already exists as `_hostStatus`, need to also check `host_requests`):
```typescript
// Already exists
const { data: approvedHostStatus } = await supabase
  .from("approved_hosts")
  .select("status")
  .eq("user_id", user.id)
  .eq("status", "active")
  .maybeSingle();

// Need to add
const { data: pendingHostRequest } = await supabase
  .from("host_requests")
  .select("status")
  .eq("user_id", user.id)
  .eq("status", "pending")
  .maybeSingle();
```

2. **Venue Manager Count**:
```typescript
const { count: venueCount } = await supabase
  .from("venue_managers")
  .select("*", { count: "exact", head: true })
  .eq("user_id", user.id)
  .is("revoked_at", null);
```

---

## Section 6: Tests to Add

### Test File

`web/src/__tests__/getting-started-section.test.tsx`

### Test Cases

| # | Test | Expected |
|---|------|----------|
| 1 | `is_host=false` → No host prompt | Section hidden or only venue prompt |
| 2 | `is_host=true`, not approved, no request → Host prompt shown | "Apply to Host" CTA visible |
| 3 | `is_host=true`, approved → No host prompt | Green checkmark or hidden |
| 4 | `is_host=true`, pending request → Pending badge | "Request pending" shown |
| 5 | `is_host=true`, manages 0 venues → Venue prompt shown | "Browse Venues" CTA visible |
| 6 | Manages 1+ venues → No venue prompt | Section hidden or no venue card |
| 7 | `?welcome=1` → Section always shows (if eligible) | Not auto-dismissed |
| 8 | Dismiss button hides section | Uses localStorage to persist |
| 9 | Host CTA links to correct flow | Either inline `RequestHostButton` or `/get-involved` |
| 10 | Venue CTA links to `/venues` | Correct href |

---

## Section 7: Alternative Approaches (Not Recommended)

### Option A: Inline RequestHostButton in Quick Actions

Could add `RequestHostButton` directly to Quick Actions grid. However:
- Grid is already 5 items, adding more makes it crowded
- `RequestHostButton` is too complex for a simple grid item

### Option B: Dedicated Welcome Page

Could create `/dashboard/welcome` page that shows once. However:
- Extra route to maintain
- Users might miss it if they navigate directly to dashboard later
- Current `?welcome=1` pattern works fine

### Option C: Modal on First Visit

Could show modal popup. However:
- Interrupts flow
- Users often dismiss modals without reading

**Recommendation:** Persistent (dismissable) section on dashboard is least intrusive while being discoverable.

---

## Section 8: Implementation Estimate

| Task | Effort |
|------|--------|
| Add queries to dashboard | 15 min |
| Create GettingStartedSection component | 30 min |
| Add section to dashboard JSX | 10 min |
| Tests | 30 min |
| Quality gates | 10 min |

**Total:** ~1.5 hours

---

## STOP-GATE Section

### Decisions Sami Must Make

1. **UI Location Confirmation**
   - Recommended: Dashboard, after Profile Completeness, before Quick Actions
   - Alternative: As a banner at very top of dashboard
   - **Needs confirmation**

2. **Host CTA Behavior**
   - Option A: Inline `RequestHostButton` component (shows form directly)
   - Option B: Link to `/get-involved` page (if one exists with host info)
   - **Recommendation:** Inline `RequestHostButton` — it already handles all states
   - **Needs confirmation**

3. **Venue CTA Target**
   - Option A: `/venues` (browse all)
   - Option B: `/dashboard/my-venues` (shows empty state with browse link)
   - **Recommendation:** `/venues` (more direct)
   - **Needs confirmation**

4. **Dismiss Persistence**
   - Option A: localStorage (persists across sessions)
   - Option B: Session only (reappears on next login)
   - **Recommendation:** localStorage with key like `dsc_getting_started_dismissed`
   - **Needs confirmation**

5. **Show conditions for non-welcome visits**
   - Should section appear on every dashboard visit until dismissed?
   - Or only on `?welcome=1`?
   - **Recommendation:** Show on every visit until dismissed (more discoverable)
   - **Needs confirmation**

### Explicit UNKNOWNs

| # | Unknown | Impact | Resolution |
|---|---------|--------|------------|
| 1 | Does `/get-involved` page exist with host application info? | Affects host CTA target | Check routes; if not, use inline component |
| 2 | Should Studio users see venue prompt even if `is_host=false`? | Affects venue prompt conditions | Product decision — leaning yes |
| 3 | What if user is BOTH approved host AND manages 0 venues? | Should still show venue prompt | Confirm expected behavior |

---

## Files Referenced

| File | Purpose |
|------|---------|
| `app/onboarding/profile/page.tsx` | Redirect targets on completion |
| `app/(protected)/dashboard/page.tsx` | Dashboard layout, existing queries |
| `app/(protected)/dashboard/WelcomeToast.tsx` | Current welcome behavior |
| `components/hosts/RequestHostButton.tsx` | Existing host request component (UNUSED) |
| `components/venue/ClaimVenueButton.tsx` | Existing venue claim component |
| `app/(protected)/dashboard/my-venues/page.tsx` | Venue management dashboard |
| `api/host-requests/route.ts` | Host request API |
| `api/venues/[id]/claim/route.ts` | Venue claim API |

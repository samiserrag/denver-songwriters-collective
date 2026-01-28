# Phase 4.99 — TV Display Manager UX & System Audit

**Status:** ✅ COMPLETE
**Date:** January 2026
**Scope:** UX Hardening for Launch-Readiness

---

## 1. Surface Inventory Table

| Surface | URL Pattern | Access Level | Primary User | Discovery Path |
|---------|-------------|--------------|--------------|----------------|
| TV Display (Public) | `/events/[id]/display?date=YYYY-MM-DD` | Public (read-only) | Venue/Audience | Via lineup page "Open TV Display" link |
| Lineup Control | `/events/[id]/lineup?date=YYYY-MM-DD` | Admin OR Host OR Co-host | Event Host | Via HostControls "Control Lineup" button |
| Host Controls Panel | `/events/[id]` (component) | Admin OR Host OR Co-host | Event Host | Event detail page (inline section) |
| Timeslot Section | `/events/[id]` (component) | Public (claim requires auth) | Performers | Event detail page (inline section) |
| Timeslot Claiming API | `/api/events/[id]/timeslots/[slotId]/claim` | Authenticated OR Guest (verified) | Performers | Via TimeslotSection UI |
| **Dashboard Lineup Control** | `/dashboard/my-events/[id]` (component) | Admin OR Host OR Co-host | Event Host | **NEW: Via LineupControlSection** |

### Database Tables Involved

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `event_timeslots` | Slot definitions | `id`, `event_id`, `slot_number`, `start_time`, `date_key` |
| `timeslot_claims` | Performer assignments | `timeslot_id`, `member_id`, `performer_name`, `status` |
| `event_lineup_state` | Current "now playing" pointer | `event_id`, `date_key`, `now_playing_timeslot_id`, `updated_at` |

---

## 2. Top 5 UX Risks (Ranked)

### RISK 1: No Discoverable Entry Point to Lineup Control (CRITICAL) — ✅ FIXED

**Evidence:**
- `HostControls.tsx` is the ONLY UI entry to lineup control (`/events/[id]/lineup`)
- HostControls only renders when `isHost || isAdmin` check passes
- No nav menu item, no dashboard link, no "Manage Lineup" button elsewhere
- If host navigates directly to `/dashboard/my-events/[id]`, there is NO link to lineup control

**Impact:** Host arrives at venue, opens laptop, cannot find lineup control page. Must manually type URL or navigate to public event page first.

**DSC UX Principles Violated:** §6 (Anchored Navigation), §8 (Dead States)

**Fix (A1-A2):** Created `LineupControlSection` component and added to `/dashboard/my-events/[id]` page. Includes:
- Date selector for recurring events
- "Control Lineup" button linking to lineup page with date param
- "Open TV Display" button opening in new tab
- Copyable display URL for projector setup

---

### RISK 2: Date-Key Parameter Silently Defaults Without Warning (HIGH) — ✅ FIXED

**Evidence:**
- `lineup/page.tsx` lines 146-163: If `?date=` param missing, defaults to `expandOccurrencesForEvent()` first result
- No warning shown to host if they're controlling wrong date
- TV Display auto-inherits date from "Open TV Display" link, but direct URL access has no guardrail

**Impact:** Host controls wrong occurrence. Performers signed up for Jan 25 don't appear because lineup page defaulted to Jan 18.

**DSC UX Principles Violated:** §3 (Rolling Windows Must Be Explained), §14 (If Something Feels Confusing, It Probably Is)

**Fix (B3-B4):**
- For recurring events with multiple upcoming dates, lineup page now shows `LineupDatePicker` modal requiring explicit date selection
- No silent defaulting — host must actively choose which occurrence to control
- Created `LineupDatePicker` component with upcoming/past date sections

---

### RISK 3: Stale State During Network Interruptions (HIGH) — ✅ FIXED

**Evidence:**
- `display/page.tsx` lines 201-208: 5-second polling with `setInterval`
- `lineup/page.tsx` lines 267-274: 10-second polling with `setInterval`
- NO offline indicator, NO "last updated" timestamp visible to host
- NO error handling UI for failed refreshes

**Impact:** Venue WiFi drops. Host thinks they advanced lineup but update failed. Display shows stale "Now Playing." Audience/performers confused.

**DSC UX Principles Violated:** §8 (Dead States Are Unacceptable)

**Fix (D7-D8):**
- Created `LineupStateBanner` component showing connection health
- Tracks `lastUpdated` timestamp and `connectionStatus` (connected/disconnected/reconnecting)
- Shows warning after 3 consecutive poll failures
- Added to both lineup control page (default variant) and display page (subtle variant)
- Created shared `useLineupPolling` hook (though polling is still inline due to state management complexity)

---

### RISK 4: "Go Live" / "Stop Event" Semantics Unclear (MEDIUM) — ✅ FIXED

**Evidence:**
- `lineup/page.tsx` lines 288-321: "Go Live" sets `now_playing_timeslot_id` to first slot
- "Stop Event" sets `now_playing_timeslot_id` to `null`
- NO confirmation dialog before "Stop Event"
- NO explanation of what "Stop" means (pause vs. end vs. reset)

**Impact:** Host accidentally clicks "Stop Event" mid-show. Unclear how to resume. Display goes blank.

**DSC UX Principles Violated:** §7 (UX Friction Is a Tool)

**Fix (E9-E10):**
- Created generic `ConfirmDialog` component with danger/warning/default variants
- Added confirmation dialog to "Stop Event" action with clear messaging
- Added confirmation dialog to "Reset Lineup" action
- Button labels clarify intent: "Yes, Stop Event" / "Keep Running"

---

### RISK 5: No "Undo" for Lineup Advancement (MEDIUM) — DEFERRED

**Evidence:**
- `lineup/page.tsx` has "Previous" button (lines 323-340) but no confirmation
- Clicking "Previous" during live show may confuse performers who just finished
- NO "reset to slot X" quick action
- NO "jump to" interface (must click through sequentially or use slot list)

**Impact:** Host mis-clicks "Next" twice. Has to click "Previous" twice. Performers see names flash by. Minor but undermines confidence.

**DSC UX Principles Violated:** §1 (Prevent dead-ends, preserve intent, enable recovery)

**Status:** Deferred to future phase. Previous/Next buttons work correctly; adding undo would require additional state tracking.

---

## 3. Dead-Ends & Confusion Points

### Dead-End 1: Dashboard → My Events → [Event] Has No Lineup Link — ✅ FIXED

**Path:** `/dashboard/my-events/[id]`
**Expectation:** Host manages their event, including lineup control
**Reality:** No "Control Lineup" button exists on this page. Only on public `/events/[id]` page.

**Fix:** Added `LineupControlSection` component to dashboard event detail page.

---

### Dead-End 2: Recurring Event Without Date Selector Shows Wrong Occurrence — ✅ FIXED

**Path:** Host navigates directly to `/events/[id]/lineup` (no `?date=` param)
**Expectation:** Page asks which date to control
**Reality:** Silently picks first upcoming occurrence. Host may not notice.

**Fix:** `LineupDatePicker` modal now appears requiring explicit date selection.

---

### Dead-End 3: Mobile Host Cannot Easily Control Lineup — DEFERRED

**Path:** Host on phone at venue, needs to advance lineup
**Expectation:** Touch-friendly controls
**Reality:** Lineup page has no mobile-specific layout. Buttons are small. No swipe gestures.

**Status:** Deferred. Current buttons are reasonably touch-friendly but could be improved.

---

### Confusion Point 1: "Open TV Display" Opens in Same Tab — ✅ FIXED

**Path:** Host clicks "Open TV Display" from lineup page
**Expectation:** Opens in new tab (host keeps control page open)
**Reality:** Link is `<Link href=...>` without `target="_blank"`. Navigates away from control.

**Fix:** Changed to `<Link target="_blank" rel="noopener noreferrer">`.

---

### Confusion Point 2: Display Page Has No "Return to Control" Link — INTENTIONAL

**Path:** Host on TV display page needs to access controls
**Expectation:** Link back to lineup control
**Reality:** Display page is intentionally stripped for projection. No navigation.

**Status:** This is intentional design. Display page is meant for projection only. Host should use the control page in a separate browser tab.

---

### Confusion Point 3: Slot List Clickability Not Obvious — DEFERRED

**Path:** Host wants to jump to specific performer
**Expectation:** Clear "click to jump" affordance
**Reality:** Slots are clickable but styled as list items, not buttons. No hover states documented.

**Status:** Deferred. Current interaction works but could have better visual affordance.

---

## 4. Role Visibility Issues

### Authorization Pattern (Updated)

```
isAuthorized = (
  profile.role === "admin" ||
  event.host_id === user.id ||
  event_hosts.includes(user.id) WHERE invitation_status = 'accepted'  // FIXED
)
```

### Visibility Matrix (Updated)

| Surface | Admin | Primary Host | Co-host (accepted) | Co-host (pending) | Viewer | Guest |
|---------|-------|--------------|--------------------|--------------------|--------|-------|
| TV Display | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lineup Control | ✅ | ✅ | ✅ | ❌ (403) | ❌ (403) | ❌ (login redirect) |
| HostControls Panel | ✅ | ✅ | ✅ | ❌ (hidden) | ❌ (hidden) | ❌ (hidden) |
| Timeslot Claiming | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (via email verify) |
| Dashboard Lineup Section | ✅ | ✅ | ✅ | ❌ (hidden) | ❌ (hidden) | ❌ (hidden) |

### Issues Fixed

**Issue 1: Co-host Access Not Tested in UI — ✅ FIXED (F11)**

**Before:** `event_hosts` table query existed but without `invitation_status` filter
**After:** Query now includes `.eq("invitation_status", "accepted")` — pending/rejected co-hosts cannot access lineup control

**Issue 2: No Visual Indicator of Authorization Source — DEFERRED**

- Host doesn't know if they have access via `host_id` or `event_hosts`
- Matters for debugging when co-host reports "I can't access lineup"

**Issue 3: Claim Status Not Visible to Host on Lineup Page — DEFERRED**

- Slots show performer name but not claim status (`confirmed` vs `pending`)
- Host may try to start with performer who hasn't confirmed

---

## 5. Missing Primitives — Status

### Primitive 1: `useLineupPolling` Hook — ✅ CREATED

**File:** `web/src/hooks/useLineupPolling.ts`
**Status:** Created but not fully integrated (inline polling remains due to complex state dependencies)

### Primitive 2: `LineupStateBanner` Component — ✅ CREATED

**File:** `web/src/components/events/LineupStateBanner.tsx`
**Features:**
- Shows "Last updated X seconds ago"
- Shows "⚠️ Connection lost" when disconnected
- Supports `default` and `subtle` variants

### Primitive 3: Date Context Provider — DEFERRED

**Status:** Not needed for current implementation. URL params provide sufficient coordination.

### Primitive 4: Confirmation Dialog for Destructive Actions — ✅ CREATED

**File:** `web/src/components/ui/ConfirmDialog.tsx`
**Features:**
- `danger`, `warning`, `default` variants
- Escape key and backdrop click support
- Loading state support
- Accessible (role="dialog", aria attributes)

---

## 6. STOP-GATE 2 Verdict

### Verdict: ✅ READY FOR LAUNCH

### Work Completed

| Fix ID | Description | Status |
|--------|-------------|--------|
| A1-A2 | Add `LineupControlSection` to dashboard | ✅ Complete |
| B3-B4 | Add `LineupDatePicker` for recurring events | ✅ Complete |
| C5-C6 | `target="_blank"` + copyable display URL | ✅ Complete |
| D7-D8 | `LineupStateBanner` + connection health | ✅ Complete |
| E9-E10 | Confirmation dialogs for Stop/Reset | ✅ Complete |
| F11 | Co-host authorization security fix | ✅ Complete |

### Files Created

| File | Purpose |
|------|---------|
| `hooks/useLineupPolling.ts` | Shared polling hook |
| `components/events/LineupStateBanner.tsx` | Connection health banner |
| `components/events/LineupDatePicker.tsx` | Date selection modal |
| `components/ui/ConfirmDialog.tsx` | Confirmation dialog |
| `dashboard/my-events/[id]/_components/LineupControlSection.tsx` | Dashboard lineup entry |
| `__tests__/phase4-99-tv-display-manager.test.ts` | 51 tests |

### Files Modified

| File | Change |
|------|--------|
| `app/events/[id]/lineup/page.tsx` | Date picker, confirmations, connection health, security fix |
| `app/events/[id]/display/page.tsx` | Connection health banner |
| `dashboard/my-events/[id]/page.tsx` | LineupControlSection integration |

### Test Coverage

- 51 new tests covering all Phase 4.99 changes
- All 2818 tests passing
- Lint: 0 errors, 0 warnings
- Build: Success

### Quality Gates

| Gate | Status |
|------|--------|
| Lint | ✅ 0 errors, 0 warnings |
| Tests | ✅ 2818 passing |
| Build | ✅ Success |
| Type safety | ✅ No type errors |

---

## Appendix: File References (Updated)

| File | Lines | Purpose |
|------|-------|---------|
| `app/events/[id]/display/page.tsx` | ~500 | TV display implementation |
| `app/events/[id]/lineup/page.tsx` | ~760 | Lineup control implementation |
| `components/events/TimeslotSection.tsx` | ~450 | Performer slot claiming |
| `components/events/HostControls.tsx` | ~114 | Host controls panel |
| `components/events/LineupStateBanner.tsx` | ~80 | Connection health UI |
| `components/events/LineupDatePicker.tsx` | ~140 | Date selection modal |
| `components/ui/ConfirmDialog.tsx` | ~135 | Confirmation dialog |
| `hooks/useLineupPolling.ts` | ~90 | Shared polling hook |
| `dashboard/my-events/[id]/_components/LineupControlSection.tsx` | ~170 | Dashboard lineup entry |

---

**END — Phase 4.99 COMPLETE**

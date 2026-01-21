# Phase 4.48a Investigation: RSVP Attendee List Missing + Success Color Contrast

**Date:** January 2026
**Status:** Investigation Complete — Awaiting Sami Approval
**Author:** Claude (Repo Agent)

---

## Executive Summary

**ROOT CAUSES:**

1. **AttendeeList shows but is EMPTY** — The component renders, but fetches 0 attendees because:
   - Query only fetches RSVPs with `user_id` (authenticated users)
   - **CRITICAL SCHEMA GAP:** `event_rsvps` table has NO `guest_name` or `guest_email` fields
   - Guest RSVPs are **NOT SUPPORTED** at the schema/API level currently

2. **Attendee list hides when empty** — `AttendeeList.tsx:95-97` returns `null` when `attendees.length === 0`

3. **Success banner uses hardcoded Tailwind colors** — RSVPButton uses `dark:` variants and `emerald-*` classes instead of theme-aware CSS variables. In Sunrise (light) theme, this creates suboptimal contrast.

---

## A) AttendeeList Rendering Gates

### File: `web/src/app/events/[id]/page.tsx`

**Line 749:** AttendeeList is rendered unconditionally (no `is_dsc_event` gate):
```tsx
<AttendeeList
  eventId={event.id}
  hasTimeslots={(event as { has_timeslots?: boolean }).has_timeslots || false}
  performerCount={performerCount}
/>
```

**Finding:** No gate prevents rendering. The component receives the eventId.

### File: `web/src/components/events/AttendeeList.tsx`

**Lines 95-97:** Empty state returns null:
```tsx
if (attendees.length === 0) {
  return null; // Don't show section if no attendees
}
```

**Lines 44-58:** Query only fetches authenticated user RSVPs via profile join:
```tsx
const { data, error: fetchError } = await supabase
  .from("event_rsvps")
  .select(`
    id,
    status,
    user:profiles!event_rsvps_user_id_fkey (
      id, slug, full_name, avatar_url
    )
  `)
  .eq("event_id", eventId)
  .eq("status", "confirmed")
  .order("created_at", { ascending: true });
```

**Problem:** This query ONLY returns RSVPs with a valid `user_id` that can join to `profiles`. Guest RSVPs would need `guest_name` fields (which don't exist).

---

## B) Schema Analysis: Guest RSVP Not Supported

### `event_rsvps` table (database.types.ts lines 605-635):

```typescript
event_rsvps: {
  Row: {
    created_at: string | null
    event_id: string
    id: string
    notes: string | null
    status: string
    updated_at: string | null
    user_id: string        // REQUIRED - not nullable
    waitlist_position: number | null
  }
}
```

**Critical Finding:**
- `user_id: string` is **required** (not nullable)
- **NO `guest_name` or `guest_email` fields exist**
- Guest RSVPs are NOT possible with current schema

### Comparison: `timeslot_claims` table (lines 2259-2296):

```typescript
timeslot_claims: {
  Row: {
    guest_email: string | null      // ← EXISTS
    guest_name: string | null       // ← EXISTS
    guest_verification_id: string | null
    guest_verified: boolean | null
    member_id: string | null        // nullable - allows guests
    // ...
  }
}
```

**Timeslot claims CAN have guests** (member_id is nullable, guest_* fields exist).
**Event RSVPs CANNOT have guests** (user_id is required, no guest_* fields).

### API Confirmation: `web/src/app/api/events/[id]/rsvp/route.ts`

**Lines 64-66:** Authentication required:
```typescript
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Line 136:** Uses `session.user.id`:
```typescript
.insert({
  event_id: eventId,
  user_id: session.user.id,  // REQUIRED
  // ...
})
```

---

## C) Success Banner Styling Analysis

### File: `web/src/components/events/RSVPButton.tsx`

**Lines 182-197:** Hardcoded Tailwind colors with `dark:` variants:
```tsx
<div className={`flex items-center gap-3 p-4 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700/50 rounded-xl ...`}>
  <div className="... bg-emerald-200 dark:bg-emerald-500/20 ...">
    <svg className="... text-emerald-600 dark:text-emerald-400" ... />
  </div>
  <div>
    <p className="text-emerald-800 dark:text-emerald-300 font-semibold">You're going!</p>
    <p className="text-emerald-700 dark:text-emerald-400/70 text-sm">We'll see you there</p>
  </div>
</div>
```

**Problem:**
1. Sunrise theme uses `data-theme="sunrise"`, NOT `class="dark"` or `prefers-color-scheme`
2. Tailwind's `dark:` variant doesn't activate for Sunrise theme
3. Light mode colors apply (`bg-emerald-100`, `text-emerald-800`)
4. These raw Tailwind colors don't harmonize with Sunrise's warm orange/cream palette

**Existing theme tokens (presets.css lines 82-84):**
```css
--pill-bg-success: rgba(16, 185, 129, 0.15);
--pill-fg-success: #065F46;  /* emerald-800: dark on light bg */
--pill-border-success: rgba(16, 185, 129, 0.30);
```

---

## D) Scope Decision Required

### Option A: Full Guest RSVP Support (Schema Change Required)

**Requires:**
1. Add `guest_name` and `guest_email` columns to `event_rsvps` table
2. Make `user_id` nullable
3. Add RLS policies for guest RSVPs
4. Create guest RSVP API endpoints
5. Update AttendeeList to render guest names as plain text (no profile link)
6. Add guest RSVP UI form

**STOP-GATE: This requires schema migration - needs explicit approval.**

### Option B: UI-Only Fixes (No Schema Change)

**Can fix now:**
1. **AttendeeList empty state** — Show "No attendees yet" instead of hiding
2. **Success banner contrast** — Use theme tokens instead of raw Tailwind colors
3. **AttendeeList renders guest-style** — For RSVPs with null profile (if user deleted account), show "Anonymous"

**Does NOT enable guest RSVPs** — That requires schema change.

---

## 2. Implementation Plan (Option B: UI-Only)

### Fix 1: AttendeeList Empty State

**File:** `web/src/components/events/AttendeeList.tsx`
**Change:** Show section with "No RSVPs yet" instead of returning null

```tsx
// Before (lines 95-97):
if (attendees.length === 0) {
  return null;
}

// After:
if (attendees.length === 0) {
  return (
    <div className="mb-8">
      <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-3">
        {hasTimeslots ? "Audience" : "Who's Coming"}
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)]">
        No RSVPs yet. Be the first to RSVP!
      </p>
    </div>
  );
}
```

### Fix 2: Success Banner Theme Tokens

**File:** `web/src/components/events/RSVPButton.tsx`
**Change:** Replace hardcoded emerald colors with theme tokens

```tsx
// Before (lines 182-197):
<div className="... bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700/50 ...">
  <p className="text-emerald-800 dark:text-emerald-300">You're going!</p>

// After:
<div className="... bg-[var(--pill-bg-success)] border-[var(--pill-border-success)] ...">
  <p className="text-[var(--pill-fg-success)]">You're going!</p>
```

Also update:
- Icon container background
- Icon stroke color
- Secondary text color

---

## 3. Test Plan

### Tests to Add/Update

1. **AttendeeList renders empty state when no RSVPs**
   - Verify "No RSVPs yet" message displays
   - Verify section title still shows

2. **AttendeeList renders after RSVP**
   - RSVP → refresh → verify name appears in list
   - Verify profile link works for members

3. **Success banner uses theme tokens**
   - Assert classes include `var(--pill-*-success)` tokens
   - No hardcoded `emerald-*` classes in success state

4. **Cancelled RSVPs not shown**
   - RSVP → cancel → verify removed from list

### Existing Test Files to Update

- `__tests__/phase4-43-rsvp.test.ts` — Add empty state test
- Create new: `__tests__/phase4-48a-attendee-list.test.tsx`

---

## 4. Files to Modify

| File | Change |
|------|--------|
| `components/events/AttendeeList.tsx` | Empty state UI instead of null |
| `components/events/RSVPButton.tsx` | Replace emerald-* with theme tokens |
| `__tests__/phase4-48a-attendee-list.test.tsx` | New test file (4 tests) |

---

## 5. STOP-GATE Checklist

### Scope Decision Needed

| Question | Answer |
|----------|--------|
| Enable guest RSVPs? | **REQUIRES SAMI DECISION** — needs schema migration |
| Fix UI contrast issues? | Yes — UI-only, no schema change |
| Show empty state? | Yes — improves UX |

### If Guest RSVPs Approved (Future Phase)

Migration would add:
```sql
ALTER TABLE event_rsvps
ADD COLUMN guest_name TEXT,
ADD COLUMN guest_email TEXT,
ALTER COLUMN user_id DROP NOT NULL;
```

Plus RLS policies, API endpoints, and UI.

---

## 6. Acceptance Criteria (Option B)

- [ ] AttendeeList shows "No RSVPs yet" when empty (not hidden)
- [ ] AttendeeList shows attendee names after RSVP
- [ ] Member names link to `/songwriters/{slug}`
- [ ] Cancelled RSVPs not shown in list
- [ ] Success banner uses `--pill-*-success` tokens
- [ ] Success banner readable in both Sunrise and Night themes

---

**STOP-GATE: Awaiting Sami approval to proceed.**

**Questions for Sami:**
1. Proceed with Option B (UI-only fixes)?
2. Plan guest RSVP support for a future phase (requires schema migration)?

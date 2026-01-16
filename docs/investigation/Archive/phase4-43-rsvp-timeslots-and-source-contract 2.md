# Phase 4.43 Investigation — RSVP + Timeslots Coexist + Source Contract

**Status:** INVESTIGATION COMPLETE — AWAITING SAMI APPROVAL
**Date:** January 2026

---

## Goal A: RSVP + Timeslots Not Mutually Exclusive

### Current Behavior

The system enforces **mutual exclusivity** between RSVP and Timeslot signup lanes. A DSC event can have either:
- RSVP mode (`has_timeslots = false`, `capacity` controls attendance)
- Performance Slots mode (`has_timeslots = true`, `total_slots` controls performer count)

**Not both simultaneously.**

### Evidence Map

#### 1. Signup Lane Selection Logic

| Location | File:Line | Behavior |
|----------|-----------|----------|
| Form toggle | `SlotConfigSection.tsx:49-63` | Radio button choice between RSVP Mode and Performance Slots |
| Form auto-switch | `SlotConfigSection.tsx:30-47` | Event type change auto-toggles `has_timeslots` |
| API capacity logic | `api/my-events/route.ts:155` | Sets `capacity = total_slots` when `has_timeslots = true` |

The `SlotConfigSection` component (lines 81-156) presents two mutually exclusive radio buttons:
- "RSVP Mode" — Attendees RSVP to confirm attendance
- "Performance Slots" — Performers claim individual time slots

#### 2. Public Event Detail Page (Mutual Exclusivity Enforced)

| File | Lines | Logic |
|------|-------|-------|
| `app/events/[id]/page.tsx` | 664-677 | RSVPSection shown only when `!has_timeslots` |
| `app/events/[id]/page.tsx` | 722-732 | TimeslotSection shown only when `has_timeslots` |

```tsx
// Line 664-677: RSVP only for non-timeslot events
{canRSVP && event.is_dsc_event && !(event as { has_timeslots?: boolean }).has_timeslots && (
  <RSVPSection ... />
)}

// Line 722-732: Timeslots only for timeslot events
{event.is_dsc_event && (event as { has_timeslots?: boolean }).has_timeslots && (
  <TimeslotSection ... />
)}
```

#### 3. hasSignupLane Helper (Phase 4.32)

| File | Lines | Purpose |
|------|-------|---------|
| `app/events/[id]/page.tsx` | 114-125 | Detects if event has a working signup lane |

```typescript
function hasSignupLane(event, timeslotCount): boolean {
  if (event.has_timeslots) {
    return timeslotCount > 0;  // Timeslot lane
  } else {
    return event.capacity !== null;  // RSVP lane
  }
}
```

**Key observation:** This function assumes exclusivity — it checks timeslots OR capacity, never both.

### Database Tables

| Table | Active Statuses | Purpose |
|-------|-----------------|---------|
| `event_rsvps` | `confirmed`, `waitlist`, `offered` | General attendance RSVP |
| `timeslot_claims` | `confirmed`, `offered`, `waitlist`, `performed` | Performance slot claims |

**Schema:** `migrations/20251209100001_dsc_events_rsvp_system.sql`, `migrations/20251216100001_timeslot_system.sql`

### Capacity Enforcement

| Lane | Enforcement Location | Logic |
|------|---------------------|-------|
| RSVP | `api/events/[id]/rsvp/route.ts:118-131` | Checks `confirmedCount >= event.capacity`, puts excess on waitlist |
| Timeslots | `migrations/...timeslot_system.sql:134-136` | Partial unique index allows only one active claim per slot |

**Cross-table check:** Currently NONE. RSVP and timeslot systems are completely independent.

### UI Surfaces Assuming Exclusivity

| Surface | File | Assumption |
|---------|------|------------|
| SlotConfigSection | `_components/SlotConfigSection.tsx` | Radio toggle (one or the other) |
| Event detail page | `app/events/[id]/page.tsx:264-290` | Counts attendance from one table based on `has_timeslots` |
| HappeningCard | `components/happenings/HappeningCard.tsx` | Shows capacity info based on single lane |
| Host dashboard | `dashboard/my-events/_components/MyEventsFilteredList.tsx` | RSVP counts only |

### Files That Would Need Changes (Goal A)

To support **both RSVP + Timeslots simultaneously**:

| File | Change Required |
|------|-----------------|
| `SlotConfigSection.tsx` | Add checkbox for "Also enable RSVP" |
| `api/my-events/route.ts:155` | Stop overwriting capacity when has_timeslots=true |
| `app/events/[id]/page.tsx:264-290` | Combine attendance from both tables |
| `app/events/[id]/page.tsx:664-677, 722-732` | Show both sections when both enabled |
| `hasSignupLane()` | Check both `capacity` AND `timeslotCount` |
| `api/events/[id]/rsvp/route.ts` | Allow RSVP even when has_timeslots=true |

### Minimal Viable UX Layout (Performers + Audience)

```
┌─────────────────────────────────────────────┐
│ Tonight's Lineup                            │
│ [TimeslotSection — performers claim slots]  │
├─────────────────────────────────────────────┤
│ Audience RSVP                               │
│ [RSVPSection — audience confirms attendance]│
│ "X of Y audience spots remaining"           │
└─────────────────────────────────────────────┘
```

### Risks (Goal A)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Double counting | Medium | Clear separation: timeslots=performers, RSVPs=audience |
| Conflicting badges | Low | Separate "X performers" vs "Y audience" display |
| Capacity confusion | Medium | Rename: `capacity` for audience, `total_slots` for performers |
| Migration complexity | Low | Additive change, no schema migration needed |

---

## Goal B: Seed/Import Source Contract

### Event Creation Codepaths

| Codepath | File | Source Value Set |
|----------|------|------------------|
| Host EventForm | `api/my-events/route.ts:195` | `source: "community"` (hardcoded) |

**Only one production codepath creates events:** The `POST /api/my-events` route.

No seed scripts, import scripts, or admin tools currently insert events directly into the database.

### Distinct Source Values

From test files and verification logic:

| Value | Meaning | Auto-Confirm? |
|-------|---------|---------------|
| `"community"` | Created by host via EventForm | Yes, on publish (line 199: `last_verified_at: publishedAt`) |
| `"import"` | Imported from external source | No, requires admin verification |
| `"admin"` | Created by admin directly | No, requires admin verification |

### Auto-Confirm on Publish Logic

| File | Line | Behavior |
|------|------|----------|
| `api/my-events/route.ts` | 195-199 | Sets `source: "community"` and `last_verified_at: publishedAt` |

```typescript
source: "community",
// Phase 4.42k A1b: Auto-confirm community events when published
// Set last_verified_at to mark as confirmed, but leave verified_by null
// (verified_by null means auto-confirmed, not admin-verified)
last_verified_at: publishedAt, // null for drafts, timestamp for published
```

**Logic:**
- Community events are auto-confirmed when `is_published = true`
- `last_verified_at` is set to `published_at` timestamp
- `verified_by` is left NULL to indicate auto-confirmation (not admin-verified)

### Verification State Helper

| File | Lines | Logic |
|------|-------|-------|
| `lib/events/verification.ts` | 44-72 | Purely based on `last_verified_at`, NOT `source` |

```typescript
// Rule 1: Cancelled events are always cancelled
if (event.status === "cancelled") return { state: "cancelled" };

// Rule 2: Confirmed if last_verified_at is set
if (event.last_verified_at !== null) return { state: "confirmed" };

// Rule 3: Everything else is unconfirmed (default state)
return { state: "unconfirmed" };
```

**Key finding:** The verification helper does NOT check `source`. It only checks `last_verified_at`.

### Source-Aware UI Copy

| File | Line | Usage |
|------|------|-------|
| `app/events/[id]/page.tsx` | 541 | Shows different copy for `source === "import"` |

```tsx
{(event as { source?: string }).source === "import" ? (
  <>This event was imported from an external source...</>
) : (
  <>This event is awaiting admin verification.</>
)}
```

### Current Import Pipeline Status

**There is no import pipeline currently implemented.**

The codebase has:
- No seed scripts that insert events
- No import scripts that insert events
- No admin tools that insert events directly

If an import pipeline is added in the future, it must:
1. Set `source: "import"` (not `"community"`)
2. Set `last_verified_at: null` (force admin verification)
3. Set `is_published: false` OR `is_published: true` with `last_verified_at: null`

### Recommendations for Source Contract Enforcement

| Option | Implementation | Pros | Cons |
|--------|----------------|------|------|
| A. Hardcoded source in importer | Set `source: "import"` in any future import script | Simple | Relies on developer discipline |
| B. Server-side validation | API rejects `source: "community"` from non-authenticated routes | Enforced | Requires API changes |
| C. Audit script | Periodic check for events with `source: "community"` but `host_id = null` | Detects drift | Reactive, not preventive |

**Recommendation:** Option A + C. Keep the current hardcoded approach, add an audit script for detection.

---

## Implementation Options

### Goal A: RSVP + Timeslots Coexist

#### Option 1: Add "Also Enable Audience RSVP" Checkbox (Recommended)

**Scope:**
- Add checkbox to SlotConfigSection: "Also enable audience RSVP"
- Preserve existing `has_timeslots` behavior
- Add new boolean: `has_audience_rsvp` (or reuse `capacity !== null`)
- Show both sections in event detail page

**Files:** ~6 files, ~100 lines changed

**Risk:** Low. Additive change, backward compatible.

#### Option 2: Separate Audience Capacity Field

**Scope:**
- Add `audience_capacity` column separate from `capacity`
- Update all capacity references
- Migration required

**Files:** ~15 files, ~300 lines changed

**Risk:** Medium. Migration required, more breaking changes.

#### Option 3: Do Nothing (Status Quo)

**Scope:** No changes. Events remain single-lane.

**Risk:** None. Users must create separate events for performers vs audience.

---

### Goal B: Source Contract Enforcement

#### Option 1: Document Contract + Audit Script (Recommended)

**Scope:**
- Add `scripts/audit-event-sources.ts` to detect drift
- Document source values in `docs/CONTRACTS.md`
- No code changes to API

**Files:** 2 new files

**Risk:** None.

#### Option 2: Server-Side Validation

**Scope:**
- Add middleware/validation that rejects `source: "community"` from admin routes
- Requires careful route design

**Files:** ~3 files

**Risk:** Low, but requires API restructuring.

#### Option 3: Database Constraint

**Scope:**
- Add trigger that validates `source` based on `host_id`
- `host_id IS NOT NULL` requires `source = 'community'`
- `host_id IS NULL` requires `source IN ('import', 'admin')`

**Files:** 1 migration

**Risk:** Medium. Requires migration, may block existing data.

---

## STOP — Awaiting Sami Approval

### Recommended Plan

**Goal A:** Option 1 — Add "Also Enable Audience RSVP" checkbox
- Minimal changes, backward compatible
- Clear separation: performers claim slots, audience RSVPs

**Goal B:** Option 1 — Document contract + audit script
- No API changes needed
- Audit script catches drift before it causes problems

---

## Draft Execution Prompt (DO NOT EXECUTE)

```
PHASE 4.43 EXECUTION — RSVP + TIMESLOTS COEXIST

Goal: Allow DSC events to have both performance slots AND audience RSVP.

Changes:

1. SlotConfigSection.tsx
   - Add "Also enable audience RSVP" checkbox below Performance Slots
   - When checked, event has both has_timeslots=true AND capacity != null

2. api/my-events/route.ts
   - Remove line 155 that overwrites capacity with total_slots
   - Keep both values separate

3. app/events/[id]/page.tsx
   - Show RSVPSection when capacity != null (regardless of has_timeslots)
   - Show TimeslotSection when has_timeslots = true
   - Update attendance counting to sum both tables

4. hasSignupLane()
   - Return true if EITHER timeslots exist OR capacity is set

5. docs/CONTRACTS.md
   - Add "Source Contract" section documenting source values
   - Document auto-confirm behavior for community events

6. scripts/audit-event-sources.ts
   - Script to detect source/host_id mismatches
   - Run: npx tsx scripts/audit-event-sources.ts

Tests to add:
- SlotConfigSection checkbox toggle
- Event detail page shows both sections
- RSVP API works when has_timeslots=true
- Attendance counting sums both tables
```

---

**END OF INVESTIGATION**

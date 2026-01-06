# Phase 4.43 Implementation Plan — RSVP + Timeslots Coexist + Attendee List

**Status:** AWAITING SAMI APPROVAL
**Date:** January 2026

---

## Critical Question Answered

**Q: Is RSVP "enabled by default when !has_timeslots" or is there an explicit RSVP flag?**

**A: RSVP is NOT explicitly flagged. It's IMPLIED by:**
- `is_dsc_event = true` (only DSC events have RSVP)
- `has_timeslots = false` (timeslots disabled)
- `capacity IS NOT NULL` (capacity must be set for RSVP to function)

**Evidence:**
- `app/events/[id]/page.tsx:664` — RSVPSection shown when `canRSVP && is_dsc_event && !has_timeslots`
- `app/events/[id]/page.tsx:114-123` — `hasSignupLane()` checks timeslots OR capacity, not both
- `SlotConfigSection.tsx:81-156` — Radio toggle enforces mutual exclusivity

---

## Investigation Findings Summary

### 1. Data Model

| Table | Active Statuses | Join to Profiles |
|-------|-----------------|------------------|
| `event_rsvps` | `confirmed`, `waitlist`, `offered` | `user_id` → `auth.users` (no direct profile join) |
| `timeslot_claims` | `confirmed`, `offered`, `waitlist`, `performed` | `member_id` → `profiles.id` |

**Key fields on `events`:**
- `has_timeslots: boolean` — Controls performer slots
- `capacity: number | null` — Controls RSVP capacity
- `total_slots: number | null` — Number of performer slots
- `is_dsc_event: boolean` — Only DSC events have RSVP/timeslots

### 2. Mutual Exclusivity Enforcement Points

| Location | File:Line | Behavior |
|----------|-----------|----------|
| Form toggle | `SlotConfigSection.tsx:49-63` | Radio button choice |
| Detail page RSVPSection | `app/events/[id]/page.tsx:664` | Shown only when `!has_timeslots` |
| Detail page TimeslotSection | `app/events/[id]/page.tsx:722` | Shown only when `has_timeslots` |
| API capacity overwrite | `api/my-events/route.ts:155` | Sets `capacity = total_slots` when `has_timeslots = true` |

### 3. Attendee Display

| Surface | Location | Current State |
|---------|----------|---------------|
| Public event detail | `app/events/[id]/page.tsx` | **NO attendee list shown** |
| Host dashboard | `dashboard/my-events/[id]/page.tsx:229` | RSVPList exists, shows names, NO profile links |

**RSVPList.tsx (lines 88-98)** shows attendee names but does NOT link to `/songwriters/{slug || id}`.

### 4. Seed/Import Source Contract

| Creation Path | Source Set | Verified At |
|---------------|------------|-------------|
| Host EventForm | `source: "community"` (hardcoded) | `api/my-events/route.ts:195` |
| Admin EventCreateForm | `source: null` → defaults to `'community'` | `admin/events/new/EventCreateForm.tsx:78-93` |
| Database default | `source: 'community'` | `migrations/20251227000001_phase3_scan_first_fields.sql:16` |

**Issue:** Admin-created events incorrectly get `source: 'community'` instead of `'admin'`.

### 5. Auto-Confirm Logic

| Condition | Result |
|-----------|--------|
| Community event published | `last_verified_at = published_at` (auto-confirmed) |
| Import/admin event | `last_verified_at = null` (unconfirmed until admin verifies) |

**Location:** `api/my-events/route.ts:196-199`

---

## Proposed Contract

### A. Signup Lanes (Independent)

| Field | Controls | Values |
|-------|----------|--------|
| `has_timeslots` | Performer signup lane | `true` = performers can claim slots |
| `capacity` | Audience RSVP lane | `number > 0` = audience can RSVP |

**Semantics:**
- `has_timeslots = true` AND `capacity = null` → Performers only (current behavior)
- `has_timeslots = false` AND `capacity = 50` → Audience RSVP only (current behavior)
- `has_timeslots = true` AND `capacity = 50` → **BOTH lanes** (new behavior)
- `has_timeslots = false` AND `capacity = null` → No signup (external signup URL only)

### B. No New Column Needed

Instead of adding `allow_audience_rsvp`, we reuse:
- `has_timeslots` for performer lane
- `capacity` for audience lane

**Rationale:** Simpler, no migration, already intuitive semantics.

### C. Source Values Contract

| Value | Meaning | Created By | Auto-Confirm? |
|-------|---------|------------|---------------|
| `community` | Host-created via EventForm | Authenticated hosts | Yes, on publish |
| `admin` | Admin-created via admin UI | Admins | No |
| `import` | Bulk imported | Scripts/migrations | No |

---

## Files to Edit

### Goal A: RSVP + Timeslots Coexist

| File | Lines | Change |
|------|-------|--------|
| `SlotConfigSection.tsx` | 49-63, 81-156 | Add checkbox "Also enable audience RSVP" below Performance Slots radio |
| `api/my-events/route.ts` | 155 | **Remove** `capacity: total_slots` overwrite when `has_timeslots = true` |
| `app/events/[id]/page.tsx` | 664 | Change `!has_timeslots` to `capacity !== null` |
| `app/events/[id]/page.tsx` | 264-290 | Count both RSVPs AND timeslot claims separately |
| `hasSignupLane()` | 114-123 | Return `true` if timeslots exist OR capacity is set |

### Goal D: Public Attendee List

| File | Lines | Change |
|------|-------|--------|
| `app/events/[id]/page.tsx` | ~730 | Add new `<AttendeeList>` section below TimeslotSection |
| `components/events/AttendeeList.tsx` | NEW | New component showing RSVP attendees with profile links |

### Goal B: Seed/Import Source Contract

| File | Lines | Change |
|------|-------|--------|
| `admin/events/new/EventCreateForm.tsx` | 78-93 | Add `source: "admin"` to insert |
| `admin/events/[id]/edit/EventEditForm.tsx` | TBD | Preserve existing `source` value |

### Goal C: Seeded Open Mics Conversion

| File | Change |
|------|--------|
| `scripts/convert-seeded-open-mics.ts` | NEW script to set `has_timeslots = false` for existing seeded events |

### Goal E: Deduplication

**Recommendation:** Show performers and audience in **separate sections**. Do NOT deduplicate across lists.

**Rationale:**
- A performer who RSVPs is both a performer AND an audience member
- Clear visual separation: "Tonight's Lineup" (performers) vs "Audience" (RSVPs)
- No double-counting in capacity since they're separate pools

---

## Migration Needed?

**No schema migration required.**

All changes use existing columns:
- `has_timeslots: boolean` (exists)
- `capacity: number | null` (exists)
- `source: text` (exists with default)

---

## Test Plan

### Route-Level Tests

| Test | File | Coverage |
|------|------|----------|
| RSVP API works when `has_timeslots = true` | `__tests__/rsvp-with-timeslots.test.ts` | API allows RSVP regardless of timeslot setting |
| Timeslot claims work when `capacity != null` | `__tests__/rsvp-with-timeslots.test.ts` | Timeslots work regardless of RSVP capacity |
| Both attendance counts appear | `__tests__/rsvp-with-timeslots.test.ts` | Detail page shows both performer/audience counts |

### Component Tests

| Test | File | Coverage |
|------|------|----------|
| SlotConfigSection shows checkbox | `SlotConfigSection.test.tsx` | Checkbox appears when Performance Slots selected |
| AttendeeList renders with profile links | `AttendeeList.test.tsx` | Names link to `/songwriters/{slug || id}` |
| Event detail shows both sections | `event-detail.test.tsx` | RSVPSection AND TimeslotSection both visible |

### Regression Tests

| Test | Coverage |
|------|----------|
| Legacy timeslot-only event | No RSVPSection when `capacity = null` |
| Legacy RSVP-only event | No TimeslotSection when `has_timeslots = false` |
| Seeded events remain unconfirmed | `source = import` + `last_verified_at = null` |

---

## Backfill/Migration Script Plan

### Script: `scripts/convert-seeded-open-mics.ts`

```typescript
// 1. Find all events with event_type = 'open_mic' AND (host_id IS NULL OR source IN ('import', 'admin'))
// 2. Update: has_timeslots = false, capacity = 50 (or null to disable RSVP)
// 3. Log changes for audit
```

**Guardrails:**
- Dry-run mode by default
- Explicit `--execute` flag required
- Audit log output

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Double counting | Low | Separate sections, separate counts |
| Privacy (attendee names public) | Low | Names already visible in timeslot claims; consistent behavior |
| Performance (extra queries) | Low | Existing queries, no N+1 |
| Notification spam | Medium | Notifications already dedupe by user_id |
| Breaking existing events | Low | Additive change, no existing data modified unless explicitly requested |

---

## Open Decisions for Sami

### 1. Default Audience Capacity for New Timeslot Events

When a host enables Performance Slots, should there be a default audience RSVP capacity?

- **Option A:** Default `capacity = null` (no audience RSVP unless explicitly set)
- **Option B:** Default `capacity = 50` (audience RSVP enabled by default)

**Recommendation:** Option A (explicit opt-in)

### 2. Seeded Open Mics: RSVP or Timeslots?

The prompt says "Seeded open mics should be RSVP events (not timeslots)." Confirm:

- **Option A:** Set `has_timeslots = false`, `capacity = 50` (RSVP-only)
- **Option B:** Set `has_timeslots = false`, `capacity = null` (no signup lane)
- **Option C:** Keep as-is (let admin manually configure)

**Recommendation:** Option A with dry-run first

### 3. Attendee Privacy on Public Page

Should the public attendee list be opt-in per event?

- **Option A:** Always show attendees (consistent with timeslot claims)
- **Option B:** Add `show_attendees: boolean` field
- **Option C:** Only show for DSC events, not community events

**Recommendation:** Option A (simpler, consistent)

---

## STOP — Awaiting Sami Approval

**Do not proceed with implementation until Sami approves:**
1. Proposed contract (capacity for audience, has_timeslots for performers)
2. Open decisions above
3. File edit list
4. Test plan

---

## Draft Execution Prompt (DO NOT EXECUTE)

```
PHASE 4.43 EXECUTION — RSVP + TIMESLOTS COEXIST

Approved contract:
- has_timeslots controls performer slots
- capacity controls audience RSVP (independent)
- Both can be enabled simultaneously

Implementation steps:

1. SlotConfigSection.tsx
   - Add "Also enable audience RSVP" checkbox
   - Checkbox visible only when Performance Slots is selected
   - When checked, preserve existing capacity (don't clear it)

2. api/my-events/route.ts:155
   - REMOVE line that overwrites capacity with total_slots
   - Keep both values independent

3. app/events/[id]/page.tsx
   - Line 664: Change condition to capacity !== null
   - Lines 264-290: Count RSVPs AND timeslot claims separately
   - Add AttendeeList component after TimeslotSection

4. components/events/AttendeeList.tsx (NEW)
   - Fetch RSVPs with profile joins
   - Render names linking to /songwriters/{slug || id}
   - Show "X confirmed" / "Y on waitlist"

5. admin/events/new/EventCreateForm.tsx
   - Add source: "admin" to insert payload

6. scripts/convert-seeded-open-mics.ts (NEW)
   - Dry-run mode by default
   - Update has_timeslots = false for seeded open mics
   - Optionally set capacity = 50

7. Add tests per test plan

Quality gates:
- npm run lint (0 errors)
- npm run test -- --run (all passing)
- npm run build (success)
- Manual smoke test on localhost
```

---

**END — Phase 4.43 Implementation Plan**

# Phase 4.37 Investigation: Seeded Event Verification + Status UX + Admin Controls

**Date:** 2026-01-05
**Status:** Investigation Complete — Awaiting Approval

---

## 1. Current State

### 1.1 Database Fields: events.status

**Allowed values (constraint):**
```sql
CHECK (status IN ('draft', 'active', 'needs_verification', 'unverified', 'inactive', 'cancelled'))
```
**Source:** `supabase/migrations/20251228_event_status_invariants.sql:74`

**Semantic meaning (from admin legend):**
| Status | UI Label | Meaning |
|--------|----------|---------|
| `active` | Active | Verified, visible on public page |
| `needs_verification` | Needs Verification | Imported, needs admin review |
| `unverified` | Unverified | Community-submitted, not yet checked |
| `inactive` | Inactive | Temporarily hidden |
| `cancelled` | Cancelled | Permanently closed |
| `draft` | Draft | Host-created, not yet published |

### 1.2 Verification Audit Fields

| Field | Type | Purpose | Who Writes |
|-------|------|---------|------------|
| `last_verified_at` | TIMESTAMPTZ | Timestamp of last admin verification | Admin only |
| `verified_by` | UUID FK profiles | Admin who verified | Admin only |
| `source` | TEXT | Data origin | Set at creation |

**`source` allowed values:** `community`, `venue`, `admin`, `import`
**Source:** `supabase/migrations/20251227000001_phase3_scan_first_fields.sql:38`

### 1.3 How "Seeded/Imported" Is Currently Determined

**Finding:** There is NO explicit `is_seeded` column. "Seeded" is inferred by:
1. `source = 'import'` — explicitly set for imported events
2. `host_id IS NULL` — unclaimed events (no owner)

The codebase uses `host_id === null` to determine if an event is claimable:
- **File:** `web/src/__tests__/event-claims.test.ts:42`

### 1.4 Write Paths

| Actor | Route/Component | Can Set Status | Can Set Verification Fields |
|-------|-----------------|----------------|----------------------------|
| **Admin** | `POST /api/admin/open-mics/[id]/status` | Yes (all values) | Yes (`last_verified_at`, `verified_by` when setting `active`) |
| **Admin** | Change reports approval | Yes | Yes |
| **Host** | `PATCH /api/my-events/[id]` | Limited (`active`, `cancelled`, `draft`) | No |
| **Host** | EventForm publish toggle | Sets `is_published` → triggers `status='active'` | No |

**Key finding:** When admin sets status to `active`, it automatically sets:
- `last_verified_at = now()`
- `verified_by = user.id`

**File:** `web/src/app/api/admin/open-mics/[id]/status/route.ts:103-105`

---

## 2. Current UI Surfaces

### 2.1 Card Badges (HappeningCard)

**File:** `web/src/components/happenings/HappeningCard.tsx:314,611-626`

**Current logic:**
```typescript
const showScheduleTBD = event.status === "needs_verification" || event.status === "unverified";
```

**Badge display:**
| Condition | Badge Text | Style |
|-----------|------------|-------|
| `isCancelled` | "CANCELLED" | Red |
| `showScheduleTBD` | "Schedule TBD" | Amber |
| `showEnded` (past + not TBD) | "Ended" | White/muted |

**Problem:** "Schedule TBD" conflates two different meanings:
1. Schedule is genuinely unknown (time/day TBD)
2. Event existence is unverified (we don't know if it's still happening)

### 2.2 Compact List Item Badges

**File:** `web/src/components/CompactListItem.tsx:11-16,123-138`

```typescript
const STATUS_STYLES = {
  cancelled: { bg: "bg-red-900/60", text: "text-red-300", label: "Cancelled" },
  unverified: { bg: "bg-amber-900/60", text: "text-amber-300", label: "Schedule TBD" },
  needs_verification: { bg: "bg-amber-900/60", text: "text-amber-300", label: "Schedule TBD" },
};
```

Shows verification date when available: `"✓ Verified {date}"`

### 2.3 Event Detail Page

**File:** `web/src/app/events/[id]/page.tsx:181,475-496`

```typescript
const needsVerification = event.status === "needs_verification";
```

**Current display:** Shows "Missing details" banner (about data completeness), but **NO verification/status block exists**.

### 2.4 Admin Status Table

**File:** `web/src/components/admin/OpenMicStatusTable.tsx`

Full admin UI with:
- Filter tabs: All | Active | Needs Review | Inactive/Cancelled
- Status dropdown with all values
- Quick actions: "Mark Active", "Needs Review"
- Last verified date column
- Notes column with audit trail

---

## 3. Problems to Fix

### 3.1 No "Happening (not confirmed)" State

**Current gap:** There's no explicit middle state between "Active/Verified" and "Cancelled".

The closest existing states are:
- `needs_verification` — "imported, needs review" (admin-facing)
- `unverified` — "community submitted" (admin-facing)

Both display as "Schedule TBD" in public UI, which is confusing because:
1. It conflates "schedule unknown" with "existence unverified"
2. Users can't tell if event is likely happening or just missing data

**Proposed mapping:**
| Desired State | Current DB Value | Problem |
|---------------|------------------|---------|
| Confirmed (happening) | `active` + `last_verified_at` | Works, but no visual indicator of verification |
| Happening (not confirmed) | `active` + no `last_verified_at` | Currently shows same as "verified" |
| Cancelled | `cancelled` | Works |

### 3.2 "Missing Details" vs "Not Verified" Collision

**Current state:** Two separate systems exist:
1. **Missing details** (`lib/events/missingDetails.ts`) — Data completeness (venue, cost, age policy)
2. **Verification status** (`status` + `last_verified_at`) — Trust/confirmation level

These are **correctly separate** in the code, but the **public UI conflates them**:
- `needs_verification`/`unverified` shows as "Schedule TBD" (sounds like missing data)
- Missing details banner is separate and clear

**Recommendation:** Keep them separate but clarify public-facing labels.

### 3.3 No Public Verification Display Block

**Current state:** Event detail page shows:
- Missing details banner (amber warning)
- NO "This event is confirmed/unconfirmed" block

**Need:** Prominent verification/status block at top of event detail page.

### 3.4 Submit Update Flow Doesn't Include Status Suggestions

**Current state:** `EventSuggestionForm.tsx` allows corrections to:
- Title, venue, schedule, cost, signup, age policy
- Does NOT include status suggestion (e.g., "I believe this event is cancelled")

**File:** `web/src/components/events/EventSuggestionForm.tsx` — No status field in form.

---

## 4. Proposed Minimal-Change Plan

### Option A: Reuse Existing Status Values (Recommended)

**Approach:** Map the three desired public states to existing fields without schema changes.

| Public State | DB Criteria | Card Badge | Detail Page Block |
|--------------|-------------|------------|-------------------|
| **Confirmed** | `status='active' AND last_verified_at IS NOT NULL` | ✓ (green) or no badge | "✓ Confirmed happening" (green) |
| **Happening (not confirmed)** | `status='active' AND last_verified_at IS NULL` | "Unconfirmed" (amber) | "Happening (not confirmed)" (amber) |
| **Cancelled** | `status='cancelled'` | "CANCELLED" (red) | "This event has been cancelled" (red) |

**For non-public states (admin-only visibility):**
| Status | Admin Meaning | Public Visibility |
|--------|---------------|-------------------|
| `draft` | Host not published | Not visible |
| `needs_verification` | Imported, needs review | Show as "Happening (not confirmed)" |
| `unverified` | Community-submitted | Show as "Happening (not confirmed)" |
| `inactive` | Temporarily hidden | Not visible |

**Implementation:**
1. Create helper: `getPublicVerificationState(event)` → `'confirmed' | 'unconfirmed' | 'cancelled'`
2. Update HappeningCard badge logic
3. Add verification block to event detail page
4. Update CompactListItem badge logic

**Pros:**
- No schema changes
- Uses existing `last_verified_at` as source of truth
- Admin workflow unchanged

**Cons:**
- `active` with no `last_verified_at` could be:
  - Host-published event (should be confirmed?)
  - Imported event never reviewed

### Option B: Add `verification_status` Column

**Approach:** Separate verification status from event lifecycle status.

**New column:**
```sql
ALTER TABLE events ADD COLUMN verification_status TEXT
  DEFAULT 'unconfirmed'
  CHECK (verification_status IN ('confirmed', 'unconfirmed', 'disputed'));
```

| Public State | `verification_status` | Card Badge | Detail Page Block |
|--------------|----------------------|------------|-------------------|
| **Confirmed** | `confirmed` | ✓ (green) | "✓ Confirmed" |
| **Happening (not confirmed)** | `unconfirmed` | "Unconfirmed" (amber) | "Happening (not confirmed)" |
| **Disputed** | `disputed` | "Status TBD" (amber) | "Status being verified" |

**Audit fields (already exist):**
- `last_verified_at`, `verified_by` — Reuse as-is

**Implementation:**
1. Migration: Add `verification_status` column
2. Backfill: Set `confirmed` where `last_verified_at IS NOT NULL`
3. Update admin UI to set verification_status
4. Update public UI to read verification_status
5. Add verification status to suggestion form

**Pros:**
- Clean separation of concerns
- Explicit state machine
- Easier to reason about

**Cons:**
- Schema change required
- Migration + backfill
- Two overlapping concepts (`status` vs `verification_status`)

---

## 5. Submit Update Flow: Status Suggestions

### Current Flow
1. User submits field changes via `EventSuggestionForm`
2. Goes to `event_update_suggestions` table
3. Admin reviews at `/dashboard/admin/event-update-suggestions`
4. Admin approves → changes applied manually or via API

### Proposed Addition
Add to EventSuggestionForm:
```typescript
// New field option
const STATUS_SUGGESTIONS = [
  { value: "", label: "No status change" },
  { value: "still_happening", label: "This event is still happening" },
  { value: "cancelled", label: "This event has been cancelled" },
  { value: "schedule_changed", label: "Schedule has changed" },
];
```

Store as field in existing `event_update_suggestions`:
- `field: "suggested_status"`
- `new_value: "cancelled"` (or "still_happening")

Admin review UI already handles field-based suggestions.

---

## 6. Hard Delete Feasibility

### Events: Dependency Table

| Child Table | FK Behavior | Safe to Hard Delete? |
|-------------|-------------|---------------------|
| `event_rsvps` | CASCADE | Yes, RSVPs deleted |
| `event_timeslots` | CASCADE | Yes, slots deleted |
| `timeslot_claims` | CASCADE (via timeslots) | Yes |
| `occurrence_overrides` | CASCADE | Yes |
| `event_claims` | CASCADE | Yes |
| `event_update_suggestions` | CASCADE | Yes |
| `change_reports` | CASCADE | Yes |
| `favorites` | CASCADE | Yes |
| `event_hosts` | CASCADE | Yes |
| `event_comments` | CASCADE | Yes |
| `guest_verifications` | CASCADE | Yes |
| `gallery_albums` | SET NULL | Safe, orphans album |
| `monthly_highlights` | SET NULL | Safe, removes highlight |

**Recommendation:** Hard delete is safe for events — all FKs use CASCADE or SET NULL.

### Venues: Dependency Table

| Child Table | FK Behavior | Safe to Hard Delete? |
|-------------|-------------|---------------------|
| `events.venue_id` | None (nullable) | Manual check needed |
| `gallery_albums` | SET NULL | Safe |
| `change_reports` | CASCADE | Yes |

**Recommendation:**
- Before venue hard delete: Check for events referencing it
- If events exist: Block delete or cascade-nullify venue_id
- Add admin confirmation: "X events reference this venue"

---

## 7. Edge Cases

### 7.1 Recurring Events
- Verification applies to the **series**, not individual occurrences
- `occurrence_overrides` can cancel specific dates without affecting series status
- Suggestion form doesn't distinguish occurrence vs series changes

### 7.2 Host-Published Events
- When host publishes: `status='active'`, `is_published=true`
- But `last_verified_at` stays NULL (unless admin later verifies)
- **Question:** Should host-published events auto-confirm?
  - **Recommendation:** No — hosts can publish unverified info. Keep manual admin verification.

### 7.3 Imported Events with Unknown Schedule
- Currently show "Schedule TBD" badge
- These may or may not be happening — we just don't know
- Should show "Happening (not confirmed)" with clear messaging

---

## 8. Phase Breakdown

### Phase 4.37.1: Public Verification State Helper + Card Badges
- Create `getPublicVerificationState()` helper
- Update HappeningCard badge to use new logic
- Update CompactListItem badge
- Tests for new logic

### Phase 4.37.2: Event Detail Verification Block
- Add prominent verification/status block to `/events/[id]/page.tsx`
- Show confirmed (green), unconfirmed (amber), or cancelled (red)
- Link to "Submit update" for unconfirmed events

### Phase 4.37.3: Status Suggestions in Update Flow
- Add status suggestion field to EventSuggestionForm
- Update admin review UI to handle status suggestions
- Email template for status change notifications

### Phase 4.37.4: Admin Controls Enhancement (Optional)
- Add "Verify Now" quick action in admin table
- Add "Hard Delete" button with dependency check
- Audit log viewer for verification history

---

## 9. Decisions Required

1. **Option A or B?**
   - A: Reuse existing fields (recommended, no schema change)
   - B: Add `verification_status` column (cleaner separation)

2. **Should host-published events auto-confirm?**
   - Recommended: No — require admin verification

3. **Card badge design:**
   - Show ✓ badge for confirmed events?
   - Or only show badges for non-normal states?

4. **Detail page verification block:**
   - Always visible?
   - Or only for unconfirmed/cancelled?

5. **Submit update: Status options**
   - Allow users to suggest "still happening" (positive confirmation)?
   - Or only "cancelled" / "schedule changed"?

---

## Appendix: File Locations

| Purpose | Path |
|---------|------|
| Status constraint | `supabase/migrations/20251228_event_status_invariants.sql` |
| Verification fields | `supabase/migrations/20251216000001_v030_verification_system.sql` |
| Admin status API | `web/src/app/api/admin/open-mics/[id]/status/route.ts` |
| Admin status table | `web/src/components/admin/OpenMicStatusTable.tsx` |
| HappeningCard | `web/src/components/happenings/HappeningCard.tsx` |
| CompactListItem | `web/src/components/CompactListItem.tsx` |
| Event detail page | `web/src/app/events/[id]/page.tsx` |
| Missing details | `web/src/lib/events/missingDetails.ts` |
| Suggestion form | `web/src/components/events/EventSuggestionForm.tsx` |
| Suggestion types | `web/src/types/eventUpdateSuggestion.ts` |

---

**Awaiting approval before implementation.**

# Phase ABC10+ Red-Team: Venues + Happenings + Occurrences End-to-End

**Status:** INVESTIGATION ONLY (Stop-Gate — Awaiting approval)
**Created:** January 2026
**Purpose:** End-to-end red-team of occurrence-aware flows, venue manager controls, and legacy cleanup

---

## Executive Summary

**Overall Assessment: PASS with minor issues**

The codebase is solid. Phase ABC6 (per-occurrence) and ABC9 (venue manager) implementations are well-executed. No P0 breakages found. A few P1/P2 issues identified for cleanup.

| Category | Issues Found |
|----------|--------------|
| P0 Breakage | 0 |
| P1 Incorrect Data | 1 |
| P2 Security/Auth Gap | 2 |
| P3 UX Confusion | 3 |
| P4 Polish | 2 |

---

## Section 1 — System Map (Verified)

### Public Flows

| Surface | Route | Occurrence Handling | Status |
|---------|-------|---------------------|--------|
| Happenings listing | `/happenings` | `expandAndGroupEvents()` with 90-day window | ✅ Correct |
| SeriesCard expansions | Component | Date pills link to `?date=YYYY-MM-DD` | ✅ Correct |
| Event detail | `/events/[id]?date=` | Validates date, fetches override, shows occurrence-specific data | ✅ Correct |
| Venue series view | `/venues/[id]` | Delegates to SeriesCard, proper grouping | ✅ Correct |

### Logged-in User Flows

| Surface | Route/Component | date_key Handling | Status |
|---------|-----------------|-------------------|--------|
| RSVP per date | `RSVPSection` → `/api/events/[id]/rsvp` | ✅ `date_key` required/computed | ✅ Correct |
| Comments per date | `EventComments` → `/api/events/[id]/comments` | ✅ `date_key` required/computed | ✅ Correct |
| Timeslot claim | `TimeslotSection` → `/api/guest/timeslot-claim/*` | ✅ `date_key` in verification record | ✅ Correct |
| My RSVPs page | `/dashboard/my-rsvps` | ✅ Filters/displays by `date_key` | ✅ Correct |

### Host Flows

| Surface | Route | date_key Handling | Status |
|---------|-------|-------------------|--------|
| Lineup control | `/events/[id]/lineup` | ✅ Date selector + filter by `date_key` | ✅ Correct |
| TV display | `/events/[id]/display` | ✅ Accepts `?date=`, filters by `date_key` | ✅ Correct |
| Host RSVP API | `/api/my-events/[id]/rsvps` | ✅ Requires `?date_key=` param | ✅ Correct |

### Venue Manager Flows

| Surface | Route | Authorization | Status |
|---------|-------|---------------|--------|
| Claim venue | `/api/venues/[id]/claim` | ✅ Auth + duplicate check | ✅ Correct |
| My venues list | `/dashboard/my-venues` | ✅ `venue_managers` query | ✅ Correct |
| Edit venue | `/dashboard/my-venues/[id]` → `PATCH /api/venues/[id]` | ✅ `isVenueManager() OR isAdmin()` | ✅ Correct |
| Relinquish access | `DELETE /api/my-venues/[id]` | ✅ Sole-owner protection | ✅ Correct |

### Admin Flows

| Surface | Route | Authorization | Status |
|---------|-------|---------------|--------|
| Admin venues table | `/dashboard/admin/venues` | ✅ Admin check | ✅ Correct |
| Venue claims queue | `/dashboard/admin/venue-claims` | ✅ Admin check | ✅ Correct |
| Admin venue detail | `/dashboard/admin/venues/[id]` | ✅ Admin check | ✅ Correct |
| Revoke manager | `DELETE /api/admin/venues/[id]/managers/[managerId]` | ✅ Admin check | ✅ Correct |
| Admin venue PATCH | `PATCH /api/admin/venues/[id]` | ✅ Admin check | ⚠️ See P2-A |

---

## Section 2 — Red-team: Correctness Invariants

### A) Occurrence Isolation (Core Invariant)

**Test:** User RSVPs to two dates of same recurring series → must show independently everywhere.

**Result: ✅ PASS**

| Component | Scoped by date_key? | Evidence |
|-----------|---------------------|----------|
| RSVP API (POST) | ✅ Yes | `validateDateKeyForWrite()` + INSERT with `date_key` |
| RSVP API (GET) | ✅ Yes | `.eq("date_key", effectiveDateKey)` |
| RSVP API (DELETE) | ✅ Yes | Filters by `date_key`, promotes waitlist for that date only |
| Comments API | ✅ Yes | Both GET and POST scope by `date_key` |
| Timeslots query | ✅ Yes | `.eq("date_key", dateKey)` in TimeslotSection |
| AttendeeList | ✅ Yes | `dateKey` prop passed, query filters |
| My RSVPs page | ✅ Yes | Queries filter/display by `date_key` |
| Host RSVPs API | ✅ Yes | Requires `?date_key=` param |

### B) Link Integrity

**Test:** All date pills / "Next" links must include `?date=` and resolve to correct occurrence.

**Result: ✅ PASS**

| Location | Link Pattern | Status |
|----------|--------------|--------|
| SeriesCard date pills | `/events/${slug}?date=${dateKey}` | ✅ Correct |
| Event detail date pills | `/events/${slug}?date=${occ.dateKey}` | ✅ Correct |
| Email links (RSVP confirmation) | `${baseUrl}/events/${slug}?date=${dateKey}#rsvp` | ✅ Correct |
| Email links (comment notification) | `${baseUrl}/events/${slug}?date=${dateKey}#comments` | ✅ Correct |
| Email links (timeslot claim) | `${baseUrl}/events/${slug}?date=${dateKey}#lineup` | ✅ Correct |

### C) Cancellation/Overrides

**Test:** Cancelled occurrence disables RSVP/claims/comments correctly.

**Result: ✅ PASS**

| Check | Status |
|-------|--------|
| `validateDateKeyForWrite()` checks override status | ✅ Returns error for cancelled dates |
| Event detail shows "CANCELLED" banner | ✅ Implemented |
| RSVP button disabled for cancelled dates | ✅ `{canRSVP && !isOccurrenceCancelled && ...}` |
| Override time/flyer displayed | ✅ `displayStartTime`, `displayCoverImage` from override |

### D) Security / AuthZ Gaps

**Test:** Confirm no route allows RSVP/comments/timeslots without date_key, or venue edits without proper auth.

**Result: ⚠️ Issues Found (see P2 below)**

---

## Section 3 — Legacy Cleanup Audit

### Files with event_rsvps/event_comments/event_timeslots queries

| File | date_key Usage | Status |
|------|----------------|--------|
| `/api/events/[id]/rsvp/route.ts` | ✅ All paths use date_key | Clean |
| `/api/guest/rsvp/*/route.ts` | ✅ Uses date_key from verification | Clean |
| `/api/events/[id]/comments/route.ts` | ✅ All paths use date_key | Clean |
| `/api/guest/event-comment/*/route.ts` | ✅ Uses date_key from verification | Clean |
| `/api/guest/timeslot-claim/*/route.ts` | ✅ Uses date_key from verification | Clean |
| `/api/my-events/[id]/rsvps/route.ts` | ✅ Requires date_key param | Clean |
| `/dashboard/my-rsvps/page.tsx` | ✅ Queries/displays by date_key | Clean |
| `/dashboard/my-events/page.tsx` | ✅ Uses effectiveDateKey | Clean |
| `AttendeeList.tsx` | ✅ Filters by dateKey prop | Clean |
| `waitlistOffer.ts` | ✅ Scoped by date_key | Clean |

### Legacy Routes WITHOUT date_key (ISSUES FOUND)

| File | Issue | Severity |
|------|-------|----------|
| `/api/guest/verify-code/route.ts` | Lines 153-166: Queries `event_timeslots` without date_key when checking one-guest-per-event | P1 |

**Details:** The legacy `/api/guest/verify-code` route queries all timeslots for an event without date scoping:
```typescript
const { data: eventTimeslots } = await supabase
  .from("event_timeslots")
  .select("id")
  .eq("event_id", verification.event_id);  // NO date_key filter!
```

This could allow a guest to be blocked from claiming a slot on Date B if they already have a claim on Date A of the same series.

### Stale UX Notices (Must Remove)

| File | Lines | Issue |
|------|-------|-------|
| `/events/[id]/page.tsx` | 973-979 | Says "Series RSVP" but RSVP is now per-occurrence |
| `/events/[id]/page.tsx` | 1049-1055 | Says "Series lineup" but timeslots are now per-occurrence |
| `/events/[id]/page.tsx` | 1149-1155 | Says "Series comments" but comments are now per-occurrence |

**These notices are factually incorrect** — the code passes `dateKey` to all components and APIs enforce per-occurrence scoping.

### Admin PATCH Conflict

| Route | Fields Allowed | Issue |
|-------|----------------|-------|
| `PATCH /api/venues/[id]` (manager) | 13 fields via `MANAGER_EDITABLE_VENUE_FIELDS` + sanitization | Correct |
| `PATCH /api/admin/venues/[id]` (admin) | 8 fields inline (name, address, city, state, zip, website_url, phone, google_maps_url) | **Missing fields!** |

**Issue:** Admin PATCH at `/api/admin/venues/[id]` is a different endpoint with FEWER editable fields than the manager PATCH. Admin should have MORE control, not less.

---

## Section 4 — UX Red-Team Checklist

### P3-A: Stale "Series-level" Notices (Confusing)

**Location:** `/events/[id]/page.tsx` lines 973-979, 1049-1055, 1149-1155

**Problem:** UI shows notices like "Your RSVP applies to all dates in this recurring series" but:
1. `RSVPSection` receives and uses `dateKey` prop
2. API enforces per-occurrence with `validateDateKeyForWrite()`
3. All queries filter by `date_key`

**User Confusion:** Users are told their RSVP is series-wide, but it's actually per-occurrence.

**Fix:** Remove all three "Series" notice blocks OR update copy to say "Your RSVP is for this specific date."

### P3-B: Claim Venue Button Visibility

**Location:** `ClaimVenueButton.tsx`

**Current Behavior:**
- Shows "You manage this venue" if `isAlreadyManager`
- Shows claim status if `existingClaim`
- Otherwise shows "Claim This Venue" button

**Issue:** If user is logged out, the button shows but leads nowhere useful (would fail on submit).

**Recommendation:** Add logged-out state: "Log in to claim this venue" with link to `/login?redirect=...`

### P3-C: Venue Edit Form No Client Validation

**Location:** `VenueEditForm.tsx`

**Issue:** Required fields (name, address, city, state) have `required` HTML attribute but no client-side error messages. Form just doesn't submit silently.

**Fix:** Add error state display for each required field.

### P4-A: Admin Invite Token UX

**Location:** Admin invite flow

**Issue:** When admin creates invite, token is shown once. No copy-to-clipboard button, no QR code, no email-to-invitee option.

**Recommendation:** Add clipboard copy button at minimum.

### P4-B: Revoke Manager Warning

**Location:** `VenueManagersList.tsx`

**Current:** Shows "Are you sure you want to revoke X's access to Y?"

**Issue:** No warning about what happens (they lose edit access, their pending changes would be lost, etc.)

**Recommendation:** Add brief explanation of consequences.

---

## Section 5 — Findings Summary

### P1 Incorrect Data

| ID | Issue | File | Fix |
|----|-------|------|-----|
| P1-A | Legacy `/api/guest/verify-code` doesn't scope one-guest-per-event check by date_key | `/api/guest/verify-code/route.ts:153-166` | Add `.eq("date_key", verification.date_key)` to timeslots query |

### P2 Security/Auth Gap

| ID | Issue | File | Fix |
|----|-------|------|-----|
| P2-A | Admin PATCH endpoint has FEWER fields than manager PATCH (8 vs 13) | `/api/admin/venues/[id]/route.ts:69-77` | Either deprecate admin endpoint and use manager endpoint, or expand field list |
| P2-B | `venue_invites` RLS allows any authenticated user to SELECT (potential enumeration) | Migration RLS policy | Change to admin-only SELECT, handle token lookup in API only |

### P3 UX Confusion

| ID | Issue | File | Fix |
|----|-------|------|-----|
| P3-A | Stale "Series RSVP/timeslots/comments" notices (incorrect) | `/events/[id]/page.tsx:973-979, 1049-1055, 1149-1155` | Remove all three notice blocks |
| P3-B | Claim venue button shows for logged-out users | `ClaimVenueButton.tsx` | Add logged-out state with login redirect |
| P3-C | Venue edit form silent validation | `VenueEditForm.tsx` | Add client-side error messages |

### P4 Polish

| ID | Issue | File | Fix |
|----|-------|------|-----|
| P4-A | No copy-to-clipboard for admin invite tokens | Admin invite UI | Add clipboard button |
| P4-B | Revoke manager lacks consequence explanation | `VenueManagersList.tsx` | Add brief warning text |

---

## Section 6 — Fix Plan

### Phase ABC10a: Audit + Revert (Confirmed)

**Recommendation:** Proceed with Option A from `phase-abc10-venue-audit-and-revert.md`

The existing `app_logs` + `opsAudit`/`moderationAudit` patterns are solid and reusable. Creating `venueAudit.ts` with before/after snapshots enables admin revert.

**Files to create/modify:**
- `lib/audit/venueAudit.ts` (new)
- `api/venues/[id]/route.ts` (add audit logging)
- `api/admin/venues/[id]/revert/route.ts` (new)
- `dashboard/admin/venues/[id]/_components/VenueEditHistory.tsx` (new)

**Estimated LOC:** ~200-300

### Phase ABC10b: P0/P1/P2 Fixes

| Item | Files | Diff | Tests |
|------|-------|------|-------|
| P1-A: Date-scope one-guest-per-event check | `/api/guest/verify-code/route.ts` | Add `.eq("date_key", verification.date_key)` ~5 lines | Update existing test |
| P2-A: Deprecate/unify admin venue PATCH | `/api/admin/venues/[id]/route.ts` | Either: (a) delete PATCH method and use manager endpoint, or (b) import `MANAGER_EDITABLE_VENUE_FIELDS` | Add redirect test |
| P3-A: Remove stale series notices | `/events/[id]/page.tsx` | Delete 3 blocks (~30 lines) | None |

### Phase ABC10c: Legacy Cleanup + UX Polish

| Item | Files | Diff | Tests |
|------|-------|------|-------|
| P3-B: Logged-out claim button | `ClaimVenueButton.tsx` | Add condition + login link ~15 lines | Add component test |
| P3-C: Form validation messages | `VenueEditForm.tsx` | Add error states ~20 lines | None |
| P4-A: Clipboard copy for invites | Admin invite UI | Add copy button ~10 lines | None |
| P4-B: Revoke warning text | `VenueManagersList.tsx` | Add warning paragraph ~5 lines | None |

---

## Smoke Checklist Updates

After implementing fixes:

- [ ] RSVP to recurring event Date A, RSVP to Date B → shows as 2 separate RSVPs in My RSVPs
- [ ] Guest claims slot on Date A → can still claim different slot on Date B
- [ ] Claim venue while logged out → see login prompt (not silent failure)
- [ ] Admin creates invite → can copy token to clipboard
- [ ] Admin revokes manager → warning text explains consequences
- [ ] Event detail for recurring event → NO "Series RSVP" / "Series lineup" / "Series comments" notices

---

## Decision Required

**STOP-GATE: Awaiting approval to proceed with:**

1. **Phase ABC10a:** Audit + Revert implementation (Option A)
2. **Phase ABC10b:** P1-A, P2-A, P3-A fixes
3. **Phase ABC10c:** Remaining UX polish

**Total estimated changes:**
- ~400 LOC new code
- ~50 LOC deletions
- 5 new test cases

---

**END OF DOCUMENT**

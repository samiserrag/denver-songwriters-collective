# Phase 5.10 — Signup Time Editing (Series + Per-Occurrence Overrides)

> **STOP-GATE Status:** WAITING FOR SAMI APPROVAL
>
> **Investigation Date:** 2026-01-29

---

## STOP-GATE 1: Investigation Output

### 1A. Surfaces Table

| Surface | File | Has signup_time Field? | Notes |
|---------|------|----------------------|-------|
| **Host Dashboard Create/Edit** | `dashboard/my-events/_components/EventForm.tsx` | ✅ YES | Time dropdown at line 2058-2062 |
| **Admin Event Edit** | `dashboard/admin/events/[id]/edit/EventEditForm.tsx` | ✅ YES | Time dropdown at line 242-254 |
| **Admin Event Create** | `dashboard/admin/events/new/EventCreateForm.tsx` | ✅ YES | Time dropdown at line 288-289 |
| **Occurrence Override Editor** | `dashboard/my-events/[id]/overrides/[dateKey]/page.tsx` | ❌ NO | Uses EventForm in occurrenceMode, but signup_time blocked |
| **Event Detail Page** | `app/events/[id]/page.tsx` | ✅ READ | Fetches from event, no override merge |
| **HappeningCard** | `components/happenings/HappeningCard.tsx` | ✅ READ | Uses `event.signup_time`, NO override merge |
| **SeriesCard** | `components/happenings/SeriesCard.tsx` | ✅ READ | Uses `event.signup_time` (series-level only) |

**Key Finding:** Contrary to BACKLOG.md stating "NOT IMPLEMENTED", all three main create/edit forms ALREADY have signup_time fields. The actual gap is:
1. `signup_time` is NOT in `ALLOWED_OVERRIDE_FIELDS` (occurrence overrides blocked)
2. Display surfaces do NOT merge `override_patch.signup_time`

---

### 1B. Current Storage Confirmation

**Series-Level Storage (events table):**
- Column: `signup_time TEXT` (nullable)
- Stores time in `HH:MM:SS` format (e.g., "19:00:00")
- Source: `lib/supabase/database.types.ts` lines 1151, 1220, 1289

**Occurrence Override Storage (occurrence_overrides table):**
- Column: `override_patch JSONB` (nullable)
- `signup_time` is **NOT** in the allowlist
- Source: `app/api/my-events/[id]/overrides/route.ts` lines 19-47
- Source: `lib/events/nextOccurrence.ts` lines 916-944

**Allowlist (currently missing signup_time):**
```typescript
const ALLOWED_OVERRIDE_FIELDS = new Set([
  "title", "description", "event_date", "start_time", "end_time",
  "venue_id", "location_mode", "custom_location_name", "custom_address",
  "custom_city", "custom_state", "online_url", "location_notes",
  "capacity", "has_timeslots", "total_slots", "slot_duration_minutes",
  "is_free", "cost_label", "signup_url", "signup_deadline",
  "age_policy", "external_url", "categories", "cover_image_url",
  "host_notes", "is_published",
]);
// NOTE: signup_time is MISSING
```

---

### 1C. Read-Path Confirmation

| Location | How signup_time is Fetched | Override Support |
|----------|---------------------------|------------------|
| Event Detail Page | `event.signup_time` at line 525 | ❌ NO |
| HappeningCard | `event.signup_time` at line 595 | ❌ NO |
| SeriesCard | `event.signup_time` at line 238 | N/A (series-level only) |
| getSignupMeta() | Receives `signupTime` param | N/A (display helper) |

**Current Precedence (Phase 5.08):**
```typescript
// lib/events/signupMeta.ts
1. If hasTimeslots === true → show "Online signup"
2. Else if signupTime exists → show "Signups at {time}"
3. Else → show nothing
```

**Gap:** No occurrence override consideration in any display path.

---

### 1D. Write-Path Confirmation

**Series-Level Write (works):**
- POST `/api/my-events` → `signup_time` in insert payload (line 205)
- PATCH `/api/my-events/[id]` → `signup_time` in allowedFields (line 154)

**Occurrence Override Write (blocked):**
- POST `/api/my-events/[id]/overrides` → `signup_time` NOT in ALLOWED_OVERRIDE_FIELDS
- Result: `signup_time` silently stripped by `sanitizeOverridePatch()`

---

### Proposed Minimal Data Representation

**Add `signup_time` to `ALLOWED_OVERRIDE_FIELDS`:**
- Location 1: `app/api/my-events/[id]/overrides/route.ts` line ~40
- Location 2: `lib/events/nextOccurrence.ts` line ~935 (keep in sync)

**Storage:** Use existing `override_patch` JSONB field (no migration needed)

**Read-Path Merge:**
1. HappeningCard: Add `const effectiveSignupTime = (patch?.signup_time as string | undefined) || event.signup_time`
2. Event Detail Page: Same pattern
3. Pass `effectiveSignupTime` to `getSignupMeta()`

---

### Risks & Edge Cases

| Risk | Mitigation |
|------|------------|
| Allowlist drift (route vs nextOccurrence.ts) | Both files must be updated together; add comment cross-referencing |
| Type safety | JSONB field requires runtime type assertion `as string \| undefined` |
| Series-level edit clears override | Expected behavior - series edit is distinct from per-occurrence override |
| has_timeslots override + signup_time override conflict | Phase 5.08 precedence already handles: timeslots wins always |

**Edge Case: Mixed-override scenario**
- Series has `signup_time = "18:00:00"`
- Occurrence override has `has_timeslots = true`
- Result: "Online signup" shown (timeslots wins per precedence rule)
- This is correct behavior.

---

## STOP-GATE 2: Implementation Plan

### Phase 5.10a — Add signup_time to Override Allowlist

**Files to Modify:**

| File | Change |
|------|--------|
| `app/api/my-events/[id]/overrides/route.ts` | Add `"signup_time"` to ALLOWED_OVERRIDE_FIELDS |
| `lib/events/nextOccurrence.ts` | Add `"signup_time"` to ALLOWED_OVERRIDE_FIELDS |

**No migration needed** — uses existing override_patch JSONB.

---

### Phase 5.10b — Display Merge in HappeningCard

**File:** `components/happenings/HappeningCard.tsx`

**Changes:**
1. Add effective signup_time computation (line ~394):
   ```typescript
   const effectiveSignupTime = (patch?.signup_time as string | undefined) || event.signup_time;
   ```
2. Update getSignupMeta call (line ~595):
   ```typescript
   const signupMeta = getSignupMeta({
     hasTimeslots: effectiveHasTimeslots,
     signupTime: effectiveSignupTime,  // was: event.signup_time
   });
   ```

---

### Phase 5.10c — Display Merge in Event Detail Page

**File:** `app/events/[id]/page.tsx`

**Changes:**
1. Check if occurrence override exists for selected date (already fetched)
2. Merge `override_patch.signup_time` if present:
   ```typescript
   const overridePatch = currentOverride?.override_patch as Record<string, unknown> | null;
   const effectiveSignupTime = (overridePatch?.signup_time as string | undefined)
     || (event as { signup_time?: string | null }).signup_time;

   const signupMeta = getSignupMeta({
     hasTimeslots: event.has_timeslots, // Note: should also check override
     signupTime: effectiveSignupTime,
   });
   ```

**Additional consideration:** The event detail page should also respect `override_patch.has_timeslots` for full consistency. This is a separate gap but related.

---

### Phase 5.10d — Tests

**Test File:** `__tests__/phase5-10-signup-time-override.test.ts`

**Test Cases:**
1. Allowlist includes signup_time (both locations)
2. Override signup_time sanitized correctly (included, not stripped)
3. HappeningCard uses override signup_time when present
4. HappeningCard falls back to series signup_time when no override
5. Event detail page uses override signup_time when present
6. has_timeslots override takes precedence over signup_time override
7. Series-level signup_time + occurrence has_timeslots=true → "Online signup"

---

### Phase 5.10e — Documentation Update

**File:** `CLAUDE.md`

Add to Recent Changes section documenting:
- signup_time added to ALLOWED_OVERRIDE_FIELDS
- Display merge in HappeningCard and event detail
- Precedence rules unchanged (timeslots > signup_time)

---

## Work Items Summary

| Item | Description | Risk |
|------|-------------|------|
| 5.10a | Add signup_time to override allowlists (2 files) | Low - additive |
| 5.10b | HappeningCard override merge | Low - follows existing pattern |
| 5.10c | Event detail override merge | Low - follows existing pattern |
| 5.10d | Tests | Low |
| 5.10e | Documentation | Low |

**Estimated test count:** ~10 new tests

---

## Precedence Rules (Confirmed Unchanged)

Display priority (highest to lowest):
1. `has_timeslots === true` → "Online signup"
2. Occurrence override `signup_time` → "Signups at {time}"
3. Series-level `signup_time` → "Signups at {time}"
4. Neither → show nothing

---

## WAITING FOR SAMI APPROVAL

**Next Steps After Approval:**
1. Execute Phase 5.10a-e in order
2. Run full test suite
3. Run lint and build
4. Commit with detailed message
5. Push to main

---

*Investigation complete. No code executed. Awaiting approval.*

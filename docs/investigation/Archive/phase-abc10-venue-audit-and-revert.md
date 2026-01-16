# Phase ABC10: Venue Audit Trail + Admin Revert + Merge Hardening

**Status:** INVESTIGATION ONLY (Stop-Gate B — Awaiting approval)
**Created:** January 2026
**Purpose:** Bulletproof venue edits with audit logging, admin revert, and verified merge safety

---

## Executive Summary

ABC9 enabled venue managers to edit venue details via field-level allowlisting. Two risks remain:

1. **Vandalism risk:** A bad-actor manager could change venue details (wrong address, offensive content). Without audit logging, admins can't see what changed or restore previous values.

2. **Merge data loss:** ABC8 added 3 new tables (`venue_managers`, `venue_claims`, `venue_invites`) that CASCADE on venue delete. The ABC3 merge procedure was updated but should be verified exhaustively.

This investigation proposes minimal solutions for both.

---

## A. Audit Logging Reality Check

### Current State

| Mechanism | Location | Storage | Retention | Venue Edit Coverage |
|-----------|----------|---------|-----------|---------------------|
| `opsAudit.ts` | `lib/audit/opsAudit.ts` | `app_logs` table | Indefinite | ❌ No (CSV bulk ops only) |
| `moderationAudit.ts` | `lib/audit/moderationAudit.ts` | `app_logs` table | Indefinite | ❌ No (gallery moderation only) |
| Console logging | `api/venues/[id]/route.ts:158` | Server logs | ~7 days (Vercel) | ⚠️ Partial (action logged, no field values) |
| `app_logs` table | Supabase | PostgreSQL | Indefinite | ✅ Available for venue edits |

**Current venue PATCH logging (line 158):**
```typescript
console.log(
  `[VenueAPI] Venue ${venueId} updated by ${isAdmin ? "admin" : "manager"} ${user.id}. Fields: ${Object.keys(updates).join(", ")}`
);
```

This logs WHAT changed but not the BEFORE/AFTER values, making revert impossible.

### Proposed Solution: `venueAudit.ts`

Create a new audit logger following the existing pattern:

```typescript
// lib/audit/venueAudit.ts
type VenueAuditAction =
  | "venue_edited"
  | "venue_edit_reverted";

interface VenueAuditContext {
  venueId: string;
  venueName?: string;
  updatedFields: string[];
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  actorRole: "manager" | "admin";
}
```

**Key design decisions:**

1. **Snapshot before/after:** Store previous values in `context.previousValues` to enable revert
2. **Reuse `app_logs`:** No new table needed — existing schema supports JSON context
3. **`source: "venue_audit"`:** Filter by source for venue-specific log queries

### `app_logs` Schema (Existing)

```typescript
// From database.types.ts
app_logs: {
  Row: {
    id: string
    level: string           // "info" | "warn" | "error"
    message: string         // "Venue: venue_edited"
    context: Json | null    // { venueId, previousValues, newValues, ... }
    user_id: string | null  // Actor who made the change
    source: string | null   // "venue_audit"
    created_at: string | null
    // ... other fields
  }
}
```

### Implementation Changes

**File: `api/venues/[id]/route.ts`**

Before the update, fetch current values for all fields being changed:
```typescript
// 1. Fetch current values for audit
const { data: currentVenue } = await serviceClient
  .from("venues")
  .select(MANAGER_EDITABLE_VENUE_FIELDS.join(", "))
  .eq("id", venueId)
  .single();

// 2. Build previousValues for only the fields being updated
const previousValues: Record<string, unknown> = {};
for (const key of Object.keys(updates)) {
  previousValues[key] = currentVenue[key];
}

// 3. Perform update...

// 4. Log to app_logs with before/after
await venueAudit.venueEdited(user.id, {
  venueId,
  venueName: currentVenue.name,
  updatedFields: Object.keys(updates),
  previousValues,
  newValues: updates,
  actorRole: isAdmin ? "admin" : "manager",
});
```

---

## B. Admin Revert Design

### Requirements

- Admin can view edit history for a venue
- Admin can revert to a previous snapshot (restore one or more fields)
- Revert is itself logged as an audit action

### Proposed UI

**Location:** `/dashboard/admin/venues/[id]` (existing page)

**New section: "Edit History"**

```
┌─────────────────────────────────────────────────────────────┐
│ Edit History                                                │
├─────────────────────────────────────────────────────────────┤
│ Jan 12, 2026 3:45pm — Manager Jane Doe                      │
│   Changed: name, address                                    │
│   name: "Brewery Rickoli" → "HACKED VENUE NAME"             │
│   address: "123 Main St" → "wrong address lol"              │
│   [Revert This Edit]                                        │
├─────────────────────────────────────────────────────────────┤
│ Jan 11, 2026 2:30pm — Admin Sami Serrag                     │
│   Changed: google_maps_url                                  │
│   google_maps_url: null → "https://maps.google.com/..."     │
│   [Revert This Edit]                                        │
└─────────────────────────────────────────────────────────────┘
```

### Revert API

**Endpoint:** `POST /api/admin/venues/[id]/revert`

**Request:**
```json
{
  "logId": "uuid-of-audit-log-entry",
  "fieldsToRevert": ["name", "address"]  // Optional - defaults to all
}
```

**Behavior:**
1. Fetch the audit log entry
2. Validate admin authorization
3. Extract `previousValues` from log context
4. Apply PATCH with previous values (using same sanitize logic)
5. Log the revert as `venue_edit_reverted`

### Complexity Assessment

| Component | Complexity | Notes |
|-----------|------------|-------|
| `venueAudit.ts` | Low | Copy from opsAudit.ts pattern |
| PATCH route changes | Low | Add ~20 lines for before-snapshot |
| Edit History UI | Medium | Query app_logs, display diffs |
| Revert API | Low | ~50 lines, reuses sanitize |

**Total estimate:** ~200 lines of new code

---

## C. Merge Hardening Verification

### Tables Referencing `venues.id`

| Table | FK Field | FK Behavior | In ABC3 Doc? | Merge Handling |
|-------|----------|-------------|--------------|----------------|
| `events` | `venue_id` | SET NULL | ✅ Yes | UPDATE to canonical |
| `gallery_albums` | `venue_id` | SET NULL | ✅ Yes | UPDATE to canonical |
| `gallery_images` | `venue_id` | SET NULL | ✅ Yes | UPDATE to canonical |
| `monthly_highlights` | `venue_id` | SET NULL | ✅ Yes | UPDATE to canonical |
| `venue_managers` | `venue_id` | CASCADE | ✅ Yes | Transfer or revoke |
| `venue_claims` | `venue_id` | CASCADE | ✅ Yes | Cancel pending |
| `venue_invites` | `venue_id` | CASCADE | ✅ Yes | Revoke active |

### Verification: ABC3 Coverage

The ABC3 merge procedure (updated during ABC9) includes all 7 tables:

**Step 4a (Repoint/Transfer):**
- ✅ `events` — UPDATE to canonical
- ✅ `gallery_albums` — UPDATE to canonical
- ✅ `gallery_images` — UPDATE to canonical
- ✅ `monthly_highlights` — UPDATE to canonical
- ✅ `venue_managers` — Transfer (avoiding UNIQUE conflict) or revoke
- ✅ `venue_claims` — Cancel pending claims
- ✅ `venue_invites` — Revoke active invites

**Step 4b (Verify):**
- ✅ All 7 tables checked for remaining references

### Edge Cases

| Scenario | Current Handling | Status |
|----------|------------------|--------|
| User manages both venues | Revoke duplicate grant | ✅ Covered |
| Pending claim on duplicate | Cancel claim | ✅ Covered |
| Active invite on duplicate | Revoke invite | ✅ Covered |
| Historical (revoked) managers | CASCADE deletes them | ⚠️ Acceptable (historical data loss) |
| Historical claims/invites | CASCADE deletes them | ⚠️ Acceptable (historical data loss) |

**Note:** Historical records (revoked managers, rejected claims) are deleted on venue CASCADE. This is acceptable because:
1. They serve no active purpose
2. The app_logs audit trail preserves moderation history
3. No user-facing feature relies on historical venue ownership data

### Recommendation

**No changes needed.** ABC3 doc is current and comprehensive for ABC8 tables.

---

## D. Acceptance Criteria

### ABC10-A: Audit Logging

- [ ] `lib/audit/venueAudit.ts` exists with `venueEdited` and `venueEditReverted` functions
- [ ] PATCH `/api/venues/[id]` logs to `app_logs` with `previousValues` and `newValues`
- [ ] Logs include: `venueId`, `venueName`, `updatedFields`, `previousValues`, `newValues`, `actorRole`
- [ ] Unit tests verify audit context structure

### ABC10-B: Admin Revert

- [ ] Admin venue detail page shows "Edit History" section
- [ ] Each history entry shows date, actor, fields changed, before/after values
- [ ] "Revert This Edit" button restores `previousValues`
- [ ] Revert itself is logged as `venue_edit_reverted`
- [ ] Non-admins cannot access revert functionality

### ABC10-C: Merge Verification (Already Complete)

- [x] ABC3 doc covers all 7 FK tables
- [x] `venue_managers` transfer handles UNIQUE conflict
- [x] `venue_claims` cancellation documented
- [x] `venue_invites` revocation documented
- [x] Verify query checks all 7 tables

---

## E. Implementation Plan

| Step | Description | Files | Risk |
|------|-------------|-------|------|
| 1 | Create `venueAudit.ts` | `lib/audit/venueAudit.ts` | Low |
| 2 | Add before-snapshot to PATCH | `api/venues/[id]/route.ts` | Low |
| 3 | Add Edit History UI | `admin/venues/[id]/_components/` | Medium |
| 4 | Create Revert API | `api/admin/venues/[id]/revert/route.ts` | Low |
| 5 | Add tests | `__tests__/phase-abc10-*.test.ts` | Low |

**Estimated LOC:** ~200-300

**Dependencies:** None (uses existing `app_logs` table)

---

## F. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Audit logging fails silently | Low | Low | Same pattern as opsAudit (console fallback) |
| Large context JSON | Low | Low | Only changed fields logged, not full snapshot |
| Revert to malicious data | Low | Medium | Revert is admin-only, logged |

---

## G. Decision Required

**Option A: Full Implementation (Recommended)**
- Implement A + B (audit logging + revert UI)
- ~200-300 LOC
- Provides complete vandalism protection

**Option B: Audit Only**
- Implement A only (audit logging)
- ~100 LOC
- Admin can query `app_logs` directly to find previous values
- No UI for revert (manual SQL restoration)

**Option C: Defer**
- No implementation
- Accept risk that vandalism requires database restore
- Revisit if actual vandalism occurs

---

**STOP-GATE B: Awaiting approval to proceed with implementation.**

---

**END OF DOCUMENT**

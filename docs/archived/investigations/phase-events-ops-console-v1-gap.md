# Investigation: Events Ops Console v1 + Occurrence Overrides CSV v1 Gap Analysis

**Status:** COMPLETE
**Date:** 2026-01-12
**Investigator:** Repo Agent

---

## Goal

Determine what is already implemented on `main` vs what remains for the backlog item "Events Ops Console v1 (Series + One-offs) + Occurrence Overrides CSV v1".

---

## 1. Existing Implementation (Verified on Main)

### 1.1 Events Ops Console

| Component | Path | Status |
|-----------|------|--------|
| **Page** | `web/src/app/(protected)/dashboard/admin/ops/events/page.tsx` | ✅ Exists |
| **Export Card** | `web/src/app/(protected)/dashboard/admin/ops/events/_components/EventExportCard.tsx` | ✅ Exists |
| **Import Card** | `web/src/app/(protected)/dashboard/admin/ops/events/_components/EventImportCard.tsx` | ✅ Exists |
| **Diff Table** | `web/src/app/(protected)/dashboard/admin/ops/events/_components/EventDiffTable.tsx` | ✅ Exists |
| **Bulk Verify Card** | `web/src/app/(protected)/dashboard/admin/ops/events/_components/BulkVerifyCard.tsx` | ✅ Exists |

**API Routes:**

| Route | Path | Status |
|-------|------|--------|
| Export | `web/src/app/api/admin/ops/events/export/route.ts` | ✅ Exists |
| Preview | `web/src/app/api/admin/ops/events/preview/route.ts` | ✅ Exists |
| Apply | `web/src/app/api/admin/ops/events/apply/route.ts` | ✅ Exists |
| Bulk Verify | `web/src/app/api/admin/ops/events/bulk-verify/route.ts` | ✅ Exists |

**Library Code:**

| File | Path | Status |
|------|------|--------|
| CSV Parser | `web/src/lib/ops/eventCsvParser.ts` | ✅ Exists |
| Validation | `web/src/lib/ops/eventValidation.ts` | ✅ Exists |
| Diff Logic | `web/src/lib/ops/eventDiff.ts` | ✅ Exists |

### 1.2 Occurrence Overrides Ops Console

| Component | Path | Status |
|-----------|------|--------|
| **Page** | `web/src/app/(protected)/dashboard/admin/ops/overrides/page.tsx` | ✅ Exists |
| **Export Card** | `web/src/app/(protected)/dashboard/admin/ops/overrides/_components/OverrideExportCard.tsx` | ✅ Exists |
| **Import Card** | `web/src/app/(protected)/dashboard/admin/ops/overrides/_components/OverrideImportCard.tsx` | ✅ Exists |
| **Diff Table** | `web/src/app/(protected)/dashboard/admin/ops/overrides/_components/OverrideDiffTable.tsx` | ✅ Exists |

**API Routes:**

| Route | Path | Status |
|-------|------|--------|
| Export | `web/src/app/api/admin/ops/overrides/export/route.ts` | ✅ Exists |
| Preview | `web/src/app/api/admin/ops/overrides/preview/route.ts` | ✅ Exists |
| Apply | `web/src/app/api/admin/ops/overrides/apply/route.ts` | ✅ Exists |

**Library Code:**

| File | Path | Status |
|------|------|--------|
| CSV Parser | `web/src/lib/ops/overrideCsvParser.ts` | ✅ Exists |
| Validation | `web/src/lib/ops/overrideValidation.ts` | ✅ Exists |
| Diff Logic | `web/src/lib/ops/overrideDiff.ts` | ✅ Exists |

---

## 2. Backlog Requirements vs Implementation

**Source:** `docs/OPS_BACKLOG.md` lines 7-16

| Backlog Requirement | Implemented | Evidence |
|---------------------|-------------|----------|
| Events CSV export/import | ✅ Yes | `eventCsvParser.ts`, export/preview/apply routes |
| Update-only (no event creation via CSV) | ✅ Yes | `eventCsvParser.ts:6` comment + `apply/route.ts` only updates existing IDs |
| No verification timestamps in CSV | ✅ Yes | `EVENT_CSV_HEADERS` (line 53-66) excludes `last_verified_at`/`verified_by` |
| Overrides CSV export/import | ✅ Yes | `overrideCsvParser.ts`, export/preview/apply routes |
| Overrides upsert (create-or-update) | ✅ Yes | `overrideDiff.ts` + `apply/route.ts:151-173` handles inserts + updates |
| Bulk verify action | ✅ Yes | `BulkVerifyCard.tsx` + `/api/admin/ops/events/bulk-verify` |
| Bulk unverify action | ✅ Yes | Same endpoint, `action: "unverify"` |
| Bulk status change | ❌ No | Not implemented - CSV only, no UI bulk action |
| Bulk event_type change | ❌ No | Not implemented - CSV only, no UI bulk action |
| Bulk venue_id change | ❌ No | Not implemented - CSV only, no UI bulk action |
| Verification via UI only (not CSV) | ✅ Yes | CSV schema excludes verification fields; BulkVerifyCard is UI-only |

---

## 3. Events CSV Schema (Verified)

**File:** `web/src/lib/ops/eventCsvParser.ts:53-66`

```typescript
export const EVENT_CSV_HEADERS = [
  "id",
  "title",
  "event_type",
  "status",
  "is_recurring",
  "event_date",
  "day_of_week",
  "start_time",
  "end_time",
  "venue_id",
  "is_published",
  "notes",  // maps to host_notes in DB
] as const;
```

**Guardrail Verified:** No `last_verified_at` or `verified_by` columns in CSV schema.

---

## 4. Overrides CSV Schema (Verified)

**File:** `web/src/lib/ops/overrideCsvParser.ts:44-51`

```typescript
export const OVERRIDE_CSV_HEADERS = [
  "event_id",
  "date_key",
  "status",
  "override_start_time",
  "override_notes",
  "override_cover_image_url",
] as const;
```

**Composite Key:** `(event_id, date_key)` for upsert matching (`getOverrideCompositeKey()` at line 216).

---

## 5. Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `ops-event-csv.test.ts` | 21 | CSV parsing |
| `ops-event-validation.test.ts` | 26 | Row validation |
| `ops-event-diff.test.ts` | 15 | Diff computation |
| `ops-override-csv.test.ts` | 36 | Override CSV/validation/diff |

**Total:** 98 tests for Events + Overrides Ops Console.

---

## 6. Gap Analysis Summary

### Implemented (No Action Needed)

| Feature | Status |
|---------|--------|
| Events CSV export | ✅ Complete |
| Events CSV import with preview/diff | ✅ Complete |
| Events update-only constraint | ✅ Complete |
| Verification excluded from CSV | ✅ Complete |
| Bulk verify/unverify via UI | ✅ Complete |
| Overrides CSV export | ✅ Complete |
| Overrides CSV import with upsert | ✅ Complete |

### Missing (Backlog Mentions But Not Implemented)

| Feature | Backlog Mention | Status |
|---------|-----------------|--------|
| Bulk status change UI | "Bulk actions: verify, unverify, **status**" | ❌ Not implemented |
| Bulk event_type change UI | "Bulk actions: ... **event_type**" | ❌ Not implemented |
| Bulk venue_id change UI | "Bulk actions: ... **venue_id**" | ❌ Not implemented |

**Note:** These bulk actions can currently be done via CSV import (change field values in CSV, upload, apply). The backlog may have intended dedicated UI buttons for these actions.

---

## 7. Coupling Risks

### 7.1 date_key / Per-Occurrence Invariants

- Overrides CSV uses `date_key` (YYYY-MM-DD format)
- Validation enforces date format via regex: `/^\d{4}-\d{2}-\d{2}$/`
- Composite key `(event_id, date_key)` ensures one override per occurrence
- **Risk:** Low - existing implementation respects per-occurrence model

### 7.2 Seeded vs User-Created Events

- Events CSV is update-only (requires existing event IDs)
- No `source` column in CSV schema
- Seeded events can be updated same as user-created
- **Risk:** Low - no distinction needed for bulk ops

### 7.3 RLS / Admin-Only Surfaces

- All routes use `checkAdminRole()` before processing
- Service role client used for DB operations (bypasses RLS)
- **Risk:** Low - admin gate is enforced

### 7.4 Rollback Plan

- Events CSV: Re-export current state before import → re-import original if needed
- Overrides CSV: Same approach
- Audit logging via `opsAudit` records all apply actions with row counts
- **Risk:** Medium - no automatic rollback, but manual recovery is possible

---

## 8. Conclusion

**The "Events Ops Console v1 + Occurrence Overrides CSV v1" backlog item is COMPLETE.**

All core features are implemented:
- Events CSV export/import (update-only)
- Overrides CSV export/import (upsert)
- Bulk verify/unverify via UI
- Verification excluded from CSV (UI-only)

**The only gap** is dedicated UI buttons for bulk status/event_type/venue_id changes. However, these can be accomplished via CSV import, which is the primary workflow for bulk operations.

**Recommendation:** Mark the backlog item as "Completed" and move any desired UI bulk action buttons to a future enhancement.

---

## 9. Files Referenced

| Category | Files |
|----------|-------|
| Pages | `dashboard/admin/ops/events/page.tsx`, `dashboard/admin/ops/overrides/page.tsx` |
| Components | `EventExportCard.tsx`, `EventImportCard.tsx`, `EventDiffTable.tsx`, `BulkVerifyCard.tsx`, `OverrideExportCard.tsx`, `OverrideImportCard.tsx`, `OverrideDiffTable.tsx` |
| API Routes | `events/export`, `events/preview`, `events/apply`, `events/bulk-verify`, `overrides/export`, `overrides/preview`, `overrides/apply` |
| Library | `eventCsvParser.ts`, `eventValidation.ts`, `eventDiff.ts`, `overrideCsvParser.ts`, `overrideValidation.ts`, `overrideDiff.ts` |
| Tests | `ops-event-csv.test.ts`, `ops-event-validation.test.ts`, `ops-event-diff.test.ts`, `ops-override-csv.test.ts` |

---

**END — Investigation Complete**

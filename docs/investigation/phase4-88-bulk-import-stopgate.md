# Phase 4.88: Bulk Event Import — STOP-GATE Investigation

**Date:** 2026-01-26
**Status:** STOP-GATE 1 — Investigation complete, awaiting approval
**Scope:** Investigation + Plan only (no code changes, no commits, no migrations)

---

## 1. Executive Summary

This document defines the contract for bulk event import/seeding in DSC. The system must support importing events from external sources (spreadsheets, other platforms) while maintaining data integrity, recurrence invariants, and verification status rules.

**Key Decisions Required:**
1. CSV-only for v1 (no JSON, no API endpoint)
2. INSERT-only vs INSERT+UPDATE (recommendation: INSERT-only with merge review)
3. Deferred creation of RSVPs/timeslots during import (post-import via normal flow)
4. Strict recurrence invariant enforcement (reject invalid rows)

---

## 2. Existing Import/Seed Pathways Inventory

### 2.1 Current Entry Points

| Pathway | Type | Location | Status |
|---------|------|----------|--------|
| EventForm (create) | UI | `POST /api/my-events` | Active - single/weekly/monthly/custom modes |
| EventForm (edit) | UI | `PATCH /api/my-events/[id]` | Active - update existing |
| Ops Console (CSV update) | Admin | `POST /api/admin/ops/events/apply` | Active - UPDATE-only (existing IDs required) |
| Venue CSV | Admin | `/api/admin/ops/venues/*` | Active - UPDATE-only |
| Override CSV | Admin | `/api/admin/ops/overrides/*` | Active - UPSERT |
| Direct SQL | Manual | psql | Used for legacy seeding |

### 2.2 Current CSV Schema (Ops Console - Events)

```csv
id,title,event_type,status,is_recurring,event_date,day_of_week,start_time,end_time,venue_id,is_published,notes
```

**Limitation:** Requires existing `id` — cannot INSERT new events.

### 2.3 Scripts Inventory

| Script | Purpose |
|--------|---------|
| `find-duplicates.ts` | Detect duplicate events by venue+day_of_week |
| `merge-duplicates.ts` | Merge and dedupe events |
| `source-audit.ts` | Audit `source` field values for contract compliance |
| `data-health.ts` | General data health report |
| `slug-audit.ts` | Check for NULL/duplicate slugs |

---

## 3. v1 Import Format Proposal

### 3.1 Supported Format

**CSV only** (v1 scope). JSON support deferred to v2.

### 3.2 CSV Column Definitions

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `title` | string | Yes | Event title |
| `event_type` | enum | Yes | `open_mic`, `showcase`, `song_circle`, `workshop`, `gig`, `kindred_group`, `jam_session`, `meetup`, `other` |
| `venue_id` | UUID | No* | FK to venues table |
| `venue_name` | string | No* | Fallback if venue_id not known |
| `day_of_week` | string | Conditional | Required for weekly/monthly recurrence |
| `start_time` | HH:MM | Yes | 24-hour format |
| `end_time` | HH:MM | No | Optional |
| `event_date` | YYYY-MM-DD | No | Anchor date for series or one-time date |
| `recurrence_rule` | string | No | `weekly`, `biweekly`, `monthly`, `1st`, `2nd`, `3rd`, `4th`, `last`, `1st/3rd`, `2nd/4th`, `custom` |
| `max_occurrences` | integer | No | Limit for bounded series (null = infinite) |
| `custom_dates` | string | No | Pipe-delimited dates for custom recurrence: `2026-01-15\|2026-01-22\|2026-02-05` |
| `description` | string | No | Event description (markdown supported) |
| `host_notes` | string | No | Private notes for hosts |
| `is_dsc_event` | boolean | No | Default: false |
| `has_timeslots` | boolean | No | Default: false |
| `total_slots` | integer | No | Required if has_timeslots=true |
| `slot_duration_minutes` | integer | No | Default: 5 |
| `capacity` | integer | No | RSVP capacity (null = unlimited) |
| `is_free` | boolean | No | null = unknown |
| `cost_label` | string | No | e.g., "$5 suggested donation" |
| `signup_url` | string | No | External signup URL |
| `age_policy` | string | No | e.g., "21+", "All ages" |
| `external_url` | string | No | Link to external event page |
| `categories` | string | No | Pipe-delimited: `music\|comedy` |
| `cover_image_url` | string | No | URL to cover image |

*Either `venue_id` OR `venue_name` should be provided for in-person events.

### 3.3 v1 Scope Exclusions

NOT included in import (handled post-import via normal UI):
- RSVPs (`event_rsvps` table)
- Timeslot claims (`timeslot_claims` table)
- Comments (`event_comments` table)
- Occurrence overrides (`occurrence_overrides` table)
- Event hosts (`event_hosts` table) — auto-assigned to importer or NULL

---

## 4. Source-of-Truth Fields + Invariants

### 4.1 Recurrence Invariants

From `CLAUDE.md` Phase 4.83:

| recurrence_rule | day_of_week Required | Notes |
|-----------------|---------------------|-------|
| `weekly`, `biweekly` | **Yes** | Must specify which day |
| `1st`, `2nd`, `3rd`, `4th`, `5th`, `last` | **Yes** | Ordinal monthly |
| `1st/3rd`, `2nd/4th`, etc. | **Yes** | Multi-ordinal monthly |
| `monthly` | **Yes** | Day-of-week based |
| `custom` | No | Uses `custom_dates` array |
| `NULL` (one-time) | No | Uses `event_date` only |

**IMPORT RULE:** Rows with ordinal/weekly recurrence but missing `day_of_week` are REJECTED (not auto-fixed).

### 4.2 Server-Side Canonicalization

From `recurrenceCanonicalization.ts`:
- If `recurrence_rule` is ordinal monthly AND `day_of_week` is NULL AND `event_date` is set
- Derive `day_of_week` from `event_date` (e.g., `2026-01-24` → `Saturday`)
- This runs on POST/PATCH API routes

**IMPORT RULE:** Import validation should apply same canonicalization before insert, not after.

### 4.3 Required Field Combinations

| Mode | Required Fields |
|------|-----------------|
| One-time | `title`, `event_type`, `start_time`, (`venue_id` OR `venue_name`), `event_date` |
| Weekly | Above + `day_of_week`, `recurrence_rule=weekly` |
| Monthly ordinal | Above + `day_of_week`, `recurrence_rule` in ordinal set |
| Custom dates | Above + `custom_dates`, `recurrence_rule=custom` (no day_of_week needed) |

### 4.4 Immutable Fields (After Import)

Fields that should NOT be changed via bulk update (require UI):
- `id` (identity)
- `host_id` (ownership)
- `source` (audit trail)
- `created_at` (audit trail)

---

## 5. Dedupe/Merge Strategy Proposal

### 5.1 Duplicate Detection Keys

Primary key combination for detecting duplicates:
1. **Strong match:** `title` (case-insensitive, normalized) + `venue_id` + `day_of_week`
2. **Weak match:** `title` (case-insensitive) + `venue_name` (fuzzy) + `day_of_week`

### 5.2 Import Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `strict` | Reject all duplicates | Clean import to empty/new system |
| `skip` | Skip existing, insert new only | Incremental updates |
| `merge` | Preview merge, require manual approval | Data consolidation |

**Recommendation:** v1 uses `skip` mode by default with preview showing what would be skipped.

### 5.3 Merge Field Priority

When merging, prefer the row with:
1. Higher completeness score (more non-null fields)
2. `status=active` over other statuses
3. Has `venue_id` over `venue_name` only
4. Has `description` over no description
5. Has `recurrence_rule` over none
6. More recent `created_at` (if known)

### 5.4 Scoring Algorithm

From existing `merge-duplicates.ts`:
```typescript
function scoreEvent(e: Event): number {
  let score = 0;
  if (e.status === "active") score += 10;
  if (e.description) score += 5;
  if (e.slug) score += 3;
  if (e.venue_id) score += 2;
  if (e.signup_time) score += 2;
  if (e.end_time) score += 1;
  if (e.category) score += 1;
  return score;
}
```

---

## 6. Verification & Ownership Defaults

### 6.1 Source Field Contract

From `SEEDING-CONTRACT.md`:

| Value | Created By | Auto-Confirm? | Requires Verification? |
|-------|------------|---------------|------------------------|
| `community` | User via EventForm | Yes | No |
| `import` | Bulk import | No | Yes |
| `admin` | Admin UI | No | Yes |

### 6.2 Import Defaults

All imported events MUST have:
```typescript
{
  source: "import",           // Marks as imported
  host_id: null,              // Unclaimed (or importer's ID if admin)
  last_verified_at: null,     // NOT auto-confirmed
  verified_by: null,          // No verifier
  is_published: true,         // Visible but unconfirmed
  status: "active",           // Not draft
}
```

### 6.3 Post-Import Workflow

1. **Import** → Events appear on `/happenings` with "Unconfirmed" badge
2. **Admin review** → Admin visits `/dashboard/admin/events`, filters by unconfirmed
3. **Verify** → Admin clicks "Verify" on queue, sets `last_verified_at`
4. **Claim** → Hosts can claim via existing claim flow

### 6.4 DSC Event Flag

- `is_dsc_event` defaults to `false` for imports
- Only admins/approved hosts can set to `true` via UI
- Import CSV can include `is_dsc_event=true` but requires admin-level import permission

---

## 7. Observability / Debugging Hooks

### 7.1 Audit Logging

Extend existing `opsAudit.ts`:

```typescript
interface ImportAuditEntry {
  timestamp: string;
  user_id: string;
  action: "events_csv_import";
  metadata: {
    filename?: string;
    totalRows: number;
    insertedCount: number;
    skippedCount: number;
    rejectedCount: number;
    rejectedRows: { row: number; errors: string[] }[];
    duplicatesDetected: { row: number; existingId: string; reason: string }[];
  };
}
```

### 7.2 Data Integrity Audit Query

Run after bulk imports:
```sql
-- Ordinal monthly with missing day_of_week (should be 0)
SELECT id, title, recurrence_rule, day_of_week, event_date
FROM events
WHERE recurrence_rule IN (
  '1st', '2nd', '3rd', '4th', '5th', 'last',
  '1st/3rd', '2nd/4th', '2nd/3rd',
  '1st and 3rd', '2nd and 4th', '1st and Last',
  'monthly'
)
AND day_of_week IS NULL;

-- Import source without proper verification state
SELECT id, title, source, last_verified_at
FROM events
WHERE source = 'import'
AND last_verified_at IS NOT NULL;
```

### 7.3 Health Check Script Update

Extend `data-health.ts` to include:
- Count of `source=import` events
- Count of unverified imported events
- Recurrence invariant violations
- Duplicate detection report

---

## 8. Test Plan

### 8.1 Unit Tests

| Test | Validates |
|------|-----------|
| Parse valid CSV | All column types parsed correctly |
| Parse quoted values | Commas inside quotes handled |
| Reject missing required fields | title, event_type, start_time |
| Reject invalid recurrence combinations | ordinal monthly without day_of_week |
| Apply canonicalization | day_of_week derived from event_date when missing |
| Detect duplicates | Strong and weak match scenarios |
| Score events | Completeness scoring |

### 8.2 Integration Tests

| Test | Validates |
|------|-----------|
| Import to empty DB | All rows inserted |
| Import with duplicates (skip mode) | New rows inserted, existing skipped |
| Verify source=import default | All imported events have source=import |
| Verify unconfirmed default | last_verified_at is NULL for imports |
| Audit log created | opsAudit entry written |

### 8.3 E2E Smoke Tests

| Test | Validates |
|------|-----------|
| Import CSV via admin UI | File upload, preview, apply workflow |
| Imported event appears on /happenings | Visible with "Unconfirmed" badge |
| Admin can verify imported event | Badge changes to "Confirmed" |
| Host can claim imported event | Claim flow works |

---

## 9. Proposed File Structure

```
web/src/lib/ops/
├── eventCsvParser.ts      # EXISTING - extend for import columns
├── eventValidation.ts     # EXISTING - extend for import validation
├── eventDiff.ts           # EXISTING - extend for duplicate detection
├── eventImport.ts         # NEW - import-specific logic
├── importAudit.ts         # NEW - import audit logging
└── index.ts               # Update exports

web/src/app/api/admin/ops/events/
├── export/route.ts        # EXISTING
├── preview/route.ts       # EXISTING
├── apply/route.ts         # EXISTING
├── import-preview/route.ts  # NEW - preview import with duplicate detection
└── import-apply/route.ts    # NEW - apply import

web/src/app/(protected)/dashboard/admin/ops/events/
└── import/page.tsx        # NEW - import UI with file upload + preview
```

---

## 10. Implementation Phases (Post-Approval)

### Phase A: Core Import Logic (Estimate: not provided per rules)
1. Extend `eventCsvParser.ts` with import columns
2. Create `eventImport.ts` with duplicate detection
3. Create import preview/apply API routes
4. Add import audit logging

### Phase B: UI + Integration
1. Create import page with file upload
2. Preview table with duplicate warnings
3. Apply with progress feedback
4. Update data-health script

### Phase C: Testing + Documentation
1. Unit tests for all new functions
2. Integration tests for import workflow
3. E2E smoke test
4. Update CLAUDE.md with import docs

---

## 11. STOP-GATE Critique

### 11.1 What Could Go Wrong

| Risk | Mitigation |
|------|------------|
| Duplicate imports pollute database | Duplicate detection with skip/preview mode |
| Recurrence invariant violations | Strict validation before insert |
| Imported events auto-confirmed | Explicit `last_verified_at: null` |
| Venue FK violations | Pre-validate venue_id references |
| Slug collisions | Auto-generate slugs with collision handling |
| Timezone issues | Enforce Mountain Time canonical dates |

### 11.2 Deferred Decisions

| Decision | Defer Until |
|----------|-------------|
| JSON import format | v2 |
| API endpoint for programmatic import | v2 |
| Import RSVPs/timeslots | v2 |
| Import occurrence overrides | v2 |
| Merge mode with field-level diff | v2 |

### 11.3 Dependencies

- Existing `eventCsvParser.ts` and `eventValidation.ts` patterns
- `opsAudit.ts` for audit logging
- `recurrenceCanonicalization.ts` for day_of_week derivation
- Venue table for FK validation

---

## 12. Approval Checklist

Before proceeding to implementation:

- [ ] v1 CSV-only scope confirmed
- [ ] INSERT+skip mode (vs UPDATE) confirmed
- [ ] Deferred RSVPs/timeslots/overrides confirmed
- [ ] Recurrence invariant enforcement (reject, not auto-fix) confirmed
- [ ] `source=import` + `last_verified_at=null` defaults confirmed
- [ ] `host_id=null` for imported events (unclaimed) confirmed

---

**STOP-GATE 1 COMPLETE**

---

## STOP-GATE 2: Implementation Plan

**Date:** 2026-01-26
**Status:** Ready for Sami approval (no code changes made)

---

### Drift Check Results (All CONFIRMED)

| Check | Status | Notes |
|-------|--------|-------|
| Ops Console UPDATE-only | ✅ CONFIRMED | `/api/admin/ops/events/apply` uses `.in("id", csvIds)` + `.update()` |
| Recurrence canonicalization | ✅ CONFIRMED | `recurrenceCanonicalization.ts` exports `canonicalizeDayOfWeek()` |
| Visibility/verification decoupled | ✅ CONFIRMED | Public queries filter on `is_published + status`, NOT `last_verified_at` |
| Schema fields exist | ✅ CONFIRMED | All v1 CSV fields exist in events table* |

*Note: `custom_dates` and `max_occurrences` exist in DB but not in generated `database.types.ts` (needs regeneration). Import will use type casts.

---

### A) Minimal v1 Scope (LOCKED)

| Decision | Value |
|----------|-------|
| Format | CSV-only (JSON deferred to v2) |
| Mode | INSERT + skip (no UPDATE behavior) |
| Invalid recurrence | REJECT row (do not auto-fix) |
| Import defaults | `source='import'`, `host_id=null`, `last_verified_at=null`, `is_published=true`, `status='active'` |
| Dedupe | Skip on: (1) slug collision, (2) title+event_date+venue_id match |
| Pre-verify option | Optional `pre_verified=true` column sets `last_verified_at=now()` |

---

### B) File-by-File Implementation Plan

#### B.1 New Files

| File Path | Purpose |
|-----------|---------|
| `web/src/lib/ops/eventImportParser.ts` | CSV parser for import columns (extends pattern from `eventCsvParser.ts`) |
| `web/src/lib/ops/eventImportValidation.ts` | Row-level validation for import (extends `eventValidation.ts` patterns) |
| `web/src/lib/ops/eventImportDedupe.ts` | Duplicate detection logic (slug collision + title/date/venue match) |
| `web/src/lib/ops/eventImportBuilder.ts` | Build INSERT payloads with system defaults |
| `web/src/app/api/admin/ops/events/import-preview/route.ts` | POST: Parse + validate + dedupe + return preview |
| `web/src/app/api/admin/ops/events/import-apply/route.ts` | POST: Execute INSERTs for validated rows |
| `web/src/app/(protected)/dashboard/admin/ops/events/import/page.tsx` | Admin UI: file upload + preview + apply |
| `web/src/__tests__/event-import-*.test.ts` | Unit + integration tests |

#### B.2 Modified Files

| File Path | Change |
|-----------|--------|
| `web/src/lib/audit/opsAudit.ts` | Add `eventsImport()` method for audit logging |
| `web/src/app/(protected)/dashboard/admin/ops/events/page.tsx` | Add "Import" tab/section linking to import page |

---

### C) CSV v1 Import Schema (Final)

```csv
title,event_type,event_date,start_time,end_time,venue_id,venue_name,day_of_week,recurrence_rule,description,external_url,categories,is_free,cost_label,age_policy,pre_verified
```

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `title` | string | **YES** | Event title |
| `event_type` | enum | **YES** | `open_mic`, `showcase`, `song_circle`, `workshop`, `gig`, `kindred_group`, `jam_session`, `meetup`, `other` |
| `event_date` | YYYY-MM-DD | **YES** | Anchor date |
| `start_time` | HH:MM | NO | 24-hour format |
| `end_time` | HH:MM | NO | Optional |
| `venue_id` | UUID | NO* | FK to venues |
| `venue_name` | string | NO* | Lookup helper (ignored if venue_id set) |
| `day_of_week` | string | CONDITIONAL | Required if recurrence_rule is ordinal/weekly |
| `recurrence_rule` | string | NO | `weekly`, `biweekly`, `1st`, `2nd/4th`, etc. |
| `description` | string | NO | Event description |
| `external_url` | URL | NO | External event link |
| `categories` | string | NO | Pipe-delimited: `music|comedy` |
| `is_free` | boolean | NO | Default: null (unknown) |
| `cost_label` | string | NO | e.g., "$5 suggested" |
| `age_policy` | string | NO | `all_ages`, `18+`, `21+` |
| `pre_verified` | boolean | NO | If true, sets `last_verified_at=now()` |

*Either `venue_id` OR `venue_name` recommended for in-person events.

---

### D) System-Managed Fields (Never in CSV)

All imported events will have these values set automatically:

```typescript
{
  id: crypto.randomUUID(),           // Auto-generated
  slug: generateSlugFromTitle(title), // Trigger-generated
  source: "import",                  // Identifies import origin
  host_id: null,                     // Unclaimed
  is_published: true,                // Visible immediately
  status: "active",                  // Live event
  last_verified_at: pre_verified ? now() : null,  // Based on CSV column
  verified_by: pre_verified ? adminUserId : null,
  is_dsc_event: false,               // Community event
  is_recurring: recurrence_rule !== null,
  created_at: now(),
  updated_at: now(),
}
```

---

### E) Validation Rules

#### E.1 Required Field Validation

| Field | Rule |
|-------|------|
| `title` | Non-empty string |
| `event_type` | Must be in `VALID_EVENT_TYPES` enum |
| `event_date` | Valid YYYY-MM-DD format |

#### E.2 Recurrence Validation

| Condition | Action |
|-----------|--------|
| `recurrence_rule` in ordinal set AND `day_of_week` missing | **REJECT** row (invariant: ordinal monthly requires day_of_week) |
| `recurrence_rule` = `weekly`/`biweekly` AND `day_of_week` missing | **DERIVE** from `event_date` using `canonicalizeDayOfWeek()` |
| `day_of_week` provided but not valid day name | **REJECT** row |

#### E.3 Reference Validation

| Field | Rule |
|-------|------|
| `venue_id` | If provided, must exist in venues table |
| `venue_name` | If `venue_id` not provided, attempt lookup; log warning if no match |

---

### F) Dedupe Strategy

#### F.1 Pre-Insert Checks (In Order)

1. **Slug Collision Check**
   ```sql
   SELECT id, slug FROM events WHERE slug = $generated_slug LIMIT 1;
   ```
   - If match: SKIP row, log `{ reason: "slug_collision", matched_id, matched_slug }`

2. **Title + Date + Venue Match**
   ```sql
   SELECT id, title FROM events
   WHERE lower(title) = lower($title)
     AND event_date = $event_date
     AND (venue_id = $venue_id OR (venue_id IS NULL AND $venue_id IS NULL))
   LIMIT 1;
   ```
   - If match: SKIP row, log `{ reason: "title_date_venue_match", matched_id }`

#### F.2 Venue Resolution

When `venue_id` is NULL but `venue_name` is provided:

```sql
SELECT id, name FROM venues WHERE lower(name) = lower($venue_name);
```

| Result | Action |
|--------|--------|
| Exactly 1 match | Use that `venue_id` |
| 0 matches | Set `venue_id = NULL`, log warning: "Venue not found: {name}" |
| >1 matches | Set `venue_id = NULL`, log warning: "Multiple venues match: {name}" |

---

### G) API Specifications

#### G.1 Preview Endpoint

```
POST /api/admin/ops/events/import-preview
Content-Type: application/json

{
  "csv": "title,event_type,event_date,...\n..."
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalRows": 50,
    "validRows": 45,
    "invalidRows": 3,
    "duplicates": 2
  },
  "validRows": [
    { "row": 1, "title": "Open Mic Monday", "event_type": "open_mic", ... }
  ],
  "invalidRows": [
    { "row": 3, "errors": ["Missing required field: title"] },
    { "row": 7, "errors": ["Invalid event_type: 'unknown'", "Ordinal recurrence requires day_of_week"] }
  ],
  "duplicates": [
    { "row": 5, "reason": "slug_collision", "matched_id": "abc-123" },
    { "row": 12, "reason": "title_date_venue_match", "matched_id": "def-456" }
  ],
  "venueWarnings": [
    { "row": 8, "warning": "Venue not found: Imaginary Bar" }
  ]
}
```

#### G.2 Apply Endpoint

```
POST /api/admin/ops/events/import-apply
Content-Type: application/json

{
  "csv": "title,event_type,event_date,...\n..."
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "inserted": 45,
    "skipped_dedupe": 2,
    "skipped_validation": 3,
    "errors": 0
  },
  "inserted": [
    { "row": 1, "id": "new-uuid-1", "title": "Open Mic Monday" }
  ],
  "skipped": [
    { "row": 3, "reason": "validation_failed" },
    { "row": 5, "reason": "slug_collision" }
  ],
  "errors": []
}
```

---

### H) Admin UI Specification

#### H.1 Location

New page at: `/dashboard/admin/ops/events/import`

Linked from: Ops Console (`/dashboard/admin/ops/events`) as "Import" tab/button

#### H.2 UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Happenings Import (CSV v1)                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Upload CSV                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  [Drag & drop CSV file here, or click to upload]           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Download Template CSV]   [View Column Reference]              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Step 2: Preview (after upload)                                 │
│                                                                  │
│  Summary:                                                        │
│  ✅ 45 rows ready to import                                     │
│  ⚠️  3 rows with validation errors (expand to see)              │
│  ⏭️  2 rows will be skipped (duplicates)                        │
│                                                                  │
│  [Show Validation Errors ▼]                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Row 3: Missing required field: title                       │ │
│  │ Row 7: Invalid event_type: 'unknown'                       │ │
│  │ Row 7: Ordinal recurrence requires day_of_week             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Show Duplicates ▼]                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Row 5: Slug collision with existing event (abc-123)        │ │
│  │ Row 12: Matches existing: "Jazz Night" on 2026-02-14       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Download Rejected Rows CSV]                                   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Step 3: Confirm Import                                         │
│                                                                  │
│  ☑️ I understand imported events will appear on /happenings     │
│     with "Unconfirmed" badges until manually verified           │
│                                                                  │
│  [Cancel]                    [Import 45 Events]                 │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Step 4: Results (after apply)                                  │
│                                                                  │
│  ✅ Successfully imported 45 events                             │
│                                                                  │
│  [View in Admin Happenings List]                                │
│  [Download Import Report CSV]                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### H.3 Template CSV

Downloadable template with headers and example row:

```csv
title,event_type,event_date,start_time,end_time,venue_id,venue_name,day_of_week,recurrence_rule,description,external_url,categories,is_free,cost_label,age_policy,pre_verified
"Example Open Mic",open_mic,2026-02-01,19:00,22:00,,Example Bar,Sunday,weekly,"Weekly open mic night",https://example.com/event,music,true,,all_ages,false
```

---

### I) Test Plan

#### I.1 Unit Tests (`__tests__/event-import-parser.test.ts`)

| Test | Validates |
|------|-----------|
| Parse valid CSV with all columns | All fields extracted correctly |
| Parse CSV with quoted commas | RFC 4180 handling |
| Parse CSV with escaped quotes | `""` inside quotes |
| Reject missing required fields | title, event_type, event_date |
| Reject invalid event_type | Not in enum |
| Reject ordinal recurrence without day_of_week | Invariant enforcement |
| Derive day_of_week for weekly from event_date | Canonicalization |
| Parse pipe-delimited categories | `music|comedy` → `["music", "comedy"]` |
| Parse boolean fields | `true`/`false`/empty |

#### I.2 Unit Tests (`__tests__/event-import-dedupe.test.ts`)

| Test | Validates |
|------|-----------|
| Detect slug collision | Same generated slug |
| Detect title+date+venue match | Case-insensitive title |
| No collision when venue differs | Different venue_id |
| Resolve venue from name (exact match) | venue_name → venue_id |
| Warn on no venue match | venue_name not found |
| Warn on multiple venue matches | Ambiguous venue_name |

#### I.3 Integration Tests (`__tests__/event-import-api.test.ts`)

| Test | Validates |
|------|-----------|
| Preview returns valid/invalid/duplicate counts | Summary accuracy |
| Apply creates events with correct defaults | source, host_id, status |
| Apply skips duplicates | No insert on collision |
| Apply respects pre_verified flag | last_verified_at set |
| Audit log created | opsAudit entry |

#### I.4 Safety Tests (`__tests__/event-import-invariants.test.ts`)

| Test | Validates |
|------|-----------|
| Imported events have `source='import'` | Never 'community' or 'admin' |
| Imported events have `host_id=null` | Unclaimed by default |
| Imported events have `last_verified_at=null` | Unverified by default |
| Imported events visible on /happenings | is_published=true, status=active |

---

### J) Audit Logging

#### J.1 Log Entry Structure

```typescript
interface ImportAuditEntry {
  action: "events_csv_import";
  admin_id: string;
  timestamp: string;
  summary: {
    totalRows: number;
    inserted: number;
    skippedDedupe: number;
    skippedValidation: number;
    errors: number;
  };
  insertedIds: string[];
  rejectedRows: Array<{
    row: number;
    reason: string;
  }>;
}
```

#### J.2 Axiom Queries

```bash
# Recent imports
axiom query "['vercel'] | where message contains 'events_csv_import' | where _time > ago(24h) | sort by _time desc"

# Failed imports
axiom query "['vercel'] | where message contains 'events_csv_import' and summary.errors > 0"

# Import summary by admin
axiom query "['vercel'] | where message contains 'events_csv_import' | summarize sum(summary.inserted) by admin_id"
```

---

### K) Rollback Plan

If issues discovered post-deploy:

1. **Identify imported events**: `SELECT id FROM events WHERE source = 'import' AND created_at > $deploy_time`
2. **Soft-delete if needed**: `UPDATE events SET status = 'cancelled', is_published = false WHERE id IN (...)`
3. **Hard-delete if critical**: `DELETE FROM events WHERE source = 'import' AND created_at > $deploy_time`
   - Safe: all FKs cascade

---

### L) Implementation Order

| Step | Description | Depends On |
|------|-------------|------------|
| 1 | Create `eventImportParser.ts` | — |
| 2 | Create `eventImportValidation.ts` | Step 1 |
| 3 | Create `eventImportDedupe.ts` | — |
| 4 | Create `eventImportBuilder.ts` | Steps 1, 2 |
| 5 | Create `import-preview/route.ts` | Steps 1-4 |
| 6 | Create `import-apply/route.ts` | Steps 1-4 |
| 7 | Add `eventsImport()` to `opsAudit.ts` | — |
| 8 | Create import UI page | Steps 5, 6 |
| 9 | Write unit tests | Steps 1-4 |
| 10 | Write integration tests | Steps 5-6 |
| 11 | Update CLAUDE.md | Steps 1-10 |

---

### M) Out of Scope (v1)

| Feature | Defer Until |
|---------|-------------|
| JSON import format | v2 |
| UPDATE mode (merge existing) | v2 |
| Import RSVPs/timeslots | v2 |
| Import occurrence overrides | v2 |
| Import hosts (host_id assignment) | v2 |
| custom_dates column support | v2 (requires v1 schema extension) |
| max_occurrences support | v2 |
| Batch processing (>1000 rows) | v2 |
| Scheduled/async imports | v2 |

---

## WAITING FOR SAMI APPROVAL — No code changes made.

Upon approval, implementation will proceed following the order in Section L.

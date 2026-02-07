# Phase 7A-R — Legacy Media Reconciliation (STOP-GATE Investigation)

**Status:** COMPLETED (APPROVED + EXECUTED)
**Author:** Codex (Architect + Executor)
**Date:** February 7, 2026
**Related tract:** Phase 7A Media UX Clarity
**Checked against:** `docs/GOVERNANCE.md`, `docs/CONTRACTS.md`, `docs/investigation/phase7a-media-ux-clarity-stopgate.md`

> Investigation completed first. Approved execution results are captured in the addendum below.

---

## 1) Objective

Close the remaining Phase 7A historical gap: reconcile **legacy event cover media** created before the new event-scoped upload contract so old covers are represented consistently in `event_images` and can be managed safely.

---

## 2) Scope

### In Scope
- Legacy event covers where `events.cover_image_url` exists but matching `event_images` row may not exist
- Event-image path contract drift from historical `{userId}/...` patterns to canonical `{eventId}/{uuid}`
- Backfill/reconciliation strategy and risk controls

### Out of Scope
- New media features (embeds, playlists, audio providers)
- Gallery/profile/venue/blog data-model redesign
- UI redesign
- Any destructive storage cleanup without separate approval

---

## 3) Evidence Map (Exact Paths)

### A) Legacy event-images policy originally allowed user-id paths
- `supabase/migrations/20251209200002_add_event_images_bucket.sql:31`
- `supabase/migrations/20251209200002_add_event_images_bucket.sql:38`

Evidence: initial policy expected `(storage.foldername(name))[1] = auth.uid()::text`, i.e., `{userId}/*`.

### B) Canonical event_images table introduced later
- `supabase/migrations/20260118120000_event_images_and_external_url.sql:20`
- `supabase/migrations/20260118120000_event_images_and_external_url.sql:22`
- `supabase/migrations/20260118120000_event_images_and_external_url.sql:24`

Evidence: `event_images` became canonical event media table (`event_id`, `image_url`, `storage_path`, `deleted_at`).

### C) Canonical storage contract expects event-id path
- `supabase/migrations/20260118120000_event_images_and_external_url.sql:161`
- `supabase/migrations/20260118120000_event_images_and_external_url.sql:173`

Evidence: policy resolves `(storage.foldername(name))[1]::uuid` as event id.

### D) Conflicting legacy policy was explicitly removed
- `supabase/migrations/20260118200000_fix_event_images_storage_policy.sql:4`
- `supabase/migrations/20260118200000_fix_event_images_storage_policy.sql:16`
- `supabase/migrations/20260118200000_fix_event_images_storage_policy.sql:17`
- `supabase/migrations/20260118200000_fix_event_images_storage_policy.sql:18`

Evidence: migration documents and removes old user-id policy path assumptions.

### E) Current EventForm now writes canonical event-scoped media + row
- `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx:242`
- `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx:257`
- `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx:259`
- `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx:761`

Evidence: new uploads are `{eventId}/{uuid}` and insert `event_images` rows.

### F) Admin create flow also writes canonical event-scoped media + row
- `web/src/app/(protected)/dashboard/admin/events/new/EventCreateForm.tsx:143`
- `web/src/app/(protected)/dashboard/admin/events/new/EventCreateForm.tsx:161`

### G) Display surfaces still consume `events.cover_image_url` directly
- `web/src/components/happenings/HappeningCard.tsx:384`
- `web/src/app/page.tsx:55`

Evidence: old covers still render publicly even if `event_images` row is missing.

### H) API still accepts direct `cover_image_url` on event create payload
- `web/src/app/api/my-events/route.ts:183`

---

## 4) Current Problem Statement (Legacy Residual)

Phase 7A fixed forward behavior. Historical rows/files may still exist in one or more of these states:

1. `events.cover_image_url` set, but no corresponding active `event_images` row.
2. Storage object path under older conventions while DB/media tables now assume event-scoped patterns.
3. Potential storage orphans not referenced by current `events` or active `event_images` rows.

Impact: UI generally still works (public card rendering), but media-management consistency and recoverability are weaker for historical items.

---

## 5) Data Availability Constraint

Direct DB recon queries could not run from this environment due DNS/network restriction:
- `could not translate host name "db.oipozdbfxyskoscsgbfq.supabase.co"`

Therefore, this stop-gate includes **query templates** and plan, but not production row counts.

---

## 6) Proposed Reconciliation Approach (No Execution Yet)

### Step 1: Read-Only Inventory (Required Before Any Write)

Run read-only counts first:

- events with cover URL
- active `event_images` rows
- events whose `cover_image_url` has no matching active `event_images.image_url`
- likely legacy-path candidates (path segment[1] not UUID/event id pattern)

### Step 2: Non-Destructive Backfill (Insert-Only)

For each event where `cover_image_url` exists and no active matching `event_images` row:
- insert `event_images` row with
  - `event_id`
  - `image_url = normalized(events.cover_image_url)`
  - `storage_path` derived from URL path when possible, else sentinel marker (`legacy-unknown-path`)
  - `uploaded_by = events.host_id` when available
- do **not** delete or move storage objects in this step

### Step 3: Validation

- verify one active cover-linked row per event (or justified multiples)
- verify no public rendering regressions (`/`, `/happenings`, event detail)
- verify dashboard media management continuity

### Step 4: Optional Cleanup Tract (Separate Approval)

Only after stable backfill:
- evaluate true storage orphans
- perform scoped cleanup with admin/service-role safety controls

---

## 7) Classification

### Blocking vs Non-Blocking

| ID | Finding | Severity | Why |
|----|---------|----------|-----|
| B1 | Missing production counts due network-limited investigation environment | **Blocking** | Cannot safely size write blast radius without inventory step in target env |
| B2 | Historical covers may lack `event_images` linkage | Non-blocking | Public UX still renders via `events.cover_image_url`, but management consistency drifts |
| B3 | Potential legacy-path objects in storage | Non-blocking | Not immediate user breakage; impacts maintenance/cleanup confidence |

### Correctness vs Cosmetic

| ID | Finding | Category |
|----|---------|----------|
| C1 | Missing `event_images` linkage for historical covers | **Correctness** (data consistency) |
| C2 | Legacy storage path heterogeneity | **Correctness** (operability/cleanup) |
| C3 | Any cover text/copy mismatches | Cosmetic (already mostly resolved in 7A) |

---

## 8) Risks of Reconciliation

1. **Wrong joins on URL normalization** can create duplicate or incorrect `event_images` rows.
2. **Backfill touching soft-deleted rows incorrectly** could resurrect stale media semantics.
3. **Assuming storage_path derivation is always possible** can create false certainty in later cleanup.
4. **Premature cleanup** can create irreversible data loss.

Mitigation: insert-only phase first, no deletions, full dry-run counts, explicit rollback query path.

---

## 9) Do-Nothing Alternative

Leave historical data as-is:
- Pros: zero migration risk now.
- Cons: persistent dual-state media history, weaker media governance, harder future cleanup, inconsistent event-media management semantics.

---

## 10) Recommended Execution Guardrails (for approval step)

- Run as transaction-scoped batches with before/after counts
- Log inserted event IDs and image URLs to an audit table/file
- Cap batch size per run (e.g., 200 events)
- No storage deletion in same run
- STOP on first anomaly (null URL mismatch, duplicate conflict spikes, FK anomalies)

---

## 11) Subordinate Architect Critique (Self-Applied)

### Assumptions

1. Historical legacy covers primarily affect event media, not profile/venue/gallery contracts.
2. `events.cover_image_url` remains canonical for display even when `event_images` linkage is absent.
3. Insert-only reconciliation is safer than path-move/delete reconciliation in first pass.

### Risks (Required)

| Finding | Evidence | Impact | Suggested delta | Confidence |
|---------|----------|--------|-----------------|------------|
| Inventory blind spot in current environment | Network error during `psql` recon; no live counts | Unbounded write-risk if executed blindly | Require production/staging read-only count report before execution approval | 0.96 |
| URL normalization mismatch (`?t=` cache-busters, URL variants) | `normalizeImageUrl` logic exists in `EventForm` (`EventForm.tsx:228`) | Duplicate or non-matching rows if unnormalized | Canonicalize URLs in recon SQL/logic before join comparison | 0.91 |
| Legacy storage-path ambiguity from URL-only records | Legacy uploads pre-table may not persist reliable `storage_path` | Cleanup phase may target wrong files | Split into two phases: backfill linkage first, cleanup only with explicit path-confidence threshold | 0.89 |

### Suggested Deltas (Required)

1. **Delta A**
   - Finding: No live baseline counts in this environment.
   - Evidence: failed DB connectivity during recon.
   - Impact: impossible to safely estimate blast radius.
   - Suggested delta: require a pre-flight SQL report artifact (counts + sample rows) attached to approval message.
   - Confidence: 0.97

2. **Delta B**
   - Finding: Storage cleanup is coupled to uncertain path derivation.
   - Evidence: historical model allowed user-id path (`20251209200002...:31-39`) while current model expects event-id path (`20260118120000...:161-174`).
   - Impact: accidental deletion risk if cleanup runs in same tract.
   - Suggested delta: mark cleanup as explicitly separate tract (7A-R2), keep 7A-R1 insert-only.
   - Confidence: 0.94

---

## 12) Approval Questions

1. Approve **7A-R1 insert-only backfill** (no deletes/moves)?
2. Require staging dry run first, or go direct to production with read-only preflight evidence?
3. If `storage_path` cannot be derived reliably, approve sentinel marker approach (`legacy-unknown-path`) for backfilled rows?
4. Defer all storage cleanup to a separate 7A-R2 tract?

---

## 13) Execution Addendum (Approved + Completed)

**Approval:** Sami approved execution after STOP-GATE review.  
**Execution date:** February 7, 2026  
**Execution type:** One-time guarded reconciliation (DB + storage), no source-code edits.

### Guardrails Applied

- Touched only events whose `cover_image_url` still matched the seeded signed URL at write-time.
- Preserved manually replaced covers by skipping any row that no longer matched the legacy seeded URL.
- Insert-only linkage behavior for `event_images` and non-destructive cover URL normalization.

### Results

- `target_rows`: `37`
- `uploaded_new`: `36`
- `upload_already_exists`: `1`
- `db_inserted`: `37`
- `events_updated`: `37`
- `errors`: `0`

### Post-Verification

- `missing_active_links`: `0`
- `missing_seed_signed_open_mic`: `0`
- `covers_using_event_images_public`: `85`
- `legacy_seed_objects`: `37`
- `legacy_seed_refs`: `37`
- `legacy_seed_orphans`: `0`

### Outcome

Legacy seeded event cover URLs are now reconciled to canonical `event-images` structure with active `event_images` linkage, while preserving manually replaced covers.

## COMPLETE — Phase 7A-R Closed

No application source-code changes were required for this reconciliation step.

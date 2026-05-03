# Source Observation Step 3c — `event_change_log` Brief

**Status:** Implementation brief — **does not authorize applying any migration**
**Lane:** Lane 6 (strategy and policy authoring)
**Created:** 2026-05-03
**Audience:** Future migration author and the reviewer for the step-3c stop-gate

**Predecessors (all merged on `main`; 3a + 3b also applied to production):**

- [PR #214](https://github.com/samiserrag/denver-songwriters-collective/pull/214) — investigation: data model plan
- [PR #219](https://github.com/samiserrag/denver-songwriters-collective/pull/219) — Step 3a/general decision memo
- [PR #222](https://github.com/samiserrag/denver-songwriters-collective/pull/222) — Step 3a brief (`event_sources`)
- [PR #226](https://github.com/samiserrag/denver-songwriters-collective/pull/226) — Step 3a execute (inert `event_sources` table; **applied to production**)
- [PR #231](https://github.com/samiserrag/denver-songwriters-collective/pull/231) — `COMMUNITY-CORRECTION-01` principle
- [PR #234](https://github.com/samiserrag/denver-songwriters-collective/pull/234) — Step 3b brief (`event_source_observations`)
- [PR #238](https://github.com/samiserrag/denver-songwriters-collective/pull/238) — Step 3b decision memo
- [PR #244](https://github.com/samiserrag/denver-songwriters-collective/pull/244) — Step 3b execute (inert `event_source_observations`; **applied to production**)
- [docs/strategy/AGENTIC_EVENT_MAINTENANCE.md `COMMUNITY-CORRECTION-01`](../strategy/AGENTIC_EVENT_MAINTENANCE.md)
- [docs/strategy/SOURCE_REGISTRY.md](../strategy/SOURCE_REGISTRY.md)
- [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md) — Draft / Proposed / Not Active

> **No production verification behavior is changed by this brief.** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed, remains the only active rule per [Phase 4.89 Confirmation Invariants](../../.claude/rules/10-web-product-invariants.md). [SOURCE-OBS-01](../CONTRACTS.md) stays Draft / Proposed / Not Active. **Approving this brief does not authorize applying the migration.** The 3c-execute migration PR is its own stop-gate.

---

## 1. Purpose

`event_change_log` is the **proposed-change workflow surface** for the SOURCE-OBS-01 verification model. It captures field-level deltas between an event's currently-published state and what registered sources observe, and tracks the review/approval lifecycle of those proposals.

Three claims about the table:

1. **Proposed/derived, not applied.** A row in `event_change_log` says *"based on observation X, source S thinks event E's field F should change from current_value to proposed_value."* It does **not** mean the change has happened. Applied changes live in `event_audit_log` (Lane 5 PR A).
2. **Workflow, not pure evidence.** Unlike `event_source_observations` (immutable facts), `event_change_log` rows have lifecycle: `pending → approved → applied`, or `pending → rejected`, or `pending → withdrawn`. Status transitions mutate the row.
3. **Inputs to the future Step 4 derivation function.** The derivation function reads `event_change_log` to drive the `details_changed_recently` and `possible_cancellation` modifiers, and to populate the review queue.

The slogan: **observations are evidence; change_log is proposal; audit_log is history.** Three artifacts, three lifecycles.

## 2. Relationship to Existing Tables

### 2.1 `event_source_observations` (PR-244, on production)

Every `event_change_log` row references an `event_source_observations` row via `observation_id`. The Trust agent (future) reads observations and derives change-log entries by comparing observed field values against the current `events` row.

`event_change_log.observation_id` is `NOT NULL REFERENCES public.event_source_observations(id) ON DELETE CASCADE`. Every change-log entry traces to an observation; if the observation is removed, its derived deltas should not survive.

### 2.2 `event_sources` (PR-226, on production)

`event_change_log.source_id` is denormalized from `event_source_observations.source_id` for fast filter at review time. `NOT NULL REFERENCES public.event_sources(id) ON DELETE RESTRICT` — same posture as `event_source_observations`.

### 2.3 `events`

`event_change_log.event_id` is `NOT NULL` (unlike `event_source_observations.event_id` which is nullable). Reasoning: an unmatched observation (event_id NULL) cannot generate a delta against an event because there's no event to compare against. Change-log entries only exist after the Deduper has matched an observation to an event. `ON DELETE CASCADE` (deleting the event removes its proposed-change history).

### 2.4 `event_audit_log` (Lane 5 PR A)

`event_audit_log` records direct mutations to the trusted event record. `event_change_log` records *proposals* about what those mutations should be. They are sequential, not redundant:

- A proposal lands in `event_change_log` with `status = 'pending'`.
- Review (admin or claimed-source) transitions it to `approved` or `rejected`.
- An approved change is applied via the existing event-edit code path. That application emits a row in `event_audit_log`.
- The `event_change_log` row's status transitions to `applied`. Optionally, a future column can link it to the resulting `event_audit_log` row (deferred).

`event_change_log` does not modify, replace, or supersede `event_audit_log`. Lane 5 PR A's contract holds. **Lane 5 PR B scope is not expanded by 3c.**

### 2.5 `COMMUNITY-CORRECTION-01` proposed-change queue

[COMMUNITY-CORRECTION-01 §10.2](../strategy/AGENTIC_EVENT_MAINTENANCE.md) names three artifacts: `event_audit_log`, the proposed-change queue, and `event_source_observations`. **Step 3c proposes that `event_change_log` IS the proposed-change queue — but with a critical scoping decision (see §3.1).**

- **In scope for `event_change_log` in 3c:** system-derived deltas (Trust agent reads observations, computes deltas). Source: `proposal_source = 'derivation'`.
- **Out of scope for `event_change_log` in 3c:** community-submitted corrections (user-typed change requests). Those land in a separate future surface, or land in `event_change_log` only via a `service_role` indirection analogous to the crawler-fetch indirection used for community-evidence observations (memo Q6, 3b).

This separation preserves the COMMUNITY-CORRECTION-01 boundary at the schema level: `event_change_log.proposal_source` enum has no `'user_direct'` value. See §3.1 and §11.6.

### 2.6 Step 4 derivation function (future)

The derivation function reads observations, change-log entries, and claims to compute the `EventVerificationDisplay` per [SOURCE_REGISTRY.md §6](../strategy/SOURCE_REGISTRY.md). 3c ships only the table; the derivation function is Step 4 and ships under its own stop-gate.

## 3. Proposed Columns

This section is opinionated. The user prompt for 3c proposed a column set; I evaluate it against the data-model-plan §5 baseline and recommend the merged proposal below, with each disagreement justified inline.

### 3.1 Recommended column set

| Column | Type | Constraint / Notes |
|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `event_id` | `uuid` | `NOT NULL REFERENCES public.events(id) ON DELETE CASCADE`. See §3.2. |
| `observation_id` | `uuid` | `NOT NULL REFERENCES public.event_source_observations(id) ON DELETE CASCADE`. See §3.3. |
| `source_id` | `uuid` | `NOT NULL REFERENCES public.event_sources(id) ON DELETE RESTRICT`. Denormalized from observation for fast filter. See §3.4. |
| `field_name` | `text` | `NOT NULL CHECK (field_name IN ('title','start_at','end_at','venue_id','venue_name','ticket_url','status','description','organizer'))`. See §3.5. |
| `current_value` | `text` | nullable; what was in `events` at the delta-derivation moment |
| `proposed_value` | `text` | nullable; what the observation reports |
| `change_severity` | `text` | `NOT NULL CHECK (change_severity IN ('minor','material','cancellation_risk'))`. From data-model-plan §5. See §3.6. |
| `confidence` | `numeric(4,3)` | nullable; `CHECK (confidence BETWEEN 0 AND 1)`. Per-change confidence (may differ from observation confidence due to aggregation). |
| `change_reason` | `text` | nullable; system-emitted human-readable explanation (e.g., `"source observed start_at differs by 1h"`). |
| `proposal_source` | `text` | `NOT NULL DEFAULT 'derivation' CHECK (proposal_source IN ('derivation','admin_seed','concierge_extract'))`. **No `'user_direct'` value.** See §3.7. |
| `derivation_run_id` | `uuid` | nullable; **no FK in 3c**. References future `derivation_runs` table when Step 4 ships. See §3.8. |
| `status` | `text` | `NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied','withdrawn','superseded'))`. Workflow state. See §3.9. |
| `reviewed_by` | `uuid` | nullable; `REFERENCES public.profiles(id) ON DELETE SET NULL`. Admin or claimed-source reviewer. |
| `reviewed_at` | `timestamptz` | nullable. |
| `applied_at` | `timestamptz` | nullable. Set when status transitions to `'applied'`. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()`. |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()`. Maintained by `BEFORE UPDATE` trigger (matches existing claim-table pattern). |

### 3.2 Critique — `event_id` NOT NULL (vs nullable in observations)

`event_source_observations.event_id` is nullable (memo Q1: record-then-match). `event_change_log.event_id` is **NOT NULL**. Reasoning:

- A change-log entry is a delta *against an event*. If there is no event yet (the observation is unmatched), there is nothing to compare against — no delta exists.
- The Trust agent only generates change-log entries after the Deduper has linked the observation to an event (`event_id` set on the observation).
- Forcing `NOT NULL` makes the schema match the semantic invariant.

### 3.3 Critique — `observation_id` NOT NULL FK

The user prompt listed `observation_id` without specifying nullability. **Recommend NOT NULL.** Reasoning:

- Every change-log entry must trace back to the observation that produced it. Without the link, the entry is unfalsifiable evidence.
- For non-derivation proposal sources (admin_seed, concierge_extract), there must still be a sentinel observation row in `event_source_observations` to anchor the entry. The Trust agent or admin tooling creates that sentinel when needed (a synthetic observation with `created_by_role = 'admin_seed'` or `'concierge_extract'`).
- This forces every proposal to carry source attribution at the schema level.

### 3.4 Critique — `source_id` denormalized

Like `event_source_observations.source_type` denormalization (3b), `source_id` is denormalized from the observation for fast filter at review time. The review queue often filters by source. Joining to observations to get source_id every time is wasteful.

### 3.5 Critique — `field_name` CHECK constraint

The user prompt listed `field_name` without constraint. **Recommend a CHECK enum** of allowed event-field names. Reasoning:

- Free-text `field_name` allows derivation bugs to write entries for non-existent fields (typos, refactors).
- Constraining to a known allowlist forces the Trust agent / admin tooling to declare which fields are tracked.
- The list ships small (title, start_at, end_at, venue_id, venue_name, ticket_url, status, description, organizer). New fields require a migration to widen the CHECK.

Alternatively, defer the CHECK and rely on application-level validation. **Recommend keeping the CHECK** — schema-level constraints catch derivation bugs that application code might miss.

### 3.6 Critique — `change_severity` (data-model-plan §5)

Not in the user prompt's column list, but data-model-plan §5 included `change_severity TEXT CHECK (change_severity IN ('minor','material','cancellation_risk'))`. **Recommend including it.** Reasoning:

- Critical for review-queue prioritization. Reviewers want `cancellation_risk` rows surfaced first.
- Maps to the `possible_cancellation` modifier in the future derivation function.
- The Trust agent emits severity at derivation time based on field + delta magnitude.
- Example mapping: change to `status` with proposed value `'cancelled'` → `cancellation_risk`. Change to `start_at` by >1 hour → `material`. Change to `description` → `minor`.

### 3.7 Critique — `proposal_source` enum (memo Q6 boundary at 3c)

Not in the user prompt directly, but inferred from COMMUNITY-CORRECTION-01 boundary discussion. **Recommend including it.** Mirrors the `event_source_observations.created_by_role` pattern (memo Q6).

Allowed values:
- `'derivation'` — Trust agent derived from an observation. Default.
- `'admin_seed'` — admin manually seeded a proposal.
- `'concierge_extract'` — concierge surface extracted a proposal from a user interaction (still service_role write).

**No `'user_direct'`** — community corrections cannot directly insert into `event_change_log` from a user form. They live in a separate future surface and flow into `event_change_log` only via service_role indirection (analogous to `'community_evidence_fetch'` for observations). See §11.6.

### 3.8 Critique — `derivation_run_id` (matches `agent_run_id` from 3b)

The user prompt listed `derivation_run_id`. **Recommend bare uuid, no FK in 3c.** Same reasoning as memo Q5 / `agent_run_id`: the `derivation_runs` table doesn't exist yet (it ships with the Step 4 derivation function). Adding the FK now would force creating that table prematurely.

A future migration tightens with a partial CHECK or FK once the derivation runs registry exists.

### 3.9 Critique — `status` workflow (mutable, not append-only)

Unlike `event_source_observations` (append-only, RLS-deny on UPDATE), `event_change_log` has a **mutable `status` column** by design. Reasoning:

- Status transitions (`pending → approved → applied` or `pending → rejected`) are core to the workflow.
- A pure append-only model would write a new row for every transition, bloating the table proportionally to review activity.
- This matches the existing pattern on `venue_claims`, `organization_claims`, and `event_claims`, all of which have mutable status with `reviewed_by`/`reviewed_at`.
- Append-only audit is preserved at a different layer: every applied change emits a row in `event_audit_log`. The change_log is workflow state; the audit log is history.

UPDATE policies (see §5) restrict who can transition status and what transitions are allowed.

`'superseded'` status: when a newer change_log entry for the same `(event_id, field_name)` makes an older `pending` entry obsolete, the older entry transitions to `'superseded'` rather than being deleted. Preserves review history.

`'withdrawn'` status: the proposer (admin/system) can withdraw a `pending` proposal before review.

### 3.10 Critique — `applied_at` (added)

Not in user prompt, but recommended. Captures the moment the change was applied to `events`, distinct from `reviewed_at` (when status moved to `approved`). Useful when application happens asynchronously after approval.

Optional alternative: skip `applied_at` and rely on the corresponding `event_audit_log.created_at` after a future link column is added. **Recommend keeping `applied_at` in 3c** — it costs one timestamptz column and decouples the change_log from event_audit_log.

### 3.11 Out-of-scope columns explicitly NOT in 3c

- `applied_audit_log_id` (FK to event_audit_log row that recorded the application). Useful but premature; defer.
- `change_summary` jsonb. Free-form data. If needed, use `change_reason` text.
- `priority` integer. Severity already encodes this.
- `claim_context_id`. Whether the reviewer is a claimed-source owner or admin can be derived from `reviewed_by`'s role at review time. No need to materialize.

## 4. Mutability Posture

`event_change_log` is **workflow-mutable**, in contrast to `event_source_observations` (append-only) and `event_audit_log` (append-only). The mutability is bounded:

- **INSERT** by `service_role` only (Trust agent / admin tooling / concierge). No app-role INSERT in 3c.
- **UPDATE** restricted to specific status transitions:
  - `pending → approved`: `reviewed_by`, `reviewed_at`, `status` (admin or claimed-source reviewer; service_role).
  - `pending → rejected`: same fields (admin or claimed-source).
  - `pending → withdrawn`: status only (system or proposer).
  - `pending → superseded`: status only (system).
  - `approved → applied`: status, `applied_at` (system, when application code mutates events).
- **No transitions** out of terminal states (`applied`, `rejected`, `withdrawn`, `superseded`). New proposals go in new rows.
- **DELETE** by `service_role` only (retention; admin-triggered or scheduled). No app-role DELETE.

This is a **workflow table**, not a fact log. Append-only purity belongs to `event_audit_log` and `event_source_observations`. The change_log carries workflow state; the audit log carries the immutable record of what actually happened.

## 5. RLS Posture

`ENABLE ROW LEVEL SECURITY` is mandatory per [database security invariants](../../.claude/rules/00-governance-and-safety.md). Proposed defaults:

| Role | Action | Policy | Rationale |
|---|---|---|---|
| `anon` | All | **None** | Change_log is operational + review-queue data. No public surface in 3c. |
| `authenticated` (self) | All | **None** | Users do not write directly. Community corrections live in a separate future surface and flow into change_log only via service_role indirection (memo Q6 analog). |
| `authenticated` (admin via `public.is_admin()`) | `SELECT` | `USING (public.is_admin())` | Admin reads the review queue. |
| `authenticated` (admin) | `UPDATE` | `USING (public.is_admin()) WITH CHECK (public.is_admin() AND status IN ('approved','rejected'))` (or similar transition guard) | Admin can review (transition pending → approved/rejected). |
| `authenticated` (admin) | `INSERT` | **None initially.** Add only if admin-seed becomes a real path. | Most proposals come from `service_role` (Trust agent). Admin-seed deferred to a later step. |
| `authenticated` (admin) | `DELETE` | **None.** Retention runs as service_role. | |
| `service_role` | All | bypass | Trust agent, status-transition jobs, retention. |

**No public view in 3c.** Same logic as 3a / 3b: the future derivation function reads as service_role and serves digested labels through API endpoints, not raw rows.

**Transition-aware UPDATE policy** is the trickiest part. Postgres RLS UPDATE policies see both OLD and NEW. The admin policy can constrain status transitions at the row level (e.g., `OLD.status = 'pending' AND NEW.status IN ('approved','rejected')`). The 3c-execute migration author should test these transitions explicitly. See §9.4.

## 6. Indexes

Recommended indexes for 3c (justified each):

| Index | Columns | Why |
|---|---|---|
| `idx_event_change_log_event_status_created` | `(event_id, status, created_at DESC)` | Latest pending/approved entries per event — review queue. |
| `idx_event_change_log_observation` | `(observation_id)` | Trace deltas back to observation. |
| `idx_event_change_log_source` | `(source_id)` | Per-source filter for review and health metrics. |
| `idx_event_change_log_status_severity` | `(status, change_severity)` | Review queue prioritization (`status = 'pending' AND change_severity = 'cancellation_risk'`). |
| `idx_event_change_log_pending_severity_created` | `(change_severity, created_at DESC) WHERE status = 'pending'` | Partial index for the high-priority pending queue. |

**Defer**:

- A composite `(event_id, field_name, status)` for "latest pending proposal for this field on this event" — defer until EXPLAIN ANALYZE evidence.
- GIN on a future jsonb column — no jsonb in 3c.

**No partitioning in 3c.** Same reasoning as observations (memo Q3): no traffic data, defer.

## 7. Compatibility Guarantees

- **Active rule unchanged.** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed. Phase 4.89 invariants hold byte-for-byte.
- **`web/src/lib/events/verification.ts` unchanged.** No code modification ships in 3c.
- **No badge change.** UI continues to render the existing Confirmed/Unconfirmed/Cancelled states from `last_verified_at` and `status`.
- **No admin auto-confirm change.** All paths in [Phase 4.89 §Auto-Confirmation Paths](../../.claude/rules/10-web-product-invariants.md) continue to set `last_verified_at` exactly as today.
- **No reads from `event_change_log` in 3c.** No application code, RPC, route, or UI reads the new table. The first reader is the future derivation function (Step 4) and the future review queue UI.
- **No writes from app code in 3c.** Only `service_role` writes during Trust-agent or admin-tooling runs (which themselves are not authorized in 3c).
- **Lane 5 PR A `event_audit_log` is unchanged.** Lane 5 PR B scope is not expanded by 3c.
- **COMMUNITY-CORRECTION-01 unchanged.** Community corrections continue to live in their own future surface; they do not directly insert into `event_change_log`.
- **SOURCE-OBS-01 stays Draft / Proposed / Not Active.**

## 8. Differentiation from `event_audit_log`

The clearest way to keep these two tables distinct is to remember **when in the lifecycle each row is born:**

| Surface | Born when | Mutable? | Source of writes | Example use |
|---|---|---|---|---|
| `event_source_observations` | A registered source is fetched and parsed. | Append-only (RLS-deny + Deduper carve-out). | `service_role` (crawler / Deduper / retention). | "What did the venue site say at 2pm yesterday?" |
| `event_change_log` | Trust agent derives a delta from an observation against the current event state. | Workflow-mutable (status transitions). | `service_role` + admin (review). | "There's a pending proposal to change start_at on event E from 7pm to 8pm. Confidence 0.92. Severity material. Awaiting admin review." |
| `event_audit_log` | The trusted event record was actually mutated (POST/PATCH/DELETE on `events`). | Append-only (Lane 5 PR A contract). | API route hooks (service_role insert). | "Admin user A applied the start_at change at 3:14pm." |

A single user-visible event change passes through all three:

1. **Observe.** Crawler writes `event_source_observations` row at fetch time.
2. **Propose.** Trust agent reads the observation, compares to `events.start_at`, writes `event_change_log` row with `status = 'pending'`.
3. **Review.** Admin or claimed-source owner reviews the proposal. Updates change_log row to `status = 'approved'` (or `'rejected'`).
4. **Apply.** Approved change is applied via the existing event-edit code path (or a future automation). The application emits a row in `event_audit_log`. The change_log row transitions to `status = 'applied'` with `applied_at` set.

The three artifacts answer three different questions: what does the source say (observation), what should change (change_log), what was changed (audit_log). Conflating them collapses the lifecycle and breaks audit-trail truthfulness.

## 9. Why This Must Not Activate SOURCE-OBS-01 or Badge Behavior

Step 3c ships a workflow table. It does not:

- Read or write `last_verified_at`.
- Modify `verification.ts`.
- Render any badge or label.
- Alter the public verification surface.
- Activate the multi-state badge taxonomy from [SOURCE_REGISTRY.md §6](../strategy/SOURCE_REGISTRY.md).
- Touch `docs/CONTRACTS.md §SOURCE-OBS-01`.

The derivation function (Step 4) reads `event_change_log` (and `event_source_observations` and claim tables) to produce the future `EventVerificationDisplay`. That function ships under its own stop-gate. The badge component update (Step 6) uses a feature flag default-OFF. The CONTRACTS.md supersession (Step 8) is the only step that retires the binary `last_verified_at` rule.

3c is purely about **adding a workflow surface**. Zero user-facing impact.

## 10. Rollback Plan

### 10.1 Forward rollback (3c-only)

`DROP TABLE IF EXISTS public.event_change_log` is sufficient. As of 3c:

- No FKs from existing tables point at `event_change_log` (it's a new sink, not a source).
- No application code reads or writes the table.
- No view depends on it.
- The `BEFORE UPDATE` trigger and its function drop with the table.

### 10.2 Rollback once Step 4 (derivation function) ships

After Step 4, application code reads change_log to produce the verification display. Rolling back 3c at that point would break the derivation. Rollback path becomes:

1. Set the derivation feature flag OFF (already default-off until Step 8).
2. Confirm no code path reads `event_change_log`.
3. Drop the table.

### 10.3 Rollback runbook stub

The 3c-execute PR description should attach a short rollback runbook fragment:

```sql
-- step-3c rollback
BEGIN;
DROP TRIGGER IF EXISTS event_change_log_updated_at ON public.event_change_log;
DROP FUNCTION IF EXISTS public.update_event_change_log_updated_at();
DROP TABLE IF EXISTS public.event_change_log;
COMMIT;
```

### 10.4 What is preserved through any rollback

- `events.last_verified_at` and `events.verified_by` are not touched by 3c.
- `event_audit_log` is not touched by 3c.
- `event_source_observations` and `event_sources` are not touched by 3c.
- `verification.ts` semantics are not touched by 3c.

## 11. Open Questions

These should be resolved before the 3c-execute migration PR opens, but are not required to land this brief.

### 11.1 `event_id` NOT NULL vs nullable

**Recommended (§3.2):** `NOT NULL`. Change-log entries make no sense for unmatched observations.

**Alternative:** nullable, allowing the Trust agent to record a tentative delta against a candidate event. Adds complexity for no clear benefit; reject.

### 11.2 Status transition enforcement: trigger vs RLS

**Recommended (§5):** RLS UPDATE policies that constrain transitions (using OLD/NEW) for admin role. service_role bypasses RLS and is gated by code review.

**Alternative:** A `BEFORE UPDATE` trigger that raises on invalid transitions for all roles including service_role. Defense-in-depth. **Worth considering** for 3c-execute. Decision deferred.

### 11.3 `field_name` CHECK enum vs free text

**Recommended (§3.5):** CHECK enum of known event fields. Catches derivation bugs at the schema level.

**Alternative:** free text + application validation. Simpler schema; less defense.

### 11.4 `change_severity` rules

**Recommended (§3.6):** include the column with `('minor','material','cancellation_risk')`. Trust agent emits severity per observation/field/delta heuristic.

**Open:** what's the exact mapping from (field, delta magnitude) to severity? That's a Trust-agent-design question, not a schema-design question. Schema captures the column; rules ship with Step 4.

### 11.5 `applied_audit_log_id` link

**Recommended:** defer in 3c. A change_log row in `'applied'` status correlates with an `event_audit_log` row by event_id + timestamp + actor; the explicit FK can come later.

**Alternative:** add the FK column now (nullable). Cheap. **Worth a final call** before the migration ships.

### 11.6 Community corrections — same table or separate?

**Recommended (§3.7):** **Separate.** Community corrections live in their own future surface (e.g., `community_correction_proposals` table). They feed `event_change_log` only via service_role indirection (a Trust-agent-equivalent that processes community submissions, fetches cited URLs, and writes both an observation and a change_log entry).

**Alternative:** Unified table with a `'community_correction'` enum value on `proposal_source`. Simpler but conflates two distinct lifecycles (system-derived vs user-initiated). **Reject.**

This is the most consequential open question. Either path preserves COMMUNITY-CORRECTION-01 (no user direct write), but they differ in surface complexity.

### 11.7 Retention / partitioning

**Recommended:** defer per memo Q3 reasoning. No partitioning in 3c. Add a one-line comment for future review at >10M rows or 12 months.

### 11.8 Multi-field proposals

**Recommended:** one row per (event, field). A single observation that disagrees on three fields produces three change_log rows.

**Alternative:** one row per observation with multiple deltas in jsonb. Simpler ingestion but worse for review-queue queries that filter by field. Reject.

## 12. Test Plan for the Future 3c-Execute PR

The 3c-execute PR will need (at minimum):

### 12.1 CI tripwires

- **RLS tripwire** green for `event_change_log`.
- **SECURITY DEFINER allowlist** unchanged (no new SECURITY DEFINER).
- **Postgres-owned views** — N/A (no view in 3c).
- **Privilege checks** — no new TRUNCATE/TRIGGER/REFERENCES on anon/authenticated.

### 12.2 Schema content scan (mirror of [3b test pattern](source-observation-step-3b-event-source-observations.test.ts))

- All columns from §3.1 present with correct types and nullability.
- All CHECK constraints reject invalid values (round-trip per enum: `field_name`, `change_severity`, `proposal_source`, `status`).
- All FKs in §3.1 exist with the specified ON DELETE behavior.
- Required indexes from §6 exist.
- Partial index `WHERE status = 'pending'` exists.
- `BEFORE UPDATE` trigger maintaining `updated_at` exists.

### 12.3 Workflow / status-transition tests

Critical for 3c (more than for 3a/3b):

- **`pending → approved`** by admin via UPDATE: succeeds; sets `reviewed_by`, `reviewed_at`.
- **`pending → rejected`** by admin: succeeds.
- **`pending → withdrawn`** by service_role (proposer): succeeds.
- **`pending → applied`** by admin directly: must FAIL (must go through `approved` first).
- **`approved → applied`** by service_role (application code): succeeds; sets `applied_at`.
- **`applied → pending`** by anyone: must FAIL (terminal state).
- **`rejected → approved`** by anyone: must FAIL (terminal state).
- **Non-admin authenticated UPDATE**: must FAIL.
- **anon UPDATE**: must FAIL.

### 12.4 RLS tests (positive and negative)

- `anon`: cannot SELECT, INSERT, UPDATE, DELETE.
- `authenticated` (non-admin): cannot SELECT, INSERT, UPDATE, DELETE.
- `authenticated` (admin via `is_admin()`): can SELECT all rows; can UPDATE only with valid transitions; cannot INSERT, DELETE in 3c.
- `service_role`: can INSERT, UPDATE (any transition), DELETE.

### 12.5 Compatibility tests

- All `verification.ts` unit tests remain green; no behavioral diff.
- All Phase 4.89 invariants tests remain green.
- All DSC TEST suppression tests remain green.
- `event_audit_log` unit tests (Lane 5 PR A) remain green; no schema interaction with 3c.
- Discovery surfaces produce identical output before and after the migration on a representative event sample.

### 12.6 Negative tests

- `field_name` outside the CHECK enum is rejected.
- `change_severity` outside the enum is rejected.
- `proposal_source` outside the enum is rejected (especially: `'user_direct'` rejected).
- `status` outside the enum is rejected.
- `confidence` outside `[0, 1]` is rejected.
- Inserting with `event_id NULL` is rejected.
- Inserting with `observation_id NULL` is rejected.
- Inserting with `source_id NULL` is rejected.
- Deleting a referenced observation cascades change_log rows.
- Deleting a referenced event cascades change_log rows.
- Deleting a referenced source while change_log rows exist is rejected (ON DELETE RESTRICT).

### 12.7 Migration guardrail / claims entry

- The 3c-execute PR must add an entry to `docs/investigation/track1-claims.md` claiming the migration file (per the `event-detail-type-badges.test.ts` guardrail). Same lane-discipline pattern as PR-226 / PR-244.

## 13. Stop-Gate Language for the 3c-Execute PR

When the future 3c-execute PR is opened, its description must include the following statements (verbatim or paraphrased while preserving meaning):

- "This PR implements `docs/investigation/source-observation-step-3c-event-change-log-brief.md`."
- "Runtime verification behavior is not changed. `last_verified_at IS NOT NULL ⇒ Confirmed` remains the only active rule."
- "[`web/src/lib/events/verification.ts`](https://github.com/samiserrag/denver-songwriters-collective/blob/main/web/src/lib/events/verification.ts) is unchanged."
- "[SOURCE-OBS-01](https://github.com/samiserrag/denver-songwriters-collective/blob/main/docs/CONTRACTS.md) remains Draft / Proposed / Not Active."
- "No application code, API/MCP/crawler/RPC route, badge, UI, or admin auto-confirm change is included. No reader or writer exists for `event_change_log` after this PR."
- "`event_audit_log` (Lane 5 PR A) semantics unchanged. Lane 5 PR B scope not expanded."
- "COMMUNITY-CORRECTION-01 boundary preserved: `proposal_source` enum has no `'user_direct'` value; community corrections do not directly insert into this table."
- "Migration not yet applied to any DB; the apply step is a separate stop-gate per [`30-supabase-migrations-and-deploy.md`](https://github.com/samiserrag/denver-songwriters-collective/blob/main/.claude/rules/30-supabase-migrations-and-deploy.md)."
- "Smoke / verification queries from §12 of the brief have been run and returned the expected results."

The reviewer compares the PR diff against this brief, checks the security tripwire, and validates the status-transition tests in §12.3 before approving.

## 14. Non-Goals (Explicit)

This brief does **not**:

- Author or commit any SQL migration.
- Modify [`web/src/lib/events/verification.ts`](../../web/src/lib/events/verification.ts) or any other application code.
- Add or modify any API/MCP/crawler/RPC route.
- Modify the verification UI, badge component, or any rendered surface.
- Change any admin auto-confirm path.
- Activate, supersede, or otherwise modify [SOURCE-OBS-01](../CONTRACTS.md).
- Begin operational ingestion of any external source.
- Authorize backfill execution.
- Authorize the 3c migration itself.
- Authorize any subsequent step (3d `artist_claims`, 3e `claim_status` trigger, 4 derivation function, 5 feature-flagged badge, 6 backfill, 7 supersession).
- Expand Lane 5 PR B scope.
- Touch `event_audit_log` shape or semantics.
- Authorize a community-correction direct-insert path.

---

**End of brief. Approval records the recommended shape; the 3c-execute migration PR is its own stop-gate.**

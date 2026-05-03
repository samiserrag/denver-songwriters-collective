# Source Observation Step 3c — Open Questions Decision Memo

**Status:** Decision memo — **does not authorize applying any migration**
**Lane:** Lane 6 (strategy and policy authoring)
**Created:** 2026-05-03
**Audience:** Future migration author and the reviewer for the step-3c stop-gate

**Predecessors (all merged on `main`):**

- [PR #214](https://github.com/samiserrag/denver-songwriters-collective/pull/214) — investigation: data model plan
- [PR #219](https://github.com/samiserrag/denver-songwriters-collective/pull/219) — Step 3a/general decision memo
- [PR #222](https://github.com/samiserrag/denver-songwriters-collective/pull/222) — Step 3a brief (`event_sources`)
- [PR #226](https://github.com/samiserrag/denver-songwriters-collective/pull/226) — Step 3a execute (applied to production)
- [PR #231](https://github.com/samiserrag/denver-songwriters-collective/pull/231) — `COMMUNITY-CORRECTION-01` principle
- [PR #234](https://github.com/samiserrag/denver-songwriters-collective/pull/234) — Step 3b brief (`event_source_observations`)
- [PR #238](https://github.com/samiserrag/denver-songwriters-collective/pull/238) — Step 3b decision memo
- [PR #244](https://github.com/samiserrag/denver-songwriters-collective/pull/244) — Step 3b execute (applied to production)
- [PR #252](https://github.com/samiserrag/denver-songwriters-collective/pull/252) — Step 3c brief (`event_change_log`)
- [docs/strategy/AGENTIC_EVENT_MAINTENANCE.md `COMMUNITY-CORRECTION-01`](../strategy/AGENTIC_EVENT_MAINTENANCE.md)
- [docs/strategy/SOURCE_REGISTRY.md](../strategy/SOURCE_REGISTRY.md)
- [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md) — Draft / Proposed / Not Active

> **No production verification behavior is changed by this memo.** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed, remains the only active rule per [Phase 4.89 Confirmation Invariants](../../.claude/rules/10-web-product-invariants.md). [SOURCE-OBS-01](../CONTRACTS.md) stays Draft / Proposed / Not Active. **Approving this memo does not authorize applying any migration.** The 3c-execute migration PR is its own stop-gate.

---

## 1. Purpose

Resolve the eight open questions raised in [§11 of the Step 3c brief](source-observation-step-3c-event-change-log-brief.md). For each question this memo captures:

- **Issue** — one-paragraph framing.
- **Recommendation** — the proposed default.
- **Tradeoffs** — what we gain, what we give up, what stays optional.
- **Blocks 3c-execute?** — Yes / No, with the reason.
- **Migration implication** — exact column / index / policy / trigger effect.
- **Rollback / amendment** — how to undo or change later.
- **Tests required** — what the 3c-execute PR must include.
- **COMMUNITY-CORRECTION-01 preservation** — explicit check.
- **`last_verified_at` preservation** — explicit check.

The output of approving this memo is a decision record the future 3c-execute migration PR can cite. It does **not** authorize that PR; the migration still requires its own stop-gate per [GOVERNANCE.md](../GOVERNANCE.md).

## 2. Bias

This memo prefers, in tension cases:

- **Conservative defaults.** Defer until evidence demands.
- **No premature tables or FKs.** Schema dependencies that require a future table to exist are deferred until that table actually ships.
- **Workflow integrity at the row level.** `event_change_log` is workflow state with status transitions, not append-only evidence. Status transitions are constrained.
- **Strict COMMUNITY-CORRECTION-01.** Community corrections never write `event_change_log` directly. Community corrections live in their own future surface and feed `event_change_log` only via service_role indirection (analogous to the crawler-fetch indirection from 3b memo Q6).
- **Three-artifact integrity.** Observations (immutable evidence) → change_log (workflow proposal) → audit_log (immutable applied history). No conflation.

These biases are restated in the recommendations where applicable.

## 3. Cross-cutting invariants

These hold across every recommendation below:

- `last_verified_at IS NOT NULL ⇒ Confirmed` remains the only active rule.
- SOURCE-OBS-01 stays Draft / Proposed / Not Active.
- Trust Layer Invariant ([.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md)) is non-negotiable.
- `event_audit_log` shape and semantics are unchanged. Lane 5 PR B scope is not expanded.
- COMMUNITY-CORRECTION-01 boundary is preserved at the schema level: `event_change_log.proposal_source` enum has no `'user_direct'` value; community corrections live in a separate future surface.
- Each step in [SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md) and the 3c brief retains its own future stop-gate.

---

## Q1. Should `event_id` ever be nullable?

### 1.1 Issue

`event_source_observations.event_id` is nullable (3b memo Q1: record-then-match design). Should `event_change_log.event_id` follow the same pattern, or differ?

### 1.2 Recommendation

**`event_id` is `NOT NULL`.** FK to `public.events(id) ON DELETE CASCADE`.

### 1.3 Tradeoffs

**Pros of `NOT NULL`:**

- Semantic invariant: a delta is *between event state and observed state*. If there is no event yet, there is nothing to compare against, so no delta exists.
- The Trust agent only generates change_log entries after the Deduper has linked the observation to an event. The observation's `event_id` will be set; the change_log's `event_id` inherits that.
- Cleaner derivation function: filtering NULL event_ids is unnecessary; queries that join `events` are FK-clean.
- Matches the workflow shape: observations precede match precedes proposal.

**Cons of `NOT NULL`:**

- If a future workflow needs "preliminary deltas" (e.g., proposed creation of a new event from a source listing), this table can't host them. They'd need a different surface.

**Pros of nullable:**

- Maximum flexibility: tentative deltas allowed.

**Cons of nullable:**

- Invites incorrect rows where a delta is recorded against an unmatched observation.
- Complicates derivation and review-queue queries (must filter NULL event_ids).
- "Preliminary delta" use case is better served by a richer observation in `'found'` state, not a change_log entry.

### 1.4 Blocks 3c-execute?

**No, but column shape is final once memo is approved.**

### 1.5 Migration implication

```
event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
```

### 1.6 Rollback / amendment

- Rollback: drops with the table.
- Loosening to nullable later: `ALTER TABLE event_change_log ALTER COLUMN event_id DROP NOT NULL` — straightforward.
- Tightening from nullable to NOT NULL later would require backfill if NULL rows existed; cleaner to enforce now.

### 1.7 Tests required

- Schema test: `event_id` is `NOT NULL`; FK exists with `ON DELETE CASCADE`.
- Round-trip: insert succeeds with valid `event_id`.
- Negative: insert with `event_id = NULL` fails.
- Cascade: deleting a referenced `events` row removes its change_log entries.

### 1.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected. Boundary is enforced via `proposal_source` enum (Q6), not `event_id`.

### 1.9 `last_verified_at` preservation

✅ Unaffected. The new column is in a new table; no read or write of `last_verified_at` in 3c.

---

## Q2. Should status transitions be RLS-only or enforced by trigger?

### 2.1 Issue

Status transitions (`pending → approved/rejected/applied/withdrawn/superseded`) need enforcement. RLS UPDATE policies can constrain transitions for application roles using `OLD`/`NEW`. service_role bypasses RLS, so a service_role bug could violate the workflow (e.g., transition `applied → pending`). A `BEFORE UPDATE` trigger raises on invalid transitions for **all** roles including service_role.

### 2.2 Recommendation

**Both — RLS UPDATE policies for app-role enforcement, plus a `BEFORE UPDATE` trigger as defense-in-depth across all roles including service_role.**

The trigger raises an exception if:

- Transition out of a terminal state (`applied`, `rejected`, `withdrawn`, `superseded`) — terminal states never change.
- Direct `pending → applied` (must go through `approved` first).
- Any other invalid transition per the documented state machine.

### 2.3 Tradeoffs

**RLS-only:**

- Pros: simpler; matches existing claim-table pattern (`venue_claims`, `organization_claims`); fewer migration moving parts.
- Cons: service_role bypasses RLS. A service_role bug (Trust agent, status-transition job, retention) could break workflow invariants.

**Trigger-only:**

- Pros: defense-in-depth across all roles, including service_role.
- Cons: slightly more complex; must update trigger logic when adding new statuses; harder to debug (exception from a trigger function vs. a clear policy denial).

**Both:**

- Pros: belt and suspenders. RLS handles the app-role boundary cleanly; trigger backstops against invariant violations from service_role.
- Cons: schema complexity; two enforcement points to keep in sync.

For a workflow table where status invariants are critical to the audit trail, defense-in-depth is worth the extra surface. The trigger function is small (a state-machine check); the RLS policies are the same shape as existing claim tables.

### 2.4 Blocks 3c-execute?

**No.** Implementation choice. The migration ships RLS policies regardless; the trigger is a small additional clause.

### 2.5 Migration implication

```
-- RLS UPDATE policy (admin role; transitions constrained via OLD/NEW)
CREATE POLICY event_change_log_admin_update
ON public.event_change_log
FOR UPDATE
TO authenticated
USING (public.is_admin() AND <transition guard>)
WITH CHECK (public.is_admin() AND <transition guard>);

-- Trigger function
CREATE OR REPLACE FUNCTION public.event_change_log_validate_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Reject transitions out of terminal states
  IF OLD.status IN ('applied','rejected','withdrawn','superseded')
     AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Cannot transition out of terminal status %', OLD.status;
  END IF;
  -- Reject direct pending -> applied
  IF OLD.status = 'pending' AND NEW.status = 'applied' THEN
    RAISE EXCEPTION 'Direct pending -> applied not allowed; must transition through approved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Trigger
CREATE TRIGGER event_change_log_validate_transition
  BEFORE UPDATE ON public.event_change_log
  FOR EACH ROW EXECUTE FUNCTION public.event_change_log_validate_transition();
```

The function is `SECURITY INVOKER` (default), not `SECURITY DEFINER`. No tripwire concern.

### 2.6 Rollback / amendment

- Rollback: drop the trigger and function with the table.
- Amendment (e.g., adding new status values): update the function body and the CHECK enum on `status` in a future migration.

### 2.7 Tests required

The 3c-execute PR must test the full transition matrix:

- `pending → approved` (admin via RLS UPDATE; trigger allows): succeeds.
- `pending → rejected` (admin): succeeds.
- `pending → withdrawn` (system or proposer via service_role): succeeds.
- `pending → superseded` (system via service_role): succeeds.
- `pending → applied` direct (any role): **fails** (trigger raises).
- `approved → applied` (system via service_role): succeeds.
- `applied → pending` (any role): **fails** (trigger raises — terminal).
- `applied → approved` (any role): **fails** (terminal).
- `rejected → pending` (any role): **fails** (terminal).
- `withdrawn → pending` (any role): **fails** (terminal).
- `superseded → pending` (any role): **fails** (terminal).
- `authenticated` non-admin UPDATE: **fails** (RLS denial).
- `anon` UPDATE: **fails** (RLS denial).

### 2.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected by transition mechanics. The boundary is enforced at INSERT (proposal_source enum), not UPDATE.

### 2.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q3. Should `field_name` be free-form text or CHECK-enum constrained?

### 3.1 Issue

`field_name` identifies which event field the proposal targets. Free-form text accepts any value (typos, refactors, derivation bugs). CHECK enum constrains to a known allowlist; widening requires a small migration.

### 3.2 Recommendation

**CHECK enum** with the initial allowlist:

- `title`
- `start_at`
- `end_at`
- `venue_id`
- `venue_name`
- `ticket_url`
- `status`
- `description`
- `organizer`

### 3.3 Tradeoffs

**Pros of CHECK enum:**

- Catches derivation bugs at the schema level (typos like `'titel'` or `'star_at'` are rejected before they pollute the table).
- Forces explicit declaration of which fields are tracked.
- Easy to widen later via `ALTER TABLE … DROP CONSTRAINT … ; ADD CONSTRAINT …`.

**Cons of CHECK enum:**

- Every new tracked field requires a migration. Acceptable cost.
- Inflexible compared to free text.

**Pros of free text:**

- No migration needed when tracking new fields.
- Maximum flexibility.

**Cons of free text:**

- Derivation bugs silently accepted.
- Cleanup later (after bad rows accumulate) is harder than catching at insert.

The bias toward "catches bugs at the schema level" wins. Migration to widen is cheap.

### 3.4 Blocks 3c-execute?

**No.** Just a CHECK clause in the migration.

### 3.5 Migration implication

```
field_name TEXT NOT NULL CHECK (field_name IN (
  'title',
  'start_at',
  'end_at',
  'venue_id',
  'venue_name',
  'ticket_url',
  'status',
  'description',
  'organizer'
)),
```

### 3.6 Rollback / amendment

- Rollback: drops with the table.
- Adding a new field name later: `ALTER TABLE event_change_log DROP CONSTRAINT event_change_log_field_name_check; ALTER TABLE event_change_log ADD CONSTRAINT event_change_log_field_name_check CHECK (field_name IN (...));`. No row backfill needed.

### 3.7 Tests required

- Schema test: CHECK constraint exists with the listed values.
- Positive: insert with each allowlisted value succeeds.
- Negative: insert with `field_name = 'invalid_field'` fails.
- Negative: insert with `field_name = NULL` fails (NOT NULL).

### 3.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected.

### 3.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q4. Should `change_severity` rules live in schema, derivation code, or review UI?

### 4.1 Issue

`change_severity` (`'minor'` / `'material'` / `'cancellation_risk'`) drives review-queue prioritization and the future `possible_cancellation` modifier. Where do the rules that EMIT severity live?

### 4.2 Recommendation

**Three-layer separation:**

- **Schema:** column with CHECK enum over the three severity values. No rules computed in schema.
- **Derivation code (Trust agent / Step 4):** emits the severity at INSERT time based on documented heuristics (e.g., `proposed_value = 'cancelled'` → `cancellation_risk`; `start_at` delta > 1 hour → `material`; `description` change → `minor`).
- **Review UI:** displays severity; **does not mutate** it.

`change_severity` is **immutable per row** in 3c. If the derivation emits the wrong severity, the correction is to write a new change_log entry that supersedes the prior one, not to UPDATE severity in place.

### 4.3 Tradeoffs

**Three-layer separation (recommended):**

- Pros: schema constrains valid values; rules live where they evolve fastest (derivation code, shipped with Step 4); UI is read-only display.
- Cons: severity rules are not enforced in SQL — a buggy Trust agent could emit wrong values within the enum.

**Computed in SQL via trigger:**

- Pros: severity is always correct relative to the row's other fields.
- Cons: rules are far from the derivation logic; field-by-field severity computation in PL/pgSQL is awkward; schema migration burden every time rules change.

**Computed in review UI:**

- Pros: maximum flexibility.
- Cons: not stored; review-queue queries can't sort by severity efficiently. Reject.

### 4.4 Blocks 3c-execute?

**No.** Schema captures the column. Rules are a Step 4 (Trust agent) concern.

### 4.5 Migration implication

```
change_severity TEXT NOT NULL CHECK (change_severity IN (
  'minor',
  'material',
  'cancellation_risk'
)),
```

No trigger. No function. Severity is provided by the inserter (Trust agent or admin tooling).

### 4.6 Rollback / amendment

- Rollback: drops with the table.
- Adding new severity values later: standard CHECK widening.
- Severity rules evolve in TypeScript when Step 4 ships; no schema impact.

### 4.7 Tests required

- Schema test: CHECK enum present.
- Positive: insert with each enum value succeeds.
- Negative: insert with `change_severity = 'critical'` (not in enum) fails.
- Negative: insert with `change_severity = NULL` fails (NOT NULL).
- Compatibility: severity does not affect `verification.ts` behavior in 3c (no reader exists yet).

### 4.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected.

### 4.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q5. Should applied proposals link directly to `event_audit_log`?

### 5.1 Issue

When a change_log entry transitions to `'applied'`, it correlates with an `event_audit_log` row written by Lane 5 PR A's API hooks. Should `event_change_log` carry an explicit FK or pointer to that audit row?

### 5.2 Recommendation

**Ship a nullable `applied_audit_log_id uuid` column with NO FK constraint in 3c.** This matches the `agent_run_id` / `derivation_run_id` pattern: forward-compat hook without premature dependency on Lane 5's table shape.

The Trust agent (or whoever transitions a row to `'applied'`) populates the column at apply time. Future migration can add the FK constraint when the link semantics are stable.

### 5.3 Tradeoffs

**Pro the column-without-FK approach (recommended):**

- Cheap to ship now (one nullable uuid column).
- Future apply-time correlation has a stable place to land.
- No premature dependency on `event_audit_log`'s shape (Lane 5 PR B may evolve it).
- Matches established forward-compat pattern (3b memo Q5: `agent_run_id` shipped without FK).

**Con:**

- Without an FK, drift is possible (a populated `applied_audit_log_id` could point at a deleted audit row). Acceptable: `event_audit_log` is append-only; rows aren't deleted.

**Pro shipping with FK now:**

- Tighter integrity.

**Con shipping with FK now:**

- Couples 3c to Lane 5 PR A's contract surface area.
- If Lane 5 PR B reshapes audit_log ID semantics, 3c must coordinate.
- Premature: no reader needs the FK in 3c.

**Pro deferring the column entirely:**

- Smallest possible 3c surface.

**Con deferring:**

- Future migration to add the column requires backfill if applied rows already exist.
- The Trust agent has nowhere to put the link until then.

### 5.4 Blocks 3c-execute?

**No.**

### 5.5 Migration implication

```
applied_audit_log_id UUID,  -- nullable; no FK in 3c
```

### 5.6 Rollback / amendment

- Rollback: drops with the table.
- Adding an FK later: `ALTER TABLE event_change_log ADD CONSTRAINT event_change_log_applied_audit_log_id_fkey FOREIGN KEY (applied_audit_log_id) REFERENCES public.event_audit_log(id) ON DELETE SET NULL;` (after backfill verification).

### 5.7 Tests required

- Schema test: column is `uuid`, nullable, no FK in 3c.
- Insert with `applied_audit_log_id = NULL` succeeds.
- Insert with `applied_audit_log_id = <uuid>` succeeds (no constraint validates target).
- After Step 4 / future steps that actually apply changes, verify the column gets populated.

### 5.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected.

### 5.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q6. Should community corrections share `event_change_log` or stay in a separate proposed-change queue?

### 6.1 Issue

`COMMUNITY-CORRECTION-01` (in [AGENTIC_EVENT_MAINTENANCE.md](../strategy/AGENTIC_EVENT_MAINTENANCE.md)) describes a proposed-change queue for community-submitted corrections. Should `event_change_log` be that queue, or should community corrections live in their own surface and feed `event_change_log` only via service_role indirection?

### 6.2 Recommendation

**Separate.** Community corrections live in a future, distinct table (e.g., `community_correction_proposals`). They feed `event_change_log` only via service_role indirection — analogous to the `'community_evidence_fetch'` indirection from 3b memo Q6.

The 3c-execute migration ships `event_change_log` with `proposal_source` enum that **explicitly excludes any user-direct value**: only `'derivation'`, `'admin_seed'`, and `'concierge_extract'` are allowed in 3c. RLS denies `authenticated` INSERT entirely.

### 6.3 Tradeoffs

**Pros of separate (recommended):**

- Preserves the three-artifact model from COMMUNITY-CORRECTION-01 §10.2 cleanly: observations / change_log / audit_log have distinct lifecycles; community corrections are a fourth surface.
- `event_change_log` stays focused on derivation/system proposals.
- Each surface evolves independently. The community-correction queue can have its own column shape (submitter identity, evidence URLs, AI confidence notes per the COMMUNITY-CORRECTION-01 §10.3 evidence bundle) without bloating `event_change_log`.
- Schema-level enforcement of "no user direct write" via the `proposal_source` enum.

**Cons of separate:**

- Two tables for related concepts.
- The future review queue UI must UNION across both for a unified review surface.

**Pros of unified:**

- Simpler model: one place for proposals.
- Single status workflow.

**Cons of unified:**

- Conflates derivation lifecycle (system) with submission lifecycle (user).
- Different validation rules per source — would require many nullable per-source columns.
- Harder to reason about; harder to enforce COMMUNITY-CORRECTION-01 at schema level.

The conservative bias and the existing three-artifact framing both favor separation.

### 6.4 Blocks 3c-execute?

**Yes for design clarity.** The `proposal_source` enum and RLS posture in the 3c-execute migration must encode "no user direct write." Separation is the path. **No** for migration timing — this can be encoded in 3c without the community-correction surface existing yet.

### 6.5 Migration implication

```
proposal_source TEXT NOT NULL DEFAULT 'derivation' CHECK (proposal_source IN (
  'derivation',
  'admin_seed',
  'concierge_extract'
)),
```

RLS:

- No INSERT policy for `anon`.
- No INSERT policy for `authenticated` (any role) in 3c.
- service_role INSERT (Postgres bypass).

The CHECK enum **has no value for "user direct write."** A future migration that adds a separate `community_correction_proposals` table will not need to widen this enum; instead, its service_role indirection will write `event_change_log` rows with `proposal_source = 'concierge_extract'` (or a future explicitly-named role like `'community_indirection'` if needed, added via CHECK widening).

### 6.6 Rollback / amendment

- Rollback: drops with the table.
- Future widening to add new sanctioned roles: standard CHECK update via `ALTER TABLE`. Future restricting requires a backfill check.
- The decision to keep community corrections in a separate table is a separate stop-gate; this memo does not authorize that surface.

### 6.7 Tests required

- Schema test: `proposal_source` CHECK enum exhaustively lists only the three values.
- Negative: `proposal_source = 'user_direct'`, `'user_correction'`, `'community_direct'` all rejected.
- RLS positive: `service_role` can INSERT with any of the three roles.
- RLS negative: `authenticated` (admin or non-admin) cannot INSERT in 3c.
- RLS negative: `anon` cannot INSERT.

### 6.8 COMMUNITY-CORRECTION-01 preservation

✅ **Strong preservation.** The boundary is encoded at the schema level: `proposal_source` enum exhaustively enumerates authorized writers; "user direct write" is structurally absent; RLS denies user inserts entirely.

### 6.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q7. Retention / partitioning posture

### 7.1 Issue

`event_change_log` is workflow-mutable. Applied / rejected / withdrawn rows accumulate over time. Should the migration ship with partitioning, retention policy, or neither?

### 7.2 Recommendation

**Ship without partitioning or retention.** Add a one-line code comment in the migration noting future review at the smaller of `>10M rows` or 12 months operating time. Same posture as the prior decision-memo Q3 from PR #219.

### 7.3 Tradeoffs

**Pros of partitioning at table-create:**

- Easier than retrofit. Postgres declarative partitioning by `created_at` quarter is the natural shape.
- Drop-old-partition is a clean retention path.

**Cons of partitioning:**

- Zero rows today. Partition design without traffic data is speculative.
- Postgres declarative partitioning has known footguns with indexes, FKs, and trigger inheritance.
- Trust agent traffic is not yet authorized; row volume is unknown.

**Pros of explicit retention:**

- Bounds growth deterministically.

**Cons of explicit retention:**

- Loses review history that may matter for auditing decisions retroactively.
- Premature.

**Pros of deferring:**

- Schema stays simple; decisions wait for real traffic.
- Future scheduled `DELETE` for terminal rows is a simple first-pass retention.
- Future partition retrofit is doable for predominantly append-then-terminal-update tables.

### 7.4 Blocks 3c-execute?

**No.**

### 7.5 Migration implication

```sql
-- Retention/partitioning intentionally deferred (Q7, this memo).
-- Revisit at >10M rows or 12 months operating time.
```

No DDL effect.

### 7.6 Rollback / amendment

- Nothing to roll back.
- Future scheduled `DELETE` for terminal rows is a separate stop-gate.
- Future partitioning retrofit (via `pg_partman` or manual repartition window) can ship later under stop-gate review.

### 7.7 Tests required

- None specific to retention/partitioning in 3c.
- The CI tripwire still applies; no new policy-change risk.

### 7.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected.

### 7.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q8. Single-field vs multi-field proposal rows

### 8.1 Issue

A single observation may disagree with the event on multiple fields (e.g., `start_at` AND `venue_id` AND `ticket_url`). Should this produce one row per `(event, observation, field)` (many rows), or one row per observation with a jsonb / array of deltas (fewer rows)?

### 8.2 Recommendation

**One row per `(event, observation, field)`.** A multi-field observation produces multiple change_log rows.

### 8.3 Tradeoffs

**Pros of one-row-per-field (recommended):**

- Each delta has its own status: a reviewer can approve `start_at` change but reject `ticket_url` change from the same observation.
- Indexable by `field_name` for review-queue queries that filter by field.
- Matches the field-level diff pattern from COMMUNITY-CORRECTION-01 §10.3 evidence bundle.
- Per-field severity is meaningful (`change_severity` per row).

**Cons of one-row-per-field:**

- Higher row count for multi-field observations.

**Pros of one-row-per-observation with jsonb deltas:**

- Smaller table.
- Atomic "this observation produced this delta set."

**Cons of one-row-per-observation with jsonb:**

- Cannot have per-field status without nested workflow logic in the jsonb.
- Worse for review-queue queries that filter by field.
- Harder to derive the future `details_changed_recently` modifier per field.
- Approving / rejecting individual fields requires whole-row UPDATE with carefully-managed jsonb merging.

The reviewer's per-field decision authority is the primary driver. One row per field wins.

### 8.4 Blocks 3c-execute?

**No.** The table shape recommended in the brief already implies this: `field_name` is per-row.

### 8.5 Migration implication

Standard table shape from the brief. No jsonb columns for delta sets. The `extracted_fields` jsonb already exists on `event_source_observations` for the long-tail extras; `event_change_log` does not need a jsonb here.

### 8.6 Rollback / amendment

- Rollback: standard table drop.
- If row-count growth ever becomes a concern, the Trust agent could batch single-field rows by observation in application code without changing schema.

### 8.7 Tests required

- Multi-field test: a single observation produces multiple change_log rows (one per field).
- Per-field UPDATE: approving one row's status doesn't affect siblings from the same observation.
- Sibling status independence: rows from the same observation can have different status values simultaneously.

### 8.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected.

### 8.9 `last_verified_at` preservation

✅ Unaffected.

---

## 4. Summary

| # | Question | Recommendation | Blocks 3c-execute? |
|---|---|---|---|
| 1 | `event_id` nullable vs required | **NOT NULL** with FK ON DELETE CASCADE | No |
| 2 | Status transitions: RLS-only or trigger? | **Both** — RLS for app-role, trigger as defense-in-depth | No |
| 3 | `field_name` enum vs free text | **CHECK enum** with 9-value initial allowlist | No |
| 4 | `change_severity` rules location | **Schema** (CHECK enum), **derivation code** (Trust agent emits at INSERT), **UI** (read-only display); severity immutable per row in 3c | No |
| 5 | Applied → audit_log link | **Ship `applied_audit_log_id uuid` nullable, no FK in 3c**; future FK is its own step | No |
| 6 | Community corrections — same table or separate | **Separate.** `proposal_source` enum has no `'user_direct'` value; community corrections live in a future surface and feed change_log only via service_role indirection | **Yes for design clarity** (enum + RLS); no for migration timing |
| 7 | Retention / partitioning | **Defer**; one-line comment for future review at >10M rows or 12 months | No |
| 8 | Single-field vs multi-field rows | **One row per (event, observation, field)**; per-field status independence | No |

**Net effect:** only Q6 has hard 3c-execute design implications (the `proposal_source` enum and RLS posture must encode "no user direct write"). Q1, Q3, Q4, Q5, Q7, Q8 are column shape / nullability / deferral decisions. Q2 ships both RLS and trigger (defense-in-depth) but is a schema implementation detail. None blocks the 3c-execute migration from shipping; Q6 shapes its content.

## 5. Stop-Gates

Per [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md) and [.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md):

- Approving this memo records *decisions* about the eight open questions; it does **not** authorize any migration, code, route, MCP surface, crawler, derivation function, badge, UI, or DB apply.
- The 3c-execute migration PR (the actual SQL for `event_change_log`) requires its own stop-gate, citing this memo and the 3c brief.
- The Trust agent / derivation function / Step 4 surface each retain their own stop-gates per [SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md).
- Trust Layer Invariant remains non-negotiable.
- COMMUNITY-CORRECTION-01 boundary is enforced structurally by the `proposal_source` enum + RLS denial above.
- SOURCE-OBS-01 stays Draft / Proposed / Not Active.

## 6. Non-Goals (Explicit)

This memo does **not**:

- Author or commit any SQL migration.
- Modify [`web/src/lib/events/verification.ts`](../../web/src/lib/events/verification.ts) or any other application code.
- Add or modify any API/MCP/crawler/RPC route.
- Modify the verification UI, badge component, or any rendered surface.
- Change any admin auto-confirm path.
- Activate, supersede, or otherwise modify [SOURCE-OBS-01](../CONTRACTS.md). It remains Draft / Proposed / Not Active.
- Begin operational ingestion of any external source.
- Authorize backfill execution.
- Authorize the 3c migration itself.
- Authorize any subsequent step (3d `artist_claims`, 3e `claim_status` trigger, 4 derivation function, 5–8 badge / supersession).
- Expand Lane 5 PR B scope.
- Touch `event_audit_log` shape or semantics.
- Authorize a community-correction surface or its direct-insert path.

---

**End of memo. Approval records the recommended defaults for the eight Step 3c open questions; the 3c-execute migration PR is its own stop-gate.**

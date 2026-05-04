# Source Observation Step 3d — Open Questions Decision Memo

**Status:** Decision memo — **does not authorize applying any migration**
**Lane:** Lane 6 (strategy and policy authoring)
**Created:** 2026-05-03
**Audience:** Future migration author and the reviewer for the step-3d stop-gate

**Predecessors (all merged on `main`; 3a + 3b + 3c also applied to production):**

- [PR #214](https://github.com/samiserrag/denver-songwriters-collective/pull/214) — investigation: data model plan
- [PR #219](https://github.com/samiserrag/denver-songwriters-collective/pull/219) — Step 3a/general decision memo
- [PR #222](https://github.com/samiserrag/denver-songwriters-collective/pull/222) — Step 3a brief (`event_sources`)
- [PR #226](https://github.com/samiserrag/denver-songwriters-collective/pull/226) — Step 3a execute (applied to production)
- [PR #231](https://github.com/samiserrag/denver-songwriters-collective/pull/231) — `COMMUNITY-CORRECTION-01` principle
- [PR #234](https://github.com/samiserrag/denver-songwriters-collective/pull/234) — Step 3b brief (`event_source_observations`)
- [PR #238](https://github.com/samiserrag/denver-songwriters-collective/pull/238) — Step 3b decision memo
- [PR #244](https://github.com/samiserrag/denver-songwriters-collective/pull/244) — Step 3b execute (applied to production)
- [PR #252](https://github.com/samiserrag/denver-songwriters-collective/pull/252) — Step 3c brief (`event_change_log`)
- [PR #256](https://github.com/samiserrag/denver-songwriters-collective/pull/256) — Step 3c decision memo
- [PR #264](https://github.com/samiserrag/denver-songwriters-collective/pull/264) — Step 3c execute (applied to production)
- [Step 3d brief](source-observation-step-3d-artist-claims-brief.md) (this memo's companion)
- [docs/strategy/AGENTIC_EVENT_MAINTENANCE.md `COMMUNITY-CORRECTION-01`](../strategy/AGENTIC_EVENT_MAINTENANCE.md)
- [docs/strategy/SOURCE_REGISTRY.md](../strategy/SOURCE_REGISTRY.md)
- [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md) — Draft / Proposed / Not Active

> **No production verification behavior is changed by this memo.** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed, remains the only active rule per [Phase 4.89 Confirmation Invariants](../../.claude/rules/10-web-product-invariants.md). [SOURCE-OBS-01](../CONTRACTS.md) stays Draft / Proposed / Not Active. **Approving this memo does not authorize applying any migration.** The 3d-execute migration PR is its own stop-gate; the apply step is a third stop-gate after that.

---

## 1. Purpose

Resolve the twelve open questions raised by the [Step 3d brief](source-observation-step-3d-artist-claims-brief.md) and the user-prompt scope. For each question this memo captures:

- **Issue** — one-paragraph framing.
- **Recommendation** — the proposed default.
- **Tradeoffs** — what we gain, what we give up, what stays optional.
- **Blocks 3d-execute?** — Yes / No, with the reason.
- **Migration implication** — exact column / index / policy / trigger effect.
- **Rollback / amendment** — how to undo or change later.
- **Tests required** — what the 3d-execute PR must include.
- **COMMUNITY-CORRECTION-01 preservation** — explicit check.
- **`last_verified_at` preservation** — explicit check.

The output of approving this memo is a decision record the future 3d-execute migration PR can cite. It does **not** authorize that PR; the migration still requires its own stop-gate per [GOVERNANCE.md](../GOVERNANCE.md), and the apply step requires a third stop-gate.

## 2. Bias

This memo prefers, in tension cases:

- **Conservative defaults.** Defer until evidence demands.
- **No premature paths.** The future self-claim INSERT path is intentionally not part of 3d. The schema reserves the value (`'manual_self_claim'`) but the policy does not authorize the path.
- **Workflow integrity at the row level.** Status transitions are constrained by RLS UPDATE policy + a `BEFORE UPDATE` validation trigger. Defense-in-depth, mirroring 3c memo Q2.
- **Strict COMMUNITY-CORRECTION-01.** The schema has no `'user_other'` evidence_kind value. There is no `authenticated` INSERT policy at apply time. Both are structural enforcements, not application-level disciplines.
- **Four-artifact integrity.** Observations (immutable evidence) → change_log (system proposal) → audit_log (immutable applied history) → claims (artist-asserted authorship). No conflation.

These biases are restated in the recommendations where applicable.

## 3. Cross-cutting invariants

These hold across every recommendation below:

- `last_verified_at IS NOT NULL ⇒ Confirmed` remains the only active rule.
- SOURCE-OBS-01 stays Draft / Proposed / Not Active.
- Trust Layer Invariant ([.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md)) is non-negotiable.
- `event_audit_log` shape and semantics are unchanged. Lane 5 PR B scope is not expanded.
- COMMUNITY-CORRECTION-01 boundary is preserved at the schema level: `evidence_kind` enum has no `'user_other'` value; no `authenticated` INSERT policy ships in 3d.
- Existing claim tables (`venue_claims`, `organization_claims`, `event_claims`) are unchanged. 3d does not modify their schema, RLS, or grants.
- `event_change_log` (3c), `event_source_observations` (3b), `event_sources` (3a) are unchanged.
- Each step in [SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md) and the 3d brief retains its own future stop-gate.

---

## Q1. Schema — final column list, types, nullability

### 1.1 Issue

The brief proposes 13 columns. The user prompt proposed a subset. This question locks the final shape.

### 1.2 Recommendation

**Adopt the brief's §3.1 column set verbatim:**

```text
id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid()
artist_profile_id   uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
event_id            uuid         NOT NULL REFERENCES public.events(id) ON DELETE CASCADE
status              text         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn','superseded'))
evidence_kind       text         NOT NULL CHECK (evidence_kind IN ('manual_self_claim','concierge_extract','admin_seed','derivation'))
evidence_url        text         CHECK (evidence_url IS NULL OR length(evidence_url) <= 2048)
evidence_note       text         CHECK (evidence_note IS NULL OR length(evidence_note) <= 2000)
submitted_by        uuid         REFERENCES public.profiles(id) ON DELETE SET NULL
reviewed_by         uuid         REFERENCES public.profiles(id) ON DELETE SET NULL
submitted_at        timestamptz  NOT NULL DEFAULT now()
reviewed_at         timestamptz
created_at          timestamptz  NOT NULL DEFAULT now()
updated_at          timestamptz  NOT NULL DEFAULT now()
```

### 1.3 Tradeoffs

**Pros of this exact shape:**

- Captures the (artist, event, evidence, lifecycle) domain without ambiguity.
- All columns have a clear purpose; no aspirational columns shipping ahead of usage.
- `submitted_at` vs `created_at` decoupling supports admin backfill of historical claims.
- Length-bounded `evidence_url` and `evidence_note` provide schema-level abuse backstops.

**Cons:**

- 13 columns is more than 3a (`event_sources`) and slightly fewer than 3b (`event_source_observations`) and 3c (`event_change_log`). For a workflow surface this is appropriate.

### 1.4 Blocks 3d-execute?

**No, but column shape is final once memo is approved.**

### 1.5 Migration implication

Direct: every column above lands in the migration file as `CREATE TABLE` clauses. CHECK constraints are inline.

### 1.6 Rollback / amendment

- Rollback: `DROP TABLE` with the table.
- Adding columns later (e.g., `review_notes`, `derivation_run_id`): standard `ALTER TABLE … ADD COLUMN`.
- Tightening (e.g., making `submitted_by` NOT NULL once the self-claim path ships): possible after backfill verification.

### 1.7 Tests required

- Schema test: every column present with the listed type, nullability, default, and CHECK clause.
- Round-trip: `INSERT` of a representative row succeeds (via service_role).
- Negative: `INSERT` with NULL on any NOT NULL column fails.

### 1.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected. Boundary is enforced via `evidence_kind` enum (Q2) and absence of `authenticated` INSERT policy (Q5).

### 1.9 `last_verified_at` preservation

✅ Unaffected. The new column set is in a new table; no read or write of `last_verified_at` in 3d.

---

## Q2. `evidence_kind` enum domain — exhaustive list, exclusions explicitly named

### 2.1 Issue

`evidence_kind` discriminates the source of a claim row. The user prompt named four candidates and explicitly excluded `'user_other'`. This question locks the enum.

### 2.2 Recommendation

**Four values:**

- `'manual_self_claim'` — the artist submits via the future authenticated UI. **Reserved by the schema; not authorized in 3d** (no `authenticated` INSERT policy). Cannot be written until the future stop-gate that adds the INSERT path.
- `'concierge_extract'` — the concierge surface extracts a claim from a user interaction; service_role indirection writes the row.
- `'admin_seed'` — admin manually seeds (e.g., during backfill of pre-existing data); service_role write.
- `'derivation'` — a future Trust-agent-equivalent derives a claim candidate from observed evidence; service_role write.

**Explicitly excluded:**

- `'user_other'` — no schema-level "any user direct write" sentinel. Mirrors `event_change_log.proposal_source` (3c memo Q6).
- `'user_direct'` — same exclusion at the value name level.
- `'community_direct'` / `'community_correction'` / `'user_correction'` / `'user_submitted'` — none of these belong in `artist_claims`. Community corrections live in their own future surface and feed claims only via service_role indirection (mirroring the crawler-fetch indirection from 3b memo Q6).

### 2.3 Tradeoffs

**Pros of the four-value enum:**

- Each value names a sanctioned source, structurally enforced via CHECK.
- `'manual_self_claim'` is reserved up front; future migration adding the INSERT path doesn't need to widen the enum.
- COMMUNITY-CORRECTION-01 boundary is encoded at the schema level; no application-level discipline required.

**Cons:**

- Reserving `'manual_self_claim'` before the path ships is a small expressivity cost: a CHECK violation could fire if a buggy admin tool tries to write that value via service_role before the path is authorized. Mitigation: the future INSERT-path stop-gate is the right place to authorize `'manual_self_claim'` writes.

### 2.4 Blocks 3d-execute?

**Yes for design clarity.** The enum and RLS posture together enforce COMMUNITY-CORRECTION-01 structurally. Both must ship together.

### 2.5 Migration implication

```sql
evidence_kind TEXT NOT NULL CHECK (evidence_kind IN (
  'manual_self_claim',
  'concierge_extract',
  'admin_seed',
  'derivation'
)),
```

No DEFAULT. The writer must declare which kind of evidence the row records.

### 2.6 Rollback / amendment

- Rollback: drops with the table.
- Future widening (e.g., add `'partner_api'` for a future tier-A integration): standard CHECK update via `ALTER TABLE`.
- Future tightening (e.g., remove `'derivation'` if it never gets used): requires backfill check.

### 2.7 Tests required

- Schema test: CHECK enum exhaustively lists only the four values.
- Negative: `'user_other'`, `'user_direct'`, `'community_direct'`, `'user_correction'`, `'user_submitted'` are all rejected.
- Positive: each of the four values inserts successfully (via service_role).

### 2.8 COMMUNITY-CORRECTION-01 preservation

✅ **Strong preservation.** The boundary is encoded at the schema level: `evidence_kind` enum exhaustively enumerates authorized sources; "user direct write" is structurally absent.

### 2.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q3. `status` enum domain and allowed transitions

### 3.1 Issue

`status` controls the workflow lifecycle. The user prompt named five values: `pending`, `approved`, `rejected`, `withdrawn`, `superseded`. This question locks the enum and transitions.

### 3.2 Recommendation

**Five values:** `pending`, `approved`, `rejected`, `withdrawn`, `superseded`. **No `'applied'`** (that is a 3c-only concept; claims aren't applied to events).

**Allowed transitions:**

| From | To | Allowed by |
|---|---|---|
| `pending` | `approved` | RLS UPDATE (admin) + trigger |
| `pending` | `rejected` | RLS UPDATE (admin) + trigger |
| `pending` | `withdrawn` | service_role + trigger |
| `approved` | `superseded` | service_role + trigger |

**All other transitions are rejected by the BEFORE UPDATE trigger.** Specifically:

- Any transition out of `'rejected'`, `'withdrawn'`, or `'superseded'` (terminal).
- `pending → superseded` (must be `'withdrawn'` instead — see brief §7.1 rationale).
- `approved → pending` / `approved → rejected` / `approved → withdrawn` (no transitions back from approved except supersession).
- Any transition to `'applied'` (not in enum).

### 3.3 Tradeoffs

**Pros:**

- Five values cover the lifecycle without ambiguity.
- The `pending → withdrawn` vs `approved → superseded` split preserves the semantic distinction between "withdrawn before review" and "displaced after approval."
- Mirrors 3c's transition-table approach (memo Q2) — defense-in-depth via RLS + trigger.

**Cons:**

- Slightly more transition logic than a four-state machine. The cost is one extra trigger branch.

### 3.4 Blocks 3d-execute?

**No.** Schema implementation detail. The migration ships RLS + trigger with the documented transitions.

### 3.5 Migration implication

```sql
status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
  'pending',
  'approved',
  'rejected',
  'withdrawn',
  'superseded'
)),
```

Trigger function (see Q7) encodes the transition matrix.

### 3.6 Rollback / amendment

- Rollback: drops with the table.
- Adding new statuses (e.g., `'pending_evidence_review'`): standard CHECK widening + trigger function update.

### 3.7 Tests required

See brief §12.3 — full transition matrix coverage:

- Each allowed transition succeeds.
- Each forbidden transition fails (specifically `pending → applied`, `pending → superseded`, `approved → pending`, terminal-state egress).

### 3.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected. The boundary is enforced at INSERT (evidence_kind enum + no INSERT policy), not UPDATE.

### 3.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q4. FK ON-DELETE behavior for each FK

### 4.1 Issue

Four FKs in 3d. Each needs a deliberate ON DELETE behavior. This question locks them.

### 4.2 Recommendation

| FK column | Target | ON DELETE | Why |
|---|---|---|---|
| `artist_profile_id` | `public.profiles(id)` | `CASCADE` | The artist *is* the subject of the claim. Deleting their profile removes their claims. Mirrors `venue_claims.user_id` and `organization_claims.user_id`. |
| `event_id` | `public.events(id)` | `CASCADE` | A claim has no meaning without the event. Mirrors `event_change_log.event_id` (3c memo Q1). |
| `submitted_by` | `public.profiles(id)` | `SET NULL` | The act of submitting is part of history; the submitter pointer can go NULL when the profile is deleted. Preserves the row as historical evidence. |
| `reviewed_by` | `public.profiles(id)` | `SET NULL` | Same reasoning as `submitted_by`. |

### 4.3 Tradeoffs

**Pros:**

- Each FK behavior matches its semantic role (subject vs actor pointer).
- Consistent with existing claim tables.
- Consistent with 3c.

**Cons:**

- Two profiles FKs with different ON DELETE semantics is mildly asymmetric, but the asymmetry is intentional and documented in §3.2.

### 4.4 Blocks 3d-execute?

**No, but FK shape is final once memo is approved.**

### 4.5 Migration implication

Inline FK declarations on `CREATE TABLE`:

```sql
artist_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
```

### 4.6 Rollback / amendment

- Rollback: drops with the table.
- Changing ON DELETE later: `ALTER TABLE artist_claims DROP CONSTRAINT … ; ADD CONSTRAINT …`.

### 4.7 Tests required

- Deleting a referenced profile cascades the artist_profile_id FK (claim rows disappear).
- Deleting a referenced profile that is `submitted_by` or `reviewed_by` (but not the artist) sets those columns to NULL on existing rows.
- Deleting a referenced event cascades.

### 4.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected.

### 4.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q5. RLS policies — exact SQL shape; explicit confirmation that no authenticated INSERT exists at apply time

### 5.1 Issue

RLS posture is the structural enforcement of COMMUNITY-CORRECTION-01. The exact policy shapes need to be locked.

### 5.2 Recommendation

```sql
ALTER TABLE public.artist_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS artist_claims_admin_select ON public.artist_claims;
CREATE POLICY artist_claims_admin_select
ON public.artist_claims
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS artist_claims_admin_update ON public.artist_claims;
CREATE POLICY artist_claims_admin_update
ON public.artist_claims
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  AND status = 'pending'
)
WITH CHECK (
  public.is_admin()
  AND status IN ('approved', 'rejected')
);
```

**No INSERT policy in 3d.** **No DELETE policy in 3d.** **No FOR ALL policy in 3d.** **No `anon` policy in 3d.** **No `authenticated` non-admin policy in 3d.**

`service_role` bypasses RLS by Postgres semantics (no policy needed).

### 5.3 Self-claim INSERT path is a future stop-gate

The eventual `manual_self_claim` INSERT path will need an additional INSERT policy approximately of the shape:

```sql
-- FUTURE STOP-GATE — not part of 3d
CREATE POLICY artist_claims_self_insert
ON public.artist_claims
FOR INSERT
TO authenticated
WITH CHECK (
  evidence_kind = 'manual_self_claim'
  AND submitted_by = auth.uid()
  AND artist_profile_id = auth.uid()
  AND status = 'pending'
);
```

This policy is **explicitly not** authorized by the 3d-execute migration. It is a separate stop-gate (Step 3d.1 or Step 5 — naming TBD when proposed) with its own brief, decision memo, execute-PR, and apply-PR.

### 5.4 Tradeoffs

**Pros of admin-only RLS at apply time:**

- COMMUNITY-CORRECTION-01 is enforced structurally; not a discipline.
- Matches the precedent set by 3a, 3b, 3c.
- The transition guard (`USING status='pending'` and `WITH CHECK status IN ('approved','rejected')`) is the same shape as 3c's admin UPDATE policy.

**Cons:**

- Admin reviewers need separate tooling to do `pending → withdrawn` and `approved → superseded` transitions (those happen via service_role under code review). For 3d's apply-time inertness this is fine; the table has no rows yet.

### 5.5 Blocks 3d-execute?

**Yes for design clarity.** The exact policy shape and explicit absence of INSERT/DELETE policies must be encoded in the migration.

### 5.6 Migration implication

Above SQL block, plus `GRANT ALL ON public.artist_claims TO service_role;`.

### 5.7 Rollback / amendment

- Rollback: `DROP POLICY` x 2 + drop table.
- Adding the future `manual_self_claim` INSERT policy is a separate migration under a separate stop-gate.

### 5.8 Tests required

See brief §12.4:

- `anon` cannot SELECT/INSERT/UPDATE/DELETE.
- `authenticated` non-admin cannot SELECT/INSERT/UPDATE/DELETE.
- `authenticated` admin can SELECT all rows; can UPDATE only with `pending → approved/rejected`; cannot INSERT or DELETE in 3d.
- `service_role` can do anything (subject to the transition trigger from Q7).

### 5.9 COMMUNITY-CORRECTION-01 preservation

✅ **Strong preservation.** No `authenticated` INSERT policy ships in 3d; the schema itself denies user-driven writes. The future self-claim path requires its own stop-gate.

### 5.10 `last_verified_at` preservation

✅ Unaffected.

---

## Q6. Indexes — list with rationale

### 6.1 Issue

The brief §8 proposes five indexes (PK + four others) and defers a partial UNIQUE INDEX. This question locks the index list.

### 6.2 Recommendation

**Ship five indexes:**

| Index | Columns / WHERE | Why |
|---|---|---|
| `artist_claims_pkey` | `(id)` PRIMARY KEY | Standard. |
| `idx_artist_claims_artist` | `(artist_profile_id)` | Lookup all claims by artist. |
| `idx_artist_claims_event` | `(event_id)` | Lookup all claims for event. |
| `idx_artist_claims_status` | `(status)` | Status filter. |
| `idx_artist_claims_pending_submitted` | `(submitted_at DESC) WHERE status = 'pending'` | High-priority pending review queue. |

**Defer:**

- Composite `(artist_profile_id, event_id, status)` — defer until EXPLAIN ANALYZE evidence justifies it.
- **Partial UNIQUE INDEX** `(artist_profile_id, event_id) WHERE status IN ('pending','approved')` — **defer** for the reasons in §6.4 below.
- GIN — no jsonb in 3d.
- Partitioning — defer (same reasoning as 3c memo Q7).

### 6.3 Critique — partial UNIQUE INDEX deferral (the final-call open question)

Logical: an artist should have at most one active claim per event. A partial UNIQUE INDEX `(artist_profile_id, event_id) WHERE status IN ('pending','approved')` would enforce this at the schema level.

**Recommendation: defer.** Reasons:

- The "resubmit after rejection" path becomes tricky: if the prior row is `'rejected'` it's outside the UNIQUE; if it's `'pending'` (queued resubmit) the new INSERT would conflict. The future self-claim INSERT path needs to model this carefully.
- A straightforward `'rejected' → 'pending'` resubmit is forbidden by the trigger anyway (terminal). The artist must INSERT a new row for a resubmit, which the UNIQUE would block if the prior row was approved.
- Application-level uniqueness check (in the future self-claim INSERT API) is a cleaner place to handle the resubmit corner case, with a clear user-facing error message.
- The cost of deferring: a buggy admin-seed could create duplicate active claims. This is detectable via a validation query and fixable via service_role.

**Alternative: ship the partial UNIQUE now.** Worth a final call. If the future self-claim INSERT path's design is "always INSERT a new row, never UPDATE existing," the UNIQUE is harmful. If the design is "UPDATE the existing pending row," the UNIQUE doesn't fire. The future stop-gate for that path is the right place to decide.

**This memo recommends defer.** The 3d-execute migration ships without the partial UNIQUE; it can be added in a future migration under its own stop-gate.

### 6.4 Tradeoffs

**Pros of the five-index set:**

- Each index has a clear use case (artist lookup, event lookup, status filter, pending queue).
- The partial pending index is small (only pending rows) and high-value (review queue is the hot path).

**Cons:**

- No uniqueness enforcement at apply time. See §6.3 critique.

### 6.5 Blocks 3d-execute?

**No.** Index list is final once memo is approved; deferred items remain deferred.

### 6.6 Migration implication

```sql
CREATE INDEX IF NOT EXISTS idx_artist_claims_artist
  ON public.artist_claims(artist_profile_id);
CREATE INDEX IF NOT EXISTS idx_artist_claims_event
  ON public.artist_claims(event_id);
CREATE INDEX IF NOT EXISTS idx_artist_claims_status
  ON public.artist_claims(status);
CREATE INDEX IF NOT EXISTS idx_artist_claims_pending_submitted
  ON public.artist_claims(submitted_at DESC)
  WHERE status = 'pending';
```

### 6.7 Rollback / amendment

- Rollback: indexes drop with the table.
- Future composite or partial UNIQUE: standard `CREATE INDEX` migration.

### 6.8 Tests required

- All five indexes present.
- Deferred indexes (composite, GIN) explicitly absent.
- The partial pending index has the `WHERE status = 'pending'` predicate.

### 6.9 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected.

### 6.10 `last_verified_at` preservation

✅ Unaffected.

---

## Q7. Status-transition trigger semantics — exact transition table

### 7.1 Issue

The trigger function encodes the transition matrix. This question locks the function body.

### 7.2 Recommendation

```sql
CREATE OR REPLACE FUNCTION public.artist_claims_validate_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- No-op for same-status updates (e.g., updating evidence_note without changing status)
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Reject transitions out of terminal states
  IF OLD.status IN ('rejected', 'withdrawn', 'superseded') THEN
    RAISE EXCEPTION 'artist_claims: cannot transition out of terminal status %', OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- approved is near-terminal: only approved -> superseded is allowed
  IF OLD.status = 'approved' AND NEW.status NOT IN ('approved', 'superseded') THEN
    RAISE EXCEPTION 'artist_claims: cannot transition out of approved except to superseded'
      USING ERRCODE = 'check_violation';
  END IF;

  -- pending is the only fully open state. Allow pending -> {approved, rejected, withdrawn}.
  -- Reject pending -> superseded (use withdrawn instead).
  IF OLD.status = 'pending' AND NEW.status = 'superseded' THEN
    RAISE EXCEPTION 'artist_claims: pending -> superseded is not allowed; use withdrawn'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

`SECURITY INVOKER` (default), not `SECURITY DEFINER`. No tripwire concern.

The trigger applies to **all roles including service_role**. service_role bypasses RLS but does not bypass triggers.

### 7.3 Tradeoffs

**Pros of trigger-encoded transitions:**

- Workflow invariants enforced at the row level for all roles.
- Mirrors 3c memo Q2 defense-in-depth pattern.
- Service_role bugs cannot silently violate the workflow.

**Cons:**

- Adding a new status requires updating both the CHECK enum and the trigger function.
- Slightly more complex than RLS-only. The brief argues defense-in-depth is worth it for workflow surfaces.

### 7.4 Blocks 3d-execute?

**No.** Implementation detail. Critical to ship correctly.

### 7.5 Migration implication

The function + trigger DDL above. Plus the `artist_claims_updated_at` trigger (separate function, separate trigger, mirrors 3c).

### 7.6 Rollback / amendment

- Rollback: drop trigger + function with the table.
- Adding new transitions (e.g., a future `pending → needs_evidence` state): update the function body and CHECK enum together.

### 7.7 Tests required

See brief §12.3 — full transition matrix:

- Allowed transitions succeed.
- Forbidden transitions fail with the documented error message.
- Same-status UPDATE (e.g., updating `evidence_note` while keeping `status = 'pending'`) succeeds (the no-op early-return clause).

### 7.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected by transition mechanics.

### 7.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q8. Apply-time inertness — explicit assertion

### 8.1 Issue

3d, like 3a/3b/3c, must be inert at apply time: zero rows, no app reader, no app writer, no UI, no derivation activation, no badge change.

### 8.2 Recommendation

**Apply-time inertness is a hard invariant of 3d.** Specifically:

- 0 rows on first apply.
- No application code reads `artist_claims`.
- No application code writes `artist_claims`.
- No API/MCP/RPC route reads or writes `artist_claims`.
- No view, materialized view, or function reads `artist_claims`.
- No badge or UI surface changes.
- No derivation function activation.
- No `verification.ts` change.
- No `CONTRACTS.md` change.
- No SOURCE-OBS-01 activation.
- No Lane 5 PR B scope expansion.

This is the same parallel-safety conclusion as 3a/3b/3c: 3d is a pure schema-addition step and is parallel-safe with Lanes 2 / 9 / 10.

### 8.3 Tradeoffs

**Pros of inertness:**

- The merge and apply are decoupled from any application behavior.
- Reviewers can audit the migration in isolation.
- Other lanes can proceed in parallel without coordination.

**Cons:**

- None. Inertness is the right shape for a schema-addition step.

### 8.4 Blocks 3d-execute?

**No, but the 3d-execute PR description must explicitly assert inertness.**

### 8.5 Migration implication

The 3d-execute migration creates the table, indexes, triggers, RLS, and policies. It does **not**:

- Insert any seed data.
- Create a public view.
- Create any reader / writer / RPC.
- Modify any other table.

### 8.6 Rollback / amendment

- Rollback: `DROP TABLE` is sufficient (no FK dependencies from existing tables point at `artist_claims`).
- Amendment: future steps may build on top of `artist_claims`; 3d does not preclude any of them.

### 8.7 Tests required

- Content-scan test asserts: no `INSERT INTO public.artist_claims` statement in the migration.
- Content-scan test asserts: no `CREATE VIEW`, `CREATE MATERIALIZED VIEW`, or new function/trigger that *reads* the table.
- Content-scan test asserts: no `verification.ts` change in the PR diff (CI guardrail enforces this implicitly via the `track1-claims.md` discipline).

### 8.8 COMMUNITY-CORRECTION-01 preservation

✅ Inertness is the strongest possible preservation: at apply time, no user-driven write path exists.

### 8.9 `last_verified_at` preservation

✅ Inertness preserves all active rules.

---

## Q9. Boundary preservation — explicit confirmation

### 9.1 Issue

Step 3d must not edit any of the following surfaces. This question makes the boundary list explicit.

### 9.2 Recommendation

**3d does not:**

- Edit `web/src/lib/events/verification.ts`.
- Edit `docs/CONTRACTS.md`.
- Activate, supersede, or otherwise modify SOURCE-OBS-01.
- Start Step 3e (`claim_status` trigger).
- Start Step 4 (derivation function).
- Start Step 5+ (badge component, supersession, UI activation).
- Touch existing 3a/3b/3c migration files.
- Touch existing 3a/3b/3c briefs or memos.
- Touch `event_audit_log` (Lane 5 PR A) shape or semantics.
- Expand Lane 5 PR B scope.
- Touch existing claim tables (`venue_claims`, `organization_claims`, `event_claims`).
- Seed or backfill any data.
- Add or modify any `web/**` file.
- Add or modify any API/MCP/crawler/RPC route.
- Add or modify any UI / badge / admin behavior.
- Use `supabase db push`.

### 9.3 Tradeoffs

**Pros of explicit boundary list:**

- Auditors can mechanically verify each item against the PR diff.
- Future lane authors know exactly what they are and aren't authorized to touch.

**Cons:**

- None.

### 9.4 Blocks 3d-execute?

**No, but the 3d-execute PR description must include a boundary list mirroring this section.**

### 9.5 Migration implication

The migration file touches **only** `public.artist_claims` (creates the table, indexes, triggers, function, RLS, policies). No `ALTER TABLE` on any other table. No `CREATE`/`DROP` of any other object.

### 9.6 Rollback / amendment

- Rollback: drop the new objects.
- Amendment: future steps add new objects in their own migrations under their own stop-gates.

### 9.7 Tests required

- Content-scan test asserts: no `ALTER TABLE` on `events`, `event_audit_log`, `event_change_log`, `event_source_observations`, `event_sources`, `venue_claims`, `organization_claims`, `event_claims`, `profiles`.
- Content-scan test asserts: no `last_verified_at` reference (no read, no write).
- Content-scan test asserts: no `verified_by` reference.
- Diff-scope test asserts: PR adds files only under `supabase/migrations/`, `web/src/__tests__/`, and the track1-claims update.

### 9.8 COMMUNITY-CORRECTION-01 preservation

✅ Boundary preservation includes the COMMUNITY-CORRECTION-01 boundary by reference.

### 9.9 `last_verified_at` preservation

✅ Boundary preservation explicitly preserves `last_verified_at` semantics.

---

## Q10. Failure-mode coverage at apply time

### 10.1 Issue

What happens at apply time if a rogue actor attempts to write or read `artist_claims`?

### 10.2 Recommendation

Document the expected behavior for each role attempting each operation:

| Role | INSERT | UPDATE | DELETE | SELECT |
|---|---|---|---|---|
| `anon` | denied (no policy) | denied (no policy) | denied (no policy) | denied (no policy) |
| `authenticated` (non-admin) | denied (no policy) | denied (no policy) | denied (no policy) | denied (no policy) |
| `authenticated` (admin via `is_admin()`) | denied (no policy) | allowed only with `pending → approved/rejected` (RLS + trigger) | denied (no policy) | allowed |
| `service_role` | allowed (any valid evidence_kind) | allowed (subject to transition trigger) | allowed | allowed |

Specifically:

- **Rogue `anon` INSERT.** Denied. The absence of an INSERT policy means RLS does not grant the operation. Postgres returns "new row violates row-level security policy" or equivalent.
- **Rogue `authenticated` non-admin INSERT.** Same denial.
- **Rogue `authenticated` admin INSERT.** Same denial. Admin reads but does not insert in 3d.
- **Service_role INSERT with rogue `evidence_kind`.** Denied by the CHECK enum (`'user_other'`, `'user_direct'`, etc.). The CHECK applies to all roles including service_role.
- **Service_role UPDATE with rogue transition.** Denied by the BEFORE UPDATE trigger. The trigger applies to all roles including service_role.
- **Service_role DELETE.** Allowed at apply time (no DELETE policy means RLS doesn't constrain service_role since it bypasses RLS). Used by retention. No app code does this in 3d.

### 10.3 Tradeoffs

**Pros of this failure-mode posture:**

- Each rogue action has a documented denial path.
- Service_role is constrained by CHECK and trigger, not just RLS.
- COMMUNITY-CORRECTION-01 cannot be bypassed by changing the application; it is enforced at the schema level.

**Cons:**

- Service_role bypasses RLS but not CHECK or trigger. This means the transition trigger is **load-bearing** for service_role correctness. A regression in the trigger function would silently allow invalid transitions for service_role.

### 10.4 Mitigation for the load-bearing trigger

- Trigger function is small and easy to audit.
- 3d-execute tests must cover the full transition matrix (Q7.7).
- Future PRs that modify the trigger function must include their own transition matrix tests.

### 10.5 Blocks 3d-execute?

**No.** Failure-mode coverage is documented in the brief and tested in the migration PR.

### 10.6 Migration implication

The migration's RLS policies + CHECK constraints + trigger function together produce the failure-mode table above. No additional DDL needed.

### 10.7 Rollback / amendment

- Rollback: failure modes disappear with the table.
- Amendment: any future RLS policy or trigger change must be paired with new failure-mode tests.

### 10.8 Tests required

See brief §12.4 + §12.6:

- Each role's denied operations actually fail with the expected error.
- The admin's allowed UPDATE only succeeds with the transition guard.
- Service_role CHECK/trigger denials fire correctly.

### 10.9 COMMUNITY-CORRECTION-01 preservation

✅ Failure-mode coverage explicitly includes the boundary: rogue users denied at the schema level.

### 10.10 `last_verified_at` preservation

✅ Unaffected.

---

## Q11. Coupling to Step 4 (derivation function) and Step 5+ (UI badge / supersession)

### 11.1 Issue

Step 4 (derivation function) may want to read `artist_claims` to produce the verification display. Step 5+ (badge component, supersession surface) builds on Step 4. This question makes the deferral explicit.

### 11.2 Recommendation

**Decouple.** 3d ships only the schema. Whether Step 4 consumes `artist_claims` is a Step 4 design question, not a 3d schema question. Specifically:

- 3d does not declare any contract between `artist_claims` and the future derivation function.
- 3d does not commit to specific columns being "read by Step 4."
- 3d does not pre-plan the Step 5 badge / supersession UI shape.
- 3d does not modify or pre-author any verification display logic.

When Step 4 is proposed, it cites `artist_claims` (and 3a/3b/3c tables) and proposes the consumption pattern. The Step 4 stop-gate is the right place to decide which claims are "active for derivation purposes" (probably `status = 'approved'`) and how supersession plays in.

### 11.3 Tradeoffs

**Pros of decoupling:**

- 3d's schema can be reasoned about in isolation.
- Step 4 has full design freedom in how it consumes `artist_claims`.
- Reviewers don't need to evaluate Step 4 to approve 3d.

**Cons:**

- A design choice in 3d (e.g., "include `'superseded'` in the status enum") may turn out to be inconvenient for Step 4. Mitigation: enum widening / trigger modification are cheap.

### 11.4 Blocks 3d-execute?

**No.** Coupling is forward-only; 3d does not pre-commit Step 4.

### 11.5 Migration implication

None. The 3d migration ships no Step-4 contract.

### 11.6 Rollback / amendment

- Rollback: 3d rollback does not affect Step 4 (which doesn't exist yet).
- Amendment: Step 4 ships under its own stop-gate.

### 11.7 Tests required

- Content-scan test asserts: no function in 3d reads any other table.
- Content-scan test asserts: no derivation logic in 3d.
- Content-scan test asserts: no `EventVerificationDisplay` reference in 3d.

### 11.8 COMMUNITY-CORRECTION-01 preservation

✅ Decoupling preserves COMMUNITY-CORRECTION-01 because no derivation logic ships in 3d.

### 11.9 `last_verified_at` preservation

✅ Decoupling preserves `last_verified_at` semantics.

---

## Q12. Coupling to COMMUNITY-CORRECTION-01 boundary

### 12.1 Issue

[COMMUNITY-CORRECTION-01](../strategy/AGENTIC_EVENT_MAINTENANCE.md) requires that authenticated users without an approved claim covering the target entity cannot directly mutate trusted records. 3d must structurally enforce this boundary.

### 12.2 Recommendation

**Mirror 3c memo Q6's structural enforcement, with two layers:**

1. **`evidence_kind` enum has no `'user_other'` value.** The CHECK enum exhaustively lists only the four sanctioned origins. A schema-level rejection of any user-direct sentinel.

2. **No `authenticated` INSERT policy ships in 3d.** Even if a future enum widening accidentally added a "user direct" value, the absence of an INSERT policy means RLS denies user-driven writes regardless. The two layers are belt-and-suspenders.

The `'manual_self_claim'` enum value is reserved by the schema but does **not** authorize the path in 3d. The future stop-gate that proposes the self-claim INSERT path (Step 3d.1 or Step 5) must:

- Add an INSERT policy with `WITH CHECK (evidence_kind = 'manual_self_claim' AND submitted_by = auth.uid() AND artist_profile_id = auth.uid() AND status = 'pending')` (or equivalent).
- Provide the application UI / route that exercises the policy.
- Include rate limiting and anti-abuse heuristics.
- Include admin notification for the review queue.
- Cite COMMUNITY-CORRECTION-01 §10.4 ("bulk edits") and document how the path stays within bounds.

### 12.3 Tradeoffs

**Pros of two-layer structural enforcement:**

- Defense-in-depth at the schema level.
- A future regression (accidental enum widening, accidental policy addition) requires breaking *both* layers to reintroduce a user-direct write path.
- Mirrors the 3c memo Q6 + 3b memo Q6 patterns.

**Cons:**

- Schema-level enforcement is harder to relax later if a legitimate use case appears. Accept: the future-stop-gate path is the right way to relax it.

### 12.4 Blocks 3d-execute?

**Yes for design clarity.** Both layers must ship in 3d.

### 12.5 Migration implication

Layer 1: `evidence_kind` CHECK enum (Q2).
Layer 2: absence of `authenticated` INSERT policy (Q5).

### 12.6 Rollback / amendment

- Rollback: both layers disappear with the table.
- Amendment: relaxing either layer requires its own stop-gate (and breaks the boundary; presumed to be evaluated against COMMUNITY-CORRECTION-01 at that time).

### 12.7 Tests required

- Schema test: `evidence_kind` CHECK enum exhaustively lists only the four values; explicit negative for `'user_other'`, `'user_direct'`, `'community_direct'`, `'user_correction'`, `'user_submitted'`.
- RLS test: `authenticated` (non-admin) cannot INSERT regardless of payload.
- RLS test: `authenticated` (admin) cannot INSERT.
- Policy-inventory test: no INSERT policy on `public.artist_claims` exists.
- Documentation test (informal): the brief and memo both name the boundary.

### 12.8 COMMUNITY-CORRECTION-01 preservation

✅ **Strongest possible preservation.** Both layers are structural. No application-level discipline required to maintain the boundary.

### 12.9 `last_verified_at` preservation

✅ Unaffected.

---

## 4. Summary

| # | Question | Recommendation | Blocks 3d-execute? |
|---|---|---|---|
| 1 | Schema — final column list, types, nullability | Adopt brief §3.1 (13 columns) verbatim | No, but final |
| 2 | `evidence_kind` enum | 4 values: `manual_self_claim`, `concierge_extract`, `admin_seed`, `derivation`; **no `'user_other'`** | **Yes for design clarity** |
| 3 | `status` enum + transitions | 5 values: `pending`, `approved`, `rejected`, `withdrawn`, `superseded`; **no `'applied'`**; transition matrix in Q3.2 | No |
| 4 | FK ON-DELETE behavior | `artist_profile_id` CASCADE, `event_id` CASCADE, `submitted_by` SET NULL, `reviewed_by` SET NULL | No, but final |
| 5 | RLS policies | Admin SELECT + admin transition-constrained UPDATE; no `anon`, no `authenticated` INSERT/DELETE/FOR ALL; service_role bypass | **Yes for design clarity** |
| 6 | Indexes | 5 indexes (PK + 4); partial UNIQUE on `(artist, event)` deferred | No |
| 7 | Status-transition trigger | `BEFORE UPDATE` trigger function in Q7.2; `SECURITY INVOKER`; defense-in-depth across all roles | No |
| 8 | Apply-time inertness | 0 rows, no reader/writer/UI/derivation; parallel-safe with Lanes 2/9/10 | No, but PR must assert |
| 9 | Boundary preservation | Explicit list in Q9.2; no edits to `verification.ts`, `CONTRACTS.md`, SOURCE-OBS-01, Lane 5, existing claim tables, existing 3a/3b/3c | No, but PR must assert |
| 10 | Failure-mode coverage | Failure-mode table in Q10.2; trigger is load-bearing for service_role | No |
| 11 | Coupling to Step 4 / 5+ | Decoupled; 3d ships only schema | No |
| 12 | Coupling to COMMUNITY-CORRECTION-01 | Two-layer structural enforcement: enum + RLS-INSERT-absence | **Yes for design clarity** |

**Net effect:** Q2, Q5, and Q12 have hard design implications for 3d-execute; the rest are column-shape / nullability / mechanical decisions. None blocks the 3d-execute migration from shipping; Q2 + Q5 + Q12 shape its content.

**Deferred items the coordinator should flag to Sami before authorizing the execute-PR:**

- **Partial UNIQUE INDEX on `(artist_profile_id, event_id) WHERE status IN ('pending','approved')` (Q6).** Memo recommends defer; final call rests with Sami before the execute-PR.

This is the only deferred-with-rationale item. All other twelve questions are answered.

## 5. Stop-Gates

Per [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md) and [.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md):

- Approving this memo records *decisions* about the twelve open questions; it does **not** authorize any migration, code, route, MCP surface, crawler, derivation function, badge, UI, or DB apply.
- The 3d-execute migration PR (the actual SQL for `artist_claims`) requires its own stop-gate, citing this memo and the 3d brief.
- The 3d apply step (MODE B `psql -f` + manual `INSERT INTO supabase_migrations.schema_migrations`) requires a third stop-gate after the execute-PR merges. **No `supabase db push`.**
- The future self-claim INSERT path (Step 3d.1 or Step 5) requires its own brief, decision memo, execute-PR, and apply-PR — four further stop-gates.
- Step 3e (`claim_status` maintenance trigger), Step 4 (derivation function), and Step 5+ (badge / supersession / UI) each retain their own stop-gates per [SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md).
- Trust Layer Invariant remains non-negotiable.
- COMMUNITY-CORRECTION-01 boundary is enforced structurally by the `evidence_kind` enum + absence of `authenticated` INSERT policy.
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
- Authorize the 3d migration itself.
- Authorize the future self-claim INSERT path.
- Authorize any subsequent step (3e `claim_status` trigger, 4 derivation function, 5+ badge / supersession / UI).
- Expand Lane 5 PR B scope.
- Touch `event_audit_log` shape or semantics.
- Touch existing claim tables (`venue_claims`, `organization_claims`, `event_claims`).
- Touch existing 3a/3b/3c migration files, briefs, or memos.
- Authorize a community-correction surface or any direct-insert path.
- Authorize `supabase db push` or any other migration mechanism than MODE B.

---

**End of memo. Approval records the recommended defaults for the twelve Step 3d open questions; the 3d-execute migration PR is its own stop-gate, and the apply step is a third stop-gate after that.**

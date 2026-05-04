# Source Observation Step 3d — `artist_claims` Brief

**Status:** Implementation brief — **does not authorize applying any migration**
**Lane:** Lane 6 (strategy and policy authoring)
**Created:** 2026-05-03
**Audience:** Future migration author and the reviewer for the step-3d stop-gate

**Predecessors (all merged on `main`; 3a + 3b + 3c also applied to production):**

- [PR #214](https://github.com/samiserrag/denver-songwriters-collective/pull/214) — investigation: data model plan
- [PR #219](https://github.com/samiserrag/denver-songwriters-collective/pull/219) — Step 3a/general decision memo
- [PR #222](https://github.com/samiserrag/denver-songwriters-collective/pull/222) — Step 3a brief (`event_sources`)
- [PR #226](https://github.com/samiserrag/denver-songwriters-collective/pull/226) — Step 3a execute (`event_sources`; **applied to production**)
- [PR #231](https://github.com/samiserrag/denver-songwriters-collective/pull/231) — `COMMUNITY-CORRECTION-01` principle
- [PR #234](https://github.com/samiserrag/denver-songwriters-collective/pull/234) — Step 3b brief (`event_source_observations`)
- [PR #238](https://github.com/samiserrag/denver-songwriters-collective/pull/238) — Step 3b decision memo
- [PR #244](https://github.com/samiserrag/denver-songwriters-collective/pull/244) — Step 3b execute (`event_source_observations`; **applied to production**)
- [PR #252](https://github.com/samiserrag/denver-songwriters-collective/pull/252) — Step 3c brief (`event_change_log`)
- [PR #256](https://github.com/samiserrag/denver-songwriters-collective/pull/256) — Step 3c decision memo
- [PR #264](https://github.com/samiserrag/denver-songwriters-collective/pull/264) — Step 3c execute (`event_change_log`; **applied to production**)
- [docs/strategy/AGENTIC_EVENT_MAINTENANCE.md `COMMUNITY-CORRECTION-01`](../strategy/AGENTIC_EVENT_MAINTENANCE.md)
- [docs/strategy/SOURCE_REGISTRY.md](../strategy/SOURCE_REGISTRY.md)
- [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md) — Draft / Proposed / Not Active

> **No production verification behavior is changed by this brief.** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed, remains the only active rule per [Phase 4.89 Confirmation Invariants](../../.claude/rules/10-web-product-invariants.md). [SOURCE-OBS-01](../CONTRACTS.md) stays Draft / Proposed / Not Active. **Approving this brief does not authorize applying the migration.** The 3d-execute migration PR is its own stop-gate, and the apply step is a third stop-gate after that.

---

## 1. Purpose

`artist_claims` is the **artist-authorship workflow surface** for the SOURCE-OBS-01 verification model. A row asserts that a specific artist profile is associated with a specific event, with a workflow status governing whether the claim is currently active.

Three claims about the table:

1. **Asserted, then reviewed.** Each row begins as a `'pending'` claim. Admins (and, in a future step, automation gated by COMMUNITY-CORRECTION-01) transition it to `'approved'` or `'rejected'`. **3d does not ship the self-claim INSERT path** — that is a separate future stop-gate. In 3d the table is inert.
2. **Per-(artist, event), not blanket authorship.** A claim never grants generic editorship. It binds one artist to one event. A "venue manager" or "host" claim is a different surface (the existing `venue_claims` / `organization_claims` tables) and is not part of 3d.
3. **Input to derivation, not directly to verification.** `artist_claims` is consumed by the future Step 4 derivation function (alongside `event_change_log` and `event_source_observations`) to produce the verification display. 3d ships only the table; reading and badge surfaces remain gated.

The slogan: **observations are evidence; change_log is system proposal; audit_log is applied history; artist_claims is artist-asserted authorship.** Four artifacts, four lifecycles, four stop-gates.

## 2. Relationship to Existing Tables

### 2.1 `events`

`artist_claims.event_id` is `NOT NULL REFERENCES public.events(id) ON DELETE CASCADE`. A claim only exists relative to an event; deleting the event removes the claim history. Mirrors `event_change_log.event_id` (3c memo Q1) and matches the same semantic invariant (deltas / claims do not survive without the event they reference).

### 2.2 `profiles`

`artist_claims.artist_profile_id` is `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`. The artist *is* the subject of the claim; if their profile is deleted, the claim disappears with them. Mirrors the existing `venue_claims.user_id` and `organization_claims.user_id` ON DELETE CASCADE posture.

`artist_claims.submitted_by` and `artist_claims.reviewed_by` are nullable `REFERENCES public.profiles(id) ON DELETE SET NULL`. Different posture from `artist_profile_id`: the *act* of submitting or reviewing is part of the claim's history, but the historical record should survive the actor's profile deletion (the row stays as evidence; the actor pointer goes NULL).

### 2.3 `event_audit_log` (Lane 5 PR A)

`event_audit_log` records direct mutations to the trusted event record. `artist_claims` records authorship assertions about events. The two surfaces are orthogonal and do not interact in 3d:

- 3d does **not** add a column linking a claim to an audit row.
- 3d does **not** read or write `event_audit_log`.
- Future application logic that responds to a claim being approved (e.g., adding the artist as a cohost) will go through the existing event-edit code path, which already emits an `event_audit_log` row. **3d does not authorize that future logic.**

**Lane 5 PR A's contract holds. Lane 5 PR B scope is not expanded by 3d.**

### 2.4 `event_change_log` (3c, on production)

`event_change_log` is a **system-derived workflow** surface (Trust agent emits deltas from observations). `artist_claims` is an **artist-asserted workflow** surface (the artist asserts authorship). The two surfaces have parallel shapes — both are workflow-mutable, both have the same status enum minus / plus a value (3c includes `'applied'` because change_log entries can be applied to events; claims do not get "applied" — they are accepted or rejected) — but they are not joined or unioned in 3d.

A future step (Step 4) may consume both surfaces in the same derivation function. 3d does not ship that function.

### 2.5 `event_source_observations` (3b, on production)

`artist_claims` does **not** reference `event_source_observations`. Claims are not derived from crawler observations; they are asserted. If a claim's evidence happens to be a URL that was also observed (e.g., a venue page listing the artist as performer), that URL lives in `artist_claims.evidence_url` as plain text. 3d does not add an FK from claims to observations; the surfaces are decoupled.

### 2.6 Existing claim tables (`venue_claims`, `organization_claims`, `event_claims`)

`artist_claims` is **not** a rename or replacement of any existing claim table. It is a new surface for a different relationship (artist ↔ event). Existing claim tables remain unchanged. 3d does not modify their schema, RLS, or grants.

The shape of `artist_claims` is *informed by* the existing claim-table pattern (status workflow, `reviewed_by` / `reviewed_at`, `BEFORE UPDATE` `updated_at` trigger, admin-only RLS) but chooses values appropriate to artist authorship rather than venue/organization management.

### 2.7 `COMMUNITY-CORRECTION-01` boundary

[COMMUNITY-CORRECTION-01](../strategy/AGENTIC_EVENT_MAINTENANCE.md) names the discipline that authenticated users without an approved claim covering the target entity cannot directly mutate trusted records. Applied to 3d, this means:

- The eventual artist self-claim INSERT path will need its own stop-gate (Step 5 or a Step 3d.1 substep — naming TBD), separately authorized.
- Until that step ships, `artist_claims` is structurally write-restricted at apply time: no `authenticated` INSERT policy, no `anon` policy.
- The `evidence_kind` CHECK enum encodes the boundary the same way `event_change_log.proposal_source` did in 3c memo Q6: it has **no `user_other` value**; only the four sanctioned origins are allowed (`manual_self_claim`, `concierge_extract`, `admin_seed`, `derivation`). The `manual_self_claim` value names the future authorized path; it is not authorized in 3d.

This brief preserves the COMMUNITY-CORRECTION-01 boundary structurally. See §11.6 in the open-questions section.

## 3. Proposed Columns

This section is opinionated. The user-prompt column list is the baseline; each disagreement or addition is justified inline.

### 3.1 Recommended column set

| Column | Type | Constraint / Notes |
|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `artist_profile_id` | `uuid` | `NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`. The subject of the claim. See §3.2. |
| `event_id` | `uuid` | `NOT NULL REFERENCES public.events(id) ON DELETE CASCADE`. The object of the claim. See §3.3. |
| `status` | `text` | `NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn','superseded'))`. Workflow state. See §3.4. |
| `evidence_kind` | `text` | `NOT NULL CHECK (evidence_kind IN ('manual_self_claim','concierge_extract','admin_seed','derivation'))`. **No `'user_other'` value.** See §3.5. |
| `evidence_url` | `text` | nullable; length-bounded (`CHECK (evidence_url IS NULL OR length(evidence_url) <= 2048)`); validated as a URL by the future writer (no schema-level URL validation in 3d). See §3.6. |
| `evidence_note` | `text` | nullable; length-bounded (`CHECK (evidence_note IS NULL OR length(evidence_note) <= 2000)`). Free-text submitter note. See §3.7. |
| `submitted_by` | `uuid` | nullable; `REFERENCES public.profiles(id) ON DELETE SET NULL`. The profile that physically inserted the row (may equal `artist_profile_id` for self-claims, or be an admin's profile for `admin_seed`). See §3.8. |
| `reviewed_by` | `uuid` | nullable; `REFERENCES public.profiles(id) ON DELETE SET NULL`. The admin (or future automated reviewer) that transitioned status away from `'pending'`. See §3.8. |
| `submitted_at` | `timestamptz` | `NOT NULL DEFAULT now()`. Captures the submission moment, distinct from `created_at` (which captures the row-write moment; for a backfilled `admin_seed` they may differ from the historical truth). |
| `reviewed_at` | `timestamptz` | nullable. Set when status leaves `'pending'`. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()`. |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()`. Maintained by `BEFORE UPDATE` trigger (matches 3c pattern and existing claim tables). |

### 3.2 Critique — `artist_profile_id` ON DELETE CASCADE

The artist *is* the subject. Deleting their profile should not leave dangling claims. Mirrors `venue_claims.user_id` and `organization_claims.user_id` posture, both of which are ON DELETE CASCADE today.

### 3.3 Critique — `event_id` ON DELETE CASCADE (matches 3c)

Same reasoning as `event_change_log.event_id` (3c memo Q1): a claim is *about* an event; if the event is deleted, the claim has no referent. CASCADE on DELETE.

### 3.4 Critique — `status` enum (5 values)

The user-prompt enum was: `pending`, `approved`, `rejected`, `withdrawn`, `superseded` (5 values). This is the right set for claims:

- `'pending'` — initial state.
- `'approved'` — admin (or future automation) accepts the claim.
- `'rejected'` — admin rejects.
- `'withdrawn'` — the proposer withdraws before review (or, in the future, the artist withdraws an approved claim).
- `'superseded'` — a newer approved claim from the same artist on the same event displaces this one (history is preserved, not deleted).

`'applied'` is **deliberately omitted.** Unlike `event_change_log` proposals, claims don't get "applied" to anything; they're accepted or rejected. If a future step adds an automatic event-edit hook on claim approval, that side-effect goes through the existing event-edit code path and is recorded in `event_audit_log`, not in `artist_claims`.

### 3.5 Critique — `evidence_kind` enum (4 values, no `user_other`)

The user-prompt enum was: `manual_self_claim`, `concierge_extract`, `admin_seed`, `derivation`, with explicit exclusion of `user_other`. Adopt as-is. Each value names a sanctioned source of a claim row:

- `'manual_self_claim'` — the artist submits via a future authenticated UI. **Not authorized in 3d.** The CHECK enum lists this value to reserve it; the RLS policies in 3d do not permit `authenticated` INSERT, so the value cannot land on a row without a future migration that adds the INSERT policy under its own stop-gate.
- `'concierge_extract'` — the concierge surface extracts a claim from a user interaction; service_role indirection writes the row.
- `'admin_seed'` — admin manually seeds a claim (e.g., during a backfill of pre-existing data).
- `'derivation'` — a future Trust-agent-equivalent derives a claim candidate from observed evidence (e.g., venue-listed performers); service_role indirection writes the row.

**No `'user_other'` value.** Mirrors `event_change_log.proposal_source` (3c memo Q6): the schema has no kind that names "any user direct write." Self-claims go through `manual_self_claim` and are gated by the future INSERT-policy stop-gate. Other user-driven paths (community corrections, third-party tagging) live in different surfaces or must add their own enum values via a future migration under a separate stop-gate. The COMMUNITY-CORRECTION-01 boundary is structurally enforced.

### 3.6 Critique — `evidence_url` length bound, no schema URL validation

URL validation is fiddly to do at the schema level (regex variants, IDN, etc.). The 3d migration ships only a length bound (`length <= 2048`). Application-level / writer-level validation is the future writer's responsibility (e.g., the self-claim INSERT path or admin tooling).

### 3.7 Critique — `evidence_note` length bound

Length-bounded text to prevent abuse. The future self-claim INSERT path will sanitize at submit time; the schema's length cap is a backstop.

### 3.8 Critique — `submitted_by` vs `artist_profile_id`

These two columns can be equal (the artist self-submits) or different (an admin seeds the row on the artist's behalf). Splitting them preserves the audit-trail truth: who *is* the claim about (artist), and who physically wrote the row (submitter).

For `evidence_kind = 'manual_self_claim'`, the future INSERT policy must require `submitted_by = auth.uid() AND artist_profile_id = auth.uid()`. **3d does not encode that policy** — it ships only the columns. The policy is part of the future stop-gate that authorizes the INSERT path.

### 3.9 Out-of-scope columns explicitly NOT in 3d

- `applied_audit_log_id` — claims aren't "applied" via audit_log; the eventual side-effect of an approval (if any) goes through the existing event-edit path which logs to `event_audit_log` independently. Defer entirely.
- `review_notes` — admin's free-text rationale for accepting/rejecting. Worth having; **defer to a future step** to keep 3d minimal. Application-level review tooling can attach a `review_notes` column later via standard CHECK widening.
- `derivation_run_id` — relevant only for `evidence_kind = 'derivation'`. Defer until the future derivation function ships (Step 4); the column can be added then with a partial CHECK.
- `confidence` — 3c included `confidence numeric(4,3)`. For claims, confidence is implicit (a self-claim is asserted, an admin-seed is asserted by a human, a future derivation will carry its own scoring). Defer.
- `source_id` (denormalized like 3b/3c) — claims don't have a single source; they have evidence URLs. Defer.

## 4. Mutability Posture

`artist_claims` is **workflow-mutable**, mirroring `event_change_log`. Mutability is bounded by RLS UPDATE policy + a `BEFORE UPDATE` transition-validation trigger (defense-in-depth across all roles including service_role, mirroring 3c memo Q2):

- **INSERT** by `service_role` only at apply time. No app-role INSERT in 3d. The future self-claim INSERT path (`manual_self_claim`) is a separate stop-gate.
- **UPDATE** restricted to specific status transitions:
  - `pending → approved`: admin via RLS (`reviewed_by`, `reviewed_at`, `status` set together).
  - `pending → rejected`: admin via RLS.
  - `pending → withdrawn`: system or proposer via service_role.
  - `approved → superseded`: system via service_role (when a newer approved claim displaces).
  - No other transitions.
- **DELETE** by `service_role` only (retention; admin-triggered or scheduled). No app-role DELETE.

## 5. RLS Posture

`ENABLE ROW LEVEL SECURITY` is mandatory per [database security invariants](../../.claude/rules/00-governance-and-safety.md). Proposed defaults:

| Role | Action | Policy | Rationale |
|---|---|---|---|
| `anon` | All | **None** | Claims are not a public surface in 3d. |
| `authenticated` (self) | All | **None at apply time.** | The self-claim INSERT path is a future stop-gate; in 3d, no `authenticated` INSERT, UPDATE, SELECT, or DELETE policy exists. |
| `authenticated` (admin via `public.is_admin()`) | `SELECT` | `USING (public.is_admin())` | Admin reads the claim queue. |
| `authenticated` (admin) | `UPDATE` | `USING (public.is_admin() AND status = 'pending') WITH CHECK (public.is_admin() AND status IN ('approved','rejected'))` | Admin can review (transition pending → approved/rejected). Other transitions (`pending → withdrawn`, `approved → superseded`) happen via service_role under code review. |
| `authenticated` (admin) | `INSERT` | **None.** | Admin seeding goes through service_role tooling (e.g., a future admin-seed CLI). Avoids ambiguity about the audit trail. |
| `authenticated` (admin) | `DELETE` | **None.** | Retention runs as service_role. |
| `service_role` | All | bypass | Future admin tooling, derivation, retention. |

**No public view in 3d.** Same logic as 3a / 3b / 3c. The future derivation function reads as service_role and serves digested labels through API endpoints.

**No `authenticated` INSERT policy in 3d** is the critical structural enforcement of COMMUNITY-CORRECTION-01: until the self-claim INSERT path is authorized in a future stop-gate, the schema itself denies any user-driven write.

## 6. Triggers

Two `BEFORE UPDATE` triggers, mirroring 3c (memo Q2 defense-in-depth):

### 6.1 `artist_claims_updated_at`

`BEFORE UPDATE FOR EACH ROW EXECUTE FUNCTION public.update_artist_claims_updated_at()`. Sets `NEW.updated_at = NOW()`. Standard pattern, identical shape to `event_change_log`.

### 6.2 `artist_claims_validate_transition`

`BEFORE UPDATE FOR EACH ROW EXECUTE FUNCTION public.artist_claims_validate_transition()`. `SECURITY INVOKER` (default), not `SECURITY DEFINER`. Raises:

- On any transition out of a terminal state (`approved`, `rejected`, `withdrawn`, `superseded`). Terminal means terminal. (Note: `approved → superseded` is allowed because `'approved'` is a re-enterable state in this schema *for the purpose of supersession only* — see §6.3 critique.)
- On any other invalid transition per the documented state machine in §7 (§7.1 transition table is the canonical reference).

The trigger applies to **all roles including service_role** (service_role bypasses RLS but not triggers). This is defense-in-depth; service_role bugs cannot break workflow invariants silently.

### 6.3 Critique — terminal-state semantics

Three of the five statuses are unambiguously terminal: `'rejected'`, `'withdrawn'`, `'superseded'`.

`'approved'` is special: per the documented transition table in §7.1, `approved → superseded` is the only allowed transition out of `'approved'`. The trigger encodes this explicitly:

```text
IF OLD.status = 'approved' AND NEW.status NOT IN ('approved', 'superseded') THEN
  RAISE EXCEPTION ...
END IF;
```

`'pending'` is the only fully open state from which transitions to four other values are allowed.

## 7. Status Transitions

### 7.1 Transition table

| From | To | Allowed by | Notes |
|---|---|---|---|
| `pending` | `approved` | RLS UPDATE (admin) + trigger | Sets `reviewed_by`, `reviewed_at`. The only admin-driven approval path in 3d. |
| `pending` | `rejected` | RLS UPDATE (admin) + trigger | Sets `reviewed_by`, `reviewed_at`. |
| `pending` | `withdrawn` | service_role + trigger | Proposer or system withdraws before review. |
| `approved` | `superseded` | service_role + trigger | Newer approved claim displaces this one. |
| `pending` | `superseded` | **rejected** | A `'pending'` claim that is overtaken should be `'withdrawn'`, not `'superseded'` (preserve the semantic distinction: superseded means previously approved). |
| Any → `applied` | — | **rejected** | `'applied'` is not in the enum. |
| Any → `pending` from a non-pending state | — | **rejected** | All non-`pending` states are terminal (or near-terminal in `approved`'s case). |
| `authenticated` non-admin UPDATE | — | rejected by RLS | Admin gate. |
| `anon` UPDATE | — | rejected by RLS | No policy. |
| Any `INSERT` from `anon` or `authenticated` | — | rejected by RLS | No INSERT policy in 3d. |
| Any `DELETE` | — | rejected by RLS | No DELETE policy in 3d. |

### 7.2 Why include `'superseded'` if the typical case is just `'rejected'` followed by re-submission

The two are distinct:

- `'rejected'` says "this claim is wrong" — a judgment.
- `'superseded'` says "this claim was right at the time, but a newer claim now takes precedence" — a non-judgmental displacement, often by the same artist updating their evidence.

Preserving both in the enum allows future tooling to distinguish "false claim" cases from "stale claim" cases. The cost is a fifth enum value and one extra trigger branch.

## 8. Indexes

Recommended indexes for 3d:

| Index | Columns | Why |
|---|---|---|
| `artist_claims_pkey` | `(id)` | Primary key. |
| `idx_artist_claims_artist` | `(artist_profile_id)` | All claims by an artist. |
| `idx_artist_claims_event` | `(event_id)` | All claims for an event. |
| `idx_artist_claims_status` | `(status)` | Status filter for review queue. |
| `idx_artist_claims_pending_submitted` | `(submitted_at DESC) WHERE status = 'pending'` | Partial index for the high-priority pending review queue, ordered by submission time. |

**Defer** (per 3c-memo-Q6-style EXPLAIN-evidence reasoning):

- A composite `(artist_profile_id, event_id, status)` for "latest active claim per (artist, event)" — defer until traffic-shape evidence justifies it.
- A partial UNIQUE INDEX on `(artist_profile_id, event_id) WHERE status IN ('pending','approved')` to enforce "at most one active claim per (artist, event)." **Worth a final call** before 3d-execute (memo Q6); see §11.5.
- GIN — no jsonb in 3d.

**No partitioning in 3d.** Same reasoning as 3a/3b/3c: no traffic data, defer.

## 9. Compatibility Guarantees

- **Active rule unchanged.** `last_verified_at IS NOT NULL ⇒ Confirmed`. Phase 4.89 invariants hold byte-for-byte.
- **`web/src/lib/events/verification.ts` unchanged.** No code modification ships in 3d.
- **No badge change.** UI continues to render the existing Confirmed/Unconfirmed/Cancelled states from `last_verified_at` and `status`.
- **No reads from `artist_claims` in 3d.** No application code, RPC, route, or UI reads the new table. The first reader is the future derivation function (Step 4) and the future review queue UI.
- **No writes from app code in 3d.** Only `service_role` writes (admin tooling not yet shipped). The future `manual_self_claim` INSERT path is a separate stop-gate.
- **Lane 5 PR A `event_audit_log` is unchanged.** Lane 5 PR B scope not expanded.
- **`event_change_log` (3c) and `event_source_observations` (3b) and `event_sources` (3a) unchanged.** No FK from 3d points at any of them in 3d's apply.
- **Existing claim tables (`venue_claims`, `organization_claims`, `event_claims`) unchanged.** No rename, no schema migration on them.
- **COMMUNITY-CORRECTION-01 unchanged.** Structurally enforced by `evidence_kind` enum lacking `'user_other'` and by absence of `authenticated` INSERT policy.
- **SOURCE-OBS-01 stays Draft / Proposed / Not Active.**

## 10. Differentiation from Existing Claim Tables

The clearest way to keep `artist_claims` distinct from the existing `venue_claims` / `organization_claims` / `event_claims` tables:

| Surface | Subject | Object | Privilege granted on approval | Existing? |
|---|---|---|---|---|
| `venue_claims` | A user (manager) | A venue | Edit that venue's record + events at that venue | Yes |
| `organization_claims` | A user (manager) | An organization | Edit that org's record + events organized by it | Yes |
| `event_claims` | A user (host) | A specific event | Edit that specific event | Yes |
| `artist_claims` (3d) | An artist profile | A specific event | **No edit privilege at apply time.** Future steps may grant edit privileges scoped to "events I'm in," but that scope is not authorized by 3d. | New |

`artist_claims` answers a different question than `event_claims`. `event_claims` is "I am the host/booker of this event." `artist_claims` is "I am a performer / songwriter on this event." Different relationship, different downstream implications. They do not overlap or replace each other.

## 11. Open Questions

These should be resolved before the 3d-execute migration PR opens, but are not required to land this brief.

### 11.1 `evidence_kind` enum domain

**Recommended (§3.5):** four values — `manual_self_claim`, `concierge_extract`, `admin_seed`, `derivation`. Explicitly exclude `'user_other'` and any other "user direct write" sentinel.

**Open:** should `derivation` be deferred until the future Trust-agent-equivalent ships (Step 4)? Including it now reserves the value; excluding it now means a future CHECK widening (cheap). **Recommend including** (memo Q2 finalizes).

### 11.2 `status` enum — include `'superseded'` in 3d?

**Recommended (§3.4):** include `'superseded'` from day one. Removing it later would require a backfill of any rows in that state. Including it is a one-line CHECK.

**Open:** is the supersession path real or theoretical? If we never actually emit `'superseded'`, the enum value is harmless dead code. **Recommend keeping** — the cost is trivial; the semantic distinction (§7.2) is worth preserving.

### 11.3 FK ON DELETE behavior for `artist_profile_id`

**Recommended (§3.2):** `ON DELETE CASCADE`. Mirrors existing claim tables.

**Alternative:** `ON DELETE SET NULL`. Would preserve historical claims as orphan records. Reject — the artist *is* the subject; orphan rows are not informative. Existing claim tables all use CASCADE.

### 11.4 RLS UPDATE policy — admin-only or admin + service_role?

**Recommended (§5):** admin-only RLS UPDATE policy with transition guard. `service_role` bypasses RLS; transitions like `pending → withdrawn` and `approved → superseded` happen via service_role under code review.

**Alternative:** add an explicit `service_role` UPDATE policy (no-op since service_role bypasses RLS, but documents intent). Recommend leaving it implicit per existing claim-table pattern.

### 11.5 Partial UNIQUE INDEX `(artist_profile_id, event_id) WHERE status IN ('pending','approved')`

**Recommended (§8):** **defer** to the 3d-execute memo. The partial UNIQUE prevents an artist from having multiple simultaneous active claims on the same event. Logical, but it adds a corner case to handle in the future self-claim INSERT path (resubmit-after-rejection becomes tricky if the partial UNIQUE is active during the resubmit window).

**Final-call question:** is the partial UNIQUE worth the corner case? Memo Q6 makes the call.

### 11.6 Self-claim INSERT path — explicitly NOT in 3d

**Recommended (§5, §3.5):** the self-claim INSERT path lives in a future stop-gate (provisional name: Step 3d.1 or Step 5; final naming TBD when the path is actually proposed). 3d ships the schema with the `manual_self_claim` enum value reserved but the INSERT policy absent, so the path cannot fire without the future migration.

**Why not ship the path with 3d?** Because it has its own design questions that this brief is not the right place to resolve:

- Rate limiting on the self-claim path.
- Anti-spam / anti-abuse heuristics.
- Notification flow to the admin review queue.
- UI for the artist (form, evidence upload, status updates).
- Email confirmations.
- COMMUNITY-CORRECTION-01 §10.4 "bulk edits from unclaimed actors require admin review" — does this apply?

The 3d brief and 3d-execute migration intentionally stay focused on the schema. The path that fills it is a separate stop-gate.

### 11.7 Coupling with Step 4 derivation function

**Recommended:** decouple. The future derivation function may or may not consume `artist_claims`. If it does, the consumption is added under Step 4's stop-gate; 3d does not encode a derivation contract.

### 11.8 `submitted_at` vs `created_at`

**Recommended (§3.1):** keep both. `submitted_at` is the user-facing submission time; `created_at` is the row-write time. They can differ during admin backfill of historical claims (`admin_seed` with a back-dated `submitted_at`).

**Alternative:** drop `submitted_at` and rely on `created_at`. Loses the backfill use case. Reject.

## 12. Test Plan for the Future 3d-Execute PR

The 3d-execute PR will need (at minimum):

### 12.1 CI tripwires

- **RLS tripwire** green for `artist_claims`.
- **SECURITY DEFINER allowlist** unchanged (no new SECURITY DEFINER).
- **Postgres-owned views** — N/A (no view in 3d).
- **Privilege checks** — no new TRUNCATE/TRIGGER/REFERENCES on anon/authenticated.

### 12.2 Schema content scan (mirror of 3c test pattern)

- All columns from §3.1 present with correct types and nullability.
- All CHECK constraints reject invalid values (round-trip per enum: `status`, `evidence_kind`).
- All FKs in §3.1 exist with the specified ON DELETE behavior.
- Required indexes from §8 exist (and the deferred ones are explicitly absent).
- Both `BEFORE UPDATE` triggers exist with the expected names.

### 12.3 Workflow / status-transition tests

- `pending → approved` by admin via UPDATE: succeeds; sets `reviewed_by`, `reviewed_at`.
- `pending → rejected` by admin: succeeds.
- `pending → withdrawn` by service_role: succeeds.
- `approved → superseded` by service_role: succeeds.
- `pending → applied` (any): must FAIL (no `'applied'` value).
- `pending → superseded` (any): must FAIL (only allowed from `'approved'`).
- `approved → pending` (any): must FAIL (no transition back).
- `rejected → approved` (any): must FAIL (terminal).
- `withdrawn → pending` (any): must FAIL (terminal).
- `superseded → approved` (any): must FAIL (terminal).
- `authenticated` non-admin UPDATE: must FAIL (RLS).
- `anon` UPDATE: must FAIL (RLS).

### 12.4 RLS tests (positive and negative)

- `anon`: cannot SELECT, INSERT, UPDATE, DELETE.
- `authenticated` (non-admin): cannot SELECT, INSERT, UPDATE, DELETE.
- `authenticated` (admin via `is_admin()`): can SELECT all rows; can UPDATE only with valid `pending → approved/rejected` transitions; cannot INSERT, DELETE in 3d.
- `service_role`: can INSERT, UPDATE (any allowed transition), DELETE.

### 12.5 Compatibility tests

- All `verification.ts` unit tests remain green; no behavioral diff.
- All Phase 4.89 invariants tests remain green.
- All DSC TEST suppression tests remain green.
- `event_audit_log` (Lane 5 PR A) tests remain green; no schema interaction.
- `venue_claims`, `organization_claims`, `event_claims` tests remain green; no schema interaction.

### 12.6 Negative tests

- `evidence_kind` outside the enum is rejected (especially: `'user_other'`, `'user_direct'` rejected).
- `status` outside the enum is rejected (especially: `'applied'` rejected).
- `evidence_url` longer than 2048 chars is rejected.
- `evidence_note` longer than 2000 chars is rejected.
- Inserting with `artist_profile_id NULL` is rejected.
- Inserting with `event_id NULL` is rejected.
- Deleting a referenced profile cascades claim rows.
- Deleting a referenced event cascades claim rows.

### 12.7 Migration guardrail / claims entry

- The 3d-execute PR must add an entry to `docs/investigation/track1-claims.md` claiming the migration file (per the `event-detail-type-badges.test.ts` guardrail). Same lane-discipline pattern as PR-226 / PR-244 / PR-264.

## 13. Stop-Gate Language for the 3d-Execute PR

When the future 3d-execute PR is opened, its description must include the following statements (verbatim or paraphrased while preserving meaning):

- "This PR implements `docs/investigation/source-observation-step-3d-artist-claims-brief.md` and the open-questions decision memo in `docs/investigation/source-observation-step-3d-open-questions-decision-memo.md`."
- "Runtime verification behavior is not changed. `last_verified_at IS NOT NULL ⇒ Confirmed` remains the only active rule."
- "[`web/src/lib/events/verification.ts`](https://github.com/samiserrag/denver-songwriters-collective/blob/main/web/src/lib/events/verification.ts) is unchanged."
- "[SOURCE-OBS-01](https://github.com/samiserrag/denver-songwriters-collective/blob/main/docs/CONTRACTS.md) remains Draft / Proposed / Not Active."
- "No application code, API/MCP/crawler/RPC route, badge, UI, or admin auto-confirm change is included. No reader or writer exists for `artist_claims` after this PR."
- "`event_audit_log` (Lane 5 PR A) semantics unchanged. Lane 5 PR B scope not expanded."
- "`event_change_log` (3c), `event_source_observations` (3b), `event_sources` (3a) all unchanged. Existing claim tables unchanged."
- "COMMUNITY-CORRECTION-01 boundary preserved structurally: `evidence_kind` enum has no `'user_other'` value; no `authenticated` INSERT policy ships in 3d. The future self-claim INSERT path is a separate stop-gate."
- "Migration not yet applied to any DB; the apply step is a separate stop-gate per [`30-supabase-migrations-and-deploy.md`](https://github.com/samiserrag/denver-songwriters-collective/blob/main/.claude/rules/30-supabase-migrations-and-deploy.md)."
- "Smoke / verification queries from §12 of the brief have been run and returned the expected results."

The reviewer compares the PR diff against this brief and the decision memo, checks the security tripwire, and validates the status-transition tests in §12.3 before approving.

## 14. Migration-History Posture (MODE B)

Per [`.claude/rules/30-supabase-migrations-and-deploy.md`](../../.claude/rules/30-supabase-migrations-and-deploy.md), this repo's migration history is dirty and `supabase db push` would attempt to re-apply many already-applied migrations. The 3d-execute apply will use **MODE B** (direct `psql -f` plus a manual INSERT into `supabase_migrations.schema_migrations`) — same pattern as 3a (PR #226), 3b (PR #244), and 3c (PR #264). **No `supabase db push`.**

The 3d-execute PR description must include the same stop-gate language: the merge does not authorize the apply; the apply requires its own explicit approval phrase.

## 15. Non-Goals (Explicit)

This brief does **not**:

- Author or commit any SQL migration.
- Modify [`web/src/lib/events/verification.ts`](../../web/src/lib/events/verification.ts) or any other application code.
- Add or modify any API/MCP/crawler/RPC route.
- Modify the verification UI, badge component, or any rendered surface.
- Change any admin auto-confirm path.
- Activate, supersede, or otherwise modify [SOURCE-OBS-01](../CONTRACTS.md).
- Begin operational ingestion of any external source.
- Authorize backfill execution.
- Authorize the 3d migration itself.
- Authorize the future self-claim INSERT path (Step 5 or substep 3d.1).
- Authorize any subsequent step (3e `claim_status` trigger, 4 derivation function, 5+ badge component / supersession / UI).
- Expand Lane 5 PR B scope.
- Touch `event_audit_log` shape or semantics.
- Touch existing claim tables (`venue_claims`, `organization_claims`, `event_claims`).
- Touch existing 3a / 3b / 3c migration files or briefs.
- Authorize `supabase db push` or any other migration mechanism than MODE B.

---

**End of brief. Approval records the recommended shape; the 3d-execute migration PR is its own stop-gate, and the apply step is a third stop-gate after that.**

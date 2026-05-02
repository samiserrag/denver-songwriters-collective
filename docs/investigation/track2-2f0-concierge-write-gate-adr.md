# Track 2 2F.0: Concierge Write Gate Hardening ADR

**Date:** 2026-05-02
**Status:** Proposed - investigation only
**Scope:** Track 2 security ADR for future existing-event AI apply
**Runtime behavior changed:** No
**Needs Sami approval before implementation:** Yes

---

## 1. Purpose

This ADR locks the write boundary for the future host concierge before any
existing-event AI apply path is enabled.

The central decision: **all LLM output is untrusted input.** The LLM may propose
intent, natural-language reasoning, candidate patches, candidate events, and
evidence. The server decides what can actually be written, to which object, at
what scope, at what risk tier, with which confirmation, audit trail, rollback
affordance, and kill-switch behavior.

Until this ADR is approved and a later implementation PR ships, existing-event
AI apply remains disabled. The current `allowExistingEventWrites={false}` and
`canWriteExistingEvent` lock stays in force.

---

## 2. Evidence and Current State

Track 2 roadmap evidence:

- `docs/investigation/track2-roadmap.md:32` says existing-event AI apply is
  currently interpret/preview-locked by `allowExistingEventWrites={false}` and
  `canWriteExistingEvent`, and that lifting the lock is gated by 2F.0.
- `docs/investigation/track2-roadmap.md:33` says published-event high-risk
  changes require explicit confirmation through the PR 9 gate.
- `docs/investigation/track2-roadmap.md:334-343` identifies 2F false-positive
  matches as the highest-stakes blast-radius risk and names rollback affordance
  as a mitigation.
- `docs/investigation/track2-roadmap.md:701-705` defines Track 2 concierge
  completion as unlocking existing-event AI apply behind 2F.0 hardening while
  preserving PR 9 confirmation gates.

Agent concierge plan evidence:

- `docs/investigation/agent-concierge-unification-plan.md:73` says the PR 9
  gate exists for future approved existing-event AI writes, but shipped AI edit
  entry points remain preview/interpret-only until 2F.0 approves the unlock.
- `docs/investigation/agent-concierge-unification-plan.md:79` repeats that
  `allowExistingEventWrites={false}` and `canWriteExistingEvent` keep
  existing-event AI apply locked until 2F.0 is approved and implemented.
- `docs/investigation/agent-concierge-unification-plan.md:318` names this ADR
  as the first 2F PR and says it must lock the server-side write boundary,
  audit/rollback affordances, and an off-by-default kill switch.

Claims ledger evidence:

- `docs/investigation/track1-claims.md:37-39` identifies Lane 2 Track 2 as the
  current security ADR phase, with 2F.0 as the first stop-gate before
  existing-event AI apply or CRUI extraction.
- `docs/investigation/track1-claims.md:129-133` records that PR 9 shipped a
  server-side gate on `/api/my-events/[id]` for published high-risk AI
  auto-apply writes and preserves `allowExistingEventWrites={false}` semantics.

---

## 3. Decision Summary

Future concierge write/apply work must use a server-owned write gate with these
properties:

1. LLM output is treated as untrusted and never authoritative.
2. The server owns object authorization and target selection.
3. The server owns writable field allowlists.
4. The server owns scope resolution: series, occurrence, cancel, or create.
5. The server owns risk-tier classification.
6. The server owns confirmation requirements.
7. Every write has an audit trail.
8. Every write has a rollback affordance.
9. A kill switch can disable all agent-initiated existing-event writes without
   disabling interpret/preview.
10. Existing-event AI apply remains disabled until a later implementation PR
    ships the approved gate.

PR 9 remains required, but it is not sufficient by itself. PR 9 handles the
published high-risk confirmation retry. 2F.0 defines the broader server-side
write boundary that must exist before the concierge can apply any existing-event
patches from AI.

---

## 4. Server Authority Model

### 4.1 Untrusted LLM Output

The server must ignore LLM assertions about:

- which user is authorized
- which event or occurrence should be changed
- whether the target is published
- whether a field is writable
- whether a field is high risk
- whether confirmation has already happened
- whether external evidence is trustworthy
- whether a write should bypass audit, rollback, or kill-switch checks

LLM output can only be parsed as a candidate proposal. The server must normalize
that proposal, intersect it with server-owned policy, and reject or downgrade
anything outside policy.

### 4.2 Target and Scope

The server decides the target object from authenticated route/session state and
server-side candidate resolution, not from the LLM alone.

Future implementation must enforce:

- `series` writes target a manageable event row.
- `occurrence` writes target a manageable event plus a validated occurrence key.
- `cancel` writes target a manageable event or occurrence and never delete rows.
- cross-event find-and-edit writes require a server-produced candidate selection,
  clear user confirmation of the selected event, and a fresh permission check.

The server must fetch the current row before write evaluation. Client state and
LLM-provided "prior state" are useful for display only and cannot decide
authorization, publish state, or risk.

### 4.3 Writable Fields

The server must maintain the writable field policy. A future implementation can
reuse the existing patch field registry and occurrence sanitizers, but the rule
is broader than a specific module: if a field is not server-allowlisted for the
current action and scope, it is not writable.

Policy requirements:

- Unknown fields are rejected or reported as blocked.
- Read-only/system fields are blocked even if the LLM proposes them.
- Venue/location fields must pass the approved resolver/persistence contract
  before the agent can claim they were applied.
- Cancellation writes use status/cancellation-specific policy and must never
  become delete writes.
- Prompt text cannot expand the allowlist.

### 4.4 Risk Tier

Risk tier is computed on the server from the normalized patch, current database
state, scope, and published status.

The LLM may suggest "this is low risk," but that label is informational only.
Server classification decides enforcement. Published high-risk changes continue
to flow through the PR 9 confirmation gate.

Minimum high-risk categories remain:

- event date and time
- venue and location
- recurrence shape
- cover image
- publish state, status, cancellation, and visibility-affecting changes
- any future field marked enforced/high-risk by the server registry

### 4.5 Confirmation

The server decides whether a write can proceed based on confirmation state.

Required confirmations:

- Published high-risk existing-event edits use the PR 9
  `ai_confirm_published_high_risk` confirmation path or its approved successor.
- Cross-event find-and-edit requires confirmation of the target event before any
  apply attempt, even if the patch itself is low risk.
- Cancel requires explicit confirmation and must identify the event/occurrence
  being cancelled. Future cancel implementation may require two-stage
  confirmation per the concierge plan.
- Bulk or multi-event operations require per-row confirmation unless a later ADR
  explicitly approves a safer batch pattern.

Confirmation tokens or flags must be server-issued or server-verifiable. LLM text
such as "the user confirmed" is never enough.

### 4.6 Audit Trail

Every successful agent-initiated existing-event write must produce durable audit
evidence sufficient for debugging, accountability, and rollback.

Minimum audit data:

- actor user id
- target event id and, when applicable, occurrence key
- action scope and action type
- prior server-fetched state or enough prior values to reverse the change
- normalized proposed patch
- applied patch
- blocked fields, if any
- risk tier and enforcement decision
- confirmation type and confirmation timestamp
- model id and prompt/contract version when available
- source/evidence summary, with external evidence labeled untrusted
- request id or trace id
- created timestamp

Audit storage shape is left to the future implementation PR because it may
require a migration. The requirement is not optional.

### 4.7 Rollback Affordance

Every successful agent-initiated existing-event write must have a rollback
affordance. V1 can be a server-admin/host-visible "restore prior values" action,
an audit-backed manual rollback runbook, or a dedicated undo endpoint, but the
implementation PR must make the chosen rollback path explicit and testable.

Rollback requirements:

- The prior state must be captured before applying the write.
- Occurrence overrides must capture the previous override state, including the
  "no override existed" case.
- Cancellation must be reversible and must not delete data.
- Rollback must respect authorization and audit rules.

This ADR does not require shipping full undo/redo UX. It requires a practical
rollback path for each agent write.

### 4.8 Kill Switch

Existing-event AI apply must be guarded by an off-by-default runtime kill switch,
with `ENABLE_AGENT_WRITE_APPLY` as the preferred name unless a later PR approves
a different name.

Kill-switch behavior:

- Default missing/false state disables all agent-initiated existing-event writes.
- Disabled state still allows interpret, preview, candidate search, and
  what-changed display.
- Disabled state returns an explicit non-write outcome such as
  `existing_event_ai_apply_disabled`.
- The switch is checked server-side immediately before the write path.
- The switch cannot be bypassed by client props, prompt text, LLM output, or
  telemetry state.

Optional narrower switches can be added later for cancel, URL import, or bulk
apply, but the global existing-event apply switch remains the safety floor.

---

## 5. Relationship to PR 9 Published-Risk Gate

PR 9 is preserved and remains part of the future apply path.

2F.0 does not replace PR 9. It wraps the broader concierge write boundary around
PR 9:

- 2F.0 decides whether an agent-initiated existing-event write is allowed to
  reach an apply path at all.
- PR 9 decides whether a published high-risk AI write needs the explicit
  published-risk confirmation retry.
- 2F.0 still applies to low-risk and unpublished writes because those writes can
  still affect the wrong event, exceed the allowlist, skip audit, or lack
  rollback.

Therefore the future implementation must not enable apply by only flipping
`allowExistingEventWrites` or relaxing `canWriteExistingEvent`. It must ship the
server-owned gate, then route approved writes through PR 9 where applicable.

---

## 6. Relationship to Current Locks

Current locks remain unchanged:

- `allowExistingEventWrites={false}` on existing-event AI pages.
- `canWriteExistingEvent` prevents existing-event AI apply in the shared UI path.
- Existing AI edit routes remain interpret/preview-only.

This ADR authorizes no runtime behavior change. A later implementation PR must
explicitly modify those locks only after Sami approves this ADR and the
implementation plan.

The later PR must include tests proving:

- disabled kill switch blocks apply
- unknown fields are blocked
- unauthorized targets are rejected
- LLM-provided risk/confirmation labels are ignored
- published high-risk changes still require PR 9 confirmation
- audit evidence is produced for successful writes
- rollback path works for the supported write type

---

## 7. Non-Goals

This PR does not:

- change runtime behavior
- enable existing-event AI writes
- extract or edit `ConversationalCreateUI.tsx`
- edit endpoints or runtime routes
- edit prompt files
- edit contract files
- edit `web/**`
- edit `supabase/migrations/**`
- edit `tools/symphony/**`
- edit `docs/investigation/track1-claims.md`
- add or rename environment variables in runtime code
- choose the final audit storage schema
- implement cancel, URL import, cross-event search, Q&A, or unified concierge UI

If any of those changes are required to complete this ADR, the correct action is
to stop and ask in the PR before proceeding.

---

## 8. Future Implementation Acceptance Criteria

A later implementation PR that unlocks any existing-event AI apply path must
meet all of these criteria before merge:

- Server-side kill switch defaults off and blocks apply.
- Server-side permission check runs on every target event or occurrence.
- Server-side writable field policy blocks unknown and system fields.
- Server-side risk classification ignores LLM-provided risk labels.
- PR 9 published-risk confirmation is preserved.
- Cross-event apply requires target confirmation.
- Cancel, if implemented, never deletes and requires explicit confirmation.
- Audit evidence is persisted for every successful write.
- Rollback affordance is documented and tested.
- Tests cover adversarial LLM output attempting to widen fields, scope, risk,
  confirmation, target id, or authorization.
- Preview/interpret flows still work when writes are disabled.

---

## 9. Stop Conditions

Stop and ask Sami via PR comment if this ADR or any follow-up requires:

- runtime code changes
- schema changes or migrations
- prompt changes
- contract changes
- edits under `web/**`
- edits under `supabase/migrations/**`
- edits under `tools/symphony/**`
- edits to §8.2 locked files
- enabling existing-event AI apply

---

## 10. Decision

Adopt the server-owned concierge write gate described above as the prerequisite
for future existing-event AI apply.

Approval of this ADR means future implementation may be planned against this
boundary. It does not enable writes. Existing-event AI apply remains disabled
until a later approved implementation PR ships.

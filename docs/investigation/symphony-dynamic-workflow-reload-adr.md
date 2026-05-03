# Symphony Dynamic Workflow Reload ADR

**Status:** Proposed / Not Active
**Date:** 2026-05-02
**Scope:** Investigation-only ADR for DSC Symphony dynamic `WORKFLOW.md` reload and policy drift semantics

Symphony remains prototype-only. This ADR does not authorize operational use.

This document defines the target policy reload, accepted/current workflow
snapshot comparison, and drift handling rules for a future Symphony
implementation. It does not edit runtime code, wire `runner.mjs` or `cli.mjs`,
start daemon mode, mutate GitHub issues, invoke Codex, or authorize any live
Symphony execution.

## 1. Purpose and Non-Goals

### Purpose

Dynamic workflow reload lets a long-running future Symphony daemon notice when
repo-owned policy in `WORKFLOW.md` changes, validate the new policy, compare it
against policy already accepted for active work, and decide whether each issue
can safely continue, retry, release, or block.

The purpose of this ADR is to define the semantics before implementation:

- which workflow fields may apply dynamically
- which fields require restart
- which fields require a hard stop or manual approval when they drift mid-run
- when accepted workflow snapshots are captured
- how current workflow snapshots are compared
- how each orchestrator state reacts to drift
- what evidence must be written for operators

### Non-Goals

This ADR does not:

- implement a file watcher
- implement `WORKFLOW.md` reload
- add runner or CLI behavior
- add config, doctor, package, dependency, or workflow defaults
- authorize daemon, `once --execute`, `recover-stale --execute`, or live issue mutation
- change app-server adapter wiring
- define workspace hook sandboxing
- authorize operational Symphony use

## 2. Current State

`tools/symphony/lib/workflow.mjs` statically parses workflow policy today. It
supports YAML front matter as the canonical format, preserves the legacy JSON
comment fallback, validates known safety-sensitive fields, and returns a parsed
workflow object with `config`, `prompt_template`, `markdown`, `format`, and
`warnings`.

`tools/symphony/lib/orchestratorWorkflowPolicy.mjs` provides the pure snapshot,
hash, and comparison layer. It accepts plain workflow policy objects, builds a
canonical policy snapshot, computes stable hashes, preserves unknown future
fields in the hash payload, and compares accepted/current snapshots with a
`workflow_policy_drift` reason.

`tools/symphony/lib/orchestratorReconcile.mjs` already consumes the helper in
pure dry-run reconciliation. It compares an issue or manifest accepted workflow
snapshot with observed current workflow evidence and maps malformed or changed
policy evidence to a fail-closed `workflow_policy_drift` reconciliation reason.

No runner or CLI reload path exists. Today the production prototype path loads
workflow policy at command start and does not re-read it during the command. A
future daemon would need restart to observe policy changes.

## 3. Reloadability Taxonomy

Dynamic reload must not treat every `WORKFLOW.md` field the same way. The
future implementation should classify changes before applying them.

### Safe to Reload Dynamically

These fields may apply to future dispatch after a valid reload, without
changing in-flight sessions:

- prompt body text for issues that have not yet been claimed
- descriptive comments or documentation text
- non-executable prompt guidance for future issues
- status display labels or wording that do not affect claim, run, block, or
  review label names
- observability formatting that does not change persisted schema
- future optional extension fields that the running implementation does not
  understand, if they are preserved and hashed but not interpreted

Safe dynamic reload means: apply to new dispatch decisions only. It does not
mean active sessions should be rewritten.

### Requires Restart

These fields should require daemon restart before taking effect:

- workspace root, state root, or log root paths
- hook definitions and hook timeout configuration
- adapter kind or adapter command
- app-server protocol options
- status server bind address or exposure settings
- any schema version migration that changes persisted state interpretation
- default concurrency if it changes process-level scheduling assumptions

Restart-required fields can still be parsed and reported in status, but active
processes should continue with their accepted snapshot until a reconcile rule
says otherwise.

### Requires Hard Stop or Manual Approval

These changes are safety-significant. If detected for claimed, running, or
retrying work, they should stop future automated progress and require explicit
human review or a later implementation-specific approval path:

- label names used for ready, running, blocked, human review, or general Symphony state
- high-risk write-set gates or approval rules
- accepted issue eligibility rules
- timeout ceilings or kill grace values that would shorten an in-flight run
- adapter/sandbox/approval posture changes
- workspace root changes while a worktree is active
- hook changes after a workspace has been prepared for a run
- max turns, retry limits, backoff policy, or cost/token caps
- any policy field marked `must_not_change_mid_run` by a future extension

### Must Never Change Mid-Run

The accepted snapshot for these fields is fixed once an issue is claimed:

- issue approved write set and acceptance criteria evidence
- label state model used for claim/release/block/human-review writes
- workspace path for the attempt
- adapter kind used for the attempt
- prompt template used to start the attempt
- timeout and kill-grace values for the launched adapter process
- hook scripts that already ran or are scheduled for the current attempt
- state manifest schema version for the current attempt

If any of these drift, reconciliation should cancel, block, or release based on
the state-specific rules below. Silent continuation is not acceptable.

## 4. Snapshot Timing

Future implementation should capture accepted workflow snapshots at well-defined
state boundaries.

### Dispatch and Claim

Before an issue moves from `eligible` or `released` to `claimed`, the
orchestrator should parse the current `WORKFLOW.md`, validate it, build a
workflow policy snapshot with `orchestratorWorkflowPolicy.mjs`, and persist that
accepted snapshot with the issue claim evidence.

If parsing or validation fails before claim, do not claim the issue. Record a
planning or dispatch manifest error and skip dispatch for that tick.

### Workspace Preparation

Before preparing a workspace, compare the issue's accepted snapshot with the
current workflow snapshot. If drift affects workspace root, hooks, adapter
selection, or prompt construction, stop before workspace mutation and block or
release according to the transition policy.

### Adapter Start

Immediately before adapter launch, compare accepted and current snapshots again.
This is the final preflight before process execution. Drift in adapter, timeout,
sandbox, approval, prompt, write-set, or labels should fail closed.

### Retry Scheduling

When a retry is scheduled, persist the accepted workflow snapshot that produced
the retry decision. Store the snapshot hash, config hash, prompt hash, and drift
classification fields with the retry entry.

### Reconcile Tick

Every dry-run or future daemon reconciliation tick should parse the current
workflow, build a current snapshot, and compare it against accepted snapshots for
claimed, running, retrying, stale, or cancelled issues. Malformed current
workflow should fail closed for automated progress while preserving evidence.

### Stale Recovery

Stale recovery should record both the accepted snapshot found in stale state and
the current snapshot used during recovery. If the current workflow is malformed,
recovery dry-run may report the issue as stale, but execute should require
explicit approval and should not silently release a claim.

### Human Review and Release

When an issue reaches `human_review`, `blocked`, `released`, or final
`cancelled` cleanup, write the accepted workflow snapshot hash and the final
current snapshot comparison result into the terminal manifest. Terminal states
should not be re-dispatched automatically because workflow policy changes.

## 5. Accepted vs Current Snapshot Semantics

### Accepted Snapshot

The accepted snapshot is the policy snapshot captured at claim time or retry
schedule time. It belongs to a specific issue attempt and should be persisted in
manifest/state evidence.

Minimum accepted snapshot fields:

- `workflow_format`
- `workflow_version`
- `workflow_hash`
- `config_hash`
- `prompt_hash`
- `accepted_labels`
- `accepted_adapter`
- `accepted_timeouts`
- `accepted_workspace_root`
- `max_concurrent_agents`
- `recovery`
- `lock`
- `extra_policy_fields`
- `generated_at`

### Current Snapshot

The current snapshot is parsed from the current `WORKFLOW.md` on a reload or
reconcile tick. It must be built with the same helper as accepted snapshots. Do
not introduce a second hash model.

### Comparison

Comparison uses `compareWorkflowPolicySnapshots(accepted, current)` from
`tools/symphony/lib/orchestratorWorkflowPolicy.mjs`.

Rules:

- identical snapshots return `changed: false` and `reason: null`
- changed hash, version, format, labels, adapter, timeout, workspace root,
  concurrency, recovery, or lock fields return `reason: "workflow_policy_drift"`
- unknown future fields are canonicalized and hashed, so unknown-field drift is
  visible without bespoke logic
- malformed accepted or current snapshots fail closed with
  `workflow_policy_snapshot_compare_failed`

### Malformed Current Workflow

If current `WORKFLOW.md` cannot be read, parsed, validated, or snapshotted:

- do not claim new work
- do not start adapters
- do not fire retry work
- keep existing active process cleanup conservative
- emit an operator-visible reload error
- write a manifest/status entry with `reason: "workflow_policy_reload_failed"`
- for active `running` work, treat the failure as policy drift for the next safe
  reconciliation boundary unless the future implementation explicitly proves the
  last known good policy is safe to continue

Last-known-good config may be retained for status display and safe cleanup, but
it must not be used to silently dispatch new work after a malformed reload.

## 6. Drift Behavior by State

| State | Drift behavior |
|---|---|
| `eligible` | Do not claim until current workflow parses and validates. If policy changes before claim, use the new valid snapshot. Malformed current workflow means skip dispatch. |
| `claimed` | Compare before workspace prep and adapter start. Safety-significant drift cancels the claim before process launch and writes blocked or released evidence. |
| `running` | Compare on reconcile ticks and before follow-up turns. Safety-significant drift should request graceful stop, then block unless a future ADR allows clean release. |
| `retry_wait` | Compare when retry timer fires. If current policy is valid and compatible, retry may claim. If incompatible or malformed, cancel retry and block or release with evidence. |
| `stale` | Do not auto-release on policy drift alone. Preserve stale evidence, write recovery manifest, and block for human review unless a future recovery ADR approves a narrower release path. |
| `blocked` | No automatic action. A new valid workflow may inform a human re-approval, but blocked issues do not requeue automatically. |
| `human_review` | No automatic action. Human review remains terminal for automation. Workflow drift is historical metadata only. |
| `released` | No active claim exists. Future eligibility uses the current valid workflow. Malformed current workflow prevents future claim. |
| `cancelled` | Finish cleanup with the accepted snapshot and current drift reason. If cleanup is uncertain, block. |

## 7. Stop, Release, and Block Rules

### Cancel Running Work

Cancel running work when:

- the current workflow cannot be parsed or validated at a required checkpoint
- label names or state semantics drift
- adapter kind, timeout, sandbox, approval posture, or workspace root drifts
- prompt template changes while a multi-turn continuation would otherwise start
- hook definitions drift after hook lifecycle begins
- high-risk approval or write-set policy changes
- retry/cost/turn caps drift in a way that would reduce current safety margins

Cancellation should be graceful first, forced only under a separately approved
termination policy. This ADR does not implement process termination.

### Release or Requeue

Release or requeue only when no external mutation has occurred or when durable
evidence proves release is safe. Examples:

- issue was planned but not claimed
- claim exists only in local dry-run state
- retry entry is due but issue no longer eligible before any new mutation
- current workflow changed only in fields safe for future dispatch

### Block for Human Review

Block when evidence is ambiguous or safety-significant drift touches an active
or previously mutated issue:

- running label or workpad exists
- branch, worktree, or log exists for the issue
- adapter process may have run
- external mutations may have occurred
- current workflow is malformed during active recovery
- accepted/current snapshot comparison itself fails closed

### No-Op Is Acceptable

No-op is acceptable when:

- terminal issue is already `blocked`, `human_review`, or `released`
- current and accepted snapshots are identical
- drift affects only future-dispatch fields and the issue is not active
- an issue is already waiting for human action

## 8. Evidence Requirements

### Manifest Fields

Future manifests should include:

- `workflow.accepted_snapshot`
- `workflow.current_snapshot`
- `workflow.accepted_hash`
- `workflow.current_hash`
- `workflow.changed_fields`
- `workflow.drift_reason`
- `workflow.reload_error`
- `workflow.reload_checked_at`
- `workflow.last_known_good_hash`
- `workflow.decision`

### Status Snapshot Fields

Future status snapshots should include:

- `workflow.current_hash`
- `workflow.current_version`
- `workflow.last_reload_at`
- `workflow.last_reload_ok`
- `workflow.last_reload_error`
- `workflow.last_known_good_hash`
- per-issue `accepted_workflow_hash`
- per-issue `current_workflow_hash`
- per-issue `workflow_drift_reason`
- per-issue `workflow_changed_fields`

### Durable Write Intents

Reducer or reconcile decisions should use descriptive, non-mutating intents such
as:

- `record_workflow_snapshot`
- `record_workflow_reload_error`
- `record_workflow_policy_drift`
- `cancel_due_to_workflow_policy_drift`
- `block_due_to_workflow_policy_drift`
- `release_due_to_workflow_policy_ineligibility`

These are intents until a later implementation PR wires actual writes.

### Operator-Facing Reason Strings

Reason strings should be stable and searchable:

- `workflow_policy_drift`
- `workflow_policy_reload_failed`
- `workflow_policy_snapshot_invalid`
- `workflow_policy_changed_labels`
- `workflow_policy_changed_adapter`
- `workflow_policy_changed_workspace_root`
- `workflow_policy_changed_safety_gate`
- `workflow_policy_changed_prompt`
- `workflow_policy_changed_hooks`
- `workflow_policy_malformed_current`

## 9. Interaction With Existing Pure Helpers

Future implementation must reuse `tools/symphony/lib/orchestratorWorkflowPolicy.mjs`.

Do not create a parallel hash or snapshot model in `runner.mjs`, `workflow.mjs`,
`doctor.mjs`, or a future CLI command. All code paths should consume plain
snapshot objects and compare through the existing helper.

Future helpers should keep the current design constraints:

- accept plain objects, not file paths
- use injected clocks when timestamps are needed
- return structured decisions, not side effects
- fail closed on malformed required inputs
- preserve unknown optional/future fields without interpreting them
- avoid GitHub, shell, filesystem, network, and Codex calls unless a later slice
  explicitly scopes those dependencies

## 10. Future Implementation Slices

Slice A: pure tests for reload taxonomy and drift classification.

- No file reads.
- Fake accepted/current workflow snapshots only.
- Assert state-specific decisions for eligible, claimed, running, retry_wait,
  stale, blocked, human_review, released, and cancelled.

Slice B: dry-run-only reload harness with fake workflow snapshots.

- Compose `orchestratorWorkflowPolicy.mjs` and `orchestratorReconcile.mjs`.
- No runner/CLI wiring.
- No GitHub mutation.
- No real `WORKFLOW.md` read unless injected test fixtures are used.

Slice C: manifest/status plumbing.

- Persist accepted/current workflow snapshot fields into local state manifests
  through test temp files only.
- Extend status snapshot output with workflow reload fields.
- Keep all behavior non-operational.

Slice D: local workflow loader seam.

- Add an injectable loader function that can parse current `WORKFLOW.md` through
  `workflow.mjs` and build a policy snapshot.
- Do not watch files yet.
- Do not dispatch or cancel work.

Slice E: file-watch or poll-based reload implementation.

- Requires explicit high-risk approval if touching daemon control flow.
- Must be dry-run/status-only first.
- Must preserve last-known-good behavior and malformed reload evidence.

Slice F: runner/CLI wiring.

- Requires explicit high-risk approval naming `runner.mjs` and/or `cli.mjs`.
- Must not authorize operational use by itself.
- Must include deterministic tests with fake clocks and fake workflow snapshots.

## 11. Acceptance Criteria for Future Implementation

Every future implementation PR in this area must:

- state that Symphony remains prototype-only
- avoid live Symphony execution
- avoid GitHub issue mutation
- avoid real Codex or app-server invocation
- avoid runner/CLI changes unless explicitly scoped
- use deterministic tests with fake clocks and fake workflow snapshots
- prove malformed current workflow fails closed
- prove identical snapshots do not drift
- prove changed hash/version reports `workflow_policy_drift`
- prove unknown future fields remain hash-stable
- prove active states do not silently continue through safety-significant drift
- report exact changed files
- run `npm run symphony:test` if runtime helper code changes
- run `git diff --check origin/main..HEAD`

## 12. Stop Conditions

Stop and ask before implementation if:

- `runner.mjs`, `cli.mjs`, `config.mjs`, `doctor.mjs`, package files, or
  `WORKFLOW.md` need edits
- a real file watcher is needed
- live GitHub issue state is needed
- a live Symphony command seems necessary
- a real Codex process or app-server invocation seems necessary
- workflow drift behavior conflicts with the DSC full-spec gate
- release/block behavior cannot be decided from durable evidence

Operational use remains barred until the full DSC Symphony spec gate closes and
Sami explicitly approves it.

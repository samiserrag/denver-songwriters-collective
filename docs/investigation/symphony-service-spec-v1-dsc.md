# Symphony Service Spec v1, Adapted for DSC

**Date:** 2026-05-02
**Status:** Binding target spec and operational gate
**Applies to:** Denver Songwriters Collective repository
**Source spec:** Original Symphony Service Specification v1, adapted for this repo and environment

---

## 1. Purpose

This document defines the DSC-specific target for Symphony before it can be
used as an operational runner for repository work.

Current Symphony in this repository is Phase 1/2 prototype infrastructure. It
has useful pieces: GitHub Issues pickup, local worktrees, manifests, locks,
preflight checks, and docs. It is not approved to run real repo work until the
full DSC spec gate in this document is met.

This document supersedes any prior "ready for supervised use" wording in older
runbooks or investigation notes. Historical supervised trials remain useful
evidence, but they do not authorize operational use.

## 2. Hard Operational Boundary

Until the DSC full-spec gate is met, Symphony must not be used as an
operational coding runner.

Forbidden before the gate:

- Do not apply `symphony:ready` to new work.
- Do not run `once --execute`.
- Do not run daemon mode.
- Do not run `recover-stale --execute`.
- Do not set `SYMPHONY_EXECUTION_APPROVED=1`.
- Do not use Symphony for real coding tasks.

Allowed before the gate:

- Documentation-only planning PRs.
- Runtime implementation PRs that do not execute live Symphony commands.
- Unit tests and offline fixture tests.
- Read-only inspection of existing artifacts.
- Explicitly scoped dry-runs only when Sami approves the exact investigation.

## 3. DSC Adaptations Locked

### 3.1 Tracker Adapter

GitHub Issues is the DSC tracker adapter. It replaces Linear for this repo.

The original spec names Linear because it is language-agnostic and tracker
specific. DSC uses GitHub Issues because repository work, review, pull
requests, and mobile control already live in GitHub.

DSC tracker requirements:

- GitHub Issues are the source of candidate work.
- Labels are the scheduling state surface.
- Issue comments may hold the Codex Workpad status.
- Pull requests remain the review artifact.
- GitHub API access must be available to the local shell/runtime, not only to a
  GitHub plugin in an agent chat.

### 3.2 Local-Only Default

Symphony for DSC is local-only by default.

Required posture:

- No public Codex App Server listener.
- No public dashboard.
- No remote HTTP status surface unless a later ADR defines authentication,
  bind address, and exposure rules.
- Local state stays under `.symphony/`.

### 3.3 Human Review and No Auto-Merge

Human review is mandatory.

Symphony may prepare a branch and evidence, but it must not merge pull
requests. The handoff state remains human review, and final approval stays
with Sami.

Required behavior:

- No auto-merge.
- No bypass of existing CI/review gates.
- No automated close/done state for repo work without human confirmation.
- No replacement work pickup after a blocked or timed-out run in the same
  command.

### 3.4 DSC Governance Gates

DSC governance is part of the runtime contract, not optional documentation.

Required gates:

- `AGENTS.md` and `docs/GOVERNANCE.md` remain required reading for workers.
- Every executable issue must name an approved write set.
- Every executable issue must include acceptance criteria or an equivalent
  done condition.
- High-risk write sets require explicit high-risk approval.
- `tools/symphony/**` self-edit remains high-risk and requires explicit
  Symphony self-edit approval.
- Active claims, locked files, Track 1 boundaries, migrations, production app
  behavior, telemetry, prompt contracts, and web surfaces retain their normal
  DSC stop-gates.

### 3.5 Codex Adapter Boundary

Current `codex exec --json` usage is a temporary prototype adapter.

Before operational use, DSC must either:

- implement the app-server adapter expected by the original service spec, or
- approve a replacement ADR that proves `codex exec --json` is an intentional,
  spec-equivalent adapter for DSC.

Without that ADR, `codex exec --json` is not a full-spec transport. It lacks
the original spec's durable session model, app-server protocol surface,
multi-turn semantics, token accounting, and event stream contract.

## 4. Required Gates Before Operational Use

Every item in this section must be completed, deliberately rejected by Sami in
writing, or replaced by an approved ADR before Symphony can run real DSC repo
work.

### 4.1 Agent Transport

Required:

- App-server adapter, or approved replacement ADR for the current
  `codex exec --json` adapter.
- Explicit handling of user-input-required events.
- Clear approval and sandbox posture.
- Event stream contract sufficient for logs, status, and failure handling.

### 4.2 Real Orchestrator State Machine

Required:

- A single authoritative orchestration state model.
- Explicit states for claimed, running, retry queued, released, and completed
  bookkeeping.
- State transitions owned by the orchestrator.
- No reliance on labels alone as the complete runtime state.

### 4.3 Claimed, Running, Retry, Released States

Required:

- Deterministic claim before launch.
- Duplicate-dispatch prevention across poll ticks.
- Release behavior when work becomes ineligible.
- Clear distinction between tracker labels and internal runtime state.

### 4.4 Retry Queue and Backoff

Required:

- Retry entries with attempt counters.
- Continuation retry behavior after clean exits if still eligible.
- Exponential backoff for failures.
- Maximum retry/backoff configuration.
- Release path when retry becomes ineligible.

### 4.5 Mid-Run Reconciliation

Required:

- Poll or refresh active issue state while work is running.
- Detect terminal, blocked, removed, or otherwise ineligible issues.
- Update in-memory issue snapshots while still active.
- Preserve enough evidence to debug reconciliation decisions.

### 4.6 Stop on Ineligibility

Required:

- Stop active work when issue state changes make it ineligible.
- Cleanly update tracker/workpad state.
- Release local locks.
- Preserve workspace evidence unless cleanup is explicitly safe.

### 4.7 Dynamic `WORKFLOW.md` Reload

Required:

- Detect workflow changes without process restart.
- Re-validate before dispatch.
- Keep last known good config on invalid reload.
- Apply future-safe changes to future dispatch, hooks, and agent launches.

### 4.8 Workspace Hooks and Sandbox Posture

Required:

- `after_create`, `before_run`, `after_run`, and `before_remove` hook lifecycle,
  or an explicit ADR rejecting hooks for DSC.
- Hook timeout behavior.
- Failure semantics for each hook.
- Sandbox/trust posture decided before implementation.

### 4.9 Runtime Status and Snapshot Observability

Required:

- A current runtime status surface, at least a local CLI snapshot.
- Running sessions, retry queue, last outcomes, and lock status.
- Error modes for unavailable or timed-out status reads.
- No public exposure unless separately approved.

### 4.10 Token, Rate-Limit, and Session Accounting

Required if app-server is used:

- Session identifiers.
- Turn counts.
- Token input/output/total accounting.
- Runtime seconds.
- Latest rate-limit snapshot.
- Defensive parsing of app-server payload shape drift.

If an approved replacement adapter is used instead, the replacement ADR must
define equivalent or deliberately reduced accounting.

### 4.11 Live Stale Recovery Proof

Required:

- Deliberately staged stale `symphony:running` issue.
- Dry-run evidence first.
- Separate explicit Sami approval for the exact issue before execute. This is a
  gate-closing test, not general operational permission.
- `recover-stale --execute` proof that the issue becomes blocked, running is
  removed, manifest is written, and `runner.lock` is absent.
- Cleanup evidence.

### 4.12 End-to-End Daemon Trial

Required only after every gate above is satisfied:

- Fresh issue.
- Clean control checkout.
- One ready issue only.
- Separate explicit Sami approval for the watched daemon trial. This is a
  gate-closing test, not general operational permission.
- Clean shutdown.
- No stale lock.
- No mixed `symphony:running` / `symphony:human-review` label state.
- Final pull request and issue cleanup evidence.

## 5. Acceptance Standard

The full-spec gate is met only when:

1. The required gates above are complete or deliberately rejected by Sami.
2. The runbook and README say the same operational status.
3. Unit tests cover the new runtime behavior.
4. At least one watched end-to-end daemon trial passes after all required gates
   are implemented.
5. Sami explicitly approves operational use.

No single PR can imply operational readiness unless it updates this document
and the runbook to say the full-spec gate is complete.

## 6. Current Disposition

Current status: **prototype only, not approved for operational use.**

The current implementation may continue to evolve through scoped PRs, but the
default answer to "can Symphony run repo work now?" is no.

## 7. Change Control

Changes to this document require a docs PR and Sami approval.

Any future agent that sees conflicting language should follow this document and
treat operational Symphony use as blocked until the conflict is resolved.

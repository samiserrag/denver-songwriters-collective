# Symphony Phase 2.B Readiness and Operational Gates

**Date:** 2026-05-03
**Status:** Investigation summary / Not Active
**Scope:** Docs-only readiness summary for the Phase 2.B pure helper surface

Symphony remains prototype-only. This document does not authorize operational
use, runner or CLI wiring, live issue mutation, shell execution, hook
execution, connector calls, app-server calls, daemon mode, `once --execute`,
`recover-stale --execute`, or `SYMPHONY_EXECUTION_APPROVED`.

## 1. Purpose

Phase 2.B now has a substantial pure helper surface: state transitions,
snapshots, reconciliation, adapter-result ingestion, status aggregation,
workflow policy hashing, hook policy validation, tool capability snapshots, tool
policy decisions, manifest/status evidence, and dry-run fake tool-call policy
evaluation.

That is progress toward the DSC full-spec gate, but it is not operational
Symphony. The helpers are deliberately offline contracts and test harnesses.
They do not make repo work runnable by Symphony.

This document records what the Phase 2.B helper set provides, what remains
unwired, and which gates must close before any operational path can be
considered.

## 2. Current Phase 2.B Helper Surface

Recent merged helper PRs added the following pure, non-operational building
blocks.

| PR | Helper surface | What it provides |
|---|---|---|
| #230 | `tools/symphony/lib/orchestratorAccounting.mjs` | Normalizes token usage, rate limits, session/thread/turn metadata, and adapter event counts from plain issue and adapter snapshot payloads. |
| #235 | `tools/symphony/lib/orchestratorWorkflowPolicy.mjs` | Builds deterministic workflow policy snapshots, hashes canonicalized workflow fields, preserves unknown future fields, and compares accepted/current snapshots for policy drift. |
| #245 | `tools/symphony/lib/orchestratorHookPolicy.mjs` | Validates future hook policy objects, including hook names, command arrays, cwd restrictions, timeout and output limits, env allow/deny behavior, secret forwarding, interactive flags, and denied command classes. |
| #250 | `tools/symphony/lib/orchestratorCapabilitySnapshot.mjs` | Normalizes plain Codex-approved tool, MCP, plugin, and connector catalog inputs into deterministic capability snapshots with counts, availability state, approval-required summaries, and fingerprints. |
| #254 | `tools/symphony/lib/orchestratorToolPolicy.mjs` | Decides allow/block outcomes for a requested tool/action/category against an accepted capability snapshot, including high-risk approval checks and manifest/status-ready evidence. |
| #258 | `tools/symphony/lib/orchestratorToolEvidence.mjs` plus manifest/status plumbing | Normalizes passive capability snapshot summaries and tool-policy decision evidence for manifests and operator-facing status snapshots. |
| #260 | `tools/symphony/lib/orchestratorToolDryRun.mjs` | Runs fake tool requests through the pure tool-policy helper, records deterministic dry-run evidence, rejects secret-like inputs, and proves manifest/status evidence can consume the results. |

Earlier Phase 2.B slices remain part of the same offline core:

- `tools/symphony/lib/orchestratorState.mjs` defines state constants,
  transition reduction, durable-write intents, retry classification, and backoff
  math.
- `tools/symphony/lib/orchestratorStateManifest.mjs` defines the local
  orchestrator state snapshot schema and validation/read/write helpers.
- `tools/symphony/lib/orchestratorReconcile.mjs` produces pure reconciliation
  decisions from fake issue, workflow, workspace, lock, and clock evidence.
- `tools/symphony/lib/orchestratorAdapterIngest.mjs` maps app-server adapter
  result snapshots into reducer events and next-snapshot fields.
- `tools/symphony/lib/orchestratorHarness.mjs` composes the pure helpers in a
  fake end-to-end harness without touching the production runner.
- `tools/symphony/lib/orchestratorStatusSnapshot.mjs` derives
  operator-facing status from validated orchestrator snapshots.

## 3. What This Means

Phase 2.B now has a testable offline model for many decisions that the future
orchestrator will need:

- state transitions and retry/backoff policy
- versioned state snapshots and local manifest shape
- dry-run reconciliation results
- adapter terminal result ingestion
- runtime status summaries
- token, rate-limit, and session accounting normalization
- workflow policy snapshot/hash comparison
- hook policy validation
- capability catalog snapshots
- tool-policy decisions
- passive manifest/status evidence for tool decisions
- dry-run fake tool-call policy evaluation

These helpers make future implementation slices smaller and reviewable because
the decision contracts are no longer buried inside the runner.

They are still only contracts. They do not execute tools, mutate GitHub, call
MCP servers or connectors, spawn shells, run hooks, launch Codex, invoke
`codex app-server`, or start the Symphony daemon.

## 4. Explicit Non-Operational Boundary

The current Phase 2.B helper set is not wired into operational Symphony.

Current non-operational facts:

- `runner.mjs` is not replaced by the orchestrator helper stack.
- `cli.mjs` has no new operational command for the helper stack.
- No helper applies `symphony:ready`, transitions GitHub labels, comments on
  issues, opens PRs, or mutates GitHub.
- No helper starts daemon mode, `once --execute`, or `recover-stale --execute`.
- No helper sets or requires `SYMPHONY_EXECUTION_APPROVED`.
- No helper discovers or calls real MCP servers, plugins, connectors, browser
  tools, Supabase, Axiom, shell tools, or GitHub runtime APIs.
- No helper executes workspace hooks or shell commands.
- No helper calls real `codex app-server` or changes the active `codex exec`
  prototype path.

Any future doc or PR that implies these helpers make Symphony ready for
supervised or operational repo work is wrong and must be patched.

## 5. Remaining Gates Before Operational Use

The following gates remain before Symphony can be considered for operational
DSC repo work.

1. **Runner/CLI wiring approval.** Any PR touching `runner.mjs`, `cli.mjs`, live
   daemon control flow, live lock semantics, or execution commands needs
   explicit Sami approval and a high-risk review.
2. **Real Codex tool catalog sync.** The capability snapshot helper consumes
   plain catalog inputs only. A future sync path must define where the real
   Codex-approved tool catalog comes from, how it stays current, and how revoked
   or expired tools fail closed.
3. **App-server/tool bridge design.** The app-server adapter remains scaffolded
   and unwired. Dynamic tool requests from Codex need an explicit bridge design
   before any tool execution path exists.
4. **Actual tool/MCP/connector call execution policy.** Tool availability and
   authorization helpers exist, but no real tool calls are allowed. Execution
   needs a separate policy gate for each high-risk category.
5. **Hook execution approval.** Hook policy validation exists, but hooks remain
   disabled or fake/dry-run only. Real shell execution requires a separate
   high-risk stop-gate.
6. **GitHub issue mutation approval.** Scheduler-owned issue labels, comments,
   PR creation, or issue closure remain live mutations and require explicit
   approval before any new wiring.
7. **Daemon and recovery execute approval.** Daemon mode and
   `recover-stale --execute` remain barred until gate-closing tests are
   explicitly approved with exact issue numbers and evidence requirements.
8. **Emergency stop and rollback controls.** Before live runner wiring, the
   operator must have documented stop, cleanup, lock-release, and stale-state
   recovery procedures.
9. **Manifest/status operator review UX.** The helpers can produce evidence, but
   the operator-facing path for reviewing it before action is not wired.
10. **Security review for credential-bearing connectors and production
    mutations.** Any connector that can expose credentials, private user data,
    production data, publishing actions, DB writes, GitHub mutation, browser
    production mutation, or shell effects needs review before execution.

These gates are cumulative. Passing one does not imply the others are safe.

## 6. Recommended Next Sequence

The safest next sequence is still non-operational:

1. **Docs-only operational spec gap close.** Reconcile the Phase 2.B helper
   surface with `symphony-service-spec-v1-dsc.md` and the Phase 2 gap map so
   future agents can see which gaps are pure-contract closed and which remain
   operationally open.
2. **Dry-run integration tests with fake state.** Compose the helper stack with
   fake issue snapshots, fake workflow snapshots, fake capability catalogs,
   fake tool requests, and temp manifests. Keep this outside `runner.mjs` and
   `cli.mjs`.
3. **Explicit high-risk approval before runner, CLI, or tool execution wiring.**
   Any move from pure helpers into production command paths must name exact
   files, exact behaviors, exact test evidence, and exact forbidden actions.

Do not skip from helper readiness to live execution.

## 7. Stop Conditions for Future PRs

Stop and ask before continuing if a future Symphony PR would:

- touch `tools/symphony/lib/runner.mjs`
- touch `tools/symphony/cli.mjs`
- enable daemon mode or `once --execute`
- enable `recover-stale --execute`
- set or rely on `SYMPHONY_EXECUTION_APPROVED`
- apply `symphony:ready` or mutate GitHub labels/comments/issues/PRs
- call real Codex, `codex app-server`, MCP servers, plugins, connectors,
  browser tools, Supabase, Axiom, GitHub APIs, or shell commands
- execute workspace hooks
- bridge app-server dynamic tool calls to real tool execution
- add config, doctor, package, or `WORKFLOW.md` behavior for live execution
- claim that Symphony is ready for supervised or operational repo work

Each item requires its own explicit high-risk review and Sami approval. A
passing pure-helper test suite is not approval for live orchestration.

## 8. Current Readiness Summary

Phase 2.B is ready for more dry-run integration and documentation alignment.

Phase 2.B is not ready for operational use.

The correct current status remains:

> Symphony is prototype-only and not approved for operational DSC repo work.

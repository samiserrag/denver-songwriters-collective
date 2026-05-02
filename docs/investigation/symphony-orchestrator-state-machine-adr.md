# Symphony Orchestrator State Machine ADR

**Status:** Proposed / Not Active
**Date:** 2026-05-02
**Scope:** Investigation-only ADR for the DSC Symphony full-spec gate

Symphony remains prototype-only. This ADR does not authorize operational use.

This document defines the target state machine and implementation slices for a
future Symphony orchestrator. It intentionally does not edit runtime code,
wire the app-server adapter into the runner, start daemon mode, mutate GitHub
issues, or authorize any live Symphony execution.

## 1. Problem Statement

Current Symphony has a useful prototype execution flow: it can plan GitHub
Issues, write manifests, claim issues through labels, write a workpad comment,
create a worktree, call the current Codex adapter, and end in either blocked or
human review. That flow is still single-pass infrastructure, not a durable
orchestrator state machine.

Before Symphony can be considered for DSC operational use, it needs an explicit
state model with durable evidence, retry and backoff policy, stale recovery
semantics, stop-on-ineligibility behavior, and reconciliation boundaries. The
binding DSC spec requires this: `docs/investigation/symphony-service-spec-v1-dsc.md:140`
through `docs/investigation/symphony-service-spec-v1-dsc.md:185` require a
single authoritative state model, claimed/running/retry/released states, retry
queue/backoff, mid-run reconciliation, and stop-on-ineligibility. The same spec
keeps operational use barred until every gate is complete and Sami explicitly
approves use (`docs/investigation/symphony-service-spec-v1-dsc.md:255` through
`docs/investigation/symphony-service-spec-v1-dsc.md:271`).

## 2. Current-State Evidence

### 2.1 Runner Behavior

`tools/symphony/lib/runner.mjs` currently plans issues in a single pass. It
counts running issues, diagnoses eligibility, selects up to the configured
concurrency slot, and returns a plan with a label transition for `claim`
(`tools/symphony/lib/runner.mjs:63` through
`tools/symphony/lib/runner.mjs:113`).

`runOnce()` loads `WORKFLOW.md`, resolves config, creates a manifest context,
plans issues, and writes dry-run manifests without executing
(`tools/symphony/lib/runner.mjs:533` through
`tools/symphony/lib/runner.mjs:624`). Real execute mode is still guarded by
`SYMPHONY_EXECUTION_APPROVED=1`
(`tools/symphony/lib/runner.mjs:626` through
`tools/symphony/lib/runner.mjs:648`).

After execute preflight, the runner writes a pre-mutation manifest, applies the
running label, writes a workpad, creates a worktree, builds the prompt, and
calls the current adapter (`tools/symphony/lib/runner.mjs:681` through
`tools/symphony/lib/runner.mjs:748`). Adapter success moves the issue to
`human-review`; adapter failure moves it to `blocked`
(`tools/symphony/lib/runner.mjs:749` through
`tools/symphony/lib/runner.mjs:779`). If a runner-side error occurs during the
per-issue loop, it tries to mark the issue blocked and preserve local evidence
(`tools/symphony/lib/runner.mjs:780` through
`tools/symphony/lib/runner.mjs:818`).

Daemon mode is currently a wrapper loop around `runOnce()` with a runner lock
and cooperative shutdown (`tools/symphony/lib/runner.mjs:918` through
`tools/symphony/lib/runner.mjs:982`). It does not own a durable in-memory
state map, retry queue, or reconciliation loop.

### 2.2 Issue and Workpad Behavior

`tools/symphony/lib/issues.mjs` currently treats an issue as eligible only when
it is open, is not a pull request, has the ready label, and lacks running,
blocked, and human-review labels (`tools/symphony/lib/issues.mjs:16` through
`tools/symphony/lib/issues.mjs:24`).

The workpad marker and timestamp parser are already the durable surface used by
stale recovery (`tools/symphony/lib/issues.mjs:1` through
`tools/symphony/lib/issues.mjs:2`, and `tools/symphony/lib/issues.mjs:39`
through `tools/symphony/lib/issues.mjs:45`). Running issue staleness is
computed from the workpad or issue timestamp
(`tools/symphony/lib/issues.mjs:48` through
`tools/symphony/lib/issues.mjs:71`).

The existing label transitions support only `claim`, `blocked`, and
`human-review` (`tools/symphony/lib/issues.mjs:74` through
`tools/symphony/lib/issues.mjs:94`). The workpad records issue, state, last
updated time, command, mode, branch, worktree, log, run manifest, next human
action, blocked reason, and detail (`tools/symphony/lib/issues.mjs:96`
through `tools/symphony/lib/issues.mjs:128`).

### 2.3 Workflow and Policy Behavior

`WORKFLOW.md` is now YAML-front-matter based, pins `max_concurrent_agents: 1`,
sets the five Symphony labels, configures `.symphony/` roots, and keeps
`codex.adapter: "codex-exec"` as the current prototype adapter
(`WORKFLOW.md:1` through `WORKFLOW.md:23`). It also states that Symphony is
prototype infrastructure only and bars `symphony:ready`, `once --execute`,
daemon mode, `recover-stale --execute`, `SYMPHONY_EXECUTION_APPROVED=1`, and
real coding tasks before the full-spec gate (`WORKFLOW.md:25` through
`WORKFLOW.md:35`).

`tools/symphony/lib/workflow.mjs` supports YAML front matter and preserves a
legacy JSON-comment fallback (`tools/symphony/lib/workflow.mjs:17` through
`tools/symphony/lib/workflow.mjs:100`). Validation still restricts
`max_concurrent_agents` to `1` and supports only the `codex-exec` adapter
(`tools/symphony/lib/workflow.mjs:107` through
`tools/symphony/lib/workflow.mjs:142`).

### 2.4 Runbook and README Boundary

The runbook and README both say Symphony is prototype-only and is not approved
for operational repo work (`docs/runbooks/symphony.md:3` through
`docs/runbooks/symphony.md:15`; `tools/symphony/README.md:5` through
`tools/symphony/README.md:24`). They also document manifests and runner locks
as local state evidence (`docs/runbooks/symphony.md:198` through
`docs/runbooks/symphony.md:212`; `tools/symphony/README.md:107` through
`tools/symphony/README.md:129`).

### 2.5 App-Server Adapter Scaffold

The app-server adapter scaffold is isolated and unwired. It already normalizes
terminal taxonomy (`tools/symphony/lib/codexAppServerAdapter.mjs:221` through
`tools/symphony/lib/codexAppServerAdapter.mjs:246`) and logs adapter result,
adapter state snapshot, protocol events, and raw output
(`tools/symphony/lib/codexAppServerAdapter.mjs:248` through
`tools/symphony/lib/codexAppServerAdapter.mjs:260`). The snapshot includes
pid, thread ID, turn ID, session ID, turn count, last event, token usage, rate
limits, event counts, terminal status, terminal reason, and `ok`
(`tools/symphony/lib/codexAppServerAdapter.mjs:319` through
`tools/symphony/lib/codexAppServerAdapter.mjs:335`). Event sink entries expose
the same state fields for future orchestrator ingestion
(`tools/symphony/lib/codexAppServerAdapter.mjs:419` through
`tools/symphony/lib/codexAppServerAdapter.mjs:447`).

This ADR does not wire that adapter into `runner.mjs`.

## 3. Proposed State Model

The orchestrator state is distinct from GitHub labels. GitHub labels are
durable tracker evidence and operator controls; they are not the complete
runtime state.

| State | Meaning | Durable evidence |
|---|---|---|
| `eligible` | Open GitHub issue satisfies policy and may be claimed. | GitHub issue is open; lacks PR marker; has the configured ready label; lacks running/blocked/human-review labels; issue body has approved write set and acceptance criteria. |
| `claimed` | Orchestrator reserved the issue but has not yet launched Codex. | Local state snapshot entry; run manifest claim entry; workpad state `claimed`; GitHub label transition toward running may be pending or complete. |
| `running` | A worker/adapter session is active for one issue. | Local state snapshot with run attempt; `.symphony/state/runner.lock`; GitHub `symphony:running`; workpad state `running`; manifest running entry; per-issue JSONL log path. |
| `retry_wait` | No worker is active; orchestrator intends to retry later. | Local retry queue entry with attempt, due time, reason, last manifest path, and issue snapshot; GitHub label should not be `symphony:ready`; workpad state `retry_wait`. |
| `blocked` | Orchestrator cannot continue without human action. | GitHub `symphony:blocked`; workpad state `blocked`; manifest outcome reason; preserved worktree/log evidence. |
| `human_review` | Work completed its automated portion and awaits human review. | GitHub `symphony:human-review`; workpad state `human-review`; manifest outcome `ok: true`; branch/worktree/log paths. |
| `released` | Orchestrator has no claim and should not dispatch until eligibility changes. | No local claimed/running/retry entry; manifest release reason; optional workpad update when release is visible to humans. |
| `stale` | Durable evidence says an older claim/run likely outlived its process. | GitHub `symphony:running`; workpad timestamp or issue timestamp older than configured stale threshold; absent/invalid live process evidence; recovery manifest. |
| `cancelled` | Orchestrator stopped active work because eligibility or policy changed. | Workpad state `cancelled`; manifest terminal reason `cancelled_by_reconciliation`; GitHub label transition to `blocked` unless cancellation is a clean release. |

### State Snapshot Authority

Future implementation should keep a single in-memory authority while a daemon
process is live:

```json
{
  "version": 1,
  "generated_at": "2026-05-02T00:00:00.000Z",
  "running": {},
  "claimed": {},
  "retry_attempts": {},
  "completed": {},
  "codex_totals": {
    "input_tokens": 0,
    "output_tokens": 0,
    "total_tokens": 0,
    "seconds_running": 0
  },
  "codex_rate_limits": null,
  "last_tick": null,
  "last_manifest_path": null
}
```

Durability should remain restart-friendly and local: the manifest records what
happened, the workpad records human-visible state, labels provide tracker
evidence, and the future runtime snapshot provides current daemon memory. Do
not add a database for this gate.

## 4. Transition Table

| From | Trigger | Preconditions | Actions | Durable writes | Failure behavior | Next state |
|---|---|---|---|---|---|---|
| `released` | Poll tick sees eligible issue | Issue is open, ready-labeled, not blocked/running/human-review, write set and acceptance criteria pass. | Add claim entry; reserve issue number; validate workspace path. | Manifest planned issue; runtime snapshot `claimed`. | If manifest cannot be written, do not mutate GitHub; stay released. | `claimed` |
| `eligible` | Claim accepted | Concurrency slot available; issue still eligible on just-in-time refresh. | Apply claim label transition; write workpad state `claimed` or `running`; create log path. | GitHub labels; workpad; manifest claim event. | If GitHub mutation fails, remove local claim and write failed manifest. | `claimed` or `blocked` |
| `claimed` | Workspace preparation starts | Claim exists; issue still eligible; repo base policy passes. | Create/reuse worktree; run allowed future hooks; build prompt. | Manifest attempt phase; workpad detail. | Retryable workspace errors enter retry policy unless write-set or policy drift makes issue terminal. | `running` or `retry_wait` |
| `running` | Adapter session starts | Worktree exists; prompt built; app-server or approved adapter launched. | Record pid/session; stream adapter events into state. | JSONL log; runtime snapshot; manifest phase. | Launch failure is retryable if infrastructure-related, terminal if policy/config invalid. | `running`, `retry_wait`, or `blocked` |
| `running` | Adapter emits progress | Valid event; issue remains eligible. | Update last event timestamp, token totals, rate limits, turn count. | Runtime snapshot; optional manifest heartbeat on coarse cadence. | Sink failure should fail closed and enter terminal taxonomy. | `running` |
| `running` | Adapter returns `turn_completed` | Acceptance handoff reached and no continuation is requested. | Stop adapter; clear running claim; transition issue to human review. | GitHub human-review label; workpad; final manifest. | If final label/workpad write fails, preserve manifest and mark local blocked for manual repair. | `human_review` |
| `running` | Adapter clean exit but issue remains active and continuation is enabled | Continuation policy enabled; attempt cap not exceeded; issue still eligible. | Schedule short continuation retry. | Retry entry; workpad `retry_wait`; manifest retry due time. | If retry state cannot persist, block instead of silently dropping claim. | `retry_wait` |
| `running` | Adapter failure classified retryable | Attempt count below max; issue still eligible. | Stop adapter; schedule exponential backoff. | Retry entry; workpad `retry_wait`; manifest reason and due time. | If retry cannot be persisted, transition blocked. | `retry_wait` |
| `running` | Adapter failure classified terminal | Failure is policy/config/write-set/user-input/unsupported-tool or max attempts exceeded. | Stop adapter; clear running; block issue. | GitHub blocked label; workpad; final manifest. | If GitHub mutation fails, preserve local manifest and require manual recovery. | `blocked` |
| `running` | Reconciliation finds issue ineligible | Issue closed, blocked, human-review, ready removed, running removed unexpectedly, write set drift, or policy invalidates run. | Gracefully stop adapter; preserve evidence. | Workpad `cancelled`; manifest `cancelled_by_reconciliation`; label to blocked unless clean release is safer. | If stop fails, mark stale and require recovery. | `cancelled` or `blocked` |
| `running` | Stall timeout | Last adapter event age exceeds configured threshold. | Terminate adapter; classify as retryable stall if attempts remain. | Manifest stall reason; retry or blocked workpad. | If termination fails, mark stale and require recovery. | `retry_wait`, `stale`, or `blocked` |
| `retry_wait` | Retry timer due | Issue still eligible; concurrency available; attempt cap not exceeded. | Move retry entry to claimed; refresh issue/body/comments. | Manifest retry fired; runtime snapshot. | If issue is not eligible, release claim and write reason. | `claimed` or `released` |
| `retry_wait` | Issue becomes terminal/ineligible before due time | Tracker refresh sees closed, blocked, human-review, or missing issue. | Cancel retry timer; remove claim. | Manifest release reason; workpad optional. | If release evidence cannot be written, keep blocked for manual review. | `released` or `blocked` |
| `stale` | Recover-stale dry-run | Running label and stale timestamp detected. | Assess only. | Recovery manifest planned stale issue. | No GitHub mutation. | `stale` |
| `stale` | Approved recover-stale execute | Exact issue approved; manifest writable; no live process evidence. | Move issue to blocked; update workpad; release local stale claim. | GitHub blocked label; workpad; recovery manifest. | If any mutation fails, preserve manifest and require manual cleanup. | `blocked` |
| `blocked` | Human fixes issue and re-approves future run | Blocked label removed by human; ready label may be re-applied only after gate permits. | Treat as fresh eligibility on next poll. | New manifest only after future allowed run. | No automatic retry from blocked. | `eligible` or `released` |
| `human_review` | Human opens/merges PR or closes issue | Outside orchestrator automation. | Do not dispatch. | Existing workpad/manifest remain history. | No automatic transition. | `released` |
| `cancelled` | Cleanup complete | Adapter stopped and evidence written. | Remove local running; preserve workspace/log. | Manifest cancellation outcome. | If cleanup uncertain, block. | `released` or `blocked` |

## 5. Retry and Backoff Policy

Retry is a future implementation requirement. It must not be simulated with
GitHub labels alone.

### Retryable Failures

Retryable failures:

- transient GitHub read failure before claim mutation
- worktree creation or fetch failure that does not dirty protected state
- app-server startup read timeout
- adapter process exit before turn start, when attempts remain
- stall timeout, when process termination succeeds and attempts remain
- temporary no-concurrency condition

### Terminal Failures

Terminal failures:

- invalid workflow config or invalid environment override
- issue body missing write set, acceptance criteria, or required approval
- write-set drift after claim
- user-input-required event
- unsupported tool call while no tool handler is approved
- JSON-RPC protocol error that implies adapter incompatibility
- malformed protocol message
- repeated retry exhaustion
- any failure after external mutation where retry state cannot be persisted

### Attempts and Backoff

Recommended defaults:

- `max_attempts`: `3`
- continuation retry after clean exit if still eligible: `1000 ms`
- failure backoff: `min(10000 * 2 ** (attempt - 1), max_retry_backoff_ms)`
- default `max_retry_backoff_ms`: `300000`

### Retry Persistence

Retry intent must be visible in:

- runtime snapshot `retry_attempts[issue_number]`
- run manifest entry with `attempt`, `due_at`, `reason`, and `last_error`
- workpad state `retry_wait` with next retry time and manual stop instruction

GitHub labels should not use `symphony:ready` while an issue is in
`retry_wait`. The issue is reserved by the orchestrator; if the process exits
before retry fires, recovery must treat that as stale/released according to the
stale recovery rules below.

## 6. Mid-Run Reconciliation

Future daemon implementations must reconcile before dispatch and during active
runs. The initial implementation can be dry-run only, but the target contract
is:

1. Refresh active issue state by issue number.
2. Refresh labels and confirm the issue remains open.
3. Confirm the issue still has the expected running state if already claimed.
4. Re-parse the issue body sections that granted write set and acceptance
   criteria.
5. Re-load `WORKFLOW.md` policy and compare relevant fields to the run's
   accepted policy snapshot.
6. Re-check the repository base policy.
7. Check adapter last-event age for stall detection.

Reconciliation cadence:

- before every dispatch tick
- immediately before launching the adapter
- after each app-server turn completion
- at least every daemon interval while a run is active
- on any retry timer fire

Stop active work if:

- issue closes
- ready/running/blocked/human-review labels drift into an impossible state
- issue loses the evidence that made it executable
- approved write set changes after claim
- acceptance criteria change materially after claim
- workflow config changes in a way that invalidates the running adapter,
  workspace root, safety gates, timeout policy, labels, or high-risk rules
- repository base changes beyond the future accepted policy

Repository base policy should be conservative: if `origin/main` moves while an
issue is running, record the drift. The first implementation should not auto
rebase active work. It should continue only when the future implementation PR
defines the exact allowed drift; otherwise it should cancel or block with a
manifest reason.

## 7. Dynamic `WORKFLOW.md` Reload Boundary

This ADR does not implement dynamic reload.

The future state machine should treat `WORKFLOW.md` as policy input with a
versioned snapshot captured at claim time:

```json
{
  "workflow_format": "yaml-front-matter",
  "workflow_hash": "sha256:<hash>",
  "config_hash": "sha256:<hash>",
  "accepted_labels": {},
  "accepted_adapter": "codex-app-server",
  "accepted_timeouts": {},
  "accepted_workspace_root": ".symphony/worktrees"
}
```

On reload:

- valid non-safety changes apply only to future dispatch
- invalid reload keeps the last known good config and emits an operator-visible
  error
- safety-significant changes cancel or block active runs unless a later ADR
  proves they are live-safe
- app-server adapter changes do not affect an in-flight session unless the
  implementation explicitly supports restart

## 8. Stale Recovery Semantics

### What Counts as Stale

An issue is stale when all are true:

- GitHub issue is open.
- It has `symphony:running`.
- Workpad timestamp or issue timestamp is older than the configured stale
  threshold.
- No active local process/lock evidence proves that the current orchestrator
  owns the run.

Current prototype detection already uses workpad and issue timestamps
(`tools/symphony/lib/issues.mjs:48` through
`tools/symphony/lib/issues.mjs:71`) and `recoverStaleRunningIssues()` writes
dry-run/execute manifests (`tools/symphony/lib/runner.mjs:322` through
`tools/symphony/lib/runner.mjs:407`).

### Auto-Release vs Human Review

May be auto-released in future dry-run-only reconciliation:

- local retry entry exists but issue is now closed
- local claim exists before GitHub mutation and manifest says mutation never
  started
- stale local lock references a dead process and no issue has running label

Must go to blocked/human review:

- GitHub has `symphony:running`
- workpad indicates an external mutation started
- branch/worktree/log path exists
- adapter may have made file changes
- label/workpad state is contradictory
- recovery evidence is incomplete

Before releasing any stale claim, write:

- recovery manifest with before/after evidence
- workpad detail when the issue is human-visible
- local runtime snapshot event, if the daemon is running
- reason string precise enough for a human to audit

## 9. App-Server Integration Boundary

The app-server adapter remains unwired until a later implementation PR.

When it is wired, the orchestrator should ingest:

- `adapter_state_snapshot`
- `terminal_status`
- `terminal_reason`
- `thread_id`
- `turn_id`
- `session_id`
- `turn_count`
- `last_protocol_event`
- `last_protocol_event_at`
- `token_usage`
- `rate_limits`
- `adapter_events`
- `protocol_events`

Adapter event ingestion should update only orchestrator runtime state and local
logs/manifests at first. It should not introduce new GitHub mutations beyond
the existing workpad/label handoff until an implementation stop-gate approves
that wiring.

## 10. Observability Requirements

Minimum runtime status snapshot:

```json
{
  "ok": true,
  "mode": "daemon",
  "generated_at": "2026-05-02T00:00:00.000Z",
  "repo": {
    "head": "<sha>",
    "origin_main": "<sha>",
    "clean": true
  },
  "lock": {
    "held": true,
    "path": ".symphony/state/runner.lock",
    "run_id": "<run-id>"
  },
  "running": [
    {
      "issue_number": 123,
      "state": "running",
      "attempt": 1,
      "thread_id": null,
      "turn_id": null,
      "turn_count": 0,
      "last_event": null,
      "last_event_at": null,
      "seconds_running": 0,
      "worktree_path": ".symphony/worktrees/issue-123",
      "manifest_path": ".symphony/state/manifests/<id>.json",
      "log_path": ".symphony/logs/issue-123.jsonl"
    }
  ],
  "retrying": [
    {
      "issue_number": 123,
      "attempt": 2,
      "due_at": "2026-05-02T00:05:00.000Z",
      "reason": "response_timeout"
    }
  ],
  "codex_totals": {
    "input_tokens": 0,
    "output_tokens": 0,
    "total_tokens": 0,
    "seconds_running": 0
  },
  "rate_limits": null,
  "last_outcome": null
}
```

Manifest additions required by future implementation:

- `orchestrator_state_version`
- `attempt`
- `state_transitions[]`
- `retry_attempts[]`
- `reconciliation_events[]`
- `adapter_state_snapshot`
- `codex_totals`
- `codex_rate_limits`
- `workflow_hash`
- `policy_drift`

Operator-facing summary must answer:

- What is running?
- What is claimed?
- What is waiting to retry?
- What is blocked?
- What changed since the last tick?
- Is the lock held and by whom?
- What was the last terminal reason?

## 11. Safety and Stop-Gates

This ADR authorizes no runtime behavior.

Future stop-gates required:

- Any `runner.mjs` or `cli.mjs` wiring.
- Any daemon control-flow change.
- Any new state file format or lock format.
- Any GitHub mutation behavior beyond current label/workpad behavior.
- Any app-server adapter default switch.
- Any live daemon trial.
- Any live `recover-stale --execute` test.

A watched end-to-end daemon trial is a final gate only after app-server
integration, stale recovery proof, reconciliation, retry policy, and status
snapshot work are implemented and reviewed. It is not authorized by this ADR.

## 12. Rejected Alternatives

### 12.1 Label-Only State

Rejected. Labels are useful human-visible evidence, but they cannot represent
attempt counters, retry due times, token totals, rate limits, adapter event
timestamps, or process ownership.

### 12.2 Local-File-Only State

Rejected. Local state is restart-friendly but invisible from GitHub Mobile and
does not give humans enough context when a run blocks or stalls.

### 12.3 Immediate Runner Integration

Rejected. The adapter scaffold is now well tested, but the state machine needs
pure reducer tests and dry-run reconciliation before touching `runner.mjs`.

### 12.4 Operational Daemon Trial Now

Rejected. The DSC full-spec gate still requires real orchestrator state, retry
queue/backoff, mid-run reconciliation, dynamic workflow reload boundaries,
workspace hook/sandbox decisions, runtime status, live stale recovery proof,
and a final watched daemon trial.

## 13. Implementation Slicing Recommendation

Slice A: state model types and pure transition reducer tests.

- Add no GitHub calls.
- Add no runner wiring.
- Model states, triggers, transition output, retry classification, and terminal
  taxonomy ingestion.

Slice B: state persistence and manifest schema.

- Extend manifest-writing tests only.
- Add no live execution.
- Define backward-compatible manifest additions.

Slice C: reconcile loop in dry-run only.

- Use fake issue snapshots and fake clocks.
- Prove stop-on-ineligibility decisions without stopping real processes or
  mutating GitHub.

Slice D: app-server snapshot ingestion in dry-run only.

- Feed existing adapter fixture outputs into the reducer.
- Aggregate token/rate-limit/session fields.
- Do not wire the adapter as default.

Slice E: runner wiring behind non-operational test harness.

- Wire the reducer into a fake runner harness first.
- Keep live `once --execute`, daemon, and recovery execute barred.
- Require a new stop-gate before any real command uses it.

Operational use remains barred until all DSC spec gates close and Sami
explicitly approves use.

## 14. Acceptance Criteria for Future Implementation PRs

Every future implementation PR in this area must:

- State that Symphony remains prototype-only.
- Include the exact approved file scope.
- Avoid live Symphony execution unless a separate gate explicitly allows one
  exact test.
- Include pure reducer tests for any new transition.
- Prove invalid state transitions fail closed.
- Preserve existing label/workpad/manifests unless explicitly changing them.
- Show `git diff --name-only origin/main..HEAD`.
- Run `npm run symphony:test`.
- Run `find tools/symphony -name '*.mjs' -print0 | xargs -0 -n1 node --check`
  if any `.mjs` file changes.
- Run `git diff --check origin/main..HEAD`.
- Avoid `runner.mjs`/`cli.mjs` changes unless the implementation stop-gate
  explicitly names them.
- Avoid GitHub issue mutation in tests.
- Avoid real `codex app-server` invocation unless a later real-capture ADR
  approves that exact action.

# Symphony Workspace Hooks and Sandbox ADR

**Status:** Proposed / Not Active
**Date:** 2026-05-02
**Scope:** Investigation-only ADR for future DSC Symphony workspace hook semantics and sandbox posture

Symphony remains prototype-only. This ADR does not authorize operational use.

This document defines target workspace hook semantics and sandbox posture before
any hook implementation lands. It does not edit runtime code, wire `runner.mjs`
or `cli.mjs`, start daemon mode, mutate GitHub issues, invoke Codex, run hook
commands, or authorize live Symphony execution.

## 1. Purpose and Non-Goals

### Purpose

The DSC full-spec gate requires either workspace hook lifecycle support or an
explicit ADR rejecting hooks for this repository. This ADR chooses a conservative
path: future hooks may exist, but hooks must remain disabled or fake/dry-run
until a later high-risk stop-gate explicitly authorizes real shell execution.

This ADR defines:

- future hook names and lifecycle phases
- hook timing relative to claim, workspace prep, adapter launch, reconcile,
  retry, stale recovery, and cleanup
- cwd, env, secret, network, write-set, temp-dir, and PATH posture
- allowed command shape and denied command classes
- timeout, process-tree, output-capture, and non-interactive requirements
- failure semantics for hook success, timeout, nonzero exit, malformed config,
  output parse failure, and executor errors
- manifest/status/log evidence requirements
- implementation slices that preserve the prototype-only boundary

### Non-Goals

This ADR does not:

- implement hooks
- add hook config to `WORKFLOW.md`
- add a hook executor
- change runner, CLI, config, doctor, package, or runtime behavior
- run live shell commands
- start daemon mode
- run `once --execute`
- run `recover-stale --execute`
- set `SYMPHONY_EXECUTION_APPROVED`
- mutate GitHub issues
- invoke Codex or app-server
- authorize operational Symphony use

## 2. Threat Model

Workspace hooks are high risk because they can execute arbitrary local commands
inside or near a repository workspace. A future hook executor must assume:

- hook commands run with the operator user's permissions
- workspace contents may be AI-written, partially trusted, or modified by a
  failed run
- repo dirty state can leak into hook behavior
- environment variables may contain GitHub, database, Vercel, Codex, Axiom,
  Stripe, email, or model-provider secrets
- hooks may write outside the intended workspace if paths are not constrained
- hooks may start long-running or background processes
- hooks may perform network operations, package installs, pushes, deployments,
  database mutations, or telemetry writes
- hooks may generate logs that include secrets or prompt context
- hooks may prompt interactively and hang the orchestrator
- hook failure can leave GitHub labels, workpads, local worktrees, manifests,
  and runner locks in inconsistent states

For DSC, `WORKFLOW.md` is repo-owned and reviewed. That is not enough to make
arbitrary hook execution safe. Hook execution must be treated as a high-risk
local command surface.

## 3. Hook Taxonomy

The upstream spec names four workspace lifecycle hooks. DSC should keep that
real executable surface small at first.

| Hook | Future meaning | Default DSC posture |
|---|---|---|
| `after_create` | Run only after a new workspace/worktree is created. | Deferred; disabled until implementation gate. |
| `before_run` | Run after workspace prep but before adapter launch. | Deferred; disabled until implementation gate. |
| `after_run` | Run after adapter terminal result and before final handoff writes. | Deferred; disabled until implementation gate. |
| `before_remove` | Run before approved workspace removal. | Deferred; disabled until implementation gate. |

The orchestrator may also use internal planning hook points as non-executable
state/evidence names:

| Planning point | Purpose | Real execution status |
|---|---|---|
| `preflight` | Validate hook policy before any issue claim. | Fake/dry-run only. |
| `pre_claim` | Confirm hook policy is valid before reserving an issue. | Fake/dry-run only. |
| `post_claim` | Record claim evidence before workspace mutation. | Fake/dry-run only. |
| `pre_workspace` | Validate workspace path and repo cleanliness. | Fake/dry-run only. |
| `post_workspace` | Planning equivalent for `after_create`. | Candidate after gate. |
| `pre_adapter` | Planning equivalent for `before_run`. | Candidate after gate. |
| `post_adapter` | Planning equivalent for `after_run`. | Candidate after gate. |
| `pre_reconcile` | Validate reconciliation inputs. | Fake/dry-run only. |
| `post_reconcile` | Record reconciliation decision evidence. | Fake/dry-run only. |
| `cleanup` | Planning equivalent for `before_remove`. | Candidate after gate. |

Deferred or forbidden for the first implementation:

- arbitrary `sh -lc` hook strings
- user-provided issue-body hook commands
- hooks sourced from GitHub issue comments
- hooks that run before workflow config validation
- hooks that mutate GitHub labels/comments directly
- hooks that push branches, merge PRs, deploy, or mutate production data
- hooks that start background services or daemons
- hooks that require interactive input
- hooks that need public network access without a later ADR

## 4. Execution Timing

Future hook timing must be explicit and tied to durable evidence.

| Timing point | Future behavior |
|---|---|
| Dispatch preflight | Validate hook policy from the current workflow snapshot. Malformed config prevents claim and writes planning evidence only. |
| Claim | Do not run shell hooks before the issue is claimable. Capture the accepted workflow and hook policy snapshot with the claim. |
| Manifest snapshot | Record hook policy hash, hook names, mode, and intended phases before workspace mutation. |
| Workspace preparation | `after_create` may run only after a workspace is created now. Reused workspaces record `created_now: false` and skip `after_create`. |
| Adapter start | `before_run` may run after workspace exists and issue eligibility is rechecked, but before adapter launch. Failure prevents adapter start. |
| Adapter completion | `after_run` may run after adapter terminal result and before final handoff writes, using redacted result metadata. |
| Retry scheduling | Hook failures that retry must persist attempt, due time, hook name, phase, and output summary. |
| Reconcile tick | No real hooks during first reconciliation implementation. Reconcile may report hook policy drift only. |
| Stale recovery | No real hooks during stale recovery until separately approved. Preserve hook evidence from the stale attempt. |
| Cleanup | `before_remove` may run only before explicitly approved workspace deletion and must never delete needed evidence. |

Hook execution must use the accepted workflow snapshot for the issue attempt. A
current `WORKFLOW.md` change after claim is workflow policy drift; it must not
silently change active hook commands.

## 5. Environment Model

### Current Working Directory

Future real hooks should run with constrained cwd rules:

- default cwd is the per-issue workspace path
- policy validation has no cwd-dependent shell execution
- cleanup hooks use the workspace path only, never repository root unless a
  later ADR approves it
- hooks must not run from `$HOME`, `/`, `.git`, `.symphony/state`, or the
  operator's active checkout
- cwd must resolve inside the approved workspace root
- symlink traversal outside the workspace fails closed

### Environment Variables

Use an allowlist model, not parent-env pass-through.

Allowed example fields:

- `SYMPHONY_HOOK_PHASE`
- `SYMPHONY_ISSUE_NUMBER`
- `SYMPHONY_ISSUE_URL`
- `SYMPHONY_WORKSPACE_PATH`
- `SYMPHONY_WORKFLOW_HASH`
- `SYMPHONY_MANIFEST_PATH`
- `SYMPHONY_LOG_PATH`
- `CI=1`
- `NO_COLOR=1`

Denied by default even if present in the parent environment:

- `GITHUB_TOKEN`
- `GH_TOKEN`
- `DATABASE_URL`
- `SUPABASE_*`
- `VERCEL_*`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `CODEX_*` auth/session variables
- `AXIOM_*`
- `STRIPE_*`
- `RESEND_*`
- any variable containing `TOKEN`, `SECRET`, `PASSWORD`, `PRIVATE_KEY`, or
  `DATABASE`

A later implementation may allow per-hook, per-secret opt-in forwarding, but it
must be visible in manifests as redacted secret names and separately approved.

### Secret Exposure Policy

Default: no secrets are passed to hooks.

Hook stdout/stderr must be treated as potentially secret-bearing. Store only a
bounded, redacted summary in manifests/logs. Full raw hook output should not be
written unless a later ADR defines storage, redaction, and retention.

### Network Policy

Default: hooks have no approved network dependency. The first real executor
should not promise network sandboxing unless it actually enforces it. It should
deny command classes that are obviously network-mutating and require future
approval for any hook that needs network access.

No first implementation hook may deploy, push, call GitHub write APIs, call
Supabase write APIs, or contact production services.

### Write-Set Boundaries

Hooks must respect the issue approved write set and workspace boundary. Future
real hooks may write inside the per-issue workspace, but must not write:

- outside the workspace path
- to the operator's active checkout
- to `.git` internals
- to `.symphony/state` except through orchestrator-owned manifest APIs
- to `.symphony/logs` except through orchestrator-owned log APIs
- to production credentials, migrations, deployments, or database state unless
  the issue and a hook-specific stop-gate explicitly approve that scope

### Temp Directory Policy

Hooks should get a dedicated temp directory under the workspace, for example
`.symphony-hook-tmp/<hook-id>`, or an injected temp path controlled by tests.
Cleanup occurs only after output/evidence capture. Cleanup failure is logged and
must not delete worktree evidence.

### PATH and Tool Availability

Default PATH should be minimal and deterministic. Do not inherit shell profile
state. Future real hooks should assume only repo-declared tooling and basic
system commands. If a hook requires Node, npm, or git, the requirement must be
explicit in hook policy and visible in doctor/status once implemented.

## 6. Sandbox and Command Restrictions

### Recommended Command Shape

First real hook executor should prefer structured commands over shell strings:

```yaml
hooks:
  before_run:
    command: ["npm", "run", "symphony:hook:before-run"]
    timeout_ms: 60000
```

Command arrays avoid shell interpolation. Free-form shell strings such as
`sh -lc "..."` should remain forbidden until a separate ADR accepts the risk.

### Denied Command Classes

The first real implementation should reject command names or arguments that
clearly indicate high-risk behavior:

- `gh issue edit`, `gh pr merge`, `gh label`, or GitHub mutation commands
- `git push`, `git reset --hard`, `git clean`, `git checkout --`, `git worktree
  remove`, or branch deletion
- `supabase db push`, `supabase migration up`, remote `psql`, or production
  database mutation
- `vercel deploy`, `vercel env`, or deployment promotion commands
- global installs or arbitrary `curl | sh`
- `sudo`, `su`, recursive ownership/mode changes, or destructive absolute-path
  operations
- backgrounding with `&`, `nohup`, daemon starts, long-running servers, or
  process supervisors
- commands requiring a TTY

This denylist is not a sandbox by itself. It is a minimum validation layer until
a stronger sandbox is approved.

### Timeout and Process-Tree Behavior

Default hook timeout target: `60000 ms`.

Future executor requirements:

- start timeout before process spawn returns control
- send graceful termination first
- force-kill after a short grace period if needed
- record timeout, signal, duration, and output summary
- avoid process-tree leakage; if process groups are missing, record descendant
  cleanup as residual risk
- never intentionally leave background processes running

### Output Capture

Default maximum captured output per stream: `8192 bytes` after redaction.

Record hook name, phase, timestamps, duration, exit code/signal, timeout,
truncated stdout/stderr summaries, output redaction count, and manifest/log
paths. Do not record full raw output by default.

### No Interactive Prompts

Hooks must run with stdin closed or empty. Any prompt, TTY requirement, or
user-input wait should timeout and fail closed. Hooks must not call an agent
`request_user_input` path.

## 7. Failure Semantics

| Failure mode | Future behavior |
|---|---|
| Hook config valid, hook disabled | Record disabled status; continue through fake/dry-run decisions only before real implementation. |
| Hook success | Record success evidence and continue. |
| Hook timeout | Fail closed. `after_create`/`before_run` block or retry based on mutation state. `after_run`/`before_remove` preserve primary evidence and block if cleanup safety is uncertain. |
| Hook nonzero exit | Treat as hook failure. Do not launch adapter after `before_run` failure. |
| Malformed hook config | Fail validation before issue claim. Do not mutate GitHub. Write planning evidence only. |
| Hook output parse failure | Preserve redacted summary; mark parsed output unavailable; fail closed only if parsed output was required. |
| Boundary violation | Stop immediately; block for human review; preserve evidence. |
| Background process detected | Treat as failure; terminate known child/process group; block if cleanup is uncertain. |
| Hook executor internal error | Block rather than silently continue if any hook phase had permission to run. |

Phase-specific target behavior:

| Hook | Success | Failure |
|---|---|---|
| `after_create` | Workspace may proceed. | Fatal for the attempt. Retry only if no unsafe external mutation occurred. Otherwise block. |
| `before_run` | Adapter may launch. | Fatal before adapter launch. Block for policy/security failures; retry only for infrastructure failures with persisted retry state. |
| `after_run` | Final handoff may proceed. | Preserve adapter outcome. Default conservative choice is block with success/failure evidence preserved until a later implementation gate decides otherwise. |
| `before_remove` | Approved workspace removal may proceed. | Log and preserve workspace. Do not delete evidence. |

Hooks must never move an issue directly to human review, blocked, or released.
They return evidence to the orchestrator, which emits reducer events and durable
write intents.

## 8. Logging and Evidence

### Manifest Fields

Future manifests should include:

- `hooks.enabled`
- `hooks.mode`
- `hooks.policy_hash`
- `hooks.accepted_snapshot`
- `hooks.phase_results[]`
- `hooks.phase_results[].name`
- `hooks.phase_results[].phase`
- `hooks.phase_results[].command_redacted`
- `hooks.phase_results[].cwd`
- `hooks.phase_results[].started_at`
- `hooks.phase_results[].ended_at`
- `hooks.phase_results[].duration_ms`
- `hooks.phase_results[].exit_code`
- `hooks.phase_results[].signal`
- `hooks.phase_results[].timed_out`
- `hooks.phase_results[].stdout_summary`
- `hooks.phase_results[].stderr_summary`
- `hooks.phase_results[].output_truncated`
- `hooks.phase_results[].redaction_count`
- `hooks.phase_results[].reason`

### Status Snapshot Fields

Future status snapshots should include hook policy hash, latest hook phase,
latest hook result, latest hook failure reason, hook timeout config, execution
mode (`disabled`, `dry_run`, `fake`, `real`), and residual risk flags such as
`process_group_kill_unavailable`.

### Redaction and Evidence

Redaction must happen before writing manifests/logs. It should cover known
secret env var names, URL credentials, bearer tokens, GitHub tokens, database
URLs, multiline private keys, and common secret-key patterns.

If redaction fails, do not write raw output. Record
`output_redaction_failed: true` and block when hook output is needed for safety.

Stable reason strings:

- `hook_policy_invalid`
- `hook_disabled`
- `hook_timeout`
- `hook_nonzero_exit`
- `hook_output_parse_failed`
- `hook_boundary_violation`
- `hook_background_process_detected`
- `hook_redaction_failed`
- `hook_executor_error`
- `hook_cleanup_uncertain`

Manifests must not contain secrets or full plaintext tokens.

## 9. Prototype-Only Posture

Hooks must remain disabled or fake/dry-run until a later implementation PR
explicitly approves real shell execution. This ADR does not authorize runner or
CLI wiring.

Any future shell-executing implementation requires a high-risk stop-gate naming:

- exact files allowed to change
- hook phases allowed to execute
- command validation rules
- timeout and process termination behavior
- secret/env policy
- fake-executor test strategy
- whether real hook execution is allowed in any test
- whether a live gate-closing hook trial is approved, and on what exact issue

Operational Symphony use remains barred until the DSC full-spec gate closes and
Sami explicitly approves operational use.

## 10. Relationship to Existing Pure Helpers

Future hook policy work should follow the existing pure-helper pattern:

- `tools/symphony/lib/orchestratorState.mjs` owns transitions and durable write
  intents. Hook results should map to reducer events, not side effects.
- `tools/symphony/lib/orchestratorStateManifest.mjs` owns local snapshot
  validation and persistence. Hook evidence should be schema-validated before
  persistence.
- `tools/symphony/lib/orchestratorReconcile.mjs` owns pure reconciliation.
  Hook policy drift should be reconciliation evidence, not live shell execution.
- `tools/symphony/lib/orchestratorStatusSnapshot.mjs` owns operator-facing
  status aggregation. Hook summaries should be data, not command output.
- `tools/symphony/lib/orchestratorWorkflowPolicy.mjs` owns workflow snapshot
  hashing. Future hook config must be included in policy snapshots before
  dynamic reload or drift semantics apply.
- A future hook policy validator/helper should accept plain config objects,
  injected clocks, and fake executor results. It should not read files, call
  GitHub, spawn processes, or mutate workspaces.

Do not create a second hook policy model inside `runner.mjs` or `cli.mjs`.

## 11. Future Implementation Slices

Slice A: docs/tests first.

- Add no runtime behavior.
- Define fixture shapes and expected hook policy validation outcomes.
- Prove invalid hook config fails closed.

Slice B: pure hook policy validator/helper.

- Accept plain workflow config input.
- Normalize hook definitions.
- Validate command shape, phase names, timeout values, env policy, cwd policy,
  and denied command classes.
- Return structured decisions only.

Slice C: fake hook harness with no shell execution.

- Use injected fake executor results.
- Exercise success, timeout, nonzero exit, malformed config, parse failure,
  boundary violation, and cleanup uncertainty.
- Compose with reducer/manifest/status helpers through temp files only.

Slice D: hook evidence manifest/status plumbing.

- Persist fake hook evidence into local test manifests.
- Add status snapshot summaries.
- No real shell execution.

Slice E: real hook executor behind explicit approval.

- Requires high-risk stop-gate.
- Must use injected executor tests before real process tests.
- Must not be wired into live runner commands initially.

Slice F: runner/CLI integration last.

- Requires explicit approval naming `runner.mjs` and/or `cli.mjs`.
- Must remain non-operational until the DSC full-spec gate closes.
- Any live hook trial must be separately approved with the exact issue and hook
  command named.

## 12. Acceptance Criteria for Future Implementation

Future hook implementation PRs must:

- state that Symphony remains prototype-only
- avoid live Symphony execution
- avoid GitHub issue mutation
- avoid real Codex or app-server invocation
- avoid runner/CLI changes unless explicitly scoped
- use deterministic tests with fake clocks and fake executors
- avoid live shell execution in tests unless a specific later gate approves it
- prove malformed hook config fails closed
- prove denied command classes fail closed
- prove env allowlist and secret denylist behavior
- prove output truncation and redaction behavior
- prove timeout and termination decisions through fake executor results
- prove hooks cannot directly mutate orchestrator state, labels, or workpads
- report exact changed files
- run `npm run symphony:test` if runtime helper code changes
- run `find tools/symphony -name '*.mjs' -print0 | xargs -0 -n1 node --check`
  if any `.mjs` file changes
- run `git diff --check origin/main..HEAD`

## 13. Stop Conditions

Stop and ask before implementation if:

- `runner.mjs`, `cli.mjs`, `config.mjs`, `doctor.mjs`, package files, or
  `WORKFLOW.md` need edits
- real shell execution seems necessary
- live GitHub issue state is needed
- a live Symphony command seems necessary
- a real Codex process or app-server invocation seems necessary
- hook semantics conflict with the dynamic workflow reload ADR
- hook failure behavior cannot be decided from durable evidence
- secret redaction requirements cannot be implemented deterministically

Operational use remains barred until the full DSC Symphony spec gate closes and
Sami explicitly approves it.

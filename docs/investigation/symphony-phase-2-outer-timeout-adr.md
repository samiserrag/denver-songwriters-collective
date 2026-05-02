# Symphony Phase 2.H Outer Codex Execution Timeout ADR

Status: Proposed for coordinator review
Date: 2026-05-02
Scope: Symphony Phase 2.H operational hardening

## Decision

Add a Symphony-owned outer wall-clock timeout around each Codex execution
launched by `once --execute` or daemon execute mode.

Default timeout:

- Config field: `codex.execution_timeout_minutes`
- Environment override: `SYMPHONY_CODEX_EXECUTION_TIMEOUT_MINUTES`
- Default value: `30`

Default termination grace:

- Config field: `codex.execution_timeout_kill_grace_seconds`
- Environment override: `SYMPHONY_CODEX_EXECUTION_TIMEOUT_KILL_GRACE_SECONDS`
- Default value: `15`

When the timeout fires, Symphony must:

1. Stop the Codex child process gracefully first.
2. Force-kill it after the grace period if it is still alive.
3. Mark the issue `symphony:blocked`.
4. Remove `symphony:running`, `symphony:ready`, and
   `symphony:human-review`.
5. Update the workpad with a timeout-specific blocked reason.
6. Write the manifest with outcome reason `outer_timeout`.
7. Release `.symphony/state/runner.lock`.
8. Not launch replacement work in the same command.

This ADR is investigation-only. It does not touch runtime code, Symphony code,
GitHub issues, daemon mode, or live execution.

## Context

`docs/investigation/symphony-phase-2-spec-gap.md` records Phase 2.H as an
independent operational-hardening item because a single hung Codex process can
block the daemon indefinitely.

Current implementation evidence:

- `tools/symphony/lib/codexAdapter.mjs` launches `codex exec --json` with
  `spawn()` and waits for `close` without a Symphony-owned timer.
- `tools/symphony/lib/runner.mjs` already moves failed Codex runs to
  `symphony:blocked` and updates the workpad.
- `tools/symphony/lib/runner.mjs` releases `runner.lock` in `finally`; timeout
  handling should reuse that cleanup path.
- PR #160 added cooperative daemon shutdown. Timeout handling must not regress
  that signal behavior.

This ADR does not implement the original spec's full app-server turn timeout,
stall detection, retry queue, or multi-turn state machine.

## Goals

- Put a hard wall-clock bound on a single Codex execution.
- Fail closed when the bound is exceeded.
- Leave the GitHub issue in a clean blocked state, not a mixed running state.
- Preserve enough manifest, log, and workpad evidence to debug the timeout.
- Keep daemon behavior conservative: no immediate retry and no replacement
  issue pickup in the same cycle.
- Treat invalid timeout config as a blocking error, not as an implicit disable.

## Non-Goals

- No runtime code changes in this ADR PR.
- No `tools/symphony/**` edits in this ADR PR.
- No live Symphony issue mutation.
- No daemon, `once --execute`, or `recover-stale --execute`.
- No Codex app-server migration.
- No multi-turn continuation.
- No retry queue or exponential backoff.
- No public dashboard or status server.

## Timeout Cap

Use a 30 minute default outer timeout.

Rationale:

- It is long enough for the supervised Phase 1 work pattern seen so far.
- It is short enough that a hung daemon trial does not occupy the single
  `max_concurrent_agents: 1` slot for hours.
- It is stricter than the original spec's one-hour `codex.turn_timeout_ms`
  example and better matches the current safety-first Phase 1 posture.

Longer work should be split into smaller issues or deliberately override the
timeout after review.

## Config And Overrides

Add optional fields under the existing `codex` object in `WORKFLOW.md`:

```json
{
  "codex": {
    "adapter": "codex-exec",
    "fallback": "codex exec --json",
    "execution_timeout_minutes": 30,
    "execution_timeout_kill_grace_seconds": 15
  }
}
```

Environment variables override workflow config:

- `SYMPHONY_CODEX_EXECUTION_TIMEOUT_MINUTES`
- `SYMPHONY_CODEX_EXECUTION_TIMEOUT_KILL_GRACE_SECONDS`

Both values must be finite positive numbers. Invalid values include `0`,
negative numbers, `NaN`, `Infinity`, and non-numeric strings.

Fail-closed behavior:

- `doctor` fails when either value is invalid.
- `once --dry-run` fails before planning when config is invalid.
- `once --execute` fails before any GitHub mutation when config is invalid.
- daemon startup fails before the poll loop when config is invalid.
- invalid env overrides do not silently fall back to workflow defaults.

Disabling the timeout is not part of Phase 2.H. A no-timeout escape hatch would
need its own ADR because it weakens a daemon safety rail.

## Process Termination

Start the timeout after the Codex child process is spawned and before waiting
for `close`.

When the timer fires:

1. Record timeout metadata in memory immediately.
2. Send a graceful signal first:
   - POSIX: `SIGTERM`
   - fallback: `child.kill()` with the runtime default signal
3. Wait `execution_timeout_kill_grace_seconds`.
4. If the child is still alive, send a forced kill:
   - POSIX: `SIGKILL`
   - fallback: best-effort forced kill if available
5. Resolve the adapter with a structured timeout result after the child exits
   or the forced-kill path determines it is gone.

Preferred implementation detail: terminate the process group when Node and the
platform support it. If that creates risky cross-platform behavior, direct
child termination is acceptable for Phase 2.H, with descendant cleanup recorded
as residual risk.

Do not reject the adapter promise on timeout. Return a structured result so
`runner.mjs` can use its existing blocked-transition path.

Suggested adapter result shape:

```js
{
  ok: false,
  code: null,
  logPath,
  stdout,
  stderr,
  timedOut: true,
  reason: "outer_timeout",
  timeout: {
    timeoutMs,
    graceMs,
    startedAt,
    deadlineAt,
    firedAt,
    gracefulSignal: "SIGTERM",
    forcedKill: true,
    exitCode: null,
    exitSignal: "SIGKILL"
  }
}
```

The exact property names may change during implementation, but the manifest and
tests must preserve the same facts.

## Issue State On Timeout

Timeout is a blocked terminal handoff for the current run. The issue should end
with exactly:

- `symphony`
- `symphony:blocked`

The issue should not retain:

- `symphony:running`
- `symphony:ready`
- `symphony:human-review`

The transition should reuse `labelTransitionFor("blocked", config.labels)`.

Symphony must not auto-retry the issue or launch replacement work in the same
command. A human should inspect the log and decide whether to split the issue,
raise the timeout, or retry manually.

## Workpad Wording

On timeout, the workpad must be updated to state `blocked`.

Required wording:

- `State: blocked`
- `Blocked Reason: outer Codex execution timeout after <minutes> minutes`
- `Detail: Codex exceeded Symphony outer execution timeout; local log: <path>`
- `Next Human Action: Review the local log, inspect the worktree, and decide
  whether to retry with a smaller issue or an explicitly raised timeout.`

If forced kill was required, detail should include that fact:

```text
Codex exceeded Symphony outer execution timeout after 30 minutes; sent SIGTERM,
then SIGKILL after 15 seconds. Local log: <path>
```

If graceful termination succeeded, detail should say:

```text
Codex exceeded Symphony outer execution timeout after 30 minutes; terminated
with SIGTERM during the 15 second grace period. Local log: <path>
```

The workpad should keep the branch, worktree, log, manifest, command, and mode
fields currently written by `buildWorkpadBody`.

## Manifest Requirements

The run manifest must make timeout diagnosis possible without reading the
GitHub issue.

Required fields:

- `outcome.ok: false`
- `outcome.reason: "outer_timeout"`
- `outcome.timeout.issueNumber`
- `outcome.timeout.title`
- `outcome.timeout.timeoutMs`
- `outcome.timeout.graceMs`
- `outcome.timeout.startedAt`
- `outcome.timeout.deadlineAt`
- `outcome.timeout.firedAt`
- `outcome.timeout.gracefulSignal`
- `outcome.timeout.forcedKill`
- `outcome.timeout.exitCode`
- `outcome.timeout.exitSignal`
- `labelTransitions` entry showing the blocked transition
- `logs` entry for the issue log path
- `worktrees` entry for the issue worktree path

If the final manifest write fails after GitHub mutation, `runner.lock` still
must be released in `finally`. The issue workpad should already contain enough
evidence to recover manually.

## Log Evidence

The issue log file must include:

- all captured Codex stdout before timeout
- all captured Codex stderr before timeout
- a Symphony-generated timeout marker

Because `codex exec --json` produces line-delimited JSON, the timeout marker
should be machine-readable:

```json
{"event":"symphony_outer_timeout","reason":"outer_timeout","timeoutMs":1800000,"graceMs":15000,"forcedKill":true}
```

If implementation chooses a plain-text marker instead, it must be stable and
covered by tests.

## Daemon Behavior

Daemon mode should treat timeout as a completed active cycle with a blocked
issue, then continue according to normal scheduling after the interval.

Required behavior:

- The active issue is not left with `symphony:running`.
- `runner.lock` is released.
- The daemon does not immediately launch a replacement issue in the same
  `runOnce` call.
- A later daemon tick may pick up another `symphony:ready` issue only after the
  timeout cycle has completed and the normal interval elapses.

Interaction with PR #160:

- SIGINT/SIGTERM daemon shutdown should keep its cooperative behavior.
- If operator shutdown and outer timeout happen around the same time, the
  implementation must produce one final issue state and one lock cleanup path.
- If that interaction is not straightforward during implementation, stop and
  ask before changing daemon shutdown semantics.

## Failure And Rollback

If timeout handling itself fails, use the safest manual cleanup path:

1. Confirm no Codex or Symphony process is still running.
2. Preserve the worktree and log until reviewed.
3. If the issue still has `symphony:running`, manually move it to blocked:

   ```bash
   gh issue edit <issue-number> \
     --repo samiserrag/denver-songwriters-collective \
     --add-label symphony,symphony:blocked \
     --remove-label symphony:running,symphony:ready,symphony:human-review
   ```

4. Add a manual issue comment with timeout evidence and local paths.
5. Remove `.symphony/state/runner.lock` only after confirming no Symphony
   process is alive.
6. Run `npm run symphony:doctor` before any next Symphony execution.

If the timeout fires but GitHub mutation fails, do not retry automatically.
Surface the failure, keep local artifacts, and let the operator decide whether
to retry, recover stale state, or close the issue.

## Required Tests For Implementation PR

### Config tests

- Default `codex.execution_timeout_minutes` resolves to `30`.
- Default `codex.execution_timeout_kill_grace_seconds` resolves to `15`.
- Workflow config overrides both defaults.
- Environment variables override workflow config.
- Invalid timeout values fail closed.
- Invalid grace values fail closed.
- Invalid env overrides do not silently fall back to workflow values.

### Adapter tests

- A child process that exits before timeout resolves normally and is not killed.
- A child process that exceeds timeout receives the graceful signal.
- A child process still alive after grace receives the forced-kill signal.
- Timeout result includes `timedOut: true`, `reason: "outer_timeout"`, and
  timeout metadata.
- The log file includes captured stdout/stderr plus the timeout marker.
- Spawn errors still surface as non-timeout failures.

The adapter should expose dependency injection for the child process and timer
functions so tests do not sleep in real time.

### Runner tests

- `runOnce` moves a timed-out Codex result to `symphony:blocked`.
- `runOnce` removes `symphony:running`, `symphony:ready`, and
  `symphony:human-review` on timeout.
- Workpad blocked reason includes `outer Codex execution timeout`.
- Manifest `outcome.reason` is `outer_timeout` and includes timeout metadata.
- `runner.lock` is released after timeout.
- No second issue is launched in the same `runOnce` call after timeout.
- Existing non-timeout Codex failure behavior still works.
- Existing daemon SIGINT/SIGTERM tests from PR #160 still pass unchanged.

### Quality gates

The implementation PR must run:

```bash
npm run symphony:test
find tools/symphony -name '*.mjs' -print0 | xargs -0 -n1 node --check
git diff --check -- tools/symphony docs/runbooks/symphony.md tools/symphony/README.md WORKFLOW.md
```

## Acceptance Criteria For The Later Implementation PR

The implementation PR is acceptable only when:

- `codex.execution_timeout_minutes` defaults to `30`.
- `codex.execution_timeout_kill_grace_seconds` defaults to `15`.
- Invalid timeout or grace config fails closed before GitHub mutation.
- A timed-out Codex process receives graceful termination first.
- A still-running Codex process receives forced kill after the grace period.
- The timed-out issue ends with `symphony` + `symphony:blocked` only.
- The timed-out issue does not retain `symphony:running`.
- The workpad includes the timeout blocked reason and local log path.
- The manifest records `outcome.ok: false`,
  `outcome.reason: "outer_timeout"`, and timeout metadata.
- `.symphony/state/runner.lock` is absent after timeout completion.
- No replacement issue is launched in the same `runOnce` call.
- Existing daemon SIGINT/SIGTERM shutdown tests still pass.
- `npm run symphony:test` passes.
- Syntax and whitespace checks pass.

## Acceptance Criteria For This ADR PR

- Adds only `docs/investigation/symphony-phase-2-outer-timeout-adr.md`.
- Does not edit runtime code.
- Does not edit `tools/symphony/**`.
- Does not edit `WORKFLOW.md`.
- Does not mutate GitHub issues.
- Does not run daemon, `once --execute`, or `recover-stale --execute`.
- `git diff --check origin/main..HEAD` passes.
- `git diff --name-only origin/main..HEAD` returns exactly:

```text
docs/investigation/symphony-phase-2-outer-timeout-adr.md
```

## Follow-Up Implementation PR

The later implementation PR is expected to touch Symphony runtime files and
therefore requires explicit Sami approval before merge. If it touches
`tools/symphony/**`, include the self-edit approval phrasing required by PR
#147:

```text
Explicitly approved high-risk scope: tools/symphony self-edit.
```

That implementation PR should update this ADR only if final code changes a
decision above. It should update
`docs/investigation/symphony-phase-2-spec-gap.md` only after the feature ships,
changing the 2.H disposition from missing to done or partial as appropriate.

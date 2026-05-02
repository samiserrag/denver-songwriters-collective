# Symphony Agent Transport Adapter ADR

**Date:** 2026-05-02
**Status:** Proposed decision for Sami approval
**Gate:** DSC full-spec gate §4.1 Agent Transport
**Scope:** Investigation-only ADR; no runtime code changes

---

## 1. Decision Summary

**Recommendation:** implement the original `codex app-server` transport as
the DSC target path. Keep `codex exec --json` as the current prototype adapter
and possible fallback only; do not approve it as the full-spec replacement in
this ADR.

Reasoning:

- `docs/investigation/symphony-service-spec-v1-dsc.md:110-122` explicitly says
  `codex exec --json` is temporary unless a replacement ADR proves it
  spec-equivalent.
- The current adapter is one-shot process execution, not a durable session
  protocol. `tools/symphony/lib/codexAdapter.mjs:65-74` builds `codex exec
  --json -C <worktree> --sandbox workspace-write <prompt>`.
- The spec-gap map already identifies the app-server protocol as the largest
  single architectural gap, including missing session IDs, streaming events,
  multi-turn continuation, token accounting, rate-limit tracking, and explicit
  user-input handling.

This ADR does **not** authorize operational Symphony use. Symphony remains
prototype-only until every DSC full-spec gate is met and Sami separately
approves operational use.

## 2. Hard Boundary

This ADR is documentation-only.

Forbidden by this ADR:

- Do not apply `symphony:ready`.
- Do not run `once --execute`.
- Do not run daemon mode.
- Do not run `recover-stale --execute`.
- Do not set `SYMPHONY_EXECUTION_APPROVED=1`.
- Do not use Symphony for real repo work.
- Do not start the adapter implementation in this PR.

## 3. Current Adapter Inventory

### 3.1 Adapter File and Command Shape

Current adapter file: `tools/symphony/lib/codexAdapter.mjs`.

Current command shape:

- `buildCodexExecArgs()` returns `exec`, `--json`, `-C`, the worktree path,
  `--sandbox`, `workspace-write`, and the rendered prompt
  (`tools/symphony/lib/codexAdapter.mjs:65-74`).
- `runCodexExecAdapter()` spawns the `codex` binary directly with that argument
  list and the per-issue worktree as `cwd`
  (`tools/symphony/lib/codexAdapter.mjs:95-119`).
- stdout and stderr are buffered as process output rather than parsed as an
  app-server session protocol (`tools/symphony/lib/codexAdapter.mjs:121-133`).

### 3.2 Prompt and Runner Handoff Shape

The prompt is assembled by `buildCodexPrompt()` with:

- repository workflow text
- issue number/title/body
- approved write set
- acceptance criteria
- non-workpad issue comments

Evidence: `tools/symphony/lib/codexAdapter.mjs:32-62`.

`runOnce()` injects the adapter as `runCodexAdapter = runCodexExecAdapter`
(`tools/symphony/lib/runner.mjs:533-547`). During execution it:

- writes the initial manifest before external mutations
  (`tools/symphony/lib/runner.mjs:681-704`)
- applies the running label and workpad
  (`tools/symphony/lib/runner.mjs:708-732`)
- creates a worktree and builds the prompt
  (`tools/symphony/lib/runner.mjs:733-741`)
- calls the adapter with `worktreePath`, `prompt`, `logPath`, and timeout
  settings (`tools/symphony/lib/runner.mjs:742-748`)
- moves the issue to `human-review` on success or `blocked` on failure
  (`tools/symphony/lib/runner.mjs:749-779`)
- writes final manifest outcome after adapter completion
  (`tools/symphony/lib/runner.mjs:821-844`)

### 3.3 Manifest and Log Expectations

Run manifests are created through `createRunManifestContext()` and written by
`writeRunManifest()` (`tools/symphony/lib/manifest.mjs:35-87`). Current
manifests include:

- run id
- command and mode
- timestamps
- repository snapshot
- planned and skipped issues
- label transitions
- worktree/log paths
- lock metadata
- final outcome

The adapter writes a per-issue log file at `logPath`. Current logs preserve
raw stdout/stderr plus a line-safe timeout marker when the outer timeout fires
(`tools/symphony/lib/codexAdapter.mjs:77-92`, `195-207`).

### 3.4 Timeout Behavior

The prototype already has a Symphony-owned outer timeout around the direct
Codex child:

- timeout and grace values are passed from runner config into the adapter
  (`tools/symphony/lib/runner.mjs:742-748`)
- the adapter sends `SIGTERM` when the timeout fires and `SIGKILL` after the
  grace window if needed (`tools/symphony/lib/codexAdapter.mjs:152-174`)
- the adapter resolves with `reason: "outer_timeout"` and timeout metadata
  (`tools/symphony/lib/codexAdapter.mjs:197-207`)
- the runner maps that result to `outcome.reason: "outer_timeout"`
  (`tools/symphony/lib/runner.mjs:821-844`)

This is useful but not app-server-equivalent. It terminates a direct child
process; it does not model app-server turn timeouts, read timeouts, stall
events, or multi-turn sessions.

### 3.5 Current Doctor Visibility

`doctor` checks both `codex app-server --help` and `codex exec --help`
(`tools/symphony/lib/doctor.mjs:132-134`). This proves app-server binary
visibility only. It does not prove protocol compatibility, session startup,
turn streaming, approval handling, or token/rate-limit event parsing.

## 4. Option A: Implement `codex app-server` Adapter

### 4.1 Benefits

- Aligns with the original Symphony service spec and the DSC full-spec gate.
- Creates durable thread/turn identifiers for session accounting.
- Enables future multi-turn continuation without re-sending the original full
  prompt every time.
- Provides a structured event stream for turn completion, failure, user input,
  approvals, tool calls, token usage, and rate-limit telemetry.
- Enables real stall detection based on last protocol event timestamp.
- Makes runtime status snapshots materially useful.

### 4.2 Missing Work

Implementation would need to add a second adapter path, not replace the
existing prototype adapter in one jump.

Required pieces:

- App-server client module that launches `codex app-server` locally with
  `bash -lc <codex.command>` or an equivalent documented process launcher.
- Initialize/initialized/thread/start/turn/start handshake.
- JSON-line protocol reader from stdout with partial-line buffering.
- stderr diagnostic capture without protocol parsing.
- Turn completion mapping for completed, failed, cancelled, subprocess exit,
  response timeout, turn timeout, and input-required events.
- Session metadata extraction: `thread_id`, `turn_id`, `session_id`.
- Event callback into runner/orchestrator state for last event timestamp,
  token totals, rate limits, and last message summaries.
- Explicit user-input-required policy: fail the run attempt immediately for
  Phase 2 unless a later ADR approves a human-interaction path.
- Unsupported dynamic tool-call response path so app-server sessions do not
  stall waiting for tools Symphony does not expose.
- Adapter-level tests using fake app-server streams and deterministic timers.
- Runner integration tests proving manifest/workpad/log behavior is unchanged
  where expected.

### 4.3 Event Stream, Session, and Accounting Implications

The app-server adapter is not just a command swap. It changes Symphony's data
model.

Implementation must define where these live:

- `thread_id`
- `turn_id`
- `session_id`
- `turn_count`
- last protocol event and timestamp
- token input/output/total accounting
- rate-limit payload
- user-input-required status
- approval/tool-call diagnostics

The current manifest schema can hold outcome details, but durable runtime
session state likely belongs with the future orchestrator state machine, not
only in the adapter return object.

### 4.4 Local-Only Exposure Requirements

App-server must remain local-only for DSC:

- no public Codex App Server listener
- no public dashboard
- app-server subprocess launched inside the per-issue worktree context
- no remote bind unless a separate ADR approves a specific authenticated
  exposure model
- no tool extension that exposes GitHub or shell capabilities without a
  dedicated tool/sandbox ADR

## 5. Option B: Approve `codex exec --json` as DSC Replacement Adapter

### 5.1 Benefits

- Smaller implementation surface.
- Already exists and has unit coverage.
- Current runner, manifests, workpad updates, timeout handling, and logs already
  understand its return shape.
- Avoids taking a dependency on app-server protocol drift before a real need is
  proven.
- Keeps the system closer to the known Phase 1 prototype.

### 5.2 Gaps

Approving `codex exec --json` as the full-spec adapter would require accepting
meaningful divergence:

- no durable app-server thread model
- no reusable `thread_id` across continuation turns
- no native `turn_id` / `session_id` accounting
- no structured approval-request handling
- no user-input-required event contract
- no unsupported tool-call response path
- weak token/rate-limit accounting compared with app-server events
- no app-server read timeout or response timeout categories
- no clean path to spec-style multi-turn continuation without repeated CLI
  process launches

### 5.3 Failure Modes

Known or likely failure modes if `codex exec --json` is kept as the full-spec
adapter:

- A CLI behavior change can alter JSON output semantics without a stable
  app-server protocol boundary.
- Multi-turn continuation may duplicate prompt context or lose session memory.
- Session/accounting fields may be inferred rather than protocol-sourced.
- User-input-required states may appear as process hangs or generic failures.
- Tool-call gaps may be opaque to Symphony.
- Stall detection is limited to subprocess lifetime and outer timeout rather
  than last meaningful model event.

### 5.4 What Would Make This Acceptable

If Sami later wants to approve `codex exec --json` as the DSC replacement
adapter, a separate ADR should be required. That ADR would need:

- explicit list of original spec requirements being rejected or reduced
- replacement definitions for session id, turn count, token accounting, and
  rate-limit visibility
- tests for JSON output parsing and malformed output
- tests for user-input-required or equivalent failure behavior
- tests for process exit, timeout, cancellation, and nonzero status mapping
- documentation saying multi-turn continuation is unsupported or implemented
  through repeated one-shot CLI invocations with known limits
- explicit acceptance that app-server-level event streaming is out of scope

This ADR does not make that acceptance.

## 6. Recommendation

Choose **Option A: implement the original app-server adapter** as the DSC
target.

Keep `codex exec --json` as:

- the current prototype adapter
- a possible temporary fallback during app-server migration
- a comparison baseline for manifests/logs/workpad behavior

Do not treat `codex exec --json` as the full-spec adapter unless Sami approves
a separate replacement ADR with explicit reductions.

## 7. Stop Conditions for Future Implementation PR

Any future app-server implementation PR must stop and ask before continuing if:

- app-server protocol shape differs from the expected initialize/thread/turn
  sequence.
- Codex app-server cannot run locally without public exposure.
- user-input-required events cannot be detected deterministically.
- approval requests cannot be surfaced, failed, or resolved according to a
  documented policy.
- token or rate-limit event shape is ambiguous enough that accounting would be
  misleading.
- implementing the adapter requires changing the GitHub tracker boundary,
  write-set preflight, high-risk scope gates, or `symphony:ready` semantics.
- implementation requires live Symphony execution to prove basic behavior.
- implementation would touch `web/**`, migrations, Track 1 files, or any
  non-Symphony surface.

## 8. Acceptance Criteria for Future Implementation PR

A future implementation PR should not claim the §4.1 Agent Transport gate is
closed unless it satisfies all of these:

- Adds app-server adapter behind a config flag or explicit adapter selector.
- Keeps `codex-exec` available as fallback until app-server has its own
  supervised evidence.
- Adds unit tests for initialize/initialized/thread/start/turn/start ordering.
- Adds tests for partial stdout line buffering.
- Adds tests that stderr is logged as diagnostics and never parsed as protocol.
- Adds tests for `turn/completed`, `turn/failed`, `turn/cancelled`,
  subprocess exit, read timeout, turn timeout, and input-required failure.
- Adds tests for unsupported dynamic tool-call response behavior or explicitly
  documents no dynamic tools are advertised.
- Extracts and persists `thread_id`, `turn_id`, and `session_id`.
- Emits enough event data for future orchestrator state and runtime snapshot
  work.
- Preserves existing manifest/workpad/log safety properties.
- Keeps app-server local-only.
- Runs `npm run symphony:test`.
- Runs `find tools/symphony -name '*.mjs' -print0 | xargs -0 -n1 node --check`.
- Runs a docs/code diff check scoped to the implementation PR.
- Performs no live Symphony execution unless a separate gate-closing test is
  explicitly approved after implementation.

## 9. Residual Risks

- App-server protocol may drift. Mitigation: version-pin expectations in tests
  and keep `codex-exec` fallback until app-server has supervised evidence.
- Token/rate-limit payloads may vary by Codex version. Mitigation: parse
  defensively and do not expose accounting as authoritative until validated.
- App-server migration may couple to orchestrator-state work. Mitigation:
  adapter PR should emit event data without requiring full state-machine
  implementation in the same PR.
- Keeping `codex-exec` fallback can hide missing app-server coverage. Mitigation:
  gate closure requires app-server-specific tests and explicit status updates.

## 10. Non-Authorization

This ADR does not authorize operational Symphony use.

It also does not authorize:

- live issue staging
- `symphony:ready`
- `once --execute`
- daemon mode
- `recover-stale --execute`
- `SYMPHONY_EXECUTION_APPROVED=1`
- implementation work in `tools/symphony/**`

Operational use remains blocked by
`docs/investigation/symphony-service-spec-v1-dsc.md`.

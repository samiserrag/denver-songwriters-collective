# Symphony Operational Readiness Checklist

**Date:** 2026-05-03
**Status:** Proposed / Not Active
**Scope:** Docs-only operational readiness checklist for future DSC Symphony runner, CLI, hook, tool, and daemon wiring

Symphony remains prototype-only. This checklist authorizes no operational work.
It does not authorize runner or CLI wiring, live Symphony, daemon mode,
`once --execute`, `recover-stale --execute`, `SYMPHONY_EXECUTION_APPROVED`,
GitHub issue mutation, real `codex app-server`, hook execution, shell
execution, or real tool, MCP, plugin, or connector calls.

## 1. Purpose

Phase 2.B now has pure helper contracts for orchestration state, manifests,
reconciliation, status snapshots, workflow policy drift, hook policy,
capability snapshots, tool-policy decisions, and dry-run fake tool calls.

Those helpers are necessary but not sufficient for operational Symphony. This
document turns the remaining gates from
`docs/investigation/symphony-phase-2b-readiness-and-operational-gates.md` into
an explicit checklist that must be satisfied before any future PR touches
runner, CLI, hook execution, tool execution, GitHub mutation, daemon, or live
recovery paths.

## 2. Authority Model

| Role | Gate responsibility |
|---|---|
| Sami | Final approval for each high-risk gate and any operational-use decision. |
| Coordinator | Defines exact scope, issue number when applicable, allowed files, forbidden actions, evidence bundle, and stop conditions. |
| Implementing agent | May implement only the approved slice, must report exact diff and checks, and must stop on scope expansion. |
| Audit lane | Reviews diff, checks, boundary language, evidence, and whether the gate is actually closed. |
| Security reviewer | Required before credential-bearing connectors, production mutations, DB writes, shell execution, or public status exposure. |

No gate closes by implication. Green CI, passing unit tests, merged helper code,
or connected Codex tools are not operational approval.

## 3. Global Preconditions

Before any future PR touches runner, CLI, tool execution, hook execution,
GitHub mutation, daemon, or live recovery code, all of the following must be
true:

- The PR prompt explicitly says the requested change is high-risk and names the
  allowed files.
- The PR prompt says whether the change remains non-operational or whether a
  specific live action is approved.
- `docs/investigation/symphony-service-spec-v1-dsc.md` still says the same
  operational status as the runbook and README.
- The current branch starts from fresh `origin/main`.
- `git status --short --branch` is clean or unrelated dirt is isolated in a
  separate worktree.
- The implementation plan names rollback and emergency stop behavior before
  code changes.
- The implementation has deterministic tests with fake clocks, fake issues,
  fake tool catalogs, fake tool calls, fake hooks, and temp manifests wherever
  possible.
- No live GitHub issue, connector, app-server, shell, hook, daemon, or execute
  path is used unless the prompt approves that exact action.

## 4. Operational Gates

Each gate below must be completed, deliberately rejected by Sami in writing, or
replaced by a later approved ADR before Symphony can run operational DSC repo
work.

| Gate | Owner / approval | Evidence required to close | Stop if |
|---|---|---|---|
| Runner/CLI wiring approval | Sami plus coordinator high-risk prompt | Exact files, exact command path, before/after command output, tests, dry-run evidence, rollback plan, and audit comment. | The PR touches `runner.mjs` or `cli.mjs` without explicit approval. |
| Real Codex tool catalog sync | Sami plus security reviewer for credential-bearing catalog entries | Source of catalog, sync failure behavior, unavailable/revoked/expired examples, secret-free snapshot evidence, fingerprint stability tests. | Catalog source cannot be proven to match Codex-approved tools or emits secrets. |
| App-server/tool bridge design | Sami plus coordinator high-risk prompt | Protocol contract, unsupported tool behavior, user-input behavior, timeout behavior, token/rate/session evidence, fake-stream tests, real-capture policy if any. | Real `codex app-server` or dynamic tool execution is needed before approval. |
| Tool/MCP/connector execution policy | Sami plus security reviewer | Per-category allow/block rules, explicit approval shape, manifest/status evidence, redaction policy, fake tool-call harness results, blocked high-risk examples. | A real tool, connector, plugin, MCP server, browser, Supabase, Axiom, or shell call is attempted. |
| Hook execution approval | Sami plus security reviewer | Hook phase list, command-array policy, cwd/env/secret/network/write-set policy, timeout and process-tree behavior, fake executor tests, redaction tests. | Hook config requires free-form shell strings, inherited secrets, background processes, or unbounded output. |
| GitHub issue mutation approval | Sami plus coordinator high-risk prompt | Exact issue number or fixture, exact labels/comments/state changes, dry-run preview, plugin vs shell runtime access distinction, rollback labels/comments, audit comment. | The change can mutate issues/PRs outside the approved issue or requires shell GitHub access that is not healthy. |
| Daemon approval | Sami plus coordinator high-risk prompt | One-issue plan, clean checkout, preflight evidence, lock behavior, stop command, cleanup plan, no replacement pickup after terminal outcome, audit comment. | More than one issue is eligible or daemon would run without a watched operator. |
| `recover-stale --execute` approval | Sami with exact issue number | Staged stale issue evidence, dry-run output, manifest path, expected label transition, `runner.lock` absence, cleanup plan, post-execute audit. | The issue number is not named exactly or ready/running preconditions are not clean. |
| Emergency stop and rollback controls | Sami plus audit lane | Documented interrupt path, process kill semantics, lock cleanup, label/comment rollback, manifest preservation, stale-workspace handling. | Cleanup can delete needed evidence or leave GitHub state ambiguous. |
| Manifest/status operator review UX | Sami plus audit lane | Local status shape, manifest fields, redaction proof, recent failures, blocked reasons, capability/tool/hook summaries, no public exposure by default. | Status cannot be reviewed before action or exposes secrets/private connector data. |
| Credential-bearing connector and production mutation security review | Sami plus security reviewer | Credential inventory without secret values, allowed operations, redaction tests, production target controls, failure/timeout behavior, rollback plan. | Plaintext secrets appear in config, logs, manifests, status, PRs, or chat. |

## 5. Evidence Required Before Any Gate Closes

Every gate-closing PR or live proof must provide:

- current `HEAD` SHA and branch
- exact files changed
- exact commands run
- exact checks run and results
- whether GitHub plugin or shell GitHub access was used
- whether any GitHub issue, PR, label, comment, branch, worktree, lock,
  manifest, hook, shell command, app-server, or connector was touched
- generated manifest paths when manifests are written
- status snapshot output when status behavior changes
- redaction evidence when tool, hook, connector, browser, database, or log data
  may contain secrets
- rollback or cleanup instructions
- residual risks that remain after the PR

For docs-only PRs, evidence can be limited to diff scope and
`git diff --check origin/main..HEAD`.

## 6. Minimum Manifest and Audit Fields

Any future operational or gate-closing manifest must include enough evidence to
reconstruct what Symphony decided and why.

Minimum fields:

- `schema_version`
- `run_id`
- `issue_number`
- `issue_url`
- `branch_name`
- `worktree_path`
- `started_at`
- `ended_at`
- `duration_ms`
- `mode` (`dry_run`, `execute`, `daemon`, or later approved value)
- `operator_approval`
- `approved_write_set`
- `workflow_policy_snapshot`
- `workflow_policy_comparison`
- `orchestrator_state.from`
- `orchestrator_state.to`
- `orchestrator_state.reason`
- `actions[]`
- `durable_writes[]`
- `runner_lock.acquired_at`
- `runner_lock.released_at`
- `adapter.kind`
- `adapter.terminal_status`
- `adapter.terminal_reason`
- `adapter_state_snapshot`
- `token_usage`
- `rate_limits`
- `capability_snapshot.fingerprint`
- `tool_policy.decisions[]`
- `hook_policy.snapshot`
- `hook_results[]`
- `github_mutations_planned[]`
- `github_mutations_applied[]`
- `errors[]`
- `redactions[]`
- `rollback_instructions`
- `residual_risks[]`

Manifest and status output must not contain plaintext tokens, cookies,
database URLs with credentials, private keys, connector payload secrets,
browser session secrets, or unredacted production data.

## 7. Rollback and Emergency Stop Requirements

Before any runner, CLI, daemon, hook, tool execution, or GitHub mutation wiring
lands, the implementation must define:

- how to stop the active process
- how long graceful termination waits before forced kill
- whether process-tree kill is supported or direct-child kill is the limit
- how `runner.lock` is released or preserved for investigation
- how issue labels are restored or moved to `symphony:blocked`
- how workpad comments are updated with operator-readable reason text
- how manifests and logs are preserved before workspace cleanup
- how partial GitHub mutations are detected
- how connector/tool side effects are detected or marked uncertain
- how the operator knows no replacement issue was launched

If rollback itself fails, the default state is blocked/human review with
evidence preserved. Do not silently release a claim after uncertain cleanup.

## 8. GitHub Mutation Policy

GitHub plugin access and shell GitHub runtime access are separate.

Future Symphony runtime mutation must define which path is in use:

- GitHub plugin for chat-side PR/status/metadata work.
- Shell/runtime GitHub API for code under `tools/symphony` that must exercise
  the same path the runner will use.

GitHub issue mutation gates must name:

- exact issue or fixture
- allowed labels
- labels to remove
- labels to add
- allowed comments/workpad edits
- whether PR creation/update is in scope
- rollback labels/comments
- what happens if a mutation partially succeeds

No first implementation may mutate arbitrary GitHub issues by query result
alone. Candidate issue lists must be shown before execute mode, and live
mutation requires exact approval where the gate says so.

## 9. Hook Execution Policy

Hook execution remains forbidden until a separate high-risk approval names the
exact hook phases and command posture.

Future hook execution must:

- use structured command arrays, not free-form shell strings
- run only inside approved workspace cwd
- use env allowlists and secret deny rules
- cap runtime and output
- reject interactive prompts and TTY requirements
- reject known destructive or production-mutating command classes
- preserve redacted output summaries only
- map hook failures to orchestrator state decisions
- never bypass tool policy by shelling out to credential-bearing tools

Hook policy validation alone does not authorize hook execution.

## 10. App-Server and Tool Bridge Policy

The app-server adapter scaffold and fake-stream tests do not authorize real
app-server execution or tool bridging.

Before any app-server or tool bridge PR can touch runner/CLI behavior, it must
define:

- accepted app-server protocol version or real-capture policy
- dynamic tool request shape
- unsupported tool behavior
- user-input-required behavior
- timeout and cancellation semantics
- terminal taxonomy mapping
- capability snapshot required before tool authorization
- tool-policy decision required before any tool call
- manifest/status evidence for every request
- redaction and result-summary rules
- explicit no-auto-merge and human-review boundaries

If app-server protocol shape is uncertain, stop at fixtures, fake streams, or a
new ADR. Do not infer real tool execution behavior from undocumented payloads.

## 11. Production Credential and Connector Risk Review

Credential-bearing connectors and production mutation paths require security
review before use.

Risk review must cover:

- what credential is used, without exposing the secret value
- what scopes the credential grants
- whether the connector can read private user/member/customer data
- whether it can write or publish production data
- whether output can contain secrets or regulated data
- how logs, manifests, status, PRs, and chat redact outputs
- how revocation, expiry, disconnection, and auth errors fail closed
- what rollback is possible after a write
- which actions are forbidden even with approval

Connector installation or Codex approval is only availability. It is not
Symphony authority.

## 12. Daemon and Recover-Stale Execute Risk Review

Daemon and recovery execute gates are last-mile operational gates, not general
permission.

Before daemon approval:

- one eligible issue maximum
- clean control checkout
- `runner.lock` absent
- doctor and dry-run evidence available
- workflow snapshot accepted
- capability/tool/hook policy posture recorded
- operator is watching
- stop command is known
- no replacement issue pickup after blocked/timeout outcome

Before `recover-stale --execute` approval:

- exact issue number named
- issue is deliberately disposable or approved for recovery proof
- stale workpad timestamp and parser format verified
- dry-run output shows exactly the target issue
- expected label transition is documented
- `runner.lock` absence is checked before and after
- manifest path and summary are captured
- cleanup plan is written before execute

Passing these proofs closes only the named test gate. It does not approve
general daemon or recovery execution.

## 13. Runner, CLI, and Tool Execution Stop Conditions

Stop immediately and ask before continuing if a future PR would:

- touch `tools/symphony/lib/runner.mjs`
- touch `tools/symphony/cli.mjs`
- change `tools/symphony/lib/config.mjs`
- change `tools/symphony/lib/doctor.mjs`
- change `WORKFLOW.md`
- add or change package dependencies
- add an environment variable or approval flag
- apply or consume `symphony:ready`
- mutate GitHub issues, labels, comments, PRs, or reviews
- launch Codex, app-server, daemon, `once --execute`, or recovery execute
- run shell commands as a hook or tool
- call MCP, plugin, connector, browser, Supabase, Axiom, Vercel, or production
  services as part of Symphony
- expose a status endpoint beyond local-only defaults
- imply Symphony is ready for supervised or operational repo work

Each item needs a separate prompt with explicit approval, exact file scope,
tests, rollback plan, and audit route.

## 14. Current Disposition

Current status: **prototype only, not approved for operational use.**

This checklist is a gate document. It authorizes no operational work. Its main
effect is to make future operational PRs harder to start accidentally and easier
to audit deliberately.

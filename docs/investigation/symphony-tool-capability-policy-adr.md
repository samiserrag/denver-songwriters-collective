# Symphony Tool/MCP/Connector Capability Policy ADR

**Status:** Proposed / Not Active
**Date:** 2026-05-03
**Scope:** Investigation-only ADR for future DSC Symphony tool, MCP, plugin, and connector capability policy

Symphony remains prototype-only. This ADR does not authorize operational use.

This document defines the target policy boundary for tools available to future
Symphony-run agents. It does not edit runtime code, wire `runner.mjs` or
`cli.mjs`, start daemon mode, mutate GitHub issues, invoke Codex, run hooks,
call MCP servers, call connectors, change tool execution behavior, or authorize
live Symphony execution.

## 1. Purpose and Non-Goals

### Purpose

Sami's Codex tool approvals define the maximum tool universe available to
agents working in this repo. Symphony should not maintain a second ad hoc list
of tools that drifts from what Sami has connected, disconnected, approved, or
revoked in Codex.

At the same time, availability is not authority. A tool can exist in the Codex
catalog without being appropriate for a given issue, write set, environment, or
phase of a Symphony run. Symphony needs its own policy layer to decide when a
run may use a tool, how risky tool classes are gated, and what evidence must be
recorded.

This ADR defines:

- the distinction between Codex-approved tool availability and Symphony
  run-specific authority
- a future capability catalog snapshot model
- the high-risk tool categories that require explicit approval
- fail-closed behavior for missing, disconnected, revoked, expired, or
  unavailable tools
- manifest/status evidence requirements for tool decisions and tool attempts
- relationships to workspace hooks, the hook policy validator, future runner
  wiring, and future status snapshots
- implementation slices that preserve the prototype-only boundary

### Non-Goals

This ADR does not:

- implement capability discovery
- implement a tool policy helper
- execute tools, MCP servers, plugins, connectors, shell commands, or hooks
- add a tool registry to `WORKFLOW.md`
- add config, doctor, package, or dependency changes
- change Codex adapter behavior
- wire app-server tools into Symphony
- wire runner or CLI behavior
- mutate GitHub issues or pull requests
- authorize operational Symphony use

## 2. Core Principle

Sami's Codex approvals define Symphony's available tool universe. Symphony's
own policy defines when and how an agent may use those tools.

The future implementation should treat this as two separate questions:

1. **Available:** Is the tool present in the synced Codex catalog, connected,
   and usable by the current local environment?
2. **Authorized:** Is the tool allowed for this issue, phase, write set,
   environment, risk category, and explicit approval state?

An available tool with no matching Symphony authorization is blocked. A
Symphony policy entry for a tool that is not currently available is also
blocked. Both cases must produce operator-visible evidence.

## 3. Current State

`AGENTS.md` now defines the GitHub plugin / connector as the canonical GitHub
control plane for Codex agents in this repo. It also distinguishes plugin
access from shell GitHub access. Symphony runtime commands that call GitHub
from the shell need shell API auth and network access; the chat-side GitHub
plugin alone is not enough for those runtime paths.

`docs/investigation/symphony-service-spec-v1-dsc.md` keeps Symphony
prototype-only and requires GitHub API access for the local shell/runtime
before operational use.

`docs/investigation/symphony-orchestrator-state-machine-adr.md` defines future
manifest/status fields, state transitions, retry, reconciliation, and app-server
ingestion boundaries. It does not define tool capability policy.

`docs/investigation/symphony-workspace-hooks-sandbox-adr.md` defines a narrow
future hook lifecycle and command sandbox posture. It rejects hooks that mutate
GitHub, push, deploy, mutate production data, start daemons, or require
interactive input without later approval.

`tools/symphony/lib/orchestratorHookPolicy.mjs` implements the first pure hook
policy validator. It validates hook command arrays, cwd strings, timeout and
output bounds, env allow/deny rules, secret forwarding, interactive flags, and
denied command classes. That validator governs hook command policy only; it is
not a general MCP/plugin/connector authorization layer.

No current Symphony runtime path discovers a Codex tool catalog, snapshots tool
availability, authorizes tool calls, logs tool decisions, or exposes a tool
policy status surface.

## 4. Capability Catalog Source of Truth

The future capability catalog should be synced from the Codex-approved tool,
MCP, plugin, and connector inventory available to the agent environment.

Target behavior:

- New Codex-approved tools become Symphony-visible only through the synced
  catalog, not hardcoded in Symphony runtime code.
- Disconnected, revoked, expired, or unavailable tools disappear from the
  current available catalog or appear with an unavailable status.
- Symphony stores a per-run capability snapshot so each run records what tools
  existed at claim/dispatch time.
- A run should not silently gain new tool authority mid-run simply because Sami
  connected a new tool in Codex.
- A future reconciliation tick may notice catalog drift and record it, but the
  accepted per-run snapshot remains the authority for that run unless a later
  ADR defines live-safe reload semantics.

The catalog sync mechanism is deliberately undefined in this ADR. A later
implementation may read from Codex-provided metadata, an app-server tool list,
local connector metadata, or another approved source. It must not create a
parallel hand-maintained registry that drifts from Codex.

## 5. Availability Is Not Authority

A future tool policy decision must distinguish at least:

- catalog presence
- connection/auth status
- credential-bearing status
- read vs write/mutation behavior
- production vs local/sandbox target
- issue approved write set
- workflow policy snapshot
- run phase
- operator approval state
- environment capabilities
- dry-run vs execute mode

Example outcomes:

| Tool state | Symphony decision |
|---|---|
| Tool absent from synced catalog | Block with `tool_unavailable`. |
| Tool present but disconnected/revoked/expired | Block with `tool_unavailable` or `tool_auth_unavailable`. |
| Tool present and read-only, issue permits inspection | Allow if policy category permits it. |
| Tool present but credential-bearing and no explicit approval exists | Block with `tool_approval_required`. |
| Tool present but would mutate GitHub, DB, production content, or forms | Block unless the issue and run policy explicitly approve that category. |
| Tool present but not available to the runtime environment | Block and record `tool_runtime_unavailable`. |

Availability errors are not evidence that GitHub, Supabase, browser, or another
system is globally unavailable. They are evidence that the current Symphony run
cannot use that capability safely.

## 6. Capability Snapshot Model

Future runs should capture a capability snapshot before dispatch and persist it
with the run's accepted policy evidence.

Target snapshot shape:

```json
{
  "schema_version": 1,
  "generated_at": "2026-05-03T00:00:00.000Z",
  "source": "codex_tool_catalog",
  "source_version": null,
  "catalog_hash": "sha256:<hash>",
  "sync_status": "ok",
  "capabilities": [
    {
      "id": "github-plugin",
      "name": "GitHub",
      "kind": "plugin",
      "provider": "github",
      "connected": true,
      "available": true,
      "credential_bearing": true,
      "categories": ["github_read", "github_mutation"],
      "default_authority": "blocked_for_mutation",
      "scopes_summary": "repo metadata, PRs, issues",
      "unknown_fields": {}
    }
  ],
  "unavailable": [
    {
      "id": "supabase-cli",
      "name": "Supabase CLI",
      "kind": "shell",
      "available": false,
      "reason": "shell_network_unavailable"
    }
  ],
  "unknown_fields": {}
}
```

Snapshot requirements:

- deterministic hash over canonicalized catalog entries
- stable IDs where available
- unknown future fields preserved or hashed deterministically
- no plaintext secrets
- connection/scopes summarized without leaking credentials
- unavailable tools included when the sync source reports them
- fail closed if the snapshot is malformed or cannot be generated

The snapshot should be recorded in manifests and surfaced in runtime status.

## 7. Tool Policy Categories

The first policy helper should classify tool requests into coarse categories
before making a decision.

| Category | Examples | Default posture |
|---|---|---|
| `repo_file_read` | Read local repo files, inspect diffs, parse docs. | Allowed for investigation and tests. |
| `repo_file_write` | Edit files inside approved write set. | Allowed only when issue write set and run scope permit it. |
| `github_read` | PR metadata, PR diffs, issue metadata, check status through GitHub plugin. | Allowed for coordination/status unless the issue scope forbids it. |
| `github_mutation` | Labels, comments, PR create/update/merge, issue state changes. | Explicit approval required. |
| `browser_preview_verification` | Localhost preview inspection, screenshots, non-mutating QA. | Allowed when local target is approved and non-mutating. |
| `browser_production_mutation` | Submit forms, publish content, production admin actions. | Explicit approval required. |
| `supabase_read` | Schema inspection, read-only queries, migration list. | Allowed only when environment and policy permit; redact output as needed. |
| `supabase_write` | Migration apply, inserts/updates/deletes, RLS changes, DB push. | Explicit approval required. |
| `axiom_read` | Logs and query reads. | Allowed for investigation if credentials are available and output is redacted. |
| `shell_safe` | Bounded local inspection commands and tests. | Allowed inside approved sandbox profile. |
| `shell_high_risk` | Network writes, process control, destructive filesystem, deploys. | Explicit approval required or denied. |
| `credential_connector_read` | Credential-bearing MCP/plugin/connector reads. | Policy approval required; allow only with redaction. |
| `credential_connector_write` | Credential-bearing MCP/plugin/connector writes. | Explicit approval required. |

The categories are intentionally coarse. They are decision inputs, not a full
security model.

## 8. High-Risk Approval Gates

The following categories require explicit approval before any future Symphony
run may allow them:

- database writes or migration apply
- GitHub issue, label, comment, PR, or review mutation
- event publishing or production content mutation
- shell execution outside the safe sandbox profile
- browser actions that submit forms or mutate production
- credential-bearing connector write actions
- connector reads whose output may expose private user, customer, member,
  token, payment, or production operational data
- deployment, environment variable, or infrastructure mutations

Approval must be specific enough to identify:

- issue number or run scope
- capability category
- tool or connector identity when known
- allowed operation class
- allowed target environment
- write set or resource boundary
- whether outputs may be stored in manifests/logs
- redaction and retention posture

Generic tool availability, connector installation, or Codex plugin approval is
not enough to satisfy these high-risk gates.

## 9. Tool Decision Flow

Future policy helper target:

1. Validate the run's accepted capability snapshot.
2. Validate the requested tool identity and category.
3. Confirm the tool is available in the accepted snapshot.
4. Confirm the current environment can use the tool.
5. Evaluate the issue write set, workflow policy, run phase, and operator
   approval evidence.
6. Return a pure decision:

```json
{
  "ok": true,
  "decision": "allow",
  "tool_id": "github-plugin",
  "category": "github_read",
  "reason": "read_only_github_metadata_allowed",
  "evidence": {
    "catalog_hash": "sha256:<hash>",
    "approval_id": null
  }
}
```

Blocked example:

```json
{
  "ok": false,
  "decision": "block",
  "tool_id": "github-plugin",
  "category": "github_mutation",
  "reason": "tool_approval_required",
  "errors": [
    {
      "path": "approval.github_mutation",
      "reason": "missing_explicit_approval",
      "message": "GitHub mutation requires explicit approval for this run"
    }
  ]
}
```

The helper should be pure: no GitHub, no shell, no network, no MCP calls, no
filesystem writes, and no Codex/app-server invocation.

## 10. Tool Use Evidence

Future manifests/status snapshots should record tool decisions and attempts.

Manifest fields:

- `capability_snapshot.schema_version`
- `capability_snapshot.catalog_hash`
- `capability_snapshot.generated_at`
- `capability_snapshot.sync_status`
- `tool_policy.version`
- `tool_policy.decisions[]`
- `tool_policy.decisions[].tool_id`
- `tool_policy.decisions[].tool_name`
- `tool_policy.decisions[].category`
- `tool_policy.decisions[].requested_at`
- `tool_policy.decisions[].decision`
- `tool_policy.decisions[].allowed`
- `tool_policy.decisions[].reason`
- `tool_policy.decisions[].approval_id`
- `tool_policy.decisions[].phase`
- `tool_policy.decisions[].result_summary`
- `tool_policy.decisions[].error`
- `tool_policy.decisions[].timed_out`

Status snapshot fields:

- latest capability catalog hash
- catalog sync status
- unavailable tools count
- blocked tool attempts count
- latest blocked tool reason
- high-risk categories currently enabled, if any
- credential-bearing tool use count
- last tool attempt summary

Evidence must be redacted. Manifests and status snapshots must not store
plaintext tokens, database URLs, bearer tokens, cookie values, browser session
secrets, or full private connector payloads.

## 11. Failure Semantics

| Failure mode | Future behavior |
|---|---|
| Capability catalog missing | Fail closed before claim or tool use. |
| Capability snapshot malformed | Fail closed with `capability_snapshot_invalid`. |
| Tool not in accepted snapshot | Block with `tool_not_in_accepted_snapshot`. |
| Tool disconnected/revoked/expired | Block with `tool_unavailable`. |
| Tool present in current catalog but absent from accepted snapshot | Block for the current run; record catalog drift. |
| High-risk category lacks approval | Block with `tool_approval_required`. |
| Tool policy malformed | Fail closed with `tool_policy_invalid`. |
| Tool call times out | Stop that tool attempt; classify via reducer policy when wired. |
| Tool result cannot be summarized safely | Block or redact; never persist raw sensitive output. |
| Connector returns auth/permission error | Record `tool_auth_unavailable`; do not retry blindly. |

Missing or unavailable tools should not be silently downgraded to shell
fallbacks. Any fallback must itself be a cataloged and authorized capability.

## 12. Interaction With Workspace Hooks

Workspace hooks are one way tool-like behavior may enter Symphony, but hook
policy and tool capability policy are separate layers.

The hook policy validator from PR #245 controls hook command shape, cwd, env,
timeout, output limit, interactive flags, and denied command classes. It should
remain the validator for hook definitions.

Tool capability policy should add:

- classification of hook commands that imply tool categories
- confirmation that any credential-bearing or mutation-capable command has
  explicit approval
- manifest/status evidence for blocked high-risk hook requests
- a rule that hook commands cannot bypass tool policy by shelling out to `gh`,
  `psql`, `supabase`, `vercel`, browsers, or credential-bearing CLIs

Future real hook execution must pass both validators:

1. hook policy validation, and
2. tool/capability authorization for the command's capability category.

## 13. Interaction With Future Runner, CLI, and App-Server Wiring

This ADR authorizes no runner or CLI changes.

Future runner integration should:

- capture capability snapshot before claim/dispatch
- persist the accepted snapshot with run state
- make pure tool-policy decisions before any tool call
- route allowed tool results through reducer/manifest/status evidence
- block or cancel when tool availability or authorization fails closed
- avoid hardcoded connector names except for normalized category mapping

Future app-server integration may expose dynamic tool calls from the coding
agent. Those calls must be policy-checked before execution. Unsupported or
unauthorized tool requests remain fail-closed, consistent with the existing
app-server adapter scaffold behavior for unsupported tool calls and user input.

Future CLI/status work may display capability state, but must not add an
operational tool-use path until a later implementation gate explicitly approves
it.

## 14. GitHub Plugin vs Shell GitHub Runtime

Codex agents in this repo should use the GitHub plugin as the canonical control
plane for PR metadata, PR creation, issue/PR comments, labels, status, and
repository metadata when the plugin can perform the task.

Symphony runtime code is different. If a future Symphony run itself needs to
call GitHub from inside the repo process, that runtime path needs shell/runtime
GitHub auth and network access. The chat-side GitHub plugin does not
automatically give `tools/symphony` shell commands access to `api.github.com`.

Capability policy must record this distinction:

- `github_plugin` availability means the agent chat can use the connector.
- `github_runtime_api` availability means the Symphony process can call GitHub
  from its runtime environment.
- A GitHub mutation may be blocked because it lacks approval, lacks runtime
  access, or both.

Do not treat one as a substitute for the other without a later integration ADR.

## 15. Future Implementation Slices

Slice A: capability snapshot schema/helper.

- Accept plain catalog entries as input.
- Validate and canonicalize tool IDs, kinds, categories, connection state, and
  credential-bearing flags.
- Produce deterministic hashes.
- Preserve unknown future fields.
- No tool execution.

Slice B: pure tool-policy decision helper.

- Consume an accepted capability snapshot, issue/run policy evidence, and a
  requested tool/category.
- Return allow/block decisions only.
- Include high-risk approval checks.
- Add fail-closed tests for malformed snapshots and missing approvals.

Slice C: dry-run fake tool-call harness.

- Use fake tool requests and fake tool results only.
- Compose with reducer, manifest, status, hook policy, and workflow policy
  helpers.
- Prove blocked tool attempts produce durable-write intents, not mutations.

Slice D: manifest/status plumbing.

- Persist capability snapshots and tool decision summaries in local test
  manifests.
- Add status snapshot summaries.
- No live tools, no connector calls, no shell execution.

Slice E: runner/CLI wiring behind explicit approval.

- Requires a high-risk implementation stop-gate naming exact files and allowed
  tool categories.
- Must remain non-operational until DSC full-spec gates close.
- Must not switch app-server dynamic tools on by default without an adapter
  selection and real-capture policy gate.

## 16. Acceptance Criteria for Future Implementation

Future tool capability implementation PRs must:

- state that Symphony remains prototype-only
- avoid live Symphony execution
- avoid GitHub issue mutation
- avoid real Codex or app-server invocation
- avoid runner/CLI changes unless explicitly scoped
- avoid tool, MCP, plugin, connector, shell, browser, database, or Axiom calls
  in tests unless a later gate explicitly approves that exact action
- use deterministic tests with fake catalogs, fake approvals, fake clocks, and
  fake tool requests
- prove missing tools fail closed
- prove disconnected/revoked/expired tools fail closed
- prove availability is not authority
- prove high-risk categories require explicit approval
- prove unknown future fields are preserved or hashed deterministically
- prove manifests/status outputs redact or avoid secrets
- report exact changed files
- run `npm run symphony:test` if runtime helper code changes
- run `find tools/symphony -name '*.mjs' -print0 | xargs -0 -n1 node --check`
  if any `.mjs` file changes
- run `git diff --check origin/main..HEAD`

## 17. Stop Conditions

Stop and ask before implementation if:

- `runner.mjs`, `cli.mjs`, `config.mjs`, `doctor.mjs`, package files, or
  `WORKFLOW.md` need edits
- real tool execution seems necessary
- live GitHub issue state is needed
- a live Symphony command seems necessary
- a real Codex process or app-server invocation seems necessary
- a real MCP server, plugin, connector, browser, database, Axiom, or shell
  capability seems necessary
- tool policy conflicts with the workspace hook sandbox ADR
- tool policy conflicts with the dynamic workflow reload ADR
- an approval scope cannot be represented as durable evidence
- redaction requirements cannot be implemented deterministically

Operational use remains barred until the full DSC Symphony spec gate closes and
Sami explicitly approves it.

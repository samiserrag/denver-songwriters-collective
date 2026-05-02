# Symphony Phase 2 Spec-Gap Investigation

**Date:** 2026-05-02
**Status:** Investigation document for Codex collaborative review
**Companion to:** `docs/runbooks/symphony.md`, `tools/symphony/README.md`, and the operational notes in the supervised-activation runbook
**Authoritative reference:** the original Symphony Service Specification v1 (https://openai.com/index/open-source-codex-orchestration-symphony/) — referenced as **"the spec"** throughout this document.
**Audience:** Codex (review + critique) + Sami (final approver) + future Symphony builders.

---

## 1. Why this exists

### 1.1 The strategic distinction (locked 2026-05-02)

After Symphony Phase 1.3 closed (PR #145 + #147 + #151 + #154 + #160 + #162; supervised daemon use ready, one ready issue at a time), Sami flagged an important boundary:

> Current repo implementation is **not the full original Symphony spec.** It is a safety-first Phase 1 adaptation using GitHub Issues, local worktrees, `codex exec --json`, explicit labels, manifests, locks, and human review. It is much narrower than the draft v1 service spec.

The current Phase 1 implementation deliberately diverges from the spec along several axes (control-plane choice, single-agent concurrency, supervised mode, codex invocation form). Some of those divergences are durable design choices for safety; others are real implementation gaps that Phase 2 work could close.

This document is the **honest section-by-section gap inventory** — what the spec requires, what we have today, what we deferred, and what we deliberately won't build. It is the durable Phase 2 backlog reference, not a commitment to build everything.

### 1.2 What this doc IS

- A complete map of the spec → current Phase 1 implementation, with disposition per requirement.
- A grouping of missing / partial items into coherent Phase 2 sub-tracks (analogous to Track 2's structure).
- An explicit inventory of "deliberately out of scope" items so future agents don't re-litigate decisions already made.
- A request for Codex's substantive critique on the dispositions, especially items where the gap doc may be wrong about current state or about what's worth building.

### 1.3 What this doc IS NOT

- A commitment to build all missing items. Sami decides per item whether it's Phase 2 work.
- A replacement for `docs/runbooks/symphony.md` (operational) or `tools/symphony/README.md` (developer-facing).
- A substitute for the Track 2 roadmap (PR #157) — Symphony Phase 2 is its own track.
- A complete specification of Phase 2 design. Items marked "Phase 2 candidate" require their own ADRs before implementation begins.

### 1.4 Disposition labels used throughout

| Label | Meaning |
|---|---|
| ✅ **done** | Spec requirement is met by current Phase 1 implementation. |
| 🟡 **partial** | Some of the spec is implemented; specific gaps noted. |
| ❌ **missing** | Spec requirement not implemented; candidate for Phase 2 work. |
| 🚫 **deliberately out of scope** | Spec requirement explicitly NOT planned, with reasoning. |

---

## 2. Current Phase 1 implementation summary

What exists today, for reviewer grounding:

- **Control plane:** GitHub Issues (REST + labels via `tools/symphony/lib/github.mjs` + `issues.mjs`)
- **Codex invocation:** `codex exec --json` adapter (`tools/symphony/lib/codexAdapter.mjs`), NOT app-server JSON-RPC over stdio
- **Lifecycle labels:** `symphony` + `symphony:ready` + `symphony:running` + `symphony:human-review` + `symphony:blocked`
- **Concurrency:** hard-coded `max_concurrent_agents: 1` in `WORKFLOW.md` config
- **Workspaces:** per-issue git worktrees under `.symphony/worktrees/issue-N-<slug>/`
- **Run lock:** single `.symphony/state/runner.lock` (process-level, JSON payload with PID + timestamp)
- **Manifests:** per-run JSON in `.symphony/state/manifests/<timestamp>-<pid>-once-<id>.json`
- **Logs:** per-issue JSONL in `.symphony/logs/issue-<n>.jsonl`
- **Daemon:** supervised mode behind `SYMPHONY_ENABLE_DAEMON=1` + `SYMPHONY_EXECUTION_APPROVED=1`, cooperative SIGINT/SIGTERM shutdown (PR #160)
- **Eligibility / preflight:** `tools/symphony/lib/preflight.mjs` (label gates, approved-write-set parsing, acceptance-criteria parsing, high-risk scope detection per PR #147)
- **Recovery:** `recover-stale --dry-run` + `recover-stale --execute` (latter not yet tested live)
- **Workflow loader:** static load of `WORKFLOW.md` at process start (`tools/symphony/lib/workflow.mjs`); no dynamic reload

CLI surface (`tools/symphony/cli.mjs`):

- `symphony:doctor` — pre-execute health check
- `symphony:test` — internal test suite (52+ tests as of last cycle)
- `once --dry-run` — plan eligible issues, no mutation
- `once --execute` — supervised single-cycle execution
- `recover-stale --dry-run | --execute`
- `daemon` (only when `SYMPHONY_ENABLE_DAEMON=1`)

Trust model: human-in-the-loop at every transition; no auto-merge; supervised execute defaults to halt-at-`human-review`; daemon use one-issue-at-a-time post-#162.

---

## 3. Section-by-section spec gap analysis

### 3.1 — Spec §1 Problem Statement

| Requirement | Disposition | Notes |
|---|---|---|
| Long-running automation reads from issue tracker, creates per-issue workspace, runs coding agent | ✅ done | Phase 1 uses GitHub Issues; supervised daemon + `once --execute` cover the loop |
| Repeatable daemon workflow, not manual scripts | 🟡 partial | Daemon exists post-#160; supervised use only; not yet "long-running" in the spec sense |
| Per-issue workspace isolation | ✅ done | Git worktrees under `.symphony/worktrees/` |
| Workflow policy in-repo (`WORKFLOW.md`) | 🟡 partial — **format divergence** | `WORKFLOW.md` is repo-owned and enforced, but Phase 1 uses `<!-- symphony-config -->` JSON rather than the spec's YAML front matter + prompt body format. Spec-compatible workflow parsing is tracked as a Phase 2 correction or explicit deliberate divergence. |
| Observability for multiple concurrent agent runs | 🟡 partial | Per-issue logs + manifests + workpad comments exist; "multiple concurrent" doesn't apply (max=1) |
| Trust/safety posture documented explicitly | ✅ done | Phase 1.2 README + runbook + Phase 1.3 daemon controls section |
| Symphony as scheduler/runner + tracker reader (NOT writer) | 🟡 partial — **deliberate divergence** | Codex review correction (2026-05-02): `runner.mjs` directly applies label transitions (symphony:running, symphony:human-review, symphony:blocked) AND upserts the workpad comment before/after Codex execution. The orchestrator core is NOT read-only on the tracker in current Phase 1. The worker also makes some tracker mutations during its session (PR opens, labels via `gh` from the worker). This is a trust-boundary divergence from the spec's "scheduler is reader; writes live in the worker tools" intent. Phase 2 candidate: clarify which mutations belong to the scheduler vs the worker; spec leans heavily worker-side. |

**Disposition for §1: largely ✅ done with one Phase 1 specialization (single-agent concurrency).**

---

### 3.2 — Spec §2 Goals and Non-Goals

#### 2.1 Goals

| Spec goal | Disposition | Notes |
|---|---|---|
| Poll tracker on fixed cadence with bounded concurrency | 🟡 partial | Daemon polls every `intervalSeconds` (default 120s); concurrency bounded at 1 |
| Single authoritative orchestrator state | 🟡 partial | Codex review correction (2026-05-02): `runner.lock` provides process-level serialization (one Symphony process at a time), NOT the spec's runtime state model (in-memory `running`/`claimed`/`retry_attempts`/`completed`/`codex_totals`/`codex_rate_limits` map). See §3.5 — the orchestrator state machine is largely missing. Downgrading to partial to match the §7 disposition. |
| Deterministic per-issue workspaces preserved across runs | ✅ done | `tools/symphony/lib/workspace.mjs` |
| **Stop active runs when issue state changes make them ineligible** | ❌ missing | No mid-run reconciliation; if `symphony:ready` is removed mid-execute, current run continues |
| **Recover from transient failures with exponential backoff** | ❌ missing | No retry queue; no backoff. Failure → halt; manual re-trigger required |
| Load runtime behavior from `WORKFLOW.md` | ✅ done | Static load |
| Operator-visible observability (structured logs minimum) | ✅ done | JSONL logs per issue |
| **Restart recovery without persistent DB** | ✅ done (partial) | `recover-stale` covers stuck `symphony:running`; full reconciliation logic doesn't exist (see §3.5) |

#### 2.2 Non-Goals

| Spec non-goal | Status |
|---|---|
| Rich web UI / multi-tenant control plane | ✅ matches (none built) |
| Prescribing dashboard/terminal UI | ✅ matches (none) |
| General-purpose workflow engine | ✅ matches |
| Built-in business logic for ticket/PR editing | ✅ matches (lives in worker prompt) |
| Mandating strong sandbox controls | ✅ matches (defers to Codex's own posture) |
| Single approval/sandbox/operator-confirmation default | ✅ matches |

**Disposition for §2: ✅ partial done; the 2 missing items (mid-run reconciliation, exponential backoff retry) are real Phase 2 candidates.**

---

### 3.3 — Spec §3 System Overview

#### 3.1 Main Components

| Spec component | Phase 1 file | Disposition |
|---|---|---|
| 1. Workflow Loader | `tools/symphony/lib/workflow.mjs` | 🟡 partial — **format divergence** | Codex review correction (2026-05-02): spec requires YAML front matter + Markdown prompt body returning `{config, prompt_template}`. Current implementation parses an HTML-comment-wrapped JSON config block (`<!-- symphony-config { ... } -->`) and returns `{markdown, config}` — different parser, different return shape, no separate `prompt_template`. Also no dynamic reload (see §3.6). Phase 2 candidates: (a) "spec-compatible workflow front matter / prompt body parsing" sub-track or (b) document this as a deliberate divergence with rationale. |
| 2. Config Layer | `tools/symphony/lib/config.mjs` | ✅ done with simplifications (see §3.7) |
| 3. Issue Tracker Client | `tools/symphony/lib/github.mjs` + `issues.mjs` | 🟡 partial — different tracker (GitHub vs Linear), normalized to similar issue model |
| 4. Orchestrator | `tools/symphony/lib/runner.mjs` | 🟡 partial — single-cycle + daemon present; in-memory orchestrator state model is simpler than spec §4.1.8 |
| 5. Workspace Manager | `tools/symphony/lib/workspace.mjs` | 🟡 partial — directory creation + reuse + cleanup; **hook lifecycle missing** (see §3.10) |
| 6. Agent Runner | `tools/symphony/lib/codexAdapter.mjs` | 🟡 partial — uses `codex exec --json`, NOT app-server JSON-RPC; missing streaming events, token telemetry, approval handling (see §3.11) |
| 7. Status Surface (optional) | none | ❌ missing — runbook doc exists, no CLI/HTTP surface for runtime status |
| 8. Logging | per-issue JSONL + manifest JSON | ✅ done |

#### 3.2 Abstraction Levels

| Spec layer | Phase 1 implementation | Disposition |
|---|---|---|
| Policy Layer (`WORKFLOW.md`) | `WORKFLOW.md` at repo root | ✅ done |
| Configuration Layer (typed getters) | `tools/symphony/lib/config.mjs` | ✅ done |
| Coordination Layer | `tools/symphony/lib/runner.mjs` | 🟡 partial |
| Execution Layer | `tools/symphony/lib/codexAdapter.mjs` + `workspace.mjs` | 🟡 partial (no app-server protocol; basic workspace) |
| Integration Layer (Linear adapter) | GitHub adapter | 🚫 deliberately out of scope (we use GitHub) |
| Observability Layer | logs + manifests | ✅ done; no runtime status snapshot interface |

#### 3.3 External Dependencies

| Spec dependency | Phase 1 |
|---|---|
| Issue tracker API | GitHub REST via `fetch` against `https://api.github.com` (codex review correction 2026-05-02; only token resolution shells out to `gh auth token`, the API calls themselves are direct fetch) |
| Local filesystem | yes |
| Workspace population (e.g., Git CLI) | yes — `git worktree` |
| **Coding-agent executable supporting JSON-RPC app-server mode** | ❌ uses `codex exec --json` instead |
| Host environment authentication | `gh auth` for GitHub; Codex CLI auth for Codex |

**Disposition for §3: most layers ✅ done in spirit; agent runner protocol (JSON-RPC vs `exec --json`) is the largest single architectural delta.**

---

### 3.4 — Spec §4 Core Domain Model

#### 4.1 Entities

| Spec entity | Phase 1 representation | Disposition |
|---|---|---|
| 4.1.1 Issue | `tools/symphony/lib/issues.mjs` `normalizeIssue()` | 🟡 partial — has `id`, `identifier` (number), `title`, `description`, `state`, `labels`, `url`; missing `priority`, `branch_name`, `blocked_by`, `created_at`, `updated_at` in normalized form |
| 4.1.2 Workflow Definition | `loadWorkflow()` returns `{markdown, config}` (NOT `{config, prompt_template}` per spec) | 🟡 partial — format divergence (see §3.3 row above) |
| 4.1.3 Service Config (typed view) | `resolveConfig()` | ✅ done |
| 4.1.4 Workspace | path + `created_now` | 🟡 partial — `created_now` not used to gate hooks (because no hooks) |
| 4.1.5 Run Attempt | manifest fields | 🟡 partial — manifest captures shape; `attempt` integer for retries doesn't exist (no retry queue) |
| 4.1.6 Live Session metadata (token counts, codex_app_server_pid, last_codex_event, etc.) | ❌ missing | We don't track session metadata at this granularity |
| 4.1.7 Retry Entry | ❌ missing | No retry queue |
| 4.1.8 Orchestrator Runtime State (in-memory map of `running`, `claimed`, `retry_attempts`, `completed`, `codex_totals`, `codex_rate_limits`) | 🟡 partial — `running` exists implicitly via labels + lock; the rest are missing |

#### 4.2 Stable Identifiers and Normalization Rules

| Spec rule | Phase 1 |
|---|---|
| `Issue ID` for tracker lookups | ✅ GitHub issue number |
| `Issue Identifier` for human-readable | ✅ same (GitHub issue numbers ARE human-readable) |
| **`Workspace Key` sanitization to `[A-Za-z0-9._-]`** | ✅ done — `workspace.mjs` uses sanitized slug |
| `Normalized Issue State` (lowercase) | 🟡 partial — we use labels not states; comparison is exact match |
| `Session ID = <thread_id>-<turn_id>` | ❌ missing — no thread/turn concept in `codex exec --json` |

**Disposition for §4: largely 🟡 partial. Most missing items are coupled to the JSON-RPC app-server protocol gap (§3.11 below).**

---

### 3.5 — Spec §7 Orchestration State Machine

This is one of the largest gaps.

#### 7.1 Issue Orchestration States

Spec uses internal `Unclaimed | Claimed | Running | RetryQueued | Released` states distinct from tracker states.

| Spec state | Phase 1 equivalent |
|---|---|
| `Unclaimed` | Issue has `symphony:ready`, no other Symphony labels, not in `runner.lock` |
| `Claimed` | implicit — between preflight pass and label transition |
| `Running` | `symphony:running` label + active `runner.lock` |
| `RetryQueued` | ❌ missing — no retry queue exists |
| `Released` | terminal — `symphony:human-review` or `symphony:blocked` |

The spec explicitly distinguishes the worker continuing through multiple back-to-back coding-agent turns on the same `thread_id` until `agent.max_turns` (default 20). Our `codex exec --json` is single-shot per `once --execute` cycle; no turn loop.

| Item | Disposition |
|---|---|
| `claimed` set in memory to prevent duplicate dispatch | 🟡 partial — runner.lock prevents at process level, no in-memory `claimed` set |
| Continuation turns on same thread | ❌ missing — no thread continuation |
| `agent.max_turns` config | ❌ missing |
| Worker re-checks tracker state after each turn | ❌ missing |

#### 7.2 Run Attempt Lifecycle

Spec defines 11 phases: `PreparingWorkspace → BuildingPrompt → LaunchingAgentProcess → InitializingSession → StreamingTurn → Finishing → Succeeded | Failed | TimedOut | Stalled | CanceledByReconciliation`.

Phase 1: implicit phases via manifest events; no formal state machine; only `Succeeded`/`Failed` distinction in outcome.

| Item | Disposition |
|---|---|
| Formal run lifecycle states | ❌ missing |
| Distinct terminal reasons (TimedOut, Stalled, CanceledByReconciliation) | ❌ missing — currently all failures collapse to `ok: false` |

#### 7.3 Transition Triggers

| Spec trigger | Phase 1 |
|---|---|
| Poll Tick → reconcile + validate + dispatch | 🟡 partial — daemon poll exists; no reconcile; preflight runs each cycle |
| Worker Exit (normal) → schedule continuation retry (~1s) | ❌ missing |
| Worker Exit (abnormal) → exponential backoff retry | ❌ missing |
| Codex Update Event → update token counters, rate limits | ❌ missing |
| Retry Timer Fired | ❌ missing |
| Reconciliation State Refresh → stop runs whose issues are no longer eligible | ❌ missing |
| Stall Timeout → kill worker, schedule retry | ❌ missing |

#### 7.4 Idempotency and Recovery Rules

| Spec rule | Phase 1 |
|---|---|
| Single authority serializes mutations | ✅ runner.lock provides process-level serialization |
| `claimed` and `running` checks before launching worker | 🟡 partial — label check + lock check |
| Reconciliation runs before dispatch on every tick | ❌ missing — preflight runs but only checks issue eligibility, not running runs |
| Restart recovery is tracker-driven + filesystem-driven | ✅ done (per `recover-stale`) |
| Startup terminal cleanup removes stale terminal workspaces | 🟡 partial — `recover-stale` exists; not run automatically at startup |

**Disposition for §7: this is the section with the largest spec gap. The orchestrator state machine, retry queue, mid-run reconciliation, and exponential backoff are the meat of "production-grade orchestration" that Phase 1 explicitly didn't build.**

---

### 3.6 — Spec §6.2 Dynamic Reload Semantics

Spec requires:
- Watch `WORKFLOW.md` for changes
- Re-read and re-apply config + prompt without restart
- Adjust live behavior (poll cadence, concurrency limits, active/terminal states, codex settings, workspace paths/hooks, prompt content for future runs)
- Apply to future dispatch / retry / reconciliation / hook execution / agent launches
- Not required to restart in-flight sessions automatically

| Item | Phase 1 |
|---|---|
| File watch on `WORKFLOW.md` | ❌ missing |
| Re-read on change | ❌ missing |
| Live config re-application | ❌ missing |

**Disposition for §6.2: ❌ missing. Phase 1 requires daemon restart for any `WORKFLOW.md` change.**

---

### 3.7 — Spec §6.3 Dispatch Preflight Validation

Spec requires startup validation + per-tick re-validation; if validation fails, skip dispatch but keep reconciliation active.

| Spec check | Phase 1 |
|---|---|
| Workflow file loads + parses | ✅ done (in `doctor` and at start of `once --execute` / daemon) |
| `tracker.kind` present + supported | 🟡 partial — implicitly GitHub; not validated as a config key |
| `tracker.api_key` present after `$` resolution | 🟡 partial — `gh auth status` checks token presence |
| `tracker.project_slug` present | ❌ missing — we use GitHub repo (full owner/repo) not project slugs |
| `codex.command` present | ✅ done — checked in `doctor` |
| Per-tick re-validation | ❌ missing — daemon doesn't re-validate before each cycle |

**Disposition for §6.3: 🟡 partial. Startup `doctor` covers most; per-tick re-validation is a Phase 2 candidate.**

---

### 3.8 — Spec §8.4 Retry and Backoff

Spec requires:
- Continuation retry: short fixed `1000 ms` delay after clean worker exit
- Failure retry: `delay = min(10000 * 2^(attempt - 1), agent.max_retry_backoff_ms)` with default cap `300000 ms`
- Cancel existing retry timer on issue state change

| Item | Phase 1 |
|---|---|
| Retry queue with timers | ❌ missing |
| Exponential backoff on failure | ❌ missing |
| Continuation retry | ❌ missing |
| Cancel-on-state-change | ❌ missing |

**Disposition for §8.4: ❌ missing entirely. Phase 1 has no retry mechanism; failures halt + require manual re-trigger.**

---

### 3.9 — Spec §8.5 Active Run Reconciliation

Spec requires:
- Per-tick stall detection comparing `last_codex_timestamp` against `codex.stall_timeout_ms` (default 300000 ms / 5 min)
- Per-tick tracker state refresh — if state goes terminal, terminate worker + clean workspace; if still active, update snapshot; if neither, terminate without cleanup

| Item | Phase 1 |
|---|---|
| Stall detection | ❌ missing — no `last_codex_timestamp` tracked |
| Tracker state refresh during run | ❌ missing |
| Terminate worker on terminal state mid-run | ❌ missing |

**Disposition for §8.5: ❌ missing. This is part of the larger orchestrator-state gap (§3.5 above).**

---

### 3.10 — Spec §9.4 Workspace Hooks

Spec requires four lifecycle hooks: `after_create`, `before_run`, `after_run`, `before_remove`, with `hooks.timeout_ms` (default 60000 ms).

| Spec hook | Phase 1 |
|---|---|
| `after_create` | ❌ missing |
| `before_run` | ❌ missing |
| `after_run` | ❌ missing |
| `before_remove` | ❌ missing |
| Failure semantics (after_create + before_run fatal; after_run + before_remove logged-and-ignored) | ❌ missing |

**Disposition for §9.4: ❌ missing. Phase 1 workspace lifecycle is just `git worktree add` + `git worktree remove` with no extension points.**

---

### 3.11 — Spec §10 Agent Runner Protocol (Codex JSON-RPC App-Server)

This is the **single largest architectural delta** between spec and Phase 1.

The spec defines:
- `codex app-server` invoked via `bash -lc <codex.command>` with JSON-RPC-like JSON-per-line over stdio
- `initialize` → `initialized` → `thread/start` → `turn/start` handshake (§10.2)
- Streaming turn processing with completion conditions (`turn/completed`, `turn/failed`, `turn/cancelled`, turn timeout, subprocess exit) (§10.3)
- Live session metadata: `session_id = <thread_id>-<turn_id>`, token counts, rate limits, last event timestamp (§10.4)
- Approval/sandbox/user-input policy with explicit handling of `item/tool/requestUserInput` and unsupported tool calls (§10.5)
- Optional `linear_graphql` client-side tool extension (§10.5)
- Timeouts: `codex.read_timeout_ms` (5000), `codex.turn_timeout_ms` (3600000), `codex.stall_timeout_ms` (300000) (§10.6)
- Normalized error categories: `codex_not_found`, `invalid_workspace_cwd`, `response_timeout`, `turn_timeout`, `port_exit`, `response_error`, `turn_failed`, `turn_cancelled`, `turn_input_required` (§10.6)

Phase 1 uses `codex exec --json` (`tools/symphony/lib/codexAdapter.mjs`) — a one-shot exec command, not a long-running app-server with streaming events.

| Item | Disposition |
|---|---|
| App-server JSON-RPC protocol | ❌ missing — uses `codex exec --json` |
| `initialize` / `thread/start` / `turn/start` handshake | ❌ missing |
| Streaming turn events | ❌ missing |
| Multi-turn continuation on same thread | ❌ missing |
| Token accounting from streaming events | ❌ missing |
| Rate limit tracking from streaming events | ❌ missing |
| Approval handling (auto-approve / surface / fail) | 🟡 partial — `codex exec` runs with whatever default approval mode the CLI provides |
| `item/tool/requestUserInput` detection | ❌ missing |
| Unsupported dynamic tool call handling | ❌ missing |
| `linear_graphql` extension | 🚫 deliberately out of scope (we use GitHub, not Linear) |
| Timeout categories (read/turn/stall) | ❌ missing — only the codex CLI's own timeout |
| Normalized error categories | ❌ missing — current errors are ad-hoc |

**Disposition for §10: ❌ missing. This is the largest single Phase 2 candidate. Migration from `codex exec --json` to `codex app-server` would unlock multi-turn, token accounting, rate limiting, approval handling, and stall detection — but is a substantial refactor of `codexAdapter.mjs` + `runner.mjs`.**

---

### 3.12 — Spec §11 Issue Tracker Integration Contract

Spec is Linear-specific (GraphQL endpoint, project slug, blocked_by relations).

| Required operation | Phase 1 (GitHub) |
|---|---|
| `fetch_candidate_issues()` | ✅ done — direct `fetch` to GitHub REST `/repos/{owner}/{repo}/issues?labels=symphony:ready` (NOT `gh issue list` shell-out per Codex review correction 2026-05-02) |
| `fetch_issues_by_states(state_names)` for startup terminal cleanup | 🟡 partial — `recover-stale` covers stuck running; not full terminal-state list |
| `fetch_issue_states_by_ids(issue_ids)` for reconciliation | ❌ missing — no per-tick reconciliation |
| Pagination (default page size 50) | 🟡 partial — `gh issue list` paginates; we don't track cursor explicitly |
| Network timeout (30000 ms) | 🟡 implicit — `gh` CLI default |

#### 11.5 Tracker Writes (Important Boundary)

Spec explicitly says Symphony does NOT require first-class tracker write APIs. Ticket mutations (state, comments, PR metadata) are typically handled by the worker's tools.

| Item | Phase 1 |
|---|---|
| Tracker writes boundary | 🟡 partial — **deliberate divergence**. Phase 1 supports tracker writes, but they are scheduler-owned: `runner.mjs` applies label transitions and upserts workpad comments. This differs from the spec's preferred boundary where ticket mutations typically live in the worker/tooling layer. |

**Disposition for §11: 🟡 partial. The Linear-specific surface area is 🚫 deliberately out of scope. The GitHub adapter covers the conceptually-equivalent operations except per-tick reconciliation (which depends on §3.5 orchestrator state machine).**

---

### 3.13 — Spec §13 Logging, Status, and Observability

#### 13.1 Logging Conventions

| Spec requirement | Phase 1 |
|---|---|
| Issue-related logs include `issue_id`, `issue_identifier` | ✅ done — JSONL logs include issue number |
| Session lifecycle logs include `session_id` | ❌ missing — no `session_id` concept |
| Stable `key=value` phrasing | 🟡 partial — JSONL format is structured but not key=value text |
| Action outcome (`completed`, `failed`, etc.) | ✅ done in manifest |

#### 13.3 Runtime Snapshot / Monitoring Interface

Spec recommends synchronous snapshot returning: `running` list (with `turn_count`), `retrying` list, `codex_totals` (input/output/total/seconds_running), `rate_limits`.

| Item | Phase 1 |
|---|---|
| Runtime snapshot interface | ❌ missing |
| HTTP server for snapshot (optional `server.port` extension) | ❌ missing |
| Token totals tracking | ❌ missing |
| Rate limit tracking | ❌ missing |

#### 13.5 Session Metrics and Token Accounting

Spec requires lenient extraction from various Codex event payload shapes (`thread/tokenUsage/updated`, `total_token_usage`, etc.) with delta tracking against last reported.

| Item | Phase 1 |
|---|---|
| Token accounting | ❌ missing |
| Delta tracking | ❌ missing |
| Aggregate `codex_totals` | ❌ missing |

**Disposition for §13: 🟡 partial. Logging exists (JSONL per issue + manifest JSON); runtime snapshot, HTTP server, token accounting, rate-limit tracking all ❌ missing.**

---

### 3.14 — Spec §5.3.4 Hooks (timeout_ms config)

(Already covered in §3.10 above as part of the workspace hooks gap.)

---

### 3.15 — Spec §5.3.5 Agent config (max_concurrent_agents, max_concurrent_agents_by_state)

| Spec field | Phase 1 |
|---|---|
| `agent.max_concurrent_agents` (default 10) | 🟡 hard-coded `1` in `WORKFLOW.md` (Phase 1 deliberate) |
| `agent.max_retry_backoff_ms` (default 300000) | ❌ missing — no retry queue |
| `agent.max_concurrent_agents_by_state` (per-state caps) | ❌ missing |
| `agent.max_turns` (default 20) | ❌ missing — single-turn only |

**Disposition for §5.3.5: 🟡 partial. Single-agent concurrency is a deliberate Phase 1 choice; per-state caps and max_turns are ❌ missing.**

---

### 3.16 — Spec §12 Prompt Construction and Context Assembly

Spec requires strict template engine (Liquid-compatible), strict variable + filter checking, `attempt` integer for retry/continuation differentiation.

| Item | Phase 1 |
|---|---|
| Strict template engine | 🟡 partial — `tools/symphony/lib/codexAdapter.mjs` builds prompt by string concatenation, not templating |
| Strict variable checking | 🚫 not applicable (no template engine) |
| `attempt` integer passed to template | ❌ missing |
| Continuation guidance (vs full task prompt on retry) | ❌ missing |

**Disposition for §12: 🟡 partial. Phase 1 builds prompts via direct string assembly; spec assumes Liquid-style templating with strict semantics. Migration would be a Phase 2 candidate alongside multi-turn support.**

---

## 4. Aggregate disposition summary

| Disposition | Spec sections / requirements |
|---|---|
| ✅ done | §1 (mostly), §3.1 (most components), §6.3 startup validation (mostly), §9.1 workspace layout, §9.2 workspace creation, §9.5 safety invariants, §13.1 logging conventions (mostly) |
| 🟡 partial | §1 daemon, §3.1 Workflow Loader / Issue Tracker / Orchestrator / Workspace Manager / Agent Runner, §4.1 Issue normalization, §6.3 per-tick re-validation, §11 tracker integration (GitHub-shaped), §11.5 tracker writes boundary, §12 prompt construction, §13 observability, §5.3.5 concurrency (hard-coded to 1) |
| ❌ missing | §2.1 stop-on-eligibility-change, §2.1 exponential backoff, §3.1 Status Surface, §4.1.6 Live Session metadata, §4.1.7 Retry Entry, §6.2 Dynamic Reload, §7 Orchestration State Machine (most), §7.1 multi-turn / claimed set, §8.4 retry queue, §8.5 reconciliation, §9.4 hooks, §10 app-server JSON-RPC protocol (entirely), §13.3 runtime snapshot, §13.5 token accounting, §5.3.5 max_turns / per-state caps, §12 strict templating |
| 🚫 deliberately out of scope | §3.2 Linear adapter, §10.5 `linear_graphql` extension |

**Headline:** of 13 spec sections, 1-2 are largely ✅ done, 5-6 are 🟡 partial, 5-6 are ❌ missing entirely, and 2 sub-items are 🚫 deliberately out of scope.

The single largest cluster of missing work is the **Codex app-server JSON-RPC protocol** (§10) — it ripples into multi-turn (§7.1), token accounting (§13.5), stall detection (§7.3 + §8.5), session metadata (§4.1.6), and approval handling (§10.5).

The next largest cluster is the **orchestrator state machine** (§7) — internal claim states, retry queue, exponential backoff, mid-run reconciliation.

---

## 5. Phase 2 sub-track proposals

Grouping missing/partial items into coherent sub-tracks. Each is a Phase 2 candidate; none is committed to until Sami approves per item.

### Phase 2.A — Codex App-Server Migration

**Why this is the highest-leverage:** unlocks multi-turn continuation (§7.1), token accounting (§13.5), rate limit tracking (§13.5), stall detection (§7.3, §8.5), approval handling (§10.5), session metadata (§4.1.6). Single architectural change with cascading benefits.

**Sub-PRs (proposed):**
1. App-server adapter ADR (investigation: protocol fit, error mapping, timeout policy, app-server CLI version pinning)
2. New `codexAppServerAdapter.mjs` alongside existing `codexAdapter.mjs` (parallel implementation, not replacement, until proven)
3. Streaming event handler with structured events
4. Session metadata tracking (`session_id`, `thread_id`, `turn_id`)
5. Token accounting in `runner.mjs`
6. Rate limit tracking
7. Multi-turn continuation loop
8. Stall detection
9. Migration: switch default adapter from `codex exec` to `codex app-server` behind feature flag
10. Eval harness extension for new error categories

**Estimate:** 8-12 PRs.

### Phase 2.B — Orchestrator State Machine

**Why this matters:** turns Symphony from "supervised single-issue runner" into "production scheduler." Required for Phase 2 daemon scale.

**Sub-PRs:**
1. State machine ADR (5 internal states: Unclaimed/Claimed/Running/RetryQueued/Released; 11 run-attempt phases)
2. In-memory orchestrator state model (`running`, `claimed`, `retry_attempts`, `completed`, `codex_totals`, `codex_rate_limits`)
3. Retry queue + exponential backoff (per §8.4)
4. Per-tick reconciliation (per §8.5: stall detection + tracker state refresh)
5. Mid-run cancel on issue ineligibility
6. Continuation retry after clean exit
7. Restart recovery (in-memory + filesystem reconstitution)

**Estimate:** 6-9 PRs. Requires Phase 2.A to be useful (token totals, stall detection depend on app-server protocol).

### Phase 2.C — Workspace Hook Lifecycle

**Why this matters:** lets `WORKFLOW.md` define workspace bootstrap (e.g., dependency install) and cleanup behaviors per repo without changing Symphony code.

**Sub-PRs:**
1. Hook execution model ADR (timeout, failure semantics, env vars passed)
2. `after_create` + `before_run` (fatal failures)
3. `after_run` + `before_remove` (logged-and-ignored failures)
4. `hooks.timeout_ms` config
5. Tests for hook timeout, failure escalation, env propagation

**Estimate:** 3-5 PRs. Independent of 2.A and 2.B.

### Phase 2.D — Dynamic WORKFLOW.md Reload

**Why this matters:** Operational quality-of-life. Today every config change requires daemon restart.

**Sub-PRs:**
1. File watch + reload ADR (debouncing, validation-on-reload, fallback to last-known-good on parse error)
2. Watcher implementation
3. Live re-application of poll cadence, concurrency limits, codex settings
4. Tests for reload semantics

**Estimate:** 3 PRs. Independent.

### Phase 2.E — Runtime Status Snapshot + Optional HTTP Server

**Why this matters:** Operator observability. Phase 1 has logs but no synchronous "what is the daemon doing right now" surface.

**Sub-PRs:**
1. Snapshot interface ADR (return shape per §13.3, error modes timeout/unavailable)
2. Snapshot implementation reading from orchestrator state
3. Optional `server.port` extension — minimal HTTP server returning snapshot JSON
4. Auth posture for the HTTP endpoint (default: localhost-only; documented if exposed broader)

**Estimate:** 3-4 PRs. Depends on 2.B for snapshot data shape.

### Phase 2.F — Strict Prompt Templating + Continuation Semantics

**Why this matters:** Spec §12 requires strict template engine (Liquid-compatible) with `attempt` integer for retry/continuation differentiation. Phase 1 builds prompts via string concatenation.

**Sub-PRs:**
1. Template engine choice ADR (LiquidJS / Nunjucks / write-our-own; trade-offs)
2. Migration of prompt assembly from string concatenation to template
3. `attempt` variable wired into template inputs
4. Continuation-vs-first-turn prompt differentiation
5. Tests for strict variable/filter checking

**Estimate:** 4-5 PRs.

### Phase 2.G — Live recover-stale --execute Test + Recovery Hardening

**Why this matters:** Daemon-readiness checklist item 3 still partial (live recover-stale untested). Closing this gap is a precondition for fuller daemon trust.

**Sub-PRs:**
1. Test plan ADR for safely producing a stuck `symphony:running` issue
2. Live test execution + evidence capture
3. Any hardening surfaced by the test
4. Documentation update in runbook

**Estimate:** 2-3 PRs.

### Phase 2.H — ✅ Outer Codex Execution Timeout (from daemon-readiness audit item 8)

**Why this matters:** Single hung Codex process can block the daemon indefinitely.

**Sub-PRs:**
1. Timeout decision ADR (cap value, what happens on timeout — symphony:blocked + manifest reason)
2. Implementation
3. Tests

**Estimate:** 2 PRs. Independent.

---

## 6. Risks, open critique points, and Codex review responses

(Codex completed substantive review 2026-05-02. Each subsection below includes the original question/risk plus Codex's response when given. P1/P1/P2/P3 disposition corrections from Codex's findings have been patched into §3 above.)

### 6.1 The dispositions may be wrong about current state

This doc is built from reading the spec, the current Symphony code (`tools/symphony/`), and `WORKFLOW.md`. I may have misread:

- Where current behavior actually is more complete than I credited
- Where current behavior is less complete than I credited
- What's actually blocking what (dependency arrows between sub-tracks)

**Codex critique invited:** correct any disposition that's wrong. Specifically: items I marked ❌ missing that you know exist in some form, and items I marked ✅ done that have unstated gaps.

### 6.2 Phase 2.A migration is a big architectural change

`codex app-server` migration touches `codexAdapter.mjs` + `runner.mjs` + `manifest.mjs` + likely `workflow.mjs` (config). Risk of regression on existing supervised use. Mitigation proposed: parallel adapter (don't replace `codex exec` until app-server is proven).

**Codex critique invited:** is parallel-adapter the right migration shape? Or big-bang switch behind a feature flag?

**Codex response (locked 2026-05-02):** Parallel app-server adapter is the right migration shape. Do NOT big-bang replace `codex exec`. Keep `codex-exec` as the stable fallback until app-server has its own supervised activation evidence (analogous to the Phase 1.3 supervised execute gates).

### 6.3 Multi-turn unlocks risk profile change

Today supervised execute is single-turn → halts at human-review. Multi-turn continuation (§7.1) means worker can run multiple Codex turns autonomously between human gates. That changes the safety surface meaningfully: longer running times, more chances for drift, more total cost per ready issue.

**Codex critique invited:** should multi-turn be enabled per-issue (opt-in via issue body marker) or per-workflow (config field), and what additional safety controls (per-issue turn cap, per-issue cost cap) should ship alongside?

**Codex response (locked 2026-05-02):** Multi-turn should be **disabled by default**. Require BOTH workflow config opt-in AND issue-level opt-in at first (belt-and-suspenders). Hard caps required alongside enablement:
- Max turns (per-issue, per-workflow)
- Wall-clock timeout (per-issue, total elapsed)
- Token / cost budget (per-issue cap)
- Per-turn preflight: re-read issue state before starting next turn
- Stop-on-write-set drift: if the proposed write set drifts mid-run from the issue's approved write set, halt

### 6.4 Linear adapter is 🚫 deliberately out of scope — for now

We chose GitHub. But if Symphony ever runs against a non-DSC repo that uses Linear, we'd want the adapter. **Codex critique invited:** is "deliberately out of scope" the right disposition, or "deferred until a real Linear-using customer/repo materializes"? Different framing.

### 6.5 Spec §10.5 `linear_graphql` tool extension parity for GitHub

Spec defines an optional client-side tool extension (`linear_graphql`) that the worker can call to query Linear directly. We have no GitHub equivalent — workers can use `gh` CLI via shell calls, but there's no first-class `github_graphql` or `github_rest` tool extension. **Codex critique invited:** is a `github_graphql` extension worth adding, or is shell-out via `gh` sufficient?

**Codex response (locked 2026-05-02):** Skip `github_graphql` for now. `gh` plus the GitHub REST client is enough until app-server tool extensions are real (i.e., until Phase 2.A app-server migration ships and tool extension infrastructure exists). Revisit after 2.A.

### 6.6 Status snapshot with HTTP server — auth posture concern

Spec mentions `server.port` extension is optional. If we ship Phase 2.E HTTP server, the snapshot data includes per-issue state, token totals, rate limits. Defaulting to localhost-only is the safe move. But some operators want remote dashboards. **Codex critique invited:** should Phase 2.E ship localhost-only with no remote-bind capability, or with explicit remote-bind config + auth?

### 6.7 Token accounting depends on app-server payload stability

Spec §13.5 acknowledges payload shape variance ("absolute thread totals" vs "delta-style payloads"). Token accounting code will need defensive parsing. **Codex critique invited:** is there a known-good schema version for app-server token events that we should pin to, or is the lenient parsing approach the only option?

### 6.8 Hooks vs sandboxing tension

Spec §9.4 hooks run via shell (`sh -lc <script>` or `bash -lc`). Hook scripts are stored in `WORKFLOW.md` (repo-owned). If we ship Phase 2.C hooks, malicious or buggy `WORKFLOW.md` content can run arbitrary commands inside the workspace. We trust `WORKFLOW.md` because it's repo-versioned, but multi-repo Symphony could change that. **Codex critique invited:** does Phase 2.C need any sandboxing for hooks, or does "WORKFLOW.md is repo-controlled = trusted" hold?

**Codex response (locked 2026-05-02):** Hooks need sandbox posture **decided before implementation**. "Repo-controlled `WORKFLOW.md` is trusted" is acceptable ONLY for this repo, NOT as a portable default. Phase 2.C ADR must explicitly decide the sandbox posture per intended deployment mode (this-repo-only vs portable-multi-repo) before any hook execution code lands.

### 6.9 Phase 2 ordering depends on which capability matters most

I sequenced 2.A first because it's highest-leverage. But:

- 2.D (dynamic reload) is independent and operationally valuable — could ship anytime
- 2.G (live recover-stale test) is small and closes a known gap
- 2.H (outer timeout) is small and addresses a known daemon-readiness item

Maybe 2.D + 2.G + 2.H first ("operational hardening week") before 2.A's bigger refactor. **Codex critique invited:** what ordering makes most sense given current operational state?

**Codex response (locked 2026-05-02):** Ops hardening first. **2.G live recover-stale test + 2.H outer timeout + workflow-format correction** (the §3.3 + §3.4 divergence Codex caught — either spec-compatible parsing OR explicit deliberate-divergence documentation). Dynamic reload (2.D) is useful but less urgent than preventing stuck/hung daemon behavior. 2.A app-server migration is the bigger architectural lift after ops hardening proves stable.

---

## 7. Open questions for Codex

Beyond the critique points above:

1. **Are there spec sections I missed?** Specifically §11.4 error categories, §13.6 humanized summaries, §5.3.6 codex config field details. I treated these briefly. Any I should expand?
2. **Is the disposition language clean?** ✅ / 🟡 / ❌ / 🚫 — does that map well, or do we need finer-grained?
3. **Sub-track grouping (§5)** — is the A through H grouping coherent, or does it need restructuring?
4. **What's the right MVP for Phase 2?** If we had to ship the smallest possible "we're closer to spec" version, which sub-PRs would compose it? My pick: 2.D (reload) + 2.G (recover-stale test) + 2.H (outer timeout). All three are operationally meaningful + small + independent.
5. **Symphony as separate repo question** — the spec presumes Symphony is its own service. We currently embed in DSC. The PR #147 self-edit guard partially addresses safety, but **does the Phase 2 work make repo extraction more or less appealing?** I lean: do the Phase 2 work in-repo, then extract once architecture stabilizes.
6. **Any dissent on the strategic frame?** This doc treats Phase 1 as a deliberate safety-first adaptation worth preserving while incrementally closing spec gaps. Alternative framing: rebuild from scratch toward the spec. I argue against that (loses Phase 1 safety + GitHub adapter + everything we proved). Curious if you'd dissent.

   **Codex response (locked 2026-05-02):** No dissent. Do not recommend rebuild-from-scratch. Preserve Phase 1 and close gaps incrementally.

---

## 8. What's deferred or out of scope (binding)

These are explicit non-pursuits:

- **Linear adapter and `linear_graphql` extension** — we use GitHub.
- **Multi-tenant control plane / web UI** — spec §2.2 non-goal also.
- **General-purpose workflow engine** — spec §2.2 non-goal.
- **Mandating a single approval/sandbox posture** — spec §2.2 acknowledges; we'll keep our defaults documented per workflow.
- **Auto-merge** — Phase 1 hard rule; Phase 2 must preserve.
- **Removing supervised mode** — Phase 1 hard rule; Phase 2 must preserve as default operating mode.
- **Symphony executing on multiple repos at once** — out of scope until daemon is stable on one repo.

---

## 9. Definition of Done for Phase 2 (when/if pursued)

Phase 2 is "broad live use" complete when:

- Codex app-server adapter (2.A) is the default; `codex exec` adapter retained for fallback or removed deliberately.
- Multi-turn continuation works with per-workflow `max_turns` cap.
- Token totals + rate limits visible in runtime snapshot.
- Orchestrator state machine (2.B) implements the 5 internal states with retry queue + exponential backoff + mid-run reconciliation.
- Workspace hooks (2.C) lifecycle complete with the 4 hooks + timeout config.
- Dynamic `WORKFLOW.md` reload (2.D) live; documented behavior on invalid reload.
- Runtime snapshot (2.E) accessible via local CLI subcommand at minimum; optional HTTP server documented.
- Strict templating (2.F) replaces string-concat prompt assembly.
- Live `recover-stale --execute` (2.G) tested and documented.
- ✅ Outer Codex timeout (2.H) live with sensible default cap.
- Multi-agent concurrency raised from 1 to N safely (still bounded; default 1; per-workflow config).
- Daemon runs unattended for hours with no operator intervention required for healthy paths.

Phase 2 does NOT need to ship Linear adapter, multi-tenant features, or autonomous web discovery to be "broad live use" complete.

---

## 10. Pre-approved remote work pattern

Mirror of Track 2 §10:

### 10.1 — Pre-approved without another stop-gate

- This investigation document and any Phase 2 ADR documents (no code, no migration, no config).
- Phase 2 sub-track ADRs (each is investigation-only stop-gate before implementation).
- Eval harness extensions for new Symphony test fixtures.

### 10.2 — Requires explicit Sami approval

- Any Symphony code change (`tools/symphony/lib/*.mjs`, `tools/symphony/cli.mjs`).
- Any `WORKFLOW.md` change.
- Any change to daemon control flow, lock semantics, or runner.lock format.
- Any new config field defaults.
- Any new env var or feature flag.
- Lifting Symphony to multi-repo or multi-tenant operation.

### 10.3 — Scope creep rule

Pre-approved means pre-approved only for stated scope. Mid-PR expansion → stop and ask.

### 10.4 — Blocked rule

When blocked → draft PR with question. Don't improvise.

---

## 11. First concrete actions (after this doc lands)

1. ~~Codex reviews this document.~~ ✅ done — Codex review completed 2026-05-02; four disposition corrections (P1/P1/P2/P3) accepted and patched into this revision; six §6/§7 review responses locked in §6 alongside the original questions.
2. **Sami responds to remaining open dispositions** if any after Codex's review patch.
3. **MVP decision (Codex-recommended):** ops hardening first — **2.G** (live `recover-stale --execute` test) + **2.H** (outer Codex execution timeout) + **workflow-format correction** (resolve the `<!-- symphony-config -->` JSON vs spec YAML front matter divergence either as a Phase 2 sub-PR or as a deliberately-documented divergence). Codex's reasoning: dynamic reload (2.D) is useful but less urgent than preventing stuck/hung daemon behavior; 2.A app-server migration is the bigger architectural lift after ops hardening proves stable.
4. **First implementation PR is whichever MVP ADR closes first.** All three MVP items are independent; can be parallelized.

---

## 12. Document maintenance

This document is living. Update when:

- Codex critique adds findings or invalidates dispositions.
- A Phase 2 sub-track ships its first PR (mark as "in flight").
- A 🚫 deliberately-out-of-scope item is reconsidered.
- The spec itself updates (Symphony Service Specification v2 etc.).

Update protocol: small additive edits via coordinator PR. Larger structural changes via stop-gate review.

---

**End — Symphony Phase 2 Spec-Gap Investigation v1.0**

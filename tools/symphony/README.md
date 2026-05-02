# Symphony Lite

Local GitHub-Issues-backed orchestration for this repository.

## Operational Status

Symphony is currently prototype infrastructure only. It is not approved for
operational repo work until the DSC full-spec gate in
`docs/investigation/symphony-service-spec-v1-dsc.md` is met.

Do not apply `symphony:ready`, run `once --execute`, run daemon mode, run
`recover-stale --execute`, set `SYMPHONY_EXECUTION_APPROVED=1`, or use
Symphony for real coding tasks before that gate is complete.

This is intentionally smaller and safer than the upstream Symphony
prototype:

- GitHub Issues are the control plane.
- GitHub Mobile is the phone workflow.
- `max_concurrent_agents` starts at `1`.
- `once` defaults to dry-run.
- real Codex execution remains disabled until the DSC full-spec gate is met.
- no public Codex App Server listener is started.

## Commands

Development and investigation commands from the repository root:

```bash
npm run symphony:doctor
npm run symphony:test
```

Fresh worktrees must hydrate root dependencies before running the Symphony
tests. `tools/symphony/lib/workflow.mjs` imports `yaml`, and the root
`package.json` already declares the exact `yaml: 2.5.1` dependency. If a fresh
checkout fails with `ERR_MODULE_NOT_FOUND: Cannot find package 'yaml'`, do not
add another dependency or patch Symphony runtime code. Run a local root
dependency install first, for example:

```bash
npm install --no-package-lock --ignore-scripts --no-audit --no-fund
```

In network-restricted Codex environments, report the setup blocker or use an
already-cached local dependency only for ignored `node_modules` test hydration;
do not commit generated dependency artifacts unless a separate dependency
hygiene PR explicitly introduces a root lockfile.

To run against a specific mock fixture without GitHub auth:

```bash
node tools/symphony/cli.mjs once --dry-run --mock-issues tools/symphony/examples/issues.sample.json
```

Real execution commands exist in the prototype but are not operationally
approved:

- do not run `once --execute`
- do not run daemon mode
- do not run `recover-stale --execute`
- do not set `SYMPHONY_EXECUTION_APPROVED=1`

`--execute` cannot be combined with `--mock-issues`; mock fixtures are
offline dry-run input only.

Each real Codex execution has a Symphony-owned outer wall-clock timeout.
The defaults are `codex.execution_timeout_minutes: 30` and
`codex.execution_timeout_kill_grace_seconds: 15` in `WORKFLOW.md`.
Override them only for a future separately approved gate-closing run with
`SYMPHONY_CODEX_EXECUTION_TIMEOUT_MINUTES` and
`SYMPHONY_CODEX_EXECUTION_TIMEOUT_KILL_GRACE_SECONDS`; invalid values fail
closed before GitHub mutation. On timeout, Symphony sends `SIGTERM` to the
direct Codex child, sends `SIGKILL` after the grace period if needed, moves
the issue to `symphony:blocked`, writes `outcome.reason: "outer_timeout"`
in the manifest, and releases `runner.lock`. Descendant process cleanup is
a residual risk for this phase because the runner does not yet use
process-group termination.

Stale `symphony:running` recovery is explicit and dry-run by default, but live
`recover-stale --execute` must not run except as a separately approved
gate-closing test.

Recovery moves stale running issues to `symphony:blocked`; it does not
start replacement work in the same command.

Do not use real execution. After the DSC full-spec gate is met, a new
operating procedure must be written and approved before any repo work runs
through Symphony.

Dry-runs now show both planned issues and skipped/ineligible issues with
deterministic reasons. Every `once` run and stale recovery dry-run writes
a JSON manifest under `.symphony/state/manifests`.

## Workflow Format

`WORKFLOW.md` uses YAML front matter for Symphony configuration, followed by
the Markdown prompt body that is passed into Codex. The parser returns the
Markdown body as `prompt_template`; the compatibility `markdown` field is an
alias of that same prompt in YAML mode.

Legacy `<!-- symphony-config ... -->` JSON comment blocks remain accepted for
one migration window. In legacy mode, `prompt_template` preserves the current
behavior by returning the full Markdown file. `doctor` reports a warning for
legacy format but does not fail when the config is otherwise valid. If a YAML
workflow still contains a stale legacy config comment, that comment is stripped
from the prompt body before Codex sees it.

## Labels

Required labels:

- `symphony`
- `symphony:ready`
- `symphony:running`
- `symphony:human-review`
- `symphony:blocked`

`doctor` checks labels when GitHub auth is available. It does not create
labels unless you pass `--create-labels`.

## Local State

The runner uses `.symphony/` for local worktrees, logs, and state. That
directory is ignored by git.

Local run manifests are written under `.symphony/state/manifests`. They
record run id, command, mode, timestamps, repository slug, current HEAD,
`origin/main`, clean/dirty status, planned and skipped issues, label
transitions, worktree/log paths, and final outcome. Token-like values are
redacted before writing.

The runner lock lives at `.symphony/state/runner.lock`. Symphony commands
refuse to start when another lock is present and report stale lock
metadata instead of deleting it automatically.

Real worktrees are always created from an explicit `origin/main` base:
the runner fetches `main:refs/remotes/origin/main`, verifies
`origin/main^{commit}` exists, and then runs
`git worktree add -b <branch> <path> origin/main`. It fails closed instead
of falling back to the operator's current `HEAD`.

`doctor` also checks that `origin/main` is resolvable and the current
checkout is clean. Run Symphony from a clean control checkout, not from an
active feature branch with uncommitted work.

Activation issue minimum template:

```markdown
## Approved write set
- docs/runbooks/symphony.md

## Acceptance criteria
- The requested note is present.
- `npm run symphony:test` passes.
```

If the write set includes high-risk scope such as `web/**`, Supabase
migrations, telemetry, prompt contracts, production runtime behavior, or
Track 1 files, the issue must explicitly approve that scope. Otherwise
execute preflight fails closed.

Issues whose Approved write set includes `tools/symphony/**` (Symphony's
own code) are also high-risk and require an explicit high-risk-approval
sentence in the body, for example: `Explicitly approved high-risk scope:
tools/symphony self-edit.` This closes the self-modification primitive:
Symphony cannot rewrite its own safety rails without conscious human
approval beyond the `symphony:ready` label.

Note: `tools/symphony/**` requires explicit high-risk approval, for example `Explicitly approved high-risk scope: tools/symphony self-edit.`

## Adapter Boundary

The code keeps Codex execution behind `tools/symphony/lib/codexAdapter.mjs`.
The Phase 1/2 prototype adapter uses `codex exec --json`. That adapter is
temporary unless a future ADR explicitly approves it as the DSC full-spec
replacement for the original app-server transport. `doctor` still checks
`codex app-server --help` so App Server protocol drift is visible early, but
App Server is not exposed or required for the prototype.

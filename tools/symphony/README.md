# Symphony Lite

Local GitHub-Issues-backed orchestration for this repository.

This is intentionally smaller and safer than the upstream Symphony
prototype:

- GitHub Issues are the control plane.
- GitHub Mobile is the phone workflow.
- `max_concurrent_agents` starts at `1`.
- `once` defaults to dry-run.
- real Codex execution requires both `--execute` and
  `SYMPHONY_EXECUTION_APPROVED=1`.
- no public Codex App Server listener is started.

## Commands

From the repository root:

```bash
npm run symphony:doctor
npm run symphony:dry-run
npm run symphony:once
npm run symphony:recover-stale
npm run symphony:test
```

`symphony:once` is also dry-run by default. To run against a specific
mock fixture without GitHub auth:

```bash
node tools/symphony/cli.mjs once --dry-run --mock-issues tools/symphony/examples/issues.sample.json
```

Real execution is intentionally gated:

```bash
SYMPHONY_EXECUTION_APPROVED=1 node tools/symphony/cli.mjs once --execute
```

`--execute` cannot be combined with `--mock-issues`; mock fixtures are
offline dry-run input only.

Stale `symphony:running` recovery is explicit and dry-run by default:

```bash
npm run symphony:recover-stale
SYMPHONY_EXECUTION_APPROVED=1 node tools/symphony/cli.mjs recover-stale --execute
```

Recovery moves stale running issues to `symphony:blocked`; it does not
start replacement work in the same command.

Do not use real execution until:

1. `npm run symphony:doctor` passes.
2. Sami has separately approved the test issue/auth setup.
3. The issue has the explicit `symphony:ready` label.
4. The issue body has `Approved write set` and `Acceptance criteria`
   sections.

Dry-runs now show both planned issues and skipped/ineligible issues with
deterministic reasons. Every `once` run and stale recovery dry-run writes
a JSON manifest under `.symphony/state/manifests`.

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
The Phase 1 adapter uses `codex exec --json`. `doctor` still checks
`codex app-server --help` so App Server protocol drift is visible early,
but App Server is not exposed or required for Phase 1.

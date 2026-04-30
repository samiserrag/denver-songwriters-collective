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

Do not use real execution until:

1. `npm run symphony:doctor` passes.
2. Sami has separately approved the test issue/auth setup.
3. The issue has the explicit `symphony:ready` label.

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

Real worktrees are always created from an explicit `origin/main` base:
the runner fetches `main:refs/remotes/origin/main`, verifies
`origin/main^{commit}` exists, and then runs
`git worktree add -b <branch> <path> origin/main`. It fails closed instead
of falling back to the operator's current `HEAD`.

## Adapter Boundary

The code keeps Codex execution behind `tools/symphony/lib/codexAdapter.mjs`.
The Phase 1 adapter uses `codex exec --json`. `doctor` still checks
`codex app-server --help` so App Server protocol drift is visible early,
but App Server is not exposed or required for Phase 1.

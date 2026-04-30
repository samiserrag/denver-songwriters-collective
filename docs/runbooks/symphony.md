# Symphony Runbook

## Current Scope

Symphony Phase 1 is a local runner that uses GitHub Issues as the control
plane. It does not change the production app, Supabase, Vercel config, or
public site behavior.

## Phone Workflow

From GitHub Mobile:

1. Create a GitHub Issue in this repo.
2. Include concrete acceptance criteria and any approved write set.
3. Add the `symphony:ready` label.
4. Watch the issue for the `## Codex Workpad` comment.
5. Review the linked branch or PR when the runner moves the issue to
   `symphony:human-review`.
6. Merge manually only after the usual review and quality gates.

The runner never auto-merges.

## Required Labels

- `symphony`
- `symphony:ready`
- `symphony:running`
- `symphony:human-review`
- `symphony:blocked`

Run:

```bash
npm run symphony:doctor
```

If GitHub auth is valid but labels are missing, create them deliberately:

```bash
npm run symphony:doctor -- --create-labels
```

## Local Setup

1. Repair GitHub auth or export a token:

   ```bash
   gh auth login -h github.com
   ```

   or:

   ```bash
   export GITHUB_TOKEN=...
   ```

2. Verify Codex and GitHub readiness:

   ```bash
   npm run symphony:doctor
   ```

3. Run a safe fixture dry-run:

   ```bash
   node tools/symphony/cli.mjs once --dry-run --mock-issues tools/symphony/examples/issues.sample.json
   ```

4. Run a real GitHub dry-run:

   ```bash
   npm run symphony:dry-run
   ```

`doctor` fails if `origin/main` is not resolvable or the current
checkout has local changes. Run Symphony from a clean control checkout so
active Track 1 work cannot bleed into runner operations.

## Phase 1.2 Pre-Activation Checklist

Before the first live supervised run:

1. Work from a clean control checkout on current `origin/main`, not an
   active Track 1 worktree.
2. Repair GitHub auth or export `GITHUB_TOKEN`.
3. Run `npm run symphony:doctor` until it passes.
4. Create one deliberately boring docs-only issue.
5. Include both required issue sections:

   ```markdown
   ## Approved write set
   - docs/runbooks/symphony.md

   ## Acceptance criteria
   - The requested note is present.
   - `npm run symphony:test` passes.
   ```

6. Add only the explicit `symphony:ready` label.
7. Run `npm run symphony:dry-run`.
8. Confirm the dry-run plans exactly one issue, lists skipped issues with
   reasons, and writes a local run manifest.
9. Stop. Do not run `once --execute` until Sami separately approves the
   exact issue and auth setup.

## Real Execution Gate

Do not launch autonomous code-writing until Sami separately approves the
test issue and auth setup.

When approved:

```bash
SYMPHONY_EXECUTION_APPROVED=1 node tools/symphony/cli.mjs once --execute
```

`once` defaults to dry-run. Real execution requires both `--execute` and
`SYMPHONY_EXECUTION_APPROVED=1`.

Daemon mode has an additional guard:

```bash
SYMPHONY_ENABLE_DAEMON=1 SYMPHONY_EXECUTION_APPROVED=1 node tools/symphony/cli.mjs daemon --execute
```

Keep daemon disabled until 2-3 clean supervised `once --execute` runs have
completed without stale locks, bad bases, or scope drift.

## Local State

Symphony writes local state under:

- `.symphony/worktrees`
- `.symphony/logs`
- `.symphony/state`

These paths are ignored by git.

Run manifests live under `.symphony/state/manifests`. Each manifest is a
JSON audit artifact containing:

- run id, command, mode, and timestamps
- repository slug, current HEAD, and `origin/main` SHA when available
- clean/dirty checkout status
- planned issues and skipped/ineligible issues with deterministic reasons
- label transitions, worktree paths, log paths, and final outcome

Manifests must not contain secrets or full token values.

The local runner lock is `.symphony/state/runner.lock`. If a lock exists,
new Symphony commands refuse to start and report the lock owner metadata.
If the lock appears stale, confirm no Symphony process is running before
removing it manually. Execute paths do not auto-delete stale locks.

## Recovery

If a run fails:

1. Stop the runner.
2. Read the issue workpad comment, run manifest, and
   `.symphony/logs/issue-<n>.jsonl`.
3. Dry-run stale running recovery:

   ```bash
   npm run symphony:recover-stale
   ```

4. If the dry-run identifies stale `symphony:running` issues and Sami has
   approved recovery, move them to `symphony:blocked`:

   ```bash
   SYMPHONY_EXECUTION_APPROVED=1 node tools/symphony/cli.mjs recover-stale --execute
   ```

   Recovery only clears stale running locks by blocking the issue; it
   does not launch replacement Codex work.

5. Move the issue to `symphony:blocked` manually if the runner did not do
   so and recovery is not appropriate.
6. Remove any stale local worktree only after confirming it has no needed
   changes:

   ```bash
   git worktree list
   git worktree remove .symphony/worktrees/issue-<n>-<slug>
   ```

7. Re-run `npm run symphony:doctor` before another execution attempt.

## Remote Access

Use GitHub Mobile as the remote control plane. Do not expose Codex App
Server or a local dashboard directly to the public internet.

If a dashboard is added later, expose it only through an authenticated
path such as VPN, mesh networking, or SSH forwarding.

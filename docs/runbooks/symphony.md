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

## Local State

Symphony writes local state under:

- `.symphony/worktrees`
- `.symphony/logs`
- `.symphony/state`

These paths are ignored by git.

## Recovery

If a run fails:

1. Stop the runner.
2. Read the issue workpad comment and `.symphony/logs/issue-<n>.jsonl`.
3. Move the issue to `symphony:blocked` if the runner did not do so.
4. Remove any stale local worktree only after confirming it has no needed
   changes:

   ```bash
   git worktree list
   git worktree remove .symphony/worktrees/issue-<n>-<slug>
   ```

5. Re-run `npm run symphony:doctor` before another execution attempt.

## Remote Access

Use GitHub Mobile as the remote control plane. Do not expose Codex App
Server or a local dashboard directly to the public internet.

If a dashboard is added later, expose it only through an authenticated
path such as VPN, mesh networking, or SSH forwarding.

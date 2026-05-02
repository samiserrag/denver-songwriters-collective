# Symphony Runbook

## Current Scope

Symphony is currently prototype infrastructure only. It is not approved for
operational repo work until the DSC full-spec gate in
`docs/investigation/symphony-service-spec-v1-dsc.md` is met.

Do not apply `symphony:ready`, run `once --execute`, run daemon mode, run
`recover-stale --execute`, set `SYMPHONY_EXECUTION_APPROVED=1`, or use
Symphony for real coding tasks before that gate is complete.

The existing runner does not change the production app, Supabase, Vercel
config, or public site behavior by itself. That is not an authorization to use
it operationally.

## Phone Workflow (Disabled Until Full-Spec Gate)

The GitHub Mobile workflow below is the target control-plane shape, not a
currently approved operating procedure.

After the DSC full-spec gate is met, a new operating procedure will be needed.
The earlier target flow was:

1. a GitHub Issue in this repo
2. concrete acceptance criteria and an approved write set
3. the prototype ready label present on the issue
4. the `## Codex Workpad` comment as the phone-visible status surface
5. linked branch or PR review when the runner moves the issue to
   `symphony:human-review`.
6. manual merge only after the usual review and quality gates

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

## Local Setup (Development and Investigation Only)

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

3. Run a safe fixture dry-run when developing Symphony itself:

   ```bash
   node tools/symphony/cli.mjs once --dry-run --mock-issues tools/symphony/examples/issues.sample.json
   ```

4. Run a real GitHub dry-run only when Sami has approved the exact
   investigation. A dry-run is still not authorization to execute work:

   ```bash
   npm run symphony:dry-run
   ```

`doctor` fails if `origin/main` is not resolvable or the current checkout has
local changes. Run Symphony development checks from a clean control checkout so
active Track 1 work cannot bleed into runner artifacts.

## Workflow Format

`WORKFLOW.md` should start with YAML front matter. The front matter is the
runtime config; the Markdown body after the closing `---` is the prompt body
passed to Codex.

Legacy `<!-- symphony-config ... -->` JSON comment blocks still parse during
the migration window. They are not the canonical format. `doctor` warns on
legacy format without failing when the config is otherwise valid. In YAML mode,
stale legacy config comment blocks are stripped from the prompt body so Codex
does not see duplicate config.

## Historical Prototype Activation Checklist

This checklist records how the earlier prototype trials were bounded. It is no
longer an operating procedure for new repo work. Follow
`docs/investigation/symphony-service-spec-v1-dsc.md` instead.

Historical checklist:

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

6. The issue carried only the prototype ready label.
7. A dry-run was performed.
8. The dry-run planned exactly one issue, listed skipped issues with
   reasons, and wrote a local run manifest.
9. Stop. Do not run `once --execute` unless the DSC full-spec gate is complete
   and Sami separately approves the exact issue and auth setup.

## Live Execution Gate (Currently Closed)

Live Symphony execution is closed. The following commands and actions are
forbidden until the DSC full-spec gate is met:

- applying `symphony:ready`
- `once --execute`
- daemon mode
- `recover-stale --execute`
- setting `SYMPHONY_EXECUTION_APPROVED=1`
- using Symphony for real coding tasks

Approved write sets that include `tools/symphony/**` still require explicit
high-risk approval naming the Symphony self-edit scope; see
`tools/symphony/README.md` for the exact phrasing. That approval is necessary
for implementation PRs, but it does not reopen live execution.

Real Codex execution is bounded by Symphony's outer timeout. Defaults are
30 minutes for the Codex child and 15 seconds of termination grace. This is a
runtime safety feature in the prototype, not authorization to run it.

Invalid timeout or grace values fail closed before GitHub mutation. If the
timeout fires, Symphony blocks the issue, removes `symphony:running`,
updates the workpad with an outer-timeout reason, writes manifest
`outcome.reason: "outer_timeout"`, and releases `runner.lock`. This phase
terminates the direct Codex child only; descendant process cleanup remains
a residual manual-audit risk.

## Daemon Controls (Disabled Until Full-Spec Gate)

Daemon mode must not be started until the DSC full-spec gate is met and Sami
explicitly approves a watched end-to-end daemon trial. A future gate-closing
trial is not general permission to use daemon mode for repo work.

Historical daemon shutdown behavior: `Ctrl-C` asks the daemon to stop after any
active cycle finishes and the local runner lock is released. For emergency
disable, stop that terminal process and unset `SYMPHONY_ENABLE_DAEMON` before
launching another Symphony command; env changes do not stop an already-running
process.

After any historical or future stopped trial, verify `.symphony/state/runner.lock`
is absent. If the lock remains, confirm no Symphony process is running before
manually removing it. Live `recover-stale --execute` remains unproven and must
only run as a separately approved gate-closing test, not as an operational
recovery path.

### Supervised activation log

- 2026-05-01 — first supervised `once --execute` smoke run on commit 8b346d6; manifest path: .symphony/state/manifests/20260501t022714439z-42645-once-tudz96.json.
- 2026-05-01 — PR #147 shipped the Symphony self-edit guard for explicit high-risk approval of `tools/symphony/**`.
- 2026-05-01 — supervised execute #3 verified deterministic skip diagnostics for ineligible ready issue #152.
- 2026-05-01 — watched daemon retry #2 completed after PR #160's daemon shutdown fix.

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

If a historical prototype run failed:

1. Stop the runner.
2. Read the issue workpad comment, run manifest, and
   `.symphony/logs/issue-<n>.jsonl`.
   If the manifest has `outcome.reason: "outer_timeout"`, inspect the
   timeout metadata and confirm no descendant process remains before retry.
3. Dry-run stale running recovery only when Sami approves the exact
   investigation.

4. Do not run `recover-stale --execute` unless Sami approves the exact
   gate-closing test issue. Recovery only clears stale running locks by
   blocking the issue; it does not launch replacement Codex work.

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

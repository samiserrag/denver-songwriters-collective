# Symphony Workflow

This file is the repository-owned policy for the local Symphony runner.
The runner reads this file before planning work and passes it into Codex
when an approved issue is executed.

<!-- symphony-config
{
  "version": 1,
  "max_concurrent_agents": 1,
  "labels": {
    "ready": "symphony:ready",
    "running": "symphony:running",
    "humanReview": "symphony:human-review",
    "blocked": "symphony:blocked",
    "general": "symphony"
  },
  "workspace": {
    "root": ".symphony/worktrees",
    "logs": ".symphony/logs",
    "state": ".symphony/state"
  },
  "recovery": {
    "stale_running_minutes": 240
  },
  "lock": {
    "stale_minutes": 240
  },
  "codex": {
    "adapter": "codex-exec",
    "fallback": "codex exec --json"
  }
}
-->

## Purpose

Symphony lets Sami manage repo-agent work from GitHub Issues, including
from GitHub Mobile. It is an orchestration layer, not a replacement for
repo governance.

## Pickup Rules

The runner may only consider GitHub Issues that meet all of these
conditions:

- issue is open
- issue is not a pull request
- issue has `symphony:ready`
- issue does not have `symphony:running`
- issue does not have `symphony:blocked`
- issue does not have `symphony:human-review`
- issue includes an explicit approved write set
- issue includes acceptance criteria or a clear done condition
- issue does not request high-risk scope unless that scope is explicitly
  approved in the issue body

The runner must never infer work from unlabeled issues.

## Phase 1.2 Pre-Activation Checklist

Before Sami tries the first live supervised run:

1. Use a clean control checkout on current `origin/main`.
2. Run `npm run symphony:doctor` until every check passes.
3. Create one deliberately small issue with `symphony:ready`.
4. Include an `Approved write set` section and an `Acceptance criteria`
   section in the issue body.
5. Run `npm run symphony:dry-run` and confirm exactly one issue is
   planned, skipped issues have deterministic reasons, and a local run
   manifest is written.
6. Do not run `once --execute` until Sami separately approves the exact
   test issue and auth setup.

## Concurrency

`max_concurrent_agents` is fixed at `1` for Phase 1. This preserves the
repo's single-writer collaboration model and prevents accidental overlap
with active Track 1 work.

## Governance

Before any implementation task, the Codex worker must read:

1. `AGENTS.md`
2. `docs/GOVERNANCE.md`
3. this `WORKFLOW.md`
4. the GitHub issue body and comments

The worker must follow the stop-gate protocol:

- investigate with evidence
- critique risk and coupling
- stop for explicit approval when scope is non-trivial or not already
  approved in the issue
- execute only the approved scope

If the issue does not clearly state approval for implementation, the
worker must produce an investigation/handoff result and stop.

Issue comments are part of the execution context. The runner must pass
non-workpad issue comments into the Codex prompt so coordinator approvals,
scope updates, and phone-side clarifications are visible to the worker.

## Stale Running Recovery

`symphony:running` is treated as an active lock until it is explicitly
cleared. A runner may only move stale running issues to
`symphony:blocked` through the explicit stale recovery command. Recovery
must be dry-run first and real recovery must use the same execution gate
as autonomous work.

The stale threshold is configured as `stale_running_minutes`. Phase 1.1
starts at 240 minutes to avoid recovering a genuinely active local run.

## Run Manifests and Runner Lock

Every `once` run and stale recovery dry-run writes a structured local run
manifest under `.symphony/state/manifests`. Manifests include run id,
command, mode, timestamps, repository slug, current HEAD, `origin/main`
SHA when available, clean/dirty status, planned issues, skipped issues
with reasons, label transitions, worktree paths, log paths, and final
outcome. Manifests must never include secrets or full token values.

The runner uses `.symphony/state/runner.lock` so two Symphony commands
cannot operate at the same time. A stale lock is reported with its age and
owner metadata, but execute paths must not auto-delete it. Remove a stale
lock manually only after confirming no Symphony process is still running.

## Issue Template Guidance

Use this minimum shape for activation issues:

```markdown
## Approved write set
- docs/runbooks/symphony.md

## Acceptance criteria
- The runbook includes the requested note.
- `npm run symphony:test` passes.
```

For high-risk scopes such as `web/**`, Supabase migrations, production
runtime behavior, telemetry, prompt contracts, or Track 1 claimed files,
the issue body must explicitly approve that scope. Otherwise the runner
must fail closed.

## Hard Safety Rules

- no auto-merge
- no production app runtime changes unless the issue explicitly approves
  that scope
- no Supabase schema, data, policy, or migration changes unless the issue
  explicitly approves that scope
- no public Codex App Server exposure
- no edits to files claimed by other active agents
- no edits outside the issue's approved write set
- no pushes or PR creation unless GitHub auth is valid and the issue
  explicitly calls for a PR handoff
- daemon remains disabled until 2-3 clean supervised `once --execute`
  runs have completed without stale locks, bad bases, or scope drift

## Workpad Comment

The runner should maintain one issue comment marked with:

`<!-- symphony-workpad -->`

That comment is the phone-friendly status surface for Sami. It should
include:

- current runner state
- last updated timestamp
- claimed labels
- branch, worktree, log, and run manifest paths when known
- latest runner command and mode
- next human action
- blocked reason, if blocked
- PR link when available

## Codex Adapter

Phase 1 uses a runner adapter boundary. The default adapter is
`codex-exec`, which launches:

```bash
codex exec --json
```

Codex App Server is still checked by `symphony:doctor` because it is the
long-term transport target, but Phase 1 does not expose it over the
network and does not depend on a public listener.

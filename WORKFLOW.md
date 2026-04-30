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

The runner must never infer work from unlabeled issues.

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

## Workpad Comment

The runner should maintain one issue comment marked with:

`<!-- symphony-workpad -->`

That comment is the phone-friendly status surface for Sami. It should
include:

- current runner state
- claimed labels
- branch and worktree path when known
- latest command/test evidence
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

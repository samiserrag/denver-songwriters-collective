# Track 1 Agent Briefs

Standing briefs for the multi-agent workflow building out the AI event ops portal.

## When to use these

Open a fresh browser tab for one of three roles. Paste a one-line bootstrap into the new thread; the agent reads its brief here and self-configures.

## Three roles

| Role | File | Where it runs | What it does |
|---|---|---|---|
| Coordinator | `docs/agents/coordinator.md` | Claude Code on web | Audits state, recommends next work, generates builder prompts. Read-only on code. |
| Claude builder | `docs/agents/claude-builder.md` | Claude Code on web | Implements assigned PRs in the Claude lane. |
| Codex builder | `docs/agents/codex-builder.md` | Codex Cloud (with repo selected at task creation) | Implements assigned PRs in the Codex lane. |

## Bootstrap prompts (paste into a fresh thread)

**Fresh coordinator thread:**

```
Read docs/agents/coordinator.md and adopt it as your standing brief. Then run your first standing-task report against current main.
```

**Fresh Claude builder thread:**

```
Read docs/agents/claude-builder.md and adopt it as your standing brief. Then await task assignment.
```

**Fresh Codex builder thread:**

```
Read docs/agents/codex-builder.md and adopt it as your standing brief. Then verify your GitHub setup (git remote -v, gh auth status) and report results before any task work.
```

## How the loop works

1. Sami pings the coordinator: "status?"
2. Coordinator reports + outputs paste-ready builder prompts.
3. Sami pastes the relevant builder prompt into the corresponding builder thread.
4. Builder opens a PR, posts a status comment.
5. Sami pings the coordinator: "verify <PR#>".
6. Coordinator audits the PR against governance rules.
7. Sami merges via GitHub mobile.
8. Loop.

## Authority boundaries

The coordinator decides autonomously within pre-approved (§13.1) scope and recommends-with-reasoning for approval-required (§13.2) decisions. Sami approves §13.2 work and merges all PRs.

See `docs/investigation/ai-event-ops-collaboration-plan.md` §13 for the full pre-approved vs approval-required split.

## Related canonical docs

- `AGENTS.md` — repo-wide agent rules
- `docs/GOVERNANCE.md` — stop-gate protocol
- `docs/investigation/ai-event-ops-collaboration-plan.md` — Track 1/2 strategy
- `docs/investigation/track1-claims.md` — current ground-truth on active work

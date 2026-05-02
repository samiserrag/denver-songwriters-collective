# Agent Briefs

Standing briefs and bootstrap prompts for the current multi-lane workflow.

## Current Lane Map

| Lane | Name | Default role |
|---|---|---|
| Lane 1 | Coordinator | Routing, audits, prompts, claims/docs sync. No code/runtime work. |
| Lane 2 | Track 2 | Track 2 security, BOLA/RLS/service-role, concierge infrastructure, and approved Track 2 implementation. |
| Lane 3 | Symphony | Symphony prototype/spec-completion implementation, tests, and docs. |
| Lane 4 | Symphony helper | Read-only Symphony critique, audits, and decision memos unless explicitly assigned implementation. |
| Lane 5 | Event audit/admin alerts/growth | Event audit, admin alerting, and growth-surface planning. Defaults to docs-only investigation until stop-gates are approved. |
| Lane 6 | Strategy/public-good infrastructure policy | Operating thesis, ingestion ethics, source registry, verification model, agentic maintenance policy, and trust-layer governance. Docs-only by default. |

## Brief Files

| Brief | Use |
|---|---|
| `docs/agents/coordinator.md` | Lane 1 standing brief for current multi-lane coordination. |
| `docs/agents/claude-builder.md` | Legacy Track 1 Claude builder defaults. Use only as a protocol reference when a coordinator prompt assigns Claude work. |
| `docs/agents/codex-builder.md` | Legacy Track 1 Codex builder defaults and Codex Cloud caveats. Use only as a protocol reference when a coordinator prompt assigns Codex work. |

The coordinator prompt is authoritative for current lane assignment. If a builder brief says "Track 1" but the coordinator prompt assigns Lane 2, Lane 3, Lane 4, Lane 5, or Lane 6, follow the coordinator prompt for scope and files.

## Bootstrap Prompts

**Fresh coordinator thread:**

```text
Read docs/agents/coordinator.md and adopt it as your standing brief. Then run your first standing-task report against current main.
```

**Fresh Track 2 builder thread:**

```text
Read AGENTS.md and docs/GOVERNANCE.md. Then read the Lane 2 prompt from the coordinator and do not start outside that scope.
```

**Fresh Symphony builder thread:**

```text
Read AGENTS.md, docs/GOVERNANCE.md, docs/investigation/symphony-service-spec-v1-dsc.md, docs/runbooks/symphony.md, tools/symphony/README.md, and the Lane 3 prompt from the coordinator. Treat Symphony as prototype-only; do not run live execute or daemon commands.
```

**Fresh Symphony helper thread:**

```text
Read AGENTS.md, docs/GOVERNANCE.md, docs/investigation/symphony-service-spec-v1-dsc.md, and the Lane 4 prompt from the coordinator. Stay read-only unless explicitly assigned implementation.
```

**Fresh Lane 5 builder thread:**

```text
Read AGENTS.md and docs/GOVERNANCE.md. Then read the Lane 5 prompt from the coordinator. Start with docs-only event audit/admin alerts/growth investigation unless Sami has explicitly approved runtime work.
```

**Fresh Lane 6 strategy thread:**

```text
Read AGENTS.md, docs/GOVERNANCE.md, docs/strategy/OPERATING_THESIS.md, docs/strategy/INGESTION_AND_FAIR_COMPETITION.md, docs/strategy/SOURCE_REGISTRY.md, docs/strategy/AGENTIC_EVENT_MAINTENANCE.md, .claude/rules/05-ingestion-and-agent-readability.md, and the Trust Layer Invariant in .claude/rules/00-governance-and-safety.md. Then read the Lane 6 prompt from the coordinator. Stay docs-only unless Sami explicitly approves a stop-gated implementation phase.
```

## How The Loop Works

1. Sami pings Lane 1: "status?" or asks for next prompts.
2. Coordinator reports lane state and outputs paste-ready prompts.
3. Sami pastes each prompt into the appropriate lane thread.
4. Builder opens a PR or returns a read-only memo.
5. Coordinator audits the PR/memo against governance and lane boundaries.
6. Sami merges or asks for patches.
7. Loop.

## Authority Boundaries

Sami is final approver. The coordinator routes and audits. Builders implement only the assigned prompt. Symphony cannot be used for operational repo work until the full DSC spec gate is explicitly closed.

## Related Canonical Docs

- `AGENTS.md` - repo-wide agent rules
- `docs/GOVERNANCE.md` - stop-gate protocol
- `docs/investigation/track2-roadmap.md` - Track 2 strategy
- `docs/investigation/symphony-service-spec-v1-dsc.md` - Symphony operational gate
- `docs/investigation/track1-claims.md` - legacy AI-edit claims and coordination ledger

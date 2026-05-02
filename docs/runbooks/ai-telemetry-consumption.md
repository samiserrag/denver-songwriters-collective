# Runbook: AI Edit-Turn Telemetry Consumption

**Status:** ACTIVE
**Owner:** Sami
**Last updated:** 2026-05-01
**Scope:** Track 1 PR 3 telemetry stack consumed from Axiom for Track 2 operations

---

## Purpose

Make the Track 1 PR 3 telemetry stack usable for operations before Track 2 adds more agent modes.

This runbook documents the saved Axiom query that joins:

- `[edit-turn-telemetry]` initial turn events
- `[edit-turn-outcome]` follow-up outcome events

The join key is `turnId`.

---

## Source Contract

Dataset: `vercel-runtime`.

PR stack:

- PR #142: telemetry schema, builders, and `[edit-turn-telemetry]` emitter.
- PR #146: server-side wiring at edit-turn call sites.
- PR #148: `turnId` correlation, thin outcome endpoint, and `[edit-turn-outcome]` emitter.

Initial events carry the rich context:

- `turnId`
- `mode`
- `currentEventId`
- `priorStateHash`
- `scopeDecision`
- `proposedChangedFields`
- `verifierAutoPatchedFields`
- `riskTier`
- `enforcementMode`
- `blockedFields`
- `userOutcome`
- `modelId`
- `latencyMs`
- `occurredAt`

Outcome events carry only:

- `turnId`
- `userOutcome`
- `occurredAt`

All rich context lives on the initial event. Consumers join by `turnId`.

---

## Saved Query

Create an Axiom saved query named:

```text
AI edit turns - initial/outcome join
```

Default window: `7d`.

```apl
let initial = ['vercel-runtime']
| where _time > ago(7d)
| where message has '[edit-turn-telemetry]'
| parse message with '[edit-turn-telemetry] ' payload
| extend p = parse_json(payload)
| project
    initialAt = todatetime(p.occurredAt),
    turnId = tostring(p.turnId),
    mode = tostring(p.mode),
    currentEventId = tostring(p.currentEventId),
    priorStateHash = tostring(p.priorStateHash),
    scopeDecision = tostring(p.scopeDecision),
    proposedChangedFields = tostring(p.proposedChangedFields),
    proposedChangedFieldCount = array_length(p.proposedChangedFields),
    verifierAutoPatchedFields = tostring(p.verifierAutoPatchedFields),
    verifierAutoPatchedFieldCount = array_length(p.verifierAutoPatchedFields),
    riskTier = tostring(p.riskTier),
    enforcementMode = tostring(p.enforcementMode),
    blockedFields = tostring(p.blockedFields),
    blockedFieldCount = array_length(p.blockedFields),
    initialUserOutcome = tostring(p.userOutcome),
    modelId = tostring(p.modelId),
    latencyMs = tolong(p.latencyMs);
let outcomes = ['vercel-runtime']
| where _time > ago(7d)
| where message has '[edit-turn-outcome]'
| parse message with '[edit-turn-outcome] ' payload
| extend p = parse_json(payload)
| project
    turnId = tostring(p.turnId),
    outcomeAt = todatetime(p.occurredAt),
    userOutcome = tostring(p.userOutcome)
| summarize arg_max(outcomeAt, userOutcome) by turnId;
initial
| join kind=leftouter outcomes on turnId
| extend resolvedOutcome = coalesce(userOutcome, 'unknown')
| project
    initialAt,
    outcomeAt,
    turnId,
    mode,
    currentEventId,
    scopeDecision,
    resolvedOutcome,
    proposedChangedFields,
    proposedChangedFieldCount,
    verifierAutoPatchedFields,
    verifierAutoPatchedFieldCount,
    riskTier,
    enforcementMode,
    blockedFields,
    blockedFieldCount,
    modelId,
    latencyMs,
    priorStateHash
| sort by initialAt desc
```

CLI form:

```bash
axiom query "<paste query above>" --format table
```

---

## Expected Result Shape

| Column | Meaning |
|---|---|
| `initialAt` | Server timestamp from the initial telemetry event. |
| `outcomeAt` | Server timestamp from the outcome event, if one arrived. |
| `turnId` | Correlation id shared by initial and outcome events. |
| `mode` | `create`, `edit_series`, or `edit_occurrence`. |
| `currentEventId` | Event id when the turn is tied to an existing event; empty/null for create mode. |
| `scopeDecision` | Model/server scope decision: `series`, `occurrence`, `ambiguous`, or empty/null. |
| `resolvedOutcome` | `accepted`, `rejected`, or `unknown` when no outcome event exists. |
| `proposedChangedFields` | JSON array string of fields proposed by the turn. |
| `proposedChangedFieldCount` | Count of proposed changed fields. |
| `verifierAutoPatchedFields` | JSON array string of verifier auto-patched fields. |
| `verifierAutoPatchedFieldCount` | Count of verifier auto-patched fields. |
| `riskTier` | Highest registry risk tier for the turn. |
| `enforcementMode` | Registry enforcement mode at decision time. |
| `blockedFields` | JSON array string of fields blocked by the gate or clarification path. |
| `blockedFieldCount` | Count of blocked fields. |
| `modelId` | Model id used for the turn. |
| `latencyMs` | Initial turn latency in milliseconds. |
| `priorStateHash` | Stable hash of prior event state when present. |

Interpretation note: `unknown` is not a rejection. It means no definitive accept/reject outcome was posted for that turn. Track acceptance rate over definitive outcomes only, and track unknown rate separately.

---

## Dashboard Suggestions

Add an Axiom dashboard using the saved query as the source, then create these panels:

1. Outcome mix by mode
   - Group by `mode` and `resolvedOutcome`.
   - Show `accepted`, `rejected`, and `unknown` separately.
   - Acceptance rate should be `accepted / (accepted + rejected)`, not `accepted / all turns`.

2. Latency by mode
   - Group by `mode`.
   - Show `p50` and `p95` of `latencyMs`.
   - Investigate if p95 stays above 30 seconds.

3. Blocked-fields rate
   - Group by `mode`, `riskTier`, and `blockedFieldCount > 0`.
   - Investigate sudden increases after prompt, registry, or gate changes.

4. Model distribution
   - Group by `modelId`.
   - Useful when comparing behavior across model migrations.

5. Recent high-risk accepted turns
   - Filter `riskTier == 'high'` and `resolvedOutcome == 'accepted'`.
   - Use for quick sampling during weekly or monthly transcript review.

Example dashboard aggregate:

```apl
let initial = ['vercel-runtime']
| where _time > ago(7d)
| where message has '[edit-turn-telemetry]'
| parse message with '[edit-turn-telemetry] ' payload
| extend p = parse_json(payload)
| project
    initialAt = todatetime(p.occurredAt),
    turnId = tostring(p.turnId),
    mode = tostring(p.mode),
    latencyMs = tolong(p.latencyMs);
let outcomes = ['vercel-runtime']
| where _time > ago(7d)
| where message has '[edit-turn-outcome]'
| parse message with '[edit-turn-outcome] ' payload
| extend p = parse_json(payload)
| project
    turnId = tostring(p.turnId),
    userOutcome = tostring(p.userOutcome);
initial
| join kind=leftouter outcomes on turnId
| extend resolvedOutcome = coalesce(userOutcome, 'unknown')
| summarize
    turns = count(),
    accepted = countif(resolvedOutcome == 'accepted'),
    rejected = countif(resolvedOutcome == 'rejected'),
    unknown = countif(resolvedOutcome == 'unknown'),
    latencyP50 = percentile(latencyMs, 50),
    latencyP95 = percentile(latencyMs, 95)
  by bin(initialAt, 1d), mode
| sort by initialAt desc
```

---

## Operational Use

During incident review or a model/prompt rollout:

1. Run the saved query for the deployment window.
2. Filter to the affected `mode`.
3. Sample turns with high `latencyMs`, non-empty `blockedFields`, or high-risk accepted outcomes.
4. If repeated bad outputs appear, add fixtures to the existing Track 1 eval harness rather than relying on ad hoc prompt memory.
5. File follow-up work against the relevant Track 2 sub-track if the issue is not a Track 1 regression.

---

## Related Docs

- `docs/investigation/ai-event-ops-collaboration-plan.md`
- Track 2 roadmap PR #157, especially operational habits and telemetry consumption
- `web/src/lib/events/editTurnTelemetry.ts`
- `web/src/lib/events/evals/README.md`

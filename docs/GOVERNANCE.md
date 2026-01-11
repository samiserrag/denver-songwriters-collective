# Governance: Stop-Gate Workflow

**Status:** CANONICAL
**Version:** 1.1
**Last Updated:** January 2026

> This document defines how changes ship in this repository. All contributors and agents must follow this workflow.

---

## Purpose

This project uses stop-gates to prevent irreversible errors. However, once an execution pattern is proven safe, repeated work should not require redundant approvals.

---

## Roles

| Role | Responsibility | Authority |
|------|----------------|-----------|
| **Sami** | Product owner, final decision-maker | Approves all execution prompts |
| **Coordinator** | Defines scope, approves irreversible actions, sets governance mode | Issues execution prompts only after approval |
| **Repo Executor** | Primary: execution. Secondary: collaborate on investigation, troubleshooting, and architectural discussion when invited | Trusted to carry out approved patterns efficiently |

**Note:** The executor must not work in isolation but is trusted to execute approved patterns without redundant approval.

---

## Investigations

**Always allowed and encouraged at any step.**

- Investigations do not require approval and should be performed proactively
- Findings should be reported clearly, especially if they affect safety or scope
- Investigation documents go in `docs/investigation/phase{X}-{name}.md`

---

## Stop-Gate Protocol (Required)

**Stop-gates are required when:**
- A pattern is unproven
- Schema/FK surface is unknown
- Data loss or orphaning is possible
- Architecture or product behavior may change

**Stop-gates are collapsed when:**
- The same execution pattern has been successfully completed and verified
- Scope is limited to known tables and fields
- Canonical decisions (e.g., naming) are pre-approved

All non-trivial changes must follow this three-step protocol. No exceptions.

### Step A: Investigation (Repo Agent)

The repo agent:
1. Investigates the problem or feature request
2. Produces evidence (file paths, line ranges, migration names, policy names)
3. Documents findings in `docs/investigation/phase{X}-{name}.md`
4. Identifies failure modes, coupling risks, and migration requirements

**Output:** Investigation document with evidence, not speculation.

### Step B: Critique (Repo Agent)

Before any execution prompt is issued, the repo agent must provide:
1. **Risks** — What could go wrong?
2. **Coupling** — What systems are affected?
3. **Migrations** — Are DB changes required? Are they reversible?
4. **Rollback** — How do we undo this if it fails?
5. **Test coverage** — What tests need to be added/updated?

**Output:** Stop-gate checklist ready for Sami's review.

### Step C: Wait for Approval

The repo agent **STOPS** and waits.

Only after Sami explicitly approves does the orchestrator issue an execution prompt.

**No implicit approvals. Silence is not consent.**

---

## Pattern-Established Mode (PEM)

Once an execution pattern is established (proven safe through successful completion and verification):

**Executor may proceed with multiple similar executions without per-item approval.**

Each execution must still:
- Run in a transaction
- Report before/after counts
- Stop immediately on any anomaly

### Safety Rule (Non-Negotiable)

**If anything deviates from the established pattern, the executor must stop and request guidance.**

Examples of deviations requiring stop:
- Unexpected row counts
- New FK relationships discovered
- Different data shapes than expected
- Any error or warning during execution

---

## Evidence Standard

All investigation claims must be backed by evidence. No speculation.

| Claim Type | Required Evidence |
|------------|-------------------|
| Code behavior | File path + line range (e.g., `src/lib/foo.ts:42-58`) |
| Database schema | Migration filename + table/column names |
| RLS policies | Policy name + migration reference |
| API contracts | Route file path + method + response shape |
| UI behavior | Component path + prop interface |

**Unknown items must be labeled:**

```
UNKNOWN: [description]
Next step: [specific action to gather evidence]
```

---

## Quality Gates

Every execution phase must pass these gates before merge:

| Gate | Command | Requirement |
|------|---------|-------------|
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Tests | `npm run test -- --run` | All passing |
| Build | `npm run build` | Success |
| Smoke | [SMOKE-PROD.md](./SMOKE-PROD.md) | All checks pass |

**Full verification command:**
```bash
cd web && npm run lint && npm run test -- --run && npm run build
```

---

## No Band-Aids Standard

Root-cause fixes only. No symptom patching.

### Required for Every Fix

1. **Root cause analysis** — Why did this happen? Document in investigation.
2. **Contract update** — If behavior changed, update `docs/CONTRACTS.md`.
3. **Test coverage** — Add regression test that would have caught this.
4. **Invariant enforcement** — Fix the underlying invariant, not just the symptom.

### Forbidden Patterns

- Patching UI to hide data bugs
- Adding special cases without understanding why they're needed
- Fixing one occurrence without checking for similar issues
- Closing issues without regression tests

---

## No Silent Drift

Documentation must stay synchronized with reality.

- If behavior changes, contracts update.
- If contracts update, tests update.
- If tests update, CLAUDE.md "Recent Changes" updates.

**Contradictions between docs must be resolved explicitly, not ignored.**

---

## Definition of Done (PR Checklist)

Before any PR merges:

- [ ] Investigation document exists (for non-trivial changes)
- [ ] Stop-gate approval received from Sami
- [ ] Contract updates included (if behavior changed)
- [ ] Tests added/updated (regression coverage)
- [ ] Lint passes (0 errors, 0 warnings)
- [ ] Tests pass (all green)
- [ ] Build succeeds
- [ ] Smoke checklist updated (if new subsystem)
- [ ] CLAUDE.md "Recent Changes" updated
- [ ] No unresolved UNKNOWNs for core invariants

---

## Investigation-Only PRs

PRs that contain only documentation (e.g., `docs/investigation/*.md`) are allowed without full execution approval, but:

- Must not include code changes
- Must not include migration changes
- Must not include config changes
- Must be clearly labeled as "Investigation Only"

---

## Docs Responsibility Matrix

| Document | Owner | Updates When |
|----------|-------|--------------|
| `PRODUCT_NORTH_STAR.md` | Product philosophy | Rare; requires version bump |
| `CONTRACTS.md` | Enforceable UI/data rules | UI behavior changes |
| `theme-system.md` | Tokens + contrast rules | Styling/system changes |
| `CLAUDE.md` | Repo operations + workflow | Every push to main |
| `known-issues.md` | Issue tracking | Issues discovered/resolved |
| `SMOKE-PROD.md` | Production verification | New subsystems ship |
| `GOVERNANCE.md` | Workflow + stop-gates | Workflow changes |

---

## Track Template

For any new subsystem or major feature track:

### Phase X.0 — Scope Definition
- What problem are we solving?
- What is explicitly out of scope?
- Success criteria?

### Phase X.1 — Investigation
- Produce `docs/investigation/phaseX-{name}.md`
- Inventory all affected files
- Document failure modes
- Identify migration requirements

### Phase X.2 — Stop-Gate Decisions
- [ ] Risks documented
- [ ] Coupling analyzed
- [ ] Rollback plan exists
- [ ] Test strategy defined
- [ ] Sami approval received

### Phase X.3 — Execution (Post-Approval)
- Implement changes
- Update contracts
- Add/update tests
- Pass quality gates

### Phase X.4 — Validation
- Run smoke checklist
- Verify in production
- Close investigation doc with "RESOLVED" status
- Update CLAUDE.md "Recent Changes"

---

## Related Documents

- [CLAUDE.md](../CLAUDE.md) — Repo operations and commands
- [PRODUCT_NORTH_STAR.md](./PRODUCT_NORTH_STAR.md) — Philosophy and UX laws
- [CONTRACTS.md](./CONTRACTS.md) — Enforceable UI/data contracts
- [SMOKE-PROD.md](./SMOKE-PROD.md) — Production verification checklist
- [known-issues.md](./known-issues.md) — Issue tracking

---

**END — Governance Workflow v1.0**

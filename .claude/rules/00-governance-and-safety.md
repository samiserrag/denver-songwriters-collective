---
paths:
  - "**/*"
---

# Governance and Safety Rules

This file contains global non-negotiable governance and safety rules moved from the root `CLAUDE.md`.

## Security: Database Invariants (Non-Negotiable)

**All agents must comply with database security rules enforced by CI.**

Four invariants are checked on every push/PR:
1. All public tables must have RLS enabled
2. SECURITY DEFINER functions must not be callable by anon/public (unless allowlisted)
3. Postgres-owned views must use `security_invoker=true` (unless allowlisted)
4. No TRUNCATE/TRIGGER/REFERENCES privileges for anon/authenticated

**Do NOT bypass CI by adding allowlist entries.** Fix the root cause instead:
- Missing RLS → Add `ENABLE ROW LEVEL SECURITY` to migration
- SECURITY DEFINER → Change to SECURITY INVOKER or move to API route
- Postgres-owned view → Add `WITH (security_invoker = true)`
- Dangerous privileges → Use specific grants (SELECT/INSERT/UPDATE/DELETE)

Allowlisting requires documented justification and explicit approval from Sami.

See: [SECURITY.md](./SECURITY.md) and `web/scripts/security/README.md`

---

## Governance: Stop-Gate Workflow (Required)

All non-trivial changes must follow the stop-gate protocol. See [docs/GOVERNANCE.md](./docs/GOVERNANCE.md) for full details.

### Quick Reference

1. **Step A: Investigate** — Repo agent gathers evidence (file paths, line ranges, migrations)
2. **Step B: Critique** — Repo agent documents risks, coupling, rollback plan
3. **Step C: Wait** — Repo agent STOPS. Only after Sami approves does execution begin.

### Subordinate Architect Review Mode

When Codex (senior architect) and Opus (junior architect + executor) collaborate:
- Opus must actively critique plans, not just execute
- Required outputs: pre-execution critique (assumptions, ≥3 risks, ≥2 deltas), in-flight alerts, post-execution regression review
- Dissent is required — default agreement without evidence is a governance violation
- No commits/push, no unrelated refactors, no architecture changes without approval
- See [GOVERNANCE.md §Subordinate Architect Review Mode](./docs/GOVERNANCE.md) for full protocol

### Single-Writer Collaboration Protocol

When Codex and Opus are paired on one tract:
- Opus is the sole writer (edits/stage/commit/push) during active execution cycles
- Codex is read-only (investigation, critique, approve/hold decisions)
- Each cycle is SHA-locked (report branch + HEAD SHA at start, new SHA at end)
- Do not run parallel implementation branches for the same tract
- Any unexpected branch/SHA drift requires immediate STOP + re-sync
- See [GOVERNANCE.md §Single-Writer Collaboration Protocol](./docs/GOVERNANCE.md) for canonical rules

### Definition of Done (PR Checklist)

Before any PR merges:

- [ ] Investigation document exists (for non-trivial changes)
- [ ] Stop-gate approval received from Sami
- [ ] Contract updates included (if behavior changed)
- [ ] Tests added/updated (regression coverage)
- [ ] Lint passes (0 errors, 0 warnings)
- [ ] Tests pass (all green)
- [ ] Build succeeds
- [ ] Smoke checklist updated (if new subsystem)
- [ ] docs/completed/CLAUDE.md updated
- [ ] No unresolved UNKNOWNs for core invariants

### Investigation-Only PRs

PRs containing only documentation (e.g., `docs/investigation/*.md`) are allowed without full execution approval, but must not include code, migration, or config changes.

### Email Systems Philosophy

Email systems in DSC prioritize community value over marketing optimization. The weekly digest is community infrastructure — it connects songwriters with stages, sessions, and each other. Dark patterns, forced retention, deceptive unsubscribe flows, or guilt-based copy are **not permitted**. See `docs/gtm/weekly-personalized-digest-north-star.md` §3.5 for the full email philosophy.

---


## Agent Behavior Rules

1. **Follow prompts exactly** — no improvisation unless asked
2. **Report and stop** when instructions complete or blocked
3. **Reality beats reasoning** — verify in browser, not just code
4. **One change = one contract** — no mixed refactors
5. **Update docs/completed/CLAUDE.md** after every push to main
6. **Production debugging** — when investigating production errors, query Axiom runtime logs (`axiom query`) before speculating about root causes

---

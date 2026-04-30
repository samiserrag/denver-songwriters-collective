# Track 1 Claims Doc

**Status:** Living
**Last updated:** 2026-04-30

This file is the lightweight coordination ledger for Track 1 (AI edit and update existing events). Every active PR in Track 1 must list its branch, owner, scope, files claimed, base SHA, and status here so other agents know what is safe to touch.

Read order before editing this file:

1. `AGENTS.md`
2. `docs/GOVERNANCE.md`
3. `docs/investigation/ai-event-ops-collaboration-plan.md`
4. this file

Rules:

- Claim a file before editing it. If a file is already claimed by another agent, do not edit it.
- Update `status` as work progresses (`in_progress`, `awaiting_review`, `merged`, `abandoned`).
- Single-writer locks defined in the collaboration plan §8.2 still apply.

---

## Active claims

### PR 10 — Refresh instrumentation, debug-gated only

- **Branch:** `codex/refresh-instrumentation-pr10`
- **Owner:** Codex
- **Scope:** Pre-approved per collaboration plan §13.1. Debug-gated instrumentation only inside `eventDraftSync.ts`; no call-site edits, no runtime behavior change when debug is off, no migrations.
- **Files claimed (write):**
  - `web/src/lib/events/eventDraftSync.ts`
  - `web/src/__tests__/eventDraftSync-instrumentation.test.ts`
  - `docs/investigation/track1-claims.md` (this file)
- **Files referenced (read-only):**
  - `web/src/__tests__/interpreter-host-draft-sync.test.ts`
- **Base SHA:** `e143fac2e45bdce9eb3a33875dbd4825868bfd4f`
- **Status:** `in_progress`
- **Notes for the other agent:**
  - Coordinator expected `e143fac`; actual sandbox HEAD is `e143fac2e45bdce9eb3a33875dbd4825868bfd4f` (same short SHA prefix).
  - Instrumentation is gated by a debug env flag and defaults off.



---

## Closed claims


### PR 2 — Server-side patch diff utility

- **Branch:** `claude/patch-diff-pr2`
- **Owner:** Claude (web)
- **End SHA:** merged via PR #126 → `992cb38c`
- **Status:** `merged`
- **Notes:** Server-side patch diff utility landed; runtime wiring deferred to later PRs per plan.

### PR 1 — Patch field registry + classification test

- **Branch:** `claude/patch-field-pr1-EhARj`
- **Owner:** Claude (web)
- **End SHA:** merged via PR #124 → `e47daed`
- **Status:** `merged`
- **Notes:** Adds `web/src/lib/events/patchFieldRegistry.ts` and the deterministic classification test. Registry is now the source of truth for PR 2 diff and (later) PR 9 gate.

### PR 4 — Track 1 eval harness

- **Branch:** `codex/start-pr-4-for-eval-harness`
- **Owner:** Codex
- **End SHA:** merged via PR #125
- **Status:** `merged`
- **Notes:** Eval harness, fixtures, npm script. No runtime behavior change. Aligns with PR 1 field names.

---

## Out-of-scope reminders

These belong to later PRs and must not be touched in PR 2:

- runtime use of the diff utility (PRs 9, 11)
- prompt or interpreter contract rewrite (PR 5, requires Sami approval)
- AI edit routes (PR 6, requires Sami approval)
- entry-point UI (PR 7, requires Sami approval)
- venue / image edit wiring (PR 8, requires Sami approval)
- published-event gate behavior (PR 9, requires Sami approval)
- telemetry runtime changes (PR 3, requires Sami approval)
- `web/src/app/api/events/interpret/route.ts` (single-writer lock, plan §8.2)
- `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx` (single-writer lock, plan §8.2)

If PR 2 needs anything from the list above, stop and open a draft PR with the question per collaboration plan §13.4.

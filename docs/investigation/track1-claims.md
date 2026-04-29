# Track 1 Claims Doc

**Status:** Living
**Last updated:** 2026-04-29

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

### PR 2 — Server-side patch diff utility

- **Branch:** `claude/patch-diff-pr2`
- **Owner:** Claude (web)
- **Scope:** Pre-approved per collaboration plan §13.1. Server-side diff utility only. No runtime call sites are wired in this PR; the utility is consumed in PR 9 (published-event gate) and PR 11 (UI "What changed" section). No runtime behavior change, no migrations, no allowlist migration.
- **Files claimed (write):**
  - `web/src/lib/events/computePatchDiff.ts`
  - `web/src/lib/events/__tests__/computePatchDiff.test.ts`
  - `docs/investigation/track1-claims.md` (this file)
- **Files referenced (read-only):**
  - `web/src/lib/events/patchFieldRegistry.ts` — risk tier / scope / value kind source of truth (PR 1, merged)
  - `web/src/lib/supabase/database.types.ts` — generated event row type
- **Base SHA:** `c76e7c00c148efd62625042393d6bd88f79850a7`
- **Status:** `in_progress`
- **Notes for the other agent:**
  - Diffs use `PATCH_FIELD_REGISTRY` to determine `value_kind` (scalar vs array) per plan §6 PR 2.
  - Array fields (`event_type`, `categories`, `custom_dates`) diff by added/removed values, **not positional order**. Order changes alone produce no change.
  - Scalar values normalize null/undefined/empty-string as equivalent (matches the existing `lib/ops/eventDiff.ts` convention so the AI patch surface and CSV ops surface agree on emptiness).
  - Patch fields outside the registry (system timestamps, `UNCLASSIFIED_BY_DESIGN`, made-up names) are returned in `unknownFields`. Callers must treat unknowns as high-risk + enforced per plan §5.1 — this utility does not silently drop them.
  - The diff result includes per-field `risk_tier` and `enforcement_mode` snapshots so PR 3 telemetry and PR 9 gating can record the registry classification at decision time without a second lookup.
  - Occurrence-scope diffs reject patches that touch series-only fields (e.g. `recurrence_*`, `is_published`); rejected fields are listed in `outOfScopeFields` and not included in `changedFields`.

---

## Closed claims

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

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

### PR 7 — AI edit entry points and copy

- **Branch:** `codex/ai-edit-entry-points-pr7`
- **Owner:** Codex
- **Scope:** §13.2 (Sami-approved this session). Add entry links/buttons only for the PR 6 AI edit routes:
  - add `Update with AI` from `/dashboard/my-events/[id]` to `/dashboard/my-events/[id]/ai`
  - add EventForm edit-mode AI actions for series and occurrence edit contexts
  - add `Edit with AI` to each occurrence row action
  - keep copy honest: no URL schedule import promise, no automatic published-event mutation promise, no completed write/apply behavior promise
- **Files claimed (write):**
  - `web/src/app/(protected)/dashboard/my-events/[id]/page.tsx`
  - `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx`
  - `web/src/app/(protected)/dashboard/my-events/[id]/overrides/_components/OccurrenceEditor.tsx`
  - `web/src/__tests__/ai-edit-entry-points.test.ts` (new)
  - `docs/investigation/track1-claims.md` (this file)
- **Files referenced (read-only):**
  - `web/src/app/(protected)/dashboard/my-events/[id]/ai/page.tsx` — PR 6 series AI route shape
  - `web/src/app/(protected)/dashboard/my-events/[id]/overrides/[dateKey]/ai/page.tsx` — PR 6 occurrence AI route shape
  - `web/src/__tests__/ai-edit-routes.test.ts` — PR 6 route/copy prop surface assertions
- **Files locked / forbidden in this PR:**
  - `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx`
  - `web/src/app/api/events/interpret/route.ts`
  - `web/src/lib/events/aiPromptContract.ts`
  - `web/src/lib/events/eventDraftSync.ts` (PR 10 lock)
  - any migration in `supabase/migrations/`
  - any telemetry runtime file (PR 3 scope)
  - published-event gate files
  - Symphony files (`WORKFLOW.md`, `tools/symphony/**`, `docs/runbooks/symphony.md`, Symphony package scripts, Symphony `.gitignore` changes)
- **Base SHA:** `d5aa0bfbdc2fb91b88b6ad2d14e65ad7346797ec` (current `origin/main` HEAD after PR #129 merge)
- **Status:** `in_progress`
- **Notes for the other agent:**
  - PR 7 must not reopen `ConversationalCreateUI.tsx`.
  - PR 7 is entry-point UI only and must not change AI write behavior.
  - If an entry point implies AI changes are saved automatically, stop and ask.

---

## Closed claims

### PR 6 — AI edit route wrappers

- **Branch:** `codex/ai-edit-routes-pr6`
- **Owner:** Codex
- **End SHA:** merged via PR #129 → `d5aa0bfb`
- **Status:** `merged`
- **Notes:** Added thin authenticated AI edit route wrappers for series and occurrence contexts. Existing-event writes remain disabled pending later safety gates.

### PR 5 — Prompt and interpreter contract rewrite

- **Branch:** `claude/prompt-contract-rewrite-pr5`
- **Owner:** Claude (web), Codex takeover for rebase/quality gates
- **End SHA:** merged via PR #127 → `0e49798b`
- **Status:** `merged`
- **Notes:** Prompt and interpreter contract rewrite for current event JSON, structured scope, patch-only edit semantics, ambiguity clarification, ordered image references, and one-question clarification behavior.

### PR 10 — Refresh instrumentation, debug-gated only

- **Branch:** `codex/refresh-instrumentation-pr10`
- **Owner:** Codex
- **End SHA:** merged via PR #128 → `243a6489`
- **Status:** `merged`
- **Notes:** Debug-gated instrumentation only inside `eventDraftSync.ts`; no call-site edits, no runtime behavior change when debug is off, no migrations.

### PR 2 — Server-side patch diff utility

- **Branch:** `claude/patch-diff-pr2`
- **Owner:** Claude (web)
- **End SHA:** merged via PR #126 → `992cb38c`
- **Status:** `merged`
- **Notes:** Server-side diff utility (`computePatchDiff`) using `PATCH_FIELD_REGISTRY`. No runtime call sites wired; will be consumed by PR 9 (published-event gate) and PR 11 (UI "What changed" section).

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

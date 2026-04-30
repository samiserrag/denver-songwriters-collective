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

### PR 5 — Prompt and interpreter contract rewrite

- **Branch:** `claude/prompt-contract-rewrite-pr5`
- **Owner:** Claude (web), Codex takeover for rebase/quality gates
- **Scope:** §13.2 (Sami-approved this session). Rewrite the prompt + interpreter contract surface so that:
  - current event state is passed as compact JSON, not prose
  - model output includes structured `scope: "series" | "occurrence" | "ambiguous"`; ambiguous forces server-side clarification even when a patch is also returned
  - edit-mode output is patch-only: missing fields are preserved, no field is cleared unless the user explicitly asked
  - negative ambiguity examples are baked into the system prompt
  - ordered image references with stable indices (`{ index, clientId, eventImageId?, fileName?, isCurrentCover }`) are passed every turn
  - the model is instructed to ask ONE useful question only when truly blocked
- **Single-writer locks claimed for this PR (per plan §8.2):**
  - `web/src/app/api/events/interpret/route.ts`
  - `web/src/lib/events/aiPromptContract.ts` (new prompt contract file; locked once committed)
- **Files claimed (write):**
  - `web/src/app/api/events/interpret/route.ts`
  - `web/src/lib/events/aiPromptContract.ts` (new)
  - `web/src/__tests__/aiPromptContract.test.ts` (new)
  - `docs/investigation/track1-claims.md` (this file)
- **Files referenced (read-only):**
  - `web/src/lib/events/patchFieldRegistry.ts` — field name / scope / value-kind source of truth (PR 1, merged)
  - `web/src/lib/events/interpretEventContract.ts` — base response schema; wrapped by `aiPromptContract.ts` for the new `scope` field
  - `web/src/lib/events/evals/runTrack1EvalHarness.ts` — eval harness (PR 4, merged) used to validate fixtures
- **Files locked / forbidden in this PR:**
  - `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx` (plan §8.2)
  - `web/src/lib/events/eventDraftSync.ts` (PR 10 lock)
  - any migration in `supabase/migrations/`
  - any telemetry runtime file (PR 3 scope)
- **Base SHA:** `243a6489` (current `origin/main` HEAD after PR #128 merge)
- **Status:** `awaiting_review`
- **Notes for the other agent:**
  - Field names in the patch contract reuse `patchFieldRegistry.ts` exactly (e.g. `event_date`, `start_time`, `recurrence_rule`, `cover_image_url`). No new field names are introduced.
  - The new `aiPromptContract.ts` module owns the system prompt, user prompt builder, image reference contract, scope ambiguity decision, and the response-schema augmentation that adds the required `scope` field. After this PR is committed, this file is single-writer locked per plan §8.2.
  - When `scope === "ambiguous"`, the route forces `next_action = "ask_clarification"` even if `draft_payload` is also present. The patch is preserved in the response but is gated behind a clarification turn.
  - Patch-only semantics are enforced via prompt instructions (model must omit fields the user did not change). The schema's structural required-keys list is intentionally not loosened in this PR; that is a structural patch surface that belongs to PR 9 (published-event gate). Downstream save paths still respect the existing `sanitizeInterpretDraftPayload` allowlist.
  - Image references are accepted as part of the request body (client-supplied) and threaded into the user prompt with stable indices. No new persistence path is wired in this PR.
  - Eval harness (`web/src/lib/events/evals`) is run in tests against representative fixtures. Pass/total summary is included in the PR body.

---

## Closed claims

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

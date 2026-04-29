# Track 1 Claims

## Active Claims

| Branch | Owner | Task | Files Claimed | Base SHA | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `work` | Codex | PR 4: Eval harness (no runtime behavior changes) | `docs/investigation/track1-claims.md`, `web/src/lib/events/evals/track1EvalCases.ts`, `web/src/lib/events/evals/runTrack1EvalHarness.ts`, `web/src/lib/events/evals/README.md` | `fecf5c178db086a070ad4b02879dd42036230e06` | In progress | Avoid locked interpreter/UI route files and any files claimed by Claude. |

## Completed Claims

| Branch | Owner | Task | Files | Base SHA | End SHA | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| _none yet_ |  |  |  |  |  |  |  |
# Track 1 Claims Doc

**Status:** Living
**Owner of doc:** Claude (web)
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

### PR 1 — Patch field registry + classification test

- **Branch:** `claude/patch-field-pr1-EhARj`
- **Owner:** Claude (web)
- **Scope:** Pre-approved per collaboration plan §13.1. Registry-only, no runtime behavior change, no migrations, no allowlist migration. Adds the registry module and a deterministic classification test.
- **Files claimed (write):**
  - `web/src/lib/events/patchFieldRegistry.ts`
  - `web/src/lib/events/__tests__/patchFieldRegistry.test.ts`
  - `docs/investigation/track1-claims.md` (this file)
- **Files referenced (read-only):**
  - `web/src/lib/supabase/database.types.ts` — source of truth for `events` table columns (no introspection of live DB; types are checked-in and current)
- **Base SHA:** `fecf5c178db086a070ad4b02879dd42036230e06`
- **Status:** `in_progress`
- **Notes for the other agent:**
  - The registry uses `risk_tier`, `enforcement_mode`, `verifier_auto_patchable`, `scope`, and `value_kind` per the collaboration plan §5.1.
  - Day-one enforced fields are limited to the high-risk set named in plan §5.2 (date/time, recurrence, venue/location, cover image, publish state, cancellation, deletion).
  - The registry is **not yet imported** by any runtime code in this PR. Wiring is deferred to PR 9 (published-event gate) and PR 2 (diff utility).
  - `UNCLASSIFIED_BY_DESIGN` lists columns that are not user-editable via the AI host flow (system timestamps, system-derived identifiers, ownership transfer fields, admin-only media embeds, the admin verification pair). Each entry has a justification string the test enforces is non-empty.
  - The test asserts:
    - every column in `Database["public"]["Tables"]["events"]["Row"]` is either classified or in `UNCLASSIFIED_BY_DESIGN`
    - the two sets do not overlap
    - day-one enforced fields named in plan §5.2 are present and marked `enforced` + `risk_tier: "high"`
    - every registry entry has a defined `scope` and `value_kind`
    - `UNCLASSIFIED_BY_DESIGN` justifications are non-empty
  - Compile-time guard via tuple-wrapped conditional types prevents `EVENTS_COLUMN_NAMES` from drifting from the generated `database.types.ts` row shape in either direction.

---

## Closed claims

(none yet)

---

## Out-of-scope reminders

These belong to later PRs and must not be touched in PR 1:

- runtime use of the registry (PRs 2, 9)
- prompt or interpreter contract rewrite (PR 5, requires Sami approval)
- AI edit routes (PR 6, requires Sami approval)
- entry-point UI (PR 7, requires Sami approval)
- venue / image edit wiring (PR 8, requires Sami approval)
- published-event gate behavior (PR 9, requires Sami approval)
- telemetry runtime changes (PR 3, requires Sami approval)

If PR 1 needs anything from the list above, stop and open a draft PR with the question per collaboration plan §13.4.

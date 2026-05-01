# Track 1 Claims Doc

**Status:** Living
**Last updated:** 2026-05-01

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

### PR 11 — Track 1 UI polish

- **Branch:** `claude/ui-polish-pr11`
- **Owner:** Claude (web)
- **Base SHA:** `482e7547b67f0500dd3ee22ffc18ed52bd537359`
- **Status:** `in_progress`
- **Files claimed:**
  - `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx` (§8.2 lock released for UI polish only)
  - `web/src/app/(protected)/dashboard/my-events/_components/WhatChanged.tsx` (new)
  - `web/src/__tests__/conversational-create-ui-pr11-polish.test.ts` (new)
  - `web/src/__tests__/what-changed-component.test.ts` (new)
  - `docs/investigation/track1-claims.md`
- **Notes:** Final §6 Track 1 PR. Five sub-goals: distinct result vs follow-up visual treatment, "What changed" section consuming `computePatchDiff`, orange draft-preview CTA via canonical `btn-accent` token, calmer waiting state (drop amber ring + element-level animate-pulse), copy audit reflecting create + edit capabilities. No behavior changes — UI polish only. Existing tests (PR 3 follow-up + interpreter-lab-conversation-ux + interpreter-host-draft-sync + conversational-create-launch-surface) must remain green. Closes Track 1 §12 definition of done.

### Coordinator sync — track1-claims.md cleanup after PR #143, #148 merge

- **Branch:** `claude/coordinator-sync-after-148`
- **Owner:** Coordinator
- **Base SHA:** `30dd7e2` (post-#148 main)
- **Status:** `in_progress`
- **Files claimed:**
  - `docs/investigation/track1-claims.md`
- **Notes:** Coordinator-only docs maintenance. Moves the prior Coordinator-sync entry (merged via #143) and the PR 3 follow-up entry (merged via #148) from Active to Closed. Self-claims `docs/investigation/track1-claims.md` so the Track 1 guardrail in `web/src/__tests__/event-detail-type-badges.test.ts` is satisfied. This PR's own Coordinator-sync entry will be moved to Closed by the next coordinator sync after this PR merges. Track 1 PR 3 stack is now fully shipped end-to-end (module #142 → server wiring #146 → client hook + endpoint + comment refinement #148).

Next planned Track 1 order: PR 11 (UI polish, Codex) — only remaining §6 PR. §13.2 explicit Sami approval required before any code is written.

PR 8 venue requirement clarification from Sami:

- The AI event assistant must be able to enrich and persist full venue/location details, not only echo user-provided venue text.
- When venue details are missing or uncertain, it should use the existing web-search / Google Maps / geocoding surfaces to verify likely public facts before asking the user. Ask one targeted question only when search cannot confidently verify the publish-critical field.
- Required write surface to investigate/wire includes canonical venue fields where authorized (`name`, `address`, `city`, `state`, `zip`, `phone`, `website_url`, `google_maps_url` / `map_link`, `latitude`, `longitude`) and custom event location fields when no canonical venue is appropriate (`custom_location_name`, `custom_address`, `custom_city`, `custom_state`, `custom_latitude`, `custom_longitude`, `location_notes`).
- The visible Edit Venue fields are explicit PR 8 acceptance criteria: venue name, street address, city, state, ZIP, phone, website URL, and Google Maps URL should all be filled when confidently discoverable from public sources; coordinates should be populated through the existing maps/geocoding path for map use.
- Do not let the assistant claim that ZIP, Maps link, or coordinates were applied unless those values are actually present in the writable payload and persisted. Add tests for the Echo & Ember-style failure where ZIP was verified online but did not land in the form/database.
- `geocode_source` / `geocoded_at` remain system-managed via the existing geocoding pipeline unless PR 8 investigation proves a different approved path is needed.

---

## Closed claims

### PR 3 follow-up — Client userOutcome capture with turnId correlation

- **Branch:** `codex/telemetry-user-outcome-pr3uo`
- **Owner:** Codex
- **End SHA:** merged via PR #148 → `30dd7e2`
- **Status:** `merged`
- **Notes:** Plan A end-to-end. Added UUIDv4 `turnId` to `EditTurnTelemetryEvent`, new minimal `EditTurnOutcomeEvent` type with `[edit-turn-outcome]` log prefix, thin authenticated `POST /api/events/telemetry/edit-turn` endpoint (no DB I/O), and client-side fire-and-forget hook in `ConversationalCreateUI.tsx` that captures editTurnId from interpret + my-events PATCH responses and posts on user-confirmed accept. Refined the my-events `blockedFields` comment to clarify success-path semantics. Reject UX intentionally not wired — helper supports both outcomes; no current UI gesture fires `rejected`. Track 1 PR 3 stack now fully shipped end-to-end (module #142 → server wiring #146 → this PR #148).

### Coordinator sync — track1-claims.md cleanup after PR #142, #145, #146, #147 merge wave

- **Branch:** `claude/review-agents-coordinator-ONuKT`
- **Owner:** Coordinator
- **End SHA:** merged via PR #143 → `e84fb44b`
- **Status:** `merged`
- **Notes:** Coordinator-only docs maintenance. Moved four stale Active entries (PR 3-wiring via #146, PR 3 module via #142, Interpreter today-date via #140, PR 9 via #139) plus the long-merged PR 8 (#135) from Active to Closed. Self-claimed track1-claims.md so the Track 1 guardrail test passed. Established the recursive coordinator-sync pattern: each coordinator PR self-claims the file in Active, the next coordinator PR moves that entry to Closed.

### PR 3-wiring — Server-side telemetry emission at edit-turn call sites

- **Branch:** `codex/telemetry-edit-turns-wiring-pr3w`
- **Owner:** Codex
- **End SHA:** merged via PR #146 → `f8e2c06f`
- **Status:** `merged`
- **Notes:** Wired PR 3 telemetry module into two server call sites (`interpret/route.ts`, `my-events/[id]/route.ts`). console.info sink already routes to Axiom via Vercel drain. No UI edits, no behavior changes. blockedFields semantic-divergence comments added at each emit site. ConversationalCreateUI.tsx + publishedRiskConfirmation.ts deferred to follow-up PRs (B1 turnId in flight; B2 client + endpoint planned).

### PR 3 — Edit-turn telemetry schema + emitter module (no wiring)

- **Branch:** `codex/telemetry-edit-turns-pr3`
- **Owner:** Codex
- **End SHA:** merged via PR #142 → `8b346d6f`
- **Status:** `merged`
- **Notes:** Schema, builder, emitter, and `hashPriorState` helper. Type-only imports of `RiskTier` / `EnforcementMode` from `patchFieldRegistry` keep the registry as single source of truth. console.info sink with `[edit-turn-telemetry]` prefix; production sink + call-site wiring landed via PR 3-wiring (#146). 21 unit tests in `edit-turn-telemetry.test.ts`. PR 1 + PR 9 suites green at merge — zero coupling.

### Interpreter today-date rollover fix (P1)

- **Branch:** `codex/interpreter-today-date-fix`
- **Owner:** Codex
- **End SHA:** merged via PR #140 → `910f6007`
- **Status:** `merged`
- **Notes:** Fixes off-by-one in `nextFutureMonthDayDate` so today's date is a valid future occurrence; tightens interpret prompt date rules and adds `applyOverEagerFutureYearPullback` postprocessor guard for LLM over-eager future-year picks. Follow-up PR #141 updated a phase9-reliability test assertion to match the reworded prompt string.

### PR 9 — Published-event gate for AI edits

- **Branch:** `codex/implement-published-event-gate-for-ai-edits`
- **Owner:** Codex
- **End SHA:** merged via PR #139 → `248be7dc`
- **Status:** `merged`
- **Notes:** Server-side gate on `/api/my-events/[id]` PATCH path for published high-risk AI auto-apply writes with explicit confirmation retry; extracted `parseAiWriteMetadata` and `canSendExplicitConfirmation` helpers with behavior-level test coverage. Preserves PR 8 venue/image behavior and `allowExistingEventWrites={false}` semantics.

### PR 8 — Venue resolution and image reference contract

- **Branch:** `codex/venue-image-pr8`
- **Owner:** Codex
- **End SHA:** merged via PR #135 → `518b36bb`
- **Status:** `merged`
- **Notes:** Wires existing venue resolver into edit-mode AI writes; passes ordered image references each turn so cover switching resolves deterministically; persists canonical venue + custom-location fields when confidently discoverable.

### PR 7 — AI edit entry points and copy

- **Branch:** `codex/ai-edit-entry-points-pr7`
- **Owner:** Codex
- **End SHA:** merged via PR #131 → `3e83b6c6`
- **Status:** `merged`
- **Notes:** Added entry links/buttons into the PR 6 AI edit routes from event detail, EventForm edit contexts, and occurrence rows. No `ConversationalCreateUI.tsx` edits and no AI write/apply behavior changes.

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

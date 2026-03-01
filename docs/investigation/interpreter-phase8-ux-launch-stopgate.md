# Stop-Gate Track: Interpreter UX Productization + Launch Gating (INTERPRETER-09)

**Date:** 2026-02-28  
**Status:** APPROVED — PRODUCTION VERIFIED (2026-03-01)  
**Parent tract:** `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective/docs/investigation/interpreter-image-extraction-stopgate.md` (Phases 0-7 production-verified)

---

## 1) Goals and Context

The interpreter pipeline is now functionally stable in production, including the two prior blockers:
- multi-turn context loss,
- wrong venue substitution.

Remaining work is primarily UX quality and host confidence. The current interface (`/dashboard/my-events/interpreter-lab`) is still a hidden test surface and exposes raw JSON.  

You requested this exact execution order:
1. correctness item (`INTERPRETER-08`), then  
2. conversation UX improvements,  
3. clarification UX improvements,  
4. post-create confidence UX,  
5. only after all above pass, promote to public host-facing launch surface.

This stop-gate follows that order.

---

## 2) Scope Order (Approved Sequence)

### Phase 8A — Correctness Normalization (`INTERPRETER-08`)  **[must ship first]**

Fix transient inconsistency where `series_mode='single'` can appear while recurring `recurrence_rule` is already present in early clarify turns.

Required behavior:
- If `draft_payload.recurrence_rule` is non-null and structurally recurring, normalize `series_mode` to recurring value in the same turn.
- Never regress recurrence safety guard (single-event prompts must still remain single).

### Phase 8B — Conversation UX (no launch yet)

Within current lab/host surface:
- make human-readable guidance primary,
- demote raw JSON to collapsible debug section,
- always show clear current state: `next_action`, missing fields, and draft summary.

### Phase 8C — Clarification UX (single-question-first)

- Keep one clear blocking question visible.
- Show field-specific input hint chips (date, time, venue, URL format).
- Avoid “dead-end” feel after submit; retain a clear “what to do next” callout.

### Phase 8D — Post-Create Confidence UX

After create:
- explicit write summary (“What was written”),
- recurrence/location/signup/cover confirmation list,
- strong next actions: open draft, publish path, edit recurrence path.

### Phase 8E — Public Launch Surface (done last)

Only after 8A–8D pass smoke:
- move from hidden debug lab to intentional host-facing entrypoint,
- keep feature-flag controlled rollout,
- preserve fallback to classic form.

---

## 3) Non-Goals (for this stop-gate)

1. No schema migrations required by default.
2. No changes to core event write authorization model.
3. No autonomous writes by the interpreter route.
4. No removal of existing form flow until rollout proves stable.

---

## 4) Risks and Coupling Critique

1. **Correctness drift risk (blocking):** UX refactors can accidentally bypass hardening guards (`locked_draft`, venue normalization, maps stripping, signup normalization).
2. **Write confidence risk (blocking):** if success/error states are ambiguous, hosts may duplicate submissions.
3. **Launch regression risk (blocking):** exposing too early without guardrails could increase bad drafts and reduce trust.
4. **Coupling surfaces:**
   - `/api/events/interpret` response contract,
   - `/api/my-events` create mapping in interpreter UI,
   - recurrence/venue hardening helpers in `interpreterPostprocess.ts`,
   - host navigation entrypoints and feature flags.

---

## 5) Acceptance Criteria

### 5.1 Phase 8A (correctness)

1. New fixture(s) prove `series_mode` is deterministic when recurring RRULE exists.
2. Safety-critical fixtures remain green.
3. No regression in A/D smoke scenarios from 2026-02-28.

### 5.2 Phase 8B–8D (UX productization)

1. User can complete a multi-turn create flow without reading JSON.
2. Each clarification turn shows one actionable prompt and expected input format.
3. After create, user sees a concise write summary and clear next CTA links.
4. No duplicate create from ambiguous button state.

### 5.3 Phase 8E (launch readiness)

1. Feature flags are explicitly defined and documented:
   - `NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY` (host-facing entrypoint visibility),
   - `NEXT_PUBLIC_ENABLE_INTERPRETER_LAB_WRITES` (existing write controls retained for fallback/testing).
2. Routing decision location is explicit and implemented behind flag:
   - host entrypoint from dashboard/new-event action lives in `/dashboard/my-events/new` surface wiring,
   - fallback link to classic form remains visible.
3. Fallback form remains available even when conversational entrypoint is enabled.
4. Production smoke + Axiom checks show no elevated error rate.

---

## 6) Test + Smoke Plan

## 6.1 Automated

1. Extend fixture suite for `INTERPRETER-08` normalization.
2. Add UI assertions for:
   - non-JSON-primary layout,
   - clarification prompt rendering,
   - post-create summary/CTA block.
3. Preserve existing interpreter contract tests and create-write tests.

## 6.2 Manual (Claude in Chrome)

1. Re-run Case A and D multi-turn flows.
2. Confirm no raw JSON dependency for successful create.
3. Confirm create success state includes:
   - event ID,
   - recurrence/location/signup/cover summary,
   - Open Draft + Publish path link.
4. Confirm fallback form path remains available from host dashboard.
5. Mobile viewport smoke (iPhone 12 and small Android width):
   - conversational entrypoint visible and tappable,
   - clarification prompt readable without horizontal scrolling,
   - confirm/create CTAs visible and reachable,
   - post-create summary and next links usable on mobile.

---

## 7) Rollout and Rollback

### Rollout
1. Ship 8A–8D behind existing lab write flag and new UX flag.
2. Smoke test production with admin session + realistic host script.
3. Enable public entrypoint for limited cohort.

### Rollback
1. Disable new UX flag and public entrypoint flag.
2. Keep interpreter API running for lab verification.
3. Route hosts back to classic form only.

---

## 8) Repo Execution Prompt (copy/paste)

```md
You are implementing INTERPRETER-09 (Phase 8 UX Productization + Launch Gating).

Hard constraints:
- Keep interpreter architecture unchanged: AI interprets, server decides.
- No direct DB writes from `/api/events/interpret`.
- Preserve all existing hardening guards from Phases 0-7.
- No launch-surface promotion until Phases 8A–8D pass.

Execution order is mandatory:

## Phase 8A — INTERPRETER-08 correctness fix
1) Add deterministic normalization so if `draft_payload.recurrence_rule` is recurring and non-null, `series_mode` cannot remain `single` in the same response turn.
2) Add fixture regression coverage for this case.
3) Ensure all safety-critical fixtures remain passing.

## Phase 8B — Conversation UX
1) Make human-readable assistant guidance primary in the interpreter UI.
2) Keep raw JSON available only in a collapsible debug panel.
3) Show clear draft state block: next action, missing fields, summary.

## Phase 8C — Clarification UX
1) Keep one blocking question visible with format hints.
2) Add quick helper hints for date/time/url/venue answers.
3) Ensure follow-up action is obvious after each run.

## Phase 8D — Post-create confidence UX
1) Add “What was written” summary after create:
   - title, recurrence, start date/time, location, signup mode, cover status.
2) Add explicit CTA links:
   - Open Draft
   - Go to My Happenings Drafts
   - Publish path entry
3) Prevent duplicate submit ambiguity (clear creating/success states).

## Phase 8E — launch prep only (no full launch in same patch unless explicitly approved)
1) Add host-facing entrypoint wiring behind dedicated feature flag `NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY`.
2) Keep classic form available as fallback and wire explicit fallback link on the same screen.
3) Document where routing decision lives (dashboard/new-event entry surface) and rollout + rollback switches in docs.

Deliverables:
- Updated code + tests
- Updated docs/SMOKE-PROD.md with Phase 8 checks
- Updated stop-gate with implementation evidence
- Final report with changed files, test output, and any residual risks
```

---

## 9) Implementation Evidence

### Phase 8A (INTERPRETER-08) — IMPLEMENTED 2026-02-28

**Summary:** Deterministic `series_mode ↔ recurrence_rule` normalization added.

**Changed files:**
| File | Change |
|------|--------|
| `web/src/lib/events/interpreterPostprocess.ts` | Added `normalizeSeriesModeConsistency()` — if `recurrence_rule` matches `FREQ=DAILY/WEEKLY/MONTHLY/YEARLY` and `series_mode` is missing or `"single"`, promotes to `"recurring"`. |
| `web/src/app/api/events/interpret/route.ts` | Imported + called `normalizeSeriesModeConsistency(sanitizedDraft)` after `mergeLockedCreateDraft` + location normalization, before `pruneSatisfiedBlockingFields`. Runs for all modes (create + edit_series). |
| `web/src/__tests__/interpreter-fixture-regression.test.ts` | Imported + called in fixture pipeline at step 6c. Added `recurrence_rule_must_not_be_null` assertion. |
| `web/src/__fixtures__/interpreter/phase7-cases.json` | Added F24 (safety-critical: recurring RRULE + single → normalized to recurring) and F25 (single + null rule → stays single). `safety_critical_ids` updated. |
| `docs/SMOKE-PROD.md` | Added §24 — Phase 8A smoke checks (3 scenarios). |

**Ordering constraint (critical):** Normalization runs AFTER:
1. `hardenDraftForCreateEdit` (recurrence intent guard — may intentionally clear both fields),
2. `mergeLockedCreateDraft` (may restore recurrence from prior-turn context).

This prevents re-enabling recurrence that was intentionally downgraded by the recurrence intent guard.

**Test results (2026-02-28):**
- Fixture regression: 27/27 pass (25 fixtures + 2 summary tests)
- Safety-critical: 10/10 pass (F03, F04, F07, F08, F12, F16, F21, F22, F23, F24)
- Contract tests: 25/25 pass
- ESLint: clean

**Residual risks:** None identified. The normalization is additive and cannot regress single-event behavior (F25 proves the null-rule case is a no-op).

### Phase 8B (Conversation UX) — IMPLEMENTED 2026-02-28

**Summary:** Made human-readable guidance primary; raw JSON demoted to collapsible debug panel; added draft state summary block.

**Changed files:**
| File | Change |
|------|--------|
| `web/src/app/(protected)/dashboard/my-events/interpreter-lab/page.tsx` | **UI restructured**: (1) "What Happens Next" section enhanced with `next_action` status badge (color-coded: amber=clarification, blue=preview, green=done), confidence %, quality hints display. (2) Clarification prompt in styled container with instructions. (3) New "Draft Summary" section with grid layout showing extracted fields (title, type, date, time, venue, recurrence, signup, cost, etc.) — truncates description at 120 chars. (4) Raw JSON wrapped in `<details>` collapsible labeled "Debug: Raw API Response". (5) `ResponseGuidance` type expanded to include `confidence`, `draft_payload`, `quality_hints`. (6) Added `Fragment` import + `QualityHint` interface. |
| `web/src/__tests__/interpreter-lab-conversation-ux.test.ts` | **New test file**: 26 source-code assertions across 5 groups — (A) human-readable guidance is primary, (B) raw JSON is collapsible, (C) draft summary block, (D) ResponseGuidance type expansion, (E) existing functionality preserved. |

**UX behavior changes:**
| Aspect | Before (Phase 7) | After (Phase 8B) |
|--------|-------------------|-------------------|
| Primary display | Raw JSON (`Response` section always visible) | Human-readable guidance ("What Happens Next" + "Draft Summary") |
| next_action | Shown in guidance text only | Color-coded badge + text explanation |
| Confidence | Not shown | Percentage displayed next to badge |
| Draft fields | Only visible in raw JSON | Grid summary with labeled rows |
| Quality hints | Hidden in JSON | Dedicated "Suggestions" section |
| Clarification prompt | Plain text | Styled amber container with instructions |
| Ready state | Minimal text | Green container with clear CTA reference |
| Raw JSON | Always visible, full card | Collapsed `<details>` labeled "Debug: Raw API Response" |
| Conversation history | Unchanged | Unchanged |
| Create/Cover actions | Unchanged | Unchanged |

**What was NOT changed (Phase 8B boundary):**
- No server-side changes (route.ts, interpreterPostprocess.ts untouched)
- No feature flag changes
- No create/edit flow logic changes
- No image staging changes
- All Phase 4A/4B/7/8A functionality preserved

**Test results (2026-02-28):**
- Phase 8B tests: 26/26 pass
- Phase 4B create-write tests: 50/50 pass
- Phase 4A cover-apply tests: 25/25 pass
- Fixture regression: 27/27 pass (10/10 safety-critical)
- Contract tests: 14/14 pass
- ESLint: clean

**Residual risks:**
- Draft Summary shows raw field names (e.g. `series_mode`, `recurrence_rule`). Phase 8C will improve label friendliness with input hint chips.
- No mobile-specific testing done yet — deferred to Phase 8E manual smoke.

### Phase 8C (Clarification UX) — IMPLEMENTED 2026-02-28

**Summary:** Single-question-first presentation with field-specific input hint chips and clear follow-up instruction callout.

**Changed files:**
| File | Change |
|------|--------|
| `web/src/app/(protected)/dashboard/my-events/interpreter-lab/page.tsx` | **Clarification UX enhanced**: (1) Added `FIELD_INPUT_HINTS` static mapping — 15 field types with human labels + format examples (time, date, venue, URL, title, event_type, capacity, cost, etc.). (2) Added `getFieldHint(field)` helper returning label + examples or null. (3) Replaced clarification prompt section: removed "Question:" label prefix, renders `clarification_question` directly with `leading-relaxed`, maps `blocking_fields` to styled amber hint chips with example values (`e.g. 7:00 PM, 18:30`), unknown fields fall back to humanized field name. (4) Added "→" next-step callout with border separator instructing "Type your answer above, then click Run Interpreter". |
| `web/src/__tests__/interpreter-lab-clarification-ux.test.ts` | **New test file**: 25 source-code assertions across 5 groups — (A) field-specific input hint chips (8 tests), (B) hint chip rendering per blocking field (5 tests), (C) single-question-first presentation (3 tests), (D) follow-up instruction callout (3 tests), (E) existing 8A/8B functionality preserved (6 tests). |
| `web/src/__tests__/interpreter-lab-conversation-ux.test.ts` | **Updated**: Changed assertion from `"Reply in the message box above"` to `"Type your answer above"` to match 8C instruction text change. |

**UX behavior changes:**
| Aspect | Before (Phase 8B) | After (Phase 8C) |
|--------|-------------------|-------------------|
| Clarification question | Prefixed with "Question:" label in styled container | Direct question text, no label prefix, `leading-relaxed` spacing |
| Missing field hints | No format hints shown | Amber chips per blocking field with label + examples (e.g. "Date: e.g. 2026-03-15, March 15, next Tuesday") |
| Unknown fields | Not shown | Humanized field name shown (underscores → spaces) |
| Follow-up instruction | "Reply in the message box above" generic text | "→ Type your answer above, then click Run Interpreter" with border separator |
| Fallback text | None | "Please provide the missing details." when clarification_question is null |

**What was NOT changed (Phase 8C boundary):**
- No server-side changes (route.ts, interpreterPostprocess.ts untouched)
- No feature flag changes
- No create/edit flow logic changes
- No image staging changes
- All Phase 8A/8B functionality preserved (badge, confidence, summary, debug panel, draft summary)

**Test results (2026-02-28):**
- Phase 8C tests: 25/25 pass
- Phase 8B tests: 26/26 pass (1 assertion updated for 8C text change)
- Phase 4B create-write tests: 50/50 pass
- Phase 4A cover-apply tests: 25/25 pass
- Fixture regression: 27/27 pass (10/10 safety-critical)
- ESLint: clean

**Residual risks:**
- Hint examples are hardcoded; if new field types are added to the interpreter schema, `FIELD_INPUT_HINTS` needs manual update. Fallback to humanized field name mitigates unknown fields.
- No mobile-specific testing done yet — deferred to Phase 8E manual smoke.

### Phase 8D (Post-Create Confidence UX) — IMPLEMENTED 2026-02-28

**Summary:** Rich post-create "What Was Written" summary block, strong next-action CTAs, duplicate-submit prevention.

**Changed files:**
| File | Change |
|------|--------|
| `web/src/app/(protected)/dashboard/my-events/interpreter-lab/page.tsx` | **Post-create UX overhaul**: (1) Added `CreatedEventSummary` interface with 15 fields (eventId, slug, title, eventType, startDate, startTime, endTime, seriesMode, recurrenceRule, locationMode, venueName, signupMode, costLabel, hasCover, coverNote). (2) Added `buildCreatedEventSummary()` helper that snapshots draft_payload at create time. (3) Added `createdSummary` state, populated at every create exit path (success, warning, cover partial). (4) Replaced minimal text + small links with full emerald confidence block: checkmark header "Event Created as Draft", "What Was Written" grid (title, type, date, time, recurrence, location, signup, cost, cover status), three CTAs (Open Draft →, Go to My Happenings, Edit & Publish). (5) Duplicate-submit prevention: "Confirm & Create" button hidden when `createdEventId` is set. (6) Simplified `createMessage.text` to short status line — details moved to structured summary. (7) `createdSummary` cleared on mode change, staged image change, and clear history. (8) Legacy fallback links preserved for edge case where `createdEventId` exists without summary. |
| `web/src/__tests__/interpreter-lab-post-create-ux.test.ts` | **New test file**: 35 source-code assertions across 5 groups — (A) CreatedEventSummary type + builder (4 tests), (B) What Was Written summary block (12 tests), (C) next-action CTAs (6 tests), (D) duplicate submit prevention (4 tests), (E) existing 8A/8B/8C preserved (9 tests). |
| `web/src/__tests__/interpreter-lab-create-write.test.ts` | **Updated**: 2 assertions updated to match 8D simplified message text (cover upload warning + success without cover). |

**UX behavior changes:**
| Aspect | Before (Phase 4B) | After (Phase 8D) |
|--------|-------------------|-------------------|
| Success display | Single text line: "Event created as draft (abc123…, slug: xyz). Publish it from My Happenings when ready." | Emerald confidence block with "✓ Event Created as Draft" header |
| What was written | Not shown — only raw event ID in message | Full grid: title, type, date, time, recurrence, location, signup, cost, cover status |
| Next actions | Two small underlined links (Open Draft, Drafts tab) | Three styled CTAs: "Open Draft →" (primary emerald), "Go to My Happenings", "Edit & Publish" |
| Duplicate prevention | Button stays visible after create (only `disabled` during `isCreating`) | Button hidden entirely after `createdEventId` is set |
| Warning details | Inline in message text (e.g. "cover upload failed: [error]") | Short status line + structured `coverNote` in summary |
| Cover status | Not shown explicitly | "✓ Attached" or "None" with optional note |

**What was NOT changed (Phase 8D boundary):**
- No server-side changes (route.ts, interpreterPostprocess.ts untouched)
- No feature flag changes
- No launch-surface promotion (8E deferred)
- All Phase 8A/8B/8C UI elements preserved
- Create API call logic unchanged
- Cover upload/assignment logic unchanged

**Test results (2026-02-28):**
- Phase 8D tests: 35/35 pass
- Phase 8C tests: 25/25 pass
- Phase 8B tests: 26/26 pass
- Phase 4B create-write tests: 50/50 pass (2 assertions updated for 8D message text)
- Phase 4A cover-apply tests: 25/25 pass
- Fixture regression: 27/27 pass (10/10 safety-critical)
- ESLint: clean

**Residual risks:**
- Post-create summary shows `recurrenceRule` as raw RRULE string (e.g. `FREQ=WEEKLY;BYDAY=TU`). A human-friendly translation could improve readability but is not in scope for 8D.
- No mobile-specific testing done yet — deferred to Phase 8E manual smoke.
- "Edit & Publish" CTA links to the same event detail page as "Open Draft" — publish is a manual action from there. This is intentional (no separate publish endpoint exists).

### Phase 8E (Public Launch Surface) — IMPLEMENTED 2026-02-28

**Summary:** Promoted conversational create to host-facing entrypoint behind `NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY` flag. Extracted shared `ConversationalCreateUI` component with `variant: "lab" | "host"` prop. Host variant forces create mode, decouples writes from lab flag, removes debug UI. Added server-guarded route with redirect fallback and flag-gated chooser on launcher.

**Changed files:**
| File | Change |
|------|--------|
| `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx` | **New**: Extracted client component (~1750 lines) from interpreter lab page. Added `ConversationalCreateVariant` type, `variant` prop (default `"lab"`). Host variant: `isHostVariant` computed, `writesEnabled = isHostVariant \|\| LAB_WRITES_ENABLED`, `effectiveMode: InterpretMode = isHostVariant ? "create" : mode`. Host UI: "Create Happening" title, no debug panel, no mode selector, no eventId/dateKey inputs, "← Use classic form instead" link, host-friendly placeholder. Both named and default exports. |
| `web/src/app/(protected)/dashboard/my-events/interpreter-lab/page.tsx` | **Simplified**: Thin wrapper — imports `ConversationalCreateUI` and renders with `variant="lab"`. Under 10 lines. |
| `web/src/app/(protected)/dashboard/my-events/new/conversational/page.tsx` | **New**: Server component. Reads `NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY`, redirects to `/dashboard/my-events/new?classic=true` when flag off. Renders `ConversationalCreateUI variant="host"` when flag on. |
| `web/src/app/(protected)/dashboard/my-events/new/page.tsx` | **Modified**: Added `CONVERSATIONAL_CREATE_ENABLED` flag check, `searchParams.classic` handling, `showChooser` computed. Flag ON + no `?classic`: shows "✨ Create with AI" and "Use classic form" chooser cards above `EventForm`. Flag OFF or `?classic=true`: classic form only. |
| `web/src/__tests__/conversational-create-launch-surface.test.ts` | **New**: 30 source-code assertions across 7 groups — (A) variant prop + exports, (B) host copy removal, (C) write decoupling, (D) effectiveMode enforcement, (E) conversational route flag guard, (F) launcher chooser, (G) lab page thin wrapper. |
| `web/src/__tests__/interpreter-lab-cover-apply.test.ts` | **Updated**: `isEditMode` assertion updated to use `effectiveMode` instead of `mode`. |
| `web/src/__tests__/interpreter-lab-conversation-ux.test.ts` | **Updated**: Path repointed to `ConversationalCreateUI.tsx`. |
| `web/src/__tests__/interpreter-lab-clarification-ux.test.ts` | **Updated**: Path repointed to `ConversationalCreateUI.tsx`. |
| `web/src/__tests__/interpreter-lab-post-create-ux.test.ts` | **Updated**: Path repointed to `ConversationalCreateUI.tsx`. |
| `web/src/__tests__/interpreter-lab-create-write.test.ts` | **Updated**: Path repointed to `ConversationalCreateUI.tsx`. |
| `web/src/__tests__/interpret-venue-resolution.test.ts` | **Updated**: Path repointed to `ConversationalCreateUI.tsx`. |
| `docs/SMOKE-PROD.md` | Added §27 — Phase 8E smoke checks (7 scenarios: flag ON/OFF, chooser, redirect, forced classic, mobile, rollback). |

**Key architectural decisions:**
1. **effectiveMode pattern**: Host variant forces `effectiveMode = "create"` at logic level, not just UI. All submit payload construction, eventId gating, dateKey gating, and locked_draft logic use `effectiveMode`.
2. **writesEnabled decoupling**: `writesEnabled = isHostVariant || LAB_WRITES_ENABLED` — host variant creates without lab write flag.
3. **Route-level flag guard**: Server component redirects when flag off — no client-side flash.
4. **URL-driven fallback**: `?classic=true` query param suppresses chooser (no local state toggles).
5. **Mechanical extraction first**: Component extracted and all tests verified passing before any behavioral changes.

**Rollout:**
1. Set `NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY=true` in Vercel env.
2. Redeploy.
3. Verify launcher shows chooser, conversational page renders host variant.

**Rollback:**
1. Remove or set `NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY=false`.
2. Redeploy.
3. Launcher reverts to classic-only. Conversational route redirects to classic.

**Test results (2026-02-28):**
- Phase 8E launch surface tests: 30/30 pass
- Phase 8D post-create tests: 35/35 pass
- Phase 8C clarification tests: 25/25 pass
- Phase 8B conversation tests: 26/26 pass
- Phase 4B create-write tests: 50/50 pass
- Phase 4A cover-apply tests: 25/25 pass
- Venue resolution tests: 30/30 pass
- Fixture regression: 27/27 pass (10/10 safety-critical)
- Full suite: 200/200 files, 4468/4468 tests pass
- ESLint: clean

**Production smoke results (2026-02-28):**
- Smoke 27a: Flag ON → chooser visible with "✨ Create with AI" + "Use classic form" cards ✅
- Smoke 27b: Conversational page → "Create Happening" title, host subtitle, fallback link, interpreter input, Run button ✅
- Smoke 27e: `?classic=true` with flag ON → classic form only, no chooser ✅
- Smoke 27f: Mobile CSS verified — `grid-cols-1 sm:grid-cols-2` stacks chooser cards below 640px ✅
- Smoke 27g: Rollback — flags set to false → launcher classic-only, `/new/conversational` redirects to `?classic=true` ✅
- Fallback link: "← Use classic form instead" navigates to `?classic=true` ✅

**Residual risks:**
- Conversational create page is a client component; initial load may be heavier than classic form for users on slow connections.

---

## 10) Approval Gates

1. Approve 8A first patch before any UX launch-facing changes.
2. Approve 8B–8D patch bundle after smoke.
3. Approve 8E host-facing entrypoint promotion after production smoke and Axiom review.

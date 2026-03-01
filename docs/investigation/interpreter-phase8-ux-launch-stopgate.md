# Stop-Gate Track: Interpreter UX Productization + Launch Gating (INTERPRETER-09)

**Date:** 2026-02-28  
**Status:** AWAITING APPROVAL  
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

## 9) Approval Gates

1. Approve 8A first patch before any UX launch-facing changes.
2. Approve 8B–8D patch bundle after smoke.
3. Approve 8E host-facing entrypoint promotion after production smoke and Axiom review.

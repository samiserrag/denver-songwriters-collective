# Phase 8F Investigation: AI Create Draft Visibility Clarity

**Date:** March 17, 2026  
**Status:** Executed after approval  
**Owner:** Repo executor  
**Scope:** Conversational create host flow clarity around draft-vs-public state

---

## 1) Question

Could hosts be misunderstanding the conversational (AI) create workflow and assuming created events are public, when they are actually drafts until explicitly published?

---

## 2) Evidence

### A) Specific incident (`peace-potluck-and-show`) likely not created via AI

Production runtime logs for event `1524c21c-37b5-4e6c-baa4-0fb79462315f` show:

- `POST /api/my-events` succeeded at `2026-03-17T08:04:54Z`
- Server log emitted `traceId: null`

`trace_id` is the conversational-create telemetry correlator:

- `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx:1361` always includes `trace_id` in AI create requests.
- `web/src/app/api/my-events/route.ts:339-343` parses and validates `body.trace_id`.
- `web/src/app/api/my-events/route.ts:736` logs `traceId`.

Inference: this specific event was almost certainly created through the classic form path, not AI create.

### B) Around that creation window, no interpreter writes observed

Axiom query window `2026-03-17T07:55:00Z` to `2026-03-17T08:20:00Z`:

- no `/api/events/interpret` requests found
- `/api/my-events` create log present with `traceId: null`

There were earlier GETs to `/dashboard/my-events/new/conversational`, but no matching interpret API activity during the creation window.

---

## 3) Current Conversational UX Audit (Host Variant)

### Strengths already present

- Post-create confirmation card clearly says **"Event Created as Draft"**:
  - `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx:1849`
- Post-create CTAs include **Open Draft** and **Edit & Publish**:
  - `.../ConversationalCreateUI.tsx:1930`
  - `.../ConversationalCreateUI.tsx:1942`
- Interpreter "ready" state uses draft language:
  - `.../ConversationalCreateUI.tsx:2045`

### Clarity gaps

1. Entry chooser copy implies completion, not draft:
   - `web/src/app/(protected)/dashboard/my-events/new/page.tsx:73`
   - text: "we'll set it up for you."

2. Host AI page header does not state draft-only/public gating:
   - `.../ConversationalCreateUI.tsx:1557`
   - text explains draft generation steps, but not "not public until publish".

3. Primary write CTA text is ambiguous:
   - `.../ConversationalCreateUI.tsx:1763`
   - button says **"Confirm & Create"** (not "Create Draft").

4. Ready-state helper text does not mention publish requirement:
   - `.../ConversationalCreateUI.tsx:2047`
   - text: "Click Confirm & Create below to save."

5. "Go to My Happenings" CTA does not hint Drafts tab context:
   - `.../ConversationalCreateUI.tsx:1936`

---

## 4) Risk and Coupling Critique

### Risks

1. **Correctness / user expectation risk (non-blocking):**  
   Ambiguous copy can cause hosts to assume "created" means "public now".

2. **Support load risk (non-blocking):**  
   Increased "why is my event not public?" tickets from AI-first users.

3. **Trust risk (non-blocking):**  
   If draft behavior is not explicit, users may perceive hidden system behavior.

### Coupling

- Changes are low-coupling copy/UI-only in:
  - `web/src/app/(protected)/dashboard/my-events/new/page.tsx`
  - `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx`
- No schema/API contract changes required.
- No behavior changes required (draft-on-create remains correct and enforced server-side):
  - `web/src/app/api/my-events/route.ts:689-693`

### Rollback

- Revert the two UI files above (single commit rollback).

---

## 5) Recommended Deltas (Optimal)

## Delta 1 (P0): Make draft/public rule explicit at AI entry

- Update chooser card text to:
  - "Creates a draft first. You publish when ready."
- File: `web/src/app/(protected)/dashboard/my-events/new/page.tsx`

## Delta 2 (P0): Add persistent top warning in host AI screen

- Add same rule used in classic form:
  - "Save/create draft first, then click Publish Event to make it public."
- Placement: directly under host header in conversational page.
- File: `.../ConversationalCreateUI.tsx`

## Delta 3 (P0): Rename primary create CTA for semantic clarity

- Change **Confirm & Create** -> **Confirm & Create Draft**
- Update ready-state sentence accordingly.
- File: `.../ConversationalCreateUI.tsx`

## Delta 4 (P1): Strengthen post-create action copy

- Keep "Event Created as Draft", add one-line explicit next step:
  - "This event is private until you click Publish Event in the draft."
- File: `.../ConversationalCreateUI.tsx`

## Delta 5 (P2): Improve navigation affordance

- Change "Go to My Happenings" to "Go to My Happenings (check Drafts)".
- Optional deeper improvement: add `?tab=drafts` support to My Happenings.

---

## 6) Test Impact

Likely test updates (string assertions) in existing interpreter lab/host UX tests:

- `web/src/__tests__/interpreter-lab-post-create-ux.test.ts`
- `web/src/__tests__/interpreter-lab-conversation-ux.test.ts`

No migration, API, or DB tests required for copy-only deltas.

---

## 7) Recommendation

Proceed with Deltas 1-4 as a single low-risk UX clarity patch.  
Delta 5 is optional and can be deferred.

---

## 8) Execution (Approved and Completed)

Executed on March 17, 2026 after explicit approval.

### Implemented deltas

1. **Delta 1 (P0) shipped**  
   Updated launcher AI card copy to explicitly say AI create starts as a draft.
   - `web/src/app/(protected)/dashboard/my-events/new/page.tsx`

2. **Delta 2 (P0) shipped**  
   Added a persistent host-only warning banner in conversational create:
   - "Confirm and create your draft, then click Publish Event to make it public."
   - `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx`

3. **Delta 3 (P0) shipped**  
   Renamed primary create CTA:
   - `Confirm & Create` -> `Confirm & Create Draft`
   - `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx`

4. **Delta 4 (P1) shipped**  
   Added explicit post-create visibility message:
   - "This event is private until you click Publish Event in the draft."
   - `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx`

5. **Delta 5 (P2) shipped (copy-only)**  
   Updated CTA wording to improve draft discoverability:
   - `Go to My Happenings (check Drafts)`
   - `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx`

### Test updates + verification evidence

Updated source assertion tests for new copy:
- `web/src/__tests__/interpreter-lab-post-create-ux.test.ts`
- `web/src/__tests__/interpreter-lab-conversation-ux.test.ts`
- `web/src/__tests__/interpreter-lab-create-write.test.ts`
- `web/src/__tests__/interpreter-14-host-ux-polish.test.ts`
- `web/src/__tests__/conversational-create-launch-surface.test.ts`

Verification run:
- `npm test -- --run src/__tests__/interpreter-lab-post-create-ux.test.ts src/__tests__/interpreter-lab-conversation-ux.test.ts src/__tests__/interpreter-lab-create-write.test.ts src/__tests__/interpreter-14-host-ux-polish.test.ts src/__tests__/conversational-create-launch-surface.test.ts` -> **169 passed**
- `npx eslint <changed files>` -> **pass**
- `npm run build` -> **pass**
- `npm run lint` (full repo lint) still fails due unrelated pre-existing errors in `web/scripts/send-featured-song-retroactive-email.js` (outside this change scope).

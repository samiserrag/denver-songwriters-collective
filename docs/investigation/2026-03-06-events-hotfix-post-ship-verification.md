# 2026-03-06 Post-Ship Verification: Interpreter + My-Events Hotfix

## Scope

- Commit `aa625b6f` — interpreter hybrid preservation + shared OCR recurrence threshold wiring.
- Commit `e0939a3b` — my-events venue classification + hybrid preservation on venue promotion.

## Runtime verification status

### Immediate smoke checks requested

1. Interpreter create: hybrid + online URL stays hybrid.
2. Interpreter create: low-confidence OCR monthly text does not force recurring.
3. Interpreter create: explicit "one-time" beats OCR monthly text.
4. My-events create: ambiguous same-name venue does not auto-promote.

### Result

- **Behavioral pass via deterministic route tests (executed):**
  - `web/src/__tests__/interpreter-fixture-regression.test.ts`
    - `F27` passed: hybrid intent preserved with `venue_id + online_url`.
    - `F28` passed: low-confidence OCR recurrence does not block single downgrade.
    - `F29` passed: explicit one-time cue overrides OCR recurrence hint.
  - `web/src/__tests__/my-events-venue-promotion-behavior.test.ts`
    - ambiguous same-name candidates skip auto-promotion and skip canonical venue create in that request.
- **Direct interactive prod/staging run from this agent environment:** blocked.
  - Browser automation (Playwright MCP) failed to establish stable Chrome session due profile/devtools constraints.
  - Shell-based Supabase auth login was also blocked by DNS resolution in this environment (`*.supabase.co` unresolved).

## Test evidence

Command:

```bash
cd web && npm test -- src/__tests__/interpreter-fixture-regression.test.ts src/__tests__/interpreter-phase9-reliability.test.ts src/__tests__/my-events-venue-promotion-behavior.test.ts
```

Outcome:

- Test files: `3 passed`
- Tests: `48 passed`
- Fixture suite: `29/29 passed`, safety-critical `13/13 passed`.

## Axiom 24h watch baseline (production)

Window: last 24h vs prior 24h.

### `/api/events/interpret`

- Last 24h: `requests=5`, `responses=5`, `ask_clarification=2`, `hardErrors=0`
- Prior 24h: `requests=6`, `responses=6`, `ask_clarification=2`, `hardErrors=0`

### `POST /api/my-events`

- Last 24h: `requests=7`, `created=2`, `createErrors=0`, `ambiguityFallbacks=0`, `onlineUrlValidation=0`
- Prior 24h: `requests=12`, `created=4`, `createErrors=0`, `ambiguityFallbacks=0`, `onlineUrlValidation=0`

### Signal interpretation

- No immediate error spike on interpreter or my-events create.
- Clarification rate stable day-over-day.
- No observed ambiguity fallback or online_url validation-error surge.
- No image-based interpreter requests observed in 24h traffic (`hasImages: true = 0`), so OCR-specific runtime behavior did not appear in passive logs.

## Follow-up required to fully complete interactive prod smoke

- Run the four manual authenticated checks from `docs/SMOKE-PROD.md` in a real browser session and capture trace IDs.
- Re-check Axiom using those trace IDs to confirm production runtime payload outcomes.

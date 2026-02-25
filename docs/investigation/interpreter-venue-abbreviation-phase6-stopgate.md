# Stop-Gate: Phase 6 Venue Abbreviation Resolution

**Date:** 2026-02-25  
**Status:** AWAITING APPROVAL  
**Parent tract:** `docs/investigation/interpreter-image-extraction-stopgate.md` (Phases 0-5 complete)

---

## 1) Goals and Context

Phase 5 delivered deterministic venue resolution with strong guardrails, but abbreviations still fail by design (example: `LTB` for `Long Table Brewhouse`).

This phase adds **abbreviation/alias support** without weakening safety:
- no silent wrong venue assignments,
- no expansion of model write authority,
- no forced clarifications for non-location edits,
- deterministic server-side decisions only.

---

## 2) Current State Evidence

### Implemented in Phase 5

- Resolver module: `web/src/lib/events/venueResolver.ts`
- Route integration: `web/src/app/api/events/interpret/route.ts`
- Behavior gate: `shouldResolveVenue(...)` (create always, edit_series only with location intent/signals)
- Online clarification path: unresolved online blocks on `online_url` (not `venue_id`)

### Known limitation

- Alias/abbreviation inputs (e.g., `LTB`, `MC`, `SS Live`) are not resolved reliably because current matching is:
  - exact normalized name,
  - slug equivalence,
  - token overlap (Jaccard + small boost).

---

## 3) Risks If Unaddressed

1. **Host trust erosion (blocking, correctness)**  
Hosts using common shorthand get repeated clarification loops.

2. **Under-adoption risk (non-blocking, product)**  
“Conversational” UX feels brittle compared to social platforms if natural abbreviations fail.

3. **False-positive risk if done poorly (blocking, correctness)**  
Loose fuzzy matching could map abbreviations to the wrong venue.

---

## 4) Proposed Phase 6 Scope

## 4.1 Deterministic alias index (server-side)

Add a server-only alias index builder in resolver flow:
- Canonical venue name
- Venue slug tokens
- Deterministic acronym alias generation (e.g., `Long Table Brewhouse` -> `ltb`)
- Curated alias overrides from a controlled config map

No LLM alias guessing. Alias matching remains exact against the generated alias set.

## 4.2 Resolution order (strict)

1. Validate explicit `venue_id`
2. Exact normalized name
3. Exact slug
4. Exact alias hit (from deterministic index)
5. Existing fuzzy scoring (only if alias exact did not resolve)
6. Ambiguous/unresolved clarification (current behavior)

## 4.3 Safety constraints

- Alias path must never auto-resolve if multiple venues share the same alias.
- Alias collisions always return `ambiguous` with candidate list.
- `edit_series` gating from Phase 5 remains unchanged.

## 4.4 No schema migration in v1

Phase 6A is code-only:
- no DB tables,
- no RLS changes,
- no API contract changes.

Optional future Phase 6B (separate approval): managed `venue_aliases` table + admin UI.

---

## 5) Deliverables

1. Alias index and deterministic matching in `venueResolver.ts`
2. Resolver tests for:
   - acronym success (`LTB` -> Long Table Brewhouse),
   - alias collision -> ambiguous,
   - no alias match -> existing fallback behavior
3. Route integration tests proving:
   - no regression to H6/H7 behavior
   - alias hit resolves without extra clarification
4. Smoke checklist additions in `docs/SMOKE-PROD.md` for abbreviation cases

---

## 6) Test Plan

### Unit

- alias generation deterministic and stable
- alias normalization (case, punctuation, whitespace)
- collision handling
- threshold interaction with existing fuzzy logic

### Integration

- `create` with alias input resolves expected `venue_id`
- `edit_series` non-location update still skips resolver
- online move without URL still blocks `online_url`

### Production smoke

- `create`: “Open mic at LTB Friday 7pm” resolves venue without clarification
- ambiguous alias produces candidate clarification
- no increase in `edit_series + venue_id` false-block alerts

---

## 7) Rollback

Code-only rollback:
- revert alias index logic,
- keep Phase 5 resolver behavior unchanged.

No migration rollback needed.

---

## 8) Approval Gates

1. Approve **code-only alias scope** (no schema changes) for Phase 6A.
2. Approve alias source policy:
   - deterministic acronym + curated config map,
   - collisions must clarify (never auto-pick).
3. Approve success criteria:
   - abbreviation success on top target venues,
   - no H6/H7 regression in production smoke and Axiom.

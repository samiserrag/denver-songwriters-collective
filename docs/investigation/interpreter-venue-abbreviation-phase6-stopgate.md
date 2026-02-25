# Stop-Gate: Phase 6 Venue Abbreviation Resolution

**Date:** 2026-02-25  
**Status:** IMPLEMENTED — awaiting production smoke sign-off  
**Parent tract:** `docs/investigation/interpreter-image-extraction-stopgate.md` (Phases 0-5 complete)

---

## 1) Goals and Context

Phase 5 made venue resolution deterministic, but shorthand such as `LTB` still required avoidable clarification loops.  
Phase 6 adds deterministic server-side alias handling while preserving existing safety behavior:

- no autonomous writes
- no fuzzy alias guessing
- no behavior change to non-location `edit_series` operations
- collisions must escalate to clarification

---

## 2) Implementation Summary

### 2.1 Resolver updates

Implemented in `web/src/lib/events/venueResolver.ts`:

1. Added alias source in resolved outcome:
   - `source: "server_alias"` (alongside `llm_validated`, `server_exact`, `server_fuzzy`)
2. Added deterministic alias generation/indexing:
   - `normalizeAlias(value)`
   - `generateAcronymAlias(name)`
   - `buildVenueAliasIndex(catalog)`
   - `extractVenueAliasFromMessage(message, aliasIndex)`
3. Added curated overrides map:
   - `CURATED_ALIAS_OVERRIDES = { "long-table-brewhouse": ["ltb"], "sunshine-studios-live": ["ssl", "sslive"] }`
4. Updated resolution order:
   - validate LLM `venue_id`
   - candidate from `draftVenueName`, exact name extraction, or alias extraction
   - exact name match
   - exact slug match
   - exact alias match (`server_alias`, confidence `0.93`)
   - existing fuzzy scoring
5. Added stopword safety in alias extraction:
   - message tokens that are stopwords (`at`, `in`, `the`, etc.) are ignored to prevent accidental alias hits.

### 2.2 Route behavior impact

No route contract change required. The existing Phase 5 route integration in
`web/src/app/api/events/interpret/route.ts` automatically consumes resolver outcomes and keeps escalation-only behavior.

### 2.3 Data model / migration impact

None. This phase is code-only:

- no schema migration
- no RLS changes
- no new API endpoints

---

## 3) Validation Evidence

### 3.1 Unit coverage

Updated `web/src/__tests__/venue-resolver.test.ts` with alias-path and safety tests:

- alias normalization
- acronym generation
- alias index generation (generated + curated aliases)
- alias extraction from message
- alias collision -> `ambiguous`
- alias resolution from `draftVenueName`
- alias resolution from user message
- stopword false-positive guard (`"at"` should not trigger alias resolution)

Current resolver suite: **62 tests passing**.

### 3.2 Integration/source assertions

`web/src/__tests__/interpret-venue-resolution.test.ts`: **30 tests passing** (no regression to Phase 5 route wiring and escalation behavior).

### 3.3 Command evidence

Executed locally:

```bash
cd web && npx vitest run src/__tests__/venue-resolver.test.ts src/__tests__/interpret-venue-resolution.test.ts
```

Result: **92 tests passing**, 0 failures.

```bash
cd web && npx eslint src/lib/events/venueResolver.ts src/__tests__/venue-resolver.test.ts
```

Result: ESLint clean on changed files (non-blocking baseline-browser-mapping freshness notice only).

---

## 4) Risks and Safeguards

1. **Alias collisions**  
Handled by explicit `ambiguous` outcome with candidate list. No auto-pick.

2. **Common-word false positives**  
Mitigated by stopword filtering during alias token extraction.

3. **Catalog drift / missing aliases**  
Handled by fallback to existing unresolved clarification path. No silent incorrect mapping.

---

## 5) Rollback

Code-only rollback:

- revert `web/src/lib/events/venueResolver.ts`
- revert `web/src/__tests__/venue-resolver.test.ts`

No migration rollback needed.

---

## 6) Approval Gate Closure

1. Code-only alias scope (no schema changes): ✅ implemented  
2. Deterministic alias policy + collision clarify behavior: ✅ implemented  
3. Success criteria: alias path covered in tests, no Phase 5 integration regression in local suite: ✅ implemented  

**Remaining sign-off step:** production smoke + Axiom checks for abbreviation scenarios.

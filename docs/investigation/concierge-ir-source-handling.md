# Concierge IR / Source-Handling Design Doc

**Date:** 2026-05-04
**Lane:** 9
**Status:** Design — PR 1 of a 5-PR shipping plan. Docs-only. No code, no tests, no schema changes.
**Authority:** Companion to `docs/investigation/agent-concierge-unification-plan.md` and `docs/investigation/track2-2f0-concierge-write-gate-adr.md`. Constrained by `docs/CONTRACTS.md`, `SECURITY.md`, and the Lane 6 source-observation briefs (`source-observation-step-3a-migration-brief.md`, `source-observation-step-3b-observations-brief.md`).
**Audience:** Implementer of PRs 2–5 in this plan; reviewers checking that the architecture is buildable without further architectural decisions.

---

## 0. Shipping plan summary

This design will ship across five PRs. The current PR (1) introduces this doc only. Subsequent PRs are scoped here for context but not implemented.

| PR | Scope | Depends on |
|---|---|---|
| **PR 1 — this PR** | Design doc only. | — |
| **PR 2** | Pure code: IR types + deterministic schedule parser + validator + Black Rose fixture tests. No route wiring, no flag, no production effect. | PR 1 |
| **PR 3** | Integration: feature-flagged parser/validator wired into the create-flow concierge route. Off by default. | PR 2 |
| **PR 4** | Edit-flow reconciliation: same parser/validator on the edit-series and edit-occurrence concierge entry points; cross-turn ledger semantics. | PR 3 |
| **PR 5** | Model escalation, only if PRs 2–3 do not produce sufficient quality on their own. | PR 4 |

Each subsequent PR is its own review surface. The flag in PR 3 is the rollback lever.

---

## 1. Problem statement

The architecture exists to prevent four classes of question-quality failure observed when a low-cost LLM is given messy real-world host input and asked to both extract structured event data **and** decide what to ask the human about. These failures occur even when the source contains the answer the model claims is missing.

Canonical motivating example: **Black Rose Acoustic Showcase** (https://www.blackroseacoustic.org/showcase). The host pasted the schedule page text into the concierge. The page contains: a venue (Buffalo Lodge, 2 El Paso Blvd., Colorado Springs), a shared time (6:00–9:00 PM), and five dated occurrences each with its own lineup. On that input the concierge:

1. **Asked for the venue** even though the source named it.
2. **Claimed the page lacked a schedule** even though five dates with times were present.
3. **Said it added "custom dates"** and then asked **what date the event should happen next**, contradicting itself within the same turn.
4. **Generated search queries from prose noise** ("here", fragments of sentences) instead of from extracted entities (title, venue, domain, date).

Each failure is the model deciding *what to ask* based on its own incomplete read of the source. The cure is not a smarter model. The cure is a structural separation:

> **Question generation must become deterministic from structured facts.** The model may parse, summarize, and phrase. It may not decide what to ask or whether the draft is blocked.

The concierge becomes a pipeline: source → deterministic parser → in-memory **Intermediate Representation (IR)** → deterministic validator → question ledger → model (for prose only). If a fact is in the IR, no question about it can be surfaced. If the IR contradicts itself, the validator halts before the user sees output.

---

## 2. IR schema sketch

The IR is a request-scoped, in-memory TypeScript object. It is not persisted, not shared across requests, and not written to any table. Its shape is the contract between the parser and the validator.

```ts
type SourceKind =
  | "flyer_image"          // uploaded image; OCR text is the source
  | "webpage"              // fetched HTML via safeFetch (PR 4+ scope)
  | "pasted_page_text"     // user pasted the page text into chat
  | "social_post"          // pasted social post body (FB/IG/X/etc.)
  | "conversation"         // free-text host message, no external source
  | "existing_event_edit"; // edit-flow seeded from an existing event row

type ConciergeIR = {
  source_kind: SourceKind;
  source_url: string | null;          // canonical event/source page; never a Maps URL
  event_family: string | null;        // the recurring concept, e.g. "Black Rose Acoustic Showcase"
  title: string | null;               // best title for a single occurrence or the family

  shared_facts: {
    venue: string | null;             // "Buffalo Lodge"
    address: string | null;           // "2 El Paso Blvd."
    city: string | null;              // "Colorado Springs"
    state: string | null;             // "CO"
    time: { start: string; end: string | null } | null; // "18:00" / "21:00"
    cost: string | null;              // free-form, e.g. "$10 suggested"
    signup: string | null;            // "open mic signup at door 5:30 PM"
    membership: string | null;        // "members $5, non-members $10"
    age_policy: string | null;        // "all ages", "21+"
  };

  occurrences: Array<{
    date: string;                     // ISO yyyy-mm-dd
    start_time: string | null;        // overrides shared_facts.time.start when present
    end_time: string | null;
    lineup: string[];                 // per-date performers
    per_date_notes: string | null;    // anything date-specific that isn't lineup
  }>;

  // Diagnostics produced by parser + validator; NOT user-facing prose.
  inferred_facts: Array<{ field: string; value: unknown; basis: string }>;
  conflicts: Array<{ field: string; values: unknown[]; basis: string }>;
  true_unknowns: string[];            // field names the source legitimately does not contain
  suggested_questions: Array<{ field: string; reason: string }>; // pre-validator hints

  // Minimal provenance. Not pre-implementing Lane 6.
  provenance: Record<string, { source_pointer: string; evidence_text: string }>;
};
```

The IR is **request-scoped and in-memory only**. It never hits Postgres, never goes into `event_audit_log`, never goes into `event_sources` / `event_source_observations`. It is constructed on each request and discarded after the response is sent.

The `source_kind` and `source_url` field domains are deliberately chosen to be subset-compatible with Lane 6 Step 3a `event_sources.type` and Step 3b `event_source_observations.source_url`, so a future Lane 6 Step 4 derivation function can map IR → observation rows without re-modeling. See §10 for the explicit boundary.

---

## 3. Parser scope

The parser is a **pure function**: `parse(input: ConciergeInput): ConciergeIR`. No I/O, no network, no LLM call. Deterministic across runs.

It handles common page-text shapes the host actually pastes:

- **Date-then-times block.** A line like `Wednesday, May 6: 6:00 - 9:00 pm Buffalo Lodge` followed by indented or bulleted time-slot lines such as `6:30 - 7:00 pm — Performer A` and `7:00 - 7:30 pm — Performer B`. The parser emits one occurrence with `date = 2026-05-06`, the shared time, and a lineup array.
- **Repeating header.** Multiple date-headed blocks under one venue line. The parser hoists the venue into `shared_facts.venue` and emits one occurrence per date block.
- **Slot table.** `<table>`-shaped input where rows are time slots and columns are date / performer / start / end. The parser flattens to occurrences + lineup.
- **Single-event flyer text.** One date, one time, one venue. Emits one occurrence and populates `shared_facts`.
- **Pure conversation.** Free-text host message with no schedule shape. Emits no occurrences; populates whatever `shared_facts` the host explicitly stated.

The parser does **not** call the model. The parser does **not** decide what to ask. Its only outputs are IR fields, plus `inferred_facts` (when a value is derived from another, e.g. shared time copied to an occurrence with no explicit time) and `conflicts` (when two source spans disagree).

If a shape is unrecognized, the parser populates whatever fields it confidently extracted and leaves the rest `null` / empty. The validator is responsible for deciding whether the draft is shippable.

---

## 4. Validator gates

The validator is a pure function over IR. It runs **before any user-facing message is generated**. If a gate fails, the validator either halts the turn (model gets no chance to draft prose), drops the offending question, or rewrites it. The validator's output is the **question ledger** — the authoritative list of what to ask. The model never adds to this list.

Minimum gates for PR 2:

| # | Gate | Failure means |
|---|---|---|
| 1 | **Schema conformance.** IR matches the type declaration; required arrays exist; ISO dates parse. | Parser bug. Halt and log; do not surface to user. |
| 2 | **Source coverage check.** If the source contains a venue / date / time pattern, the IR must contain it. Detected by a second-pass scan of the raw source against extracted IR fields. | Parser missed a fact. Trigger model escalation (§8) or halt. |
| 3 | **Question-vs-source coverage.** No suggested question may target a field already populated in IR or detected in the raw source. | Drop the question silently. |
| 4 | **Internal-question rejection.** Extend the `INTERNAL_DRAFT_VERIFIER_QUESTION_PATTERN` regex from `web/src/lib/events/interpreterPostprocess.ts` (PR #285) to concierge output. Questions referencing schema, RRULE, FREQ=, BYDAY=, recurrence overrides, "choose the one that applies", etc. are dropped. | Drop. |
| 5 | **Self-contradiction check.** If `occurrences.length > 0`, no question may ask "what date should this happen next" or "do you want a custom date set." | Drop or halt depending on severity. |
| 6 | **Cross-turn ledger persistence.** Facts established by a prior turn (in IR or in the host's confirmed answers) persist across turns unless the new turn contains source text that contradicts them. | Reuse prior fact; do not re-ask. |
| 7 | **Year/date suppression.** If the draft date is in the current calendar year and on or after today's date, no year-confirmation question may be surfaced. Reuse the `REDUNDANT_YEAR_CONFIRMATION_PATTERN` logic from #285. | Drop. |
| 8 | **Search query quality.** Any search query the concierge would issue must contain at least one of: extracted title, extracted venue, extracted source domain, or an extracted date token. Queries built from prose noise (`here`, sentence fragments) are rejected before issuance. | Drop the query; do not search. |
| 9 | **`external_url` discipline.** The concierge may set `external_url` only to a real event or source page. Maps URLs (`maps.google.com`, `goo.gl/maps`, `maps.apple.com`) and search-result URLs are rejected. This reaffirms existing repo behavior; no new scope. | Drop. |

Gates 3, 4, 5, 7, 8, 9 are silent-drop gates: the user never sees the rejected question. Gates 1, 2 may halt the turn and trigger model escalation per §8.

---

## 5. Question generator ownership

The architectural rule is one sentence:

> **The model may draft prose. It may not decide what to ask or whether the draft is blocked.**

Concretely:

- **Question generation is a pure function over IR.** The validator's question ledger is the only source of "what to ask the user." The model is not invited to add to it.
- **The model authors prose.** Description text, friendly tone, summaries, the human-readable phrasing of a question that the validator already decided to ask.
- **The model never decides blocking state.** Whether the draft is shippable, whether a clarification is required, whether to publish — all determined by the validator and the existing 2F.0 publish-gate logic.
- **The model's output is filtered.** Anything the model emits that looks like a question is run back through the validator's question-vs-source coverage check (gate 3) and internal-question rejection (gate 4). Out-of-ledger questions are stripped.

This inverts today's behavior, where the model decides what to ask and a postprocess regex (#285) tries to scrub the worst output. Lane 9 PR 2's validator is the question authority; the regex becomes a safety net, not the decision boundary.

---

## 6. Feature flag plan

PR 3 ships behind a feature flag — working name **`CONCIERGE_IR_PARSER_ENABLED`** — read on the server at request time.

- **Off (default for first deploy):** The concierge route uses the existing model-decides-questions path. Zero behavior change.
- **On:** Source → parser → IR → validator → question ledger → model (for prose only). New code path active.

The flag is binary, server-side, and read per request. It does not need a UI surface and is not user-controllable. It exists so that:

- PR 3 can ship to production with the path inert.
- A canary cohort or full enablement can flip it without a deploy.
- Rollback on regression is one config change, not a revert.

The flag may be removed after the new path has been on by default for at least one full Lane 9 verification cycle without regression. Removal is a separate trivial PR.

---

## 7. Black Rose fixture acceptance criteria

PR 2 must include a fixture test using the Black Rose Acoustic Showcase schedule page text (https://www.blackroseacoustic.org/showcase) as input. The recorded fixture is committed to the repo; no live HTTP. The test must assert each of the following:

**Parser assertions:**

- Parser extracts **all 5 occurrence dates** present in the schedule page.
- Each date's **lineup is attached to the correct date** (no cross-pollination of performers between dates).
- `shared_facts.venue` is `"Buffalo Lodge"` (populated **once**; not duplicated into each occurrence).
- `shared_facts.address` contains `"2 El Paso Blvd."` and `shared_facts.city` is `"Colorado Springs"` (populated once in `shared_facts`, not per occurrence).
- `shared_facts.time` is `{ start: "18:00", end: "21:00" }` (the shared 6:00–9:00 PM window).
- `source_url` is `"https://www.blackroseacoustic.org/showcase"`.

**Validator assertions:**

- The question ledger does **not** contain a venue question.
- The question ledger does **not** contain a `custom_dates` question.
- The question ledger does **not** contain "what date should this happen next" or any equivalent self-contradicting question.

**Search-query assertions:**

- Any search queries the concierge would issue contain at least one of: `Black Rose`, `Buffalo Lodge`, or `blackroseacoustic.org`, **and** do not contain prose-noise tokens like a bare `here` or stray sentence fragments.

These are concrete assertions, not aspirational ones. PR 2 is not done until they pass.

---

## 8. Model escalation policy

The default model remains **gpt-5.4-nano** per PR #279. The cheap-model-by-default principle holds: most concierge inputs are well-shaped enough that the deterministic parser does the heavy lifting and the model only needs to phrase prose.

Escalation to a stronger model fires **only** when validator gates indicate the cheap model has lost obvious facts. The triggers are:

1. **Schema conformance (gate 1) failed twice** in a single turn, even after a model retry on the same input.
2. **Source coverage check (gate 2) failed** — the source contains a fact the IR is missing.
3. **Self-contradiction check (gate 5) failed** — the model proposed a question that contradicts the IR it just produced.
4. **IR has zero occurrences but the source contains date patterns** — the source-coverage check catches this as a special case worth calling out.

Escalation is **bounded to one upgrade per turn**. If the stronger model also fails the gates, the turn halts with a structured "I need a human to look at this" outcome. There is no third escalation tier, no recursive retry loop.

The choice of stronger model is implementation detail for PR 5; the default cheap model and the escalation triggers above are the contract.

---

## 9. URL fetch safety

URL fetching is **out of scope for PR 2** (parser handles `pasted_page_text`, `social_post`, `conversation`, `flyer_image`, `existing_event_edit` only). PR 4 may introduce `webpage` source handling, at which point all URL fetching must route through the existing `safeFetch()` helper referenced in the Lane 2 BOLA matrix at `web/src/lib/safeFetch.ts` / `web/src/lib/url/safeFetch.ts` and the T2-BOLA-SAFE-FETCH and T2-BOLA-REVERIFY-WORKER matrix rows.

The concierge inherits all `safeFetch()` constraints — it does not roll its own fetch. Per `track2-2j0-safe-url-fetcher-adr.md`:

- **http/https only.** No `file://`, `javascript:`, `data:`, etc.
- **Block private / reserved IPs and `localhost`.** SSRF defense, including DNS rebinding protection.
- **Max redirects, max response size, content-type allowlist.** As enforced by `safeFetch()`.
- **Timeout 5–8 seconds** total per request.
- **No credential forwarding.** Cookies, Authorization headers, and infrastructure secrets are not sent to fetched destinations.

Concierge-specific layered constraints:

- **Strip scripts and nav noise from fetched HTML before passing to the parser.** `<script>`, `<style>`, common nav/footer chrome are removed; only main content reaches the parser. The stripping is deterministic and runs before parser invocation.
- **Recorded fixtures in tests; no live HTTP.** All concierge tests, including the Black Rose fixture in §7, use committed text snapshots. CI never makes a network call.

If `safeFetch()` is missing any of these capabilities at the time PR 4 lands, the missing capabilities are **future hardening for `safeFetch()`**, not justification for rolling a concierge-local fetch helper. Adding a second URL-fetch boundary is forbidden by the 2J ADR.

---

## 10. Lane 2 / Lane 5 / Lane 6 boundary notes

Concierge work in this lane respects the live invariants of three adjacent lanes without modifying them.

**Lane 2 (BOLA / route resource matrix).** The concierge route already exists in production at `web/src/app/api/events/interpret/route.ts` and is covered by the **T2-BOLA-EVENT-INTERPRET** row in `docs/investigation/track2-2l2-bola-route-resource-matrix.md`. That row enumerates: actor scope via `canManageEvent()`, occurrence-scope via `dateKey`/`eventId` matching, no-write invariant, user-scoped Supabase client. Lane 9's IR work runs entirely inside the existing actor and series scope. A future Lane 2 slice may add a new matrix row — provisionally **T2-BOLA-EVENT-INTERPRET** extensions or a new row for any URL-fetch surface added in PR 4 — but that is **not bundled into this work**. This lane does not modify the matrix or the manifest at `docs/investigation/track2-2l3-service-role-admin-client-manifest.md`.

**Lane 5 (`event_audit_log`).** The concierge does **not read or write** the audit log. The IR is in-memory only and discarded at request end. Lane 5 invariants are unaffected. No `log-on-write` hook is introduced.

**Lane 6 (source observation: `event_sources`, `event_source_observations`, `event_change_log`).** The concierge does **not write** to any Lane 6 table. The IR exists in memory; no row is inserted, updated, or selected. However, the IR's `source_kind` and `source_url` field domains are deliberately defined to be **subset-compatible with the Lane 6 Step 3a/3b enum schemas** in `source-observation-step-3a-migration-brief.md` (the `event_sources.type` CHECK enum) and `source-observation-step-3b-observations-brief.md` (per-observation `source_url`). The intended mapping for a future Lane 6 Step 4 derivation function:

| IR `source_kind` | Compatible Lane 6 Step 3a `event_sources.type` |
|---|---|
| `flyer_image` | `community_submission` (image-derived) |
| `webpage` | `first_party_site` / `aggregator_public` / `nonprofit_calendar` (depending on host classification) |
| `pasted_page_text` | `first_party_site` / `aggregator_public` (pasted from a real page) |
| `social_post` | `community_submission` (post-derived) |
| `conversation` | `concierge_created` |
| `existing_event_edit` | (no new `event_sources` row; Step 4 leaves the existing row untouched) |

A Lane 6 Step 4 implementation may convert IR + the validator outcome into `event_source_observations` rows cleanly, because the IR carries enough provenance (§2 `provenance` block) and the enum domains line up. This PR does **not pre-implement Step 4**. When Step 4 is designed, it should cross-reference §2 and §10 of this doc to confirm the mapping is still accurate.

---

## 11. Explicit non-goals

This PR series does not, in any of its 5 PRs:

- Introduce migrations.
- Change schema (no `ALTER TABLE`, no new column, no new index, no new view).
- Add structured per-occurrence lineup storage. Per-occurrence lineup may render into the event description text, but **no new `event_occurrences.lineup` column** or equivalent.
- Change publishing-gate logic. The 2F.0 Concierge Write Gate Hardening boundary is unchanged. AI apply on existing events remains gated where it is gated today.
- Modify Lane 5 (`event_audit_log`) reads or writes.
- Modify Lane 6 (`event_sources` / `event_source_observations` / `event_change_log`) reads or writes.
- Touch Symphony scope at all.
- Edit `web/src/lib/events/verification.ts`.
- Edit `docs/CONTRACTS.md`.
- Activate the SOURCE-OBS-01 stop-gate.
- Add reusable venue writes. Existing venue resolution behavior (read-only against the directory + create-on-confirm host flow) is unchanged.
- Change `external_url` behavior beyond reaffirming the existing Maps-URL exclusion (validator gate 9 in §4). No new `external_url` semantics.
- Modify any file outside `docs/investigation/` in PR 1.

---

## 12. Shipping plan summary (restated)

For convenience, the shipping plan from §0:

1. **PR 1 (this PR).** Design doc only. Docs-only. No code, no tests, no schema.
2. **PR 2.** Pure code. IR types, deterministic parser, validator with all 9 gates from §4, Black Rose fixture test from §7. No route wiring, no flag, no production effect.
3. **PR 3.** Integration. Feature flag `CONCIERGE_IR_PARSER_ENABLED`. Wire parser/validator into the create-flow concierge route. Off by default.
4. **PR 4.** Edit-flow reconciliation. Same parser/validator on edit-series and edit-occurrence concierge entry points. Cross-turn ledger semantics (gate 6). Optional `webpage` source handling via `safeFetch()` (§9).
5. **PR 5.** Model escalation. Only ships if PRs 2–3 do not produce sufficient quality on their own. Implements §8 escalation triggers and the bounded-to-one upgrade rule.

PR 1 is the architectural decision. PRs 2–5 are the implementation, each independently reviewable, each with the flag from PR 3 as the rollback lever.

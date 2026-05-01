# Track 2 Roadmap — Event Graph, Categories, Festivals, URL Import

**Date:** 2026-05-01
**Status:** Living investigation document for Track 2 strategy and sequencing
**Companion to:** `docs/investigation/ai-event-ops-collaboration-plan.md` (Track 1 plan)
**Authority:** Same as the Track 1 collab plan — read this before any Track 2 work; if code disagrees with this doc, verify code first and update either the code or this doc.

---

## 1. Why this exists

Track 1 (AI edit and update existing events) is shipping its final §6 PR (PR 11 UI polish). After that merges, Track 2 begins.

This document is the durable Track 2 plan. Every agent working on Track 2 should read:

1. `AGENTS.md`
2. `docs/GOVERNANCE.md`
3. `docs/investigation/ai-event-ops-collaboration-plan.md` (Track 1 — historical context for the operational patterns)
4. This document
5. The active claims doc (Track 1's `docs/investigation/track1-claims.md` continues; Track 2 uses the same coordination model)

If reality and this plan disagree, verify reality and update this document or the claims doc before continuing.

---

## 2. Strategic context

### What Track 1 left us

After the Track 1 §6 PRs (#124, #125, #126, #127, #128, #129, #131, #135, #139, #142, #146, #148, and PR 11 in flight at time of writing):

- Hosts can create new events from messy input, edit existing events with AI, choose between series/occurrence scope, edit venue/cover/copy with safety gates.
- Published-event high-risk changes require explicit confirmation (PR 9 gate).
- Telemetry captures every edit turn, with `turnId` correlation between server-side initial events and client-side accept/reject outcomes (PR 3 stack).
- Patch field registry classifies every editable field by risk tier and enforcement mode (PR 1).
- Eval harness exists for prompt evaluation (PR 4).

What Track 1 did **not** address:

- The data model is still flat — `events` is one big table; festivals, organizations, performers, categories aren't first-class.
- Bulk import (URL schedule, CSV, screenshot) is still future work.
- Dedup against existing events relies on human review, not deterministic keys.
- Categories are a closed text array; doesn't fit dance, martial arts, cultural events, festivals, workshops naturally.

### What Track 2 unlocks

Per collab plan §3.2:

> The defensible advantage is a clean event graph that makes every new flyer, URL, screenshot, and edit smarter over time.

Concretely:

- A user's "open mic at Lost Lake on Tuesdays" creates one series row; future imports of the same series match against it deterministically rather than creating duplicates.
- An organization performing inside a larger festival (the §4 Arcinda + Colorado Dragon Boat Festival example) is modeled with a parent-festival relationship, not crammed into a single event row.
- A scraped schedule.html is decomposed into known venues, organizations, and recurring series; new rows only created when the dedup engine is confident none exist.
- Event types expand beyond the current music-focused closed set without breaking existing filters.

### Order-of-magnitude reframing

| Aspect | Track 1 | Track 2 |
|---|---|---|
| PR count | 12 (plus follow-ups) | ~25–35 estimated |
| Schema migrations | 2 (gate + telemetry) | 8–12 (categories, festivals, performers, imports, dedup keys, etc.) |
| Surface area | Edit flow, telemetry, gate | Whole graph, import pipeline, public surface |
| Risk profile | Mostly contained to AI edit path | Touches public read paths, import data quality, schema-wide |
| Timeline | Weeks | Months |

Track 2 is bigger, slower, and pays back the moat. Don't rush it.

---

## 3. Sub-tracks

### 2A — Categories: format and discipline model

**Why this comes first:** §4 user feedback said "manual event creation felt too focused on existing CSC/open mic categories." Categories drift kills feature adoption for non-music communities.

**Today:** `events.event_type text[]` validated against `eventTypeContract.ts` (closed set, music-focused). Format and discipline are conflated.

**Goal:** separate **format** (the shape — open mic, jam, concert, showcase, workshop, festival appearance, meetup, class, performance) from **discipline** (the domain — music, dance, poetry, comedy, martial arts, cultural, family-friendly). Two dimensions, not one.

**Investigation needed first:**

- Schema choice: normalize into separate tables vs. keep `event_type text[]` and add a second column for discipline. Pros/cons of each.
- Backwards compatibility: keep the current `event_type` field readable for at least one release while readers transition.
- AI prompt update: how does the interpret route propose categories from flyer content?

**PR sequence (proposed):**

1. **2A.1 — Schema research and ADR** (investigation-only, no code). Decision doc covers normalization vs. extension, migration plan, query-pattern impact. Stop-gate.
2. **2A.2 — Migration: normalized format and discipline tables** (or extension columns, per ADR). Includes audit query for existing rows.
3. **2A.3 — Backfill script** to populate new columns/tables from existing `event_type` array. Idempotent.
4. **2A.4 — Validation contract update**. `eventTypeContract.ts` evolves; `validate-event-format.ts` and similar add validation against new schema. API consumers preserve compatibility.
5. **2A.5 — Picker UI** in event form. User/org favorites first, search-as-you-type, "+ More types" for long lists. Lock release on `EventForm.tsx` and similar.
6. **2A.6 — AI prompt updates**. Interpret route proposes categories from flyer content. Telemetry captures category proposal accuracy.
7. **2A.7 — Filter UX**. `/happenings?type=` query param expands to format+discipline filters. Chip layout for two-dimensional filtering.
8. **2A.8 — Public detail page**. Display format and discipline as distinct chips on `/events/[id]`.

**Risks:**

- Migration on existing 1000+ event rows. Run in a transaction, audit before and after.
- Backwards compatibility in API responses for at least one release. Means dual-read paths.
- Filter URL contract change affects bookmarks. Either keep old query params functional or surface a redirect.

**Telemetry hook:** PR 3 stack already captures `proposedChangedFields`. Once categories are in the registry, AI category suggestions become trackable from day one. New telemetry: `categoryProposalAccuracy` (proposed vs accepted-as-final).

**Estimate:** 6–8 PRs. Foundational. Ships 2A.5 picker UI as the user-visible milestone.

### 2B — Festivals: parent relationships

**Why this is small but valuable:** §4 user feedback explicitly named "Arcinda at Colorado Dragon Boat Festival." Modeling the parent-festival relationship resolves a real product gap with relatively contained schema work.

**Today:** events have no parent-festival concept. Festivals are not first-class entities.

**Goal:** add a lightweight festival entity with parent relationships from events, plus optional performer relationship.

**PR sequence:**

1. **2B.1 — Schema migration**. New `festivals` table (`id`, `name`, `slug`, `start_date`, `end_date`, `description`, `cover_image_url`, `website_url`, `parent_organization_id`, `created_at`, `updated_at`). New `events.parent_festival_id` foreign key (nullable). Optional `events.performing_organization_id` (also nullable, future-proofing for §2C).
2. **2B.2 — Festival admin** (lightweight). Create/edit festival from `/dashboard/festivals/new` and `/dashboard/festivals/[id]/edit`. Includes name, slug, dates, description, cover image. Does NOT include lineup management (per §9 deferred).
3. **2B.3 — Festival landing page**. `/festivals/[slug]` shows the festival and all its events chronologically.
4. **2B.4 — Event detail festival badge**. "Part of: Colorado Dragon Boat Festival" linking to festival page.
5. **2B.5 — AI awareness**. Interpret prompt detects festival context from flyer/text input ("at the Dragon Boat Festival"). Resolve festival via search + create-suggest pattern (mirroring venue resolver from PR 8).
6. **2B.6 — Festival in event form**. Parent festival picker in EventForm (visible only when AI doesn't auto-resolve).

**Risks:**

- Conceptual confusion: festival vs. organization vs. performer. Three roles. Lock the model before code: festival = umbrella container; organization = host responsible; performer = artist on stage.
- AI festival detection can over-fire on text containing the word "festival." Mitigation: confidence threshold + ask-clarification on uncertain cases.

**Estimate:** 4–5 PRs. Ships 2B.2 admin + 2B.3 landing page as user-visible milestones.

### 2C — Organizations and performers

**Why this is contentious:** §7 lists organizations and performers but doesn't sub-detail. Real question: is the goal to add them as first-class entities, or keep them as text fields with smart resolution?

**Recommendation:** incremental.

**Phase 2.C.1 — Performing organization on events:**

- Already partially scoped via §2B.1 (`events.performing_organization_id` nullable column added with festival migration).
- This phase wires UI + AI awareness for setting it.
- 2–3 PRs.

**Phase 2.C.2 — Performers as first-class entities:**

- New `performers` table (`id`, `name`, `slug`, `bio`, `cover_image_url`, `website_url`, `created_at`, `updated_at`).
- Many-to-many via `event_performers` join table (`event_id`, `performer_id`, `role` — e.g., "headliner", "opener", "feature").
- 3–4 PRs.

**Phase 2.C.3 — Performer landing pages:**

- `/performers/[slug]` shows performer profile + upcoming + past events.
- 2 PRs.

**Phase 2.C.4 — AI performer awareness:**

- Interpret prompt detects performer names from flyer/lineup input.
- Resolve via match-or-create with confidence.
- 2 PRs.

**Defer for now (per §9):** rich performer profiles (bios, photos, MusicProfileCard equivalent), performer-host messaging, performer self-service onboarding. Wait until 2.C.3 has volume to justify.

**Risks:**

- Performer name fuzzy-match is hard. "DJ Smith" vs "DJ Smith (Live)" vs "Dj smith" — same person? Heuristics + human review for low-confidence cases.
- Volume risk: a single Friday night flyer can have 10 performers. AI extraction at scale needs guardrails.

**Estimate:** 9–11 PRs total across the four phases. Spread across many cycles.

### 2D — URL Schedule Import

**Why this is the biggest sub-track:** §4 user feedback explicitly asked for it (`https://arcinda.org/schedule.html`). Highest value, highest risk.

**Per §7.3 invariants:**

1. Import as first-class `import_run` (not opaque background job).
2. Source URL hash for change detection across re-imports.
3. Per-candidate content hash for row-level diffing.
4. Drop past events server-side, not client-side.
5. Confidence per row.
6. Review UI for uncertain rows.
7. Respect robots.txt and rate limits.
8. Sanitize scraped HTML aggressively.
9. **Deterministic JSON-LD extraction before LLM extraction** — bias hard against LLM-only.
10. Dedup against prior imports AND existing events.

**PR sequence (long chain, expect 12–18 PRs total):**

**Phase 2.D.0 — Foundations:**

1. **2D.0.1 — Schema**. Tables: `import_sources` (url, owner, schedule), `import_runs` (run_id, source_id, status, started_at, completed_at, runner_id, source_url_hash), `import_candidates` (run_id, content_hash, raw_payload, parsed_payload, confidence, status, dedup_match_event_id), `import_dedupe_keys` (key_type, key_value, event_id).
2. **2D.0.2 — Robots.txt + rate limit middleware**. Per-host throttling, robots.txt cache with TTL, User-Agent header, never-fetch list.
3. **2D.0.3 — HTML sanitization layer**. DOMPurify equivalent for scraped HTML. Remove scripts, normalize entities, strip comments.

**Phase 2.D.1 — JSON-LD-only path (deterministic, no LLM):**

4. **2D.1.1 — JSON-LD harvester**. Pure parser for Schema.org Event microdata. No LLM in the path.
5. **2D.1.2 — Confidence scoring for JSON-LD**. Each parsed event gets a confidence based on field completeness and validity.
6. **2D.1.3 — Dedup engine v1**. Key-based matching: (venue_normalized + date + start_time), (title_fuzzy + venue), (slug_match). Returns match-or-no-match with confidence.
7. **2D.1.4 — Review UI**. Host sees N candidate events from import run; can accept/edit/reject each. No auto-import without review for v1.

**Phase 2.D.2 — LLM fallback for sites without JSON-LD:**

8. **2D.2.1 — LLM extraction prompt**. Structured output extracting events from sanitized HTML. Confidence scores per field.
9. **2D.2.2 — LLM-vs-deterministic comparison**. When both paths return data, prefer JSON-LD. When only LLM returns data, label clearly in review UI.
10. **2D.2.3 — Eval harness for LLM extraction**. Fixture URLs + expected output. Runs on demand, not as CI gate.

**Phase 2.D.3 — Re-imports and change detection:**

11. **2D.3.1 — Periodic re-pull**. Cron-style scheduling for import sources. Diffs against prior run via content hashes.
12. **2D.3.2 — Source-side change detection**. Source URL hash detects whole-page changes; content hash detects per-event changes.
13. **2D.3.3 — Auto-update vs review-required**. Confident updates (price change on already-imported event) auto-apply; uncertain (date change) require review.

**Phase 2.D.4 — AI-driven event-merge UI:**

14. **2D.4.1 — Merge proposal UI**. When dedup is uncertain, AI proposes "this looks like the same event as existing X — merge?". Host clicks accept-merge or create-new.
15. **2D.4.2 — Merge audit log**. Each merge decision logged with before/after snapshots.

**Risks (high):**

- **Scraping is brittle.** Sites change their HTML. Mitigation: prefer JSON-LD; fall back to LLM only when necessary; eval harness catches regressions.
- **LLM hallucination in extraction.** Mitigation: confidence scores + review UI + JSON-LD-first.
- **Robots.txt non-compliance** is reputational + legal risk. Strict middleware enforcement.
- **Data quality risk:** bad imports pollute the graph faster than humans can catch. Mitigation: review-UI required for v1, no auto-import.
- **Coupled to 2A categories:** importers proposing event types must use the new schema.

**Estimate:** 12–18 PRs. Ships 2D.1.4 review UI as first user-visible milestone.

### 2E — Recurring series matching

**Why this matters now:** users editing one occurrence of a series shouldn't accidentally orphan it from the series. Today's UI treats them as scope=occurrence vs scope=series, but the underlying data model could lose the relationship.

**Today:** events have `recurrence_rule`, `day_of_week`, `event_date`, `custom_dates` — all on the events row. There's no separate "series" entity. Editing an occurrence either patches the row directly or creates an override row (per PR 6/7/9).

**Goal:** stable series identity that survives renames, venue moves, and time changes.

**PR sequence:**

1. **2E.1 — Series identity audit**. Investigation-only doc. How many existing rows would benefit from a separate series entity? Where do current orphaned occurrences come from?
2. **2E.2 — Schema migration**. New `event_series` table (id, slug, recurring_rule_canonical, identity_hash). Existing events get nullable `event_series_id` foreign key.
3. **2E.3 — Backfill** existing recurring events into series rows.
4. **2E.4 — AI series awareness**. Interpret prompt for "the open mic series at Lost Lake" resolves to existing series rather than treating each occurrence as a new event.
5. **2E.5 — Series page** (`/series/[slug]`). Shows the series concept + all occurrences.

**Risks:**

- Determining which existing events belong to a series is non-trivial — some series share venue + day_of_week but have different titles.
- Backfill heuristics will be conservative; some clusters won't be detected.

**Estimate:** 4–5 PRs. Ships 2E.4 AI awareness as user-visible milestone.

### 2F — AI Host Assistant: free-text cross-event find-and-edit

**Why this is now the first sub-track to ship:** elevated above all others based on **2026-05-01 live user testing evidence**. A host typed an update-shaped natural-language message ("The Recovery Cafe' open mic is now 4 to 7, still the first Friday each month.") into the create flow at `/dashboard/my-events/new/conversational`. The AI correctly drafted a new event from the input — but the host's intent was clearly to **update an existing Recovery Cafe Longmont Open Mic event**. The system has no path today for "I want to update an event but I'm not sitting on its detail page."

The AI edit routes (`/dashboard/my-events/[id]/ai`) and entry points (event detail "Edit with AI" button) are live and shipped via Track 1 PR 6/7. They work end-to-end. **The gap is the discovery surface:** to use them, the host must already be on the right event's detail page. For a host with many events, they need to know which event to navigate to before the AI can help. That's backwards.

This sub-track flips the surface: the host types a free-text update from anywhere (create flow, dashboard quick-add, future surfaces), and the AI finds the right existing event and proposes the patch — falling back to create only when no plausible match exists.

**Why this is also the killer Track 2 feature:** it's the operator ergonomics that make AI maintenance economically viable. A schedule that drifts (and they all drift) requires constant low-effort updates. If the host has to navigate to each event's detail page to update it, drift wins. If they can type "the Tuesday open mic moved to 8 PM" from any chat surface and have the system find it, drift loses.

**Today:**

- Per-event AI edit: ✅ shipped (PR 6/7/8/9 + telemetry stack)
- Cross-event search from free text: ❌ not built
- Mode-switch UX (create flow → "I think you mean to update X" → edit mode for X): ❌ not built
- Disambiguation when multiple events could match: ❌ not built
- Confidence-based fallback to create when no match: ❌ not built

**Goal:** type an update from anywhere, AI finds the right existing event with high enough confidence, asks one clarification at most, then patches it. Otherwise falls back to create with a hint.

**Sub-PRs (proposed):**

1. **2F.1 — Investigation / ADR.** Investigation-only doc. Decisions covered:
   - Search strategy: deterministic key match (normalized venue + event_type + recurrence + day_of_week + start_time) vs. LLM-assisted entity match vs. hybrid (deterministic first, LLM fallback)
   - Confidence threshold: when does the AI auto-propose vs. fall back to create?
   - Multi-match disambiguation: ask one question vs. show a list?
   - User scope: only "my events" (events the host hosts) vs. "events I have permission to edit"
   - Update-shape detection signals: which lexical/semantic markers indicate update intent vs. create intent?
   - Stop-gate before any code.

2. **2F.2 — Search backend.** New library function `findUserEventCandidates(freeText, userId, opts)` returning ranked event candidates with confidence scores. Pure backend, no UI yet. Tests cover known matches, intentional non-matches, and adversarial inputs.

3. **2F.3 — CRUI scan-first step in create mode.** Before submitting an interpret request, optionally run a candidate search. If high-confidence match exists, the assistant asks: "I think you might mean to update [event title] — should I update that instead?" Buttons: "Update [event]" / "Create new". On "Update" click, switch CRUI into edit mode for that event with chat history preserved.

4. **2F.4 — Disambiguation UX.** When multiple plausible matches exist (e.g., 3 open mic events on Tuesdays at the user's venues), show a small picker with confidence scores: "Did you mean: [event A] / [event B] / [create new]?". One click resolves.

5. **2F.5 — Mode-switch flow with state preservation.** When the user accepts a match, the chat doesn't reset — the existing message becomes the first turn of an edit-mode conversation against the matched event. Telemetry captures the mode-switch as a discrete event.

6. **2F.6 — Entry points everywhere.** Add the same scan-first capability to other free-text surfaces:
   - `/dashboard` quick-add chat (if/when added)
   - The "Add a Happening" button from the dashboard for logged-in hosts
   - Possibly the homepage AI chat (gated to logged-in users only)

7. **2F.7 — Telemetry.** Build on PR 3 stack: add `mode_switch` event type capturing the search → match → user accept/reject → mode-switch chain. Helps analyze how often the cross-event find succeeds and where it fails.

8. **2F.8 — Eval harness for cross-event matching.** Extend PR 4's eval harness with fixtures for cross-event match cases. Adversarial inputs:
   - Update message with no plausible match → must fall back to create
   - Update message with multiple plausible matches → must disambiguate
   - Update message that mentions a venue but no event title → must use other signals (recurrence, time)
   - Create-shaped message that incidentally references an existing event name → must NOT hijack into edit mode

**Risks (significant — this is the highest-stakes Track 2 sub-track for false-positive blast):**

- **False-positive matches.** Worst-case: AI confidently matches user's "the open mic moved to 8" to the wrong event, user clicks accept, wrong event gets edited. Mitigation: high confidence threshold + show event title prominently in the disambiguation step + telemetry on user accept/reject ratio + rollback affordance.
- **Search backend complexity.** Free-text → ranked event candidates is a real search problem. Deterministic key match is the baseline; LLM-assisted may be needed for edge cases. Risk of over-engineering. Mitigation: deterministic-first, LLM-fallback only when proven needed by 2F.1 ADR.
- **UX cliff.** If the scan-first feature is too eager (asks "did you mean X?" on every create-shaped input), it harms the existing create flow. Mitigation: only trigger when the input has update-shaped signals (e.g., "is now", "moved to", "changed to", definite-article references like "the" + existing-venue mention).
- **Coupling to 2E series matching.** A Tuesday open mic series and a single Tuesday open mic event need different match treatment. 2E series identity work makes 2F's matching cleaner. Could overlap in delivery.
- **Coupling to 2A categories.** When categories ship (format + discipline), the matching keys gain richer signals. 2F's deterministic match should be designed to absorb richer categories without rework.
- **Confirmation friction.** Hosts who want to create a new event from a long natural-language description shouldn't have to dismiss a "did you mean to update X?" prompt every time. Mitigation: aggressive update-shape detection — only ask when signal is high.

**Estimate:** 8–10 PRs. 2F.1 ADR is investigation-only stop-gate. After that, some sub-PRs can ship in parallel. Ships 2F.3 as the first user-visible milestone.

---

## 4. Cross-cutting and beyond-§7 work

### 4.1 — Operational habits (per §10)

Already partly implemented; ritualize.

- **Weekly AI transcript review.** Axiom saved query → 10 random transcripts (initial + outcome events joined by `turnId`) → flag bad outputs → file as eval fixtures. ~30 min/week.
- **Model ID persisted on records.** New columns: `events.created_by_model_id`, `events.last_edited_by_model_id`. PR 3 telemetry has `model_id`; persist to row for forensic value when telemetry retention ages out.
- **AI origin classification.** New column: `events.ai_origin` enum (`manual`, `ai_chat`, `ai_edit`, `url_import`, `seed`, `csv_import`). Already tracked indirectly; promote to first-class.
- **Honest copy.** Recurring discipline. Track 1 PR 11 audit completed; revisit each user-facing surface as new capabilities ship.

**Estimate:** 4–6 small PRs. Spreadable across other phases.

### 4.2 — Telemetry consumption

The PR 3 stack ships data. Next: build the consumer side.

- **Axiom dashboards / saved queries** for `[edit-turn-telemetry]` + `[edit-turn-outcome]` joined by turnId. Operational, not code.
- **Dashboard metrics:** acceptance rate by mode, latency p50/p95, blocked-fields rate, modelId distribution, scope-decision distribution.
- **Anomaly alerts:** acceptance rate drops > 20%, latency p95 > 30s, blocked-fields-per-turn rises.

Most of this is Axiom configuration rather than DSC repo code. Track as ops work.

### 4.3 — Symphony Phase 2 (post-daemon)

After daemon enable lands successfully:

- **Outer Codex execution timeout** (item 8 from daemon-readiness audit): coarse safety bound for hung worker.
- **Live `recover-stale --execute` test** (item 3): either deliberate stuck-issue test or accept-as-is.
- **Multi-issue concurrency:** raise `max_concurrent_agents` from 1 → N once daemon is stable.
- **Symphony for non-DSC repos:** generalize the orchestrator. Triggers extraction-from-DSC-repo conversation.
- **Symphony as separate repo:** the "tools/symphony in DSC repo" concern surfaces if scaling.

These are out of Track 2 §7 scope but tracked here so the operating model isn't lost.

### 4.4 — Track 1 polish that didn't fit §6

- **Test guardrail loosening (Option 2):** small Track 1 follow-up PR to make `track1-claims.md` exempt from the self-claim requirement when it's the only Track-1-coupled file. Removes the recursive coordinator-sync ritual. Should ship before Track 2 starts to reduce coordinator overhead.
- **Reject UX:** dropped from queue per Sami's call. Revisit if telemetry data shows missing rejection signal.
- **CRUI RTL harness:** the source-text test pattern is pragmatic but limits interactive flow testing. Future refactor PR adds proper RTL component tests.

### 4.5 — Data hygiene

- **Venue dedup audit.** Are there duplicate venue rows with slight name variations? Backfill merge.
- **Event-type validation backfill.** Rows that predate `eventTypeContract.ts` may have non-canonical types.
- **Cancelled event lifecycle audit.** PR 4.28 added restore. Test that cancellation visibility is correct in all read paths.
- **Recurrence correctness audit query** (per `.claude/rules/10-web-product-invariants.md`): run periodically.

### 4.6 — Documentation refresh

- `docs/CONTRACTS.md`: update to reflect PR 3 stack telemetry contracts, gate behaviors.
- `docs/PRODUCT_NORTH_STAR.md`: review whether AI-edit experience matches stated philosophy.
- `docs/runbooks/`: new runbooks for telemetry consumption, weekly transcript review.
- New: `docs/contracts/AI_TELEMETRY.md` — formal contract for analysts consuming the events.

### 4.7 — Performance and accessibility

Per `.claude/rules/20-web-quality-gates.md` Lighthouse targets:

| Metric | Target |
|---|---|
| Performance | ≥85 |
| Accessibility | ≥90 |
| TBT | ≤100ms |
| CLS | 0 |

Track on `/happenings`, `/events/[id]`, `/dashboard/my-events/*` after PR 11 lands. Track 2 work touching public surfaces (festival pages, performer pages, series pages) must verify before/after.

### 4.8 — Edge-case cleanup

- §7.1 rewrite of `/open-mics` and `/events` legacy redirects to canonical `/happenings`.
- Recurrence correctness audit (per invariants doc).
- Dark-mode/contrast audit on new UI elements from PR 11 and Track 2.

---

## 5. Sequencing recommendation

If ordered for highest leverage:

| Phase | Why | Estimated PRs |
|---|---|---|
| 5.0 — Documentation + telemetry consumption + test guardrail loosening | Get existing PR 3 stack producing visible signal; reduce coordinator overhead before adding more code | 2–3 small |
| **2F — AI Host Assistant: free-text cross-event find-and-edit** | **Killer operator-ergonomics unlock; live user testing on 2026-05-01 surfaced the gap directly; makes drift-maintenance economically viable** | **8–10** |
| 2E — Recurring series matching | Data hygiene; series identity makes 2F's matching cleaner | 4–5 |
| 2A — Categories | Live user pain; foundational; un-blocks non-music event hosts | 6–8 |
| 2B — Festivals | Small, valuable, well-bounded; validates entity-relationship model | 4–5 |
| 2D.0 — Import foundations (schema, robots.txt, sanitization) | Required before any URL import code; deterministic pieces only | 3 |
| 2D.1 — JSON-LD-only import path | Highest-asked value, lowest LLM-pollution risk; deterministic baseline | 4 |
| 2D.2 — LLM fallback + 2D.3 re-imports + 2D.4 merge UI | After dedup foundation exists | 8–10 |
| 2C — Performers | Bigger scope; defer until festivals validates the entity-relationship pattern | 9–11 |
| 4.1 — Operational habits ritualization | Spread throughout; not blocking | 4–6 |

**Why 2F first:** elevated to top sequencing position based on 2026-05-01 live user testing evidence. A real host typed an update-shaped natural-language message into the create flow and the AI created a new event instead of finding+updating the existing one. The capability of cross-event find-and-edit is the operator-ergonomics unlock that makes ongoing drift maintenance economically viable. Without it, hosts must navigate to specific event detail pages before AI editing helps them, which is backwards.

**Why 2E before 2A:** series identity work directly improves 2F's match quality. Sharing a clean series identity hash across recurring events lets 2F's matching deterministically find "the Tuesday open mic at Lost Lake" rather than disambiguating between many occurrence rows.

**Why categories before festivals/imports:** the §4 live feedback explicitly named this. Shipping it after 2F+2E un-blocks non-music event hosts and broadens the user base, making subsequent work more visible.

**Why JSON-LD import before LLM extraction:** the §7.3 invariant "deterministic JSON-LD extraction before LLM extraction" should be the first import code that ships. Establishes deterministic baseline; LLM extraction layers on top with measurable quality comparison.

**Why performers last:** until festivals validates the entity-relationship model, performers risks duplicating effort.

---

## 6. Coordination rules

Same as Track 1, with one addition:

### 6.1 — Claims doc

`docs/investigation/track1-claims.md` continues. Track 2 work claims through the same doc — the file is the **whole-repo claims ledger**, not Track-1-specific. Rename consideration deferred (renaming the file requires updating the test guardrail; not worth it now).

Each active Track 2 PR lists:

- Branch name
- Owner (Codex/Claude)
- Task
- Files claimed
- Base SHA
- Status (`in_progress`, `awaiting_review`, `merged`, `abandoned`)
- Notes

### 6.2 — Single-writer locks

Track 1's §8.2 locks remain. Track 2 may add new locks for:

- Schema migration files in `supabase/migrations/` (already in §8.2)
- New entity routes (`/api/festivals/*`, `/api/performers/*`, `/api/imports/*`) once claimed
- Import-runner code in any future `web/src/lib/imports/*` location once claimed

### 6.3 — Migration sequencing rule

**Migrations must be sequential and never parallel.** Track 2 will produce many. The active claims doc must show only one in-flight migration at a time, with `_archived` directory used for reverted/superseded.

### 6.4 — Branch and PR hygiene

- One focused PR per contract. Track 2 PRs will be smaller on average than Track 1 because the surface is wider.
- No long-lived mega branch.
- Rebase from main before opening PR.
- Do not include unrelated local files.
- Do not touch `output/` or `.claude/scheduled_tasks.lock`.

---

## 7. What's deferred or out-of-scope

Per §9 (Track 1's "Do Not Build Yet" list) — these remain deferred unless explicitly lifted:

- Undo/redo for AI patches — possibly liftable now that PR 3 telemetry exists; defer until product need surfaces.
- AI cancel/delete — possibly liftable now that PR 9 gate exists; defer pending product call.
- Full conflict resolution for multiple hosts — not yet.
- Pre-event durable image storage — not yet.
- Full festival organizer lineup management — not yet (basic festival relationships in §2B; lineup is later).
- Playwright-heavy lineup discovery — not yet.
- Multi-org account redesign — not yet.
- Bulk operations beyond import review — not yet.

These can be re-evaluated per Sami's call as Track 2 progresses.

---

## 8. Open questions for Sami

1. **§9 deferred items reconsidered.** Should AI cancel/delete and undo/redo be lifted now that PR 9 gate + PR 3 telemetry exist? My picks: yes for both, but defer until clear product need (avoid speculative work).
2. **Phase ordering.** §5 above orders categories first. Alternative: festivals first (smaller, faster ship). Pro categories: addresses live user pain. Pro festivals: faster validation of entity-relationship model. Default to categories unless you prefer festivals.
3. **Symphony Phase 2 work** lives here (§4.3). Should it move to a separate roadmap doc (`tools/symphony/docs/symphony-phase-2.md`) since Symphony is its own track? Recommended: keep here for cross-track visibility until Symphony is extracted to its own repo (if ever).
4. **Operational habits cadence.** §4.1 specifies weekly transcript review. Realistic? Or monthly to start? Recommended: monthly initially, ratchet up to weekly once dashboards make it cheap.
5. **Track 1 closure event.** After PR 11 merges, do we declare Track 1 "done" formally with a doc update (`ai-event-ops-collaboration-plan.md` gets a "Track 1 Complete" section), or roll directly into Track 2?
6. **Builder lane assignment for Track 2.** Track 1 was Codex-heavy. Should Track 2 use the same split, or should certain sub-tracks (e.g., import pipeline) go to Claude? Recommended: same split unless throughput becomes a bottleneck.

---

## 9. Definition of Done for Track 2

Track 2 is "broad live use" complete when all of:

- Categories support format and discipline as separate dimensions; non-music communities have parity with music.
- Festivals are first-class entities with parent relationships and dedicated landing pages.
- Performers are first-class entities with at least basic relationships and landing pages.
- Recurring series have stable identity surviving renames and time changes.
- URL schedule import works deterministically from JSON-LD with confident dedup; LLM fallback exists for non-structured sites with review UI.
- Re-imports detect changes and update with appropriate confidence gating.
- Telemetry covers the full graph + import surface.
- Operational habits (weekly transcript review, model ID tracking, AI origin classification) are ritualized.

Track 2 does **not** need to ship lineup management, multi-org account redesign, or undo/redo to be considered done.

---

## 10. Pre-approved remote work pattern

Mirror of collab plan §13.1 with Track 2 specifics.

### 10.1 — Pre-approved without another stop-gate

- Investigation documents under `docs/investigation/track2-*.md` (this doc, ADRs, audit reports). Docs-only, no code.
- Schema audit queries (read-only SQL).
- Eval harness extensions for new prompts (no runtime behavior change, no model-dependent CI gate).
- Operational runbooks under `docs/runbooks/`.

### 10.2 — Requires explicit Sami approval

- Any schema migration.
- Any new public route under `/api/`.
- Any new public page route.
- Any change to existing read paths (`/happenings`, `/events/[id]`, etc.).
- Any change to import pipeline once started.
- Any change to existing `events` table column shape.
- `events.ai_origin` enum addition (data classification change).
- Any prompt rewrite affecting interpret behavior.
- Any new env var or feature flag affecting runtime.

Default rule: when in doubt, treat the PR as requiring approval.

### 10.3 — Scope creep rule

Pre-approved means pre-approved only for the stated scope. Any expansion requires explicit approval in the PR.

### 10.4 — Blocked rule

When blocked on a judgment call, open the PR as a draft with the question clearly stated. Do not improvise.

---

## 11. First concrete action (recommended)

> After PR 11 merges, the recommended first Track 2 action is **Phase 5.0** in §5: documentation + telemetry consumption + test guardrail loosening. Three small PRs that close out Track 1 housekeeping and prep Track 2 for clean coordination.
>
> After 5.0 lands, the first substantive Track 2 PR is **2F.1 — AI Host Assistant ADR** (investigation-only, no code). Stop-gate before any cross-event find-and-edit code is written. This sub-track is now top priority in Track 2 sequencing per the 2026-05-01 live user testing evidence in §3 sub-track 2F.

---

## 12. Document maintenance

This document is living. Update when:

- Phase ordering changes (e.g., user feedback shifts priority).
- A sub-track ships its first PR (mark phase as "in flight").
- A deferred item gets lifted.
- An open question is answered.

Update protocol: small additive edits via coordinator PR, just like the claims doc. Larger structural changes via a stop-gate review.

---

**End — Track 2 Roadmap v1.0**

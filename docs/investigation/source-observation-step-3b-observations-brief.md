# Source Observation Step 3b — `event_source_observations` Brief

**Status:** Implementation brief — **does not authorize applying any migration**
**Lane:** Lane 6 (strategy and policy authoring)
**Created:** 2026-05-02
**Audience:** Future migration author and the reviewer for the step-3b stop-gate

**Predecessors (all merged on `main`):**

- [PR #214](https://github.com/samiserrag/denver-songwriters-collective/pull/214) — investigation: `docs/investigation/source-observation-data-model-plan.md`
- [PR #219](https://github.com/samiserrag/denver-songwriters-collective/pull/219) — decisions: `docs/investigation/source-observation-open-questions-decision-memo.md`
- [PR #222](https://github.com/samiserrag/denver-songwriters-collective/pull/222) — Step 3a brief: `docs/investigation/source-observation-step-3a-migration-brief.md`
- [PR #226](https://github.com/samiserrag/denver-songwriters-collective/pull/226) — Step 3a execute: `supabase/migrations/20260503000000_event_sources_registry.sql` (inert)
- [PR #231](https://github.com/samiserrag/denver-songwriters-collective/pull/231) — COMMUNITY-CORRECTION-01 principle in `docs/strategy/AGENTIC_EVENT_MAINTENANCE.md`
- [docs/strategy/SOURCE_REGISTRY.md](../strategy/SOURCE_REGISTRY.md) — registry & verification model (PROPOSED)
- [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md) — Draft / Proposed / Not Active

> **No production verification behavior is changed by this brief.** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed, remains the only active rule per [Phase 4.89 Confirmation Invariants](../../.claude/rules/10-web-product-invariants.md). [SOURCE-OBS-01](../CONTRACTS.md) stays Draft / Proposed / Not Active. **Approving this brief does not authorize applying the migration.** The migration PR (3b-execute) is its own stop-gate.

---

## 1. Purpose

`event_source_observations` is an **append-only evidence ledger** for what registered external sources said about events at a particular moment in time. It is not, on its own, a verification surface.

- Each row is one observation: one source × one fetch × one event listing.
- Observations are **immutable facts**. They do not change over time. Corrections happen by writing a newer observation, not by mutating an old one.
- Observations are **inputs** to a future derivation function (Step 5 in [SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md)). They do not directly produce a Confirmed/Unconfirmed badge.
- Observations are **not the derivation function**. They contain raw and normalized extracted fields plus per-fetch metadata, but the rules for collapsing many observations into a single user-visible verification label live elsewhere and ship under their own stop-gate.

The slogan: **observations are evidence; the badge is a conclusion.** Conflating them creates a database where audit trail and trust display drift apart silently. We keep them separate.

## 2. Relationship to Existing Tables

### 2.1 `event_sources` (PR-226, on `main`)

`event_source_observations.source_id` is a `NOT NULL` foreign key into `public.event_sources(id)`. Observations cannot exist without a registered source. This forces every crawler / extractor to register its source through Step 3a's gates before generating evidence.

`ON DELETE`: `RESTRICT`. We never want to drop a source whose observations still exist; they would lose their attribution. Source retirement should mark the source row as `inactive` (column not yet present; ships when source-management lands), not delete it.

### 2.2 `events`

`event_source_observations.event_id` is a foreign key into `public.events(id)`. **It must be nullable** — see §3.2 for the justification and §11.1 for the open question. When non-null, `ON DELETE`: `CASCADE` (observations of a deleted event lose their attribution and should not survive).

When `event_id IS NULL`, the observation is an **unmatched candidate**: a source listing we have not yet matched to a CSC event row. The Deduper agent (per [SOURCE_REGISTRY.md §3](../strategy/SOURCE_REGISTRY.md)) is responsible for setting `event_id` later through a controlled UPDATE — this is the **only** sanctioned UPDATE on this table; see §4.

### 2.3 `events.last_verified_at`

`event_source_observations` does **not** replace `last_verified_at`. The active confirmation rule (`last_verified_at IS NOT NULL ⇒ Confirmed`) continues to drive the badge. Step 3b ships zero readers. The derivation function (Step 5) is what eventually reads observations; the supersession step (Step 8) is what eventually retires the binary `last_verified_at` rule.

### 2.4 No FK from existing tables to `event_source_observations`

Step 3b should add no FK pointing AT `event_source_observations` from any existing table. Anything that wants to reference an observation (e.g., `event_change_log.source_observation_id` in Step 3c) ships in its own stop-gated step.

## 3. Proposed Columns

This section is opinionated. The user prompt for this brief proposed a column set; I evaluate it against the data-model-plan §4 set and recommend the merged proposal below, with each disagreement justified inline.

### 3.1 Recommended column set

| Column | Type | Constraint / Notes |
|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` |
| `event_id` | `uuid` | nullable; `REFERENCES public.events(id) ON DELETE CASCADE`. See §3.2. |
| `source_id` | `uuid` | `NOT NULL REFERENCES public.event_sources(id) ON DELETE RESTRICT` |
| `source_url` | `text` | `NOT NULL`. The URL fetched for *this* observation (may differ from `event_sources.homepage_url` / `event_sources.feed_url`). See §3.3. |
| `source_type` | `text` | `NOT NULL`. Denormalized snapshot of `event_sources.type` at observation time. See §3.4. |
| `observation_type` | `text` | `NOT NULL CHECK (observation_type IN ('found','missing','changed','cancelled','error'))`. Renamed from data-model-plan's `observation_status`. See §3.5. |
| `observed_at` | `timestamptz` | `NOT NULL DEFAULT now()` |
| `observed_title` | `text` | nullable; high-cardinality flat column for matching/dedup |
| `observed_start_at` | `timestamptz` | nullable; high-cardinality flat column for matching/dedup |
| `observed_end_at` | `timestamptz` | nullable |
| `observed_venue_name` | `text` | nullable; free-text as observed |
| `observed_location` | `text` | nullable; free-text as observed |
| `observed_ticket_url` | `text` | nullable |
| `extracted_fields` | `jsonb` | nullable; raw key→value as the parser saw the page (any extra fields beyond the flat columns above). See §3.6. |
| `extraction_confidence` | `numeric(4,3)` | nullable; `CHECK (extraction_confidence BETWEEN 0 AND 1)`. Per-fetch parser confidence. |
| `source_confidence` | `numeric(4,3)` | nullable; `CHECK (source_confidence BETWEEN 0 AND 1)`. Confidence in this source for this event. |
| `content_hash` | `text` | nullable; stable hash of normalized observation fields. Enables dedup of identical re-fetches. |
| `raw_snapshot_ref` | `text` | nullable. **Storage backend deferred per [decision-memo Q5](source-observation-open-questions-decision-memo.md).** Column ships nullable; population is a later concern. |
| `created_by_role` | `text` | `NOT NULL DEFAULT 'crawler' CHECK (created_by_role IN ('crawler','admin_seed','concierge_extract','community_evidence_fetch'))`. See §3.8. |
| `created_by` | `uuid` | nullable; `REFERENCES public.profiles(id) ON DELETE SET NULL`. Populated for admin-triggered or concierge-extract observations; null for autonomous crawler. |
| `agent_run_id` | `uuid` | nullable; **no FK in 3b**. References a future `agent_runs` table that ships with the crawler in a later step. See §11.5. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` |

### 3.2 Critique — `event_id` nullable

The user prompt asked whether `event_id` should be nullable. **Recommend nullable.** Reasoning:

- A crawler fetches a venue's events page and finds 12 listings. The Extractor produces 12 observations. The Deduper has not yet run; matching against existing CSC events is downstream.
- Two compatible designs:
  - **A.** Match-then-record: the Deduper runs *before* the observation is written. `event_id` is `NOT NULL`. New listings need an `events` row inserted first, which means observation = event-creation in the same transaction.
  - **B.** Record-then-match: the observation is written immediately with `event_id NULL`. The Deduper later sets `event_id` via the only sanctioned UPDATE.
- Design B keeps the observation pipeline simple and append-only at first. The Deduper becomes a separate, stop-gated agent step; until it ships, observations may sit with `event_id NULL` indefinitely without polluting `events`.
- Design A couples observation to event creation, which means the crawler can write to `events`. That violates the COMMUNITY-CORRECTION-01 boundary at scale: the crawler is a source agent, not the event author.

**Decision for 3b:** `event_id` nullable. Add a partial index on `event_id IS NULL` for the Deduper's review queue (see §6).

### 3.3 Critique — `source_url`

`event_sources` already has `homepage_url` and `feed_url`. Why store `source_url` per observation? Because **the URL fetched for this observation may not be either of those**. Examples:

- A venue's events page paginates: the crawler fetches `…/events?page=2`. That's the URL for the observation, but the registered source URL is `…/events`.
- An iCal feed produces multiple `VEVENT` entries from one fetch; each event's iCal `URL` field may be a different per-event link.
- A ticket page is one URL per show; the source registers a host (e.g., the venue's See Tickets store), but each event has its own page.

`source_url` captures the per-observation URL. `event_sources.homepage_url`/`feed_url` capture the canonical registration URL. Both are useful and not redundant.

### 3.4 Critique — `source_type` denormalized

The user prompt did not include `source_type`. The data-model-plan §6.1 had it. **Recommend keeping it** as a denormalized snapshot:

- The source's `type` (e.g., `civic_calendar`, `first_party_site`) at the time of observation is part of the historical record. If a source is later re-classified, old observations should still reflect the type they were classified under.
- Indexable: filtering observations by source type is common at derivation time.
- Per [decision-memo Q4](source-observation-open-questions-decision-memo.md) the principle of denormalization-with-trigger is approved; same logic applies here. No trigger ships in 3b — denormalization happens at INSERT and is then immutable (consistent with append-only).

### 3.5 Critique — `observation_type` vs `observation_status`

The user prompt says `observation_type`. Data-model-plan §4 says `observation_status`. **Same enum either way; recommend `observation_type`** because:

- "Status" implies state that can change. Observations are immutable. Calling it status sets the wrong expectation.
- "Type" describes what kind of observation event happened. Better fit.

CHECK enum: `('found','missing','changed','cancelled','error')` per data-model-plan. Definitions:

- `found` — source listed the event normally.
- `missing` — source no longer lists the event (was previously found).
- `changed` — source listed the event with material differences vs. the most recent prior observation.
- `cancelled` — source explicitly marked the event cancelled.
- `error` — fetch or extraction failed; record kept for retry / health metrics.

### 3.6 Critique — `extracted_fields` jsonb (not `normalized_fields`)

The user prompt proposed both `extracted_fields jsonb` and `normalized_fields jsonb`. **Recommend keeping only `extracted_fields jsonb`**, plus the flat columns above as the normalized canonical shape.

Reasoning:

- The flat columns (`observed_title`, `observed_start_at`, `observed_end_at`, `observed_venue_name`, `observed_location`, `observed_ticket_url`) ARE the normalized fields. They're indexable, type-checked, queryable.
- `extracted_fields jsonb` captures whatever extra raw key-value pairs the parser saw (e.g., `description`, `image_url`, `price_text`, source-specific fields). Sparse, evolvable, no migration needed when a new field appears.
- A second `normalized_fields jsonb` would either duplicate the flat columns (drift risk) or hold a strict subset of them (redundant).
- Trade-off is acknowledged: flat columns lock the canonical schema; jsonb stays flexible. We commit to the canonical schema in 3b and put the long tail of extras in jsonb. This matches the principle "model what we already need; punt what we don't yet need."

### 3.7 Critique — `conflict flags` and `possible_cancellation flag`

The user prompt proposed these as discrete columns. **Recommend NOT storing them.** Reasoning:

- `possible_cancellation` is **derivable**: it is true when the most-recent observation for an event has `observation_type = 'cancelled'` OR `observation_type = 'missing'` for an event whose start_at has not passed.
- `conflict flags` are **derivable**: a conflict exists when two recent observations (within a window) for the same event from different sources disagree on a high-impact field.
- Storing these creates a sync problem: when do they update? On every new observation? That makes observations no longer append-only.
- Indexing argument: the review queue may want fast access to "events with possible cancellations". This is a query against the latest observation per event, easily served by `(event_id, observed_at DESC)` index plus an `observation_type` filter.

**Defer materialization.** If `EXPLAIN ANALYZE` shows the derivation is slow at scale, add a materialized view in a later step (not 3b).

### 3.8 Critique — `created_by` / `agent_run_id`

The user prompt asked for `created_by / agent_run_id if appropriate`. **Recommend the three-column shape** in §3.1:

- `created_by_role text NOT NULL DEFAULT 'crawler'` — discriminates who/what generated the observation. Required for COMMUNITY-CORRECTION-01 boundary enforcement: any observation with `created_by_role = 'community_evidence_fetch'` must trace back to a community correction submission, not a freeform user write.
- `created_by uuid REFERENCES profiles(id)` — populated for admin or concierge actions; null for autonomous crawler runs.
- `agent_run_id uuid` — references a future `agent_runs` table that does not exist in 3b. No FK constraint; the column is just a uuid that the future table can join against. This avoids a chicken-and-egg dependency.

This satisfies the audit trail without creating premature schema dependencies. The COMMUNITY-CORRECTION-01 stop-gate is enforced through the `created_by_role` CHECK enum: there's no value for "user direct write".

### 3.9 Open questions deferred to §11

- Whether observations can be created from user-submitted correction evidence (`created_by_role = 'community_evidence_fetch'`) or only crawler / admin-seed sources. **Pre-recommendation:** allow `community_evidence_fetch` only when triggered by a confirmed community correction whose URL is fetched by the crawler — never as a user direct insert.
- Retention/partitioning. See [decision-memo Q3](source-observation-open-questions-decision-memo.md): defer.
- Source URL canonicalization. See §11.4.
- agent_run_id table shape. See §11.5.

## 4. Append-Only / Immutability Posture

`event_source_observations` is append-only by contract. The migration enforces this via:

- **No application-role UPDATE policy.** Only `service_role` can UPDATE, and only for the Deduper's `event_id` backfill (one column, one transition: `NULL → uuid`).
- **No application-role DELETE policy.** Retention/cleanup runs as `service_role` (admin-triggered or scheduled), never as `anon` / `authenticated` / `authenticated-admin`.
- **Corrections via supersession.** A wrong observation is corrected by inserting a newer observation, not by mutating the old one. The audit trail captures both.
- **No TRUNCATE / TRIGGER / REFERENCES privileges** to `anon` / `authenticated`. Standard tripwire.

The Deduper's `event_id` backfill is the only sanctioned mutation. It is justified because:

- The `event_id` column is the matching link, not the observed evidence. Setting it from NULL → a specific event does not change what the observation *says*; it only links it.
- The transition is one-way (`NULL → uuid`), enforced via an `UPDATE` policy with `WHERE event_id IS NULL`. Once linked, the row becomes fully immutable.

If the Deduper makes a mistake, the correction is to insert a *new* observation explicitly marking the prior link as wrong (e.g., `observation_type = 'corrected'`) — that enum value is **not in the 3b enum** and ships separately if/when needed. For 3b, an incorrect Deduper link is repaired by an admin-only `service_role` UPDATE under audit. We accept this small carve-out because the alternative (no link mutation ever) would either require Design A (match-then-record, see §3.2) or leave bad links in place forever.

Retention and partitioning are deferred. See §11.3.

## 5. RLS Posture

`ENABLE ROW LEVEL SECURITY` is mandatory per [database security invariants](../../.claude/rules/00-governance-and-safety.md). Proposed defaults:

| Role | Action | Policy | Rationale |
|---|---|---|---|
| `anon` | All | **None** | Observations are operational data, not user-facing. Public verification surfaces read derived display through API endpoints, not raw rows. No leak. |
| `authenticated` (self) | All | **None** | Same. The proposed-change queue (COMMUNITY-CORRECTION-01) is a separate surface; users do not write directly to observations. |
| `authenticated` (admin role per `public.is_admin()`) | `SELECT` | `USING (public.is_admin())` | Admin can read all observations for review-queue / debugging. |
| `authenticated` (admin role) | `UPDATE` | **None** | Admin does not directly UPDATE observations. Bad links are repaired by `service_role` under explicit audit, not by admin SQL. |
| `authenticated` (admin role) | `INSERT` | **None initially.** Add only if admin-seed becomes a real path. | Most observations come from `service_role` (crawler / concierge-extract). Admin-seed is a thin path; defer the policy until it has a writer. |
| `service_role` | All | bypass | Crawler, Deduper, retention jobs. service_role bypasses RLS by Postgres semantics; no explicit policy needed. |

**No public view in 3b.** Per [3a brief §5](source-observation-step-3a-migration-brief.md), the `event_sources_public` view was deferred until the first reader ships. Same logic applies here: no `event_source_observations_public` view in 3b. When the derivation function lands, it can read `event_sources` as `service_role` and hand a digested label to the API surface.

**Do NOT grant column-level SELECT to `authenticated`** in 3b. Even if some future surface wants to expose "last source name + observed_at" to users, that surface should compute the digest and serve it through an API endpoint, not let users SELECT the table.

## 6. Indexes

Recommended indexes for 3b (justified each):

| Index | Columns | Why |
|---|---|---|
| `idx_event_source_observations_event_observed_desc` | `(event_id, observed_at DESC)` | Newest observation per event — the dominant derivation read pattern. |
| `idx_event_source_observations_source_observed_desc` | `(source_id, observed_at DESC)` | Per-source backlog — health dashboards, source-status queries. |
| `idx_event_source_observations_observation_type` | `(observation_type)` | Review-queue filter for `missing` / `cancelled` / `error`. |
| `idx_event_source_observations_unmatched` | `(observed_at DESC) WHERE event_id IS NULL` | Partial index for the Deduper's unmatched candidate queue. |
| `idx_event_source_observations_content_hash` | `(content_hash)` | Dedup of identical re-fetches across sources. Non-unique (multiple sources may produce the same hash if they mirror the same upstream content). |

**Defer**:

- A unique index on `(event_id, source_id, content_hash)` — recommended in data-model-plan §4.2 to prevent recording an unchanged re-fetch. Worth it eventually; defer to 3b-execute if `EXPLAIN ANALYZE` on a sample workload shows it's needed. The `content_hash` solo index can also serve dedup at write time (write-path SELECT then INSERT pattern).
- A covering composite on `(event_id, observation_type, observed_at DESC)` — defer per [decision-memo Q6](source-observation-open-questions-decision-memo.md) reasoning. Add only when EXPLAIN evidence demands it.
- A GIN index on `extracted_fields` — defer until a real query against the jsonb shows up. Keep `extracted_fields` as a "long tail" bucket, not a query target in 3b.

**No partitioning in 3b** per [decision-memo Q3](source-observation-open-questions-decision-memo.md).

## 7. Compatibility Guarantees

- **Active rule unchanged.** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed. `status = 'cancelled'` always wins. [Phase 4.89 invariants](../../.claude/rules/10-web-product-invariants.md) hold byte-for-byte.
- **`web/src/lib/events/verification.ts` unchanged.** No code modification ships in 3b.
- **No badge change.** UI continues to render the existing Confirmed/Unconfirmed/Cancelled states from `last_verified_at` and `status`.
- **No admin auto-confirm change.** All paths in [Phase 4.89 §Auto-Confirmation Paths](../../.claude/rules/10-web-product-invariants.md) continue to set `last_verified_at` exactly as today.
- **No reads from `event_source_observations` in 3b.** No application code, RPC, route, or UI reads the new table. The first reader is the derivation function (Step 5), which ships under its own stop-gate.
- **No writes from app code in 3b.** Only `service_role` writes during crawler runs (which themselves are not authorized in 3b — the crawler ships under its own stop-gate).
- **Lane 5 PR A `event_audit_log` is unchanged.** `event_audit_log` records direct mutations to the trusted event record (via the existing API routes). It is a separate surface from `event_source_observations`. Lane 5 PR B scope is not expanded by 3b.
- **COMMUNITY-CORRECTION-01 unchanged.** Community corrections continue to flow through the proposed-change queue (when implemented), not through `event_source_observations`.

## 8. Derivation Boundary

3b ships the *evidence ledger*. It does not ship the rules for interpreting evidence. The boundary:

- Observations are **inputs**. They say what each source saw.
- The derivation function (Step 5) is a **pure function from observations → display label**.
- The display label is **not stored on the observation**. No `derived_state` or `verification_state` column on `event_source_observations`.
- Warning states (`possible_cancellation`, `needs_confirmation`) outrank confidence states (`source_verified`, `multi_source_confirmed`) at derivation time, per [SOURCE_REGISTRY.md §6.3](../strategy/SOURCE_REGISTRY.md). This precedence rule lives in the derivation function, not in `event_source_observations`.
- The proposed-change queue (COMMUNITY-CORRECTION-01) and `event_source_observations` are different evidence streams. Both feed the future derivation function. Neither replaces the other.

This brief does **not** activate SOURCE-OBS-01. Activation is Step 8 in the migration plan and requires its own stop-gate (with full test coverage, feature flag, and CONTRACTS.md supersession PR).

## 9. Test Plan for the Future 3b-Execute PR

The 3b-execute PR will need (at minimum):

### 9.1 CI tripwires

- **RLS tripwire** green for `event_source_observations`.
- **SECURITY DEFINER allowlist** unchanged (no new SECURITY DEFINER).
- **Postgres-owned views** — N/A (no view in 3b).
- **Privilege checks** — no new TRUNCATE/TRIGGER/REFERENCES on anon/authenticated.

### 9.2 Schema content scan (mirror of [3a brief §10.2](source-observation-step-3a-migration-brief.md) approach)

- All columns from §3.1 present with correct types and nullability.
- All CHECK constraints reject invalid values (round-trip per enum: `observation_type`, `created_by_role`).
- All FKs in §3.1 exist with the specified ON DELETE behavior.
- Required indexes from §6 exist; no UNIQUE on `(event_id, source_id, content_hash)` unless explicitly added during 3b-execute review.
- Partial index on `event_id IS NULL` exists.
- `idx_event_source_observations_event_observed_desc` is `DESC` on `observed_at`.

### 9.3 Immutability tests

- `authenticated` cannot UPDATE any observation row.
- `authenticated` (admin) cannot UPDATE any observation row.
- `service_role` can UPDATE only `event_id` (NULL → uuid). Other UPDATE attempts on observation columns by `service_role` should be rejected by an immutability trigger or convention check; if the convention is enforced only by code review, document that explicitly in the migration comment.
- `authenticated` cannot DELETE any observation row.
- `service_role` DELETE works (for admin retention only).

### 9.4 RLS tests (positive and negative)

- `anon`: cannot SELECT, INSERT, UPDATE, DELETE.
- `authenticated` (non-admin): cannot SELECT, INSERT, UPDATE, DELETE.
- `authenticated` (admin via `is_admin()`): can SELECT all rows; cannot INSERT, UPDATE, DELETE in 3b.
- `service_role`: can SELECT, INSERT, UPDATE (with `event_id` constraint above), DELETE.

### 9.5 Compatibility tests

- All `verification.ts` unit tests remain green; no behavioral diff.
- All Phase 4.89 invariants tests remain green.
- All DSC TEST suppression tests remain green.
- `event_audit_log` unit tests (Lane 5 PR A) remain green; no schema interaction.
- Discovery surfaces produce identical output before and after the migration on a representative event sample.

### 9.6 Negative tests

- `observation_type` outside the enum is rejected.
- `created_by_role` outside the enum is rejected.
- `extraction_confidence` outside `[0, 1]` is rejected.
- `source_confidence` outside `[0, 1]` is rejected.
- `source_id` referencing a nonexistent source is rejected.
- Deleting a referenced source while observations exist is rejected (ON DELETE RESTRICT).
- Deleting a referenced event cascades observations (ON DELETE CASCADE).

### 9.7 Migration guardrail / claims entry

- The 3b-execute PR must add an entry to `docs/investigation/track1-claims.md` claiming the migration file (the same guardrail that fired on 3a-execute / PR-226). The 3b-execute PR description should explicitly call this out so reviewers don't repeat the lane-discipline miss.

## 10. Rollback Plan

### 10.1 Rollback for 3b-execute (schema-only)

`DROP TABLE IF EXISTS public.event_source_observations` is sufficient as long as:

- `event_change_log` (Step 3c) has not yet shipped — it would carry an FK and prevent the drop without a coordinated rollback of both.
- No application code reads or writes the table — guaranteed in 3b by the no-readers/no-writers stance.
- No materialized view or generated column in `events` references it — guaranteed by §2.4 (no FKs from existing tables).

Migration file should include `DROP TABLE IF EXISTS public.event_source_observations` paths gated by an explicit rollback runbook, matching the 3a-execute pattern.

### 10.2 Rollback once Step 3c (event_change_log) ships

After 3c, `event_change_log.source_observation_id REFERENCES event_source_observations(id)`. To roll back 3b after 3c lands, the change log table must be dropped first (`DROP TABLE IF EXISTS public.event_change_log`) before dropping observations. The rollback runbook for 3c will document this dependency.

### 10.3 Rollback once derivation function (Step 5) ships

After Step 5, application code reads observations. Rolling back 3b at that point would break the derivation function. The rollback path becomes:

1. Set the derivation feature flag OFF (which it already is in production until Step 8).
2. Confirm no code path reads observations.
3. Drop dependent tables/views in reverse order of creation.
4. Drop `event_source_observations`.

Each step is its own runbook.

### 10.4 What is preserved through any rollback

- `events.last_verified_at` and `events.verified_by` are not touched by 3b.
- `event_audit_log` is not touched by 3b.
- All claim tables are not touched by 3b.
- `verification.ts` semantics are not touched by 3b.

## 11. Open Questions

These should be resolved before the 3b-execute migration PR opens, but are not required to land this brief.

### 11.1 `event_id` nullable vs required

**Recommended (§3.2):** nullable. Allows record-then-match design. Adds operational complexity for the Deduper. Requires the partial index on `event_id IS NULL`.

**Alternative:** `NOT NULL`. Forces match-then-record. Crawler must own event-creation. Couples the crawler to `events` writes — violates COMMUNITY-CORRECTION-01 separation.

Decision needed before 3b-execute.

### 11.2 `raw_snapshot_ref` storage backend

Per [decision-memo Q5](source-observation-open-questions-decision-memo.md): deferred. Column ships nullable. Storage backend (Supabase Storage bucket vs external object store) decided in a later stop-gated PR.

### 11.3 Retention / partitioning

Per [decision-memo Q3](source-observation-open-questions-decision-memo.md): no partitioning, no retention in 3b. Add a comment in the migration noting future review at >10M rows or 12 months.

### 11.4 `source_url` duplication vs `event_sources` canonical URLs

**Recommended (§3.3):** keep `source_url` per observation. The two URL columns (`event_sources.homepage_url`/`feed_url` vs `event_source_observations.source_url`) capture different concepts and are not redundant.

**Alternative:** drop per-observation `source_url`, derive at read time. Saves 50–200 bytes per row but loses per-pagination / per-feed-entry attribution. Reject.

### 11.5 `agent_run_id` and crawl-run identity

The `agent_run_id` column ships in 3b as a bare `uuid` with no FK. The future `agent_runs` table (or equivalent crawl-runs registry) is out of scope — it ships with the crawler in a later step.

**Open question:** does `agent_run_id` need a CHECK constraint or NOT NULL once `created_by_role = 'crawler'`? Pre-recommendation: `NULL` is allowed for now; tighten via a partial CHECK in a future step (`agent_run_id IS NOT NULL WHERE created_by_role = 'crawler'`) once the crawler exists.

### 11.6 Observations from community correction evidence

The user prompt asked: can observations be created from user-submitted correction evidence?

**Recommended:** Only via a crawler-fetch indirection. A community correction submission may cite a source URL; if the URL points at a registered source, an automated `crawler` agent run can fetch it and produce a real observation with `created_by_role = 'community_evidence_fetch'`. The community correction itself stays in the proposed-change queue. The observation is generated by *fetching* the cited URL, not by accepting user-submitted JSON.

**Anti-pattern:** allow users to insert directly into `event_source_observations` from the correction form. This would let any user write to the evidence ledger, breaking COMMUNITY-CORRECTION-01.

Decision needed before 3b-execute. The `created_by_role` enum should reflect the chosen design.

### 11.7 Immutability enforcement mechanism

**Recommended (§4):** primarily via RLS (no UPDATE/DELETE policies for app roles). Optional: add a `BEFORE UPDATE` trigger that raises if any column other than `event_id` is changed, even by `service_role`, except via a documented bypass.

**Alternative:** rely entirely on RLS + code review. Simpler; less defense-in-depth.

Decision needed before 3b-execute.

## 12. Stop-Gate Language

Per [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md) and [.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md):

- Approving this brief does **not** authorize:
  - Any SQL migration or DB apply.
  - Any application code, route, or RPC.
  - Any crawler, extractor, deduper, verifier, conflict resolver, or other agent surface.
  - Any UI, badge, label, or display change.
  - Any `verification.ts` change.
  - Any change to `event_audit_log`, the active confirmation rule, or the COMMUNITY-CORRECTION-01 boundary.
  - Activation, supersession, or modification of [SOURCE-OBS-01](../CONTRACTS.md). It remains Draft / Proposed / Not Active.
  - Any backfill execution.
- The 3b-execute migration PR is its own stop-gate. It must:
  - Cite this brief and the predecessors above.
  - Resolve the open questions in §11 with an explicit decision per item.
  - Add a `track1-claims.md` entry for the new migration file.
  - Include the full test plan in §9.
  - State no production verification behavior changes.
  - Not be combined with crawler / derivation / UI / API work.

## 13. Non-Goals (Explicit)

This brief does **not**:

- Author or commit any SQL migration.
- Modify [`web/src/lib/events/verification.ts`](../../web/src/lib/events/verification.ts) or any other application code.
- Add or modify any API/MCP/crawler/RPC route.
- Modify the verification UI, badge component, or any rendered surface.
- Change any admin auto-confirm path.
- Activate, supersede, or otherwise modify [SOURCE-OBS-01](../CONTRACTS.md).
- Begin operational ingestion of any external source.
- Authorize backfill execution.
- Authorize the 3b migration itself.
- Authorize any subsequent step (3c `event_change_log`, 3d `artist_claims`, 3e claim_status trigger, 4–8 derivation/UI/supersession).
- Expand Lane 5 PR B scope.

---

**End of brief. Approval records the recommended shape; the 3b-execute migration PR is its own stop-gate.**

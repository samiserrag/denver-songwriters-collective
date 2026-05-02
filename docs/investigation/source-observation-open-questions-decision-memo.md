# Source Observation Open Questions — Decision Memo

**Status:** Investigation / decision memo only — no schema, code, or behavior change authorized
**Lane:** Lane 6 (strategy and policy authoring)
**Created:** 2026-05-02
**Audience:** Repo agents, contributors, future migration author
**Predecessors:**
- [docs/investigation/source-observation-data-model-plan.md](source-observation-data-model-plan.md) — Investigation plan that raised these questions
- [docs/strategy/SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md) — Migration plan
- [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md) — Draft / Proposed / Not Active contract
- [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md) — Stop-gates

> **No production verification behavior is changed by this memo.** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed, remains the only active rule per [.claude/rules/10-web-product-invariants.md §Confirmation Invariants (Phase 4.89)](../../.claude/rules/10-web-product-invariants.md). [SOURCE-OBS-01](../CONTRACTS.md) stays Draft / Proposed / Not Active. Approving this memo does not authorize any migration, code, or implementation work.

---

## 1. Purpose

Resolve the six open questions raised in [source-observation-data-model-plan.md §13](source-observation-data-model-plan.md). Each section below summarizes the issue, recommends a default, walks the tradeoffs, names whether the decision blocks the first migration PR, and notes rollback / compatibility posture.

The output of approving this memo is a set of *decisions* that the future step-1 migration PR can cite. It does **not** authorize that PR; the migration still requires its own stop-gate per [GOVERNANCE.md](../GOVERNANCE.md).

## 2. Method

For each question this memo answers:

- **Issue** — one-paragraph framing.
- **Recommendation** — the proposed default.
- **Tradeoffs** — what we gain, what we give up, what we keep optional.
- **Blocks first migration PR?** — Yes / No, with the reason.
- **Rollback / compatibility** — how to undo the decision and what guarantees hold.

Cross-cutting invariants apply to every recommendation:

- `last_verified_at IS NOT NULL ⇒ Confirmed` remains the only active rule.
- SOURCE-OBS-01 stays Draft / Proposed / Not Active.
- Trust Layer Invariant ([.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md)) is non-negotiable.
- Each numbered step in [SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md) and [source-observation-data-model-plan.md §9](source-observation-data-model-plan.md) is its own future stop-gate.

---

## Q1. Artist subject type for `artist_claims`

### 1.1 Issue

The investigation proposes `artist_claims.artist_subject_id` as a foreign key target, but the repo has no `artists` table. Artist identity is currently expressed through:

- `profiles.role` — `user_role` enum, default `'performer'` (see `supabase/migrations/20250101000000_init_schema.sql`).
- `profiles.is_host` — boolean (`20251209000005_add_is_host_to_profiles.sql`).
- `events.host_id` and cohost references — both reference `profiles(id)`.
- Showcase lineup via the `rpc_admin_set_showcase_lineup` RPC.

There is no separate `artists` entity. Should `artist_claims.artist_subject_id` reference `profiles(id)` directly, or should we introduce an `artists` table first?

### 1.2 Recommendation

**Reference `profiles(id)` directly.** Include an `artist_subject_type` discriminator column on `artist_claims` with the initial CHECK constraint `IN ('profile')` only. Do not create an `artists` table in this phase. Widen the discriminator's allowed values later (e.g. to `'artist_record'` or `'band_record'`) only if a non-profile-backed artist concept becomes necessary.

### 1.3 Tradeoffs

**Pros of `profiles(id)` direct FK:**

- Matches the current model exactly. Artists are profiles.
- `verified_by`, `host_id`, claim flows all reference `profiles(id)` — consistency.
- RLS policies on `profiles` already cover the actor.
- No new entity to model or migrate.

**Cons:**

- If CSC later wants to model artists who are not registered users (touring acts, bands without member accounts), `profiles(id)` is wrong because it requires a profile row to exist for every claim subject.
- Coupling the claim graph to `profiles` may complicate future deletion semantics if artists become a first-class entity.

**Pros of an `artists` table first:**

- Cleaner long-term data model.
- Supports stub records for unregistered acts.
- Decouples claim graph from authentication.

**Cons:**

- Doubles modeling work for unclear near-term value.
- Forces every other artist-shaped reference (host_id, lineup, future modifiers) to either migrate or split.
- Out of scope for the SOURCE-OBS-01 phase; better delivered as its own ADR if/when needed.

**Why include the discriminator at all:**

- One small column is cheap forward-compat insurance.
- Schema-level discrimination beats a string convention later.
- Initial CHECK with only `'profile'` keeps the surface tight; widening later is a single ALTER on the CHECK constraint.

### 1.4 Blocks first migration PR?

**No** — but the discriminator column should be added in the same migration that creates `artist_claims`. Adding it after the table ships would require a backfill to populate it for existing rows. Including it from day one costs nothing.

### 1.5 Rollback / compatibility

- No `events` columns change. `last_verified_at` behavior preserved.
- If the discriminator proves unused, dropping the column is a single ALTER TABLE.
- If we later need an `artists` table, we can add it, add `'artist_record'` to the discriminator's CHECK, and migrate selected rows over time. Existing `('profile')` rows continue to work unchanged.

---

## Q2. `event_sources` naming and uniqueness

### 2.1 Issue

The investigation introduced an `event_sources` registry table referenced by every observation. Two sub-questions:

- **Naming:** Could readers misread `event_sources` as a per-event-per-source join table?
- **Uniqueness:** Should `(homepage_url)` or `(feed_url)` be unique on `event_sources` to prevent duplicate registry rows?

### 2.2 Recommendation

**Naming — keep `event_sources`** but include a one-line table comment in the migration that disambiguates: *"Registry of external data sources (one row per registered source). Per-fetch facts live in `event_source_observations`."* The table comment is visible via `\d+ event_sources` and shows up in introspection tools, so the disambiguation is durable beyond docs.

**Uniqueness — no unique constraint on URL columns at table-create.** Optionally add a partial unique on `(feed_url, type) WHERE feed_url IS NOT NULL` only after operator review surfaces a real duplicate-feed problem.

### 2.3 Tradeoffs

**Naming:**

- Pro `event_sources`: parallels `event_claims`, `event_change_log`, `event_source_observations`. The plural suffix is consistent.
- Con `event_sources`: could be parsed as "(event, source) pairs" by someone scanning quickly.
- Alternative `sources`: cleaner singular, but loses the event-domain prefix that the rest of the namespace uses.
- Alternative `event_source_registry`: most explicit, longest. Adds a token without changing meaning.
- The table comment closes the gap with negligible cost.

**Uniqueness:**

- Pro unique on `(homepage_url)`: simple dedup; one row per source site.
- Con: a single venue can legitimately have multiple sources — homepage, iCal feed, ticket page — each with different `type`, `risk_tier`, and crawl cadence. Forcing them into one row mis-models the truth.
- Pro unique on `(feed_url)`: feed_url, when present, is a stable identifier.
- Con: many sources have no feed; partial-unique handles this but adds complexity. Premature.
- Operator review (claim/correction flow) covers duplicate detection without DB enforcement.
- Unique constraints are cheap to add later but expensive to remove if application code starts assuming them.

### 2.4 Blocks first migration PR?

**No** for both naming and uniqueness. The table comment is a minor migration addition. The decision to omit unique constraints is itself zero-cost.

### 2.5 Rollback / compatibility

- No active behavior touched.
- Naming: a future rename via `ALTER TABLE … RENAME TO …` is a coordinated change that touches application code and FKs. Avoidable only if we stay disciplined about the table comment.
- Uniqueness: a partial unique can be added later via `CREATE UNIQUE INDEX CONCURRENTLY`. Removing one is also straightforward.

---

## Q3. Observation retention

### 3.1 Issue

`event_source_observations` is append-only. With aggressive crawl cadences across hundreds of sources, the table can grow large. Should the migration ship with partitioning or a retention policy?

### 3.2 Recommendation

**Ship without partitioning or retention.** Add a code comment in the migration noting future partitioning intent. Trigger a retention review at the smaller of `>10M rows` or 12 months operating time, whichever comes first.

### 3.3 Tradeoffs

**Pros of partitioning at table-create:**

- Easier than retrofit. Postgres declarative partitioning by `observed_at` quarter is the natural shape.
- Drop-old-partition is the cleanest "retention" path.

**Cons:**

- Zero rows today. Partition design without traffic data is speculative.
- Postgres declarative partitioning has known footguns: indexes, FKs, and trigger inheritance all behave differently. Premature partitioning often costs more than it saves.
- Crawler activity is not yet authorized; observation volume is unknown.

**Pros of explicit retention policy (drop > N months):**

- Bounds growth deterministically.

**Cons:**

- Loses history that may matter for cancellation / dispute investigation.
- Ages out the very data the change-log derives from.

**Pros of deferring:**

- Schema stays simple. Decisions wait for real traffic.
- A future partitioning retrofit is doable with a maintenance window when needed.

### 3.4 Blocks first migration PR?

**No.** A single one-line comment in the migration noting the deferred decision is sufficient.

### 3.5 Rollback / compatibility

- No active behavior touched.
- If retention is later needed, a scheduled `DELETE` job with a comment on the migration suffices for a first pass.
- If partitioning is later needed, retrofit via `pg_partman` or a manual repartition window. Append-only data is among the easier cases for partition retrofit.

---

## Q4. `event_sources.claim_status` denormalization

### 4.1 Issue

The investigation proposed `claim_status` as a denormalized column on `event_sources`, computed from rows in `venue_claims`, `organization_claims`, and (future) `artist_claims`. Should we keep the denormalized column, or always compute live?

### 4.2 Recommendation

**Keep the denormalized column.** Maintain via a trigger that fires on `INSERT`, `UPDATE`, `DELETE` of relevant claim tables when a claim row reaches `'approved'` status or transitions out of it. Add a low-frequency reconciliation job to detect and correct drift.

### 4.3 Tradeoffs

**Pros of denormalization:**

- `claim_status` is read on every observation graduation and every public verification render. A 3-table JOIN per render is real cost at scale.
- Indexable. The proposed `claim_status IN ('claimed_by_venue', 'claimed_by_artist', 'claimed_by_organization')` filter is fast with a denormalized column.
- Lets the future derivation function be a pure read against `event_sources` plus claim row checks for the specific approved row, not a full JOIN graph traversal.

**Cons:**

- Triggers can drift if claim tables change schema.
- Denormalized state can desync from canonical claim rows under concurrent writes if trigger logic has a bug.
- Adds a new place where claim semantics live.

**Mitigations:**

- A nightly reconciliation job audits and corrects drift. Logs any correction so we can spot trigger bugs.
- Trigger lives in a single migration file with the tables it depends on. Schema changes to claim tables must update the trigger as part of their PR.

**Pros of compute-always:**

- No trigger maintenance.
- No drift risk.
- Single source of truth — claim rows.

**Cons:**

- Performance regression at scale.
- Read paths become more complex (must always join multiple claim tables).

### 4.4 Blocks first migration PR?

**No.** The bare table-create can ship `claim_status` as a `text` column with default `'unclaimed'` and no trigger. The trigger and reconciliation job arrive in a follow-up step (between table-create and the first writer). Until claim rows can map to source rows, `claim_status` stays at its default.

### 4.5 Rollback / compatibility

- No active behavior touched.
- If denormalization causes ongoing pain, drop the column and refactor reads to compute live. The trigger can be removed independently of the column.
- The reconciliation job is a stand-alone service — easy to disable.

---

## Q5. `raw_snapshot_ref` storage

### 5.1 Issue

`event_source_observations` includes a `raw_snapshot_ref` column intended to point at the raw HTML / JSON-LD / iCal payload that produced the observation. Where do we put the actual snapshot data — Supabase Storage, external object store, inline blob, or defer?

### 5.2 Recommendation

**Defer the storage decision.** Ship the column as nullable `text`. Population is deferred to a separate stop-gate-governed PR that designs the snapshot store, after which `raw_snapshot_ref` is populated by writers as a key/path string. Likely future shape: a Supabase Storage bucket with immutable-by-default policy and per-source path prefixes.

### 5.3 Tradeoffs

**Pros of deferring:**

- No infrastructure decision needed for the schema-only step.
- Avoids prematurely committing to a storage backend before observation traffic exists to inform the decision.
- Keeps the migration small.

**Cons:**

- If snapshots become urgently useful for dispute resolution before the deferred decision lands, we have a gap.

**Pros of inline `text` blob:**

- Simplest path. No external dependency.

**Cons:**

- Postgres TOAST handles large rows but per-snapshot read patterns and sizes are wrong fit.
- Balloons row sizes; degrades observation table scan performance.
- Coupling the snapshot to row replication (PITR, backups) increases backup size and restore time.

**Pros of Supabase Storage:**

- Fits existing infra. Bucket-level RLS plus path-as-key. Easy lifecycle policy.
- Stable interfaces for read/write from server functions.

**Cons:**

- Requires deciding retention and immutability policy.
- Adds a write step to crawler pipelines.

**Pros of external (S3 / R2):**

- Maximum flexibility and cost control.

**Cons:**

- Adds an external dependency to the verification path. Operational complexity.

### 5.4 Blocks first migration PR?

**No.** Column is nullable and stays nullable until the storage decision is made.

### 5.5 Rollback / compatibility

- Column nullable. No data exists in this phase.
- If the storage strategy decision later changes the path format, no migration is required (column is `text`). Writers reformat at write time.

---

## Q6. `event_change_log` index strategy

### 6.1 Issue

The investigation proposed three indexes on `event_change_log`: `(event_id, changed_at DESC)`, `(change_severity)`, `(source_observation_id)`. Should we also add a covering composite index on `(event_id, change_severity, changed_at DESC)` to support common review-queue queries?

### 6.2 Recommendation

**Defer the covering composite index.** Ship the three indexes already proposed. Add `(event_id, change_severity, changed_at DESC)` only if `EXPLAIN ANALYZE` on a representative review-queue query (after observation traffic exists) shows the planner choosing a sequential scan or an inefficient bitmap combine.

### 6.3 Tradeoffs

**Pros of covering composite:**

- Review-queue queries (e.g. "all material+ changes in the last 7 days for events with upcoming dates") can be index-only.
- Fast filter + sort in one pass.

**Cons:**

- Indexes are not free. Each composite index adds write cost and disk usage.
- Without observation traffic, we'd be optimizing for hypothetical patterns.
- The combination of `(event_id, changed_at DESC)` + a separate filter on `change_severity` may already be acceptable via index combine for low-volume tables.

**Pros of deferring:**

- Smaller initial schema.
- Decision waits for real query patterns and `EXPLAIN` evidence.

**Cons:**

- A short-term query regression is possible early in observation rollout. Mitigated by the fact that no production reader exists in early steps.

### 6.4 Blocks first migration PR?

**No.** The first migration ships `event_change_log` with the three already-proposed indexes; the covering composite is a later DBA decision.

### 6.5 Rollback / compatibility

- Pure DBA decision. Indexes can be added or dropped at any time via `CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY`.
- No active behavior change either way.

---

## 3. Summary

| # | Question | Recommendation | Blocks step-1 migration? |
|---|---|---|---|
| 1 | `artist_claims.artist_subject_id` target | `profiles(id)` direct FK + `artist_subject_type` discriminator with initial values `('profile')` only; no `artists` table this phase | No — but discriminator must be in the same migration |
| 2 | `event_sources` naming and uniqueness | Keep `event_sources` name; add disambiguating table comment; **no** unique constraint on URL columns at table-create | No |
| 3 | Observation retention | No partitioning, no retention; one-line comment noting future review at >10M rows or 12 months | No |
| 4 | `event_sources.claim_status` denormalization | Keep denormalized; trigger maintenance + reconciliation job; trigger arrives after bare table-create | No |
| 5 | `raw_snapshot_ref` storage | Defer; column nullable; storage backend decision in a separate stop-gate-governed PR | No |
| 6 | `event_change_log` index strategy | Ship the three already-proposed indexes; defer covering composite; add only on `EXPLAIN ANALYZE` evidence | No |

**Net effect:** none of the six open questions block the future step-1 migration PR. The artist_subject_type discriminator is the one decision that, if accepted, must be folded into the same migration that creates `artist_claims`. Everything else can be added or revisited later without re-migration.

## 4. Stop-Gates

Per [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md) and [.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md):

- Approving this memo records *decisions* about the open questions; it does **not** authorize any migration, code, route, MCP surface, or UI change.
- The first migration PR (step 1 in [SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md) and [source-observation-data-model-plan.md §9](source-observation-data-model-plan.md)) requires its own stop-gate with its own paste-ready prompt.
- Each subsequent step in the migration plan retains its own stop-gate.
- The Trust Layer Invariant remains non-negotiable across every step.
- SOURCE-OBS-01 stays Draft / Proposed / Not Active.

## 5. Non-Goals (Explicit)

This decision memo does **not**:

- Author or commit any SQL migration.
- Modify [web/src/lib/events/verification.ts](../../web/src/lib/events/verification.ts) or any other application code.
- Add or modify any API/MCP/crawler/RPC route.
- Modify the verification UI, badge component, or any rendered surface.
- Change any admin auto-confirm path.
- Activate, supersede, or otherwise modify [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md). It remains Draft / Proposed / Not Active.
- Begin operational ingestion of any external source.
- Authorize backfill execution.
- Authorize any of the eight migration steps in §9 of the investigation plan.

---

**End of decision memo. Approval records the recommended defaults for the six open questions; each future step still requires its own stop-gate.**

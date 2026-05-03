# Source Observation Step 3b — Open Questions Decision Memo

**Status:** Decision memo — **does not authorize applying any migration**
**Lane:** Lane 6 (strategy and policy authoring)
**Created:** 2026-05-02
**Audience:** Future migration author and the reviewer for the step-3b stop-gate

**Predecessors (all merged on `main`):**

- [PR #214](https://github.com/samiserrag/denver-songwriters-collective/pull/214) — investigation: `docs/investigation/source-observation-data-model-plan.md`
- [PR #219](https://github.com/samiserrag/denver-songwriters-collective/pull/219) — decision memo on the six open questions for Step 3a / general data model
- [PR #222](https://github.com/samiserrag/denver-songwriters-collective/pull/222) — Step 3a brief: `docs/investigation/source-observation-step-3a-migration-brief.md`
- [PR #226](https://github.com/samiserrag/denver-songwriters-collective/pull/226) — Step 3a execute: `supabase/migrations/20260503000000_event_sources_registry.sql` (inert)
- [PR #231](https://github.com/samiserrag/denver-songwriters-collective/pull/231) — `COMMUNITY-CORRECTION-01` principle in `docs/strategy/AGENTIC_EVENT_MAINTENANCE.md`
- [PR #234](https://github.com/samiserrag/denver-songwriters-collective/pull/234) — Step 3b brief: `docs/investigation/source-observation-step-3b-observations-brief.md`
- [docs/strategy/SOURCE_REGISTRY.md](../strategy/SOURCE_REGISTRY.md) — registry & verification model (PROPOSED)
- [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md) — Draft / Proposed / Not Active

> **No production verification behavior is changed by this memo.** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed, remains the only active rule per [Phase 4.89 Confirmation Invariants](../../.claude/rules/10-web-product-invariants.md). [SOURCE-OBS-01](../CONTRACTS.md) stays Draft / Proposed / Not Active. **Approving this memo does not authorize applying any migration.** The 3b-execute migration PR is its own stop-gate.

---

## 1. Purpose

Resolve the seven open questions raised in [§11 of the Step 3b brief](source-observation-step-3b-observations-brief.md). For each question this memo captures:

- **Issue** — one-paragraph framing.
- **Recommendation** — the proposed default.
- **Tradeoffs** — what we gain, what we give up, what stays optional.
- **Blocks 3b-execute?** — Yes / No, with the reason.
- **Migration implication** — exact column/index/policy effect.
- **Rollback / compatibility** — how to undo and what guarantees hold.
- **Tests required** — what the 3b-execute PR must include.
- **COMMUNITY-CORRECTION-01 preservation** — explicit check.
- **`last_verified_at` preservation** — explicit check.

The output of approving this memo is a decision record the future 3b-execute migration PR can cite. It does **not** authorize that PR; the migration still requires its own stop-gate per [GOVERNANCE.md](../GOVERNANCE.md).

## 2. Bias

This memo prefers, in tension cases:

- **Conservative defaults.** Defer until evidence demands.
- **No premature tables or FKs.** Schema dependencies that require a future table to exist are deferred until that table actually ships.
- **Inert observations.** No reader, no public surface, no derivation in 3b. Observations are evidence; the badge is a conclusion.
- **Strict COMMUNITY-CORRECTION-01.** Community corrections never write observations directly. The crawler-fetch indirection is the only sanctioned path.
- **Append-only evidence.** Once written, an observation is immutable. Corrections happen by writing a newer observation, not by mutating an old one.

These biases are restated in the recommendations where applicable.

## 3. Cross-cutting invariants

These hold across every recommendation below:

- `last_verified_at IS NOT NULL ⇒ Confirmed` remains the only active rule.
- SOURCE-OBS-01 stays Draft / Proposed / Not Active.
- Trust Layer Invariant ([.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md)) is non-negotiable.
- `event_audit_log` shape and semantics are unchanged. Lane 5 PR B scope is not expanded.
- COMMUNITY-CORRECTION-01 boundary is preserved: observations are crawler / admin / concierge evidence; community corrections live in a separate proposed-change queue.
- Each step in [SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md) and the 3b brief retains its own future stop-gate.

---

## Q1. `event_id` nullable vs required

### 1.1 Issue

Should `event_source_observations.event_id` be `NOT NULL` (match-then-record) or nullable (record-then-match)? The match-then-record design forces the crawler to create an `events` row whenever it discovers a new listing. The record-then-match design lets observations exist with `event_id IS NULL` until a separate Deduper agent links them.

### 1.2 Recommendation

**`event_id` is `NULL`-allowed.** Foreign key to `public.events(id) ON DELETE CASCADE`. Add a partial index on `(observed_at DESC) WHERE event_id IS NULL` for the Deduper's review queue.

### 1.3 Tradeoffs

**Pros of nullable (record-then-match):**

- Crawler does not own event creation. Crawler is a source agent, not the event author. Preserves COMMUNITY-CORRECTION-01 by keeping evidence-fetch and event-author paths separate.
- Observation pipeline is simple and append-only at first. The Deduper becomes a separate, stop-gated agent step.
- Until the Deduper ships, observations may sit with `event_id NULL` indefinitely without polluting `events`.
- Partial-index pattern is well-supported in Postgres and used elsewhere in the repo (e.g. `idx_org_claims_pending_unique WHERE status = 'pending'`).

**Cons of nullable:**

- Requires an `event_id NULL → uuid` UPDATE path (Deduper). That UPDATE is a small, well-defined carve-out from append-only.
- Adds a partial index to the schema.

**Pros of required (match-then-record):**

- Cleaner FK invariant; never any "orphan" observations.

**Cons of required:**

- Forces crawler to create `events` rows. The crawler becomes the event author for new listings, which violates COMMUNITY-CORRECTION-01 separation.
- Couples the observation pipeline to event creation in the same transaction. Harder to evolve.

### 1.4 Blocks 3b-execute?

**No, but the column shape must be finalized in the 3b-execute migration.** The decision is not a prerequisite stop-gate; the migration PR cites this memo and ships the nullable column.

### 1.5 Migration implication

```
event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
-- (no NOT NULL)

CREATE INDEX IF NOT EXISTS idx_event_source_observations_unmatched
  ON public.event_source_observations(observed_at DESC)
  WHERE event_id IS NULL;
```

### 1.6 Rollback / compatibility

- Rollback is `DROP TABLE IF EXISTS public.event_source_observations` per [3b brief §10.1](source-observation-step-3b-observations-brief.md). The nullable column is dropped with the table.
- No effect on `events.last_verified_at` or `events.verified_by`.
- If the design is later regretted, switching to `NOT NULL` requires a full backfill of `event_id` and removal of the partial index. That is its own future stop-gate.

### 1.7 Tests required

- Schema test: `event_id` is nullable; FK exists with `ON DELETE CASCADE`; partial index `WHERE event_id IS NULL` exists.
- Round-trip: insert observation with `event_id = NULL`, then `service_role` UPDATE to set `event_id`. Both succeed.
- Negative: `authenticated` (admin) cannot UPDATE `event_id`.
- Cascade test: deleting a referenced `events` row removes its observations.

### 1.8 COMMUNITY-CORRECTION-01 preservation

✅ Direct preservation. The crawler does not write to `events`. Evidence and event-authoring stay on separate paths.

### 1.9 `last_verified_at` preservation

✅ Unaffected. The new column is in a new table; no read or write of `last_verified_at` in 3b.

---

## Q2. `raw_snapshot_ref` storage backend

### 2.1 Issue

`event_source_observations.raw_snapshot_ref` is intended to point at the raw HTML / JSON-LD / iCal payload that produced the observation. Where do we store the snapshot — Supabase Storage, external object store, inline blob, or defer the choice?

### 2.2 Recommendation

**Defer the storage backend choice.** Ship `raw_snapshot_ref text` nullable. Population is deferred to a separate stop-gate-governed PR that designs the snapshot store. Likely future shape: a Supabase Storage bucket with immutable-by-default policy and per-source path prefixes.

### 2.3 Tradeoffs

**Pros of deferring:**

- No infrastructure decision needed for the schema-only step.
- Avoids prematurely committing to a backend before observation traffic exists to inform the choice.
- Keeps the migration small.
- Mirrors the same call already made in [decision memo Q5 (PR #219)](source-observation-open-questions-decision-memo.md).

**Cons of deferring:**

- If snapshots become urgently needed for dispute resolution before the storage decision lands, we have a gap. Acceptable: dispute resolution can use the structured fields (`observed_title`, `observed_start_at`, etc.) plus `source_url` to re-fetch on demand.

**Pros of inline `text` blob:**

- Zero external dependency.

**Cons of inline `text` blob:**

- Per-snapshot sizes and read patterns are wrong fit; balloons row sizes.
- Couples snapshot storage to row replication (PITR, backups), increasing backup size and restore time.

**Pros of Supabase Storage now:**

- Fits existing infra. Bucket-level RLS plus path-as-key.

**Cons of Supabase Storage now:**

- Requires deciding retention and immutability policy without traffic data.
- Adds a write step to crawler pipelines that don't yet exist.

### 2.4 Blocks 3b-execute?

**No.** Column ships nullable; no constraint or default.

### 2.5 Migration implication

```
raw_snapshot_ref TEXT,  -- nullable; storage backend deferred
```

No additional DDL. No view, no function, no helper.

### 2.6 Rollback / compatibility

- Column nullable; no data exists in 3b.
- If the storage backend later changes path format, no migration is required (column is `text`). Writers reformat at write time.

### 2.7 Tests required

- Schema test: column exists, is `text`, is nullable.
- Insert with `raw_snapshot_ref = NULL` succeeds.
- Insert with `raw_snapshot_ref = 'storage/path/example'` succeeds (no validation in 3b).

### 2.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected.

### 2.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q3. Retention / partitioning

### 3.1 Issue

`event_source_observations` is append-only. With aggressive crawl cadences across many sources, the table can grow large. Should the migration ship with partitioning, retention policy, or neither?

### 3.2 Recommendation

**Ship without partitioning or retention.** Add a one-line code comment in the migration noting future review at the smaller of `>10M rows` or 12 months operating time.

### 3.3 Tradeoffs

**Pros of partitioning at table-create:**

- Easier than retrofit. Postgres declarative partitioning by `observed_at` quarter is natural.
- Drop-old-partition is the cleanest "retention" path.

**Cons of partitioning:**

- Zero rows today. Partition design without traffic data is speculative.
- Postgres declarative partitioning has known footguns (indexes, FKs, trigger inheritance behave differently).
- Observation traffic depends on the crawler, which doesn't yet exist.

**Pros of explicit retention:**

- Bounds growth deterministically.

**Cons of explicit retention:**

- Loses history needed for cancellation / dispute investigation.
- Ages out the very data the change-log derives from.

**Pros of deferring:**

- Schema stays simple; decisions wait for real traffic.
- Append-only data is among the easier cases for partition retrofit when needed.

### 3.4 Blocks 3b-execute?

**No.** A single comment line in the migration suffices.

### 3.5 Migration implication

A comment in the migration file:

```sql
-- Retention/partitioning intentionally deferred (Q3, this memo).
-- Revisit at >10M rows or 12 months operating time.
```

No DDL effect.

### 3.6 Rollback / compatibility

- No active behavior touched.
- A future scheduled `DELETE` job is a first-pass retention path with no rebuild required.
- Future partitioning retrofit (via `pg_partman` or manual repartition window) is doable for append-only tables.

### 3.7 Tests required

- None specific. The CI tripwire still applies; no new policy-change risk.

### 3.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected.

### 3.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q4. `source_url` per-observation vs derived

### 4.1 Issue

`event_sources` already has `homepage_url` and `feed_url`. Why store `source_url` per observation? Is it redundant?

### 4.2 Recommendation

**Keep `source_url text NOT NULL` per observation.**

### 4.3 Tradeoffs

**Pros of keeping per-observation:**

- The URL fetched for *this* observation may not be the registered homepage or feed URL. Examples: paginated venue calendars, per-event iCal `URL` fields, per-show ticket-platform pages. Storing the per-fetch URL preserves correct attribution.
- Useful for debugging crawler / extractor issues.
- Not redundant with `event_sources.homepage_url`/`feed_url` — those describe the registered source, not the per-fetch URL.

**Cons of keeping:**

- ~50–200 bytes per row. Not material at any plausible scale relative to other text columns.

**Pros of dropping (deriving):**

- Smaller rows.

**Cons of dropping:**

- Loses pagination / per-feed-entry / per-show attribution. Cannot reconstruct the exact fetch URL from `event_sources` alone.
- Makes crawler debugging harder.

### 4.4 Blocks 3b-execute?

**No.** Column shape is straightforward.

### 4.5 Migration implication

```
source_url TEXT NOT NULL,
```

### 4.6 Rollback / compatibility

- Rollback: with the table.
- No effect on `event_sources`.

### 4.7 Tests required

- Schema test: `source_url` is `text NOT NULL`.
- Negative: insert without `source_url` fails.
- Insert with `source_url` distinct from `event_sources.homepage_url`/`feed_url` succeeds.

### 4.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected.

### 4.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q5. `agent_run_id` constraints

### 5.1 Issue

The 3b brief proposes `agent_run_id uuid` with no FK in 3b, on the basis that the future `agent_runs` table doesn't exist yet. Should the column ship nullable, with no constraint, no FK, no CHECK? Should `agent_run_id` be required when `created_by_role = 'crawler'`?

### 5.2 Recommendation

**Ship `agent_run_id uuid` nullable. No FK. No CHECK constraint in 3b.** Tighten with a partial CHECK once the `agent_runs` table (or equivalent) exists in a later step.

### 5.3 Tradeoffs

**Pros of nullable + no FK + no CHECK:**

- Avoids a chicken-and-egg dependency on a future table.
- Preserves option value: future `agent_runs` schema can evolve without forcing a column type change here.
- Bias-aligned: no premature tables or FKs.

**Cons of nullable + no FK + no CHECK:**

- Allows `NULL` even for crawler-role observations until the crawler exists. Acceptable in 3b because the crawler does not exist; no observations are written yet.

**Pros of CHECK now (`agent_run_id IS NOT NULL WHERE created_by_role = 'crawler'`):**

- Locks in the design contract immediately.

**Cons of CHECK now:**

- The crawler does not exist. The constraint would apply to a writer that hasn't been built. If the crawler design later varies (e.g., one observation per crawl-batch instead of one per crawl-run), the CHECK becomes a backfill problem.

### 5.4 Blocks 3b-execute?

**No.**

### 5.5 Migration implication

```
agent_run_id UUID,  -- nullable; no FK; no CHECK in 3b
```

### 5.6 Rollback / compatibility

- Rollback: with the table.
- Future tightening is a separate ALTER. Adding a partial CHECK is straightforward; adding an FK requires `agent_runs` to exist first.

### 5.7 Tests required

- Schema test: column is `uuid`, nullable, no FK, no CHECK in 3b.
- Insert with `agent_run_id = NULL` succeeds.

### 5.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected. Boundary enforcement lives in `created_by_role`, not in `agent_run_id`.

### 5.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q6. Community-evidence observations

### 6.1 Issue

Can observations be created from user-submitted correction evidence? If yes, by what path? The `created_by_role` enum proposed in the 3b brief includes `'community_evidence_fetch'` as a value. Does that authorize a user-driven write path?

### 6.2 Recommendation

**Crawler-fetch indirection only. No user-direct insert path.** A community correction submitter may cite a source URL as evidence; the system optionally schedules a crawler agent run to fetch that URL; the resulting observation carries `created_by_role = 'community_evidence_fetch'` and is written by `service_role`. The community correction itself stays in the proposed-change queue (per COMMUNITY-CORRECTION-01).

### 6.3 Tradeoffs

**Pros of indirection only:**

- Preserves COMMUNITY-CORRECTION-01: observations are records of what an authorized fetch saw, not user-asserted JSON.
- Every observation traces to an authorized crawler / admin / concierge action.
- Community-evidence fetch is auditable (traces to the cited URL and the correction submission).

**Cons of indirection only:**

- The correction submitter's evidence is not immediately reflected in observations; must wait for the crawler fetch.
- Requires the crawler to exist before community-evidence observations can populate (acceptable; the crawler ships under its own stop-gate).

**Pros of allowing direct insert from user form:**

- Faster reflection of community evidence in the verification graph.

**Cons of allowing direct insert:**

- Breaks COMMUNITY-CORRECTION-01 — users would be writing observation rows. Observations would no longer be "what the source said" but "what the user said the source said."
- Opens an attack surface: a malicious user could fabricate observations to influence verification.
- Conflates the proposed-change queue with the evidence ledger.

### 6.4 Blocks 3b-execute?

**Yes for design clarity (the enum and RLS posture must reflect the chosen path), no for migration timing.** The 3b-execute migration ships the `created_by_role` enum including `'community_evidence_fetch'`, with RLS preventing `authenticated` (any role) from INSERT. The crawler-fetch indirection itself is built later.

### 6.5 Migration implication

```
created_by_role TEXT NOT NULL DEFAULT 'crawler' CHECK (created_by_role IN (
  'crawler',
  'admin_seed',
  'concierge_extract',
  'community_evidence_fetch'
)),
```

RLS:

- No INSERT policy for `anon`.
- No INSERT policy for `authenticated` (including admin) in 3b.
- service_role INSERT (Postgres bypass).

The CHECK enum has **no value for "user direct write"** — a community correction must trace back to a crawler / admin / concierge action that wrote the observation.

### 6.6 Rollback / compatibility

- Rollback: with the table.
- Adding a new enum value later (e.g., `'admin_correction'`) requires an `ALTER` of the CHECK constraint.
- COMMUNITY-CORRECTION-01 is structurally enforced — no migration to "add user direct write" can succeed without amending the brief and the principle.

### 6.7 Tests required

- Schema test: enum CHECK rejects values outside the four listed roles.
- RLS positive: `service_role` can insert with any of the four roles.
- RLS negative (critical): `authenticated` (non-admin) cannot insert. `authenticated` (admin) cannot insert in 3b. `anon` cannot insert.
- Negative: insert with `created_by_role = 'user_direct'` fails.

### 6.8 COMMUNITY-CORRECTION-01 preservation

✅ **Strong preservation.** The decision codifies the boundary at the schema level: the enum values exhaustively enumerate authorized writers; "user direct write" is not among them; RLS denies user inserts entirely.

### 6.9 `last_verified_at` preservation

✅ Unaffected.

---

## Q7. Immutability enforcement mechanism

### 7.1 Issue

Observations are append-only by contract. The 3b brief proposes RLS-deny + optional immutability trigger. Should the migration ship the trigger now, or rely on RLS-deny alone?

### 7.2 Recommendation

**Ship 3b with RLS-deny only.** No immutability trigger in 3b. Defer trigger consideration to a later step if a real concern emerges.

### 7.3 Tradeoffs

**Pros of RLS-deny only:**

- Simpler migration. Less code surface to review.
- App roles cannot UPDATE / DELETE observations; the only mutation path is the Deduper's `event_id NULL → uuid`, gated by `service_role` and code review.
- Aligned with the bias toward conservative defaults and minimal premature complexity.

**Cons of RLS-deny only:**

- Defense is at the role boundary, not at the row boundary. If a service_role-side bug accidentally UPDATEs columns other than `event_id`, RLS alone does not catch it. Code review and integration tests are the defense.

**Pros of trigger now:**

- Defense-in-depth. Catches accidental service_role mutations even when the application code has a bug.
- Trigger can raise an exception when any column other than `event_id` is changed.

**Cons of trigger now:**

- Adds a `SECURITY INVOKER` function and trigger to the migration. More surface to review.
- The trigger must allow the `event_id NULL → uuid` transition, which means it has its own carve-out logic.
- Future schema changes (column add/rename) must update the trigger, or it falsely blocks legitimate writes.

### 7.4 Blocks 3b-execute?

**No.** RLS posture is sufficient for shipping. A trigger can ship later without dependent changes.

### 7.5 Migration implication

- RLS posture: no UPDATE policy for any app role; no DELETE policy for any app role; admin SELECT only; service_role bypass.
- No `BEFORE UPDATE` trigger function in 3b.

### 7.6 Rollback / compatibility

- Rollback: RLS policies drop with the table. Nothing to undo separately.
- If the trigger is later added, its own migration ships under stop-gate review; that future migration can be rolled back independently.

### 7.7 Tests required

- RLS negative: `anon` cannot UPDATE / DELETE / INSERT.
- RLS negative: `authenticated` (non-admin) cannot UPDATE / DELETE / INSERT.
- RLS negative: `authenticated` (admin) cannot UPDATE / DELETE / INSERT (in 3b).
- RLS positive: `service_role` can UPDATE `event_id` from NULL to a valid uuid.
- RLS / behavioral: `service_role` UPDATE of any column other than `event_id` is **not blocked** in 3b (acknowledged gap; defense-in-depth lives in code review). Future trigger work would tighten this.
- Append-only test: an attempt to UPDATE through the API surface (none exists in 3b) returns 403 / 405.

### 7.8 COMMUNITY-CORRECTION-01 preservation

✅ Unaffected. Immutability concerns row mutation; COMMUNITY-CORRECTION-01 concerns who can write at all. The two are independent.

### 7.9 `last_verified_at` preservation

✅ Unaffected.

---

## 4. Summary

| # | Question | Recommendation | Blocks 3b-execute? |
|---|---|---|---|
| 1 | `event_id` nullable vs required | Nullable; FK ON DELETE CASCADE; partial index `WHERE event_id IS NULL` | No — but column shape is final once memo is approved |
| 2 | `raw_snapshot_ref` storage backend | Defer; column nullable `text`; no constraint | No |
| 3 | Retention / partitioning | Defer; one-line comment for future review at >10M rows or 12 months | No |
| 4 | `source_url` per-observation vs derived | Keep `text NOT NULL` per observation | No |
| 5 | `agent_run_id` constraints | Nullable `uuid`; no FK; no CHECK in 3b | No |
| 6 | Community-evidence observations | Crawler-fetch indirection only; no user-direct insert; enum has no "user direct write" value | Yes for design clarity (enum + RLS); no for migration timing |
| 7 | Immutability enforcement mechanism | RLS-deny only in 3b; defer trigger | No |

**Net effect:** of the seven open questions, only Q6 has hard 3b-execute design implications (the `created_by_role` enum and RLS posture must encode "no user direct write"). Everything else is column-nullability or deferral. None blocks the 3b-execute migration from shipping; Q6 shapes its content.

## 5. Stop-Gates

Per [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md) and [.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md):

- Approving this memo records *decisions* about the seven open questions; it does **not** authorize any migration, code, route, MCP surface, crawler, derivation function, badge, UI, or DB apply.
- The 3b-execute migration PR (the actual SQL for `event_source_observations`) requires its own stop-gate, citing this memo and the 3b brief.
- The crawler / Deduper / derivation function / supersession steps each retain their own stop-gates per [SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md).
- Trust Layer Invariant remains non-negotiable.
- COMMUNITY-CORRECTION-01 boundary is enforced structurally by the `created_by_role` enum and RLS posture above.
- SOURCE-OBS-01 stays Draft / Proposed / Not Active.

## 6. Non-Goals (Explicit)

This memo does **not**:

- Author or commit any SQL migration.
- Modify [`web/src/lib/events/verification.ts`](../../web/src/lib/events/verification.ts) or any other application code.
- Add or modify any API/MCP/crawler/RPC route.
- Modify the verification UI, badge component, or any rendered surface.
- Change any admin auto-confirm path.
- Activate, supersede, or otherwise modify [SOURCE-OBS-01](../CONTRACTS.md). It remains Draft / Proposed / Not Active.
- Begin operational ingestion of any external source.
- Authorize backfill execution.
- Authorize the 3b migration itself.
- Authorize any subsequent step (3c `event_change_log`, 3d `artist_claims`, 3e claim_status trigger, 4–8 derivation/UI/supersession).
- Expand Lane 5 PR B scope.
- Touch `event_audit_log`.

---

**End of memo. Approval records the recommended defaults for the seven Step 3b open questions; the 3b-execute migration PR is its own stop-gate.**

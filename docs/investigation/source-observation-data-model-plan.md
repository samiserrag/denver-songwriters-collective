# Source Observation Data Model Investigation Plan

**Status:** Investigation only — no schema, code, or behavior change authorized by this document
**Lane:** Lane 6 (strategy and policy authoring)
**Created:** 2026-05-02
**Audience:** Repo agents, contributors, future migration author
**Predecessors:**
- [docs/strategy/SOURCE_REGISTRY.md §9](../strategy/SOURCE_REGISTRY.md) — Migration plan for SOURCE-OBS-01
- [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md) — Draft / Proposed / Not Active contract
- [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md) — Stop-gates

> **No production verification behavior is changed by this investigation.** `last_verified_at IS NOT NULL ⇒ Confirmed`, otherwise Unconfirmed, remains the only active rule per [.claude/rules/10-web-product-invariants.md §Confirmation Invariants (Phase 4.89)](../../.claude/rules/10-web-product-invariants.md). SOURCE-OBS-01 stays Draft / Proposed / Not Active.

---

## 1. Purpose

This document is the next documented step in the SOURCE-OBS-01 migration plan: it proposes the data model needed to eventually activate observation-driven verification, while preserving the current `last_verified_at` invariant. It does not authorize any schema migration, application code, API/MCP/crawler route, or verification UI change.

The output of approving this investigation is a separate, future stop-gate-governed prompt that authorizes a single migration PR (or a small numbered series). Each subsequent code/UI/feature-flag step is its own stop-gate after that.

## 2. Active State Recap (What Exists Today)

### 2.1 Active verification logic

[web/src/lib/events/verification.ts](../../web/src/lib/events/verification.ts) returns one of `confirmed | unconfirmed | cancelled`:

1. `status === 'cancelled'` → `cancelled`.
2. `last_verified_at IS NOT NULL` → `confirmed`.
3. Otherwise → `unconfirmed`.

`events.last_verified_at` and `events.verified_by` are set by the auto-confirmation paths listed in [Phase 4.89 Confirmation Invariants](../../.claude/rules/10-web-product-invariants.md): community-create + publish, first publish, republish, PublishButton, and admin verify (bulk and inline). Import/seed paths intentionally do not auto-confirm.

### 2.2 Existing claim infrastructure

Three claim tables exist with a consistent shape (id, target_id, requester_id, message, status, rejection_reason, reviewed_at, reviewed_by, created_at, updated_at):

| Table | Migration | Target |
|---|---|---|
| `event_claims` | `20260101300000_event_claims.sql` | `events.id` |
| `venue_claims` (+ `venue_managers`, `venue_invites`) | `20260112000000_abc8_venue_claiming.sql` | `venues.id` |
| `organization_claims` (+ `organization_managers`) | `20260317224500_organizations_claims_and_managers.sql` | `organizations.id` |

All have RLS enabled. `venue_claims` and `organization_claims` reference `profiles(id)`; `event_claims` references `auth.users(id)`. Status enum is `pending | approved | rejected` (+ `cancelled` on the venue and organization tables).

There is no `artist_claims` table. Artist identity is currently expressed through host/cohost references on events and through user profiles, not through a first-class claim row.

### 2.3 What does not exist

- No `event_source_observations` table.
- No `event_change_log` table.
- No `artist_claims` table.
- No source registry table.
- No derivation function or read-time verification model beyond the binary `last_verified_at` rule.

## 3. Scope of This Investigation

### 3.1 In scope

- Proposed shape of `event_source_observations` and `event_change_log`.
- Proposed shape of `artist_claims` to complete the venue/artist/organization triad.
- How `claimed_by_organization` integrates alongside `claimed_by_venue` and `claimed_by_artist` modifiers in the future derivation.
- Migration order (proposed, not authorized).
- RLS posture for each new table.
- Compatibility plan that preserves every active `last_verified_at` rule.
- Rollback plan.
- Tests required before activation.
- Explicit stop-gates.

### 3.2 Out of scope

- Any actual SQL migration file.
- Any application code, API route, RPC, RLS test, MCP surface, or crawler.
- Any verification UI/badge change.
- Any change to [web/src/lib/events/verification.ts](../../web/src/lib/events/verification.ts).
- Any admin auto-confirm behavior change.
- Any active CONTRACTS.md supersession.
- Any backfill execution.

## 4. Proposed: `event_source_observations`

One row per source × per fetch attempt against an event. Append-only. Drives the future derivation function.

### 4.1 Proposed columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `event_id` | `uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE` | |
| `source_id` | `uuid NOT NULL REFERENCES event_sources(id) ON DELETE RESTRICT` | Source registry FK (see §6). |
| `source_url` | `text NOT NULL` | URL fetched for this observation. |
| `source_type` | `text NOT NULL` | Mirrors `event_sources.type` for fast queries. |
| `risk_tier` | `text NOT NULL` | A/B/C/D/E/F snapshot (see [INGESTION_AND_FAIR_COMPETITION.md §5](../strategy/INGESTION_AND_FAIR_COMPETITION.md)). |
| `observed_at` | `timestamptz NOT NULL DEFAULT now()` | When the fetch resolved. |
| `observed_title` | `text` | |
| `observed_start_at` | `timestamptz` | |
| `observed_end_at` | `timestamptz` | |
| `observed_venue_name` | `text` | Free-text as observed. |
| `observed_location` | `text` | Free-text as observed. |
| `observed_ticket_url` | `text` | |
| `observation_status` | `text NOT NULL CHECK (observation_status IN ('found','missing','changed','cancelled','error'))` | |
| `extraction_confidence` | `numeric(4,3) CHECK (extraction_confidence BETWEEN 0 AND 1)` | Per-fetch parser confidence. |
| `source_confidence` | `numeric(4,3) CHECK (source_confidence BETWEEN 0 AND 1)` | Confidence in this source for this event. |
| `content_hash` | `text` | Stable hash of normalized observation fields. |
| `raw_snapshot_ref` | `text` | Object-store key or null; never inline blob. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

### 4.2 Proposed indexes

- `(event_id, observed_at DESC)` — newest observation per event.
- `(source_id, observed_at DESC)` — per-source backlog.
- `(observation_status)` — filter `missing` / `cancelled` / `error` for the review queue.
- `(content_hash)` — dedupe across sources (non-unique; multiple sources may share a hash).
- Unique `(event_id, source_id, content_hash)` — defends against re-recording an unchanged observation against the same source.

### 4.3 Append-only posture

Observations are facts, not state. UPDATE/DELETE policies should be denied for normal users; corrections happen by inserting a new row. This simplifies audit, replay, and rollback, and avoids re-introducing mutable verification state.

## 5. Proposed: `event_change_log`

One row per observed delta against an event's currently-published representation, derived from observations. Used for `details_changed_recently`, `possible_cancellation`, and review-queue routing.

### 5.1 Proposed columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `event_id` | `uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE` | |
| `changed_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `field_name` | `text NOT NULL` | e.g. `start_at`, `venue`, `ticket_url`, `status`. |
| `old_value` | `text` | Stringified prior value (event canonical). |
| `new_value` | `text` | Stringified new value (observation canonical). |
| `source_observation_id` | `uuid REFERENCES event_source_observations(id) ON DELETE SET NULL` | The observation that triggered the entry, if any. |
| `change_severity` | `text NOT NULL CHECK (change_severity IN ('minor','material','cancellation_risk'))` | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

### 5.2 Proposed indexes

- `(event_id, changed_at DESC)` — recent deltas per event.
- `(change_severity)` — pull cancellation-risk and material entries into the review queue.
- `(source_observation_id)` — trace deltas back to the triggering observation.

## 6. Proposed: Source Registry Backbone — `event_sources`

The registry is referenced from every observation and is required before any crawler ships. It is also the natural home for `risk_tier` per [INGESTION_AND_FAIR_COMPETITION.md §5](../strategy/INGESTION_AND_FAIR_COMPETITION.md).

### 6.1 Proposed columns

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `type` | `text NOT NULL CHECK (type IN ('claimed_feed','first_party_site','first_party_calendar','civic_calendar','nonprofit_calendar','aggregator_public','ticket_page','community_submission','concierge_created'))` | Mirrors [SOURCE_REGISTRY.md §2](../strategy/SOURCE_REGISTRY.md). |
| `risk_tier` | `text NOT NULL CHECK (risk_tier IN ('A','B','C','D','E','F'))` | |
| `display_name` | `text NOT NULL` | |
| `homepage_url` | `text` | |
| `feed_url` | `text` | |
| `robots_summary` | `text` | One-line policy snapshot. |
| `terms_summary` | `text` | One-line ToS snapshot. |
| `default_cadence_minutes` | `integer NOT NULL` | |
| `last_fetch_at` | `timestamptz` | |
| `last_fetch_status` | `text` | |
| `claim_status` | `text NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed','claimed_by_venue','claimed_by_artist','claimed_by_organization'))` | Aligns with secondary modifier badges. |
| `claimed_by_venue_id` | `uuid REFERENCES venues(id) ON DELETE SET NULL` | |
| `claimed_by_organization_id` | `uuid REFERENCES organizations(id) ON DELETE SET NULL` | |
| `claimed_by_artist_id` | `uuid REFERENCES profiles(id) ON DELETE SET NULL` | Artist as user; revisits if `artists` table is introduced. |
| `created_at` / `updated_at` | `timestamptz` | |

### 6.2 Notes

- A source need not be claimed; tier-D community calendars frequently are not.
- `claim_status` is computed from the FK-pointed claim row(s), not authoritative on its own. Reads should derive from claim rows; this column is an indexable cache.
- `risk_tier='F'` rows must never produce published events; enforce in derivation, not via DELETE.

## 7. Proposed: Strengthened Claim Records

### 7.1 Existing tables — keep as-is for this phase

- `event_claims` (FK → `events`, requester `auth.users`, status `pending|approved|rejected`).
- `venue_claims`, `venue_managers`, `venue_invites` (FK → `venues`, requester `profiles`).
- `organization_claims`, `organization_managers` (FK → `organizations`, requester `profiles`).

No reshaping is proposed in this phase. The existing tables already satisfy the "claimed_verified" primary state for events, venues, and organizations.

### 7.2 New table — `artist_claims`

Currently absent. The SOURCE-OBS-01 secondary modifier `claimed_by_artist` cannot be derived without a first-class claim row. Proposed shape mirrors the existing pattern:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `artist_subject_id` | `uuid NOT NULL` | Open question: does this point at `profiles(id)` (current pattern) or at a future `artists(id)` table? See §13. |
| `artist_subject_type` | `text NOT NULL CHECK (artist_subject_type IN ('profile','future_artist'))` | Forward-compatible discriminator. |
| `requester_id` | `uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` | |
| `message` | `text` | |
| `status` | `text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled'))` | |
| `rejection_reason` | `text` | |
| `reviewed_at` | `timestamptz` | |
| `reviewed_by` | `uuid REFERENCES profiles(id) ON DELETE SET NULL` | |
| `cancelled_at` | `timestamptz` | |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

Indexes follow the existing pattern: `(artist_subject_id)`, `(requester_id)`, `(status)`, plus a partial unique index on `(artist_subject_id, requester_id) WHERE status = 'pending'`.

### 7.3 Modifier badge wiring

The future derivation function reads from claim rows, not from a denormalized flag:

| Modifier | Driven by |
|---|---|
| `claimed_by_venue` | An approved `venue_claims` row covering the event's `venue_id`, OR an approved `venue_managers` row, valid at observation time. |
| `claimed_by_artist` | An approved `artist_claims` row whose `artist_subject_id` resolves to a profile linked to the event as host or named in the lineup. |
| `claimed_by_organization` | An approved `organization_claims` row covering an organization linked to the event (host org or hosting series). |

`event_claims` is a separate concept — claim *of an event row* — and continues to power direct event ownership. The three modifiers above identify the *party type* whose claim corroborates the event; the primary state (`claimed_verified`) is the confidence assertion.

## 8. Proposed: RLS Posture

All new tables ship with RLS enabled per [SECURITY.md](../../SECURITY.md) and the database security invariants in [.claude/rules/00-governance-and-safety.md §Security: Database Invariants](../../.claude/rules/00-governance-and-safety.md). Proposed defaults (subject to the security review during the migration PR):

| Table | `anon` | `authenticated` (self) | `authenticated` (admin role) | `service_role` |
|---|---|---|---|---|
| `event_sources` | SELECT non-sensitive cols (display_name, type, homepage_url, claim_status) | SELECT non-sensitive cols | INSERT/UPDATE/DELETE | All |
| `event_source_observations` | None | None | SELECT all; INSERT via API only | All |
| `event_change_log` | None | None | SELECT all | All |
| `artist_claims` | None | INSERT own; SELECT own; UPDATE own (cancel) | SELECT all; UPDATE for review | All |

Notes:

- Observations and change-log are operational data, not user-facing. Do not expose them through `anon`. Public verification surfaces read derived display via API endpoints, not raw rows.
- All four tables must satisfy the four database invariants (RLS enabled; SECURITY DEFINER not callable by anon/public unless allowlisted; postgres-owned views use `security_invoker=true`; no TRUNCATE/TRIGGER/REFERENCES privileges for anon/authenticated). Verified at the security tripwire CI gate.

## 9. Proposed Migration Order

Each step below is a *proposed* future stop-gate-governed PR. None are authorized by this document.

| # | Step | Outcome |
|---|---|---|
| 1 | Add `event_sources` table + indexes + RLS policies (no rows yet) | Source registry exists; nothing references it yet. |
| 2 | Add `event_source_observations` table + indexes + RLS policies + FK to `event_sources` | Append-only fact log exists; no writers yet. |
| 3 | Add `event_change_log` table + indexes + RLS policies + FK to `event_source_observations` | Delta log exists; no writers yet. |
| 4 | Add `artist_claims` table + indexes + RLS policies + partial unique index | Triad complete with venue/organization. |
| 5 | Read-only derivation function in TypeScript (no UI change, no DB columns demoted) | Function exists; not yet wired into any rendered surface. Tests required (see §11). |
| 6 | Feature-flagged badge component variant that calls the derivation function and falls back to the existing binary badge when the flag is off | Production default OFF. Internal QA only. |
| 7 | Backfill plan: for each event, synthesize one observation and one source if `last_verified_at IS NOT NULL` and a host source can be inferred. Idempotent. Off by default. | Existing confirmed events render unchanged with the flag off; with the flag on, they continue to read as `claimed_verified` or `source_verified`. |
| 8 | CONTRACTS.md supersession activation PR (retires the binary `last_verified_at` invariant) | Active model flips to derivation. Old invariant kept as deprecated reference for one release cycle. |

Steps 1–4 can be a single migration PR or four; the migration author decides at stop-gate time. Steps 5–8 are separate.

## 10. Compatibility Plan

The hard rule for every step before #8: **no production verification behavior changes.**

- `last_verified_at IS NOT NULL ⇒ Confirmed` continues to drive every public surface that reads it (badge, "Confirmed: …" date, DSC TEST suppression, Persisted-State Confirmation Rule, all of [Phase 4.89](../../.claude/rules/10-web-product-invariants.md)).
- All existing auto-confirmation paths continue to set `last_verified_at` on the same triggers.
- Derivation function in step 5 is read-only and called by no rendered surface in production.
- Step 6 introduces the new derivation behind a feature flag default-OFF in production. With the flag off, the existing badge component renders, byte-for-byte unchanged.
- Step 7 backfills observations *into a separate table*. It does not modify any column on `events`.
- Step 8 (supersession) is the only step that changes user-visible verification behavior, and it is its own stop-gate with its own checklist.

## 11. Tests Required Before Activation

These are mandatory before step 8 (supersession). They are also gates for steps 5 and 6 in their reduced scope.

### 11.1 Database

- RLS tripwire (existing CI gate) green for the new tables.
- Postgres-owned view checks (`security_invoker=true` allowlist) green.
- Unit tests on each FK / unique-index / partial-unique-index.

### 11.2 Derivation function

Coverage matrix across:

- All 7 primary states (`unconfirmed`, `found`, `source_verified`, `multi_source_confirmed`, `claimed_verified`, `needs_confirmation`, `possible_cancellation`).
- All 7 secondary modifiers (`details_changed_recently`, `last_checked_recently`, `ticket_link_active`, `source_conflict`, `claimed_by_venue`, `claimed_by_artist`, `claimed_by_organization`).
- Precedence: warning states outrank confidence states (every confidence × warning combination).
- Determinism: same inputs ⇒ same `EventVerificationDisplay` (snapshot test).
- Explainability: each output's `explanation` string names the evidence used (string-match assertion).
- `last_verified_at` parity: with no observations and `last_verified_at IS NOT NULL`, the derived primary state is `source_verified` (or equivalent) so the existing "Confirmed" badge text continues to feel correct under the new model.
- Cancelled override: `events.status = 'cancelled'` always wins over any derived state.

### 11.3 UI / integration

- Snapshot tests on the badge component for each rendered label combination.
- Feature-flag-off snapshot equals the current production badge for all sample events.
- DSC TEST suppression continues to fire under both old and new code paths.

### 11.4 Trust layer

- Any paid-tier surface that interacts with verification badges must demonstrate identical badges and identical `explanation` strings between paid and unpaid users. Trust is never pay-to-play (per [.claude/rules/00-governance-and-safety.md §Trust Layer Invariant](../../.claude/rules/00-governance-and-safety.md)).

## 12. Rollback Plan

### 12.1 Rollback for steps 1–4 (schema-only)

- Drop the new tables. They are not referenced by any code or feature surface.
- No data on the `events` table changes; no rollback is needed for `events` columns.
- Migration files include `DROP TABLE IF EXISTS` paths, gated by an explicit rollback runbook.

### 12.2 Rollback for step 5 (derivation function)

- Remove the function and its tests. No callers in production.

### 12.3 Rollback for step 6 (feature-flagged UI)

- Set the flag OFF (already the production default). The existing badge component continues to render identically.
- Optionally remove the variant component; the flag stays as a vestigial config until step 8.

### 12.4 Rollback for step 7 (backfill)

- Backfill writes only to `event_source_observations`. Rollback is `DELETE FROM event_source_observations WHERE source_id IN (synthetic_source_ids)`. No event row is touched.

### 12.5 Rollback for step 8 (supersession)

- Re-enable the legacy binary path. Document the path back (it stays available until the deprecated period closes).
- `last_verified_at` is preserved through every step. Even after supersession, the column remains as a reporting field, populated from the most recent qualifying observation.

## 13. Open Questions

These should be resolved before the step-1 migration PR is opened, but are not required to land this investigation.

1. **Artist subject type.** Should `artist_claims.artist_subject_id` reference `profiles(id)` (current pattern), or should we introduce an `artists` table first? Proposed answer: keep `profiles(id)` for now; add `artist_subject_type` discriminator for forward compatibility.
2. **Source registry uniqueness.** Should `(homepage_url)` or `(feed_url)` be unique to prevent duplicate registry rows? Proposed answer: no unique constraint; allow multiple registrations against the same URL with different types/risk tiers; rely on operator review.
3. **Observation retention.** Append-only is durable but grows unbounded. Proposed answer: ship without partitioning; revisit at >10M rows or 12 months, whichever first. Add a comment to the migration noting the future partitioning intent.
4. **`event_sources.claim_status` denormalization.** Worth keeping as an indexable cache, or compute always? Proposed answer: keep it; refresh via a trigger at claim approval/rejection.
5. **`raw_snapshot_ref` storage.** Object store path? Proposed answer: out of scope for this phase. The column is added with `NULL` permitted; population is a later concern.
6. **Index strategy for `event_change_log`.** Add a covering index on `(event_id, change_severity, changed_at DESC)`? Proposed answer: defer to migration PR; add only if EXPLAIN shows index regression.

## 14. Stop-Gates

Per [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md) and [.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md):

- Approving this investigation does **not** authorize any migration, code, route, MCP surface, or UI change.
- Each numbered step in §9 is its own stop-gate. The migration author must produce an investigation memo or paste-ready prompt for each.
- Step 8 (CONTRACTS.md supersession) requires explicit Sami approval and cannot be combined with any earlier step's PR.
- The Trust Layer Invariant is non-negotiable across every step. Verification badges, source attribution, last-checked timestamps, correction flow, and opt-out path remain public-good surfaces that may not be gated, degraded, deprioritized, or differentiated by paid tier.

## 15. Non-Goals (Explicit)

This investigation does **not**:

- Author or commit any SQL migration.
- Modify [web/src/lib/events/verification.ts](../../web/src/lib/events/verification.ts) or any other application code.
- Add or modify any API/MCP/crawler/RPC route.
- Modify the verification UI, badge component, or any rendered surface.
- Change any admin auto-confirm path.
- Activate, supersede, or otherwise modify [docs/CONTRACTS.md §SOURCE-OBS-01](../CONTRACTS.md). It remains Draft / Proposed / Not Active.
- Begin operational ingestion of any external source.
- Authorize backfill execution.

---

**End of investigation. Approval of this document is approval of the design direction only. Each step in §9 requires its own stop-gate.**

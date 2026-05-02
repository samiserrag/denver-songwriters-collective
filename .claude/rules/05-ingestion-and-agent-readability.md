---
paths:
  - "**/*"
---

# Ingestion & Agent-Readability Stop-Gates

This file enforces the strategy in `docs/strategy/INGESTION_AND_FAIR_COMPETITION.md`, `docs/strategy/SOURCE_REGISTRY.md`, and `docs/strategy/AGENTIC_EVENT_MAINTENANCE.md`. It exists to keep new ingestion, write API, and agent surfaces from outpacing the policy that protects them.

## Scope

Applies to any change that:

- Adds, removes, or re-classifies an external data source.
- Adds or modifies a crawler, extractor, verifier, deduper, or conflict resolver.
- Adds or modifies a write API (REST, MCP, internal RPC) reachable by users or agents.
- Adds or modifies the verification display model, badge logic, or publish decision matrix.
- Touches `event_source_observations`, `event_change_log`, or any claim table once those exist.

If a PR touches any of the above, the stop-gate rules below are required.

---

## Stop-Gate Requirements

### 1. Source registration is required before crawling

A new external data source ships only with:

- A `source_id` and risk tier (A–F per `INGESTION_AND_FAIR_COMPETITION.md §5`).
- A robots.txt and terms-of-service summary in the PR description.
- A budgeted crawl cadence aligned with `INGESTION_AND_FAIR_COMPETITION.md §10`.
- A claim/correction/opt-out path, even if manual.

Default-deny if any of the above is missing.

### 2. Crawler output is draft until validated

No crawler is permitted to write directly to a published event. All crawler output enters via the observation/draft path described in `SOURCE_REGISTRY.md §3`. PRs that bypass this are rejected.

### 3. New write API ships sandboxed

Any new write API (REST, MCP, internal) starts behind:

- Authentication that matches the human equivalent.
- A feature flag default-off in production.
- Rate limits and structured logs.
- An explicit graduation criterion in the PR description.

### 4. Agent-created events are draft until verified or claimed

Conversational creation per `EVENTS-NL-01` is the only currently active agent-write path. Any new agent-write path must follow the same draft → preview → user-confirm shape and cite `AGENTIC_EVENT_MAINTENANCE.md §3`.

### 5. Conflicts go to a review queue, not silent merge

Cross-source disagreements, claim contests, and material change-log entries route to the review queue described in `AGENTIC_EVENT_MAINTENANCE.md §6`. PRs that auto-resolve conflicts without human or claimed-source review are rejected.

### 6. High-risk changes require human or claimed-source review

Cancellations, date changes, venue changes, and ticket-link replacements are high-risk. They require either an active claim or operator review before publish.

### 7. Trust layer is never pay-to-play

Operational restatement of the high-level invariant in `00-governance-and-safety.md`.

> Verification badges, source attribution, last-checked timestamps, correction flow, and opt-out path are public-good surfaces. They must not be gated, degraded, deprioritized, or differentiated by payment tier.

PRs that introduce any paid-tier differentiation in the trust layer are rejected, regardless of revenue impact.

### 8. Active confirmation contract is unchanged

Until the verification migration in `SOURCE_REGISTRY.md §9` ships under stop-gate review, `last_verified_at` remains the source of truth for the confirmation badge per `CONTRACTS.md §Confirmation Invariants`. PRs that change badge derivation, label text, or DB-truth source for verification without that migration are rejected.

### 9. Community corrections create proposed changes, not direct mutation

Authenticated users without an approved claim covering the target entity cannot directly mutate trusted event records via the concierge or any agent-write surface. PRs that introduce a write path bypassing this discipline are rejected.

Per the `COMMUNITY-CORRECTION-01` section in `docs/strategy/AGENTIC_EVENT_MAINTENANCE.md` (referenced by stable anchor, not section number):

- Approved hosts, venue managers, organization managers, and artists with active claims may direct-write within their claim scope. High-risk fields (date, time, venue, cancellation, ticket URL, organizer identity) remain gated by §6 above even for authorized actors.
- Everyone else submits proposed changes that route to a review queue distinct from `event_audit_log`.
- Proposed changes carry an evidence bundle: field-level diff, submitter identity when available, source URLs, AI confidence notes, and a review status. The exact enum of review statuses is deferred to the implementation PR.
- Bulk edits from unclaimed or unrelated actors require admin review regardless of authentication. The exact operational definition of "bulk" is deferred to the implementation PR.
- Paid status must not contribute to contributor reputation, directly or indirectly. Trust Layer Invariant from `00-governance-and-safety.md` applies in full.

The proposed-change queue is a separate surface from `event_audit_log` (Lane 5) and from future `event_source_observations` (SOURCE-OBS-01). This rule does not authorize implementing any of those tables, queues, routes, or UIs; it enforces the separation when an implementation PR is later proposed. Lane 5 PR B scope is not expanded by this rule.

---

## PR Checklist Add-Ons

For PRs in scope, the existing `00-governance-and-safety.md` Definition of Done applies, plus:

- [ ] Cited strategy doc(s)
- [ ] Source risk tier (if applicable)
- [ ] Draft-until-proven path documented
- [ ] Graduation criteria documented
- [ ] Trust layer untouched OR stop-gate-approved migration step
- [ ] Cadence / rate budget documented
- [ ] Robots/terms summary attached for new external sources

---

## Authority

This rule does not replace `00-governance-and-safety.md`; it adds operational stop-gates for the ingestion and agent-readability surface area. The high-level invariants live in `00`. The enforcement steps live here.

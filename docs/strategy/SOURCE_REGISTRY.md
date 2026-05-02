# Source Registry & Verification Model (Proposed)

**Status:** PROPOSED — not active
**Version:** 0.1 (draft)
**Last Updated:** 2026-05-02
**Audience:** Repo agents, contributors, system designers
**Supersedes:** Nothing yet. Active confirmation behavior remains as defined in [CONTRACTS.md](../CONTRACTS.md) §Confirmation Invariants.

> **This document describes a future state. Until the data model, derivation function, and migration ship under stop-gate approval, the existing `last_verified_at` invariant is the source of truth for event verification display.**

---

## 1. Purpose

This document is the architectural plan for how CSC will (eventually) decide what to publish, how to label trust, and how to keep the event graph honest at scale. It is the design counterpart to the policy in [INGESTION_AND_FAIR_COMPETITION.md](INGESTION_AND_FAIR_COMPETITION.md).

## 2. Source Type Taxonomy

Sources are classified by **type** (where the data comes from) and **risk tier** (the trust budget — see [INGESTION_AND_FAIR_COMPETITION.md §5](INGESTION_AND_FAIR_COMPETITION.md)).

| Type | Examples |
|---|---|
| `claimed_feed` | Venue/artist/org-owned iCal feed authorized via claim |
| `first_party_site` | Venue/artist/org website event page |
| `first_party_calendar` | Venue/artist/org Google Calendar set public |
| `civic_calendar` | City, county, library calendar |
| `nonprofit_calendar` | Community, faith, civic-arts org calendar |
| `aggregator_public` | Permissive third-party listing |
| `ticket_page` | Ticket platform page where factual extraction is permitted |
| `community_submission` | Human-submitted via CSC create flow |
| `concierge_created` | Conversational AI flow per `EVENTS-NL-01` |

Each registered source carries: `source_id`, type, risk tier, robots/terms summary, contact URL, default crawl cadence, last fetch metadata, claim status.

## 3. Agent System Pipeline

```text
Source Discovery   → finds candidate public sources
Source Policy      → classifies, gates, schedules
Crawler            → fetches at the budgeted cadence
Extractor          → parses factual event fields with confidence scores
Verifier           → re-fetches and computes deltas
Deduper            → merges observations across sources
Conflict           → flags disagreement; routes to review queue
Trust              → derives the public verification display
Concierge          → assists humans creating, claiming, editing
```

Each agent is independently rate-budgeted, logged, and stop-gated. Each writes draft observations; promotion to a published event requires the Publish Decision (§5).

## 4. Data Model (Proposed Tables)

These tables do not exist yet. They will be added under stop-gate review when the verification migration phase begins.

```text
event_source_observations
- id
- event_id
- source_id
- source_url
- source_type
- observed_at
- observed_title
- observed_start_at
- observed_end_at
- observed_venue_name
- observed_location
- observed_ticket_url
- observation_status: found | missing | changed | cancelled | error
- extraction_confidence
- source_confidence
- content_hash
- raw_snapshot_ref

event_change_log
- id
- event_id
- changed_at
- field_name
- old_value
- new_value
- source_observation_id
- change_severity: minor | material | cancellation_risk

event_claims        — promote existing claim concept to first-class
venue_claims
artist_claims
organization_claims
```

`last_verified_at` is preserved for backward compatibility but **demoted** from source-of-truth to a derived/reporting field once this model is active.

## 5. Publish Decision Matrix

A draft observation graduates to a publishable event only when the inputs combine into a `publish` decision:

| Input | `publish` | `review` | `hold` |
|---|---|---|---|
| Source allowed (per ingestion policy) | Yes | Yes | n/a |
| Source URL preserved | Yes | Yes | n/a |
| Last-checked timestamp present | Yes | Yes | n/a |
| Extraction confidence | High | Medium | Low |
| Cross-source conflict | None | Minor | Material |
| Dedupe confidence | High | Medium | Low |
| Ticket / source link active | Active or not required | Stale ok with note | Broken |
| Claim status | Any | Any | Any |
| Risk tier (see ingestion policy) | A–D | E | F |

`hold` keeps the event in draft. `review` routes to a human or claimed-source review queue. `publish` writes a public event with the appropriate display label per §6.

## 6. Verification Display Model

Two independent layers compose the public label:

### 6.1 Primary Verification State (one of)

```ts
type PrimaryVerificationState =
  | "unconfirmed"
  | "found"
  | "source_verified"
  | "multi_source_confirmed"
  | "claimed_verified"
  | "needs_confirmation"
  | "possible_cancellation";
```

### 6.2 Secondary Modifier Badges (zero or more)

```ts
type SecondaryBadge =
  | "details_changed_recently"
  | "last_checked_recently"
  | "ticket_link_active"
  | "source_conflict"
  | "claimed_by_venue"
  | "claimed_by_artist";
```

### 6.3 Precedence Rule

**Warning states outrank confidence states.** When both apply, the primary state is the warning state; the confidence becomes a secondary modifier or contextual note.

```text
Warning states: needs_confirmation, possible_cancellation
Confidence states: found, source_verified, multi_source_confirmed, claimed_verified
Default: unconfirmed
```

Examples:

* One source dropped the event, two still list it → `possible_cancellation` (warning) + `source_conflict` modifier.
* Venue claimed event, but their site no longer shows it → `possible_cancellation` (warning) + `claimed_by_venue` modifier.
* Two sources agree, ticket link active, last checked 2h ago → `multi_source_confirmed` + `last_checked_recently` + `ticket_link_active`.

Claim modifiers identify *who* claimed; the primary state asserts the *level* of confidence.

## 7. Derivation Function (Read-Time)

```ts
type EventVerificationDisplay = {
  primaryState: PrimaryVerificationState;
  label: string;             // human-readable composed label
  lastCheckedAt: Date | null;
  lastVerifiedAt: Date | null;
  badges: SecondaryBadge[];
  explanation: string;       // why this label, in plain language
  sourceUrls: string[];      // attribution
};

deriveEventVerification(
  event: Event,
  observations: EventSourceObservation[],
  claims: EventClaims,
  changes: EventChangeLogEntry[],
): EventVerificationDisplay
```

The derivation is **pure**, **deterministic**, and **explainable**. Every label must be reproducible from inputs and accompanied by an `explanation` string that names the evidence.

## 8. Example Rendered Labels

```text
Source verified · Last checked 2 hours ago
Multi-source confirmed · Last checked today
Claimed by venue · Last checked yesterday
Found on public calendar · Needs confirmation
Possible cancellation · Source no longer lists event
Details changed recently
```

These supersede the binary "Confirmed: MMM D, YYYY" in the future contract. They do not yet replace it.

## 9. Migration Plan (For Reference; Stop-Gate Required)

1. Greenfield strategy docs (this document set) — no behavior change.
2. Proposed contract section in [CONTRACTS.md](../CONTRACTS.md) marked Draft / Not Active.
3. Data model migration: `event_source_observations`, `event_change_log`, claim tables.
4. Derivation function with full test coverage across all primary states and badge combinations.
5. UI badge component update behind a feature flag.
6. Backward-compat: populate `last_verified_at` from most-recent qualifying observation; stop reading it as truth.
7. CONTRACTS.md supersession activation; old binary contract retired.

Each step requires its own stop-gate per [GOVERNANCE.md](../GOVERNANCE.md).

---

**Until the migration ships, the active confirmation behavior is unchanged.**

# Agentic Event Maintenance

**Status:** ACTIVE for principles; PROPOSED for new surfaces (no new flows ship without stop-gate)
**Version:** 1.1
**Last Updated:** 2026-05-02
**Audience:** Repo agents, contributors, partners building venue/artist/org tooling

> **Goal:** make event creation and maintenance easier than the alternatives (Facebook events, manual venue updates, third-party calendars), without ever asking the human to do extra work for CSC's benefit.

This document describes the AI-assisted concierge surfaces CSC offers to venues, artists, and organizations. It builds on the active conversational draft contract in [CONTRACTS.md](../CONTRACTS.md) §EVENTS-NL-01 (Conversational Event Draft/Confirm) and the disciplines in [INGESTION_AND_FAIR_COMPETITION.md](INGESTION_AND_FAIR_COMPETITION.md).

---

## 1. Stakeholder Surfaces

| Stakeholder | Concierge purpose |
|---|---|
| Venue | Create, update, cancel, and recur events tied to their venue. Claim and maintain venue profile. |
| Artist | Create events tied to their performances. Maintain artist profile. |
| Organization (nonprofit, community, faith, civic) | Manage event series, recurring programs, partner shows. |
| Audience members | Submit corrections, flag inaccuracies, RSVP, save events. |
| Internal operators | Run review queues, resolve conflicts, approve high-risk changes. |

Each surface has its own minimum-viable affordances. None of them require the user to learn CSC's internal data model.

## 2. Conversational Operations (Scope)

The concierge supports natural-language operations like:

* "Create an event for next Friday at 7pm at our usual venue."
* "Make this recurring every second Thursday."
* "Update the ticket link to …"
* "Cancel tonight's event."
* "Move this from 7pm to 8pm."
* "Add this artist to the lineup."
* "Publish this and give me a shareable link."

The concierge fills from the user's claimed profile (venue address, default timeslot, default capacity) and asks only for what's missing. It never asks open-ended follow-up questions, per `EVENTS-NL-01`.

## 3. Draft-Until-Proven Defaults

All concierge output starts as draft. Promotion rules:

| Action | Promotion path |
|---|---|
| Create | Draft → preview → user confirm → publish (auto-confirms per CONTRACTS.md §Confirmation Invariants) |
| Edit (low-risk: title typo, description) | Draft → preview → user confirm → publish |
| Edit (high-risk: date, venue, cancel, ticket link) | Draft → preview → user confirm → review queue if claim isn't current |
| Cancel | Draft → confirm dialog → publish; surfaces `possible_cancellation` modifier on derived display (when verification model active) |
| Recurring series | Draft preview shows next 4 occurrences before publish |

High-risk changes are gated even for claimed sources, because trust costs more to rebuild than to defend.

## 4. Claim-First Workflow

The concierge prefers to operate inside a claim. If the user is not yet a claimed venue/artist/org owner, the first action the concierge offers is to start a claim. Claims unlock:

* Faster default-fill (address, default times, lineup)
* Higher trust on edits (claim modifier on derived display)
* The ability to maintain a feed for automatic future ingestion
* Direct correction-flow handling for their listings

Claims do not unlock any trust badge that an unclaimed verified event cannot earn through evidence. Trust remains evidence-based, never claim-bought (see [OPERATING_THESIS.md §6](OPERATING_THESIS.md)).

## 5. What the Concierge Will Not Do

* Write to the public database without explicit user confirmation.
* Edit data outside the user's claim scope without operator approval.
* Chain open-ended follow-up questions ("Anything else?", "Want to also do X?") — see `EVENTS-NL-01`.
* Invent fields the user did not provide. Missing data is asked for or left blank with a clear note.
* Republish expressive content (descriptions, photos, bios) sourced from another platform unless the rights are clear.
* Bypass the publish decision matrix (see [SOURCE_REGISTRY.md §5](SOURCE_REGISTRY.md), when active).

## 6. Review Queue

A separate operational surface, used by internal operators or claimed-source owners, handles:

* Cross-source conflicts (Source Policy disagreement)
* High-risk changes outside an active claim
* Possible cancellations (event missing from a source it should be on)
* Material change-log entries (date, venue, ticket-link replacement)
* Correction-flow submissions from audience members

Items in the review queue are non-public. Decisions are logged. Resolution updates the public event and the verification display.

## 7. Audience-Side Concierge (Lightweight)

Audience members can:

* Submit a correction with one tap, including a free-text reason and (optionally) a source URL.
* Flag a possible cancellation (sends to review queue, surfaces `needs_confirmation` until resolved).
* Suggest an event with a source link. Suggestions enter as `community_submission` with the same draft-until-proven path.

Audience-side surfaces are free, not gated, and do not show paid-tier visibility differences.

## 8. Operator Surfaces

Operators can:

* Approve / reject review queue items.
* Override claim modifiers if a claim is contested or stale.
* Re-classify a source's risk tier on policy review.
* Bulk re-verify by source, region, or date window.
* Write notes attached to events for future operator context.

Operator actions are auditable and stop-gated when they touch the publish decision matrix or the verification display logic.

## 9. What This Document Does Not Do

* It does not authorize any new write API or surface to ship without stop-gate review.
* It does not modify the active `EVENTS-NL-01` contract; it scopes future extensions of it.
* It does not commit CSC to building all surfaces above in Phase 1. They are sequenced by [OPERATING_THESIS.md §9](OPERATING_THESIS.md) wedge expansion.

## 10. Community Corrections and Claim-Aware Editing (COMMUNITY-CORRECTION-01)

CSC welcomes corrections from hosts, venues, organizations, artists, and community members. The concierge must distinguish between direct write authority and proposed community help.

Direct mutation is allowed only when the actor is authenticated, authorized, and scoped to the event or entity being changed. If the actor is not an approved host, venue manager, organization manager, or otherwise authorized party, the concierge must create a proposed change rather than changing the trusted event record.

> **Ownership controls write authority. Evidence controls review confidence. Community help is accepted as proposed data, not direct mutation.**

All proposed changes must include a field-level diff, submitter identity when available, source URLs or evidence, AI confidence notes, and a review status. Bulk edits from unclaimed or unrelated actors always require admin review.

High-impact fields — including date, time, venue, cancellation status, ticket URL, and organizer identity — require stricter handling even for authorized actors.

Future cross-references should cite the `COMMUNITY-CORRECTION-01` anchor rather than the section number, so the principle survives any future re-ordering of this document.

### 10.1 Paths

* **Approved host path** — Existing host or co-host of the event. Direct mutation allowed for in-scope fields. Cancellation, venue change, ticket-link replacement, and other high-impact fields still pass through §3 high-risk gating.
* **Claim-first path** — Venue manager, organization manager, or artist with an approved claim covering the event. Direct mutation allowed within the scope of that claim. Same high-risk gating applies.
* **Community correction path** — Any authenticated user without a relevant claim. The concierge does **not** mutate the trusted event record. It creates a proposed change with the evidence bundle below and routes to a review queue separate from `event_audit_log`.
* **Bulk edit review path** — Multiple events touched by a single non-admin actor in a short window always route to admin review, regardless of claim status. The exact operational definition of "bulk" — event count, time window, and distinct-field thresholds — is **deferred to the implementation PR**. This section asserts the principle, not the threshold.

### 10.2 Proposed Change Queue vs Applied Audit Log

Three artifacts are deliberately distinct surfaces with different semantics:

* **Applied audit log** — `event_audit_log` (Lane 5 PR A; landed via PR #193 + #203) records direct mutations to the trusted event record. It answers *"what was changed and by whom"*.
* **Proposed community corrections** — A separate future queue/workflow with its own table or surface. It captures user-initiated change requests that have **not** been applied. It answers *"what does the community think should change"*. It is not written to `event_audit_log` until accepted and applied.
* **Source observations** — Future `event_source_observations` per [SOURCE_REGISTRY.md §4](SOURCE_REGISTRY.md) (proposed; not active). They capture facts about external listings. They answer *"what do registered sources currently say"*.

The separation keeps the audit trail truthful. Conflating them would make it impossible to distinguish what changed, what was proposed, and what an external source observed.

### 10.3 Evidence Bundle

Every proposed change must carry, at minimum:

* A **field-level diff** (old value → proposed value).
* **Submitter identity when available** (`auth.uid()` for authenticated submitters; guest token for unauthenticated submitters where supported; never plaintext IP).
* **Source URLs or supporting evidence** the submitter cites.
* **AI confidence notes** when the concierge interprets free-text into structured fields.
* A **review status** describing where the proposal sits in the workflow. Examples include `pending`, `under_review`, `applied`, `rejected`, and `withdrawn`; the **exact enum is deferred to the implementation PR** and may evolve as workflow signals are added.

A proposed change without an evidence bundle is treated as low-confidence and routes through admin review by default.

### 10.4 Reputation, Privacy, Retention

* **Internal contributor reputation** is a future, admin-only signal. It may inform review prioritization or auto-approval thresholds for trusted contributors. It is **never** publicized, displayed, or used to differentiate the public verification surface. **Paid status must not contribute to contributor reputation, directly or indirectly** — reputation is earned by accuracy and consistency of community contributions, not by payment tier or commercial relationship. The Trust Layer Invariant in [.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md) applies in full.
* **Concierge transcripts** and **uploaded images** carried with proposed changes are sensitive and retention-bounded. They are stored only as long as needed to act on the proposed change and to maintain a minimal audit trail. Plaintext IPs are never stored; identity hashes follow the same daily-salt pattern used by `event_audit_log`. Deletion paths exist for the submitter on request.

### 10.5 Subject Types and Forward Compatibility

The "claim-first path" currently assumes the artist subject is a `profiles(id)` row, matching the active model and the Q1 outcome in [`source-observation-open-questions-decision-memo.md`](../investigation/source-observation-open-questions-decision-memo.md). If a future `artists` table or other artist-record entity is introduced, the principle here still holds — only the FK target evolves. The decision memo's `artist_subject_type` discriminator is the planned forward-compat path.

### 10.6 What This Section Does Not Authorize

This section is principle and policy. It authorizes:

* **No** schema migration, table creation, RLS policy, or trigger.
* **No** application code, API/MCP/crawler/RPC route, or UI surface.
* **No** change to `event_audit_log` shape or semantics. Lane 5 PR A's contract holds. **Lane 5 PR B scope is not expanded by this principle** and remains gated on its own stop-gate; the soak window for PR A continues per its own plan.
* **No** activation of SOURCE-OBS-01. The proposed-change queue is separate from `event_source_observations` and does not depend on the verification model migration.
* **No** change to the active confirmation rule. `last_verified_at IS NOT NULL ⇒ Confirmed` remains the only active behavior.

Each implementation step requires its own stop-gate per [GOVERNANCE.md](../GOVERNANCE.md) and the operational rules in [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md).

---

**Concierge surfaces compete with the alternatives by being easier and more honest, not by being cheaper to ignore.**

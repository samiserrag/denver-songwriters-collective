# Agentic Event Maintenance

**Status:** ACTIVE for principles; PROPOSED for new surfaces (no new flows ship without stop-gate)
**Version:** 1.0
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

---

**Concierge surfaces compete with the alternatives by being easier and more honest, not by being cheaper to ignore.**

# Open Mics and Grassroots Performance Scope

**Status:** ACTIVE — product-scope correction for strategy and future work
**Version:** 1.0
**Last Updated:** 2026-05-03
**Audience:** Sami, repo agents, contributors, partners, future operators

> **Product principle:** CSC serves open mic and grassroots performance communities across music, poetry, comedy, and adjacent grassroots performance scenes. Broader cultural events are out of scope unless they directly serve those communities.

This document narrows the strategic wedge. It is not a runtime filtering change, a data purge, a product rename, or a deprecation of existing events. Existing functionality and existing event records remain valid. Future strategy, ingestion, verification, AI concierge, and agent-readable surfaces should be interpreted through this scope unless Sami explicitly approves a later scope change.

## 1. Why This Correction Exists

CSC is not trying to become a generic Events.com, Eventbrite, Facebook, Meetup, or tourism-calendar replacement. Broad cultural-event aggregation is too large, too noisy, and already crowded by platforms with much larger distribution.

The better wedge is narrower and more useful:

> **Become the trusted source for open mics, songwriter rounds, poetry readings, comedy mics, small gigs, workshops, jams, showcases, and community performance events — first in Colorado, then city-by-city only if the model works.**

This is where the data is messy, recurring, relationship-driven, often stale, and underserved by generic event platforms. It is also where hosts, venues, performers, and community contributors most need lightweight maintenance, correction, claim, and verification tools.

## 2. Primary Focus

CSC's first-class event graph is for:

- open mics
- songwriter rounds
- poetry readings
- comedy mics
- acoustic showcases
- jams
- workshops
- small community gigs
- low-cost creator gatherings

These are the events where "is this actually happening, who hosts it, how do I sign up, is it welcoming, and when was it last checked?" matters more than broad discovery volume.

## 3. Adjacent Allowed Scope

The scope may include adjacent events when they directly serve the same communities:

- featured performances by regular community members
- small venue lineups relevant to local music, poetry, comedy, spoken-word, or grassroots performance scenes
- showcases involving local music, poetry, comedy, or spoken-word communities
- local festivals when they directly serve those communities
- community-building events for performers, hosts, venues, or organizers in these scenes

Adjacent scope should be justified by community relevance, not by generic event-count growth.

## 4. Explicitly Out Of Current Scope

The current strategy does not pursue:

- broad all-cultural-events aggregation
- national or global event discovery
- generic ticketing/event-platform competition
- broad crawler ambitions detached from grassroots performance communities
- competing with general event platforms on total event count
- turning CSC into a generic consumer event search product

Earlier broad cultural-event language in planning docs should be interpreted through this narrowed wedge. If a future PR depends on broad cultural-event coverage, it needs a separate product-scope stop-gate.

## 5. Preserve And Narrow

This correction preserves the existing trust and agentic strategy, but narrows its target market.

Keep:

- trust layer
- claim-aware editing
- community corrections
- source-observation work
- AI concierge
- agent-readable APIs, feeds, schemas, and MCP concepts
- no pay-to-play trust

Narrow these systems toward grassroots performance communities. The point is not to delete Lane 6 / Lane 8 / Track 1 thinking. The point is to aim it at a more defensible market.

## 6. Why AI Concierge Matters Here

Open mics and grassroots events are hard for generic platforms because:

- recurring events go stale
- facts are messy and scattered across flyers, Instagram posts, Facebook updates, venue pages, and word of mouth
- signup method, cost, host, genre, friendliness, and active status are often missing
- hosts and venues need lightweight updates
- community contributors need a safe proposed-correction path
- users care whether the event is still active and when it was last confirmed

This makes the concierge useful in concrete ways:

- "Update my Tuesday mic to 7:30."
- "Cancel tonight because of snow."
- "Add a featured poet this week."
- "Make this recurring every first Thursday."
- "Change signup from online to in-person."
- "Package this correction for admin review."

The concierge should be helpful to everyone, powerful for verified owners, and careful with the shared truth layer.

## 7. What Does Not Change

This document does not change:

- active `last_verified_at` confirmation behavior
- SOURCE-OBS-01 Draft / Proposed / Not Active status
- badge behavior
- admin publish behavior
- database schema
- crawler/API/MCP runtime behavior
- existing event records
- existing public brand, routes, repository name, or database object names

Runtime behavior changes require their own stop-gates.

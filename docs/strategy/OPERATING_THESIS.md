# Operating Thesis

**Status:** ACTIVE
**Version:** 1.1
**Last Updated:** 2026-05-03
**Audience:** Founders, contributors, repo agents, partners, future operators

> **Operating thesis (one sentence):** CSC is a lean, AI-leveraged, community-benefit event utility that pays a small team fairly by making open mics and grassroots performance communities radically easier to create, maintain, verify, discover, and consume — for both humans and agents.

This document describes the kind of business and organization CSC intends to be. It is durable but evolvable. It does not override [PRODUCT_NORTH_STAR.md](../PRODUCT_NORTH_STAR.md) on philosophy, [CONTRACTS.md](../CONTRACTS.md) on enforceable behavior, or [GOVERNANCE.md](../GOVERNANCE.md) on workflow. It does set the operating frame those documents live inside.

---

## 1. What CSC Is

* Lean public-good infrastructure for open mics and grassroots performance communities.
* AI-leveraged, with humans focused on trust, relationships, edge cases, partnerships, and product judgment.
* Source-transparent, link-back, claim/correct/opt-out friendly.
* Useful for humans and AI agents at the same time.
* Community-first: venues, artists, organizations, and audiences are the primary stakeholders.

## 2. What CSC Is NOT

* Not a venture-scale "capture the market" play.
* Not an extractive aggregator that buries source links to keep traffic.
* Not pay-to-play for trust, accuracy, or visibility.
* Not a content feed, social network, or engagement-farming platform.
* Not built to dominate every event category — grassroots performance wedge first, expand only with density and trust.
* Not a generic all-events, all-cultural-events, or consumer event search product.

## 3. Lean Team Shape

CSC is intentionally small. The default operating shape is roughly:

* 1 founder/operator
* 1 technical/agent systems lead
* 1 community/venue partnerships person
* Part-time design, legal, bookkeeping, support as needed

Repetitive work is automated. Humans focus on judgment, relationships, and edge cases. The team grows only when each new role unblocks community value, not engagement metrics.

## 4. Cost Reality (Denver Middle-Class Sustainable)

Annual revenue ranges that support the operating shape:

* $250k–$400k/year — Founder + contractors + infrastructure
* $450k–$700k/year — Small durable team
* $750k–$1.2M/year — Strong lean organization with multiple employees

These are framing, not contracts. They evolve as the business does.

## 5. Mission-Aligned Revenue

Revenue must reinforce the public-good event layer, not replace it.

**Allowed:**

* Venue / org / artist memberships
* Calendar embeds for venues, orgs, partners
* Sponsored community guides (clearly marked)
* Grants and arts funding
* Paid concierge and event-maintenance services
* API access tiers for larger partners (rate limits, write actions, support, SLAs)
* Donations and supporter memberships
* Local business sponsorships
* White-label community performance calendars

**Forbidden:**

* Pay-to-rank in discovery
* Pay-for-verification or pay-for-trust badges
* Buried source links in exchange for traffic
* Engagement-farming patterns
* Selling user behavior data
* Dark patterns in any paid surface

## 6. Trust Is Never Pay-to-Play

This is the rule that protects the entire operating thesis.

> Verification badges, source attribution, last-checked timestamps, correction flow, and opt-out path are public-good surfaces. They must not be gated, degraded, deprioritized, or differentiated by payment tier.

Paid tiers may add embeds, analytics, higher API rate limits, concierge support, and SLAs. Paid tiers may not add trust.

The high-level invariant is restated in [.claude/rules/00-governance-and-safety.md](../../.claude/rules/00-governance-and-safety.md). Operational PR-level enforcement lives in [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md).

## 7. AI as Operational Leverage, Not as a Trust Substitute

AI lets a small team check more sources, more often, with better deltas than human volunteers ever could. CSC uses that leverage.

The discipline:

* Trust the evidence trail, not the agent's confidence alone.
* Crawler output is draft until validated.
* Agent-created events are draft until verified or claimed.
* Conflicting data goes to a review queue.
* High-risk changes go through human or claimed-source review.
* Costs are budgeted, rate-limited, logged, and stop-gated.

See [INGESTION_AND_FAIR_COMPETITION.md](INGESTION_AND_FAIR_COMPETITION.md) for the full ethics frame and [SOURCE_REGISTRY.md](SOURCE_REGISTRY.md) for the verification model.

## 8. Tradeoffs CSC Accepts

* Slower growth than a venture-funded aggregator.
* Lower margin than an extractive platform.
* Smaller team than what brute force would require.
* Less event coverage than scraping every platform would yield.
* More words spent on trust than competitors spend.

These tradeoffs buy durability, community trust, and an honest data layer that AI agents will increasingly prefer to consume.

## 9. Wedge Expansion Path

CSC starts narrow and expands as density and trust earn the right.

* Phase 1: Songwriter, open mic, listening room, jam, showcase, and workshop events
* Phase 2: Grassroots performance communities across music, poetry, comedy, and adjacent spoken-word / small-venue scenes
* Phase 3: Colorado city-by-city density for those communities, with local festivals only when they directly serve the wedge
* Phase 4: New regions only after the model works locally; broad cultural-event aggregation remains out of scope unless it directly serves grassroots performance communities

Naming and positioning expand only when the data and community already do. The architectural substrate for region/community-type expansion is already documented as STRAT-01 in [CONTRACTS.md](../CONTRACTS.md).

Earlier broad cultural-event language in planning docs should be interpreted through this narrowed wedge. The trust layer, source registry, AI concierge, and agent-readable surfaces remain important, but their first target is grassroots performance communities rather than all cultural events.

---

**This thesis is durable. Revise it deliberately.**

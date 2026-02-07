# NORTH STAR — The Songwriters Collective Platform

> **Status:** Active strategic north star (docs-only alignment)
> **Scope:** Product mission, invariants, and scale direction
> **Non-goal:** This document does not authorize immediate app-code changes

---

## Mission (Restated)

Build the most trusted member-venue-event network for local creative communities, starting with songwriters, so people can discover events, find collaborators, and grow real-world scenes in every region.

The product must stay human, community-first, and easy to operate at low cost while scaling to many regions and community types.

---

## Platform Positioning

- **The Songwriters Collective** is the canonical root platform.
- **Denver is a region, not the product.**
- **The Colorado Songwriters Collective** is the immediate regional rebrand target for the current primary region.
- The current Denver/Colorado instance remains a primary regional community and is not deleted.
- Rebrand naming decisions are handled in phased strategic backlog (`STRAT-01A`) to keep wording reversible and low-risk.

---

## Core Invariants (Must Hold At Any Scale)

### Members
- Members own their identity and profile content.
- Membership can participate across events, venues, and media surfaces with consistent permissions.
- Trust and moderation rules apply consistently across regions.

### Events
- Events remain occurrence-aware and discoverable by date/time/location.
- Event detail, list cards, and communications must not contradict each other.
- Event ownership and host permissions remain explicit and auditable.

### Venues
- Venues are durable entities with clear manager/admin ownership.
- Venue claims and manager workflows remain approval-governed.
- Venue data quality and update history remain traceable.

### Galleries
- Media stays attachable to the right entity (member, event, venue, blog).
- Visibility and moderation controls remain explicit.
- Upload UX stays simple while preserving canonical storage contracts.

### Blogs
- Editorial and member-authored content keep clear ownership and publication state.
- Blog routing, attribution, and approvals remain transparent.

### Admins
- Admin power must be scoped and auditable.
- Approval queues remain explicit (not hidden automation).
- Governance/stop-gate discipline remains required for non-trivial changes.

---

## What Must Never Change

1. **Community trust over growth hacks**
- No dark patterns, deceptive flows, or manipulative engagement mechanics.

2. **Single source of truth discipline**
- Canonical contracts/backlog/governance docs remain synchronized.

3. **Cross-surface consistency**
- Public-facing status/details should not disagree between list, detail, and digest surfaces.

4. **No codebase forks per region/community**
- Region and community type are configuration and data concerns, not separate products.

5. **Low-friction participation**
- Discovery and sharing should stay easy for guests and members.

---

## Long-Term Scale Direction

### Multi-Region
- Regions become first-class platform concepts (Denver, Boulder, Austin, Nashville, etc.).
- Region-level content isolation and admin scope without duplicating codebases.

### Multi-Community / White-Label
- Songwriters remains the default community model.
- Platform can adapt to comedians, community sports leagues, and similar ecosystems.
- White-label remains brand-preserving: root platform identity stays visible while regional/community branding adapts.

### Mobile + API Readiness
- Contracts and data model must support native mobile clients without special-case behavior.
- Public and authenticated APIs remain stable, scoped, and backwards-aware.

### Internationalization
- Locale and language readiness is planned from architecture level (dates, time zones, text, formatting).

### Sustainable Cost Model
- Keep infrastructure and ops simple enough to support cheap/free member access at scale.

---

## Execution Posture

- Strategic tract `STRAT-01` is **parallel** and **non-blocking** for current active backlog execution.
- This north star informs phased decisions; implementation proceeds only through approved stop-gates.
- Domain decisions (`.com` vs `.org`) are explicitly deferred and non-blocking in this tract.

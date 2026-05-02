# Ingestion & Fair Competition Strategy

**Status:** ACTIVE — policy and disciplines effective immediately for all new ingestion work
**Version:** 1.0
**Last Updated:** 2026-05-02
**Audience:** Repo agents, contributors, integrators, partners

> **Top rule:** Trust the evidence trail, not the agent's confidence alone.

This document defines how CSC collects, verifies, and publishes external event information. It is the citable policy for any new ingestion source, crawler, extractor, or write API. It does not modify any active confirmation behavior contracted in [CONTRACTS.md](../CONTRACTS.md) §Confirmation Invariants. The future verification model lives in [SOURCE_REGISTRY.md](SOURCE_REGISTRY.md) (PROPOSED, not yet active).

---

## 1. Definition of Scraping

For CSC purposes:

> **Scraping is automated collection or extraction of data from a website, app, or page into a structured database or workflow.**

The line between manual research and scraping is automation, not the source. Human research that informs CSC is not scraping. Crawlers, OCR pipelines, agent loops over screenshots, and headless browsing are scraping.

| Activity | Is it scraping? | CSC posture |
|---|---|---|
| Human looks at a public event page and writes down date/time/venue | Not meaningfully scraping | Allowed as research |
| Human screenshots an event for personal notes | Not automated scraping | Allowed; do not republish the screenshot |
| Agent OCRs hundreds of platform screenshots daily | Yes, effectively automated extraction | Avoid as a core pipeline |
| Crawler checks a venue's public `/events` page on a respectful schedule | Yes — scraping/crawling | Allowed if source policy permits |
| Agent logs into a closed platform and extracts event data | Automated platform extraction | Disallowed |
| Agent bypasses CAPTCHA, login walls, rate limits, or block pages | Evasion | Disallowed |

## 2. Fair-Competition Posture (Public Statement)

> **CSC competes by making public cultural event information more useful, fresh, transparent, and accessible. CSC does not evade access controls, ignore robots.txt, violate explicit no-scrape terms, collect private user data, or copy expressive content. CSC links back to original sources and gives venues, artists, and organizations claim, correction, and opt-out paths.**

This is the language to publish on `/about/data`, `/llms.txt`, and any partner-facing material.

## 3. Allowed Sources (Default-Allowed Source Types)

* Venue websites
* Artist websites
* Organization websites (nonprofit, community, faith, civic)
* Library calendars
* City and county calendars
* Public Google Calendars (where the calendar owner has chosen public)
* Public iCal feeds
* Public RSS / Atom feeds
* WordPress and event-plugin feeds
* Public event pages without explicit no-scrape terms
* Pages publishing schema.org/Event markup
* Ticket pages where terms permit factual extraction

Default-allowed does not mean automatic ingestion — every source must be registered, classified, and rate-budgeted before crawling begins (see §5–§6).

## 4. Disallowed Sources (Default Deny)

Default-deny unless an explicit policy review grants an exception:

* Facebook (subject to Meta's Automated Data Collection Terms)
* Instagram
* Eventbrite as a bulk-extraction target (Eventbrite ToS prohibits scraping)
* Meetup as a bulk-extraction target
* Bandsintown as a bulk-extraction target
* Login-gated pages
* CAPTCHA-protected pages
* Sites with explicit no-scrape terms or `Disallow:` directives covering the path
* Sites that block CSC's crawler IP/UA after good-faith retry-after backoff

Linking out to disallowed platforms is fine and encouraged. Building the core graph from them is not.

## 5. Source-Risk Policy (Tier Classification)

Every registered source is classified into a risk tier. Tiers govern crawl rate, default trust, and graduation gates.

| Tier | Description | Default crawl rate | Default trust on extraction |
|---|---|---|---|
| **A** | Claimed-source feed (venue/artist/org-owned, opt-in) | Per source policy or owner-set | High; one allowed source confirms |
| **B** | First-party public calendar / iCal / RSS from venue/artist/org | Daily–weekly | Source-verified after one clean fetch |
| **C** | Civic / library / nonprofit calendar | Daily–weekly | Source-verified after one clean fetch |
| **D** | Aggregator or third-party public listing with permissive terms | Weekly | Found, requires multi-source confirmation |
| **E** | Borderline — terms unclear, robots ambiguous, weak signal | Manual review only | Found, requires human review before publish |
| **F** | Disallowed — see §4 | None | Never publishes |

Risk tier is set at registration and revisited on policy changes. Downgrade on first observed violation; do not auto-upgrade.

## 6. Robots, Rate, and Politeness

* Respect `robots.txt` even when it is not legally required.
* Honor `Crawl-delay`, `Retry-After`, and HTTP 429/503 backoff.
* Use a single, identifiable user-agent string with a contact URL.
* Never run more than the rate budgeted for a source's risk tier.
* Cache aggressively; never re-fetch within the cadence window unless an explicit re-verification is justified.
* Stop on persistent 4xx/5xx and re-classify the source.

## 7. Source Attribution (Required on Every Published Event)

Every published event ingested from an external source must:

* Preserve the original `source_url` in the data model.
* Display a "Found on …" or "Source verified · …" line in the UI.
* Show a `last_checked_at` timestamp.
* Link back to the original source page.
* Not republish expressive content (event descriptions, artist bios, photos) without permission. Factual fields only by default: title, date, time, venue name, address, ticket link, free/paid, age policy.

## 8. Opt-Out, Claim, and Correction Paths

CSC offers, as public-good surfaces (see [OPERATING_THESIS.md §6](OPERATING_THESIS.md)):

* A self-serve opt-out for venue/artist/org pages and feeds.
* A claim flow that lets a venue/artist/org assert ownership and edit their data.
* A correction flow that lets anyone flag an inaccurate listing.
* An auditable response SLA for opt-outs and corrections.

These are never gated, degraded, or paywalled.

## 9. Draft-Until-Proven Disciplines

Every new ingestion or write surface follows these defaults:

* Crawler output = draft until validated.
* New source = draft until classified into a risk tier.
* New write API = sandbox until proven safe.
* Agent-created event = draft until verified or claimed.
* Conflicting data between sources = review queue, not silent merge.
* High-risk changes (cancellations, venue moves, ticket-link replacements) = human or claimed-source review.

These are enforced operationally by [.claude/rules/05-ingestion-and-agent-readability.md](../../.claude/rules/05-ingestion-and-agent-readability.md).

## 10. Re-Verification Cadence

Default cadence by event proximity:

| Event window | Cadence |
|---|---|
| Today | Every 4–6 hours |
| This week | Daily |
| This month | Every 2–3 days |
| > 30 days | Weekly |
| Recently changed | Daily until stable for 7 days |
| Missing from source | Immediately mark "needs confirmation" |
| Claimed-source events | Trust higher; still verify on the same cadence |

Cadence may be adjusted per source by the Source Policy agent within budget.

## 11. What This Document Does Not Do

* It does not change the active Confirmation Invariants in [CONTRACTS.md](../CONTRACTS.md).
* It does not authorize any specific crawler, source, or pipeline. Each requires registration, classification, and stop-gate review.
* It does not commit CSC to publishing externally-ingested events at all in Phase 1. Manual and conversational creation remain the active paths until the Source Observation data model ships (see [SOURCE_REGISTRY.md](SOURCE_REGISTRY.md)).

---

**This policy is the gate. New ingestion work that does not cite it does not ship.**

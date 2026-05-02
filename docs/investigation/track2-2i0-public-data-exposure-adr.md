# Track 2 2I.0: Public Data Exposure ADR

**Date:** 2026-05-02
**Status:** Proposed - investigation only
**Scope:** Track 2 security ADR for future public event data surfaces
**Runtime behavior changed:** No
**Needs Sami approval before implementation:** Yes

---

## 1. Purpose

This ADR defines the public-data boundary for Track 2 AI Agent Source
Optimization before any new public event API, expanded JSON-LD surface,
AI-shaped endpoint, crawler policy, or citation-stability implementation ships.

The central decision: **public exposure is schema-driven and allowlisted per
resource type.** Public serializers must expose only explicitly approved fields.
They must not rely on ad hoc runtime field stripping from database rows or
internal API payloads.

This ADR authorizes no runtime behavior change. It is the security stop-gate
before future 2I implementation work.

---

## 2. Evidence and Current State

Track 2 roadmap evidence:

- `docs/investigation/track2-roadmap.md:347-351` defines 2I as the public source
  leg: CSC should become the trustworthy structured source AI agents cite, while
  current coverage of Schema.org JSON-LD, `/events.json`, crawler policy, and
  AI-shaped endpoints is unknown.
- `docs/investigation/track2-roadmap.md:355` requires the 2I.0 ADR to lock
  explicit public-safe field allowlists per resource type, prove drafts,
  invite-only data, private host notes, internal IDs, emails, and analytics never
  appear in public responses, and require schema-driven serialization.
- `docs/investigation/track2-roadmap.md:357-363` scopes follow-up work for
  Schema.org Event JSON-LD on `/events/[id]`, future `/events.json`, crawler
  policy, AI-shaped query endpoints, cancelled-event semantics, citation
  stability, and AI traffic analytics.
- `docs/investigation/track2-roadmap.md:367-369` names public-data leaks, API
  abuse, and citation drift as the key 2I risks.
- `docs/investigation/track2-roadmap.md:488-495` makes 2I.0 a non-negotiable
  security gate, requires a public-API kill switch, and requires rate limits for
  public APIs.
- `docs/investigation/track2-roadmap.md:584` says no implementation in the
  security-gated sub-tracks proceeds until the ADR is approved.
- `docs/investigation/track2-roadmap.md:709-714` defines Track 2 completion for
  2I: complete Event JSON-LD, stable `/events.json`, AI-shaped query endpoints,
  cancelled-event propagation, schema-driven allowlists, no draft/private leaks,
  per-bot crawler policy, rate limits, and caching.
- `docs/investigation/track2-roadmap.md:797-804` lists 2I.0 in the security ADR
  phase and reiterates that no sub-track implementation ships before its `.0`
  ADR approval.

---

## 3. Decision Summary

Future public data exposure must follow these rules:

1. Public responses are produced only by resource-specific serializers with
   explicit allowlists.
2. Type definitions and serializers should provide compile-time guarantees where
   practical, using exact public resource types and `satisfies`-style checks
   rather than broad database-row types.
3. Public endpoints must never expose drafts, invite-only data, private host
   notes, emails, analytics, telemetry, audit logs, internal database IDs,
   user IDs, relationship IDs, source-run IDs, or raw import/source payloads.
4. `/events/[id]` JSON-LD, future `/events.json`, and future AI-shaped query
   endpoints must all use the same public serializer family.
5. Cancelled public events return stable public responses with Schema.org
   `eventStatus: "EventCancelled"` rather than disappearing or reappearing as
   live events.
6. Public APIs require abuse controls: pagination limits, rate limits, cache
   policy, query allowlists, crawler policy, and observability.
7. Crawler policy is explicit per bot or bot class. The default is not "allow
   all AI crawlers."
8. Citation stability is a product requirement: canonical URLs and stable public
   identifiers should survive slug changes, cancellation, and endpoint evolution.

---

## 4. Public Resource Allowlists

These allowlists define what may appear in public responses. Future
implementation may rename fields to match code conventions, but it may not add
new public fields without updating this ADR or an approved successor.

### 4.1 Public Event

Allowed:

- stable public identifier, if one exists by design
- canonical URL
- slug
- title
- public description / summary
- public event status, including scheduled, postponed, and cancelled
- public visibility state only when it is already public
- start date/time
- end date/time
- timezone
- all-day flag, if public
- recurrence summary in human-readable public form
- occurrence date key when part of a public occurrence URL
- public event format/type/discipline labels
- public image/media references through the Public Media allowlist
- public venue/place through the Public Place allowlist
- public organizer through the Public Organization allowlist
- public performer references through the Public Performer allowlist
- public festival reference through the Public Festival allowlist
- public ticket/offer data through the Public Offer allowlist
- public source/original event URL only when explicitly host-approved as a
  public event URL
- last modified / dateModified
- public cancellation reason only when intentionally host-authored for the
  audience

Not allowed:

- database `events.id` unless it is deliberately the stable public identifier
  and the implementation documents that decision
- host user IDs
- cohost/user relationship IDs
- draft fields or draft-only values
- invite-only, private, unlisted, or restricted-audience data
- private host notes
- admin notes
- moderation notes
- internal status fields not meant for audiences
- raw AI prompt, model response, or reasoning text
- telemetry, analytics, acceptance/rejection signals, or model IDs
- import source run IDs, content hashes, dedupe keys, or raw source payloads
- emails
- RSVP attendee data or counts unless a later ADR explicitly makes aggregate
  public RSVP counts safe
- payment processor IDs, checkout session IDs, coupon codes, or revenue metrics
- audit log IDs or rollback data

### 4.2 Public Occurrence

Allowed:

- canonical occurrence URL
- parent event public identifier or slug
- occurrence date key in public URL-safe form
- occurrence start/end date/time
- occurrence timezone
- occurrence public status, including cancelled occurrence semantics
- occurrence-specific public title/description when intentionally overridden
- occurrence-specific public venue/place when intentionally overridden
- occurrence-specific public image/media when intentionally overridden
- dateModified

Not allowed:

- internal override row IDs
- internal recurrence/dedupe hashes
- private override notes
- author/editor user IDs
- invite-only override details
- audit or rollback data

### 4.3 Public Place / Venue

Allowed:

- public name
- slug or stable public place identifier
- public address fields: street address, locality/city, region/state, postal
  code, country
- public latitude and longitude when the venue is intended to be mapped
- public website URL
- public phone number only for the venue/business, never a personal host phone
- public map URL
- public image/media references
- public accessibility notes
- public neighborhood/area label

Not allowed:

- venue database IDs unless deliberately stable public IDs
- private owner/user IDs
- private contact names
- private emails
- private phone numbers
- geocoding provider internals
- geocode confidence/debug metadata
- internal dedupe keys
- admin notes
- raw imported venue payloads

### 4.4 Public Organization / Organizer

Allowed:

- public name
- slug or stable public organization identifier
- public description
- public website URL
- public logo/image
- public social/profile URLs
- public role in relation to the event, such as organizer or host

Not allowed:

- organization database IDs unless deliberately stable public IDs
- owner user IDs
- membership records
- invite records
- private host/admin notes
- billing data
- private emails
- private phone numbers
- internal verification state unless intentionally audience-facing

### 4.5 Public Performer

Allowed:

- public display name
- slug or stable public performer identifier
- public bio/description
- public website URL
- public image/media references
- public social/profile URLs
- public role for an event, such as headliner, opener, speaker, teacher, or
  featured performer

Not allowed:

- performer database IDs unless deliberately stable public IDs
- private booking contact details
- emails
- private phone numbers
- internal matching/dedupe confidence
- admin notes
- user account IDs

### 4.6 Public Festival

Allowed:

- public name
- slug or stable public festival identifier
- canonical URL
- public start/end dates
- public description
- public image/media references
- public website URL
- public organizing entity through the Public Organization allowlist
- public event lineup links through Public Event summaries

Not allowed:

- internal festival IDs unless deliberately stable public IDs
- admin notes
- private organizer contacts
- emails
- invite-only lineup drafts
- unpublished lineup candidates
- internal parent/relationship IDs

### 4.7 Public Series

Allowed:

- public title
- slug or stable public series identifier
- canonical URL
- public description
- public recurrence summary
- public venue/place through the Public Place allowlist
- next public occurrence summary
- public event format/type/discipline labels
- dateModified

Not allowed:

- internal series IDs unless deliberately stable public IDs
- identity hashes
- recurrence normalization internals
- dedupe keys
- private notes
- draft/unpublished occurrence data

### 4.8 Public Media

Allowed:

- public image URL
- public alt text
- public caption
- public credit/attribution
- width and height
- media type

Not allowed:

- storage bucket internals
- signed upload URLs
- unapproved pre-event generated assets
- private source filenames
- moderation notes
- image-analysis metadata

### 4.9 Public Offer / Ticket

Allowed:

- public ticket URL
- public price text
- public numeric price and currency when safe and known
- free/paid flag
- public availability state
- public valid-from or sales-window dates

Not allowed:

- payment processor IDs
- checkout session IDs
- customer IDs
- discount/coupon codes not already public
- sales counts
- revenue metrics
- purchaser data

### 4.10 Public API Envelope

Allowed:

- `data`
- `links.self`
- `links.next` for pagination
- `links.canonical`
- `meta.generatedAt`
- `meta.pageSize`
- `meta.hasMore`
- `meta.schemaVersion`
- `meta.cache`

Not allowed:

- SQL/debug details
- internal query plans
- request user/session identifiers
- trace IDs in public body
- rate-limit bucket internals beyond standard headers
- internal feature-flag state

---

## 5. Surfaces Covered

### 5.1 `/events/[id]` JSON-LD

Future JSON-LD on public event detail pages must be generated from the public
serializer, not directly from database rows.

Requirements:

- Use Schema.org `Event` and related public sub-schemas.
- Include `Place` only through the Public Place allowlist.
- Include `organizer` only through the Public Organization allowlist.
- Include `performer` only through the Public Performer allowlist.
- Include `offers` only through the Public Offer allowlist.
- Include `image`, `url`, `startDate`, `endDate`, `eventStatus`, and
  `dateModified` only when values are public-safe.
- Exclude draft, invite-only, and private events entirely.
- For cancelled public events, return `eventStatus: "EventCancelled"` and keep
  the canonical URL stable.

### 5.2 Future `/events.json`

The future public event index must be paginated, cacheable, and serialized from
the same public resource types.

Requirements:

- no authentication required
- public events only
- no draft, invite-only, private, unlisted, or restricted-audience rows
- bounded page size, with 50 default and 50 maximum unless a later ADR changes it
- stable cursor or page token that does not reveal internal IDs
- `ETag` and `Last-Modified`
- deterministic ordering, such as upcoming start time then stable public key
- no raw SQL-style filtering
- response body limited to public fields

### 5.3 AI-Shaped Query Endpoints

Future endpoints such as `/events/tonight`, `/events/this-weekend`, and
`/events/upcoming?days=N&type=...` must use the same serializers and protections
as `/events.json`.

Requirements:

- allowlisted query parameters only
- bounded date windows
- bounded result count
- no arbitrary natural-language-to-SQL public query execution
- no personalized/private data
- no analytics or crawler attribution in the response body
- same cancelled-event semantics as detail and index responses

### 5.4 Crawler-Facing Metadata

OpenGraph, Twitter cards, meta tags, sitemap entries, robots policy, and any
future AI-crawler metadata must follow the same public field allowlists.

Crawler metadata must not expose fields that the JSON body would hide.

---

## 6. Schema-Driven Serialization

Future implementation must prefer compile-time enforceable serializers.

Required pattern:

- define explicit `PublicEvent`, `PublicPlace`, `PublicOrganization`,
  `PublicPerformer`, `PublicFestival`, `PublicSeries`, `PublicMedia`,
  `PublicOffer`, and envelope types
- write serializers that construct those public types field by field
- use `satisfies` or equivalent exactness checks where practical
- use schema validation for runtime output shape when public endpoints return
  JSON
- make additions to public fields require a type/schema change and a test
  update

Forbidden implementation pattern:

- spreading database rows into public responses
- returning ORM/Supabase rows directly
- `delete row.private_field` style field stripping
- serializer logic that depends on "remember to omit" comments
- separate endpoint-local serializers that drift from the canonical public
  resource types

If a field is not in a public type, it is not public.

---

## 7. Negative Exposure Contract

Future tests must prove these categories never appear in any public response:

- drafts
- invite-only data
- private/unlisted/restricted-audience rows
- private host notes
- private venue/organization/performer notes
- admin/moderation notes
- emails
- private phone numbers
- analytics
- telemetry
- audit logs
- model IDs and prompt metadata
- user IDs
- internal database IDs unless explicitly adopted as stable public IDs
- relationship IDs
- import run IDs
- source content hashes
- dedupe keys
- RSVP attendee data
- payment processor data
- auth/session/token values

This applies to JSON-LD, `/events.json`, AI-shaped endpoints, metadata tags,
sitemaps, and future public API variants.

---

## 8. Abuse Controls

### 8.1 Public API Rate Limits

Public APIs must enforce rate limits before broad rollout.

Minimum requirements:

- per-IP token bucket
- per-bot or per-user-agent class token bucket
- stricter anonymous/unknown-agent defaults
- separate limits for detail, index, and AI-shaped query endpoints
- 429 responses with `Retry-After`
- internal alerting for abuse spikes
- no unlimited export endpoint

### 8.2 Pagination and Query Bounds

Requirements:

- maximum page size
- maximum lookahead window for upcoming query endpoints
- maximum query complexity
- allowlisted filters only
- no wildcard free-text public API that can scan all rows in v1
- stable cursor tokens that do not expose internal IDs

### 8.3 Caching

Caching should make public access cheap without serving stale or private data.

Requirements:

- `ETag` and `Last-Modified` for `/events.json`
- cache keys must not include user/session state
- `Cache-Control` policy must be explicit per surface
- cancelled and updated events must invalidate or naturally refresh quickly
- draft-to-published transitions must not leak pre-publish content from caches
- published-to-draft/private transitions must remove public exposure quickly

### 8.4 Kill Switch

`ENABLE_PUBLIC_EVENTS_API` is the expected kill switch for future `/events.json`
and AI-shaped public APIs unless a later ADR approves a different name.

Disabled state must:

- leave existing public event pages intact unless the flag is explicitly scoped
  wider
- disable new public API endpoints
- return a structured unavailable response
- not expose internal feature-flag state in the response body

---

## 9. Crawler Policy

2I must not default to "allow all AI crawlers."

Future crawler policy must be deliberate per bot or bot class:

- allow
- allow with lower rate limit
- allow only specific public paths
- deny
- require partner review before allowlisting

Policy inputs:

- rate-limit cost
- source attribution and citation quality
- content licensing / community expectations
- abuse history
- bot identity reliability
- whether the crawler honors robots.txt and standard caching headers

Minimum requirements:

- documented per-bot policy table before implementation
- default for unknown AI crawlers is conservative rate-limited access or deny,
  not blanket allow
- separate handling for search-engine crawlers, AI crawlers, social preview
  crawlers, uptime monitors, and suspicious/unknown agents
- robots.txt policy aligned with API rate limits and caching
- logs classify bot/internal/AI-crawler traffic separately from human analytics

---

## 10. Cancelled-Event Semantics

Cancelled public events must remain citation-stable.

Requirements:

- public event detail URL continues to resolve
- JSON-LD uses Schema.org `eventStatus: "EventCancelled"`
- `/events.json` and AI-shaped endpoints include or exclude cancelled events
  according to documented query semantics, but must never present them as live
- canonical metadata should say cancelled clearly enough for crawlers and AI
  agents to propagate the cancellation
- invite-only/private cancelled events remain non-public

---

## 11. Citation Stability

2I exists so external agents cite CSC as the canonical source. That only works if
URLs remain durable.

Requirements:

- canonical event URLs are stable
- slug changes create redirects or alias records
- future stable public identifiers do not change
- `/events.json` records include canonical URLs
- JSON-LD `url` matches the canonical URL
- cancelled events keep canonical URLs
- deleted or removed public content should use an explicit gone/not-found policy
  that does not leak private data
- avoid crawler-visible soft redirects that confuse social or AI agents

Future 2I.7 must audit current slug behavior and define the redirect/alias
implementation before broad public API rollout.

---

## 12. Acceptance Tests for Future 2I Implementation

### 12.1 Serializer Tests

- full internal event fixture serializes to exactly the Public Event shape
- full internal venue fixture serializes to exactly the Public Place shape
- full internal organization fixture serializes to exactly the Public
  Organization shape
- full internal performer fixture serializes to exactly the Public Performer
  shape
- full internal festival fixture serializes to exactly the Public Festival shape
- full internal series fixture serializes to exactly the Public Series shape
- serializer output schemas reject unknown keys
- public type/schema additions require test updates

### 12.2 Negative Leak Tests

- draft event is absent from `/events/[id]` JSON-LD
- draft event is absent from `/events.json`
- draft event is absent from AI-shaped endpoints
- invite-only event data is absent from all public surfaces
- private host notes never appear
- emails never appear
- analytics and telemetry never appear
- internal IDs do not appear unless explicitly stable public IDs
- source/import/dedupe internals never appear
- RSVP attendee data never appears
- payment processor data never appears

### 12.3 JSON-LD Tests

- public scheduled event emits valid Schema.org Event JSON-LD
- public cancelled event emits `EventCancelled`
- JSON-LD uses canonical URL
- Place, organizer, performer, offers, image, and dateModified are all serialized
  through public allowlists
- private fields are absent from JSON-LD script contents

### 12.4 `/events.json` Tests

- returns public rows only
- enforces default and max page size
- rejects or clamps oversize page requests
- emits `ETag`
- emits `Last-Modified`
- uses stable cursor/page token without internal IDs
- has deterministic ordering
- includes canonical URLs
- does not expose private fields in envelope metadata

### 12.5 AI-Shaped Endpoint Tests

- `/events/tonight` returns only public events in the expected window
- `/events/this-weekend` returns only public events in the expected window
- `/events/upcoming?days=N&type=...` enforces date-window and filter bounds
- unsupported query parameters are rejected
- cancelled events are not described as live
- private/draft/invite-only events never appear

### 12.6 Abuse-Control Tests

- per-IP rate limit returns 429 with `Retry-After`
- per-bot policy can allow, rate-limit, or deny a bot class
- unknown AI crawler does not receive blanket allow behavior
- oversized page/query attempts are rejected or clamped
- cache headers are present and do not vary on user session
- cache invalidation or freshness behavior handles event update/cancel/private
  transitions

### 12.7 Citation-Stability Tests

- slug rename keeps old URL redirecting to canonical URL
- canonical URL remains stable in JSON-LD and `/events.json`
- cancelled event detail remains resolvable and marked cancelled
- removed/private event response does not leak prior public/private data

---

## 13. Non-Goals

This PR does not:

- change runtime behavior
- implement public serializers
- implement `/events/[id]` JSON-LD changes
- implement `/events.json`
- implement AI-shaped query endpoints
- edit crawler policy files
- edit robots.txt
- add rate limiting or caching code
- add schema or migrations
- edit prompt files
- edit contract files
- edit `web/**`
- edit `supabase/migrations/**`
- edit `tools/symphony/**`
- edit `ConversationalCreateUI.tsx`
- edit `docs/investigation/track1-claims.md`
- decide final public API URLs beyond the roadmap names
- expose any new data

If any of those changes are required to complete this ADR, the correct action is
to stop and ask in the PR before proceeding.

---

## 14. Stop Conditions

Stop and ask Sami via PR comment if this ADR or any follow-up requires:

- runtime code changes
- schema changes or migrations
- prompt changes
- contract changes
- edits under `web/**`
- edits under `supabase/migrations/**`
- edits under `tools/symphony/**`
- edits to §8.2 locked files
- enabling public APIs
- changing crawler behavior
- changing public route behavior

---

## 15. Decision

Adopt schema-driven public serializers and explicit per-resource field
allowlists as the mandatory boundary for all future 2I public data surfaces.

Approval of this ADR means future 2I implementation may be planned against this
boundary. It does not enable public APIs, change crawler behavior, or alter any
runtime response.

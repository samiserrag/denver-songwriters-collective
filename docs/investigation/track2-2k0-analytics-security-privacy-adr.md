# Track 2 2K.0: Analytics Security/Privacy ADR

**Date:** 2026-05-02
**Status:** Proposed - investigation only
**Scope:** Track 2 security/privacy ADR for future analytics implementation
**Runtime behavior changed:** No
**Needs Sami approval before implementation:** Yes

---

## 1. Purpose

This ADR locks the privacy and security rules for Track 2K analytics before any
analytics schema, endpoint, beacon, dashboard, retention job, or consent UI is
implemented.

The central decision: **2K analytics is first-party, aggregate, schema-bound,
and stewardship-limited.** It exists to answer product, operational, and
community-health questions without exposing individual behavior, selling data,
retargeting visitors, or creating free-form event logs that can accumulate PII.

Approval of this ADR does not create runtime analytics behavior. Future 2K
implementation PRs remain blocked until this ADR is approved, and each later PR
must prove that it implements these boundaries.

---

## 2. Evidence and Current State

Track 2 roadmap evidence:

- `docs/investigation/track2-roadmap.md:409-415` defines 2K as
  community-stewardship-bound analytics: community building, not mining, with
  aggregate measurement and GPC honor.
- `docs/investigation/track2-roadmap.md:428-443` establishes the binding
  negative contract: no data sale, no third-party pixels, no retargeting, no
  individual behavior identification, no demographic profiling, no raw IP
  storage, no precise geolocation, no long-term user-agent storage, and no
  spying on private content.
- `docs/investigation/track2-roadmap.md:447` names this ADR as the security
  stop-gate and lists the required registry, redaction, bot filtering,
  small-count suppression, output escaping, retention, and GPC decisions.
- `docs/investigation/track2-roadmap.md:448-455` sketches later implementation
  PRs for `analytics_events`, server-side logging, optional first-party visitor
  cookie, client beacon, search redaction, admin dashboard, privacy policy,
  consent UI, and retention cleanup.
- `docs/investigation/track2-roadmap.md:481-495` says security/privacy gates
  are non-negotiable, names 2K.0 as the analytics gate, requires kill switches,
  and requires per-IP rate limits plus bot filtering for 2K analytics endpoints.
- `docs/investigation/track2-roadmap.md:577-600` says every sub-track `.0`
  security ADR is a hard stop-gate before implementation and includes 2K.0 in
  the parallel security ADR phase.
- `docs/investigation/track2-roadmap.md:734-740` defines Track 2 completion for
  stewardship and observability: first-party analytics, privacy policy matching
  actual behavior, cookie consent if non-essential persistent identifiers are
  introduced, tested raw-event retention, and bot/internal/AI-crawler filtering
  separated from human metrics.
- `docs/investigation/track2-roadmap.md:762-780` allows investigation docs under
  `docs/investigation/track2-*.md` but requires explicit approval for schema
  migrations, new routes, read-path changes, env vars, prompt rewrites, or other
  runtime-affecting work.

Current implementation state for this ADR:

- This PR is documentation only.
- No analytics runtime behavior is enabled or changed.
- No schema, route, prompt, contract, migration, `web/**`, or Symphony file is
  edited.

---

## 3. Decision Summary

Future 2K analytics implementation must follow these decisions:

1. Analytics is first-party only: no third-party pixels, no third-party
   analytics scripts, no data sale, no retargeting, and no cross-site ad pools.
2. Analytics is aggregate-only for dashboards and reporting. There is no
   individual behavior dashboard, no partner raw-data export, and no demographic
   profiling.
3. Every stored analytics event must be registered by `event_name` with an
   allowlisted property schema. Free-form analytics payloads are not allowed.
4. Unknown `event_name` values and unknown properties must be rejected before
   storage, not silently accepted and stripped later.
5. Write-time redaction must run before persistence and before analytics logging
   sinks receive data.
6. Bot, internal, admin, system, test, and AI-crawler traffic must be classified
   separately from human metrics.
7. Dashboard breakdowns must enforce small-count suppression with default
   `n >= 10`.
8. Admin rendering must escape analytics values and assume stored values may be
   malicious.
9. Raw events may be retained for 90 to 180 days, then deleted or aggregated by
   a scheduled retention job.
10. GPC is a real opt-out for non-essential client analytics. When GPC is
    present, non-essential client collection stops.
11. Visitor/session identifiers must avoid raw IP storage and long-term
    user-agent storage. HMAC-derived identifiers require rotating salts.
12. V1 default for non-essential client analytics is **no client analytics
    cookie until the privacy policy and consent posture are implemented**.
13. The future analytics client-collection kill switch is
    `ENABLE_ANALYTICS_CLIENT_COLLECTION`; it must default off until the approved
    implementation and policy work explicitly enable it.

---

## 4. Event Registry and Property Schema

### 4.1 Registry Requirement

Future analytics writes must pass through a server-owned event registry. The
registry maps each `event_name` to:

- owning surface or subsystem
- event purpose
- allowed actor types
- allowed properties, types, and maximum lengths
- redaction rules for each property
- whether the event is essential server telemetry or non-essential client
  analytics
- whether the event may include authenticated user context
- retention class
- dashboard eligibility

The registry is the contract. Implementation may use `jsonb` as a physical
storage type only if writes are schema-checked against this registry before
storage. The presence of a `properties` object must not become an arbitrary log
bucket.

### 4.2 No Free-Form Analytics Payloads

The following are not allowed:

- catch-all `metadata`, `payload`, `context`, `debug`, or `raw` objects
- arbitrary request body capture
- raw query strings
- raw headers
- raw form field values
- long LLM prompts, completions, transcripts, scraped text, or user messages
- private draft content, private host notes, private messages, or unsubmitted
  form fields
- user-supplied HTML or Markdown that is not explicitly registered, length
  capped, redacted, and escaped on render

If a future implementation needs a new property, it must add it to the registry
with type, length, redaction, retention, and dashboard semantics before it can be
written.

### 4.3 Registry Acceptance Tests

Future tests must prove:

- unknown `event_name` is rejected
- unknown property keys are rejected
- registered properties enforce type and maximum length
- free-form objects are rejected unless a later ADR explicitly approves a
  tightly scoped shape
- private draft, private note, raw prompt, raw completion, and raw search query
  fixtures cannot be stored as analytics properties
- the same registry drives server acceptance and dashboard serialization where
  practical

---

## 5. Write-Time Redaction

Redaction must happen before persistence. Analytics code must not rely on a
dashboard, query, export, or cleanup job to remove sensitive values later.

Future implementation must redact or reject:

- email addresses
- phone numbers
- bearer tokens, API keys, JWTs, OAuth codes, refresh tokens, session IDs,
  CSRF tokens, reset tokens, magic-link tokens, and invite tokens
- URLs or query strings containing secret-like parameter names such as `token`,
  `auth`, `authorization`, `session`, `key`, `secret`, `code`, `state`,
  `password`, `jwt`, `access_token`, or `refresh_token`
- long free text, including pasted event descriptions, search queries that look
  like messages, AI transcripts, scraped text, and unbounded error details
- raw headers, cookies, referrers with query secrets, and request bodies
- precise geolocation and raw IP addresses
- long-term raw user-agent strings

Redaction must be deny-by-default for secret-like field names. A property name
that implies credentials or private content must be rejected unless the registry
explicitly marks it safe and tests cover the case.

Future tests must include realistic adversarial fixtures: emails embedded in
search text, phone numbers with punctuation, URLs with nested encoded token
parameters, JWT-shaped strings, OAuth callback URLs, long pasted free text, and
HTML/script payloads.

---

## 6. Actor Classification and Human Metrics

Analytics must not mix human metrics with bot, internal, admin, system, test, or
AI-crawler traffic.

Future events must carry an `actor_type` or equivalent classification that can
distinguish at least:

- `human`
- `bot`
- `ai_crawler`
- `internal`
- `admin`
- `system`
- `test`

Human product metrics must exclude non-human and internal classifications by
default. Separate operational dashboards may show bot, crawler, and internal
activity, but those numbers must be labeled as operational traffic and never
reported as community reach.

Classification cannot depend only on user-agent text. Future implementation
should combine allowlisted internal markers, known crawler signatures, request
context, deployment environment, and rate-limit signals. Misclassified traffic
must fail toward exclusion from human metrics.

---

## 7. Visitor, Session, and Request Identifiers

Future analytics may need deduplication, abuse controls, and aggregate returning
visitor metrics. Those needs do not authorize raw identifiers.

Required identifier posture:

- no raw IP storage in analytics tables, logs, dashboard payloads, or exports
- no long-term raw user-agent storage
- no browser fingerprinting beyond structurally necessary fraud prevention
- no precise geolocation; city/region/country is the maximum granularity
- HMAC-derived visitor or session identifiers must use a server-side secret and
  rotating salt
- IP plus user-agent derived identifiers may only be ephemeral or rotation-bound;
  they must not become a stable long-term person key
- authenticated `user_id` may be stored only for first-party product actions
  where the registry explicitly allows it, and dashboard output must still be
  aggregate/suppressed
- request IDs may be stored for debugging correlation but must not embed
  secrets, IPs, or user-identifying payloads

The roadmap's proposed `visitor_key_hash` is acceptable only as an HMAC with
rotating salt and no raw IP persistence. The optional `anon_visitor_id_hash`
cookie remains disabled until the policy and consent posture approve
non-essential persistent client identifiers.

---

## 8. Consent, GPC, and Client Collection Defaults

The exact regional legal consent matrix is a 2K policy decision that must be
finished before non-essential client analytics launch. This ADR locks the v1
technical default:

**V1 defaults to no client analytics cookie until policy is implemented.**

That means:

- server-side first-party logging for essential product/security/operational
  actions may proceed only through the registry, redaction, retention, and
  dashboard limits in this ADR
- non-essential client analytics collection must stay behind
  `ENABLE_ANALYTICS_CLIENT_COLLECTION`
- the client beacon must not set a persistent visitor cookie until the privacy
  policy and consent UI, if required, are live
- if GPC is present, non-essential client analytics must stop even if a future
  regional policy would otherwise allow opt-out collection
- opt-out state must prevent both event collection and cookie refresh for
  non-essential client analytics
- absence of GPC is not consent to introduce a persistent client identifier
  before the policy work lands

The later privacy policy and cookie-consent PR may decide the exact opt-in,
opt-out, regional banner, and retention language. It may not weaken the GPC,
first-party-only, no-sale, no-retargeting, no-profiling, no-individual-dashboard,
or schema-bound collection requirements without a new ADR.

---

## 9. Dashboard and Reporting Rules

Analytics dashboards and reports must expose aggregates, not individual
behavior.

Required rules:

- default small-count suppression is `n >= 10` for dashboard breakdowns
- suppressed cells must not be recoverable through adjacent filters,
  drilldowns, exports, or API responses
- dashboard filters must not allow reconstruction of an individual's behavior
  by combining date, path, geography, referrer, event, host, user, or session
  dimensions
- no individual clickstream, visitor timeline, profile, per-person funnel, or
  per-person AI interaction dashboard
- partner/funder reporting uses aggregate metrics only
- exports must follow the same suppression and redaction rules as dashboards
- names may appear only when the underlying product surface already makes the
  person public by role or explicit opt-in, such as host attribution on an event
  they host

For very small communities or narrow slices, dashboard output should show a
suppressed placeholder, broader aggregate, or queued manual-review outcome
instead of the exact value.

---

## 10. Admin Rendering and XSS Defense

Analytics values must be treated as untrusted stored input. Attackers can place
script payloads in paths, query strings, event titles, referrers, search terms,
user-agent strings, and registered string properties.

Future admin rendering must:

- escape analytics values by default
- avoid `dangerouslySetInnerHTML` for analytics values
- avoid rendering stored values into URLs, CSS, scripts, or attributes without
  context-appropriate encoding
- truncate long values before display
- render redaction placeholders as inert text
- test stored and reflected XSS payloads in dashboard values, filters, exports,
  and empty/error states

Output escaping is required even though write-time redaction exists. Redaction
reduces sensitive data. Escaping prevents malicious but registry-valid strings
from executing.

---

## 11. Retention and Aggregation

Raw analytics events must be temporary.

Future implementation must include a scheduled retention job with these
properties:

- raw events expire after a configured period between 90 and 180 days
- aggregate tables may persist indefinitely if they contain no user-level
  records and preserve small-count suppression
- retention job behavior is tested with historical fixtures
- retention job failures are observable
- aggregate generation must happen before raw deletion where needed
- deletion must remove raw properties, identifiers, request IDs, and event rows
  covered by the retention window
- retention exceptions require a separate decision and must not become a silent
  indefinite raw-log archive

The implementation may choose a default retention inside the 90 to 180 day
window. It must not exceed 180 days without a follow-up ADR and explicit Sami
approval.

---

## 12. Endpoint and Abuse Controls

Future 2K endpoints must be designed as abuse surfaces.

Required controls:

- first-party endpoint only; no third-party pixels or third-party scripts
- same-origin or otherwise deliberate request acceptance policy
- per-IP token-bucket rate limits for analytics endpoints
- bot/internal/AI-crawler filtering before human metric aggregation
- payload size limits
- registered content-type and method handling
- no credential forwarding to analytics sinks
- no analytics endpoint behavior that can be used as an open redirect, SSRF
  fetcher, token exfiltration target, or unbounded log writer
- kill switch for client collection:
  `ENABLE_ANALYTICS_CLIENT_COLLECTION`

The kill switch must disable non-essential client analytics collection without
breaking essential product behavior. When off, the client beacon should either
not initialize or should return a no-op response without setting cookies.

---

## 13. Future Implementation Acceptance Criteria

A later implementation PR in 2K must include focused tests or equivalent proof
for the relevant surface before merge:

- registry rejects unknown `event_name`
- registry rejects unknown property keys
- registry enforces property types and length limits
- no free-form analytics payload can be persisted
- write-time redaction strips or rejects emails, phone numbers, token-like
  strings, secret query parameters, long free text, raw headers, raw cookies, raw
  request bodies, raw IPs, and long-term raw user agents
- GPC disables non-essential client analytics collection
- no client analytics cookie is set before policy/consent work enables it
- `ENABLE_ANALYTICS_CLIENT_COLLECTION` disables client collection
- bot, internal, admin, system, test, and AI-crawler traffic are separated from
  human metrics
- dashboard breakdowns suppress counts below `n >= 10`
- suppression cannot be bypassed through filters, exports, or API response shape
- admin analytics rendering escapes stored values and blocks stored/reflected
  XSS fixtures
- raw events expire after the configured 90 to 180 day retention period
- aggregate tables do not contain user-level records
- public or partner-facing reports cannot expose user-level records
- privacy policy and cookie consent behavior match the shipped runtime behavior
  before non-essential persistent client identifiers are enabled

---

## 14. Non-Goals

This ADR does not:

- implement analytics events
- create or edit schema
- create or edit endpoints
- create or edit runtime routes
- add or rename environment variables in runtime code
- enable client analytics collection
- add a client analytics cookie
- edit prompt files
- edit contract files
- edit `web/**`
- edit `supabase/migrations/**`
- edit `tools/symphony/**`
- edit `ConversationalCreateUI.tsx`
- edit `docs/investigation/track1-claims.md`
- decide final legal advice for every region
- decide final dashboard UI
- decide exact aggregate table schema
- approve third-party analytics vendors

If any of those changes are required to complete this ADR, the correct action is
to stop and ask in the PR before proceeding.

---

## 15. Stop Conditions

Stop and ask Sami via PR comment if this ADR or any follow-up requires:

- runtime code changes
- schema changes or migrations
- prompt changes
- contract changes
- edits under `web/**`
- edits under `supabase/migrations/**`
- edits under `tools/symphony/**`
- edits to Section 8.2 locked files
- enabling analytics collection
- adding a client analytics cookie
- adding a third-party analytics provider

---

## 16. Decision

Adopt the analytics security/privacy boundary described above as the prerequisite
for Track 2K implementation.

This decision locks the v1 consent default: non-essential client analytics uses
no client analytics cookie until the privacy policy and consent posture are
implemented. The exact regional legal consent matrix remains a later policy
deliverable, but future policy work may not weaken the first-party-only,
GPC-honoring, no-sale, no-retargeting, no-profiling, no-individual-dashboard, or
schema-bound collection requirements in this ADR without a new stop-gate.

Approval of this ADR means future 2K implementation may be planned against this
boundary. It does not enable analytics, add schema, add routes, add cookies, add
third-party pixels, or change runtime behavior.

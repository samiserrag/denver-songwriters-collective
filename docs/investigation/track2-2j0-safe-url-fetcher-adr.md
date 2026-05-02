# Track 2 2J.0: Safe URL Fetcher ADR

**Date:** 2026-05-02
**Status:** Proposed - investigation only
**Scope:** Track 2 security ADR for future URL fetching
**Runtime behavior changed:** No
**Needs Sami approval before implementation:** Yes

---

## 1. Purpose

This ADR defines the threat model, required safety boundary, and acceptance
tests for future URL fetching in Track 2.

The central decision: **all future URL fetching for 2J reality sync, 2D URL
import, and 2F concierge URL-paste surfaces must route through one future
`safeFetch()` boundary.** No ad-hoc `fetch(url)`, HTTP client, browser
automation, or worker-specific bypass is allowed.

This is the security stop-gate before 2J.1 implements `safeFetch()`. Approval of
this ADR does not implement fetching, enable URL input, add routes, add schema,
or change runtime behavior.

---

## 2. Evidence and Current State

Track 2 roadmap evidence:

- `docs/investigation/track2-roadmap.md:223-224` requires robots.txt, rate
  limits, and aggressive HTML sanitization for URL import foundations.
- `docs/investigation/track2-roadmap.md:228-231` makes JSON-LD parsing the first
  deterministic import path and requires review UI before imports in v1.
- `docs/investigation/track2-roadmap.md:252-255` names scraping brittleness,
  LLM hallucination, robots.txt non-compliance, and data quality pollution as
  high risks.
- `docs/investigation/track2-roadmap.md:375-388` scopes 2J v1 to known-source
  reverification and names 2J.0 plus 2J.1 as hard prerequisites, including SSRF,
  DNS rebinding, redirect handling, timeouts, response caps, content-type
  allowlists, no credentials, no JS execution, and central rate limits.
- `docs/investigation/track2-roadmap.md:394-405` defers broad autonomous crawling
  and calls out SSRF, source ToS, drift false positives, and model-coupling
  risks.
- `docs/investigation/track2-roadmap.md:489-497` defines 2J.0/2J.1 as the
  single-boundary SSRF defense, requires rate limits for the 2J fetch queue, and
  requires external-content prompt-injection labeling.
- `docs/investigation/track2-roadmap.md:584-586` says no implementation proceeds
  until security ADR approval and makes 2J.1 a hard prerequisite for 2J
  reverification and 2F URL-paste input.
- `docs/investigation/track2-roadmap.md:606` preserves v1 scope discipline:
  known-source reverification only, no broad autonomous crawling.
- `docs/investigation/track2-roadmap.md:722-723` requires 2J.1 as the single
  in-process boundary with no ad-hoc `fetch(url)` and keeps non-JSON-LD sources
  on manual review until 2D.2 lands.

Agent concierge plan evidence:

- `docs/investigation/agent-concierge-unification-plan.md:140-148` describes
  the future URL-paste flow using robots.txt, rate limits, JSON-LD first, and
  review before create/update actions.
- `docs/investigation/agent-concierge-unification-plan.md:297-308` says agent
  URL input is a slim wrapper around Track 2D pipeline pieces and must sequence
  carefully with import foundations.
- `docs/investigation/agent-concierge-unification-plan.md:407-418` identifies
  arbitrary URL input as a real attack surface and names response caps,
  timeouts, sanitization, JSON-LD preference, and review UI as mitigations.

---

## 3. Decision Summary

Future URL fetching must use a single `safeFetch()` boundary with these
properties:

1. Accept only normalized `http` and `https` URLs.
2. Block private, reserved, local, multicast, and otherwise non-public network
   destinations before connecting.
3. Defend against DNS rebinding by resolving, validating, and connecting only to
   the approved address for the request.
4. Re-run all validation on every redirect.
5. Enforce strict timeout, redirect, decompression, and response-size limits.
6. Allow only explicitly supported content types.
7. Forward no user credentials, cookies, authorization headers, client IPs, or
   session context.
8. Execute no JavaScript and use no headless browser in v1.
9. Respect robots.txt and central rate limits before fetching page content.
10. Produce structured logs/audit records for every allow, block, timeout, and
    failure.
11. Label scraped text passed to an LLM as untrusted external evidence.
12. Preserve v1 scope: known-source reverification only for 2J; no broad
    autonomous crawling; non-JSON-LD sources become queued/manual-review
    outcomes, not LLM auto-extraction.

The future implementation can choose the exact module path, but the boundary
must be centralized and reusable by 2J, 2D, and 2F.

---

## 4. Threat Model

### 4.1 SSRF and Internal Network Access

Attackers may submit or influence URLs that target:

- loopback services such as `127.0.0.1`, `localhost`, or `[::1]`
- private RFC1918 networks
- link-local addresses, including cloud metadata services
- unique-local IPv6 networks
- carrier-grade NAT, benchmark, documentation, multicast, or reserved ranges
- internal DNS names that resolve to private addresses
- encoded or alternate IP forms that bypass naive string checks

The future `safeFetch()` must allow only public global destinations after URL
normalization and DNS resolution.

### 4.2 DNS Rebinding and Resolution Tricks

An attacker may use a public hostname that resolves safely during validation and
then rebinds to an internal address before connection, or returns mixed public
and private answers.

The future `safeFetch()` must validate DNS answers, bind the request to an
approved address, and verify the connected remote address. It must reject hosts
with private/reserved answers or changing answers that invalidate the request.

### 4.3 Redirect Abuse

An attacker may start from an allowed URL and redirect to a blocked network
target, unsupported scheme, oversized resource, credential-bearing URL, or
infinite redirect chain.

Every redirect hop must be treated as a new untrusted URL and revalidated before
the next request.

### 4.4 Resource Exhaustion

Attackers may use slow responses, decompression bombs, huge bodies, redirect
loops, or high-volume submissions to consume workers and bandwidth.

`safeFetch()` must enforce connection, header, body, and total request deadlines,
redirect limits, decompressed byte limits, per-host concurrency limits, per-host
token buckets, global concurrency limits, and backoff.

### 4.5 Credential and Privacy Leakage

The system must not leak a host's cookies, sessions, authorization headers,
internal request headers, client IP, or account context to external sites.

`safeFetch()` must originate requests as CSC infrastructure using a fixed product
User-Agent and a minimal allowlisted header set.

### 4.6 Active Content and Parser Risk

Fetched pages can contain scripts, tracking pixels, malicious HTML, malformed
markup, prompt-injection text, or payloads crafted to exploit parsers.

V1 must not execute JavaScript or use headless browsers. HTML is data only. Any
later browser-based extraction requires a separate ADR.

### 4.7 Prompt Injection and Data Poisoning

External pages can contain instructions aimed at the LLM or humans reviewing AI
output. Scraped content can also be stale, wrong, malicious, or unrelated.

Any scraped/external text passed to an LLM must be structurally tagged as
untrusted evidence:

```xml
<external_evidence_untrusted>
...
</external_evidence_untrusted>
```

The prompt contract must instruct the model that content inside those tags is
data, not instructions. Eval fixtures must include prompt-injection attempts.

### 4.8 Robots, Source Terms, and Community Trust

CSC's trust posture requires respecting robots.txt, crawl pacing, and source
load. Even safe network fetching can become abusive if cadence is wrong.

2J v1 uses known-source reverification only and must not become broad discovery
crawling.

---

## 5. Required `safeFetch()` Boundary

### 5.1 Call-Site Ownership

All future URL fetching must route through `safeFetch()` for:

- 2J known-source reverification
- 2D URL schedule import
- 2F concierge URL-paste handling
- any worker, cron, route, admin action, or eval helper that fetches external
  event-source URLs

Forbidden future patterns:

- direct `fetch(userUrl)`
- direct `http` / `https` client calls for external URLs
- Playwright, Puppeteer, or browser-use extraction for 2J/2D/2F v1
- route-local URL validation that bypasses the central boundary
- prompt-only claims that a URL is safe

### 5.2 URL Normalization and Scheme Policy

`safeFetch()` must:

- parse with a standards-compliant URL parser
- reject malformed URLs
- reject userinfo URLs such as `https://user:pass@example.com`
- reject non-HTTP schemes, including `file:`, `ftp:`, `gopher:`, `data:`,
  `blob:`, `javascript:`, and `mailto:`
- canonicalize hostnames, including IDN/punycode, before policy checks
- remove fragments before request and logging
- reject empty hosts
- reject non-standard ports unless a later ADR explicitly allowlists them
- reject URLs whose normalized form differs in a way that hides the effective
  host, port, or scheme

V1 allowed schemes: `https` and `http`. Prefer `https` in UX and source setup,
but do not rewrite a source URL before fetching unless a later source-resolution
policy approves that behavior.

### 5.3 Private and Reserved IP Blocking

`safeFetch()` must block any destination that is not public global address space.

Blocked categories include:

- IPv4 loopback, private, link-local, multicast, broadcast, reserved,
  documentation, benchmark, carrier-grade NAT, and unspecified ranges
- IPv6 loopback, unique-local, link-local, multicast, documentation, IPv4-mapped
  private/reserved ranges, and unspecified ranges
- cloud metadata hostnames and addresses, including common metadata aliases
- `localhost` and local-domain aliases

If DNS returns both public and blocked addresses for a hostname, reject the
request rather than selecting the public address.

### 5.4 DNS Rebinding Defense

The future implementation must:

- resolve hostnames through a controlled resolver path
- validate every A and AAAA answer before connecting
- connect only to an address that passed validation
- verify the connected socket remote address still matches the approved address
- repeat resolution and validation for each redirect target
- avoid trusting stale DNS cache entries beyond their TTL
- fail closed when resolution changes or cannot be validated

Acceptance tests must simulate DNS answers changing from public to private
between validation and connection.

### 5.5 Redirect Policy

Redirect handling must be explicit.

Requirements:

- maximum 3 redirects in v1
- only follow redirects for `GET` or `HEAD`
- re-parse, normalize, resolve, and validate every redirect target
- reject redirects to unsupported schemes
- reject redirects to blocked IP ranges or credential-bearing URLs
- reject HTTPS-to-HTTP downgrades unless a later ADR explicitly allows a source
  class to do so
- detect redirect loops
- apply rate limits and robots policy to the final target host and path
- log the redirect chain without logging secrets or response bodies

### 5.6 Timeout Policy

V1 defaults for future implementation:

- DNS resolution timeout: 2 seconds
- TCP/TLS connection timeout: 3 seconds
- response headers timeout: 5 seconds
- total request timeout: 10 seconds
- idle body read timeout: 2 seconds

Timeouts must produce structured blocked/failed outcomes, not unhandled errors.
Retries are allowed only through a bounded queue/backoff policy, never inline
unbounded retry loops.

### 5.7 Response-Size Caps

V1 maximum response body: 5 MiB after decompression.

Requirements:

- enforce limits on decompressed bytes, not just compressed transfer size
- stop reading once the cap is exceeded
- reject archive/container formats in v1
- avoid storing raw response bodies by default
- return enough metadata for the caller to queue manual review or retry

The future 2J drift-evidence package should store hashes and sanitized
observations, not unbounded raw pages.

### 5.8 Content-Type Allowlist

V1 allowed content types:

- `text/html`
- `application/xhtml+xml`
- `application/ld+json`
- `application/json`
- `text/plain` only when the caller explicitly expects JSON-LD/text extraction

Blocked types include images, PDFs, archives, executable content, audio/video,
binary streams, and missing/unknown types unless a later ADR approves a source
class.

The implementation must validate content type before parsing and must still cap
bytes if the server lies about the type.

### 5.9 Credential Forwarding and Header Policy

`safeFetch()` must not forward:

- user cookies
- application cookies
- `Authorization`
- Supabase or service-role credentials
- OAuth tokens
- session IDs
- request IP forwarding headers
- browser fingerprint headers copied from the user's request

Allowed outbound headers in v1:

- fixed `User-Agent` identifying CSC source verification/import
- `Accept` for the allowed content types
- `Accept-Encoding` only when decompression caps are enforced
- optional `If-None-Match` / `If-Modified-Since` for known-source revalidation

Redirects must not preserve any header that could become credential-like.

### 5.10 No JavaScript or Headless Browser Execution

V1 extraction is HTTP fetch plus deterministic parsers. No JavaScript execution,
DOM event processing, headless browser rendering, screenshot OCR, or Playwright
lineup discovery is allowed for 2J/2D/2F URL fetching.

If a source requires JavaScript to render event data, the v1 result is a queued
manual-review outcome such as `source_requires_js`, not a browser fallback.

### 5.11 Robots.txt Posture

Robots policy must be evaluated after network safety checks and before fetching
page content.

Requirements:

- use a fixed product User-Agent
- fetch and cache robots.txt per scheme/host/port with a bounded TTL
- honor `Disallow`
- honor `Crawl-delay` where present, or apply the stricter internal rate limit
- fail closed for first-time sources when robots.txt cannot be fetched or parsed
- allow an explicit future admin override only if separately approved,
  documented, audited, and scoped to a known source
- log robots allow/block/unknown decisions

Robots fetching itself must use the same network-level SSRF protections, with
only the robots policy check bypassed to avoid recursion.

### 5.12 Rate Limits and Backoff

V1 must include both per-host and global controls.

Minimum requirements:

- per-host concurrency cap
- global concurrency cap
- per-host token bucket or equivalent pacing
- exponential backoff after failures, timeouts, 429, and 5xx responses
- separate budget for manual user-triggered URL paste and scheduled 2J workers
- no unbounded fan-out from one source page
- no recursive link crawling in 2J v1

2J reverification cadence should be slow and known-source based. The fetcher
must not discover and enqueue arbitrary new links.

### 5.13 Logging and Audit Expectations

Every `safeFetch()` call must produce a structured outcome record.

Minimum fields:

- timestamp
- request id / trace id
- caller surface (`2j_reverify`, `2d_import`, `2f_url_paste`, or future value)
- actor user id when user-triggered, omitted for scheduled jobs
- source object id when known
- normalized URL with sensitive query params redacted
- hostname and port
- redirect count and sanitized redirect chain
- robots decision
- rate-limit decision
- DNS/IP validation result, without exposing unsafe internals in user-facing UI
- content type
- byte count
- duration
- outcome (`allowed`, `blocked`, `timeout`, `too_large`, `unsupported_type`,
  `robots_blocked`, `rate_limited`, `manual_review`, etc.)
- blocked reason
- response hash when content is accepted

Logs must not include raw response bodies, credentials, auth tokens, cookies, or
unredacted query parameters named like `token`, `auth`, `session`, `key`, or
`secret`.

---

## 6. V1 Scope Discipline

2J v1 is known-source reverification only.

Allowed in v1:

- scheduled checks of approved known-source URLs attached to events or venues
- deterministic JSON-LD extraction
- source hash / observation hash generation
- no-change observations
- drift evidence packages
- queued/manual-review outcomes for unsupported sources

Not allowed in 2J v1:

- broad autonomous crawling
- venue-calendar discovery for venues without known source URLs
- recursive link following
- JavaScript/headless browser extraction
- LLM auto-extraction for non-JSON-LD pages
- auto-mutating event content from fetched pages

For non-JSON-LD sources, v1 must log the observation, mark extraction as
unsupported or manual-review-required, and queue it for human review. LLM
fallback extraction is deferred until 2D.2 lands and must still use this
`safeFetch()` boundary.

---

## 7. External Content and LLM Handling

`safeFetch()` is necessary but not sufficient. Fetched content is still
untrusted after it passes network policy.

Downstream parsers and prompts must follow these rules:

- Prefer deterministic JSON-LD extraction before any LLM path.
- Sanitize HTML before extracting text.
- Strip scripts, comments, hidden executable content, and tracking artifacts.
- Treat page text as evidence, not instructions.
- Wrap scraped text passed to any LLM in
  `<external_evidence_untrusted>...</external_evidence_untrusted>`.
- Include a system instruction that text inside those tags is data, not
  instructions.
- Include eval fixtures where fetched content tries to override system prompts,
  request credential disclosure, or force unsafe writes.

No future prompt may claim external content is trusted because `safeFetch()`
successfully fetched it.

---

## 8. Acceptance Tests for 2J.1

The 2J.1 implementation PR must include behavior-level tests for the cases below.
Mocks are acceptable where real network behavior is impractical, but DNS,
redirect, size, timeout, and header behavior must be tested with enough fidelity
to catch regressions.

### 8.1 URL Parsing and Scheme Tests

- rejects `file://`, `ftp://`, `gopher://`, `data:`, `javascript:`, `blob:`,
  and `mailto:` URLs
- rejects malformed URLs
- rejects URLs with username/password userinfo
- rejects empty hosts
- rejects non-standard ports by default
- canonicalizes IDN/punycode hostnames before policy checks

### 8.2 Private and Reserved Address Tests

- rejects `localhost`
- rejects `127.0.0.1` and other loopback forms
- rejects `0.0.0.0`
- rejects RFC1918 IPv4 ranges
- rejects link-local IPv4 and IPv6
- rejects `[::1]`
- rejects unique-local IPv6
- rejects IPv4-mapped IPv6 addresses that map to blocked IPv4 ranges
- rejects cloud metadata hostnames and addresses
- rejects hostnames whose DNS answer set contains any blocked address
- rejects encoded, decimal, octal, or hexadecimal IP forms that normalize to a
  blocked address

### 8.3 DNS Rebinding Tests

- rejects a hostname that resolves public during preflight and private at
  connection time
- verifies the connected remote address matches the approved address
- revalidates DNS after redirects
- fails closed when DNS resolution times out or returns no validated public
  address

### 8.4 Redirect Tests

- follows up to 3 safe redirects
- rejects redirect loops
- rejects the 4th redirect
- rejects redirects to private/reserved addresses
- rejects redirects to unsupported schemes
- rejects HTTPS-to-HTTP downgrade redirects
- strips fragments from redirected URLs
- logs sanitized redirect chains

### 8.5 Timeout and Size Tests

- fails with a structured timeout for slow DNS
- fails with a structured timeout for slow connect
- fails with a structured timeout for slow headers
- fails with a structured timeout for stalled body reads
- aborts when decompressed body exceeds 5 MiB
- rejects compressed responses that expand past the cap

### 8.6 Content-Type Tests

- accepts `text/html`
- accepts `application/ld+json`
- accepts `application/json`
- accepts explicit `text/plain` only for approved callers
- rejects image, PDF, archive, executable, audio/video, and binary stream types
- rejects missing or unknown content types by default

### 8.7 Credential and Header Tests

- does not forward inbound `Cookie`
- does not forward inbound `Authorization`
- does not forward Supabase or service-role secrets
- does not forward `X-Forwarded-For` or client IP headers
- rejects credential-bearing URLs
- sends only the outbound header allowlist
- does not preserve credential-like headers across redirects

### 8.8 JavaScript/Browser Tests

- does not execute inline or external scripts
- does not instantiate Playwright, Puppeteer, browser-use, or a DOM runtime with
  script execution
- returns `source_requires_js` or equivalent when deterministic extraction is not
  possible without JavaScript

### 8.9 Robots and Rate-Limit Tests

- blocks paths disallowed by robots.txt
- allows paths allowed by robots.txt
- fails closed for first-time sources when robots.txt is unavailable or
  unparsable
- caches robots decisions within TTL
- honors crawl delay or the stricter internal limit
- enforces per-host concurrency
- enforces global concurrency
- applies backoff after timeout, 429, and 5xx responses

### 8.10 Logging and Audit Tests

- emits a structured record for allowed fetches
- emits a structured record for blocked fetches
- redacts sensitive query params in logs
- omits raw response bodies from logs
- records robots, redirect, content-type, byte-count, duration, and outcome
- includes request id / trace id and caller surface

### 8.11 LLM Boundary Tests

- wraps scraped text passed to LLMs in
  `<external_evidence_untrusted>...</external_evidence_untrusted>`
- includes prompt-injection fixtures that try to override system instructions
- confirms non-JSON-LD 2J v1 sources become manual-review/queued outcomes, not
  LLM auto-extraction

---

## 9. Non-Goals

This PR does not:

- change runtime behavior
- implement `safeFetch()`
- add URL fetching
- add routes or endpoints
- add workers or cron jobs
- add schema or migrations
- edit prompt files
- edit contract files
- edit `web/**`
- edit `supabase/migrations/**`
- edit `tools/symphony/**`
- edit `ConversationalCreateUI.tsx`
- edit `docs/investigation/track1-claims.md`
- enable URL-paste handling
- enable 2J reverification
- enable broad crawling
- enable LLM extraction from non-JSON-LD sources
- decide the final storage schema for source observations or audit logs

If any of those changes are required to complete this ADR, the correct action is
to stop and ask in the PR before proceeding.

---

## 10. Future Implementation Notes

These notes are binding requirements for the next implementation PR, not code in
this ADR:

- 2J.1 must implement the `safeFetch()` boundary before any URL-fetching feature
  ships.
- Future 2J, 2D, and 2F URL-fetching call sites must import/use that boundary.
- Feature-level kill switches remain required for URL surfaces. `ENABLE_REALITY_SYNC`
  is the expected 2J switch and `ENABLE_AGENT_URL_INPUT` is the expected 2F URL
  paste switch unless a later ADR approves different names.
- The fetcher should return structured success/failure reasons so UI, queues,
  and logs do not parse human-readable error strings.
- The fetcher should be designed for later extraction to a worker/service, but
  v1 can be a single in-process module.

---

## 11. Stop Conditions

Stop and ask Sami via PR comment if this ADR or any follow-up requires:

- runtime code changes
- schema changes or migrations
- prompt changes
- contract changes
- edits under `web/**`
- edits under `supabase/migrations/**`
- edits under `tools/symphony/**`
- edits to §8.2 locked files
- enabling URL-paste input
- enabling reality-sync fetching
- enabling LLM auto-extraction for non-JSON-LD sources

---

## 12. Decision

Adopt `safeFetch()` as the single mandatory URL-fetching boundary for future 2J,
2D, and 2F URL surfaces.

Approval of this ADR means 2J.1 may be planned against this threat model and
acceptance-test set. It does not enable URL fetching or any runtime behavior.

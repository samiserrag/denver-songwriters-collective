# STOP-GATE: Facebook Event Sharing Failure

**Status:** Implemented (phase 1 complete)  
**Date:** 2026-02-10  
**Owner:** Repo agent (investigation-first)

## 1) Problem statement

Users report Facebook link sharing failures for event URLs (composer shows "Something went wrong").  
Goal: identify whether event pages provide crawler-safe metadata and transport behavior, and define the minimal safe fix without changing unrelated behavior.

Scope for this tract:
- Canonical event pages and metadata only.
- No changes to embed routes.
- No schema changes expected.

## 2) Repro steps (current investigation target)

1. Use a known published event URL:
   - `https://coloradosongwriterscollective.org/events/renegade-brewing-open-mic-night`
2. Fetch as Facebook crawler UA and inspect:
   - HTTP status/headers
   - OG/Twitter tags
   - canonical + robots tags
   - redirect behavior markers
3. Compare with explicit date URL:
   - `https://coloradosongwriterscollective.org/events/renegade-brewing-open-mic-night?date=2026-02-25`
4. Validate OG image URL accessibility:
   - `https://coloradosongwriterscollective.org/og/event/renegade-brewing-open-mic-night`
5. Check Facebook Sharing Debugger access path from CLI.

## 3) Expected behavior

For an event URL shared on Facebook:
- Crawler receives 200 HTML with valid OG tags.
- OG image URL is publicly reachable with valid image MIME type.
- URL should not depend on client/meta-refresh redirect to reach share-ready metadata.
- Sharing debugger should be able to scrape metadata without blocking failures.

## 4) Evidence map (repo code references)

> Line numbers may drift; file paths are canonical.

### Event metadata generation
- `web/src/app/events/[id]/page.tsx:70` `generateMetadata(...)`
- `web/src/app/events/[id]/page.tsx:102` canonical slug resolution
- `web/src/app/events/[id]/page.tsx:103` canonical URL (no date query)
- `web/src/app/events/[id]/page.tsx:104` OG image URL

### Event page redirect behavior
- `web/src/app/events/[id]/page.tsx:423` recurring event branch for missing date query
- `web/src/app/events/[id]/page.tsx:427` `redirect(/events/${eventIdentifier}?date=${nextDate})`

### OG image route
- `web/src/app/og/event/[id]/route.tsx:19` OG handler entry
- `web/src/app/og/event/[id]/route.tsx:34` event lookup by UUID/slug
- `web/src/app/og/event/[id]/route.tsx:138` `new ImageResponse(...)`

### URL canonicalization helper
- `web/src/lib/siteUrl.ts:1` canonical default origin
- `web/src/lib/siteUrl.ts:31` `getSiteUrl()`

## 5) External diagnostics (command evidence)

### 5.1 Event URL HTTP status and headers (Facebook UA)

Command evidence shows:
- `HTTP/2 200`
- `content-type: text/html; charset=utf-8`
- `x-matched-path: /events/[id]`
- `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`
- No HTTP 3xx redirect from base slug URL (with and without `-L` observed as `200`).

No 401/403/5xx observed for the tested URL.

### 5.2 OG/Twitter tags present on canonical event URL

Crawler response includes:
- `og:title`
- `og:description`
- `og:url=https://coloradosongwriterscollective.org/events/renegade-brewing-open-mic-night`
- `og:image=https://coloradosongwriterscollective.org/og/event/renegade-brewing-open-mic-night`
- `twitter:card=summary_large_image`
- `twitter:title`, `twitter:description`, `twitter:image`
- `rel="canonical"` (same slug URL)
- `meta name="robots" content="index, follow"`

### 5.3 Redirect marker behavior differs by URL form

Observed with crawler UA:
- Base slug URL:
  - `redirect_marker=present`
  - contains `NEXT_REDIRECT;.../events/renegade-brewing-open-mic-night?date=2026-02-25;307;`
  - contains `<meta id="__next-page-redirect" http-equiv="refresh" ...>`
- Date-qualified URL (`?date=...`):
  - `redirect_marker=absent`

This is consistent with `redirect()` in `web/src/app/events/[id]/page.tsx:427`.

### 5.4 OG image accessibility and MIME type

For `https://coloradosongwriterscollective.org/og/event/renegade-brewing-open-mic-night`:
- `HTTP/2 200`
- `content-type: image/png`
- payload size observed: `821507` bytes

So image reachability/content-type is not the immediate blocker for this case.

### 5.5 Facebook Sharing Debugger accessibility from CLI

No-script debugger response includes:
- `Sharing Debugger`
- `Log into Facebook to use this tool.`

So full debugger scrape diagnostics cannot be extracted from unauthenticated CLI alone in this environment.

## 6) Ranked root-cause hypotheses

### H1 (P0): Canonical event URL emits crawler-visible soft redirect markers
Evidence:
- Base URL emits `NEXT_REDIRECT` + `__next-page-redirect`.
- Date-qualified URL does not emit those markers.
- Redirect branch is explicit in server code at `web/src/app/events/[id]/page.tsx:427`.

Why this matters:
- Facebook scraping may be less reliable when metadata page includes redirect markers/meta refresh rather than stable share-ready HTML.

### H2 (P1): Canonical/OG URL does not reflect occurrence-specific URL
Evidence:
- Metadata canonical and `og:url` are slug-only (no `date` query), while runtime path redirects to date-specific URL for recurring events.

Why this matters:
- Canonical mismatch can create cache/scrape inconsistency across repeated shares of recurring events.

### H3 (P2): Missing OG tags or inaccessible OG image
Evidence against:
- OG/Twitter tags are present.
- OG image is 200 `image/png`.

## 7) Minimal safe fix proposal

1. Keep current OG fields and image route behavior.
2. Remove crawler-visible redirect behavior for recurring events on canonical slug requests:
   - Avoid server `redirect()` for missing date query in crawler-facing response path.
   - Render stable metadata + page content on slug URL without requiring meta-refresh.
3. Preserve in-app UX for date selection (no product copy changes in this tract).

Default-safe implementation direction:
- Replace hard redirect on missing date query with an internal default selection (`effectiveSelectedDate = upcomingOccurrences[0].dateKey`) without changing URL for server-rendered HTML.

Policy lock for implementation phase:
- Keep embed routes unchanged.
- Keep OG tag presence and OG image route behavior unchanged.
- Remove crawler-visible redirect markers from canonical recurring event slug responses.

## 8) Risks and coupling

- Risk: changing redirect behavior may affect existing analytics or deep-link assumptions that expect `?date=`.
- Risk: if canonical URL policy changes, social cache behavior may shift for recurring events.
- Coupling:
  - Event recurrence selection logic in `web/src/app/events/[id]/page.tsx`
  - Metadata generation in the same file
  - QR/share components that currently include date-specific URL (`QrShareBlock` path in this file)

## 9) Rollback plan

- Single revert of event-route logic changes if sharing or recurrence UX regresses.
- Re-run crawler checks:
  - base URL tags present
  - no redirect markers on base URL
  - OG image still 200 PNG

## 10) Test and validation plan

Add/adjust tests:
1. Event page request without `date` for recurring event:
   - no redirect marker in rendered response
   - OG tags still present
2. Event page with `date`:
   - still renders expected metadata and content
3. Social metadata smoke:
   - `og:url` and canonical remain consistent with intended policy
4. Manual validation commands:
   - crawler HEAD 200
   - OG tags extraction
   - redirect marker presence check (base vs date URL)
   - OG image 200 + `image/png`

## 11) STOP-GATE critique and approval questions

New risk discovered:
- Current recurring-event redirect behavior is crawler-visible and likely the dominant sharing reliability risk for canonical event URLs.

Blocking unknowns:
- None for engineering execution.

Non-blocking unknowns:
- Facebook internal scrape cache state for this URL (requires authenticated debugger refresh).

Approval question (single policy decision):
- Approve replacing the recurring-event server redirect on canonical slug requests with non-redirect default occurrence selection for page render, to make crawler responses stable?

Approved and implemented in phase 1.

## 12) Implementation closeout

Implemented with minimal scope:
- Removed missing-date recurring-event redirect branch:
  - `web/src/app/events/[id]/page.tsx`
- Added recurring sharing regression coverage:
  - `web/src/__tests__/ux-11-recurring-sharing.test.tsx`

Validation:
- Recurring base-slug event render path no longer requires redirect markers for missing `date`.
- `npm --prefix web test -- --run` passed with the new regression test.
- Existing embed strictness tests remained green.

Commit evidence:
- `90c9de4`
- `9851a16`

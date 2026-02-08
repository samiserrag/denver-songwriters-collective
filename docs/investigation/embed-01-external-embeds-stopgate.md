# EMBED-01 STOP-GATE — External Embeds (CLOSED)

**Status:** COMPLETED (Phase-1 events-only implementation shipped and production-validated)
**Primary implementation commit:** `d218708`
**Production mismatch fix commit:** `c744f52`

## 1) Scope Definition

EMBED-01 is a read-only distribution tract for rendering DSC content on external websites.

Phase-1 target (required):
- External embeds for events.

Phase-2 deferred support (analysis only in this doc):
- Member profile embeds.
- Venue embeds.
- Gallery album embeds.
- Blog post embeds.
- Future entity-type embeds (extensible by contract, not by route sprawl).

This STOP-GATE covers:
- Embed contract design (URL, params, read-only guarantees).
- Reuse map from existing public data/render code.
- Security/CSP and cache/invalidation constraints.
- Minimal phase-1 implementation plan (design only, no code changes in this step).

## 2) Non-Goals (explicit)

- No rebrand work.
- No white-label implementation.
- No multi-region execution.
- No auth-coupled embed behavior.
- No mutations/writes from embed surfaces.
- No invite/share growth changes.
- No analytics expansion beyond baseline operational telemetry.
- No app code changes, DB migrations, or route refactors in this STOP-GATE.

## 3) Proposed Embed Types (ranked)

1. Event embed (Phase 1, required)
- Highest distribution value.
- Existing public route + canonical helpers already exist.

2. Gallery album embed (Phase 2, optional)
- Good visual distribution value.
- More complexity around image sets and presentation variants.

3. Blog post embed (Phase 2, optional)
- Useful but higher rendering scope and interaction baggage.

4. Member profile embed (Phase 2, optional)
- Valuable for artist distribution and promoter discovery.
- Deferred to avoid coupling EMBED-01 phase-1 to profile visibility/privacy nuances.

5. Venue embed (Phase 2, optional)
- Useful for host/venue marketing.
- Deferred to avoid broadening location/ownership contract in phase-1.

## 4) Technical Options Comparison

| Option | Pros | Risks/Constraints | Recommendation |
|---|---|---|---|
| `iframe` hosted by DSC | Strong isolation, simplest host integration, preserves DSC rendering control | Currently blocked by global headers (`X-Frame-Options: DENY`, `frame-ancestors 'none'`) | Preferred for phase-1 with route-scoped header exception |
| `script` widget | Flexible host page integration | Larger XSS/CSP/trust surface, more host breakage risk | Defer |
| Static HTML snippet | Very easy to paste | Stale data, no freshness guarantees, drift | Not primary |

Dark/light theming constraints:
- Phase-1 should support `theme=light|dark|auto` only.
- No tenant-brand abstraction in EMBED-01.

## 5) Existing Code Map (file:line references)

Event detail + canonical event semantics:
- `web/src/app/events/[id]/page.tsx:38` dynamic route mode.
- `web/src/app/events/[id]/page.tsx:200` event fetch (by id/slug) from `events`.
- `web/src/app/events/[id]/page.tsx:276` canonical verification via `getPublicVerificationState`.
- `web/src/app/events/[id]/page.tsx:370` occurrence expansion (`expandOccurrencesForEvent`).
- `web/src/app/events/[id]/page.tsx:387` and `web/src/app/events/[id]/page.tsx:433` override reads (`occurrence_overrides`).

Card rendering and shared event logic:
- `web/src/components/events/EventGrid.tsx:16` event grid -> `HappeningCard`.
- `web/src/components/happenings/HappeningCard.tsx:40` event card contract.
- `web/src/components/happenings/HappeningCard.tsx:211` canonical next occurrence usage.
- `web/src/components/happenings/HappeningCard.tsx:230` schedule-unknown branch.
- `web/src/components/happenings/HappeningCard.tsx:446` verification evaluation.
- `web/src/components/happenings/HappeningCard.tsx:494` missing-details evaluation.
- `web/src/lib/events/verification.ts:44` verification helper.
- `web/src/lib/events/missingDetails.ts:99` missing-details helper.
- `web/src/lib/events/nextOccurrence.ts:359` next occurrence helper.
- `web/src/lib/events/nextOccurrence.ts:572` occurrence expansion helper.

Public gallery/blog candidates:
- `web/src/app/gallery/[slug]/page.tsx:9` dynamic public album route.
- `web/src/app/gallery/[slug]/page.tsx:70` album query.
- `web/src/app/gallery/[slug]/page.tsx:94` image query.
- `web/src/app/blog/[slug]/page.tsx:10` dynamic public post route.
- `web/src/app/blog/[slug]/page.tsx:83` post query.

Distribution precedent (OG endpoints):
- `web/src/app/og/event/[id]/route.tsx:19`.
- `web/src/app/og/blog/[slug]/route.tsx:7`.
- `web/src/app/og/gallery/[slug]/route.tsx:7`.

Security baseline:
- `web/next.config.ts:40` (`X-Frame-Options: DENY`).
- `web/next.config.ts:64` (`frame-src ...`).
- `web/next.config.ts:65` (`frame-ancestors 'none'`).

Operational kill-switch patterns:
- `web/src/lib/featureFlags.ts:21`.
- `web/src/lib/guest-verification/config.ts:13`.

Backlog references:
- `docs/BACKLOG.md:436` (`EMBED-01` canonical entry).
- `docs/backlog/post-gtm-3-1-active-backlog.md:17` (active backlog view).

## 6) Data Contract (draft)

Proposed phase-1 embed URL:
- `/embed/events/{eventIdOrSlug}`

Optional query params:
- `date=YYYY-MM-DD` (occurrence focus)
- `theme=light|dark|auto` (default `auto`)
- `view=card|compact` (default `card`)
- `show=badges,meta,cta` (optional presentational toggles)

Read-only guarantees:
- No auth required for public/published content.
- No write tokens.
- No create/update/delete actions.
- CTA may link to canonical public event page only.

Minimal viable embed (phase-1 required fields):
- Identity: `id`, `slug`, `title`, `event_type`
- Schedule/occurrence: `event_date`, `start_time`, `end_time`, `recurrence_rule`, `custom_dates`
- Location: `location_mode`, `venue_id`, `venue_name`, `custom_location_name`, `custom_city`, `custom_state`, `online_url`
- Trust/status: `status`, `last_verified_at`, `verified_by`
- Display: `cover_image_url`, `is_dsc_event`, `age_policy`, `is_free`, `cost_label`

Layout constraints (phase-1):
- `card`: single-item card, max width 420px default, responsive down to 320px.
- `compact`: reduced metadata rows, no long body copy.

Mobile behavior:
- No horizontal overflow at 320/375 widths.
- Metadata wraps instead of truncating critical city/time fields.

Failure modes:
- Not found/unpublished -> embed-safe not-found state.
- Invalid `date` -> fallback to nearest valid upcoming occurrence (or explicit empty state if none).
- Temporarily disabled -> kill-switch response state.

## 7) Security + CSP Analysis

Current policy blocks external iframe embedding:
- `X-Frame-Options: DENY` (`web/next.config.ts:40`)
- `frame-ancestors 'none'` (`web/next.config.ts:65`)

Implication:
- Existing pages cannot be embedded as iframes today.

Phase-1 security principle:
- If iframe path is approved, apply frame-policy exception only for embed route(s), not globally.
- Keep embed route read-only.
- Validate/sanitize all query params and constrain allowed values.
- No auth/session-coupled actions on embed surface.

Abuse/scraping considerations:
- Public event data is already publicly accessible; embeds change distribution, not core exposure.
- Add request-rate observability and basic anomaly monitoring if adopted.

## 8) Caching + Invalidation Strategy

Current baseline:
- Public routes frequently run dynamic (`force-dynamic`) including event detail (`web/src/app/events/[id]/page.tsx:38`).

Phase-1 recommendation:
1. Start with correctness-first freshness (dynamic or very short TTL).
2. Constrain cache behavior to embed route only.
3. If needed, add narrow invalidation hooks tied to event updates later.

Content freshness guarantee (proposal):
- “Near-real-time with bounded staleness” (short TTL if caching enabled).

## 9) Minimal Fix Plan (Phase 1 only)

1. Introduce event-only embed route contract.
2. Reuse canonical event helpers:
- Verification from `getPublicVerificationState`.
- Occurrence selection from next-occurrence helpers.
- Missing-details semantics from existing helper or explicitly simplified contract.
3. Implement minimal iframe-ready surface.
4. Apply route-scoped frame-policy exception only for embed path.
5. Keep gallery/blog embeds out of phase-1 implementation.

## 10) Rollback / Kill-Switch Plan

- Add env-driven kill switch for embed routes.
- Disable embed route rendering without touching core public pages.
- Remove embed-specific header exception to restore default deny policy.

Rollback objective:
- Fast disable path with zero impact to event detail page behavior.

## 11) Test Plan

Contract tests:
- Only approved fields are exposed.
- No mutation affordances/actions are present.

Behavior tests:
- Date targeting resolves expected occurrence.
- Verification badge parity with canonical helper.
- Missing-details behavior is deterministic and documented.

Security tests:
- Frame policy exception limited to embed route.
- Invalid query params are safely handled.

Responsive tests:
- 320/375/768 iframe widths render without overflow.

Performance tests:
- Verify acceptable TTFB under embed traffic patterns.

## 12) Backlog Mapping

- EMBED-01 exists in canonical backlog: `docs/BACKLOG.md:436`.
- EMBED-01 appears in active backlog view: `docs/backlog/post-gtm-3-1-active-backlog.md:17`.

Alignment statement:
- This STOP-GATE defines external read-only embeds under EMBED-01 investigation scope.
- EMBED-01 is non-blocking to STRAT-01 and does not change current active execution order.
- Phase-2 scope is explicitly deferred and includes profiles, venues, blogs, galleries, and future entity types.

## 13) Approval Questions

1. Approve phase-1 scope as event-only external embed?
2. Approve `iframe` as phase-1 transport?
3. Approve route-scoped frame-policy exception (embed-only)?
4. Confirm invalid `date` behavior: fallback vs hard empty state?
5. Confirm default theme behavior (`auto`) and support for `light|dark` override?
6. Confirm whether embed should include CTA link by default?
7. Confirm acceptable freshness target (dynamic vs short TTL)?
8. Confirm gallery/blog remain explicitly deferred to phase-2?

## 14) Closeout (Production Validation)

### 14.1 Production mismatch fixed

- Issue observed in production after phase-1 deploy: embed route returned `Event not found` for valid public events.
- Root cause: embed query selected non-existent DB column `events.cover_image_card_url`.
- Fix shipped in `c744f52`:
  - Updated `web/src/app/embed/events/[id]/route.ts` to remove `cover_image_card_url` from `SELECT`.
  - Fallback image now uses `cover_image_url` only.
- Result: valid embed URL renders `200` with event HTML.

### 14.2 Live kill-switch validation evidence (production)

Validated URL set:
- `https://denversongwriterscollective.org/embed/events/sloan-lake-song-circle-jam-2026-02-01`
- `https://denversongwriterscollective.org/embed/events/sloan-lake-song-circle-jam-2026-02-01?view=compact&show=meta`

| Timestamp (UTC) | Env value | Result |
|---|---|---|
| 2026-02-08 01:29:15 | default ON path (pre-toggle) | both URLs returned `200` with embed HTML |
| 2026-02-08 01:42:32 | `ENABLE_EXTERNAL_EMBEDS=\"false\\n\"` (misconfigured newline) | both URLs still returned `200` (string mismatch) |
| 2026-02-08 02:10:14 | `ENABLE_EXTERNAL_EMBEDS=false` (exact) | both URLs returned `503` with “Embeds temporarily unavailable” + “External embeds are currently disabled” |
| 2026-02-08 02:22:46 | `ENABLE_EXTERNAL_EMBEDS=true` | both URLs returned `200` with embed HTML |

Observed response headers during OFF and ON checks:
- `X-Frame-Options`: not present on embed route.
- CSP included `frame-ancestors *` on embed route responses.

### 14.3 Operator runbook (how to toggle)

1. Vercel Dashboard path: Project `denver-songwriters-collective` -> Settings -> Environment Variables.
2. Set `ENABLE_EXTERNAL_EMBEDS` for `Production`:
   - OFF: `false` (must be exact string, no newline)
   - ON: `true` (or unset, because default behavior is enabled)
3. Trigger a production redeploy after each change.
4. Validate with the two URLs above:
   - OFF expected: `503` + disabled message.
   - ON expected: `200` + rendered embed HTML.

### 14.4 Remaining constraints

- EMBED-01 scope remains events-only.
- Kill switch semantics remain:
  - `ENABLE_EXTERNAL_EMBEDS=\"false\"` -> disabled
  - any other value/unset -> enabled
- Framing policy remains route-scoped for embed surface only.

**CLOSED — EMBED-01 complete**

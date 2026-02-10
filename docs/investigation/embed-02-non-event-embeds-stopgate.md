# EMBED-02 STOP-GATE — Non-Event External Embeds (Investigation Only)

**Status:** Approved and implemented (phase-1 complete).
**Scope posture:** Expands external embeds beyond events while keeping the same read-only distribution model introduced in EMBED-01.

## 1) Scope Definition

EMBED-02 extends embed support to public, non-event entities in this order:
- **EMBED-02A:** Venues
- **EMBED-02B:** Member profiles
- **EMBED-02C:** Blog posts
- **EMBED-02D:** Gallery albums

Phase sequencing is required. No schema changes are proposed in this STOP-GATE.

## 2) Non-Goals (explicit)

- No auth-required embed surfaces.
- No write actions from embeds.
- No white-label or region-tenant behavior changes.
- No rebrand work.
- No invite/referral growth changes.
- No analytics expansion in embed payloads.
- No script-based third-party embed SDK in phase-1.

## 3) Proposed Embed Types (ranked)

1. **Venues (EMBED-02A)**
- Highest reuse of current card-style fields (name, city/state, cover image, links).
- Simple read-only rendering and low content-safety risk.

2. **Member profiles (EMBED-02B)**
- Strong discovery value for creators.
- Requires strict visibility gate (`profiles.is_public = true`).

3. **Blog posts (EMBED-02C)**
- High distribution value, but requires controlled text rendering/sanitization constraints.

4. **Gallery albums (EMBED-02D)**
- Useful for event recap sharing.
- Needs bounded image counts and fallback behavior for missing covers.

## 4) Technical Options Comparison

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| `<iframe>` HTML route | Strong isolation, no host-site JS coupling, easiest CSP control | Less host-side customization | **Use for EMBED-02** |
| `<script>` widget | Flexible host integration | Higher security/compatibility risk; larger support burden | Defer |
| Static HTML snippets | Cache-friendly | Harder freshness guarantees; weak theming flexibility | Defer |

Recommendation: keep route-based iframe embeds only, matching EMBED-01 operational model.

## 5) Existing Code Map (file:line references)

> Note: line numbers may drift as code evolves; file paths are canonical.

### Reusable embed foundation
- Event embed route and query contract parsing:
  - `web/src/app/embed/events/[id]/route.ts:321`
  - `web/src/app/embed/events/[id]/route.ts:330`
  - `web/src/app/embed/events/[id]/route.ts:336`
- Escape/safe HTML rendering in embed response:
  - `web/src/app/embed/events/[id]/route.ts:66`
  - `web/src/app/embed/events/[id]/route.ts:127`
- Kill switch semantics:
  - `web/src/lib/featureFlags.ts:41`
  - `web/src/lib/featureFlags.ts:48`
- Route-scoped frame policy:
  - `web/next.config.ts:32`
  - `web/next.config.ts:52`
  - `web/next.config.ts:61`
  - `web/next.config.ts:69`
  - `web/next.config.ts:77`
  - `web/next.config.ts:102`

### Public data source references for EMBED-02 entities
- Venue detail/list public reads:
  - `web/src/app/venues/[id]/page.tsx:113`
  - `web/src/app/venues/page.tsx:32`
- Member profile/list public reads and visibility gate:
  - `web/src/app/members/[id]/page.tsx:45`
  - `web/src/app/members/[id]/page.tsx:48`
  - `web/src/app/members/page.tsx:61`
  - `web/src/app/members/page.tsx:64`
- Blog public reads and publication gate:
  - `web/src/app/blog/[slug]/page.tsx:82`
  - `web/src/app/blog/[slug]/page.tsx:95`
  - `web/src/app/blog/[slug]/page.tsx:96`
  - `web/src/app/blog/page.tsx:33`
  - `web/src/app/blog/page.tsx:45`
  - `web/src/app/blog/page.tsx:46`
- Gallery public reads and visibility gate:
  - `web/src/app/gallery/[slug]/page.tsx:69`
  - `web/src/app/gallery/[slug]/page.tsx:83`
  - `web/src/app/gallery/page.tsx:28`
  - `web/src/app/gallery/page.tsx:38`
  - `web/src/app/gallery/page.tsx:39`
  - `web/src/app/gallery/page.tsx:86`
  - `web/src/app/gallery/page.tsx:87`

## 6) Data Contract (draft)

### 6.1 Shared query contract (all EMBED-02 routes)
- `theme=light|dark|auto`
- `view=card|compact`
- `show=badges,meta,cta`
- No script injection. Output is server-rendered HTML for iframe.

### 6.2 Proposed route patterns
- `/embed/venues/{id-or-slug}`
- `/embed/members/{id-or-slug}`
- `/embed/blog/{slug}`
- `/embed/gallery/{slug}`

### 6.3 Public surface and read-only guarantees
- No auth required to render embeds.
- No mutations, no forms, no session-bound actions.
- CTA links open canonical DSC pages in new tab.
- Any link opened in a new tab must include `rel="noopener noreferrer"`.

### 6.4 Table/query draft per type

**Venues**
- Source tables: `venues`, optional aggregate from `events`.
- Draft select subset: `id, slug, name, city, state, neighborhood, cover_image_url, website_url, google_maps_url`.
- **Phase 1 lock:** match current public venues semantics (no new `is_published` gating) (`web/src/app/venues/page.tsx:32`).
- Future stricter venue gating, if required, is a separate backlog tract (`EMBED-02A2`), not part of EMBED-02 phase-1.

**Members**
- Source table: `profiles`.
- Draft select subset: `id, slug, full_name, bio, avatar_url, city, role flags, genres, instruments`.
- Visibility rule: must enforce `is_public = true` (`web/src/app/members/[id]/page.tsx:48`, `web/src/app/members/page.tsx:64`).

**Blog posts**
- Source table: `blog_posts` + author join via `profiles`.
- Draft select subset: `id, slug, title, excerpt, cover_image_url, published_at, tags, author.full_name, author.avatar_url`.
- Visibility rule: `is_published = true` and `is_approved = true` (`web/src/app/blog/[slug]/page.tsx:95-97`).

**Gallery albums**
- Source tables: `gallery_albums`, `gallery_images`.
- Draft album subset: `id, slug, name, description, cover_image_url, created_at`.
- Visibility rule: albums `is_published = true` and `is_hidden = false`; images `is_published = true` and `is_hidden = false` (`web/src/app/gallery/[slug]/page.tsx:83`, `web/src/app/gallery/[slug]/page.tsx:107-108`).

## 7) Security + CSP Analysis

- Keep embed framing route-scoped (`/embed/:path*`) with permissive `frame-ancestors *` only on embed routes (`web/next.config.ts:33-64`).
- Keep non-embed routes protected with `X-Frame-Options: DENY` and restrictive CSP frame ancestors (`web/next.config.ts:69-106`).
- Preserve read-only route design: no cookies/session state required for core rendering.
- Rich text safety:
  - Event embed route already escapes interpolated HTML (`web/src/app/embed/events/[id]/route.ts:66-73`).
  - For blog embeds, default to excerpt/summary fields first; if full content is added later, sanitize/transform to safe HTML subset before render.

## 8) Caching + Invalidation Strategy

- **Phase 1 lock:** use `dynamic = "force-dynamic"` for correctness-first rollout.
- `ENABLE_EXTERNAL_EMBEDS=false` responses must always be uncacheable (`Cache-Control: no-store`).
- TTL tuning for ON responses is deferred to a future phase after rollout stability.
- Invalidation model:
  - No custom purge pipeline in EMBED-02 phase-1.
  - Content updates become visible on next dynamic request.

## 9) Minimal Fix Plan (Phase 1 only)

1. Implement venue embed route (`EMBED-02A`) using shared parser/helpers from EMBED-01.
2. Implement member embed route (`EMBED-02B`) gated by `is_public = true`.
3. Implement blog embed route (`EMBED-02C`) gated by `is_published + is_approved`.
4. Implement gallery album embed route (`EMBED-02D`) gated by `is_published + !is_hidden`.
5. Keep one kill switch (`ENABLE_EXTERNAL_EMBEDS`) across all embed routes.

No routing refactor, no migration, no non-embed policy changes.

## 10) Rollback / Kill-Switch Plan

- Primary rollback: set `ENABLE_EXTERNAL_EMBEDS=false` in production and redeploy.
- Expected OFF behavior: route returns `503` with disabled message (same as EMBED-01).
- Granular rollback option (if needed later): return 404 per new non-event embed route while keeping event embeds ON.

## 11) Test Plan

- Unit tests
  - Query-param parser contract: `theme`, `view`, `show` defaults + invalid input fallback.
  - Resolver visibility filters per entity type.
- Integration tests
  - Route-level: valid slug/id returns `200` HTML.
  - Visibility-denied entities return `404`.
  - Kill switch returns `503` on all embed routes.
- Regression checks
  - Confirm non-embed routes still send deny framing headers.
  - Confirm embed routes remain frameable in iframe.

## 12) Backlog Mapping

- Canonical tract: `EMBED-02` in `docs/BACKLOG.md`.
- This STOP-GATE file is the implementation gate for EMBED-02.
- `EMBED-01` remains DONE and is not reopened.
- EMBED-02 is **non-blocking** to `STRAT-01`; strategic tract sequencing remains independent.

## 13) Approval Questions

1. Confirm execution order: venues -> members -> blog -> gallery.
2. Confirm venues are allowed for public framing under current visibility semantics (phase-1 lock: no new `is_published` gating).
3. Confirm embeds should remain iframe-only (no script widget in EMBED-02).
4. Confirm blog embeds should start excerpt-only (no full post body) in phase-1.
5. Confirm gallery embeds should show album-level cards first, with optional image strip in compact view.
6. Confirm whether external image hotlinking is acceptable now, with proxying deferred.

## 14) Closeout Evidence (Phase 1)

**Shipped routes:**
- `web/src/app/embed/venues/[id]/route.ts`
- `web/src/app/embed/members/[id]/route.ts`
- `web/src/app/embed/blog/[slug]/route.ts`
- `web/src/app/embed/gallery/[slug]/route.ts`

**Shared renderer/parser:**
- `web/src/app/embed/_lib/shared.ts`

**Tests:**
- `web/src/app/embed/venues/[id]/route.test.ts`
- `web/src/app/embed/members/[id]/route.test.ts`
- `web/src/app/embed/blog/[slug]/route.test.ts`
- `web/src/app/embed/gallery/[slug]/route.test.ts`
- `web/src/__tests__/embed-framing-regression.test.ts`

**Validation checklist (expected):**
- Kill switch OFF (`ENABLE_EXTERNAL_EMBEDS=false`): all `/embed/*` routes return `503` and `Cache-Control: no-store`
- Kill switch ON (`ENABLE_EXTERNAL_EMBEDS=true`): public entities return `200` iframe HTML

**Commit evidence:**
- `git log --oneline -- web/src/app/embed docs/investigation/embed-02-non-event-embeds-stopgate.md`

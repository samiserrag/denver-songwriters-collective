# MEDIA-EMBED-01 STOP-GATE - Structured URL Foundation (Policy Locked for Phase-1)

## 1) Executive summary
MEDIA-EMBED-01 should be implemented as a structured-URL contract (YouTube + Spotify only) on canonical pages, not raw embed HTML. The repo already has three strong foundations to build on: (a) strict route-scoped external embed infrastructure, (b) existing URL-normalization patterns for playlists/social links, and (c) a global env kill-switch pattern.

Evidence shows canonical detail pages currently do not render inline iframe embeds for events/blog/gallery/member surfaces, while `/embed/*` remains a separate read-only tract and must stay compatibility-stable.

Phase-1 policy is now locked:
- Option A data model (per-entity columns).
- Admin-only write authority.
- YouTube defaults to `youtube-nocookie.com`.
- Playlist support included for YouTube + Spotify.
- Store normalized URL only (no raw input URL).
- Mobile renders inline, full-width, lazy-loaded players.

This document started as investigation + stop-gate critique. Section 15 now records approved Phase-1 implementation closeout evidence.

## 2) Scope and non-scope
Scope for Phase 1 (design + stop-gate only):
- Events detail page media block (structured YouTube URL + structured Spotify URL).
- Blog post detail page media block.
- Gallery album detail page media block.
- Member profile page media block.
- Admin-entry and server-side validation contract for those URLs.
- CSP/RLS/SSR/feature-flag compatibility plan.

Explicit non-scope for Phase 1:
- Raw iframe HTML inputs or arbitrary embed code blobs.
- WYSIWYG/block editor adoption.
- Comments system changes.
- Third-party API enrichment/scraping.
- Breaking changes to `/embed/*` routes.

Compatibility guardrail (existing external embed tract):
- `/embed/*` is already route-scoped and kill-switch controlled via `web/src/app/embed/*` and `web/src/lib/featureFlags.ts` (`isExternalEmbedsEnabled`).
- Framing policy is split between embed and non-embed routes in `web/next.config.ts` (`headers()` block for `source: "/embed/:path*"` vs `source: "/((?!embed/).*)"`).

## 3) Current state inventory
### Existing embed patterns
- Homepage already renders Spotify/YouTube playlist iframes using normalized URLs:
  - `web/src/app/page.tsx` (`toYouTubeEmbedUrl`, `toSpotifyEmbedUrl`, Featured Playlists section).
  - `web/src/components/home/LazyIframe.tsx` (`LazyIframe` lazy-load wrapper).
- Admin email preview uses `iframe srcDoc` for internal preview only:
  - `web/src/app/(protected)/dashboard/admin/email/page.tsx` (email preview iframe block).
- External share embeds are a separate tract:
  - `web/src/app/embed/events/[id]/route.ts`
  - `web/src/app/embed/blog/[slug]/route.ts`
  - `web/src/app/embed/gallery/[slug]/route.ts`
  - `web/src/app/embed/members/[id]/route.ts`
  - `web/src/app/embed/_lib/shared.ts`

### Existing URL fields
Live DB schema inspection (read-only, Feb 11, 2026) shows:
- `profiles` has `youtube_url`, `spotify_url`, `song_links`, `featured_song_url`.
- `site_settings` has `youtube_playlist_url`, `spotify_playlist_url`.
- `events`, `blog_posts`, `gallery_albums` do not currently have dedicated YouTube/Spotify embed URL columns.
- No existing `public.media_embeds` table.
- No `embed/iframe/html`-named columns in `public` schema.

Repo migration evidence:
- `supabase/migrations/20251206000002_add_profile_social_links.sql`
- `supabase/migrations/20251211000001_member_profile_fields.sql`
- `supabase/migrations/20260208140000_add_site_asset_urls.sql`

### Existing components for cards/details
Canonical detail surfaces in scope:
- Events: `web/src/app/events/[id]/page.tsx` (`EventDetailPage`, "About This Event", `QrShareBlock`).
- Blog posts: `web/src/app/blog/[slug]/page.tsx` (`BlogPostPage`, content + gallery + comments).
- Gallery albums: `web/src/app/gallery/[slug]/page.tsx` (`AlbumPage`, album header + comments + grid).
- Member profile: `web/src/app/members/[id]/page.tsx` (`MemberDetailPage`, "Listen to My Music" section with outbound links).

Current behavior: these canonical pages do not include inline iframe media embed rendering.

### Existing CSP / security headers configuration
- `web/next.config.ts` (`headers()`):
  - Non-embed routes enforce `X-Frame-Options: DENY` and `frame-ancestors 'none'`.
  - Non-embed `frame-src` already allows `https://open.spotify.com https://www.youtube.com https://youtube.com`.
  - Embed routes are separately frameable and locked to `frame-src 'none'` (for outbound frames inside embed cards).

### Existing feature flag patterns and kill switches
- `web/src/lib/featureFlags.ts`:
  - `isExternalEmbedsEnabled()` uses `ENABLE_EXTERNAL_EMBEDS` as emergency kill switch.
  - Existing pattern for emergency env toggles is well-established.
- Embed routes uniformly enforce kill-switch behavior (`isExternalEmbedsEnabled`) and are tested:
  - `web/src/__tests__/embed-framing-regression.test.ts`.

## 4) Data model option (locked for Phase-1)
### Option A: Per-entity columns (`youtube_url`, `spotify_url` per table) - LOCKED
Pros:
- Simple queries and straightforward SSR rendering on existing page loaders.
- Low join complexity; easy to cache with existing detail-page queries.
- Clear backward compatibility (additive columns only).

Cons:
- Repeated schema work across multiple entities.
- Harder to extend to additional providers/entities without more columns.
- Mixed consistency risk if validators drift between routes.

Migrations required:
- Add nullable fields to `events`, `blog_posts`, `gallery_albums`.
- `profiles` already has social URL fields, but may need separate canonical media fields to avoid semantic overload.

RLS implications:
- Must align with existing write ownership models:
  - `events` host/admin update path.
  - `blog_posts` author/admin.
  - `gallery_albums` owner/admin.
  - `profiles` self/admin.
- If Phase 1 is admin-only, existing owner/author write paths require policy + route gating changes.

Multi-region implications:
- Region/community-specific media governance becomes duplicated across tables.
- Acceptable for Phase 1 but less flexible for STRAT-01 scale.

Classifieds/marketplace implications:
- Future marketplace entity types would require adding columns repeatedly.

### Option B: Shared `media_embeds` table keyed by (`entity_type`, `entity_id`) - Deferred
Pros:
- Unified validation and governance surface.
- Easier extension to new entity types (marketplace/classifieds/service profiles) without table churn.
- Cleaner path for native app/API parity via one normalized contract.

Cons:
- More joins and more complex RLS.
- Requires careful uniqueness constraints (one YouTube + one Spotify per entity in Phase 1).
- Higher initial implementation complexity.

Migrations required:
- Create `media_embeds` table and indexes.
- Add FK/cascade strategy or polymorphic integrity strategy.
- Add RLS policies that defer read/write access to owning entity visibility/ownership rules.

RLS implications:
- Highest sensitivity area: policies must not evaluate admin-only helper functions for anonymous reads.
- Requires explicit read policy by entity publication visibility and explicit admin-only write policy (if approved).

Multi-region implications:
- Best long-term fit for region/community abstraction and entity expansion.

Classifieds/marketplace implications:
- Strong fit for future marketplace/service entities.

### Option C: JSON field per entity (discouraged) - Rejected for Phase-1
Pros:
- Minimal schema surface changes.

Cons:
- Weak type safety and validation drift risk.
- Harder indexing/querying/reporting.
- Harder to enforce one-per-provider constraints cleanly.
- Less maintainable for native clients and long-term contracts.

Migrations required:
- Add JSON columns per table or reuse existing JSON columns with schema conventions.

RLS implications:
- Same write-ownership concerns as Option A plus weaker guardrails.

Multi-region implications:
- Poor auditability and weak contract clarity across communities.

Classifieds/marketplace implications:
- Quick short-term path, poor strategic fit.

## 5) URL normalization and validation contract
Accepted YouTube patterns (Phase 1):
- `https://youtu.be/{videoId}`
- `https://www.youtube.com/watch?v={videoId}`
- `https://www.youtube.com/playlist?list={playlistId}`
- `https://www.youtube.com/embed/{videoId}` or `.../embed/videoseries?list={playlistId}`

Accepted Spotify patterns (Phase 1):
- `https://open.spotify.com/track/{id}`
- `https://open.spotify.com/album/{id}`
- `https://open.spotify.com/playlist/{id}`
- Accept equivalent `/embed/` forms and normalize.

Reject explicitly:
- Any non-HTTP(S) scheme.
- Any provider outside YouTube/Spotify.
- Any malformed URL or unsupported path type.

Canonicalization contract (proposed):
- Parse URL server-side and store normalized URL for rendering.
- Strip non-essential tracking params.
- Keep media identity params only (for example `v`, `list`, resource ID path segment).
- If YouTube is approved for privacy mode, normalize to `youtube-nocookie` embed origin.

Storage note:
- Phase-1 stores normalized URL only.
- `raw_input_url` storage is explicitly out of scope in Phase-1.

## 6) Rendering contract
Placement plan (canonical pages):
- Events (`web/src/app/events/[id]/page.tsx`): place media block after "About This Event" and before timeslots/attendees to keep context-first flow.
- Blog (`web/src/app/blog/[slug]/page.tsx`): place media block after main article content and before photo gallery.
- Gallery album (`web/src/app/gallery/[slug]/page.tsx`): place media block below album header metadata and above comments/grid.
- Member profile (`web/src/app/members/[id]/page.tsx`): place media players within/adjacent to "Listen to My Music" above outbound link buttons.

Desktop/mobile behavior (locked):
- Desktop: stacked blocks with consistent aspect-ratio containers.
- Mobile: inline full-width containers with no horizontal overflow.

Loading behavior:
- Prefer `loading="lazy"` iframe strategy with reserved height/aspect to avoid layout shift.
- Server-render container + validated `src` so no client-only conditional required.

Accessibility:
- Each iframe needs a specific `title`.
- Provide visible fallback link when URL missing/invalid/blocked.
- Keep keyboard focus order predictable; preserve sufficient contrast for labels and fallbacks.

YouTube privacy mode:
- `youtube-nocookie` is the locked default for Phase-1.

## 7) Security and CSP plan
Required CSP implications for canonical pages:
- Keep `frame-src` origin list explicit and minimal.
- If `youtube-nocookie` is adopted, add `https://www.youtube-nocookie.com` to non-embed route CSP in `web/next.config.ts`.
- Keep `/embed/*` framing/header behavior unchanged.

Outbound link hardening:
- Continue `target="_blank" rel="noopener noreferrer"` for fallback links and external actions.
- Existing canonical patterns already apply this on member links (`web/src/app/members/[id]/page.tsx`).

XSS posture:
- Structured provider URL fields avoid arbitrary HTML/script injection vectors.
- No `innerHTML`/raw embed-code storage on canonical surfaces.
- Validate/normalize on server before persistence and again before render.

## 8) RLS and privacy implications
Who can set fields (Phase 1 locked):
- Admin-only for all in-scope entities.
- Phase-2 follow-on expands writes to creator/owner roles with explicit ownership RLS work.

Who can read fields:
- Public readers should see media URLs only when parent entity is publicly visible/published.

Current RLS evidence (live DB read, Feb 11, 2026):
- Public read policies exist for in-scope entities:
  - `events`: `public_read_events`.
  - `blog_posts`: `blog_posts_public_read` (`is_published = true`).
  - `gallery_albums`: `gallery_albums_public_read` (`is_published = true`).
  - `profiles`: `profiles_select` (`is_public = true` or owner).
- Admin helper usage exists in admin/owner policies (`is_admin()`), but current anon SELECT paths in-scope are not admin-helper-dependent.
- Anonymous read verification succeeded on `events`, `blog_posts`, `gallery_albums`, `profiles`, `site_settings` without privilege errors.

Admin-helper function evidence:
- `public.is_admin()` is `SECURITY DEFINER` and used by many non-anon admin policies.

## 9) Admin UX plan (Phase 1)
Placement in existing admin flows:
- Events editor: `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` (Advanced Options section near external links).
- Blog editor: `web/src/app/(protected)/dashboard/admin/blog/BlogPostForm.tsx`.
- Gallery album editor: `web/src/app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx` (details card).
- Member profile editor: `web/src/app/(protected)/dashboard/profile/page.tsx` (existing social links area already contains YouTube/Spotify fields).

Field copy (proposed):
- Label: "Paste a YouTube or Spotify link"
- Helper examples:
  - YouTube: `https://youtu.be/...` or `https://youtube.com/watch?v=...` or playlist URL
  - Spotify: `https://open.spotify.com/track/...` `.../album/...` `.../playlist/...`

Field-level errors (proposed):
- "Unsupported URL. Use YouTube or Spotify only."
- "Spotify URL must be a track, album, or playlist."
- "YouTube URL must contain a video id or playlist id."

Overwrite semantics:
- Blank input clears stored value (`NULL`).

## 10) API surface plan
Current state:
- Events writes go through API routes (`/api/my-events`, `/api/my-events/[id]`).
- Profiles write via `/api/profile`.
- Blog and gallery admin forms currently write directly through Supabase browser client in UI components.

Phase-1 API recommendation (for consistent validation + error contract):
- Route all media URL updates through server routes that return structured 400s.
- Payload shape (proposed):
  - `youtube_url` (nullable string)
  - `spotify_url` (nullable string)
  - Optional future-proof variant: nested `media` object.

Validation error contract:
- HTTP 400 body must include field + guidance, for example:
  - `{ "error": "Validation failed", "field": "youtube_url", "guidance": "Use a YouTube watch, youtu.be, playlist, or embed URL." }`

Open architecture choice:
- Reuse entity-specific existing routes where available vs introduce dedicated media endpoints for consistency.

## 11) Test plan
Unit tests:
- URL parser/normalizer tests for all accepted patterns and reject paths.
- Provider classifier tests (YouTube/Spotify only in Phase 1).

Route/page tests:
- Canonical pages render embed blocks for valid normalized URLs.
- Invalid URLs do not render iframe and do render safe fallback link/message.
- Blank values render no embed block (graceful degradation).

Security/CSP regression:
- Extend header regression coverage (existing pattern: `web/src/__tests__/embed-framing-regression.test.ts`) for canonical `frame-src` allowlist changes.
- Verify no raw HTML embed payload is accepted by API validators.

RLS tests:
- Anon/public read tests for entities with public visibility.
- Admin-only write tests (if approved) for media field mutation endpoints.

## 12) Rollback plan
- Global kill switch OFF disables canonical media rendering without page breakage.
- Schema changes remain additive (columns/table remain; UI/render path off).
- If CSP changes are introduced (for example `youtube-nocookie`), revert those header additions safely.
- Preserve `/embed/*` routes and framing policy unchanged during rollback.

## 13) Backlog integration
Canonical backlog updates applied:
- `MEDIA-EMBED-01` is now tracked as PARTIAL DONE with `MEDIA-EMBED-01A` completed and `MEDIA-EMBED-01B` queued NEXT.
- `MEDIA-EMBED-01B` is explicitly defined as Phase-2 expansion to creator/owner writes (not implemented in this tract).
- STRAT-01 and MARKETPLACE dependencies remain non-blocking.

Index alignment applied:
- `docs/backlog/post-gtm-3-1-active-backlog.md` remains index-only and now references `MEDIA-EMBED-01A` completion plus `MEDIA-EMBED-01B` next-step status.

## 14) STOP-GATE critique
Policy locks applied for Phase-1:
- A) Write authority: admin-only.
- B) YouTube privacy default: `youtube-nocookie`.
- C) Playlist support: included in Phase-1.
- D) Storage shape: normalized URL only.
- E) Mobile behavior: inline players.

Remaining blocking unknowns:
- None for Phase-1 closeout.

Non-blocking unknowns (deferred to Phase-2):
- Exact ownership model details for creator/owner write expansion.
- Abuse/spam controls for broader write authority.
- Long-term provider expansion sequencing for marketplace entities.

Risk and coupling critique:
- High coupling: RLS + API + admin UI must align; partial rollout risks inconsistent behavior across entities.
- Medium coupling: CSP changes for canonical pages can unintentionally impact unrelated iframe consumers.
- Medium risk: current mixed write architecture (server routes vs direct client Supabase writes) can fragment validation unless standardized.
- Regression risk: `/embed/*` contract is production-validated and must remain isolated from canonical media tract changes.

## 15) Approval request
Phase-1 is implemented per locked policy and verified in local quality gates.

Implementation closeout evidence:
- Policy lock/docs commit: `08bf5f6`
- Phase-1 implementation commit: `514c085`
- Migration: `supabase/migrations/20260211121500_media_embed_phase1_columns.sql`

Smoke test checklist:
- [x] Admin write surfaces can set/clear structured YouTube + Spotify URLs for events/blog/gallery/members.
- [x] Canonical public pages render normalized YouTube (`youtube-nocookie`) + Spotify embeds when present.
- [x] Invalid URLs are rejected server-side with field-level `400` errors.
- [x] Empty inputs clear stored values (`NULL`) via overwrite semantics.
- [x] Regression coverage added for normalization, rendering, page wiring, and clearing semantics.
- [x] `npm --prefix web run lint` passed (0 errors, warnings only).
- [x] `npm --prefix web test -- --run` passed (`182` files, `3819` tests).
- [x] `npm --prefix web run build` attempted once and hit known local hang at `Creating an optimized production build ...`.

STOP - Awaiting Sami approval to proceed with MEDIA-EMBED-01B (Phase-2 write expansion).

---

## 16) Phase 1.5 closeout (MEDIA-EMBED-02 foundation)

Phase 1.5 implements the multi-embed ordered list foundation for profile surfaces only.

Implementation evidence:
- Migration: `supabase/migrations/20260212000000_media_embeds_table.sql`
- New table: `public.media_embeds` with RLS policies for profile owner/admin writes and public reads.
- Shared library: `web/src/lib/mediaEmbedsServer.ts` (upsert/read helpers).
- Extended: `web/src/lib/mediaEmbeds.ts` (classifyUrl, buildEmbedRows for multi-provider support).
- UI component: `web/src/components/media/MediaEmbedsEditor.tsx` (dnd-kit reorder, add/remove rows).
- Render component: `web/src/components/media/OrderedMediaEmbeds.tsx` (inline for YouTube/Spotify, safe cards for others).

Surfaces wired:
- Profile edit: `web/src/app/(protected)/dashboard/profile/page.tsx` (editor under photos section).
- Onboarding: `web/src/app/onboarding/profile/page.tsx` (editor in collapsible section).
- API: `web/src/app/api/profile/route.ts` and `web/src/app/api/onboarding/route.ts` (media_embed_urls array support).
- Canonical render: `web/src/app/members/[id]/page.tsx` and `web/src/app/songwriters/[id]/page.tsx` (ordered embeds with scalar fallback).

Quality gates:
- `npm --prefix web run lint`: PASS (0 errors, 2 pre-existing warnings).
- `npm --prefix web test -- --run`: PASS (184 files, 3834 tests).
- `npm --prefix web run build`: PASS (compiled, static pages generated).

Deployment evidence:
- PR #120: squash-merged to main as `b849513`.
- Tripwire fix: `3f0364f` — replaced `GRANT ALL` with `GRANT SELECT, INSERT, UPDATE, DELETE` on media_embeds for authenticated.
- Anon revoke fix: `2f8c1f8` — added explicit `REVOKE ALL FROM anon` to prevent Supabase default grant leakage.
- CI: all 4 jobs passed on `3f0364f` (CI x2, Web Tests, Supabase RLS Tripwire).
- Migration applied to production Supabase via MODE B (direct psql) on 2026-02-12.
- Migration recorded in `supabase_migrations.schema_migrations` (version `20260212000000`).
- Table verified: schema, indexes, RLS policies, check constraints all present.
- Grants verified: anon=SELECT only, authenticated=SELECT/INSERT/UPDATE/DELETE only.
- Vercel production deployment: `3f0364f` deployed successfully.

Phase 2 next: expand multi-embed to events (host/cohost writes), occurrence overrides, venues, blog, and gallery.

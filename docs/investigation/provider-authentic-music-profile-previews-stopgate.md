# Provider-Authentic Music Profile Previews Stop-Gate

## Summary

Public songwriter/member pages currently render Spotify, YouTube, and Bandcamp profile links as local fallback cards. This produces second-rate profile rows next to high-quality native iframe players for media links. The product goal is source-authentic previews: Spotify artist links should look like credible Spotify artist previews, YouTube channel links should show channel identity, and Bandcamp profile links should use the best provider-native or metadata-backed presentation available.

This is not one uniform problem across providers. Spotify can likely be solved as a narrow iframe-normalization change because Spotify artist URLs support native `open.spotify.com/embed/artist/{id}` iframes and existing CSP already permits `https://open.spotify.com`. YouTube and Bandcamp still require a separate metadata/API decision if we want authentic profile previews rather than generic rows.

## Current Repo Evidence

- Onboarding music profile fields are Spotify, Bandcamp, and YouTube:
  - `web/src/app/onboarding/profile/page.tsx`
- Dashboard profile edit exposes the same three music profile fields:
  - `web/src/app/(protected)/dashboard/profile/page.tsx`
- Public songwriter/member pages filter music platforms to `spotify`, `bandcamp`, and `youtube`, then call `getMusicProfileLinkMeta()`:
  - `web/src/app/songwriters/[id]/page.tsx`
  - `web/src/app/members/[id]/page.tsx`
- Current `getMusicProfileLinkMeta()` parses labels locally. Spotify artist cards use the URL path ID as headline:
  - `web/src/lib/mediaEmbeds.ts`
- Current `MusicProfileCard` renders a generic local row with icon, parsed headline, supporting text, and CTA:
  - `web/src/components/media/MusicProfileCard.tsx`
- Current tests intentionally assert that non-embeddable profile URLs render as profile cards and not inline players:
  - `web/src/__tests__/media-embed-rendering.test.tsx`
- `next.config.ts` already permits canonical page iframes for Spotify, YouTube, YouTube no-cookie, and Bandcamp. Image CSP includes Spotify CDN and YouTube thumbnail CDN but not all channel avatar domains likely needed for YouTube channel thumbnails:
  - `web/next.config.ts`
- Current Spotify normalizer accepts `track`, `playlist`, `album`, `show`, and `episode`, but rejects `artist`. This is the immediate reason Spotify artist profile links become fallback cards instead of Spotify-native artist iframes:
  - `web/src/lib/mediaEmbeds.ts`
- Existing `media_embeds` table provides precedent for additive tables, RLS, public-read-by-visible-profile, and owner/admin write policies:
  - `supabase/migrations/20260212000000_media_embeds_table.sql`

## External Research

- EPK guidance emphasizes music, video, bio, photos, and contact/social links; sample tracks and videos are primary proof-of-work assets. This supports keeping playable media as the strongest surface and treating profile destinations as rich identity previews.
- oEmbed is the standard way to turn pasted URLs into rich previews/embeds without custom per-provider markup.
- Spotify official oEmbed supports artist URLs and returns embed HTML, title, provider metadata, and `thumbnail_url`. However, oEmbed/cache is not required for the lowest-risk Spotify phase because the same artist URL can be normalized to Spotify's native artist iframe.
- YouTube Data API `channels` resource exposes channel title, description, custom URL, thumbnails, and statistics. This is the reliable source for channel/profile previews.
- Bandcamp official embedded players are album/track oriented. Generic artist homepages should use metadata/Open Graph fallback unless the pasted URL is an album/track/embed URL.
- Third-party URL engines like Iframely/Embedly/Microlink can reduce provider-specific code by normalizing oEmbed/Open Graph/Twitter Card/provider APIs, but introduce cost, vendor dependency, API key handling, and data policy review.

## Provider Matrix

| Provider | Current field | Best source-authentic path | API/key needed | Notes |
|---|---|---|---|---|
| Spotify | `spotify_url` | Normalize artist URLs to `https://open.spotify.com/embed/artist/{id}` and render through existing Spotify iframe path | No user OAuth; no oEmbed/cache required for Phase 1 | Strong phase-1 candidate. Avoid showing artist IDs. Requires adding `artist` to Spotify kind handling and tests. |
| YouTube | `youtube_url` | YouTube Data API channel lookup for handle/custom/channel URL; render avatar/title/channel metadata | CSC-owned YouTube API key | User OAuth not needed for public channels. Handle resolution needs care. |
| Bandcamp | `bandcamp_url` | Existing Bandcamp iframe for EmbeddedPlayer/album/track; Open Graph metadata for artist homepage | No formal public profile API identified | Must avoid pretending generic profile pages are native playable embeds. |

## Recommended Architecture

### Phase 1: Spotify Without New Infrastructure

1. Extend Spotify media kind handling to include `artist`.
2. Normalize `https://open.spotify.com/artist/{id}` and `https://open.spotify.com/embed/artist/{id}` to `https://open.spotify.com/embed/artist/{id}`.
3. Render legacy profile-column Spotify artist URLs (`profiles.spotify_url`) through the same Spotify iframe component path.
4. Ensure `profiles.spotify_url` still renders even when the profile already has ordered `media_embeds`. The screenshot case has explicit media embeds plus a profile card; Phase 1 must not only fix the `mediaEmbeds.length === 0` branch.
5. Do not backfill `profiles.spotify_url` into `media_embeds` in Phase 1. This keeps Phase 1 out of DB migration/backfill territory.
6. Update tests that currently lock Spotify artist URLs to fallback-card behavior.
7. No DB migration, cache table, oEmbed fetcher, or RLS changes.

This phase should be scoped as a render-layer/media-normalization change, not a new cached-data subsystem.

### Phase 2+: YouTube/Bandcamp Preview Resolution

1. Add provider profile preview resolution separate from media embed normalization.
2. Add a cache table, for example `public.profile_link_previews`, keyed by normalized URL.
3. Store:
   - `id uuid`
   - `provider text`
   - `profile_url text`
   - `canonical_url text`
   - `title text`
   - `subtitle text`
   - `image_url text`
   - `embed_html text` or sanitized iframe metadata for providers that return official iframe HTML
   - `resolved_type text`
   - `status text`
   - `last_fetched_at timestamptz`
   - `error_message text`
   - `created_at/updated_at`
4. Resolve previews server-side, never in the browser.
5. Public profile pages read cached previews and render immediately.
6. Refresh on profile save/onboarding save, and allow stale cached preview fallback.
7. Render fallback only when metadata is unavailable, compact and clearly branded.

## Rendering Contract

- Direct playable media remains the strongest surface and continues using native iframes/players.
- Music profile destinations should render in their best source-native form. If a profile destination has a native iframe (Spotify artist), it belongs with the rich media/player surface, not in a second-rate fallback row.
- Spotify artist:
  - Phase 1 uses the native Spotify artist iframe directly
  - do not use a cache table or oEmbed unless the iframe path proves insufficient in browser QA
  - render from `profiles.spotify_url`, regardless of whether ordered `media_embeds` exist
  - do not persist `kind = 'artist'` rows into `media_embeds` in Phase 1 unless a separate write-path approval is granted
- YouTube channel:
  - use channel title + thumbnail from Data API
  - do not show raw channel IDs/handles as the primary title unless no better title exists
- Bandcamp:
  - album/track/embed URLs use existing player path
  - artist homepage URLs use metadata image/title when available
- Fallback:
  - compact branded CTA
  - never large empty bordered rows
  - never raw Spotify artist ID as headline

## Product Alternative To Infra

Before approving YouTube/Bandcamp preview infrastructure, weigh a simpler form-contract change: ask members for one representative playable track/video/album per platform instead of, or in addition to, artist/channel profile URLs. That pushes more member pages onto the already-polished iframe path and aligns with EPK best practice, where sample music/video is the primary proof-of-work asset. This would not replace source-authentic profile previews, but it may reduce the amount of provider-specific metadata work needed.

## Risks

- Blocking correctness: YouTube handle/custom URL resolution may need multiple API calls, `search.list` quota, or scraping fallback. Must not ship partial logic that silently maps the wrong channel.
- Blocking correctness: Rendering provider-returned HTML unsafely could create XSS or CSP issues. Prefer extracting/sanitizing iframe src/title/height from allowlisted providers.
- Blocking correctness: New public preview table needs RLS matching public profile visibility. Avoid broad public reads of previews attached to private profiles unless keyed only by public URL and intentionally non-sensitive.
- Non-blocking correctness: Provider APIs can throttle or fail. Public pages must use stale cache/fallback and not block SSR.
- Non-blocking cosmetic: Provider-authentic cards can become visually inconsistent across platforms. Define a shared layout that respects provider identity without producing layout jumps.
- Non-blocking correctness: Remote image hosts may require CSP/Next image updates. YouTube channel avatar hosts may differ from existing `i.ytimg.com`.
- Non-blocking correctness: If a preview cache is introduced for YouTube/Bandcamp, refresh policy must be explicit. Stale artist names/images can become a member-trust issue.
- Non-blocking correctness: Adding `artist` to the TypeScript media kind union may imply a stored `media_embeds.kind` value. Phase 1 must avoid writing `kind = 'artist'` into `media_embeds`; otherwise DB/data contract impacts need separate review.

## Coupling

- Public `/songwriters/[id]` and `/members/[id]` render paths.
- Onboarding and dashboard profile save flows.
- `mediaEmbeds.ts` URL classification helpers.
- CSP/image remote patterns in `web/next.config.ts`.
- Supabase migrations, generated types, RLS tests.
- Existing media embed tests and profile empty-state tests.

## Migration Requirement

No migration is required for Phase 1 Spotify iframe normalization.

Likely required only if later YouTube/Bandcamp previews are cached in Supabase.

Migration must:
- Be additive.
- Enable RLS on the new table.
- Include policy-change acknowledgement header if policies are added.
- Grant only required privileges.
- Avoid SECURITY DEFINER helpers unless explicitly justified.

## Rollback

- For Phase 1 Spotify, remove `artist` from Spotify embed normalization and restore fallback-card expectations.
- Disable preview rendering behind a feature flag or return to `MusicProfileCard` fallback.
- Keep cache table inert; no user profile data mutation required.
- If migration must be rolled back, drop preview table only after code no longer reads it.

## Test Plan

- Unit tests for provider URL classification.
- Unit tests for Spotify artist URL normalization to `/embed/artist/{id}`.
- Component/page tests for Spotify artist URLs stored in `profiles.spotify_url` rendering as iframes when ordered `media_embeds` are absent and when ordered `media_embeds` are present.
- Dedupe test: given the same Spotify artist URL in both `profiles.spotify_url` and `media_embeds`, render only one Spotify artist iframe/card surface.
- Accessibility/title test or assertion for artist iframe title text, avoiding odd phrasing like `Spotify artist player`; use `Spotify artist embed` or equivalent.
- Unit tests for YouTube channel resolver response normalization.
- Unit tests for Bandcamp metadata fallback.
- Component tests for provider-authentic preview rendering and fallback behavior.
- Source-level CSP test for required image/frame hosts.
- Migration/RLS tests for public/private profile preview visibility if table is added.
- Existing media embed rendering tests updated so Spotify artist URLs render as Spotify iframes, while YouTube/Bandcamp profile links remain fallback/profile previews until their later phases are approved.

## Proposed Phase Scope

Phase 1:
- Spotify artist iframe normalization only.
- Add `artist` to Spotify kind handling.
- Render `profiles.spotify_url` artist iframes alongside existing ordered media embeds, with dedupe.
- Keep Phase 1 read/render-only for `profiles.spotify_url`; do not backfill or write artist rows to `media_embeds`.
- Adjust iframe title text for Spotify artist embeds.
- Update rendering/import tests that currently treat Spotify artist URLs as non-embeddable profile cards.
- No cache table, no oEmbed, no RLS, no migration.

Phase 2:
- YouTube channel API-backed preview with CSC-owned API key.
- CSP/image host updates.
- Decide cache refresh policy before implementation.

Phase 3:
- Bandcamp Open Graph/profile metadata fallback and album/track promotion guidance.
- Optional third-party resolver evaluation if direct provider integrations are not robust enough.

Deferred vendor recommendation:
- Do not adopt Iframely/Microlink/Embedly for Phase 1.
- Re-evaluate for Phase 2/3 only if direct YouTube/Bandcamp resolution proves brittle or too costly to maintain.

## Approval Questions

1. Approve Spotify artist iframe normalization as Phase 1 with no DB/cache/oEmbed work?
2. Approve deferring YouTube/Bandcamp profile preview infrastructure to a separate phase?
3. Before Phase 2, should we prefer provider APIs + cache, a third-party resolver, or changing the form contract toward representative playable media links?

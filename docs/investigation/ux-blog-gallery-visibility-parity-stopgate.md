# STOP-GATE: Canonical Blog/Gallery Visibility Parity (Investigation Only)

**Status:** Implemented (phase 1 complete)  
**Date:** 2026-02-10  
**Owner:** Repo agent (investigation-first)

## 1) Problem Statement

Canonical public pages are rendering empty states:
- `/blog` shows: "No blog posts yet. Be the first to share your story!"
- `/gallery` shows: "No photos yet. Be the first to share!"

This regression was reported after EMBED-02 shipped. EMBED routes are working and must remain strict.  
Goal: restore canonical `/blog` and `/gallery` visibility behavior for public content without loosening EMBED-02 safety gates.

## 2) Repro Steps

1. Visit canonical routes:
   - `/blog`
   - `/gallery`
2. Observe empty state text even when published content is expected.
3. Compare against embed behavior:
   - `/embed/blog/{slug}`
   - `/embed/gallery/{slug}`
4. Confirm canonical pages are the failing surfaces, not embed routes.

Notes:
- Use known existing slugs/records from your environment; no content IDs are invented here.

Route inventory in scope:
- Canonical:
  - `web/src/app/blog/page.tsx`
  - `web/src/app/blog/[slug]/page.tsx`
  - `web/src/app/gallery/page.tsx`
  - `web/src/app/gallery/[slug]/page.tsx`
- Embed (strictness reference, no semantic loosening):
  - `web/src/app/embed/blog/[slug]/route.ts`
  - `web/src/app/embed/gallery/[slug]/route.ts`
- Related event route (sharing tract dependency only):
  - `web/src/app/events/[id]/page.tsx`

## 3) Current Expected Behavior

Canonical public pages should show content that is considered public by the canonical site policy (pre-embed behavior intent), not collapse to empty due over-restrictive or mismatched filters.

Embed routes should remain strict and unchanged:
- Blog embed: published + approved
- Gallery embed: published + not hidden

Phase-1 requirement for canonical pages in this tract:
- Canonical pages must not mask query/runtime failures as "No content yet" states.
- Canonical pages must use an explicit public-visibility policy lock (see Section 6.5).

## 4) Evidence Map (file:line)

> Line numbers may drift; file paths are canonical.

### Canonical blog filters and empty state
- `web/src/app/blog/page.tsx:33` query reads `blog_posts` with no error handling.
- `web/src/app/blog/page.tsx:45` `.eq("is_published", true)`
- `web/src/app/blog/page.tsx:46` `.eq("is_approved", true)`
- `web/src/app/blog/page.tsx:114` empty-state copy shown when no rows.
- `web/src/app/blog/[slug]/page.tsx:95` detail requires `.eq("is_published", true)`
- `web/src/app/blog/[slug]/page.tsx:96` detail also requires `.eq("is_approved", true)`
- Stable references:
  - `BlogPage()` query in `web/src/app/blog/page.tsx` currently uses:
    - `.from("blog_posts") ... .eq("is_published", true).eq("is_approved", true)`
  - `BlogPostPage()` query in `web/src/app/blog/[slug]/page.tsx` currently uses:
    - `.from("blog_posts") ... .eq("slug", slug).eq("is_published", true).eq("is_approved", true).single()`

### Canonical gallery filters and empty state
- `web/src/app/gallery/page.tsx:38` album filter `.eq("is_published", true)`
- `web/src/app/gallery/page.tsx:39` album filter `.eq("is_hidden", false)`
- `web/src/app/gallery/page.tsx:86` image filter `.eq("is_published", true)`
- `web/src/app/gallery/page.tsx:87` image filter `.eq("is_hidden", false)`
- `web/src/app/gallery/page.tsx:249` empty-state copy shown when no rows.
- `web/src/app/gallery/[slug]/page.tsx:83` album detail filter `.eq("is_published", true)`
- `web/src/app/gallery/[slug]/page.tsx:107` image filter `.eq("is_published", true)`
- `web/src/app/gallery/[slug]/page.tsx:108` image filter `.eq("is_hidden", false)`
- Stable references:
  - `GalleryPage()` album query in `web/src/app/gallery/page.tsx` currently uses:
    - `.from("gallery_albums") ... .eq("is_published", true).eq("is_hidden", false)`
  - `GalleryPage()` image query in `web/src/app/gallery/page.tsx` currently uses:
    - `.from("gallery_images") ... .eq("is_published", true).eq("is_hidden", false)`
  - `AlbumPage()` image query in `web/src/app/gallery/[slug]/page.tsx` currently uses:
    - `.from("gallery_images") ... .eq("album_id", album.id).eq("is_published", true).eq("is_hidden", false)`

### Embed routes are strict (must remain strict)
- `web/src/app/embed/blog/[slug]/route.ts:52` `.eq("is_published", true)`
- `web/src/app/embed/blog/[slug]/route.ts:53` `.eq("is_approved", true)`
- `web/src/app/embed/gallery/[slug]/route.ts:57` `.eq("is_published", true)`
- `web/src/app/embed/gallery/[slug]/route.ts:58` `.eq("is_hidden", false)`

### EMBED-02 commit did not touch canonical blog/gallery pages
- Commit `ed3ae28` file list contains only embed routes/tests + docs, no canonical `/blog` or `/gallery` page files.

### Error handling gap that can mask query failures as empty states
- `web/src/app/blog/page.tsx:33` destructures `{ data: posts }` only.
- `web/src/app/gallery/page.tsx:28` destructures `{ data: albums }` only.
- `web/src/app/gallery/page.tsx:74` destructures `{ data: images, count: totalCount }` only.
- No canonical page-level handling of query `error` before rendering empty states.

### Additional live evidence for affected surfaces
- Canonical list routes return `200` while rendering empty-state markers:
  - `/blog` includes `"No blog posts yet. Be the first to share your story!"` (observed marker count > 0)
  - `/gallery` includes `"No photos yet. Be the first to share!"` (observed marker count > 0)
- Embed strict routes currently return false 404 for known public records:
  - `/embed/blog/open-mic-tips-and-etiquette` -> `404` with `"Post not found"`
  - `/embed/gallery/collective-open-mic-at-sloan-s-lake-2-8-26` -> `404` with `"Album not found"`

## 5) Data Model Tracing (Visibility Fields and Policies)

### Blog
- Table fields include `is_published`, `is_approved`:
  - `web/src/lib/supabase/database.types.ts:294`
  - `web/src/lib/supabase/database.types.ts:302`
  - `web/src/lib/supabase/database.types.ts:304`
- Base public-read policy created as published-only:
  - `supabase/migrations/20251206000003_gallery_and_blog.sql:82`
  - `supabase/migrations/20251206000003_gallery_and_blog.sql:83`
- Approval column added later:
  - `supabase/migrations/20251209000003_blog_gallery_approval.sql:14`

### Gallery albums
- Table fields include `is_published`, `is_hidden`, `is_approved` in generated types:
  - `web/src/lib/supabase/database.types.ts:1526`
  - `web/src/lib/supabase/database.types.ts:1534`
  - `web/src/lib/supabase/database.types.ts:1535`
  - `web/src/lib/supabase/database.types.ts:1536`
- Public-read policy in migrations is published-only:
  - `supabase/migrations/20251206000004_gallery_albums.sql:27`
  - `supabase/migrations/20251206000004_gallery_albums.sql:28`

### Gallery images
- Table fields include `is_approved`, `is_published`, `is_hidden` in generated types:
  - `web/src/lib/supabase/database.types.ts:1610`
  - `web/src/lib/supabase/database.types.ts:1621`
  - `web/src/lib/supabase/database.types.ts:1623`
  - `web/src/lib/supabase/database.types.ts:1624`
- Public-read policy in migrations is approval-based:
  - `supabase/migrations/20251206000003_gallery_and_blog.sql:30`
  - `supabase/migrations/20251206000003_gallery_and_blog.sql:31`
  - reaffirmed in `supabase/migrations/20251212000003_security_remediation.sql:142`
  - reaffirmed in `supabase/migrations/20251212000003_security_remediation.sql:147`
- Implication: canonical gallery image visibility should be anchored to `is_approved = true` as the policy-driving gate.

### Data write-path mismatch indicators
- Gallery upload insert sets `is_approved: true` but does not set `is_published`:
  - `web/src/app/(protected)/dashboard/gallery/UserGalleryUpload.tsx:421`
  - `web/src/app/(protected)/dashboard/gallery/UserGalleryUpload.tsx:436`
- Admin gallery approval action toggles `is_approved` only (not `is_published`):
  - `web/src/app/(protected)/dashboard/admin/gallery/GalleryAdminTabs.tsx:88`
  - `web/src/app/(protected)/dashboard/admin/gallery/GalleryAdminTabs.tsx:90`

### Schema drift check: migration history vs code/types
- Generated types include `gallery_albums.is_hidden` and `gallery_images.is_hidden/is_published`:
  - `web/src/lib/supabase/database.types.ts:1535`
  - `web/src/lib/supabase/database.types.ts:1623`
  - `web/src/lib/supabase/database.types.ts:1624`
- Committed migrations in this repo do not contain an explicit add-column migration for those gallery visibility columns.
- Classification:
  - Blocking: **No** for this tract (embed gallery route currently works with these columns, strongly indicating deployed schema has them).
  - Non-blocking: **Yes** (repo migration completeness should be audited separately to avoid future environment drift).

### Server auth context
- Canonical and embed queries use server client with anon key + request cookies:
  - `web/src/lib/supabase/server.ts:7`
  - `web/src/lib/supabase/server.ts:9`

## 6) Ranked Root-Cause Hypotheses

### H1 (P0): Canonical filters are stricter/different than effective public data lifecycle
Evidence:
- Canonical gallery reads by `is_published + is_hidden` (`web/src/app/gallery/page.tsx:86-87`) while operational write/approval paths prominently set `is_approved` (`UserGalleryUpload.tsx:436`, `GalleryAdminTabs.tsx:90`).
- Canonical blog requires both `is_published + is_approved` (`web/src/app/blog/page.tsx:45-46`, `web/src/app/blog/[slug]/page.tsx:95-96`), which can exclude posts expected as public if approval state is inconsistent.

Impact:
- Public canonical pages can be empty even when records exist and are treated as public elsewhere.

### H2 (P1): Query errors can be masked as empty states
Evidence:
- Canonical list pages do not branch on Supabase `error`; they render empty state when data is null/empty (`web/src/app/blog/page.tsx:33`, `web/src/app/gallery/page.tsx:28`, `web/src/app/gallery/page.tsx:74`).

Impact:
- Schema/policy/query failures can appear as "No content yet" instead of actionable error behavior.

### H3 (P1): Schema/governance drift risk between generated types and committed migrations
Evidence:
- Generated types include `gallery_albums.is_hidden` and `gallery_images.is_hidden/is_published` (`database.types.ts:1535`, `database.types.ts:1623`, `database.types.ts:1624`).
- No migration in `supabase/migrations` explicitly adds these columns to `gallery_albums`/`gallery_images` in this repo history.

Impact:
- Environment drift can produce inconsistent behavior by deployment/database state.

### H4 (P2): Caching is unlikely primary cause
Evidence:
- Canonical pages already use `dynamic = "force-dynamic"`:
  - `web/src/app/blog/page.tsx:12`
  - `web/src/app/blog/[slug]/page.tsx:10`
  - `web/src/app/gallery/page.tsx:13`
  - `web/src/app/gallery/[slug]/page.tsx:9`

Impact:
- Stale cache is less likely than filter/visibility mismatch.

### 6.5 STOP-GATE Critique (Required)

Minimum policy decisions required:
1. Canonical blog visibility gate policy (published-only vs published+approved).
2. Canonical gallery album visibility gate policy (`is_published` only vs `is_published + !is_hidden`).
3. Canonical gallery image gate policy (`is_approved` vs `is_published`, plus `!is_hidden`).

Recommended default phase-1 policy lock (safe + parity-oriented):
- Canonical blog list/detail: `is_published = true AND is_approved = true`.
  - Rationale: avoids exposing moderation-pending posts if any row is published but not approved.
- Canonical gallery albums list/detail: `is_published = true` and `is_hidden = false` when column exists.
- Canonical gallery images list/detail: `is_approved = true` and `is_hidden = false` when column exists.
  - Rationale: aligns with public-read policy and write/approval lifecycle evidence.
- Canonical error handling lock: all canonical blog/gallery page queries must branch on `error`; error renders a temporary load-failure state, not empty-state copy.

Blocking unknowns for execution:
- None identified in repo evidence.

Non-blocking unknowns:
- Live row distributions for `is_published/is_approved/is_hidden` in production still need SQL confirmation (Section 13).

## 7) Minimal Fix Plan (Policy Split: Canonical vs Embed)

1. Keep embed routes unchanged and strict:
   - `web/src/app/embed/blog/[slug]/route.ts`
   - `web/src/app/embed/gallery/[slug]/route.ts`
2. Adjust canonical `/blog` and `/gallery` query gates to match approved canonical public semantics (see approval questions below).
3. Add explicit canonical query error handling so failures do not silently present as "No content yet."
   - List pages: render temporary load-failure state when query fails.
   - Detail pages: keep `404` only for true not-found; show temporary load-failure state for query failures.
4. Add regression tests for canonical non-empty behavior when qualifying records exist.
5. Preserve existing frame-protection and embed kill-switch behavior (no framing/csp changes in this tract).

## 8) Risk Assessment + Rollback Plan

### Risks
- Over-loosening canonical filters could expose content intended to remain hidden/unapproved.
- Under-fixing keeps regression in place and continues false empty states.
- Mixed legacy data states may still produce edge-case empties if compatibility rule is not explicit.

### Rollback
- Single-commit rollback of canonical query/filter changes.
- Keep embed strict tests green as invariant.
- Re-run canonical visibility regression tests after rollback.

## 9) Regression Test Plan

Add/extend tests to enforce parity intent:

1. Canonical blog list:
   - qualifying public rows render cards, not empty state.
2. Canonical blog detail:
   - qualifying row renders detail page (not 404).
3. Canonical gallery list:
   - qualifying public albums/images render (not "No photos yet").
4. Canonical gallery album detail:
   - qualifying album/images render (not "No photos in this album yet.").
5. Embed strictness remains:
   - keep/extend `web/src/app/embed/blog/[slug]/route.test.ts`
   - keep/extend `web/src/app/embed/gallery/[slug]/route.test.ts`
6. Error-state regression:
   - canonical blog/gallery list pages render error state when Supabase returns `error`.
   - canonical blog/gallery detail pages distinguish query failure vs not-found.
7. Framing regression remains:
   - `web/src/__tests__/embed-framing-regression.test.ts` unchanged behavior.

## 10) Caching Considerations

- Canonical pages are already `force-dynamic`; no cache TTL changes needed for this fix.
- This tract should not alter embed cache behavior (`no-store` on disabled response stays in embed layer).
- If query logic changes, expected visibility updates should appear on next request without revalidate hooks.

## 11) Security Considerations

- Keep non-embed framing protections unchanged.
- Keep embed strict visibility gates unchanged.
- Canonical visibility relaxation (if approved) must still avoid leaking private/draft/hidden content.
- Treat any change from approval-based to publish-based visibility as a policy decision requiring explicit approval.

## 12) Backlog Linkage

Confirmed current canonical references:
- `docs/BACKLOG.md:612` (`EMBED-02` marked DONE with closeout)
- `docs/backlog/post-gtm-3-1-active-backlog.md:18` (`EMBED-02` indexed as DONE)

For this regression tract:
- Canonical backlog item added as investigation-complete:
  - `UX-10` in `docs/BACKLOG.md` (done)
  - mirrored in `docs/backlog/post-gtm-3-1-active-backlog.md`
- Related sharing tract is indexed as:
  - `UX-11` with STOP-GATE link `docs/investigation/ux-facebook-sharing-stopgate.md`

## 13) Unknowns + Verification SQL (for Sami to run if needed)

Fallback SQL pack is retained for reproducibility and re-checks.  
Primary production outputs are captured in Section 14.

Blocking unknowns: none.  
Non-blocking unknowns: live row distributions and migration-history completeness across environments.

```sql
-- Blog visibility distribution
select is_published, is_approved, count(*) as rows
from public.blog_posts
group by 1,2
order by 1 desc, 2 desc;

-- Gallery album visibility distribution
select is_published, is_hidden, count(*) as rows
from public.gallery_albums
group by 1,2
order by 1 desc, 2 desc;

-- Gallery image visibility distribution
select is_published, is_hidden, is_approved, count(*) as rows
from public.gallery_images
group by 1,2,3
order by 1 desc, 2 asc, 3 desc;

-- Confirm policy definitions in live DB
select schemaname, tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('blog_posts', 'gallery_albums', 'gallery_images')
order by tablename, policyname;

-- Confirm columns and defaults in live DB
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('blog_posts', 'gallery_albums', 'gallery_images')
  and column_name in ('is_published', 'is_approved', 'is_hidden')
order by table_name, column_name;
```

Implementation approved and completed in phase 1.

## 14) STOP-GATE Addendum (2026-02-10 Production SQL + API Evidence)

### 14.1 Required SQL outputs (production)

```text
--- BLOG DISTRIBUTION (is_published,is_approved) ---
 is_published | is_approved | rows
--------------+-------------+------
 t            | t           |    2

--- GALLERY_ALBUMS DISTRIBUTION (is_published,is_hidden) ---
 is_published | is_hidden | rows
--------------+-----------+------
 t            | f         |   10

--- GALLERY_IMAGES DISTRIBUTION (is_approved,is_hidden,is_published) ---
 is_approved | is_hidden | is_published | rows
-------------+-----------+--------------+------
 t           | f         | t            |  164
```

```text
--- PG_POLICIES (blog_posts,gallery_albums,gallery_images) ---
 schemaname |   tablename    |         policyname          |  cmd   |        roles         |               qual
------------+----------------+-----------------------------+--------+----------------------+----------------------------------
 public     | blog_posts     | blog_posts_admin_all        | ALL    | {public}             | ( SELECT is_admin() AS is_admin)
 public     | blog_posts     | blog_posts_author_delete    | DELETE | {authenticated}      | (auth.uid() = author_id)
 public     | blog_posts     | blog_posts_author_read      | SELECT | {public}             | (auth.uid() = author_id)
 public     | blog_posts     | blog_posts_author_update    | UPDATE | {authenticated}      | (auth.uid() = author_id)
 public     | blog_posts     | blog_posts_public_read      | SELECT | {anon,authenticated} | (is_published = true)
 public     | blog_posts     | blog_posts_user_insert      | INSERT | {authenticated}      |
 public     | gallery_albums | gallery_albums_admin_all    | ALL    | {public}             | ( SELECT is_admin() AS is_admin)
 public     | gallery_albums | gallery_albums_owner_delete | DELETE | {authenticated}      | (created_by = auth.uid())
 public     | gallery_albums | gallery_albums_owner_insert | INSERT | {authenticated}      |
 public     | gallery_albums | gallery_albums_owner_select | SELECT | {authenticated}      | (created_by = auth.uid())
 public     | gallery_albums | gallery_albums_owner_update | UPDATE | {authenticated}      | (created_by = auth.uid())
 public     | gallery_albums | gallery_albums_public_read  | SELECT | {public}             | (is_published = true)
 public     | gallery_images | gallery_images_admin        | ALL    | {public}             | ( SELECT is_admin() AS is_admin)
 public     | gallery_images | gallery_images_delete_own   | DELETE | {public}             | (auth.uid() = uploaded_by)
 public     | gallery_images | gallery_images_insert       | INSERT | {authenticated}      |
 public     | gallery_images | gallery_images_own_read     | SELECT | {public}             | (auth.uid() = uploaded_by)
 public     | gallery_images | gallery_images_public_read  | SELECT | {anon,authenticated} | (is_approved = true)
 public     | gallery_images | gallery_images_update_own   | UPDATE | {public}             | (auth.uid() = uploaded_by)
```

```text
--- INFORMATION_SCHEMA COLUMNS (visibility fields) ---
   table_name   | column_name  | data_type | is_nullable | column_default
----------------+--------------+-----------+-------------+----------------
 blog_posts     | is_approved  | boolean   | YES         | false
 blog_posts     | is_published | boolean   | YES         | false
 gallery_albums | is_approved  | boolean   | YES         | false
 gallery_albums | is_hidden    | boolean   | NO          | false
 gallery_albums | is_published | boolean   | YES         | false
 gallery_images | is_approved  | boolean   | YES         | false
 gallery_images | is_hidden    | boolean   | NO          | false
 gallery_images | is_published | boolean   | NO          | true
```

```text
--- FUNCTION EXECUTE PRIVILEGE CHECK ---
 anon_exec | auth_exec | service_exec
-----------+-----------+-------------
 f         | t         | t
```

```text
--- TABLES WITH roles {public} + qual containing is_admin() ---
24 rows total in production policy catalog
Includes: blog_posts, gallery_albums, gallery_images, events, and additional admin/operator tables.
```

### 14.2 Anonymous API verification (production)

Canonical-shape anon REST queries fail with:

```json
{"code":"42501","details":null,"hint":null,"message":"permission denied for function is_admin"}
```

Verified for:
- `blog_posts` canonical select/filter shape
- `gallery_albums` canonical select/filter shape
- `gallery_images` canonical select/filter shape

Control sample:
- `events` anon public-read query succeeds (`200` data) under existing `Public read access` / `public_read_events` policies.
  - This confirms the parity break is table/policy-shape-specific, not a global anon outage.

### 14.3 Conclusion: Root cause classification

This regression is a **combination** of:
1. **RLS/policy issue for anon**: admin `FOR ALL` policies are scoped to `{public}` and invoke `is_admin()`, but anon lacks `EXECUTE` on `is_admin()` (hard failure `42501`).
2. **Canonical query error masking**: canonical pages ignore Supabase `error` and render empty-state copy, creating false "No posts/photos yet" UX.

Observed affected public surfaces in current production behavior:
- Canonical `/blog` list empty-state false negative.
- Canonical `/gallery` list empty-state false negative.
- Embed `/embed/blog/*` false 404 for known public slugs (strict route semantics are intact, data lookup fails).
- Embed `/embed/gallery/*` false 404 for known public slugs (strict route semantics are intact, data lookup fails).

Not the primary cause:
- Data-flag mismatch (production distributions show qualifying public rows exist).
- Missing columns in production (visibility columns exist with defaults).

### 14.4 Minimal safe fix for implementation phase (after approval)

1. **RLS minimal patch** (if approved):
   - Scope admin-all policies to authenticated roles only on:
     - `blog_posts_admin_all`
     - `gallery_albums_admin_all`
     - `gallery_images_admin`
   - Keep policy quals unchanged (`is_admin()`), avoid granting `is_admin()` execute to anon.
2. Canonical page fixes:
   - Apply phase-1 canonical visibility locks from Section 6.5.
   - Add explicit query-error branches with temporary failure state (not empty-state copy).
3. Keep embed routes unchanged and strict (no gating loosening, no query-contract changes).
   - Expected side effect: once RLS hard-fail is removed for anon reads, embed routes resolve existing public records instead of false 404.

### 14.5 Blocking status after addendum

- Blocking unknowns: **none**.
- Non-blocking unknowns:
  - migration-history completeness across environments (separate governance cleanup)
  - additional tables with `roles {public}` and `is_admin()` are a latent risk class outside this tract; no expansion without explicit approval.

## 15) Plan and Diff Summary (Pre-Implementation, Approval Required)

### 15.1 STOP-GATE critique (new risk check)

- New risk discovered: canonical pages currently convert Supabase errors into false empty states on both list and detail surfaces, which hides operational failures and weakens incident detection.
- Why the planned fix is safe:
  - It keeps embed strictness unchanged.
  - It narrows RLS admin policy role scope instead of granting broader function privileges.
  - It uses conservative canonical visibility locks already documented in this STOP-GATE.

### 15.2 Exact migration statements planned (minimal RLS patch)

```sql
-- New migration: scope admin-all policies away from anon/public
alter policy blog_posts_admin_all
  on public.blog_posts
  to authenticated;

alter policy gallery_albums_admin_all
  on public.gallery_albums
  to authenticated;

alter policy gallery_images_admin
  on public.gallery_images
  to authenticated;
```

Notes:
- Policy `USING` / `WITH CHECK` expressions remain unchanged (`is_admin()`).
- No `GRANT EXECUTE` on `is_admin()` to anon.
- Public read policies remain unchanged in phase 1:
  - `blog_posts_public_read`: `is_published = true`
  - `gallery_albums_public_read`: `is_published = true`
  - `gallery_images_public_read`: `is_approved = true`

### 15.3 Exact canonical page changes planned

1. `web/src/app/blog/page.tsx`
   - Capture `{ error }` from the list query.
   - If `error` exists, render a temporary load-failure state.
   - Only render "No blog posts yet..." when `!error && posts.length === 0`.
2. `web/src/app/blog/[slug]/page.tsx`
   - Capture `{ error }` on detail query.
   - Distinguish:
     - `error` => temporary load-failure state
     - `!error && !post` => `notFound()`
   - Keep canonical visibility lock: `is_published = true AND is_approved = true`.
3. `web/src/app/gallery/page.tsx`
   - Capture `{ error }` on album query and image query.
   - Use temporary load-failure state when either query errors.
   - Align image visibility gate to policy intent:
     - `is_approved = true`
     - `is_hidden = false` (column exists in production evidence)
   - Keep album gate:
     - `is_published = true`
     - `is_hidden = false`
4. `web/src/app/gallery/[slug]/page.tsx`
   - Capture `{ error }` on album query and images query.
   - Distinguish query failure from true not-found.
   - Align image gate to `is_approved = true` + `is_hidden = false`.

### 15.4 Exact tests planned

- Add canonical regression tests with mocked Supabase responses:
  1. `/blog` renders content (not empty state) when qualifying rows exist.
  2. `/gallery` renders content (not empty state) when qualifying rows exist.
  3. Canonical pages render failure state when Supabase returns `error`.
  4. Canonical detail pages render for qualifying rows and only 404 on true not-found.
- Keep embed tests unchanged and green:
  - `web/src/app/embed/blog/[slug]/route.test.ts`
  - `web/src/app/embed/gallery/[slug]/route.test.ts`

## 16) Implementation closeout

Implemented after explicit approval with minimal scope:
- RLS policy role scoping migration:
  - `supabase/migrations/20260210044500_fix_blog_gallery_admin_policy_roles.sql`
- Canonical page fixes:
  - `web/src/app/blog/page.tsx`
  - `web/src/app/blog/[slug]/page.tsx`
  - `web/src/app/gallery/page.tsx`
  - `web/src/app/gallery/[slug]/page.tsx`
- Regression tests:
  - `web/src/__tests__/ux-10-canonical-parity.test.tsx`
  - `web/src/__tests__/gallery-album-management.test.ts`

Validation:
- `npm --prefix web run lint` passed (warnings only).
- `npm --prefix web test -- --run` passed (`177` files, `3803` tests).
- `npm --prefix web run build` reproduced known local hang after `Creating an optimized production build ...`; process terminated and delegated to Vercel build verdict per repo policy.

Commit evidence:
- `da131a0`
- `90c9de4`
- `9851a16`

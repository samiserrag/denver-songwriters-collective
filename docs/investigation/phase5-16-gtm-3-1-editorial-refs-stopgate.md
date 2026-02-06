# STOP-GATE Investigation — GTM-3.1 Editorial URL/Slug 500s

**Status:** CLOSED (Superseded by phase5-17 and phase5-18)
**Date:** 2026-02-05
**Owner:** Repo Agent

## Problem Statement
Editing weekly digest editorial fields in admin causes 500s when slug/URL strings are sent where UUIDs are expected. Prod logs show Postgres error `22P02 invalid input syntax for type uuid` (example slug: `a-lodge-lyons-the-rock-garden`). Saving intro/subject only succeeds; any URL/slug field can fail.

## Evidence (Step A)

### 1) `digest_editorial` schema uses UUID columns
**Migration:** `supabase/migrations/20260205000000_digest_editorial.sql`
- `featured_happening_ids UUID[]` (line 16)
- `member_spotlight_id UUID` (line 17)
- `venue_spotlight_id UUID` (line 18)

### 2) Admin UI explicitly requests slugs/URLs for member + venue spotlights
**File:** `web/src/app/(protected)/dashboard/admin/email/page.tsx`
- Member spotlight input label: “slug or URL” (around line 783)
- Venue spotlight input label: “slug or URL” (around line 798)
- Placeholder examples are slugs and route paths

This UI guidance conflicts with UUID-only DB columns.

### 3) PUT /api/admin/digest/editorial normalizes slugs into UUID columns
**File:** `web/src/app/api/admin/digest/editorial/route.ts`
- Normalizes `member_spotlight_id` and `venue_spotlight_id` via `normalizeEditorialSlug()` (lines 83–90)
- `normalizeEditorialSlug()` returns a slug or URL path, not a UUID

This writes slug strings into UUID columns, causing `22P02` at Postgres.

### 4) `normalizeEditorialSlug()` returns slugs, not UUIDs
**File:** `web/src/lib/digest/digestEditorial.ts`
- `normalizeEditorialSlug()` strips `/songwriters/`, `/venues/`, `/events/`, `/blog/`, `/gallery/` and returns slug (lines 39–62)
- It does not validate UUID; it just returns the string

### 5) Featured happenings are stored as UUID[] but resolver only reads UUIDs
**File:** `web/src/lib/digest/digestEditorial.ts`
- Resolver uses `.in("id", editorial.featured_happening_ids)` (around lines 150–170)
- No slug fallback for featured happenings

### 6) Resolver already supports slug OR UUID for member/venue
**File:** `web/src/lib/digest/digestEditorial.ts`
- `isUUID()` check (lines 19–21)
- Member spotlight resolves by id or slug (around lines 190–215)
- Venue spotlight resolves by id or slug (around lines 220–250)

This means the **resolver already accepts slugs**, but the **database does not**.

---

## Root Cause Summary
1. Admin UI encourages slug/URL input for member and venue spotlights.
2. API normalizes those inputs into **UUID columns**, causing Postgres `22P02` errors and 500 responses.
3. Featured happenings are UUID[] only; slug input would also fail if ever passed.
4. No request validation or type guard exists in PUT endpoint, so DB errors bubble into 500s.

---

## Proposed Fixes (Step A)

### A) Schema (Additive)
Add new TEXT columns to `digest_editorial` for slug/URL refs:
- `member_spotlight_ref TEXT`
- `venue_spotlight_ref TEXT`
- `blog_feature_ref TEXT`
- `gallery_feature_ref TEXT`
- `featured_happenings_refs TEXT[]`

Keep UUID columns as legacy fallback only.

### B) API Validation
In `PUT /api/admin/digest/editorial`:
- If a field targets a UUID column and value is not UUID, return 400 with:
  - `field`
  - guidance: “paste a UUID for now” or “paste a slug/url after next patch”
- Do not allow Postgres 22P02 to surface as 500.

### C) Resolver + Normalization
- Store all slug/URL inputs into new TEXT ref columns.
- Normalize refs by stripping domain + query + hash, then extracting slug from route pattern.
- Resolve by slug for refs; fallback to UUID columns if refs are null.

### D) Email Rendering
- Featured happenings and all spotlights render with baseball card renderer.
- Cover images never crop (baseball card uses `height: auto`).
- Title links to DSC detail pages; venue name links external with DSC fallback.

### E) Tests
- Intro-only save works
- Saving each ref as full URL works
- Saving each ref as bare slug works
- Invalid ref returns 400 (not 500)
- Preview matches send output

---

## Critique (Step B)

### Risks
- **Migration risk:** new columns must be additive and nullable to avoid breaking existing rows.
- **Data drift:** legacy UUID columns may contain existing UUIDs; need fallback order.
- **Resolver mismatch:** slug extraction must cover all route patterns; incorrect parsing could yield silent omission.

### Coupling
- DB: `digest_editorial`
- API: `/api/admin/digest/editorial`
- Admin UI: `/dashboard/admin/email`
- Resolver: `lib/digest/digestEditorial.ts`
- Email template: `lib/email/templates/weeklyHappeningsDigest.ts`
- Preview/send/cron: `/api/admin/digest/preview`, `/api/admin/digest/send`, `/api/cron/weekly-happenings`

### Migrations
- Additive migration only (new columns). No backfill required.

### Rollback Plan
- Drop new ref columns if needed.
- Revert API to UUID-only behavior if required.

### Test Coverage
- Add API validation tests for 400 vs 500.
- Add resolver tests for URL/slug normalization and slug lookup.
- Ensure preview and send share same resolved output.

---

## Approval
Approved by Sami on 2026-02-05. Proceeding with execution.

## Execution Notes (Step C)
Planned and in-progress changes:
1) Add additive migration for new text ref columns.
2) Add request validation helper for PUT endpoint (return 400 for invalid UUIDs/refs).
3) Store normalized refs in new columns; keep legacy UUID columns as fallback only.
4) Update resolver to resolve refs by slug, with UUID fallback.
5) Ensure editorial sections use baseball card renderer and cover images never crop.
6) Add tests for slug/URL handling and preview/send parity.

## Execution Results
**Code/Migrations:**
- Migration added: `supabase/migrations/20260205181500_digest_editorial_ref_columns.sql`
- New helper: `web/src/lib/digest/editorialPayload.ts`
- Resolver updates: `web/src/lib/digest/digestEditorial.ts`
- Email template updates: `web/src/lib/email/templates/weeklyHappeningsDigest.ts`
- Baseball card renderer update: `web/src/lib/email/render.ts`
- Admin UI error surfacing: `web/src/app/(protected)/dashboard/admin/email/page.tsx`
- Tests: `web/src/__tests__/editorial-payload-validation.test.ts` + updated `web/src/__tests__/gtm-3-editorial-and-newsletter-unsubscribe.test.ts`

**Quality Gates:**
- Lint: warnings only (pre-existing). `npm --prefix web run lint`
- Tests: PASS. `npm --prefix web test`
- Build: timed out after 120s. `npm --prefix web run build`

## Production Notes
### Migration Applied (MODE B)
Applied on 2026-02-05 via `psql` and recorded in `supabase_migrations.schema_migrations`.

Confirmed columns (from `\d digest_editorial`):
- `member_spotlight_ref` (text)
- `venue_spotlight_ref` (text)
- `blog_feature_ref` (text)
- `gallery_feature_ref` (text)
- `featured_happenings_refs` (text[])

### Vercel Build Verdict
Latest failed build logs (2026-01-29) show **Turbopack export errors**, not timeouts.
Last lines before failure:
- `Error: Turbopack build failed with 4 errors`
- Missing exports: `buildRecurrenceRuleFromOrdinals`, `parseOrdinalsFromRecurrenceRule` in `recurrenceContract.ts`

Current production deployments are **READY** (latest ready deploy 9h ago).

### Smoke Test Status
Pending manual admin smoke test:
1) Save with venue URL + featured happening URL
2) Preview cards (title → DSC detail, venue name → external fallback)

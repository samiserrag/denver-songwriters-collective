# GTM-3 Implementation Plan

## Approved Scope

**Part A**: Newsletter subscriber unsubscribe flow (infrastructure only — no digest sends to newsletter subscribers until GTM-4)
**Part B**: Editorial layer for weekly happenings digest only

**Constraints**: All changes additive. Preserve control hierarchy. Automation off by default. Default editorial week selector to next week's key.

---

## Part A — Newsletter Subscriber Unsubscribe Flow

### A1. Extend `unsubscribeToken.ts` with newsletter token functions

**File**: `web/src/lib/digest/unsubscribeToken.ts`

Add 3 new functions alongside existing member functions:
- `generateNewsletterUnsubscribeToken(email: string): string | null` — HMAC message: `${email}:unsubscribe_newsletter` (different from member format `${userId}:unsubscribe_digest`)
- `validateNewsletterUnsubscribeToken(email: string, token: string): boolean` — Same constant-time comparison pattern
- `buildNewsletterUnsubscribeUrl(email: string): string | null` — URL: `/api/newsletter/unsubscribe?email={email}&sig={token}`

Uses same `UNSUBSCRIBE_SECRET` env var. Different message format prevents cross-use between member and newsletter tokens.

### A2. New API endpoint: Newsletter unsubscribe

**File**: `web/src/app/api/newsletter/unsubscribe/route.ts` (NEW)

GET endpoint mirroring member unsubscribe pattern:
1. Extract `email` and `sig` from query params
2. Validate HMAC via `validateNewsletterUnsubscribeToken(email, sig)`
3. On valid: UPDATE `newsletter_subscribers` SET `unsubscribed_at = NOW()` WHERE `email = email` via service role client
4. Redirect to `/newsletter/unsubscribed?success=1`
5. On invalid: Redirect to `/newsletter/unsubscribed?error=invalid`
6. On DB error: Redirect to `/newsletter/unsubscribed?error=failed`

Idempotent — multiple clicks produce same result.

### A3. New confirmation page: Newsletter unsubscribed

**File**: `web/src/app/newsletter/unsubscribed/page.tsx` (NEW)

Public page mirroring member unsubscribed page pattern:
- Success: Warm community copy + link to homepage newsletter section for re-subscribe
- Error: Error messaging + link to homepage
- `robots: "noindex"` metadata
- Uses same theme tokens as member page

### A4. No changes to existing newsletter signup flow

The existing `/api/newsletter/route.ts` already handles re-subscribe by setting `unsubscribed_at: null` via upsert. No changes needed.

---

## Part B — Editorial Layer for Weekly Happenings Digest

### B1. Database migration: `digest_editorial` table

**File**: `supabase/migrations/YYYYMMDDHHMMSS_digest_editorial.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS public.digest_editorial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT NOT NULL,           -- e.g., '2026-W06'
  digest_type TEXT NOT NULL,        -- 'weekly_happenings' only for now
  subject_override TEXT,            -- Override default subject line
  intro_note TEXT,                  -- Personal editorial intro (rendered as HTML)
  featured_happening_ids UUID[],    -- Legacy event IDs (fallback only)
  member_spotlight_id UUID,         -- Legacy profile ID (fallback only)
  venue_spotlight_id UUID,          -- Legacy venue ID (fallback only)
  blog_feature_slug TEXT,           -- Legacy blog slug (fallback only)
  gallery_feature_slug TEXT,        -- Legacy gallery slug (fallback only)
  featured_happenings_refs TEXT[],  -- Canonical URL refs (preferred)
  member_spotlight_ref TEXT,        -- Canonical URL ref (preferred)
  venue_spotlight_ref TEXT,         -- Canonical URL ref (preferred)
  blog_feature_ref TEXT,            -- Canonical URL ref (preferred)
  gallery_feature_ref TEXT,         -- Canonical URL ref (preferred)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,                  -- Admin who edited
  UNIQUE (week_key, digest_type)
);

ALTER TABLE public.digest_editorial ENABLE ROW LEVEL SECURITY;
-- No policies = service role only access (same pattern as digest_settings)
```

### B2. Editorial CRUD helpers

**File**: `web/src/lib/digest/digestEditorial.ts` (NEW)

Functions (mirroring `digestSettings.ts` pattern):
- `getEditorial(weekKey: string, digestType: string): Promise<DigestEditorial | null>` — Fetch editorial for a week
- `upsertEditorial(weekKey: string, digestType: string, data: Partial<DigestEditorial>, updatedBy: string): Promise<void>` — Create or update editorial
- `deleteEditorial(weekKey: string, digestType: string): Promise<void>` — Remove editorial for a week
- `DigestEditorial` interface matching table schema

All use `createServiceRoleClient()`.

### B3. Admin editorial API routes

**File**: `web/src/app/api/admin/digest/editorial/route.ts` (NEW)

- `GET ?week_key=&digest_type=` — Fetch editorial for week (admin-only via `checkAdminRole()`)
- `PUT` body `{ weekKey, digestType, ...fields }` — Upsert editorial (admin-only, URL-only validation)
- `DELETE ?week_key=&digest_type=` — Delete editorial (admin-only)

### B4. Extend email template with editorial sections

**File**: `web/src/lib/email/templates/weeklyHappeningsDigest.ts` (MODIFY)

Extend `WeeklyHappeningsDigestParams` interface with optional editorial fields:
```typescript
subjectOverride?: string;
introNote?: string;
featuredHappenings?: Array<{ title: string; url: string; venue?: string; date?: string; time?: string; emoji?: string }>;
memberSpotlight?: { name: string; url: string; avatarUrl?: string; bio?: string };
venueSpotlight?: { name: string; url: string; coverUrl?: string; city?: string };
blogFeature?: { title: string; url: string; excerpt?: string };
galleryFeature?: { title: string; url: string; coverUrl?: string };
```

Rendering order in HTML:
1. Greeting (existing)
2. **`introNote`** — After greeting, before day-grouped list. Rendered as styled paragraph.
3. **`featuredHappenings`** — PINNED AT TOP before day-grouped list. Dedicated "Featured This Week" section with event cards.
4. Day-grouped happenings list (existing)
5. Summary line (existing)
6. **`memberSpotlight`** — After summary. "Member Spotlight" section with avatar + name + bio snippet.
7. **`venueSpotlight`** — After member spotlight. "Venue Spotlight" section with cover + name + city.
8. **`blogFeature`** — "From the Blog" section with title + excerpt + read link.
9. **`galleryFeature`** — "From the Gallery" section with cover + view link.
10. CTA + aspirational copy (existing)
11. Footer with unsubscribe (existing)

Subject line: Use `subjectOverride` if set, otherwise default.

All editorial sections are optional — email renders normally without them.

### B5. Extend cron handler to fetch editorial

**File**: `web/src/app/api/cron/weekly-happenings/route.ts` (MODIFY)

After fetching happenings data and recipients (line ~99), before lock claim:
1. Fetch editorial: `const editorial = await getEditorial(weekKey, "weekly_happenings");`
2. Prefer URL refs (`*_ref`, `featured_happenings_refs`) — parse URL, extract slug, resolve by slug
3. Fallback to legacy UUID/slug columns only if URL refs are missing
4. Pass all resolved editorial data to `buildEmail` callback

### B6. Extend preview API to include editorial

**File**: `web/src/app/api/admin/digest/preview/route.ts` (MODIFY)

When generating preview (dryRun mode):
1. Fetch editorial for the preview week key
2. Resolve all editorial references (same logic as B5)
3. Pass to template for rendering in preview

### B7. Extend send API to include editorial

**File**: `web/src/app/api/admin/digest/send/route.ts` (MODIFY)

When sending (test/full mode):
1. Fetch editorial for the computed week key
2. Resolve all editorial references
3. Pass to `sendDigestEmails()` `buildEmail` callback

### B8. Admin UI: Editorial editor section

**File**: `web/src/app/(protected)/dashboard/admin/email/page.tsx` (MODIFY)

Add new section between digest settings cards and send history:

**"Editorial Content"** section with:
- Week selector: dropdown defaulting to NEXT week's key (computed via `computeWeekKey()` + 1 week)
- Digest type: locked to "weekly_happenings" (only supported type)
- Subject override: text input (placeholder shows default subject)
- Intro note: textarea for personal editorial
- Featured happenings: URL list (one URL per line), `featured_happenings_refs`
- Member spotlight: URL input (`member_spotlight_ref`)
- Venue spotlight: URL input (`venue_spotlight_ref`)
- Blog feature: URL input (`blog_feature_ref`)
- Gallery feature: URL input (`gallery_feature_ref`)
- Save button: upserts editorial via PUT API
- Clear button: deletes editorial via DELETE API
- Status indicator: shows whether editorial exists for selected week

---

## Testing

### New test file: `__tests__/gtm-3-newsletter-unsubscribe.test.ts`

Tests for Part A:
- Newsletter token generation uses different HMAC message format than member tokens
- Newsletter token validation (valid/invalid/wrong email)
- Cross-use prevention (member token invalid for newsletter, vice versa)
- `buildNewsletterUnsubscribeUrl()` URL format
- Unsubscribe endpoint redirects on success/failure

### New test file: `__tests__/gtm-3-editorial-layer.test.ts`

Tests for Part B:
- Editorial template rendering with all sections
- Editorial template rendering with no editorial (unchanged behavior)
- Editorial template rendering with partial sections
- Featured happenings pinned at top (before day-grouped list)
- Subject override replaces default
- `computeWeekKey()` + 1 week for default selector

---

## Quality Gates

After implementation:
1. `cd web && npm run lint` — 0 errors, 0 warnings
2. `cd web && npm run test -- --run` — All passing
3. `cd web && npm run build` — Success

---

## Migration Application

Migration must be applied BEFORE pushing to main. Follow MODE A or MODE B per CLAUDE.md migration rules.

---

## Files Summary

### New files (8):
1. `supabase/migrations/YYYYMMDDHHMMSS_digest_editorial.sql`
2. `web/src/lib/digest/digestEditorial.ts`
3. `web/src/app/api/admin/digest/editorial/route.ts`
4. `web/src/app/api/newsletter/unsubscribe/route.ts`
5. `web/src/app/newsletter/unsubscribed/page.tsx`
6. `web/src/__tests__/gtm-3-newsletter-unsubscribe.test.ts`
7. `web/src/__tests__/gtm-3-editorial-layer.test.ts`

### Modified files (6):
1. `web/src/lib/digest/unsubscribeToken.ts` — Add newsletter token functions
2. `web/src/lib/email/templates/weeklyHappeningsDigest.ts` — Editorial sections in template
3. `web/src/app/api/cron/weekly-happenings/route.ts` — Fetch editorial before send
4. `web/src/app/api/admin/digest/preview/route.ts` — Include editorial in preview
5. `web/src/app/api/admin/digest/send/route.ts` — Include editorial in send
6. `web/src/app/(protected)/dashboard/admin/email/page.tsx` — Editorial editor UI

### Non-changes (intentional):
- No changes to newsletter signup flow (`/api/newsletter/route.ts`)
- No changes to open mics digest template or cron
- No changes to member unsubscribe flow
- No changes to digest_settings or digest_send_log tables
- No new env vars required (reuses `UNSUBSCRIBE_SECRET`)
- Automation remains off by default

---

## Rollback Plan

**Part A**: Delete newsletter unsubscribe endpoint and confirmation page. Remove newsletter functions from unsubscribeToken.ts. No DB rollback needed (no schema changes for Part A).

**Part B**: Set editorial to empty/null for any week. Template renders normally without editorial data. Migration is additive-only (table can remain unused). Remove editorial UI section from admin page if needed.

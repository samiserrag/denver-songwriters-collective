# Happenings Saved Filters + Weekly Digest Personalization Stop-Gate

**Status:** EXECUTED - VERIFIED - READY FOR ROLLOUT  
**Date:** March 1, 2026  
**Owner:** Repo Agent  
**Scope:** Account-saved happenings filters, recall behavior on `/happenings`, and weekly digest personalization while preserving custom email headers.

## Execution Addendum (March 1, 2026)

Approved amendments were implemented end-to-end:
1. Client-side recall in `HappeningsFilters` (no SSR auth regression on public `/happenings`).
2. Digest dual-gate enforcement: `email_enabled AND email_digests`.
3. Zero-result digest behavior: skip send + log line.
4. `csc` excluded from digest personalization filter keys.
5. Feature flag added: `DIGEST_PERSONALIZATION_ENABLED` (default OFF).
6. Phased execution completed (migration/helpers -> gating fix -> UI -> personalization).

### Implemented Surfaces

- Migration + RLS:
  - `supabase/migrations/20260301143000_happenings_saved_filters.sql`
- Saved filter helpers + sanitization:
  - `web/src/lib/happenings/savedFilters.ts`
  - `web/src/lib/happenings/index.ts`
- Happenings client recall + saved-filter UX:
  - `web/src/components/happenings/HappeningsFilters.tsx`
- Dashboard saved-filter management UX:
  - `web/src/app/(protected)/dashboard/settings/page.tsx`
- Digest gating + personalization:
  - `web/src/lib/digest/weeklyHappenings.ts`
  - `web/src/lib/digest/weeklyOpenMics.ts`
  - `web/src/app/api/cron/weekly-happenings/route.ts`
  - `web/src/app/api/admin/digest/send/route.ts`
  - `web/src/app/api/admin/digest/preview/route.ts`
- Feature flag:
  - `web/src/lib/featureFlags.ts`
- Tests:
  - `web/src/__tests__/weekly-happenings-personalization.test.ts`
  - `web/src/app/api/admin/digest/send/route.test.ts`

### UX Addendum (non-technical users)

To reduce clutter at the top of `/happenings`, saved filters were refactored into a compact, collapsible row:
- Summary chip + quick apply button.
- Expandable panel for save/apply/reset and recall mode (`One-click Apply` / `Auto-open`).
- Link to full settings for advanced management.

Dashboard settings were reorganized into explicit steps:
1. Choose what to save
2. Set location
3. Choose recall method

All options remain available on both surfaces, with clearer copy and mobile-safe layout.

### Live DB Verification Gates (production evidence)

All five gates completed with PASS:
1. Migration registration: `20260301143000` present in `supabase_migrations.schema_migrations`.
2. Table schema: columns, PK/FK cascade, JSON object check, trigger, and RLS all match migration.
3. Policies: 5 expected policies present (user own-row CRUD + admin read-all).
4. RLS smoke tests: own-row access pass, cross-user denied, anon denied (transactional rollback).
5. Digest preference columns: `notification_preferences.email_enabled` and `email_digests` confirmed.

Note: migration was already applied to production schema before migration history registration; version was backfilled into `schema_migrations`.

## Request Summary

Users want:
1. Saved filters on their account.
2. Saved filters applied on the Happenings page (auto-recall or one-click recall).
3. Weekly digest emails to honor those same saved filters.
4. Custom email header behavior preserved as top priority.

## Evidence Snapshot

### 1) Happenings filters are URL-driven only (no account persistence)

- `web/src/app/happenings/page.tsx:69-103` parses filters from `searchParams` only.
- `web/src/components/happenings/HappeningsFilters.tsx:228-250` updates URL params with `router.push`.
- `web/src/components/happenings/HappeningsFilters.tsx:274-280` `clearAll()` resets to `/happenings`.

There is currently no account-level saved filter read/write in the happenings surface.

### 2) Weekly happenings digest is not personalized

- `web/src/lib/digest/weeklyHappenings.ts:297-301` docs still describe global recipient gating only.
- `web/src/lib/email/templates/weeklyHappeningsDigest.ts:594` says "with your filters applied", but links to plain `/happenings` without user-specific params.
- Axiom runtime evidence (Feb 22, 2026, 23:00 UTC cron run) shows one global digest payload (`54 happenings across 49 venues`, `32 eligible recipients`) before idempotency skip.

### 3) Custom email header path is already stable and configurable

- `web/src/lib/email/render.ts:83-86` sets stable default header image source.
- `web/src/lib/email/mailer.ts:50-67` fetches `site_settings.email_header_image_url`.
- `web/src/lib/email/mailer.ts:131-137` injects configured header URL into outgoing HTML.
- `supabase/migrations/20260227004000_normalize_email_header_image_url.sql:1-12` normalizes header URL to a first-party stable asset.

Conclusion: current header pipeline is already compatible with personalization and should remain untouched.

### 4) Digest preference gate mismatch exists today

- Digest recipient selection uses `email_event_updates`:
  - `web/src/lib/digest/weeklyHappenings.ts:317-330`
  - `web/src/lib/digest/weeklyOpenMics.ts:310-323`
- One-click digest unsubscribe writes `email_digests=false`:
  - `web/src/app/api/digest/unsubscribe/route.ts:43-56`
- Granular digest preference exists in schema:
  - `supabase/migrations/20260224000000_split_event_updates_preferences.sql:7-11,17-20`
  - `web/src/lib/notifications/preferences.ts:127-129`

This mismatch means digest sends can ignore a user’s digest-specific opt-out.

### 5) Reusable location filter logic already exists

- `web/src/lib/happenings/locationFilter.ts:1-11` and `:157-205` provides zip/city/radius filtering and nearby expansion.

This can be reused for digest personalization to keep behavior consistent with `/happenings`.

## Architecture Options

### Option A: Cookie-only saved filters

**Pros**
- Fast to implement for browser recall.

**Cons (blocking)**
- Cannot drive weekly digest personalization (cron runs server-side with no browser cookie).
- Not account-level/cross-device.
- Violates one-truth principle by coupling personalization to browser storage only.

**Verdict:** Not acceptable for requested outcome.

### Option B: Account-level saved filters in DB (recommended)

**Pros**
- Works for both `/happenings` recall and weekly digest personalization.
- Cross-device and account-scoped.
- Compatible with current header pipeline.
- Can support both modes:
  - `auto_apply` (automatic recall when visiting `/happenings` without explicit params)
  - one-click `apply_saved` on filter bar.

**Cons**
- Requires migration + UI + digest filtering updates.

### Option C: Hybrid DB + cookie mirror

**Pros**
- Optional fast-path for client-side recall UX.

**Cons**
- Two sources of truth unless tightly constrained.
- Extra invalidation/sync complexity.

**Verdict:** Only reasonable if cookie is strictly a cache of DB state, not canonical.

## Recommended Design

## 1) Data model

Create a dedicated table (separate from `notification_preferences`) for content preferences:

- `public.happenings_saved_filters`
  - `user_id uuid primary key references profiles(id) on delete cascade`
  - `auto_apply boolean not null default true`
  - `filters jsonb not null default '{}'::jsonb`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

`filters` should only accept sanitized keys used by both surfaces:
- `type`, `csc`, `days`, `cost`, `city`, `zip`, `radius`

Recommended exclusions for digest correctness:
- Exclude `q`, `pastOffset`, `showCancelled`, `view`, `debugDates`.
- Treat `time` as upcoming for digest.

Why separate table:
- Keeps delivery toggles (`notification_preferences`) separate from content selection.
- Avoids bloating existing notification RPC and reducing clarity.

## 2) Happenings recall behavior

On server render of `/happenings`:
1. If request already has explicit filter params, honor URL and do not auto-apply saved filters.
2. If no explicit params and user has saved filters with `auto_apply=true`, redirect to `/happenings?<savedFilters>`.
3. If `auto_apply=false`, render normally and expose one-click "Apply Saved Filters" in UI.

In `HappeningsFilters` UI:
- Add actions:
  - `Save current filters`
  - `Apply saved filters`
  - `Reset saved filters`
- Keep existing URL-driven behavior intact.

## 3) Dashboard controls

In `web/src/app/(protected)/dashboard/settings/page.tsx`:
- Add section `Saved Happenings Filters`.
- Controls:
  - same filter subset (type/csc/days/cost/city/zip/radius),
  - `Auto-apply on /happenings` toggle,
  - save/reset actions.

## 4) Weekly digest personalization

For `weekly_happenings` send:
1. Build base occurrence pool once (existing `getUpcomingHappenings` behavior).
2. Fetch recipients plus saved filters.
3. Filter per recipient in-memory using same semantics as happenings filters.
4. Generate per-recipient digest payload.
5. Preserve template + mailer header pipeline unchanged.

## 5) Correctness fix bundled with this tract

Switch digest recipient gating from `email_event_updates` to `email_digests` in:
- `web/src/lib/digest/weeklyHappenings.ts`
- `web/src/lib/digest/weeklyOpenMics.ts`

This must be in-scope due unsubscribe and settings expectations.

## Risks and Coupling Critique

1. **Risk:** Digest opt-out mismatch persists (blocking correctness)  
   **Evidence:** recipient selection uses `email_event_updates` while unsubscribe writes `email_digests` (`weeklyHappenings.ts:317-330`, `unsubscribe/route.ts:43-56`).  
   **Impact:** users can unsubscribe and still receive digest emails.  
   **Severity:** blocking correctness.

2. **Risk:** Auto-apply can surprise users arriving from external links  
   **Evidence:** `/happenings` currently always respects URL-only state (`page.tsx:69-103`).  
   **Impact:** hidden redirect behavior could override intended entry context if not guarded.  
   **Mitigation:** only auto-apply when no explicit filter params are present.  
   **Severity:** non-blocking correctness.

3. **Risk:** Cookie-only approach cannot satisfy digest requirement  
   **Evidence:** digest generation runs in cron/admin server paths with no browser context (`api/cron/weekly-happenings/route.ts`).  
   **Impact:** weekly email cannot be personalized by browser cookie.  
   **Severity:** blocking correctness.

4. **Risk:** Divergence between happenings and digest filter semantics  
   **Evidence:** happenings uses shared location utility with zip/city/radius logic (`locationFilter.ts`).  
   **Impact:** users see one result set in app and different set in email.  
   **Mitigation:** reuse same sanitization + location filter logic for digest personalization path.  
   **Severity:** non-blocking correctness.

## Migration and Rollback

### Migration
1. Add `happenings_saved_filters` table + RLS policies.
2. Add select/update helper(s) and API/server helper paths.
3. Integrate UI actions in `/happenings` and `/dashboard/settings`.
4. Integrate weekly happenings personalization.
5. Correct recipient gating (`email_digests`) in both digest pipelines.

### Rollback
1. Disable personalization via feature flag (recommended for rollout).
2. Fall back to existing global digest payload and URL-only happenings filters.
3. Keep table in place (non-destructive rollback) or drop in a follow-up migration if explicitly required.

## Test Coverage Required

1. Unit tests: saved-filter sanitization and URL encoding/decoding.
2. Server tests: `/happenings` auto-apply redirect only when query is empty.
3. UI tests: save/apply/reset flows from filter bar + dashboard settings section.
4. Digest tests: per-recipient filtering behavior and empty-state rendering.
5. Preference tests: `email_digests` gating enforced for both open mics and happenings.
6. Regression: email header remains sourced from configured `site_settings.email_header_image_url`.

## Open Product Decisions Needed

1. Default mode after save: `auto_apply=true` or one-click only?
2. Should saved filters include `csc` and `time`, or keep digest strictly upcoming?
3. If a recipient’s filters yield zero events, should digest still send with "no matches" copy or skip send?

## Recommendation

Proceed with **Option B** (account-level DB persistence), include both recall modes, and treat cookie as optional UI cache only if needed later.  
Do **not** use cookie as primary storage because it cannot satisfy weekly digest personalization.

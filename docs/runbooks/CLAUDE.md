# Docs Memory: Operational Reference

This file holds reference material that is useful during investigations and execution but not always needed in global context.

## Key File Locations

| Purpose | Path |
|---------|------|
| Supabase server client | `web/src/lib/supabase/server.ts` |
| Supabase browser client | `web/src/lib/supabase/client.ts` |
| Service role client | `web/src/lib/supabase/serviceRoleClient.ts` |
| Database types | `web/src/lib/supabase/database.types.ts` |
| Admin auth helper | `web/src/lib/auth/adminAuth.ts` |
| Theme presets | `web/src/app/themes/presets.css` |
| Global styles | `web/src/app/globals.css` |
| Next.js config | `next.config.ts` |

### Key Components

| Component | Path |
|-----------|------|
| HappeningCard (unified) | `web/src/components/happenings/HappeningCard.tsx` |
| DateJumpControl | `web/src/components/happenings/DateJumpControl.tsx` |
| DatePillRow | `web/src/components/happenings/DatePillRow.tsx` |
| StickyControls | `web/src/components/happenings/StickyControls.tsx` |
| DateSection | `web/src/components/happenings/DateSection.tsx` |
| BetaBanner | `web/src/components/happenings/BetaBanner.tsx` |
| BackToTop | `web/src/components/happenings/BackToTop.tsx` |
| PosterMedia | `web/src/components/media/PosterMedia.tsx` |
| Header nav | `web/src/components/navigation/header.tsx` |
| Footer | `web/src/components/navigation/footer.tsx` |
| Event form | `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` |
| VenueSelector | `web/src/components/ui/VenueSelector.tsx` |
| Next occurrence logic | `web/src/lib/events/nextOccurrence.ts` |
| Recurrence contract | `web/src/lib/events/recurrenceContract.ts` |
| Recurrence canonicalization | `web/src/lib/events/recurrenceCanonicalization.ts` |
| Form date helpers | `web/src/lib/events/formDateHelpers.ts` |
| CommentThread (shared) | `web/src/components/comments/CommentThread.tsx` |
| ProfileComments | `web/src/components/comments/ProfileComments.tsx` |
| GalleryComments | `web/src/components/gallery/GalleryComments.tsx` |
| BlogComments | `web/src/components/blog/BlogComments.tsx` |
| OccurrenceEditor (host) | `web/src/app/(protected)/dashboard/my-events/[id]/overrides/_components/OccurrenceEditor.tsx` |
| SeriesEditingNotice | `web/src/components/events/SeriesEditingNotice.tsx` |

### Key Pages

| Route | Path |
|-------|------|
| Happenings | `web/src/app/happenings/page.tsx` |
| Open mic detail | `web/src/app/open-mics/[slug]/page.tsx` |
| Event detail | `web/src/app/events/[id]/page.tsx` |
| Dashboard | `web/src/app/(protected)/dashboard/` |
| Admin | `web/src/app/(protected)/dashboard/admin/` |
| Songwriter profile | `web/src/app/songwriters/[id]/page.tsx` |
| Studio profile | `web/src/app/studios/[id]/page.tsx` |
| Host occurrence editor | `web/src/app/(protected)/dashboard/my-events/[id]/overrides/page.tsx` |
| Per-date edit | `web/src/app/(protected)/dashboard/my-events/[id]/overrides/[dateKey]/page.tsx` |

### Cron Jobs

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/weekly-open-mics` | `0 3 * * 0` (Sunday 3:00 UTC) | Weekly Open Mics Digest email |
| `/api/cron/weekly-happenings` | `0 3 * * 0` (Sunday 3:00 UTC) | Weekly Happenings Digest email (ALL event types) |

**Cron Configuration:** `web/vercel.json`

**Control Hierarchy (GTM-2):**
1. **Env var kill switch** (emergency only): `ENABLE_WEEKLY_DIGEST=false` / `ENABLE_WEEKLY_HAPPENINGS_DIGEST=false` — blocks sending regardless of DB toggle
2. **DB toggle** (primary): `digest_settings` table — admin-controlled via `/dashboard/admin/email`
3. **Idempotency guard** (automatic): `digest_send_log` unique constraint prevents duplicate sends

**Key Files:**

| File | Purpose |
|------|---------|
| `lib/digest/weeklyOpenMics.ts` | Business logic for fetching open mics and building digest data |
| `lib/digest/weeklyHappenings.ts` | Business logic for fetching ALL happenings and building digest data |
| `lib/digest/digestSendLog.ts` | Idempotency guard: `computeWeekKey()`, `claimDigestSendLock()` |
| `lib/digest/digestSettings.ts` | DB toggle helpers: `isDigestEnabled()`, `getDigestSettings()`, `updateDigestSettings()` |
| `lib/digest/sendDigest.ts` | Shared send function with 3 modes: full, test, dryRun |
| `lib/digest/unsubscribeToken.ts` | HMAC-signed unsubscribe URL generation/validation |
| `lib/email/templates/weeklyOpenMicsDigest.ts` | Email template for weekly open mics digest |
| `lib/email/templates/weeklyHappeningsDigest.ts` | Email template for weekly happenings digest (ALL types) |
| `app/api/cron/weekly-open-mics/route.ts` | Cron endpoint handler for open mics digest |
| `app/api/cron/weekly-happenings/route.ts` | Cron endpoint handler for happenings digest |
| `app/api/digest/unsubscribe/route.ts` | One-click HMAC-signed unsubscribe endpoint |
| `app/api/admin/digest/settings/route.ts` | Admin digest toggle API |
| `app/api/admin/digest/send/route.ts` | Admin send (test/full) API |
| `app/api/admin/digest/preview/route.ts` | Admin preview API (dryRun) |
| `app/api/admin/digest/history/route.ts` | Admin send history API |
| `app/(protected)/dashboard/admin/email/page.tsx` | Admin Email Control Panel UI |
| `app/digest/unsubscribed/page.tsx` | Public unsubscribe confirmation page |
| `lib/digest/digestEditorial.ts` | Editorial CRUD helpers: `getEditorial()`, `upsertEditorial()`, `deleteEditorial()`, `resolveEditorial()` |
| `app/api/admin/digest/editorial/route.ts` | Admin editorial API (GET/PUT/DELETE) |
| `app/api/admin/digest/editorial/search-happenings/route.ts` | Search happenings for editorial featured events |
| `app/api/newsletter/route.ts` | Newsletter subscriber signup endpoint |
| `app/api/newsletter/unsubscribe/route.ts` | One-click newsletter unsubscribe (HMAC, no login) |
| `app/newsletter/unsubscribed/page.tsx` | Newsletter unsubscribe confirmation page |
| `lib/featureFlags.ts` | Env var kill switches (emergency only): `isWeeklyDigestEnabled()`, `isWeeklyHappeningsDigestEnabled()` |

**Cron Authentication:**
- Vercel Cron jobs include `authorization: Bearer ${CRON_SECRET}` header automatically
- Cron routes validate this header before processing

**Timezone Notes:**
- Cron schedule `0 3 * * 0` = Sunday 3:00 UTC
- MST (winter): 8:00 PM Saturday Denver time
- MDT (summer): 9:00 PM Saturday Denver time
- Digest covers Sunday through Saturday (7-day window)

---


## Test Files

All tests live in `web/src/` and run via `npm run test -- --run`.

| File | Tests |
|------|-------|
| `__tests__/card-variants.test.tsx` | Card variant behavior |
| `__tests__/navigation-links.test.ts` | Canonical route enforcement |
| `__tests__/happenings-filters.test.ts` | Filter logic |
| `lib/events/__tests__/nextOccurrence.test.ts` | Occurrence computation (61 tests) |
| `__tests__/utils/datetime.test.ts` | Datetime utilities |
| `components/__tests__/no-notes-leak.test.tsx` | Raw dump regression |
| `app/.../event-update-suggestions/page.test.tsx` | Suggestions page |
| `lib/guest-verification/*.test.ts` | Guest verification |
| `lib/email/email.test.ts` | Email templates |
| `app/api/guest/*.test.ts` | Guest API endpoints |
| `__tests__/gallery-photo-comments.test.ts` | Gallery photo comments |
| `__tests__/gallery-album-management.test.ts` | Album management (25 tests) |
| `__tests__/gallery-copy-freeze.test.ts` | Copy freeze (no approval/metrics language) |
| `__tests__/threaded-comments.test.ts` | Threaded comments + profile comments |
| `__tests__/gallery-comments-soft-delete-rls.test.ts` | Comment RLS policies |
| `__tests__/occurrence-overrides.test.ts` | Occurrence override model (17 tests) |
| `__tests__/signup-lane-detection.test.ts` | Signup lane detection + banner visibility (16 tests) |
| `__tests__/cancelled-ux-refinement.test.ts` | Cancelled disclosure behavior (9 tests) |
| `__tests__/verification-state.test.ts` | Verification state helper + detail page block (26 tests) |
| `__tests__/slug-routing.test.ts` | Slug routing + verification pills (15 tests) |
| `__tests__/series-creation-rls.test.ts` | Series creation RLS fix (11 tests) |
| `__tests__/recurrence-unification.test.ts` | Recurrence contract + label-generator consistency (24 tests) |
| `__tests__/event-creation-ux.test.ts` | Event creation UX, 404 fix, date helpers (43 tests) |
| `__tests__/venue-selector-phase445b.test.tsx` | Venue selector UX, authorization, dropdown order (17 tests) |
| `__tests__/phase4-46-join-signup-ux.test.tsx` | Join & Signup section, mini preview, custom location (13 tests) |
| `__tests__/phase4-49b-event-comments.test.ts` | Event comments everywhere, guest support, notifications (34 tests) |
| `__tests__/notification-icons.test.ts` | Distinct notification icons by type (14 tests) |
| `__tests__/notification-interactions.test.ts` | Notification controls: mark-on-click, mark-all, hide-read, deep-links (21 tests) |
| `__tests__/venue-page-fixes.test.ts` | Venue page count filters + de-duplication logic (17 tests) |
| `__tests__/edit-form-series-controls.test.ts` | Edit form ordinal parsing, recurrence rebuild, series mode detection, max_occurrences (59 tests) |
| `__tests__/phase4-98-host-cohost-equality.test.ts` | Host/cohost equality, auto-promotion, claim notifications (45 tests) |
| `__tests__/event-management-tabs.test.ts` | Event management tabs, per-occurrence filtering, guest display (30 tests) |
| `__tests__/phase5-14b-dashboard-and-rsvp-fixes.test.ts` | 3-tab dashboard, RSVP reactivation, tab UX (47 tests) |
| `lib/featureFlags.test.ts` | Feature flags |
| `__tests__/gtm-3-editorial-and-newsletter-unsubscribe.test.ts` | GTM-3: editorial layer, newsletter unsubscribe, token security, template rendering (130 tests) |

### Archived Tests

Legacy test suite archived at `docs/archived/tests-legacy-schema/`. These tests reference an older "Open Mic Drop" schema (`event_slots`, `performer_id`, etc.) incompatible with current DSC schema (`event_timeslots`, `timeslot_claims`, `member_id`).

**Do NOT run archived tests against current database.**

---

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
NEXT_PUBLIC_SITE_URL=
UNSUBSCRIBE_SECRET=          # GTM-2: HMAC key for signed unsubscribe URLs
```

---

**Last updated:** February 2026

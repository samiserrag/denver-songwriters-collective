# Denver Songwriters Collective — Repo Agent Context

> **All contributors and agents must read this file before making changes. This file supersedes README.md for operational context.**

> **For product philosophy, UX rules, and design decisions, see [PRODUCT_NORTH_STAR.md](./docs/PRODUCT_NORTH_STAR.md)**

This file contains **repo-specific operational knowledge** for agents working in this codebase.

---

## Project Overview

A community platform for Denver-area songwriters to discover open mics, connect with musicians, and stay informed about local music events.

**Live Site:** https://denversongwriterscollective.org  
**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + Auth + RLS), Vercel

---

## Commands

```bash
# Development
cd web && npm run dev

# Build
cd web && npm run build

# Lint
cd web && npm run lint

# Test
cd web && npm run test -- --run

# Full verification (required before merge)
cd web && npm run lint && npm run test -- --run && npm run build

# Generate Supabase types (after schema changes)
npx supabase gen types typescript --project-id oipozdbfxyskoscsgbfq > web/src/lib/supabase/database.types.ts

# Deploy
git add . && git commit -m "your message" && git push
```

---

## Quality Gates (Non-Negotiable)

All must pass before merge:

| Check | Requirement |
|-------|-------------|
| Lint | 0 errors, 0 warnings |
| Tests | All passing |
| Build | Success |

**Current Status (Phase 4.30):** Lint warnings = 0. All tests passing (533+). Intentional `<img>` uses (ReactCrop, blob URLs, markdown/user uploads) have documented eslint suppressions.

### Lighthouse Targets

| Metric | Target |
|--------|--------|
| Performance | ≥85 |
| Accessibility | ≥90 |
| TBT | ≤100ms |
| CLS | 0 |

---

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
| StickyControls | `web/src/components/happenings/StickyControls.tsx` |
| DateSection | `web/src/components/happenings/DateSection.tsx` |
| BetaBanner | `web/src/components/happenings/BetaBanner.tsx` |
| PosterMedia | `web/src/components/media/PosterMedia.tsx` |
| Header nav | `web/src/components/navigation/header.tsx` |
| Footer | `web/src/components/navigation/footer.tsx` |
| Event form | `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` |
| Next occurrence logic | `web/src/lib/events/nextOccurrence.ts` |
| CommentThread (shared) | `web/src/components/comments/CommentThread.tsx` |
| ProfileComments | `web/src/components/comments/ProfileComments.tsx` |
| GalleryComments | `web/src/components/gallery/GalleryComments.tsx` |
| BlogComments | `web/src/components/blog/BlogComments.tsx` |

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

---

## Routing Rules

### Canonical Listing Routes (Use These)

- `/happenings`
- `/happenings?type=open_mic`
- `/happenings?type=dsc`

### Forbidden in UI (Redirects Exist)

- `/open-mics` (listing) — **never link to this**
- `/events` (listing) — **never link to this**

### Valid Detail Routes

- `/open-mics/[slug]`
- `/events/[id]`

---

## Deploy Rules

### Supabase Migrations BEFORE Push

```bash
# 1. Check for pending migrations
npx supabase migration list

# 2. Apply migrations to remote
npx supabase db push

# 3. Verify schema change
cd web && source .env.local && psql "$DATABASE_URL" -c "\d table_name"

# 4. THEN push to main
git push origin main
```

**Rule:** If migration files were added, do NOT push to `main` until `npx supabase db push` succeeds.

---

## Build Notes

- Protected pages using `supabase.auth.getSession()` require `export const dynamic = "force-dynamic"`
- Vercel auto-deploys from `main` branch
- All CSS colors should use theme tokens (no hardcoded hex in components)

---

## Agent Behavior Rules

1. **Follow prompts exactly** — no improvisation unless asked
2. **Report and stop** when instructions complete or blocked
3. **Reality beats reasoning** — verify in browser, not just code
4. **One change = one contract** — no mixed refactors
5. **Update this file** after every push to main

---

## Locked Layout Rules (v2.0)

These layout decisions are **locked** and must not be changed without explicit approval:

### HappeningCard Layout

| Element | Locked Value |
|---------|--------------|
| Card structure | Vertical poster card (not horizontal row) |
| Poster aspect | 3:2 (`aspect-[3/2]`) |
| Surface class | `card-spotlight` |
| Grid layout | 1 col mobile, 2 col md, 3 col lg |
| Poster hover | `scale-[1.02]` zoom |
| Past event opacity | `opacity-70` |
| Font minimum | 14px in discovery views |

### Chip Styling

| Element | Locked Value |
|---------|--------------|
| Base classes | `px-2 py-0.5 text-sm font-medium rounded-full border` |
| Missing details | Warning badge (amber), not underlined link |

### Forbidden Changes

- Do NOT revert to horizontal/list layouts
- Do NOT use `text-xs` for chips (14px minimum)
- Do NOT add social proof ("X going", popularity counts)
- Do NOT use hardcoded colors (must use theme tokens)

---

## Documentation Hierarchy & Reading Order

**Required reading order for agents:**
1. `CLAUDE.md` (this file) — Repo operations
2. `docs/PRODUCT_NORTH_STAR.md` — Philosophy & UX laws
3. `docs/CONTRACTS.md` — Enforceable UI/data contracts
4. `docs/theme-system.md` — Tokens & visual system

| Document | Purpose | Authority |
|----------|---------|-----------|
| `docs/PRODUCT_NORTH_STAR.md` | Philosophy & UX laws | Wins on philosophy |
| `docs/CONTRACTS.md` | Enforceable UI behavior | Wins on testable rules |
| `docs/theme-system.md` | Tokens & surfaces | Wins on styling |
| `CLAUDE.md` | Repo operations | Wins on workflow |

If something conflicts, resolve explicitly—silent drift is not allowed.

---

## Recent Changes

---

### Gallery + Comments Track — CLOSED (Phase 4.30, January 2026)

> **Track Closed: 2026-01-01**
>
> This track is complete. All features shipped, tests passing, docs updated.

**Features Delivered:**

- **Album-first gallery architecture** — Photos belong to albums; no orphan uploads
- **Album visibility** — `is_published` + `is_hidden` (never `is_approved` in user-facing queries)
- **Photo/album comments** — `gallery_photo_comments` and `gallery_album_comments` tables
- **Threaded comments (1-level)** — `parent_id` references on all comment tables
- **Owner moderation** — `is_hidden` / `hidden_by` columns; entity owner + admin can hide
- **Soft-delete by author** — `is_deleted` column; author/admin can soft-delete own comments
- **Profile comments** — New `profile_comments` table for songwriter/studio profiles
- **Shared CommentThread component** — Reusable component for all comment surfaces
- **Weekly digest with kill switch** — `ENABLE_WEEKLY_DIGEST` env var
- **Copy freeze guardrails** — No approval/metrics/urgency language in user-facing copy

**Database Migration:**

- `supabase/migrations/20260101100000_threaded_comments_and_profile_comments.sql`
- Additive-only (safe rollout): all `ADD COLUMN IF NOT EXISTS` with defaults
- New table: `profile_comments` with RLS policies

**Test Coverage (39+ tests added):**

| Test File | Coverage |
|-----------|----------|
| `__tests__/threaded-comments.test.ts` | Threading, moderation, profile comments |
| `__tests__/gallery-photo-comments.test.ts` | Comments-as-likes model, no gamification |
| `__tests__/gallery-copy-freeze.test.ts` | No approval/metrics/urgency language |
| `__tests__/gallery-comments-soft-delete-rls.test.ts` | RLS policy coverage |

**Key Components:**

| Component | Path |
|-----------|------|
| CommentThread | `web/src/components/comments/CommentThread.tsx` |
| ProfileComments | `web/src/components/comments/ProfileComments.tsx` |
| GalleryComments | `web/src/components/gallery/GalleryComments.tsx` |
| BlogComments | `web/src/components/blog/BlogComments.tsx` |

**Investigation Doc:** `docs/investigation/comments-phase3-threading.md`

---

### v2.0 Visual System (December 2025)

Scan-first, image-forward card design. See PRODUCT_NORTH_STAR.md v2.0.

**Phase 4.6 Premium Card Polish:**
- `card-spotlight` surface (MemberCard recipe)
- Shadow token stack (`--shadow-card`, `--shadow-card-hover`)
- Poster zoom on hover (`scale-[1.02]`)
- MemberCard pill-style chips
- "Missing details" as warning badge

**Phase 4.5 Vertical PosterCard:**
- Vertical layout (poster top, content bottom)
- 4:3 aspect ratio poster media
- Responsive grid (1 col / 2 col / 3 col)
- 3-tier image rendering (card → blurred → placeholder)

**Phase 4.3-4.4 Readability:**
- Typography fixes (14px minimum)
- Sunrise theme contrast fixes
- TONIGHT/TOMORROW temporal emphasis

**Phase 4.14-4.16 Lint Cleanup:**
- Lint warnings: 29 → 0
- `next/image` conversions for public avatars, thumbnails, HappeningCard
- Documented eslint suppressions for intentional `<img>` (ReactCrop, blob URLs, user uploads)

**Phase 4.18 Recurrence Expansion + Date Jump:**
- Multi-ordinal recurrence support ("2nd/3rd", "1st & 3rd", `BYDAY=1TH,3TH`)
- 90-day rolling window occurrence expansion
- Weekly events show all future occurrences (~13 entries)
- Monthly ordinal events show 3-4 occurrences per window
- DateJumpControl for jumping to specific dates
- "Schedule unknown" section for uncomputable events
- Beta warning banner prominent at top of /happenings

**Phase 4.19 Happenings UX Pass:**
- DateJumpControl presets: Today, Tomorrow, This Weekend, Pick a date
- Synchronized Month/Day/Year dropdowns with 90-day window constraint
- Denser cards: 3:2 aspect ratio (was 4:3), reduced padding/spacing
- StickyControls wrapper with backdrop blur (sticks below nav)
- DateSection with collapsible date groups (chevron toggle)
- BetaBanner dismissible per session (localStorage)
- Results summary: event/date counts with filter breakdown

**Phase 4.20 Gallery UX Final Lock (December 2025):**
- Explicit Publish/Unpublish button for draft albums (discoverability fix)
- "New album" button moved below dropdown to prevent overlap
- Inline status feedback (no toasts) for publish/unpublish actions
- Empty-state guidance for albums without photos
- Owner context for "Hidden by admin" status badge
- Bulk comment moderation (hide/unhide all) in AlbumManager
- Admin audit trail logging (`lib/audit/moderationAudit.ts`)
- Weekly digest kill switch via `ENABLE_WEEKLY_DIGEST` env var
- Copy freeze tests (no approval/metrics/urgency language in user-facing copy)
- **Bug fix:** Album detail page now shows images for new albums (query mismatch fix)
  - Was filtering by `is_approved=true`, now uses `is_published/is_hidden` to match gallery listing

### Key Gallery Components

| Component | Path |
|-----------|------|
| AlbumManager | `web/src/app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx` |
| UserGalleryUpload | `web/src/app/(protected)/dashboard/gallery/UserGalleryUpload.tsx` |
| Gallery listing | `web/src/app/gallery/page.tsx` |
| Album detail | `web/src/app/gallery/[slug]/page.tsx` |
| Moderation audit | `web/src/lib/audit/moderationAudit.ts` |
| Feature flags | `web/src/lib/featureFlags.ts` |

### Logging System (December 2025)
- Admin logs at `/dashboard/admin/logs`
- Error boundaries wired to appLogger
- Server + client logging support

---

## Deferred Backlog

See full backlog in previous CLAUDE.md version or `docs/known-issues.md`.

### P1 (Fix Soon)
- API rate limiting missing
- 53 unnecessary `as any` casts in profile page
- Empty alt text on user avatars

### P2 (Nice to Fix)
- Typography token docs drift
- Loading.tsx coverage gaps
- Duplicate VenueSelector components

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
| `lib/featureFlags.test.ts` | Feature flags |

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
```

---

**Last updated:** January 2026

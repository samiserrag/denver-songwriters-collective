# Denver Songwriters Collective - Claude Context

## Project Overview

A community platform for Denver-area songwriters to discover open mics, connect with other musicians, book studio services, and stay informed about local music events.

**Live Site:** https://denver-songwriters-collective.vercel.app

> **Architecture Evolution (December 2025):** This project is being transformed into a **white-label community platform template**. See [docs/ARCHITECTURE_PLAN.md](./docs/ARCHITECTURE_PLAN.md) for the full roadmap covering theme system, brand configuration, and mobile app strategy.

## Documentation

The `docs/` folder contains reference documentation:

| Document | Purpose |
|----------|---------|
| [docs/ARCHITECTURE_PLAN.md](./docs/ARCHITECTURE_PLAN.md) | White-label platform roadmap |
| [docs/gallery.md](./docs/gallery.md) | Gallery feature documentation |
| [docs/stream-3-rsvp-flow.md](./docs/stream-3-rsvp-flow.md) | RSVP & Waitlist System documentation |
| [docs/copy-tone-guide.md](./docs/copy-tone-guide.md) | Site copy tone and voice guidelines |
| [docs/theme-system.md](./docs/theme-system.md) | Theme system style guide and CSS tokens |
| [docs/quality-gates.md](./docs/quality-gates.md) | Quality gates and CI/CD standards |
| [docs/known-issues.md](./docs/known-issues.md) | Known issues (non-blocking) |
| [docs/emails/EMAIL_INVENTORY.md](./docs/emails/EMAIL_INVENTORY.md) | Email template inventory and status |
| [docs/emails/EMAIL_STYLE_GUIDE.md](./docs/emails/EMAIL_STYLE_GUIDE.md) | Email voice, tone, and formatting |

**Subfolders:**
- `docs/emails/` — Email system documentation (inventory, style guide)
- `docs/future-specs/` — Unimplemented feature specs (Progressive Identity, White-Label MVP, etc.)
- `docs/completed/` — Old release notes and completed planning docs

## Project Structure

- **Repository:** `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective`
- **Branch:** `main`
- **Deployment:** Vercel auto-deploys from main

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Deployment:** Vercel
- **Auth:** Supabase Auth (email/password, magic links)
- **Future:** React Native/Expo for mobile app (shared codebase)

### Fonts & Typography (Tailwind CSS v4 + Next.js)

**IMPORTANT:** This project uses `next/font/google` with Tailwind CSS v4. There are specific patterns that MUST be followed for fonts to work correctly.

#### Font Variable Location
Font CSS variable classes MUST be on the `<html>` element, NOT the `<body>`:

```tsx
// layout.tsx - CORRECT
<html className={`${fraunces.variable} ${inter.variable} ${playfair.variable}`}>
  <body className="antialiased">

// WRONG - fonts won't resolve in @theme
<html>
  <body className={`${fraunces.variable} antialiased`}>
```

#### CSS Variable Chain
Next.js font variables (like `--font-fraunces`) contain only the generated font name (e.g., `__Fraunces_abc123`). To use them in Tailwind, create a full font-family variable in globals.css:

```css
@theme {
  /* Raw Next.js variable → Full font stack */
  --font-family-display: var(--font-fraunces), "Fraunces", Georgia, serif;
  --font-family-sans: var(--font-inter), "Inter", system-ui, sans-serif;

  /* Utility class aliases */
  --font-display: var(--font-family-display);
  --font-body: var(--font-family-sans);
}
```

#### Applying Fonts to Elements
Three ways to apply fonts (all work):

```tsx
// 1. Arbitrary value with full variable (RECOMMENDED for inline)
<nav className="font-[var(--font-family-display)]">

// 2. Utility class (if defined in @theme)
<span className="font-display">

// 3. Inherit from parent
<Link className="font-[inherit]">
```

#### Available Fonts
| Font | Variable | CSS Variable | Use Case |
|------|----------|--------------|----------|
| Fraunces | `--font-fraunces` | `--font-family-display` | Headlines, nav, display text |
| Inter | `--font-inter` | `--font-family-sans` | Body text, UI elements |
| Playfair Display | `--font-playfair` | `--font-family-serif` | Elegant headings |
| Geist Sans | `--font-geist-sans` | - | Monospace-adjacent UI |
| Geist Mono | `--font-geist-mono` | - | Code blocks |

## Database

- **Supabase Project ID:** `oipozdbfxyskoscsgbfq`
- **Migrations:** Located in `supabase/migrations/`

### IMPORTANT: Run All SQL Directly via CLI

**Claude MUST run all database operations directly. NEVER ask the user to run SQL in the Supabase Dashboard.**

#### 1. CRUD Operations (SELECT, INSERT, UPDATE, DELETE)

Run from the `web/` directory using Node.js with the Supabase JS client:

```javascript
cd /Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web && node -e "
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://oipozdbfxyskoscsgbfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcG96ZGJmeHlza29zY3NnYmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkyNTAxOSwiZXhwIjoyMDc5NTAxMDE5fQ.iSNMtMm9Nt5Vq-jnbJXVskL07M5fPGU-pJqe2aLHSjQ'
);

async function main() {
  // SELECT
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'admin');
  console.log(JSON.stringify(data, null, 2));

  // UPDATE
  const { data: updated } = await supabase
    .from('profiles')
    .update({ role: 'performer' })
    .eq('id', 'some-uuid')
    .select();
  console.log(updated);
}
main();
"
```

**To test what PUBLIC users see (respects RLS)**, use the anon key instead:
```javascript
const supabase = createClient(
  'https://oipozdbfxyskoscsgbfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pcG96ZGJmeHlza29zY3NnYmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjUwMTksImV4cCI6MjA3OTUwMTAxOX0.fCrizcRIuNIsutA48IWEcVeo0vwPQxTHloYKhNDMdO0'
);
```

#### 2. DDL Operations (CREATE TABLE, DROP POLICY, ALTER TABLE, etc.)

For schema changes and RLS policies, use `psql` with DATABASE_URL from `.env.local`:

```bash
cd /Users/samiserrag/Documents/GitHub/denver-songwriters-collective/web && source .env.local && psql "$DATABASE_URL" -c "
DROP POLICY IF EXISTS select_profiles ON profiles;
CREATE POLICY select_profiles ON profiles FOR SELECT USING (
  (role = 'performer')
  OR (is_songwriter = true OR is_studio = true OR is_fan = true OR is_host = true)
  OR (auth.uid() IS NOT NULL AND auth.uid() = id)
  OR is_admin()
);
"
```

**DATABASE_URL is configured in `.env.local`** - Claude can run all DDL directly via psql.

#### 3. Creating Migrations

Always create migration files for tracking, even if applying directly:

```bash
npx supabase migration new my_migration_name
# Then edit the file in supabase/migrations/
```

#### 4. Troubleshooting Migration History

If `npx supabase db push` fails due to history mismatch:
1. Check status: `npx supabase migration list`
2. Repair if needed: `npx supabase migration repair --status reverted <version>`
3. Or apply DDL directly via psql (see above)

**Key points:**
- Service role key bypasses RLS - use for admin operations
- Anon key respects RLS - use to test public visibility
- Always run from `web/` directory where node_modules is installed
- Create migration files for version control even when applying directly

### Key Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles with identity flags (`is_songwriter`, `is_studio`, `is_host`, `is_fan`) and role (`member`, `admin`) |
| `events` | All events including open mics, showcases, workshops |
| `venues` | Venue information with addresses and contact details |
| `blog_posts` | User-submitted blog posts (requires admin approval) |
| `gallery_images` | Community photo gallery (requires admin approval) |
| `gallery_albums` | Photo album collections |
| `change_reports` | Community-submitted event corrections |
| `event_rsvps` | Event RSVPs with waitlist and offer tracking |
| `event_timeslots` | Individual performance slots for timeslot-enabled events |
| `timeslot_claims` | Claims on timeslots (confirmed, waitlist, cancelled, etc.) |
| `event_lineup_state` | "Now playing" tracking for live events |
| `monthly_highlights` | Featured content for homepage |
| `host_requests` | Applications to become an event host |
| `approved_hosts` | Approved host permissions |
| `event_update_suggestions` | Community corrections for event data |
| `studio_services` | Services offered by studio profiles |
| `studio_appointments` | Bookings for studio services |
| `favorites` | User favorites (events, profiles) |
| `open_mic_comments` | Comments on open mic events |

## User Roles & Identity

### Role Field (Authorization)
- **member** - Default role for all users
- **admin** - Full access to admin dashboard, can approve content
- **super admin** - `sami.serrag@gmail.com` only - can promote/demote other admins

### Super Admin System
- **Super admin email:** `sami.serrag@gmail.com` (hardcoded in `web/src/lib/auth/adminAuth.ts`)
- **Capabilities:** Only super admin can promote users to admin or demote admins
- **UI Location:** `/dashboard/admin/users` - "Make Admin" / "Remove Admin" buttons
- **Key files:**
  - `web/src/lib/auth/adminAuth.ts` - `isSuperAdmin()` function, `SUPER_ADMIN_EMAIL` constant
  - `web/src/app/(protected)/dashboard/admin/users/actions.ts` - `toggleAdminRole()` server action
  - `web/src/components/admin/UserDirectoryTable.tsx` - Admin toggle UI

### Identity Flags (Self-Identification)
Users can select multiple identity flags during onboarding:
- **is_songwriter** - Musicians, singers, songwriters (formerly "performer")
- **is_studio** - Recording studios offering services
- **is_host** - Open mic hosts (requires admin approval to create events)
- **is_fan** - Music supporters and community members

> **Note:** The legacy `role` enum (`performer`, `host`, `studio`, `fan`) is being deprecated. New code should use the boolean identity flags instead.

## Features

### Public Pages
- `/` - Homepage with monthly highlights
- `/open-mics` - Open mic directory with map view
- `/open-mics/[slug]` - Individual open mic detail page
- `/events` - All events listing (DSC happenings, upcoming, past)
- `/events/[id]` - Individual DSC event detail page
- `/members` - Unified member directory (performers, studios, hosts, fans)
- `/performers` - Performer profiles (redirects to /members)
- `/studios` - Studio profiles (redirects to /members)
- `/blog` - Community blog
- `/gallery` - Photo gallery with albums
- `/gallery/[slug]` - Album detail page
- `/spotlight` - Featured members
- `/submit-open-mic` - Submit event corrections
- `/get-involved` - Volunteer opportunities

### Protected Pages (Auth Required)
- `/dashboard` - User dashboard
- `/dashboard/profile` - Edit profile
- `/dashboard/my-rsvps` - User's event RSVPs (upcoming, past, cancelled)
- `/dashboard/my-events` - Host's event management
- `/dashboard/blog` - User's blog posts
- `/dashboard/appointments` - Performer's studio bookings
- `/dashboard/studio-appointments` - Studio's incoming bookings
- `/dashboard/favorites` - Saved favorites

### Admin Pages
- `/dashboard/admin` - Admin overview
- `/dashboard/admin/events` - Manage all events
- `/dashboard/admin/open-mics` - Open mic status review queue (active/needs_verification/inactive)
- `/dashboard/admin/venues` - Manage venues
- `/dashboard/admin/users` - User management
- `/dashboard/admin/blog` - Approve/manage blog posts
- `/dashboard/admin/gallery` - Approve/manage gallery images and albums
- `/dashboard/admin/highlights` - Manage homepage highlights
- `/dashboard/admin/host-requests` - Approve host applications
- `/dashboard/admin/verifications` - Review community change reports
- `/dashboard/admin/event-update-suggestions` - Review community corrections
- `/dashboard/admin/newsletter` - View newsletter subscribers and export emails
- `/dashboard/admin/logs` - Application error logs and debugging

---

## Security Audit Status

### Completed (December 2025)

#### Phase 1: RLS Security
- [x] All 28 tables have RLS enabled
- [x] `is_admin()` function standardized as SECURITY DEFINER
- [x] **All functions calling `is_admin()` now use `public.is_admin()`** - Required for functions with `SET search_path = ''`
- [x] `open_mic_claims` table - Added missing RLS policies
- [x] `event_update_suggestions` - Tightened UPDATE/DELETE to admin-only
- [x] Anonymous role granted SELECT on public tables (events, venues, profiles, blog_posts, gallery_images, highlights, spotlights)

#### Phase 2: Service Role Implementation
- [x] Created `serviceRoleClient.ts` utility for admin operations
- [x] Updated all admin API routes to use service role client
- [x] Pattern: Authenticate user → Check admin role → Use service client
- [x] `SUPABASE_SERVICE_ROLE_KEY` added to Vercel env vars

#### Phase 3: Performance Indexes
- [x] Added indexes for frequently queried columns:
  - `events.slug`, `events.venue_id`
  - `open_mic_claims.event_id`, `profile_id`, `status`
  - `event_update_suggestions.status`, `created_at`
  - `blog_posts.tags` (GIN index)

#### Phase 4: Pre-Phase 1 Security Audit
- [x] No secrets exposed in source code
- [x] Proper env file hygiene (only `.env.test` tracked with local demo keys)
- [x] .gitignore protects production secrets
- [x] Supabase client separation (server vs browser)
- [x] No hardcoded credentials
- [x] Auth middleware validates JWT via `getUser()`
- [x] Security headers configured (CSP, X-Frame-Options, HSTS)
- [x] npm audit: 0 high/critical vulnerabilities

### Audit Queries Available

Run `20251212000002_supabase_configuration_audit.sql` in SQL Editor to verify:
- RLS status on all tables
- Policy definitions
- Function security modes
- Index coverage
- Foreign key constraints

---

## Known Issues / TODO

See [docs/known-issues.md](./docs/known-issues.md) for detailed tracking.

### High Priority
- [ ] Email notifications not implemented (RSVP confirmations, host approvals)
- [ ] Image optimization/CDN for gallery (currently direct Supabase storage)
- [ ] Progressive Identity System (guest email verification for slot claims without account)
  - Guest claim flow: name + email → 6-digit code → verified claim
  - Magic links for offer confirmation / cancellation
  - See [docs/future-specs/progressive-identity.md](./docs/future-specs/progressive-identity.md) for full details

### Medium Priority
- [ ] Search functionality across events/profiles
- [ ] Event recurrence handling (RRULE parsing for recurring events)
- [ ] Mobile app (React Native/Expo) - see docs/ARCHITECTURE_PLAN.md
- [ ] White-Label MVP ("Open Mic Manager" product) - host-focused lineup tool
  - Extract shared core from DSC (timeslots, claims, display)
  - Minimal UI, no profiles/blog/gallery
  - See docs/ARCHITECTURE_PLAN.md for full roadmap

### Pre-Launch Optimization (Completed December 2025)
- [x] Image optimization with `next/image` component on homepage (highlights, blog images, author avatars)
- [x] Dynamic SEO metadata for all detail pages via `generateMetadata`
- [x] OpenGraph/Twitter card metadata in root layout with default OG image
- [x] Iframe accessibility - descriptive `title` attributes on Spotify/YouTube embeds
- [x] Remote image patterns configured in `next.config.ts` for Supabase storage

### Critical LCP Performance Fix (December 2025)
- [x] **Fixed 16.0s LCP → target <2.5s** - Critical Lighthouse failure resolved
- [x] Added `font-display: swap` to all 4 Google Fonts
- [x] Replaced CSS `background-image` in HeroSection with Next.js `<Image priority>`
- [x] Created `LazyIframe` component using IntersectionObserver
- [x] Deferred Spotify/YouTube iframe loading until near viewport

### Remaining Pre-Launch Tasks
- [ ] Create `/public/images/og-image.jpg` (1200x630) for social sharing default

### Future Roadmap

These are broader product initiatives for post-launch development:

**Community Growth (Onboarding, Discovery, Retention)**
- [ ] Improved onboarding flow with guided tours
- [ ] Member discovery features (search, filters, recommendations)
- [ ] Engagement features (activity feeds, notifications, achievements)
- [ ] Retention mechanics (streaks, milestones, community badges)

**Host / Venue UX Improvements**
- [ ] Simplified event creation for recurring open mics
- [ ] Venue dashboard with analytics
- [ ] Host tools for managing regulars and slot preferences
- [ ] Venue claim and verification workflow

**Event Lifecycle Polish (Before / During / After)**
- [ ] Pre-event: reminder emails, calendar sync improvements
- [ ] During event: live check-in, real-time lineup updates
- [ ] Post-event: feedback collection, photo uploads, recaps

**Analytics & Feedback Loops**
- [ ] Event attendance tracking and trends
- [ ] Community health metrics dashboard
- [ ] User feedback collection and analysis
- [ ] Performance metrics for hosts/venues

**Mobile-First Refinements**
- [ ] Touch-optimized interactions
- [ ] Offline support for key features
- [ ] Push notifications
- [ ] Native app (React Native/Expo)

**Content Strategy**
- [ ] Editorial calendar for blog/community content
- [ ] User-generated content guidelines
- [ ] Community spotlight automation
- [ ] Newsletter content planning

---

## Planned (Post-Phase 2)

### Location fields + Members filtering (single PR)

**Goal:** Add zip_code migration + regenerate Supabase types + location UI in profile + location filters on Members page.

**Scope:**
- DB: ensure `profiles.zip_code` exists (text), optional indexes
- Types: regenerate `database.types.ts` after migration
- UI: profile page inputs for city/state/zip_code
- UI: members directory filters for city/state/zip_code

**Out of scope:**
- No Happenings/Open Mics changes
- No refactors

**Acceptance:**
- Profile location saves + persists
- Members filters work
- lint/test/build pass

---

## White-Label Architecture (In Progress)

**Status:** Planning complete, awaiting expert review before implementation

**Goal:** Transform this codebase into a reusable template that can be:
1. Re-themed for different brands via single config file
2. Deployed as both web and mobile app
3. Extended without forking

**Key Documents:**
- `docs/ARCHITECTURE_PLAN.md` - Full technical roadmap (ready for review)

**Planned Phases:**
1. **Theme System Foundation** - Centralize all colors, fonts, shadows into CSS variables
2. **Component Refactor** - Replace hardcoded Tailwind classes with theme references
3. **Brand Config System** - Externalize all brand-specific content (logo, copy, features)
4. **Build Tooling** - Environment-based brand/theme switching
5. **Mobile Foundation** - Monorepo setup, shared packages, Expo app
6. **Full Mobile Development** - Feature-complete iOS/Android apps

**Quick Theme Changes (Until Refactor):**
- `web/src/app/globals.css` - CSS variables (colors, fonts, shadows)
- `web/src/app/layout.tsx` - Font imports
- `web/src/components/layout/hero-section.tsx` - Hero image

---

## Recent Changes (December 2025)

### Header Navigation Fraunces Font Fix (December 2025)
- **Fraunces applied to header nav** - Desktop nav links now use `font-[var(--font-family-display)]`
- **Mobile menu typography** - Wordmark and nav links use Fraunces via `.font-display` class
- **Critical fix: Font variables on `<html>` element** - Moved font CSS variable classes from `<body>` to `<html>` for proper Tailwind v4 resolution
- **Scoped change** - Body text, buttons, form inputs remain unchanged (using Inter/Geist)
- **Root cause** - `font-[var(--font-fraunces)]` didn't work because `--font-fraunces` contains only the Next.js generated font name (like `__Fraunces_abc123`), not a full font-family value. The correct variable is `--font-family-display` which includes fallbacks.
- Key files:
  - `web/src/app/layout.tsx` - Font variable classes moved to `<html>` element
  - `web/src/components/navigation/header.tsx` - Uses `font-[var(--font-family-display)]`
  - `web/src/components/navigation/nav-link.tsx` - Uses `font-[inherit]` to inherit from parent nav
  - `web/src/components/navigation/mobile-menu.tsx` - Uses `.font-display` class

### UI Overhaul - Fraunces Font & Happenings Terminology (December 2025)
- **Fraunces display font added** - Playful, quirky Google Font for hero headlines replacing corporate-looking serif
- **Site name on homepage hero** - "Denver Songwriters Collective" now prominent on hero image
- **"Happenings" terminology** - All instances of "events" changed to "happenings" throughout the site
  - "See events" → "See happenings"
  - "Host an event" → "Host a happening"
  - "Upcoming Events" → "Upcoming Happenings"
  - Events page title → "Happenings"
- **Members page copy update** - "Our Members" → "Collective Members" with subtitle "Songwriters, event hosts, studios, promoters, and fans who make our community thrive"
- **Hero sections added** - Gallery, Blog, About, Contact pages now have HeroSection with background image
- **Page title updates** - "Gallery" → "Collective Gallery", "Blog" → "Collective Blog", "About Us" → "About the Collective"
- **CropModal lint fix** - Fixed eslint error (setState in useEffect → useMemo pattern)
- Key files:
  - `web/src/app/layout.tsx` - Added Fraunces font import
  - `web/src/app/globals.css` - Added `--font-family-display` CSS variable
  - `web/src/app/page.tsx` - Homepage hero with site name, happenings terminology
  - `web/src/app/events/page.tsx` - Happenings page with HeroSection
  - `web/src/app/gallery/page.tsx` - Collective Gallery with HeroSection
  - `web/src/app/blog/page.tsx` - Collective Blog with HeroSection
  - `web/src/app/about/page.tsx` - About the Collective with HeroSection
  - `web/src/app/contact/page.tsx` - Contact with HeroSection
  - `web/src/app/members/page.tsx` - Updated hero text
  - `web/src/components/gallery/CropModal.tsx` - Fixed lint error

### HeroSection Standardization & Mobile Overflow Fix (December 2025)
- **Text-free hero image** - New `/images/hero-bg.jpg` (sunset clouds without DSC text) used as default
- **HeroSection now defaults to hero image** - No need to specify `backgroundImage` prop; pass `null` for no image
- **Fixed mobile overflow** - Changed all fixed heights (`h-[...]`) to minimum heights (`min-h-[...]`) to prevent content clipping
- **Standardized all page heroes** - Converted 6 pages from custom inline heroes to use the shared `HeroSection` component:
  - `/` (homepage) - Content now inside hero with vignette
  - `/open-mics` - Uses `<HeroSection minHeight="sm">`
  - `/members` - Uses `<HeroSection minHeight="sm">`
  - `/performers` - Uses `<HeroSection minHeight="sm">`
  - `/studios` - Uses `<HeroSection minHeight="sm">`
  - `/spotlight` - Uses `<HeroSection minHeight="sm">`
- **Consistent styling** - All hero text is white with drop shadows; vignettes provide contrast
- Key files:
  - `web/public/images/hero-bg.jpg` - New text-free hero image
  - `web/src/components/layout/hero-section.tsx` - Default image, min-h fix
  - `web/src/app/page.tsx` - Homepage hero with content
  - `web/src/app/open-mics/page.tsx`, `web/src/app/members/page.tsx`, etc. - Converted to HeroSection

### Onboarding RLS Fix - is_admin() Schema Qualification (December 2025)
- **Root cause identified** - Functions with `SET search_path = ''` calling unqualified `is_admin()` failed because PostgreSQL couldn't resolve the function
- **Affected functions fixed** - All 3 functions that called `is_admin()` without schema prefix:
  - `prevent_role_change()` - Trigger on profiles table
  - `restrict_studio_service_updates()` - Trigger on studio_services table
  - `rpc_admin_set_showcase_lineup()` - RPC function for showcase events
- **Fix applied** - Changed `is_admin()` → `public.is_admin()` in all function bodies
- **Service role API route added** - `/api/onboarding` bypasses RLS entirely using service role client as belt-and-suspenders fix
- **PostgREST cache** - `NOTIFY pgrst, 'reload schema'` required after function changes
- Key files:
  - `web/src/app/api/onboarding/route.ts` - New API route using service role
  - `web/src/app/onboarding/profile/page.tsx` - Updated to use API route
- Database functions updated via psql (not migration files - applied directly to fix production)

### Profile Location & Member Filters Enhancement (December 2025)
- **City and state fields added to profiles** - New `city` and `state` columns for location-based member discovery
- **Profile edit UI** - Side-by-side city/state inputs in Basic Info section
- **Specialty filter with curated options** - Members page now filters by specialties using shared SPECIALTY_OPTIONS (16 items)
- **Active filter chips for all categories** - Genres, instruments, AND specialties now show as removable chips
- **Consolidated SPECIALTY_OPTIONS** - Profile page now uses shared options from `@/lib/profile/options.ts` instead of local copy
- **Case-insensitive filtering** - All filter matching (genres, instruments, specialties) is case-insensitive
- Key files:
  - `supabase/migrations/20251227002649_add_city_to_profiles.sql` - City column
  - `supabase/migrations/20251227003302_add_state_to_profiles.sql` - State column
  - `web/src/app/(protected)/dashboard/profile/page.tsx` - City/state UI, shared SPECIALTY_OPTIONS import
  - `web/src/components/members/MemberFilters.tsx` - Specialty filter, active chips for all categories
  - `web/src/lib/profile/options.ts` - Added SPECIALTY_OPTIONS constant

### Members Page Filters & Onboarding Fix (December 2025)
- **Members page filters now use identity flags** - Category tabs filter by `isSongwriter`, `isHost`, `isStudio`, `isFan` instead of legacy `role` field
- **Expanded search** - Search now covers name, bio, instruments[], genres[], specialties[] (all case-insensitive)
- **Identity flag mapping** - `mapDBProfileToMember()` now includes all identity flags from database
- **Onboarding "I'll finish this later" fix** - Button now saves name (if provided) and sets `onboarding_complete = true`
  - Root cause: Original `handleSkip` only set `onboarding_complete` but ignored name field
  - Added proper error handling and logging
- Key files:
  - `web/src/components/members/MemberFilters.tsx` - Identity-based filtering, expanded search
  - `web/src/app/members/page.tsx` - Added identity flag mapping
  - `web/src/app/onboarding/profile/page.tsx` - Fixed `handleSkip` to save name

### Signup Database Error Fix (December 2025)
- **Root cause** - `handle_new_user()` trigger used `'member'::user_role` but function has `search_path = ''` for security
- **Fix** - Changed to `'member'::public.user_role` with fully-qualified schema prefix
- Key file: `supabase/migrations/20251226233805_fix_handle_new_user_type_resolution.sql`

### Gallery QA Bug Fixes (December 2025)
- **File size validation** - 10MB limit enforced during upload with clear error messages
- **Duplicate slug handling** - Album creation auto-increments slug if already exists (e.g., `test-album-1`)
- **Assign unassigned photos to albums** - Click to select photos, choose album from dropdown, add
- **Hide empty albums from public gallery** - Albums with 0 approved photos filtered from `/gallery`
- **New albums start as draft** - Changed from `is_published: true` to `is_published: false` on create
- Key files:
  - `web/src/components/gallery/BulkUploadGrid.tsx` - File size validation
  - `web/src/app/(protected)/dashboard/admin/gallery/GalleryAdminTabs.tsx` - Slug handling, photo assignment
  - `web/src/app/gallery/page.tsx` - Empty album filtering

### Gallery Album Management & Upload Fix (December 2025)
- **CRITICAL FIX: Album assignment during upload** - Photos now assigned to album immediately during upload, not as separate step
  - Root cause: `uploadFile()` was inserting with `album_id: null`, requiring post-upload metadata step users missed
  - Solution: Moved metadata selection before drop zone, pass album_id/venue_id/event_id to INSERT
- **Album photo management** - New "Manage Photos" expandable section in Albums tab
  - Drag-to-reorder photos within albums using @dnd-kit
  - Inline caption editing with Enter to save, Escape to cancel
  - Remove from album (keeps photo) vs Delete photo (permanent)
  - Photo count badges on album cards
- **Unassigned photos section** - Bottom of Albums tab shows photos not in any album
  - Click to select, then assign to album via dropdown
- **Inline album editing** - Edit album name/description directly in album list
- **Tab reorder** - Albums tab now first (primary workflow), then All Photos, then Upload
- **Upload destination UI** - Clear visual showing which album photos will be uploaded to
- Key files:
  - `web/src/components/gallery/BulkUploadGrid.tsx` - Critical fix for album_id during upload
  - `web/src/components/gallery/AlbumPhotoManager.tsx` - New component for album photo management
  - `web/src/app/(protected)/dashboard/admin/gallery/GalleryAdminTabs.tsx` - Album management features
- Dependencies: Uses existing `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### Gallery Bulk Upload UX (December 2025)
- **BulkUploadGrid component** - Modern bulk upload experience for gallery photos
- **Drop zone with drag & drop** - Large inviting area to drag/drop or click to select multiple photos
- **Instant preview thumbnails** - Uses `URL.createObjectURL` for immediate local preview without uploading
- **Parallel uploads** - Uploads 3 files concurrently for speed
- **Progress tracking** - Overall progress bar + per-file status indicators (pending/uploading/uploaded/error)
- **Error handling** - Failed uploads show error message with Retry button
- **Memory cleanup** - Revokes object URLs on unmount to prevent memory leaks
- **Removed old sequential crop flow** - No longer requires cropping each photo one-by-one
- **Optional cropping** - Click crop icon on any pending thumbnail to adjust framing before upload
- **Drag-to-reorder** - Drag thumbnails by grip handle to reorder before uploading
- **Sort order persistence** - `sort_order` column added to `gallery_images` table, preserved during upload
- Key files:
  - `web/src/components/gallery/BulkUploadGrid.tsx` - Bulk upload with dnd-kit reordering
  - `web/src/components/gallery/CropModal.tsx` - Standalone crop modal component
  - `supabase/migrations/20251225022307_gallery_images_sort_order.sql` - Adds sort_order column
- Dependencies added: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### Admin User Deletion Fix (December 2025)
- **Root cause found** - Supabase `auth.admin.deleteUser()` does NOT cascade to profiles table
- **Explicit profile deletion** - Now deletes profile record explicitly before auth user
- **Optimistic UI update** - Deleted users immediately disappear from list client-side
- **Cache-busting** - Added `revalidate=0` and `fetchCache="force-no-store"` to admin users and members pages
- **Fixed orphaned profiles** - Manually cleaned up existing orphaned profile records
- Key files:
  - `web/src/app/(protected)/dashboard/admin/users/actions.ts` - Added explicit profile delete step
  - `web/src/components/admin/UserDirectoryTable.tsx` - Optimistic UI with deletedUserIds state
  - `web/src/app/(protected)/dashboard/admin/users/page.tsx` - Cache-busting exports
  - `web/src/app/members/page.tsx` - Cache-busting exports

### Admin Open Mic Status Management (December 2025)
- **New admin page** - `/dashboard/admin/open-mics` for managing open mic event status
- **Admin API endpoint** - `POST /api/admin/open-mics/:id/status` to update event status with audit trail
- **Status values whitelist** - `active`, `needs_verification`, `unverified`, `inactive`, `cancelled`
- **Audit notes** - All status changes append `[ADMIN_STATUS: set_to=<status> | at=<timestamp> | by=<admin_id>]` to event notes
- **Verification tracking** - Setting status to "active" updates `last_verified_at` and `verified_by`
- **Filter tabs** - All | Active | Needs Review | Inactive/Cancelled with count badges
- **Quick actions** - "Mark Active" and "Needs Review" buttons for fast status changes
- **Search** - Filter by venue name or title
- **Status legend** - Explains what each status means
- **Public page default filter** - Open Mic page now defaults to `status='active'` (was showing all)
- Key files:
  - `web/src/app/api/admin/open-mics/[id]/status/route.ts` - Admin API endpoint
  - `web/src/components/admin/OpenMicStatusTable.tsx` - Status management table component
  - `web/src/app/(protected)/dashboard/admin/open-mics/page.tsx` - Admin review queue page
  - `web/src/app/open-mics/page.tsx` - Default status filter changed to "active"

### Open Mic Page Title Update (December 2025)
- **Title change** - "Denver Open Mic Directory" → "Denver Area Open Mic Directory"
- Key file: `web/src/app/open-mics/page.tsx:371`

### Profile Form Identity Flag Safeguards (December 2025)
- **Race condition protection** - Form blocks submission if profile data hasn't fully loaded
- **Confirmation dialog** - Warning shown if user is about to clear all identity flags
- **Original state tracking** - Form remembers initial identity flags to detect accidental changes
- **Prevents accidental removal from Members directory** - Users warned before unchecking all identity options
- Key file: `web/src/app/(protected)/dashboard/profile/page.tsx` - Added `originalIdentity` state and validation

### Profile Page Redesign (December 2025)
- **Much larger avatars** - Added `xl` (192px) and `2xl` (256px) sizes to SongwriterAvatar component
- **Centered hero layout** - Profile pages now center-align the avatar and name in hero section
- **Auto-expanding hero** - Added `minHeight="auto"` option to HeroSection using `min-h-*` instead of fixed `h-*`
- **Fixed content clipping** - Profile pages with large avatars + badges + social links no longer cut off
- **Prominent avatar styling** - `ring-4 ring-[var(--color-accent-primary)]/30 shadow-2xl` for emphasis
- **Responsive name sizing** - `text-4xl md:text-5xl lg:text-6xl` with serif italic styling
- **Two-column grid** - Genres and Instruments sections display side-by-side on desktop
- **Content width constrained** - `max-w-4xl mx-auto` for better readability
- Key files:
  - `web/src/components/layout/hero-section.tsx` - Added `auto` minHeight option
  - `web/src/components/songwriters/SongwriterAvatar.tsx` - Added xl/2xl sizes
  - `web/src/app/songwriters/[id]/page.tsx` - Complete layout redesign with `minHeight="auto"`
  - `web/src/app/performers/[id]/page.tsx` - Updated to `minHeight="auto"`
  - `web/src/app/studios/[id]/page.tsx` - Updated to `minHeight="auto"`

### Profile Visibility Control (December 2025)
- **New `is_public` flag on profiles** - Controls whether profile appears in public listings
- **Database migration** - Added `is_public` column with index, backfilled all existing profiles to `true`
- **RLS policy updated** - Profiles SELECT now requires `is_public=true` for public reads; self/admin access preserved
- **Public queries updated** - Members, songwriters, performers, studios, spotlight, homepage featured, and global search all filter `is_public=true`
- **Dashboard toggle** - "Public profile" switch in `/dashboard/profile` with helper copy explaining visibility
- **Onboarding reassurance** - Copy added explaining profiles are public by default and can be changed later
- **Completeness nudge** - Private profiles get a suggestion to make profile public for discoverability
- **BlogComments hardened** - Author treated as optional at render time with safe fallbacks
- Key files:
  - `supabase/migrations/20251222000001_add_is_public_to_profiles.sql` - Column + index + backfill
  - `supabase/migrations/20251222000002_update_profiles_select_policy_is_public.sql` - RLS policy update
  - `web/src/app/(protected)/dashboard/profile/page.tsx` - Toggle UI + state
  - `web/src/app/onboarding/profile/page.tsx` - Reassurance copy
  - `web/src/lib/profile/completeness.ts` - Private profile nudge
  - `web/src/app/members/page.tsx` - `is_public=true` filter
  - `web/src/app/api/search/route.ts` - `is_public=true` filter on member search
  - `web/src/components/blog/BlogComments.tsx` - Safe author access

### Profile Completeness Indicator (December 2025)
- **New scoring system** - 100-point profile completeness calculation
  - Identity (20 pts): at least one identity flag set
  - Basics (30 pts): full_name (10), bio ≥50 chars (10), avatar (10)
  - Music Details (30 pts): instruments (15), genres (15)
  - Engagement (20 pts): social link (10), tip link (10)
- **ProfileCompleteness component** - Progress bar with color coding + up to 3 actionable suggestions
- **DashboardProfileCard** - Compact version on /dashboard home page
- **Anchor scrolling** - Clicking suggestions scrolls to relevant section with highlight
- **Section IDs added** to profile edit page for anchor navigation
- Key files:
  - `web/src/lib/profile/completeness.ts` - Scoring logic
  - `web/src/components/profile/ProfileCompleteness.tsx` - Full UI component
  - `web/src/app/(protected)/dashboard/DashboardProfileCard.tsx` - Compact dashboard card
  - `web/src/app/(protected)/dashboard/profile/page.tsx` - Added indicator + section IDs

### Member Directory Filters Enhancement (December 2025)
- **Instruments & Genres filters** on /members page now use curated options
- **Shared constants file** - `web/src/lib/profile/options.ts` for INSTRUMENT_OPTIONS and GENRE_OPTIONS
- **Case-insensitive matching** for genre and instrument filters
- **Active filter chips** - Removable chips showing selected filters
- **Deduplicated constants** - Profile, onboarding, and member filters all use shared options
- Key files:
  - `web/src/lib/profile/options.ts` - Shared INSTRUMENT_OPTIONS (17) and GENRE_OPTIONS (16)
  - `web/src/components/members/MemberFilters.tsx` - Updated to use curated options
  - `web/src/app/(protected)/dashboard/profile/page.tsx` - Imports shared constants
  - `web/src/app/onboarding/profile/page.tsx` - Imports shared constants

### Genres Custom Entry UX (December 2025)
- **Genres section now matches Instruments UX** - curated options + custom entry
- **Custom genre input** with Enter key + Add button support
- **Case-insensitive duplicate prevention** against both curated and custom entries
- **Removable chips** for custom genre entries
- Key file: `web/src/app/(protected)/dashboard/profile/page.tsx`

### Shared Profile Display Components (December 2025)
- **ProfileIcons module** - Extracted shared SocialIcon, TipIcon, buildSocialLinks, buildTipLinks
- **Aligned public profile pages** - songwriters/[id], performers/[id], studios/[id] all use shared components
- **Identity badges standardized** - Flag-first logic (is_songwriter, is_host, is_studio, is_fan) with legacy role fallback
- **Tip button text color fix** - Changed from `text-[var(--color-text-primary)]` to `text-white` for contrast
- **"Instruments & Skills" rename** - Consistent section naming across profile pages
- Key files:
  - `web/src/components/profile/ProfileIcons.tsx` - Shared icon components and link builders
  - `web/src/components/profile/index.ts` - Barrel exports
  - `web/src/app/songwriters/[id]/page.tsx` - Updated to use shared components
  - `web/src/app/performers/[id]/page.tsx` - Updated to use shared components
  - `web/src/app/studios/[id]/page.tsx` - Updated to use shared components

### ThemePicker & Gallery Comments (December 2025)
- **ThemePicker component** - New dropdown theme selector with 9 presets (4 dark, 5 light)
  - Compact mode for header/mobile menu with color swatch showing current theme accent
  - Full-size mode with side-by-side dark/light columns for homepage section
  - ARIA attributes: `aria-expanded`, `aria-haspopup="listbox"`, `role="option"`, `aria-selected`
  - Keyboard navigation: Escape key closes dropdown, focus-visible rings
  - `onSelect` callback for parent component coordination (e.g., closing mobile menu)
- **Pre-hydration theme script** - Inline script in layout.tsx applies localStorage theme before React hydrates (eliminates 50-100ms flash)
- **ThemePicker placement** - Added to desktop header (compact) and mobile menu footer
- **Mobile menu focus management** - React ref pattern replaces document.querySelector for focus return after theme selection
- **Gallery comments system** - Photo and album comment support
  - Database tables: `gallery_photo_comments`, `gallery_album_comments` with RLS
  - Anti-spam: 2-second cooldown between posts, 500-char max length
  - Optimistic delete UI with rollback on failure
  - Permission model: author, admin, image uploader, album owner can delete
  - "Sign in to leave a comment" prompt for guests
- Key files:
  - `web/src/components/ui/ThemePicker.tsx` - New component
  - `web/src/components/navigation/header.tsx` - Added ThemePicker compact + menuTriggerRef
  - `web/src/components/navigation/mobile-menu.tsx` - Added ThemePicker + triggerRef prop
  - `web/src/app/layout.tsx` - Pre-hydration theme script
  - `web/src/components/gallery/GalleryComments.tsx` - New component
  - `web/src/components/gallery/GalleryGrid.tsx` - Lightbox with comments integration
  - `supabase/migrations/20251221044056_gallery_comments.sql` - DB migration

### Homepage & UI Polish (December 2025)
- **New hero image** - Sunset clouds with "Denver Songwriters Collective" text and DSC logo baked into image
- **Hero image centered** - Changed from `object-top` to `object-center` positioning
- **No gradient overlays on hero** - `showVignette={false}` and `showBottomFade={false}` for clean display
- **Open Mic Directory hero feature** - "Contribute to our dynamic, comprehensive list of local open mics!" as prominent section
- **"Happenings" section rename** - Changed from "This week" to "Happenings"
- **"Join us if you're..."** - Changed from "This is for you if you're..."
- **Spots remaining fix** - Now correctly counts timeslot claims via join through `event_timeslots` table
- **Gallery CTA buttons** - Added "Share your photos" button and CTA card like blog's "Share your story"
- **Centered card content** - All card components now center titles, badges, tags, and CTAs (bios stay left-aligned)
- Key files:
  - `web/public/images/hero.jpg` - New hero image
  - `web/src/components/layout/hero-section.tsx` - `object-center` positioning
  - `web/src/app/page.tsx` - Homepage copy updates, timeslot counting fix, blog card centering
  - `web/src/app/gallery/page.tsx` - Added CTA buttons and "Share Your Photos" card
  - `web/src/components/members/MemberCard.tsx` - Centered content
  - `web/src/components/events/EventCard.tsx` - Centered content
  - `web/src/components/songwriters/SongwriterCard.tsx` - Centered content
  - `web/src/components/hosts/HostCard.tsx` - Centered content
  - `web/src/components/performers/PerformerCard.tsx` - Centered content

### Celebratory Performer Display & Host Controls (December 2025)
- **Performer names now CELEBRATORY** - 2xl serif italic font with accent color, gradient backgrounds
- **Spotlight treatment for claimed slots** - Each performer gets a mini-spotlight card with decorative music note
- **"This could be you!" for open slots** - Inviting language encouraging signups
- **"You're performing!" message** - Personal celebration when viewing your own slot
- **Host Controls component** - Purple gradient panel with "Control Lineup" and "Open TV Display" buttons
- **Only visible to hosts/admins** - HostControls checks authorization before rendering
- Key files:
  - `web/src/components/events/TimeslotSection.tsx` - Complete celebratory redesign
  - `web/src/components/events/HostControls.tsx` - New host tools component
  - `web/src/app/events/[id]/page.tsx` - Added HostControls to event detail

### Recurring Event System (December 2025)
- **Option A implemented** - Generate individual event instances as separate rows
- **New columns on events** - `parent_event_id`, `is_recurring`, `recurrence_pattern`, `recurrence_end_date`
- **generate_recurring_event_instances() RPC** - Creates future instances (weekly, biweekly, monthly)
- **Auto-generates timeslots** - Each instance gets its own timeslots via `generate_event_timeslots()`
- **8 weeks ahead by default** - Configurable via function parameter
- Key file:
  - `supabase/migrations/20251220222457_recurring_event_instances.sql`

### Lineup Control Page Improvements (December 2025)
- **Fixed host authorization** - Now checks `host_id` on events table, not just `event_hosts` table
- **Supports event hosts AND co-hosts** - Checks both patterns
- **Admin bypass** - Admins always have access
- Key file:
  - `web/src/app/events/[id]/lineup/page.tsx` - Updated auth check

### Timeslot Performer Name & Profile Page Fixes (December 2025)
- **Performer name now prominent** - Changed from `text-xs` to `text-sm font-medium` with accent color
- **Profile link always visible** - Name displays in accent color so it's obviously clickable
- **Profile page query updated** - Now shows profiles with `is_songwriter=true` or `is_host=true`, not just legacy role field
- **Fixed 404 for admin profiles** - Users with `role='admin'` but `is_songwriter=true` now display correctly on `/songwriters/[id]`
- Key files:
  - `web/src/components/events/TimeslotSection.tsx` - Lines 318-333: Larger, more prominent performer name display
  - `web/src/app/songwriters/[id]/page.tsx` - Lines 79-86: Updated query with identity flag support

### Admin Suggestions Name Lookup (December 2025)
- **Profile names for known users** - Suggestions table now looks up submitter names from profiles by email
- **No more "Anonymous" for registered users** - Email-based profile lookup enriches suggestion data
- Key file:
  - `web/src/app/(protected)/dashboard/admin/event-update-suggestions/page.tsx` - Lines 39-60: Email → name lookup

### Email Confirmation & Newsletter Improvements (December 2025)
- **Junk mail warning on signup confirmation** - Prominent amber box warning users to check spam folder
- **Mark as trusted sender reminder** - Encourages users to whitelist DSC for future notifications
- **Newsletter signup on homepage** - Humorous copy: "open mics, gatherings, and the occasional terrible pun"
- **Newsletter signup on about page** - Same component with source tracking
- **Source tracking for analytics** - Newsletter signups track where they came from (homepage, about, footer)
- **Admin newsletter page** - View all subscribers, stats by source, export emails for bulk sending
- Key files:
  - `web/src/app/auth/confirm-sent/page.tsx` - Added junk mail warning
  - `web/src/components/navigation/NewsletterSection.tsx` - New component with humorous copy
  - `web/src/app/page.tsx` - Added NewsletterSection
  - `web/src/app/about/page.tsx` - Added NewsletterSection with source="about"
  - `web/src/app/api/newsletter/route.ts` - Accepts source parameter
  - `web/src/app/(protected)/dashboard/admin/newsletter/page.tsx` - Admin subscriber list

### Application Logging System (December 2025)
- **app_logs table** - Database table for error/debug logging with RLS (admins read, anyone insert)
- **appLogger utility** - Client/server logging: `appLogger.error()`, `appLogger.info()`, `appLogger.logError()`
- **Admin logs page** - View application logs with level/source filtering, search, expandable details
- **Auto-cleanup function** - `cleanup_old_logs()` removes logs older than 30 days
- Key files:
  - `supabase/migrations/20251220050000_create_app_logs_table.sql` - Table and RLS
  - `web/src/lib/appLogger.ts` - Logging utility
  - `web/src/app/(protected)/dashboard/admin/logs/page.tsx` - Admin logs viewer
  - `web/src/app/(protected)/dashboard/admin/logs/_components/LogsTable.tsx` - Filterable log table

### Email Column in Profiles (December 2025)
- **Added email column** to profiles table for easier admin debugging
- **Backfill migration** - Copied emails from auth.users to profiles
- **Trigger updated** - `handle_new_user()` now copies email on user creation
- Key file:
  - `supabase/migrations/20251220040000_add_email_to_profiles.sql`

### Login Form Theme-Aware Colors (December 2025)
- **Fixed gray inputs on white background** - Login form inputs now use proper CSS variables
- **Replaced hardcoded colors** - Changed `bg-black/40 border-white/10` to `bg-[var(--color-bg-input)] border-[var(--color-border-input)]`
- **Magic link page restyled** - Now matches other auth pages with `card-base` container and `Button` component
- **Link colors updated** - "Forgot password" and "Magic link" links now use `--color-link` variables
- Key files:
  - `web/src/app/login/page.tsx` - Updated email/password input styling
  - `web/src/app/login/magic/page.tsx` - Complete restyle with PageContainer, Button, and theme variables

### Super Admin System (December 2025)
- **Added super admin role** - Only `sami.serrag@gmail.com` can promote/demote admins
- **Admin toggle UI** in User Directory (`/dashboard/admin/users`)
- **"Make Admin" button** - Promotes user to admin role (emerald link)
- **"Remove Admin" button** - Demotes admin to performer role (orange link)
- **Security:** Super admin email is hardcoded in `adminAuth.ts`, not configurable via database
- **Self-demotion prevented** - Super admin cannot remove their own admin role
- Key files:
  - `web/src/lib/auth/adminAuth.ts` - `isSuperAdmin()` function, `SUPER_ADMIN_EMAIL` constant
  - `web/src/app/(protected)/dashboard/admin/users/actions.ts` - `toggleAdminRole()` server action
  - `web/src/components/admin/UserDirectoryTable.tsx` - Admin toggle UI with `isSuperAdmin` and `currentUserId` props

### Members Page Visibility Fix (December 2025)
- **Root cause:** New Google OAuth users had `role = NULL`, blocked by RLS policy
- **Fix 1:** Updated `role = 'performer'` for existing users with `is_songwriter = true`
- **Fix 2:** Updated RLS policy to also check identity flags (`is_songwriter`, `is_studio`, `is_fan`, `is_host`)
- **Database access configured:** `DATABASE_URL` added to `.env.local` for direct psql access
- **Claude can now run all SQL directly** - CRUD via Supabase JS client, DDL via psql
- Key files:
  - `supabase/migrations/20251220014630_update_profiles_rls_for_identity_flags.sql` - Migration file (applied manually)
  - `web/.env.local` - Added DATABASE_URL for psql access

### Default is_fan for New Users (December 2025)
- **New users now default to `is_fan = true`** - Ensures visibility on Members page immediately after signup
- **Updated `handle_new_user()` trigger** - Sets `is_fan = true` during profile creation
- **Backfill migration** - Sets `is_fan = true` for existing users with no identity flags
- Key file:
  - `supabase/migrations/20251220020000_default_is_fan_for_new_users.sql`

### Suggestion Response Emails (December 2025)
- **Email notifications for suggestion reviews** - Submitters receive emails when their suggestions are approved/rejected/need info
- **Contextual subjects** - "Your open mic submission is live!" for approved, "About your suggestion" for rejected, "Quick question..." for needs_info
- **Friendly, warm tone** - Messages thank submitters and explain next steps
- **Admin message included** - Custom admin response appears in the email body
- Key files:
  - `web/src/lib/email/templates/suggestionResponse.ts` - New email template
  - `web/src/app/api/admin/event-update-suggestions/[id]/route.ts` - Sends email on status change
  - `web/src/lib/email/index.ts` - Exports new template

### Admin Suggestions Table Enhancement (December 2025)
- **New open mic submissions display properly** - `_new_event` JSON is parsed and displayed as structured data
- **"NEW SUBMISSION" badge** - Visual indicator for new event submissions vs corrections
- **Structured data display** - Shows venue, address, schedule, recurrence, description
- **Modal shows parsed details** - Review modal displays formatted event data instead of raw JSON
- Key file:
  - `web/src/components/admin/EventUpdateSuggestionsTable.tsx`

### Image System Standardization (December 2025)
- **Standardized 4:3 aspect ratio** across all image uploads and card displays
- **Removed visual effects** - no more gradient overlays or hover scale effects on cards
- **Upload forms updated** - ImageUpload default changed from 1:1 to 4:3
- **Card components updated** - EventCard, MemberCard, SongwriterCard, PerformerCard, HostCard, StudioCard all use 4:3
- **Detail pages updated** - Event and blog detail pages use aspect-[4/3] instead of fixed heights
- **Gallery preserves original ratios** - GalleryGrid and GalleryAdminTabs no longer force aspect ratios
- **Profile avatars unchanged** - Still use 1:1 circular styling
- Key files modified:
  - `web/src/components/ui/ImageUpload.tsx` - Default aspectRatio now 4/3
  - `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` - aspectRatio={4/3}
  - `web/src/app/(protected)/dashboard/admin/blog/BlogPostForm.tsx` - aspectRatio={4/3}
  - `web/src/components/events/EventCard.tsx` - aspect-[4/3], no gradient/hover
  - `web/src/components/members/MemberCard.tsx` - No gradient/hover
  - `web/src/components/songwriters/SongwriterCard.tsx` - No gradient/hover
  - `web/src/components/performers/PerformerCard.tsx` - No gradient/hover
  - `web/src/components/hosts/HostCard.tsx` - No gradient/hover
  - `web/src/components/studios/StudioCard.tsx` - No gradient/hover
  - `web/src/app/events/[id]/page.tsx` - aspect-[4/3] for hero image
  - `web/src/app/blog/[slug]/page.tsx` - aspect-[4/3], no gradient
  - `web/src/components/gallery/GalleryGrid.tsx` - Preserves original ratios
  - `web/src/app/gallery/page.tsx` - Album covers use 4:3
  - `web/src/app/(protected)/dashboard/admin/gallery/GalleryAdminTabs.tsx` - Preserves original ratios
- **Note:** Existing images uploaded at 1:1 or 16:9 will display in 4:3 containers with object-cover cropping

### Unified Onboarding Page (December 2025)
- **Single-page onboarding:** Replaced multi-step flow with one welcoming page
- **Collapsible sections:** Identity, bio, social links, tipping, collaboration preferences
- **Privacy-first messaging:** Clear language about email privacy and data control
- **Skip anytime:** Users can skip directly to dashboard, onboarding marked complete
- **Auth callback updated:** Now redirects to `/onboarding/profile` instead of `/onboarding/role`
- **Proxy simplified:** Only checks `onboarding_complete` flag, no role dependency
- Key files:
  - `web/src/app/onboarding/profile/page.tsx` - New unified onboarding page
  - `web/src/app/onboarding/role/page.tsx` - Now redirects to profile
  - `web/src/app/onboarding/complete/page.tsx` - Now redirects to dashboard
  - `web/src/app/auth/callback/route.ts` - Updated redirect targets
  - `web/src/proxy.ts` - Simplified onboarding check

### Member Role Simplification (December 2025)
- **New identity flags added to profiles table:** `is_songwriter`, `is_studio`, `is_fan` (boolean columns)
- **Terminology update:** "Performer" → "Songwriter" throughout
- Migration: `supabase/migrations/20251218000001_add_member_identity_flags.sql`
- **Next steps:** Update pages that filter by `role` to use boolean flags instead

### Theme System Overhaul (December 2025)
- **New CSS tokens added:**
  - `--color-text-on-accent` - Button text on accent backgrounds
  - `--color-link` / `--color-link-hover` - Link colors
  - `--color-bg-input` / `--color-border-input` / `--color-placeholder` - Form input styling
- **New theme presets:** `sunset` (light), `night` (dark) in `presets.css`
- **Normalized 130+ hardcoded Tailwind colors** to CSS custom properties
- **Removed all non-functional `dark:` variants** (no `.dark` class applied to html)
- **Replaced all `text-gradient-gold`** with `text-[var(--color-text-accent)]`
- **Replaced all `--color-gold-*` references** with accent tokens
- **Light theme accent text darkened** for WCAG contrast compliance
- **Footer stays dark** across all themes via `bg-[var(--color-bg-footer)]`
- **Deleted unused `web/src/lib/fonts.ts`** - fonts consolidated in layout.tsx
- See [docs/theme-system.md](./docs/theme-system.md) for full style guide
- Key files:
  - `web/src/app/globals.css` - Base CSS variables
  - `web/src/app/themes/presets.css` - Theme preset definitions

### Guest Verification System (December 2025)
- **Email templates added:** verificationCode, claimConfirmed, waitlistOffer
- **Guest verification modules:** config, crypto, storage in `web/src/lib/guest-verification/`
- **Feature flags system:** `web/src/lib/featureFlags.ts`
- **jose dependency added** for JWT handling
- Key files:
  - `web/src/lib/email/` - Email module with templates
  - `web/src/app/api/guest/` - Guest verification API routes

### Middleware → Proxy Migration (December 2025)
- **Migrated to Next.js 16 proxy convention** - renamed `middleware.ts` to `proxy.ts`
- **Function renamed** - `middleware()` → `proxy()` as per Next.js 16 deprecation
- **Fixed TypeScript errors** - removed invalid `templateName` property from `sendEmail()` calls
- Key file: `web/src/proxy.ts` - Auth proxy for protected routes

### Timeslot Claiming UI (December 2025)
- **TimeslotSection component** - Public event detail page shows claimable performance slots
- **Conditional UI** - Events with `has_timeslots=true` show slot grid; others show RSVP button
- **Slot claiming** - Authenticated users can claim available slots (one per person)
- **API wiring** - Event creation now calls `generate_event_timeslots()` RPC
- **New columns inserted** - `has_timeslots`, `total_slots`, `slot_duration_minutes`, `allow_guest_slots`
- Key files:
  - `web/src/components/events/TimeslotSection.tsx` - New client component for claiming slots
  - `web/src/app/events/[id]/page.tsx` - Conditional rendering of timeslots vs RSVP
  - `web/src/app/api/my-events/route.ts` - Inserts new columns, calls RPC
- Database tables (migration 20251216100001):
  - `event_timeslots` - Individual performance slots per event
  - `timeslot_claims` - Claims on slots with status tracking
  - `event_lineup_state` - "Now playing" state for live events

### Event Publishing UX Improvements (December 2025)
- **Filter tabs on My Events page** - Live, Drafts, Cancelled tabs with count badges
- **Publish/Unpublish button** on event detail page for quick state changes
- **Unified status badges** - Draft (amber), Live (emerald), Cancelled (red)
- **Theme-aware colors** - All badges work on both light and dark themes
- **Cancelled events cannot be published** until restored
- New components:
  - `web/src/app/(protected)/dashboard/my-events/_components/MyEventsFilteredList.tsx` - Client component with filter tabs
  - `web/src/app/(protected)/dashboard/my-events/[id]/_components/PublishButton.tsx` - Publish toggle button
- Event publishing logic:
  - `is_published = false` → Draft (not visible publicly)
  - `is_published = true` + `status = 'active'` → Live on Happenings
  - `status = 'cancelled'` → Hidden from public regardless of `is_published`

### Event Timeslot Configuration (December 2025)
- **SlotConfigSection component** - Toggle between RSVP mode and performance slots
- **Auto-enable timeslots** for open_mic and showcase event types
- **Configurable slot parameters** - Number of slots, duration (5-30 min), allow guests
- **Capacity field hidden** when timeslots enabled (slots = capacity)
- **Event creation creates slots** - Uses `generate_event_timeslots()` RPC to populate `event_timeslots` table
- Key files:
  - `web/src/app/(protected)/dashboard/my-events/_components/SlotConfigSection.tsx` - New component
  - `web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx` - Integration
  - `web/src/app/api/my-events/route.ts` - Slot creation on event POST

### Host/Admin Role Consolidation (December 2025)
- **checkHostStatus() function** - Treats admins as hosts automatically
- **Unified role checks** - All files now use `checkAdminRole()` from profiles.role
- **Admins have host privileges** - No need for separate approved_hosts entry
- Key files:
  - `web/src/lib/auth/adminAuth.ts` - Added checkHostStatus()
  - Multiple API routes and pages updated to use profiles.role checks

### Gallery Feature Enhancement (December 2025)
- **Album listing** on `/gallery` page with cover images and photo counts
- **Album detail page** at `/gallery/[slug]` with pagination
- **Lightbox keyboard navigation** - arrow keys, escape, prev/next buttons
- **Image counter** in lightbox ("3 / 24")
- **Accessibility improvements** - focus-visible rings, ARIA labels, button elements
- See [docs/gallery.md](./docs/gallery.md) for full documentation
- Key files:
  - `web/src/app/gallery/page.tsx` - Enhanced with albums section
  - `web/src/app/gallery/[slug]/page.tsx` - New album detail page
  - `web/src/components/gallery/GalleryGrid.tsx` - Keyboard navigation, accessibility

### Stream 3: RSVP & Waitlist System (December 2025)
- **24-hour waitlist claim window** - when a spot opens, next person has 24h to confirm
- **CancelRSVPModal** - accessible cancellation with focus trap
- **RSVPSection** - auth-aware wrapper with offer confirmation
- **AddToCalendarButton** - Google, Apple (ICS), Outlook integration
- **My RSVPs dashboard** at `/dashboard/my-rsvps`
- See [docs/streams/stream-3-rsvp-flow.md](./docs/streams/stream-3-rsvp-flow.md) for full documentation
- Key files:
  - `web/src/lib/waitlistOffer.ts` - Server-side waitlist logic
  - `web/src/lib/waitlistOfferClient.ts` - Client-safe utilities
  - `web/src/components/events/RSVPButton.tsx` - Enhanced RSVP button
  - `web/src/components/events/CancelRSVPModal.tsx` - Cancellation modal
  - `web/src/components/events/RSVPSection.tsx` - Auth wrapper

### Event Verification System v0.3.0 (December 2025)
- **Change Reports feature** for community-submitted event corrections
- **Admin verifications page** at `/dashboard/admin/verifications`
- **Verified badges** on open mic listings
- See [docs/releases/v0.3.0.md](./docs/releases/v0.3.0.md) for full release notes
- Key files:
  - `web/src/components/events/ReportChangeForm.tsx`
  - `web/src/app/(protected)/dashboard/admin/verifications/page.tsx`
  - `web/src/app/api/change-reports/route.ts`

### Events Page Improvements & Detail Page (December 2025)
- **Created `/events/[id]` detail page** for DSC events
- **Reorganized events page** with past events section
- **Shrunk event types** to compact pill-style tags

### Theme & Performance (December 2025)
- **Theme-aware color migration** - all hardcoded colors replaced with CSS variables
- **Footer adapts to all theme presets** with inverse text colors
- **CLS: 0.639 → 0.000** - eliminated all layout shifts
- **Performer → Songwriter rename** throughout the webapp

---

## Environment Variables

### Required in Vercel
```
NEXT_PUBLIC_SUPABASE_URL=https://oipozdbfxyskoscsgbfq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # NOT prefixed with NEXT_PUBLIC_
```

### Local Development
Copy `.env.example` to `.env.local` and fill in values from Supabase dashboard.

---

## Key Files

| File | Purpose |
|------|---------|
| `web/src/lib/supabase/server.ts` | Server-side Supabase client |
| `web/src/lib/supabase/client.ts` | Client-side Supabase client |
| `web/src/lib/supabase/serviceRoleClient.ts` | Admin operations (bypasses RLS) |
| `web/src/lib/auth/adminAuth.ts` | `checkAdminRole()` utility |
| `web/src/lib/supabase/database.types.ts` | Generated TypeScript types |
| `web/src/lib/profile/options.ts` | Shared INSTRUMENT_OPTIONS and GENRE_OPTIONS |
| `web/src/lib/profile/completeness.ts` | Profile completeness scoring logic |
| `web/src/lib/waitlistOffer.ts` | Waitlist promotion logic |
| `web/src/lib/waitlistOfferClient.ts` | Client-safe waitlist utilities |
| `web/src/types/index.ts` | Custom TypeScript types |
| `web/src/components/profile/` | Shared profile components (icons, completeness) |
| `next.config.ts` | Next.js config with redirects |
| `ARCHITECTURE_PLAN.md` | White-label platform roadmap |
| `web/src/app/themes/presets.css` | Theme preset CSS variables |
| `web/src/app/globals.css` | Base CSS variables and global styles |
| `web/src/proxy.ts` | Auth proxy for protected routes (Next.js 16) |

---

## Commands

```bash
# Development
cd web && npm run dev

# Build
cd web && npm run build

# Type check
cd web && npm run lint

# Full verification (see docs/quality-gates.md)
cd web && npm run lint && npm run test -- --run && npm run build

# Generate Supabase types (after schema changes)
npx supabase gen types typescript --project-id oipozdbfxyskoscsgbfq > web/src/lib/supabase/database.types.ts

# Deploy to production
git add . && git commit -m "your message" && git push
```

---

## Build Notes

- All protected pages using `supabase.auth.getSession()` require `export const dynamic = "force-dynamic"` to prevent Next.js 16 prerender errors
- Vercel auto-deploys from `main` branch

---

## Deploy Rule: Supabase Migrations Before Main

**Why:** Vercel auto-deploys immediately when code is pushed to `main`. If new code references database columns/tables that don't exist yet, the deploy will fail or cause runtime errors. This happened with the `is_public` column - code was deployed before the migration was applied.

**Pre-push checklist when migrations exist:**

```bash
# 1. Check for pending migrations
npx supabase migration list

# 2. Apply any new migrations to remote database
npx supabase db push

# 3. Verify migration applied (check column/table exists)
cd web && source .env.local && psql "$DATABASE_URL" -c "\d profiles"

# 4. Only THEN push to main
git push origin main
```

**Rule:** If any migration files were added or modified, do NOT push to `main` until `npx supabase db push` succeeds and the schema changes are verified in production.

---

## Claude Code Rules

### IMPORTANT: Update CLAUDE.md After Every Push

**After every `git push` to production (`main` branch), you MUST update this CLAUDE.md file with:**

1. **What changed** - Brief summary of the changes made
2. **Files modified** - Key files that were added/changed
3. **New components/utilities** - Any new reusable components created
4. **Configuration changes** - Updates to next.config.ts, environment variables, etc.
5. **Bug fixes** - Any issues resolved

**Add changes to the "Recent Changes" section** with the current date. Keep entries concise but informative for future context.

**Example format:**
```markdown
### [Feature/Fix Name] (Month Year)
- Brief description of what was done
- Key files: `path/to/file.tsx`
- New component: `ComponentName` - what it does
```

### IMPORTANT: Keep Documentation Consolidated

**When making changes that affect documented systems, you MUST:**

1. **Update existing docs** - Don't create new docs if one already exists for that topic
2. **Consolidate duplicates** - If you find duplicate docs, merge them into one canonical location
3. **Remove outdated docs** - Delete docs that are superseded or no longer accurate
4. **Use canonical locations:**
   - `docs/emails/` — All email-related documentation
   - `docs/future-specs/` — Specs for unimplemented features only
   - `docs/completed/` — Old release notes and completed planning docs
   - Root `docs/` — Active feature documentation

**Key documentation to keep updated:**
- `docs/emails/EMAIL_INVENTORY.md` — Update when adding/modifying email templates
- `docs/emails/EMAIL_STYLE_GUIDE.md` — Update when changing email voice/tone/formatting
- `docs/known-issues.md` — Update when discovering or fixing issues
- `CLAUDE.md` — Update after every push (see above)

# Denver Songwriters Collective - Claude Context

## Project Overview

A community platform for Denver-area songwriters to discover open mics, connect with other musicians, book studio services, and stay informed about local music events.

**Live Site:** https://denver-songwriters-collective.vercel.app

> **Architecture Evolution (December 2024):** This project is being transformed into a **white-label community platform template**. See [ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md) for the full roadmap covering theme system, brand configuration, and mobile app strategy.

## Project Structure

This project uses **git worktrees** for development:

- **Main repo (production):** `/Users/samiserrag/Documents/GitHub/denver-songwriters-collective`
  - Branch: `main`
  - Vercel auto-deploys from main

- **Worktree (development):** Check current worktree branch with `git branch`
  - Development branches are named after Docker-style names (e.g., `relaxed-meninsky`, `optimistic-jennings`)

### Deployment Workflow

1. Make changes in the worktree
2. Commit and push to the worktree branch
3. Merge to `main`:
   ```bash
   cd /Users/samiserrag/Documents/GitHub/denver-songwriters-collective
   git pull && git merge origin/<worktree-branch> --no-edit && git push
   ```
4. Vercel auto-deploys from main

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Deployment:** Vercel
- **Auth:** Supabase Auth (email/password, magic links)
- **Future:** React Native/Expo for mobile app (shared codebase)

## Database

- **Supabase Project ID:** `oipozdbfxyskoscsgbfq`
- **Migrations:** Located in `supabase/migrations/`
- Run migrations via Supabase SQL Editor (Dashboard > SQL Editor)

### Key Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles with roles (performer, host, studio, fan, admin) |
| `events` | All events including open mics, showcases, workshops |
| `venues` | Venue information with addresses and contact details |
| `blog_posts` | User-submitted blog posts (requires admin approval) |
| `gallery_images` | Community photo gallery (requires admin approval) |
| `monthly_highlights` | Featured content for homepage |
| `host_requests` | Applications to become an event host |
| `approved_hosts` | Approved host permissions |
| `event_update_suggestions` | Community corrections for event data |
| `studio_services` | Services offered by studio profiles |
| `studio_appointments` | Bookings for studio services |
| `favorites` | User favorites (events, profiles) |
| `open_mic_comments` | Comments on open mic events |

## User Roles

- **fan** - Basic user, can favorite events/profiles, RSVP to events
- **performer** - Can create profile with instruments, genres, collaboration preferences
- **host** - Can create and manage events (requires admin approval)
- **studio** - Can list studio services and accept bookings
- **admin** - Full access to admin dashboard, can approve content

## Features

### Public Pages
- `/` - Homepage with monthly highlights
- `/open-mics` - Open mic directory with map view
- `/open-mics/[slug]` - Individual open mic detail page
- `/events` - All events listing
- `/members` - Unified member directory (performers, studios, hosts, fans)
- `/performers` - Performer profiles (redirects to /members)
- `/studios` - Studio profiles (redirects to /members)
- `/blog` - Community blog
- `/gallery` - Photo gallery
- `/spotlight` - Featured members
- `/submit-open-mic` - Submit event corrections
- `/get-involved` - Volunteer opportunities

### Protected Pages (Auth Required)
- `/dashboard` - User dashboard
- `/dashboard/profile` - Edit profile
- `/dashboard/my-events` - Host's event management
- `/dashboard/blog` - User's blog posts
- `/dashboard/appointments` - Performer's studio bookings
- `/dashboard/studio-appointments` - Studio's incoming bookings
- `/dashboard/favorites` - Saved favorites

### Admin Pages
- `/dashboard/admin` - Admin overview
- `/dashboard/admin/events` - Manage all events
- `/dashboard/admin/venues` - Manage venues
- `/dashboard/admin/users` - User management
- `/dashboard/admin/blog` - Approve/manage blog posts
- `/dashboard/admin/gallery` - Approve/manage gallery images
- `/dashboard/admin/highlights` - Manage homepage highlights
- `/dashboard/admin/host-requests` - Approve host applications
- `/dashboard/admin/event-update-suggestions` - Review community corrections

---

## Security Audit Status

### Completed (December 2024)

#### Phase 1: RLS Security
- [x] All 28 tables have RLS enabled
- [x] `is_admin()` function standardized as SECURITY DEFINER
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

### High Priority
- [ ] Email notifications not implemented (RSVP confirmations, host approvals)
- [ ] Image optimization/CDN for gallery (currently direct Supabase storage)

### Medium Priority
- [ ] Search functionality across events/profiles
- [ ] Event recurrence handling (RRULE parsing for recurring events)
- [ ] Mobile app (React Native/Expo) - see ARCHITECTURE_PLAN.md

### Pre-Launch Optimization (Completed December 2024)
- [x] Image optimization with `next/image` component on homepage (highlights, blog images, author avatars)
- [x] Dynamic SEO metadata for all detail pages via `generateMetadata`:
  - `/open-mics/[slug]` - Event title, venue, day/time, canonical URL
  - `/events/[id]` - Event title, type label, venue, OpenGraph/Twitter
  - `/blog/[slug]` - Post title, excerpt, author, cover image for social cards
- [x] OpenGraph/Twitter card metadata in root layout with default OG image
- [x] Iframe accessibility - descriptive `title` attributes on Spotify/YouTube embeds
- [x] Remote image patterns configured in `next.config.ts` for Supabase storage

### Critical LCP Performance Fix (December 2024)
- [x] **Fixed 16.0s LCP → target <2.5s** - Critical Lighthouse failure resolved
- [x] Added `font-display: swap` to all 4 Google Fonts (Geist, Geist_Mono, Playfair_Display, Inter) to prevent FOIT
- [x] Replaced CSS `background-image` in HeroSection with Next.js `<Image priority>` for LCP preloading
- [x] Created `LazyIframe` component (`web/src/components/home/LazyIframe.tsx`) using IntersectionObserver
- [x] Deferred Spotify/YouTube iframe loading until near viewport (200px rootMargin)
- [x] Added `force-dynamic` to notifications page for build compatibility

### Remaining Pre-Launch Tasks
- [ ] Create `/public/images/og-image.jpg` (1200x630) for social sharing default

### Low Priority / Nice to Have
- [ ] Event check-in system for hosts
- [ ] Analytics dashboard for hosts (event attendance)
- [ ] Integration with external calendars (Google Calendar, iCal)
- [ ] Community forum (consider managed service like Discord, or simple in-app forum)
- [ ] Blog content: Copyright/Music Business Education articles for songwriters

---

## White-Label Architecture (In Progress)

**Status:** Planning complete, awaiting expert review before implementation

**Goal:** Transform this codebase into a reusable template that can be:
1. Re-themed for different brands via single config file
2. Deployed as both web and mobile app
3. Extended without forking

**Key Documents:**
- `ARCHITECTURE_PLAN.md` - Full technical roadmap (ready for review)

**Planned Phases:**
1. **Theme System Foundation** - Centralize all colors, fonts, shadows into CSS variables
2. **Component Refactor** - Replace hardcoded Tailwind classes with theme references
3. **Brand Config System** - Externalize all brand-specific content (logo, copy, features)
4. **Build Tooling** - Environment-based brand/theme switching
5. **Mobile Foundation** - Monorepo setup, shared packages, Expo app
6. **Full Mobile Development** - Feature-complete iOS/Android apps

**Current Audit Results:**
- ~24 unique hex colors hardcoded across 40+ files
- 111 files with hardcoded font weights
- 109 files with hardcoded border radius
- 18 files with custom inline shadows/gradients

**Quick Theme Changes (Until Refactor):**
- `web/src/app/globals.css` - CSS variables (colors, fonts, shadows)
- `web/src/app/layout.tsx` - Font imports
- `web/src/components/layout/hero-section.tsx` - Hero image

---

## Recent Changes (December 2024)

### Remove Hero Images from Sub-Pages & Theme Color Fixes (December 2024)
- **Removed hero images from all pages except homepage** - Cleaner, more consistent design
- Replaced hero images with simple text-only headers on:
  - `/events` (Happenings) page
  - `/blog` page
  - `/gallery` page
  - `/songwriters` page
- **Fixed theme-aware colors** on multiple pages:
  - Tip jar page: Fixed `border-white/10` → `border-[var(--color-border-default)]` on cards
  - Gallery page: Fixed hardcoded `text-neutral-*` colors in empty state
  - Blog page: Fixed text colors and changed hero to "Community Blog"
- Key files modified:
  - `web/src/app/events/page.tsx` - Simple header instead of hero image
  - `web/src/app/blog/page.tsx` - Simple header, fixed text colors
  - `web/src/app/gallery/page.tsx` - Simple header, theme-aware empty state
  - `web/src/app/songwriters/page.tsx` - Simple header
  - `web/src/app/tip-jar/page.tsx` - Theme-aware card borders

### Planned: Gallery Posts Feature
- See `PLAN.md` for full implementation plan
- Will allow users to create photo gallery albums with descriptions
- Admin approval workflow before publication
- Comments on both albums and individual images
- Requires database migration for `gallery_comments` table

### Theme-Aware Footer & Inverse Color System (December 2024)
- **Footer now adapts to all theme presets** - Text colors properly contrast with inverse backgrounds
- Added `--color-text-on-inverse-primary/secondary/tertiary` CSS tokens to `presets.css`
- Light themes get light text on dark footer; dark themes get dark text on light footer
- Key files:
  - `web/src/app/themes/presets.css` - Added inverse text tokens for all light themes
  - `web/src/components/navigation/footer.tsx` - Uses `--color-bg-inverse` and inverse text tokens
  - `web/src/components/navigation/newsletter-signup.tsx` - Updated to use theme tokens
  - `web/src/components/ui/Logo.tsx` - Added `inverse` prop for footer context

### Performer → Songwriter Rename & Homepage Consolidation (December 2024)
- **Renamed "performer/performers" to "songwriter/songwriters"** throughout the webapp
- Created new `/songwriters` route with dedicated pages and components
- Combined three homepage spotlight sections into single "Featured Members" section
- New components:
  - `web/src/components/songwriters/` - Full component suite (SongwriterCard, SongwriterGrid, SongwriterAvatar, SongwriterTag, SpotlightSongwriterCard)
  - `web/src/components/empty/EmptySongwriters.tsx` - Empty state for songwriters
- New pages:
  - `web/src/app/songwriters/page.tsx` - Songwriters directory
  - `web/src/app/songwriters/[id]/page.tsx` - Individual songwriter profile
  - Error and loading states for both routes
- Updated admin pages to use "Songwriter" terminology
- Key files modified:
  - `web/src/app/page.tsx` - Simplified homepage with combined Featured Members section
  - `web/src/types/index.ts` - Added Songwriter type alias
  - `web/next.config.ts` - Added redirect from `/performers` to `/songwriters`

### Admin-Only Theme Switcher (December 2024)
- Moved theme/font switcher from public footer to admin dashboard only
- Theme switcher now appears in `/dashboard/admin/settings` or site settings page
- Regular users see the theme set by admin, cannot change it themselves
- Prevents theme inconsistency across user sessions

### Pre-Phase 1 Security Audit (December 2024)
- **All security checks passed** - Ready for Phase 1 theme refactor
- Audit results:
  | Check | Status |
  |-------|--------|
  | Secret exposure in code | PASS - No service role keys in source |
  | Env file hygiene | PASS - Only `.env.test` tracked (local demo keys) |
  | .gitignore protects secrets | PASS - `.env.local`, `.env*.local` patterns |
  | Supabase key separation | PASS - `createServerClient` vs `createBrowserClient` |
  | Hardcoded credentials | PASS - None found |
  | Middleware present | YES - Auth protection on `/dashboard`, `/admin` |
  | Security headers | YES - CSP, X-Frame-Options, HSTS configured |
  | npm vulnerabilities | 0 high/critical |
- Key files verified:
  - `web/src/middleware.ts` - Validates JWT via `getUser()` not just `getSession()`
  - `web/next.config.ts` - Full CSP with frame-ancestors, script-src
  - `.gitignore` - Proper env file patterns

### White-Label Architecture Plan (December 2024)
- Created comprehensive `ARCHITECTURE_PLAN.md` documenting the transformation roadmap
- Completed codebase audit: identified all hardcoded colors, fonts, shadows, gradients
- Designed 3-tier design token system (primitive → semantic → component tokens)
- Planned 6-phase implementation from theme foundation to mobile app
- Ready for expert review before execution

### Blog Card Simplification (December 2024)
- Simplified homepage blog card to match performer/member card style
- Changed from 2-column grid to simple `max-w-md` card
- Unified image aspect ratio to `4/3`
- Key file: `web/src/app/page.tsx`

### CLS & LCP Performance Fix (December 2024)
- **CLS: 0.639 → 0.000** - Eliminated all layout shifts
- **TBT: 40-52ms** - Excellent (no main thread blocking)
- **LCP: 3.4s synthetic** - Optimized; remaining gap is Lighthouse throttling overhead
- Key fixes:
  - **Footer CLS fix**: Flexbox sticky footer with `min-height: calc(100lvh - 64px)` on main element
  - Hero image uses `priority` prop with `fetchpriority="high"`
  - All card images use `next/image` with explicit dimensions
- Key files:
  - `web/src/app/globals.css` - Body flexbox layout, `100lvh` with `100vh` fallback
  - `web/src/app/layout.tsx` - Critical inline CSS for CLS prevention
  - `web/src/components/layout/hero-section.tsx` - next/image with priority
  - `web/src/components/navigation/footer.tsx` - `role="contentinfo"` for CSS targeting
- Performance audit results:
  - CSS payload: 18.9KB gzip (excellent)
  - Unused CSS: 0 bytes (Tailwind purge working)
  - No render-blocking resources
- New utility: `web/src/components/home/CLSLogger.tsx` - dev-only CLS debugging tool with element selectors

### Teal → Gold Color Migration (Complete)
- Migrated all ~100 teal color instances to gold theme across 40+ files
- Public pages: open-mics, events, submit-open-mic, performers
- Components: MapViewButton, DayJumpBar, AccordionList, CompactListItem, EventCard, WorkInProgressBanner, HostCard, RequestHostButton
- Admin/dashboard: VenueSelector, UserDirectoryTable, BlogPostForm, BlogPostsTable, GalleryAdminTabs, AdminHighlightsClient, CoHostManager
- Forms: VolunteerSignupForm, EventSuggestionForm, OpenMicReportForm
- Utilities: highlight.ts, PlaceholderImage.tsx, ProfileQRCode.tsx

### Member Filters & Onboarding Enhancements
- Added "Open to Collaborations" filter to Members page
- Added collapsible "Specialties" filter section
- Expanded SPECIALTY_OPTIONS to 70+ items organized by category:
  - Instruments (Strings incl. Ukulele/Baritone Ukulele, Keys, Other)
  - Vocals, Songwriting Skills, Production & Technical
  - Performance, Music Knowledge, Genre Expertise, Other Skills
- Added `interested_in_cowriting` and `available_for_hire` checkboxes to onboarding
- Fixed filter label consistency ("Interested in Cowriting")

### Homepage Consolidation
- Merged three separate Spotlight sections (Performers, Open Mics, Hosts) into unified "Community Spotlight"
- Fixed blog image hover issue (removed scale animation)
- Changed blog image to aspect-square for consistent mobile sizing

### Members Directory
- Unified `/members` page consolidating performers, studios, hosts
- Filter by role, availability, genres, instruments, specialties
- Redirects from `/performers` and `/studios` to `/members`

### Venue Data Enrichment
- Added 18 Denver-area venues with full address data
- Updated 60+ events with proper venue associations
- Fixed missing slugs on 83 events

### Security Hardening
- Complete RLS audit and remediation
- Service role client for admin operations
- Standardized admin role checking
- Security headers configured in `next.config.ts` (CSP, X-Frame-Options, etc.)
- Strengthened email validation regex (RFC 5322 compliant)

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
| `web/src/types/index.ts` | Custom TypeScript types |
| `next.config.ts` | Next.js config with redirects |
| `ARCHITECTURE_PLAN.md` | White-label platform roadmap |
| `web/src/app/themes/presets.css` | Theme preset CSS variables (colors per theme) |
| `web/src/app/globals.css` | Base CSS variables and global styles |
| `web/src/components/ui/Logo.tsx` | Logo component with `inverse` prop for dark backgrounds |
| `web/src/components/songwriters/` | Songwriter component suite (cards, grid, avatar, tags) |

---

## Commands

```bash
# Development
cd web && npm run dev

# Build (from worktree web directory)
cd web && npx next build

# Type check
cd web && npm run lint

# Generate Supabase types (after schema changes)
npx supabase gen types typescript --project-id oipozdbfxyskoscsgbfq > web/src/lib/supabase/database.types.ts

# Deploy from worktree to production
git push origin <worktree-branch>
cd /Users/samiserrag/Documents/GitHub/denver-songwriters-collective
git pull && git merge origin/<worktree-branch> --no-edit && git push
```

---

## Build Notes

- All protected pages using `supabase.auth.getSession()` require `export const dynamic = "force-dynamic"` to prevent Next.js 16 prerender errors
- Vercel auto-deploys from `main` branch

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

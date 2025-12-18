# Denver Songwriters Collective - Claude Context

## Project Overview

A community platform for Denver-area songwriters to discover open mics, connect with other musicians, book studio services, and stay informed about local music events.

**Live Site:** https://denver-songwriters-collective.vercel.app

> **Architecture Evolution (December 2025):** This project is being transformed into a **white-label community platform template**. See [ARCHITECTURE_PLAN.md](./ARCHITECTURE_PLAN.md) for the full roadmap covering theme system, brand configuration, and mobile app strategy.

## Documentation

Comprehensive documentation is available in the `docs/` folder:

| Document | Purpose |
|----------|---------|
| [docs/releases/v0.3.0.md](./docs/releases/v0.3.0.md) | v0.3.0 release notes (Verification System) |
| [docs/streams/stream-3-rsvp-flow.md](./docs/streams/stream-3-rsvp-flow.md) | Stream 3: RSVP & Booking System documentation |
| [docs/gallery.md](./docs/gallery.md) | Gallery feature documentation |
| [docs/quality-gates.md](./docs/quality-gates.md) | Quality gates and CI/CD standards |
| [docs/known-issues.md](./docs/known-issues.md) | Known issues (non-blocking) |

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
| `gallery_albums` | Photo album collections |
| `change_reports` | Community-submitted event corrections |
| `event_rsvps` | Event RSVPs with waitlist and offer tracking |
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
- `/dashboard/admin/venues` - Manage venues
- `/dashboard/admin/users` - User management
- `/dashboard/admin/blog` - Approve/manage blog posts
- `/dashboard/admin/gallery` - Approve/manage gallery images and albums
- `/dashboard/admin/highlights` - Manage homepage highlights
- `/dashboard/admin/host-requests` - Approve host applications
- `/dashboard/admin/verifications` - Review community change reports
- `/dashboard/admin/event-update-suggestions` - Review community corrections

---

## Security Audit Status

### Completed (December 2025)

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

See [docs/known-issues.md](./docs/known-issues.md) for detailed tracking.

### High Priority
- [ ] Email notifications not implemented (RSVP confirmations, host approvals)
- [ ] Image optimization/CDN for gallery (currently direct Supabase storage)

### Medium Priority
- [ ] Search functionality across events/profiles
- [ ] Event recurrence handling (RRULE parsing for recurring events)
- [ ] Mobile app (React Native/Expo) - see ARCHITECTURE_PLAN.md

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

**Quick Theme Changes (Until Refactor):**
- `web/src/app/globals.css` - CSS variables (colors, fonts, shadows)
- `web/src/app/layout.tsx` - Font imports
- `web/src/components/layout/hero-section.tsx` - Hero image

---

## Recent Changes (December 2025)

### Event Timeslot Configuration (December 2025)
- **SlotConfigSection component** - Toggle between RSVP mode and performance slots
- **Auto-enable timeslots** for open_mic and showcase event types
- **Configurable slot parameters** - Number of slots, duration (5-30 min), allow guests
- **Capacity field hidden** when timeslots enabled (slots = capacity)
- **Event creation creates slots** - Generates `event_slots` rows with calculated times
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
| `web/src/lib/waitlistOffer.ts` | Waitlist promotion logic |
| `web/src/lib/waitlistOfferClient.ts` | Client-safe waitlist utilities |
| `web/src/types/index.ts` | Custom TypeScript types |
| `next.config.ts` | Next.js config with redirects |
| `ARCHITECTURE_PLAN.md` | White-label platform roadmap |
| `web/src/app/themes/presets.css` | Theme preset CSS variables |
| `web/src/app/globals.css` | Base CSS variables and global styles |

---

## Commands

```bash
# Development
cd web && npm run dev

# Build (from worktree web directory)
cd web && npx next build

# Type check
cd web && npm run lint

# Full verification (see docs/quality-gates.md)
cd web && npm run lint && npm run test -- --run && npm run build

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

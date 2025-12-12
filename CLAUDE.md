# Denver Songwriters Collective - Claude Context

## Project Overview

A community platform for Denver-area songwriters to discover open mics, connect with other musicians, book studio services, and stay informed about local music events.

**Live Site:** https://denver-songwriters-collective.vercel.app

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

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Deployment:** Vercel
- **Auth:** Supabase Auth (email/password, magic links)

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
- [ ] Mobile app considerations (PWA setup)

### Pre-Launch Optimization (Defer until feature-complete)
- [ ] Performance optimization (Lighthouse Core Web Vitals audit)
- [ ] Dynamic SEO metadata for detail pages (`/open-mics/[slug]`, `/events/[id]`, `/blog/[slug]`)
- [ ] OpenGraph/Twitter card images for social sharing
- [ ] Image optimization with `next/image` component (replace raw `<img>` tags)

### Low Priority / Nice to Have
- [ ] Event check-in system for hosts
- [ ] Analytics dashboard for hosts (event attendance)
- [ ] Integration with external calendars (Google Calendar, iCal)

---

## Recent Changes (December 2024)

### Members Directory
- Unified `/members` page consolidating performers, studios, hosts
- Filter by role, availability, genres, instruments
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

---

## Commands

```bash
# Development
cd web && npm run dev

# Build
cd web && npm run build

# Type check
cd web && npm run lint

# Generate Supabase types (after schema changes)
npx supabase gen types typescript --project-id oipozdbfxyskoscsgbfq > web/src/lib/supabase/database.types.ts
```

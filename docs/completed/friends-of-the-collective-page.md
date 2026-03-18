# Friends of the Collective Page

**Date:** March 17, 2026  
**Status:** Built, populated, and admin-managed (private until launch)  
**Route:** `/friends-of-the-collective`

## What Was Added

- New public page: `web/src/app/friends-of-the-collective/page.tsx`
- New reusable data source: `web/src/lib/friends-of-the-collective.ts`
- New database table + seed migration: `supabase/migrations/20260317201000_organizations_directory.sql`
- New admin portal:
  - `web/src/app/(protected)/dashboard/admin/organizations/page.tsx`
  - `web/src/app/(protected)/dashboard/admin/organizations/AdminOrganizationsClient.tsx`
- New admin APIs:
  - `web/src/app/api/admin/organizations/route.ts`
  - `web/src/app/api/admin/organizations/[id]/route.ts`
- Initial organizations populated from curated tab review output and managed in DB.
- Private-mode guard remains: page is admin-only unless launch flag is enabled.

## Content Model

Each listed organization uses this shape:

- `id`
- `name`
- `websiteUrl`
- `city` (optional)
- `organizationType` (optional)
- `shortBlurb`
- `whyItMatters`
- `tags` (optional)
- `featured` (optional)
- `isActive` (optional, defaults to active)

## How To Add More Organizations

1. Open `/dashboard/admin/organizations`.
2. Create or edit an organization.
3. Add logo/cover image URLs and optional gallery URLs.
4. Set visibility (`private`, `unlisted`, `public`) and status (`active`).
5. Save.

## Private vs Public Launch

- Current behavior:
  - page is **noindex/nofollow**
  - page is **unlisted** in navigation
  - page is **admin-only** unless launch flag is set

- Launch flag:
  - `NEXT_PUBLIC_FRIENDS_PAGE_PUBLIC=true`
  - When true, non-admin users can access the page.

## Editorial Principles

- Celebrate contributions without ranking organizations.
- Stay factual; avoid unsupported superlatives.
- Prefer practical language about outcomes for songwriters.
- Respect each organization’s own voice and mission.
- Include organizations of different sizes, models, and communities.

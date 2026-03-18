# Friends of the Collective Page

**Date:** March 17, 2026  
**Status:** Built, populated, admin-managed, and claim-enabled (private until launch)  
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

## Phase 2: Claim + Self-Management

- New migration:
  - `supabase/migrations/20260317224500_organizations_claims_and_managers.sql`
- New member dashboard routes:
  - `web/src/app/(protected)/dashboard/my-organizations/page.tsx`
  - `web/src/app/(protected)/dashboard/my-organizations/[id]/page.tsx`
- New member APIs:
  - `web/src/app/api/organizations/[id]/claim/route.ts`
  - `web/src/app/api/my-organizations/route.ts`
  - `web/src/app/api/my-organizations/[id]/route.ts`
- New admin claim review routes/APIs:
  - `web/src/app/(protected)/dashboard/admin/organization-claims/page.tsx`
  - `web/src/app/api/admin/organization-claims/route.ts`
  - `web/src/app/api/admin/organization-claims/[id]/approve/route.ts`
  - `web/src/app/api/admin/organization-claims/[id]/reject/route.ts`
- Navigation updates:
  - Dashboard sidebar now includes `My Organizations`.
  - Admin dashboard now includes pending counts + links for `Organization Claims`.
  - Friends cards include a claim/update CTA that routes to `My Organizations`.

### Workflow Summary

1. Member opens `My Organizations`.
2. Member submits a claim for an organization profile.
3. Admin reviews claim at `/dashboard/admin/organization-claims`.
4. On approval, member gets `owner` access via `organization_managers`.
5. Member edits profile content/photos from `/dashboard/my-organizations/[id]`.

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

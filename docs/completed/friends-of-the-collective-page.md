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

## Phase 3: Team Invite Links + Claim Notifications

- New migration:
  - `supabase/migrations/20260318030500_organization_invites.sql`
- New invite APIs:
  - `web/src/app/api/my-organizations/[id]/invite/route.ts`
  - `web/src/app/api/my-organizations/[id]/invite/[inviteId]/route.ts`
  - `web/src/app/api/organization-invites/accept/route.ts`
- New invite UX:
  - `web/src/app/(protected)/dashboard/my-organizations/[id]/_components/OrganizationInviteSection.tsx`
  - `web/src/app/organization-invite/page.tsx`
- Claim decision emails now sent with preference-aware delivery:
  - `web/src/lib/email/templates/organizationClaimApproved.ts`
  - `web/src/lib/email/templates/organizationClaimRejected.ts`
  - `web/src/lib/notifications/preferences.ts` (`organizationClaimApproved`/`organizationClaimRejected`)
- Invite creation can optionally auto-email a restricted recipient:
  - `web/src/lib/email/templates/organizationInvite.ts`

### Invite Workflow Summary

1. Owner/admin (or manager for manager-only access) opens `/dashboard/my-organizations/[id]`.
2. Creates an invite link with optional email restriction and expiration.
3. Recipient opens `/organization-invite?token=...` and logs in/signs up if needed.
4. On acceptance, recipient is granted `manager` or `owner` in `organization_managers`.
5. Invite creator receives a dashboard notification when the invite is accepted.

### Guardrails

- Non-owner managers cannot create or revoke owner invites.
- Tokens are stored as SHA-256 hashes only; plaintext token is shown once at creation.
- Invites enforce expiry, one-time acceptance, revocation, and optional email restriction.

## Phase 4: Host Spotlight Context + Member Tagging

- New migration:
  - `supabase/migrations/20260318154500_friends_host_spotlight_and_member_tags.sql`
- New schema:
  - `profiles.host_spotlight_reason` (admin-authored copy for host feature context)
  - `organization_member_tags` table (organization ↔ member links with optional reason and sort order)
- Friends page updates:
  - New `Featured Host Members` section that surfaces host spotlights with a `Why Featured` explanation.
  - Organization cards now render `Connected Members` pills with avatar + profile links.
- Admin UX updates:
  - Organization admin editor now supports tagged member management per organization.
  - Admin users table includes a `Host reason` editor for spotlighted hosts.
- New endpoint: `web/src/app/api/admin/users/[id]/host-spotlight-reason/route.ts`

## Phase 5: Organization Content Linking (Blog, Gallery, Hosted Series)

- New migration:
  - `supabase/migrations/20260318234500_organization_content_links.sql`
- New schema:
  - `organization_content_links` table (organization ↔ `blog_post` / `gallery_album` / `event_series`)
  - Optional `label_override` and sortable `sort_order` per link
- Admin API updates:
  - `web/src/app/api/admin/organizations/route.ts`
  - `web/src/app/api/admin/organizations/[id]/route.ts`
  - GET now returns `contentOptions` (`blogs`, `galleries`, `eventSeries`) for editor selectors.
- Admin UX updates:
  - `web/src/app/(protected)/dashboard/admin/organizations/AdminOrganizationsClient.tsx`
  - Edit/create modal now includes `Related Content Links` with selectors for:
    - blog posts
    - gallery albums
    - event series
- Public page updates:
  - `web/src/app/friends-of-the-collective/page.tsx`
  - Cards now show a `Related on CSC` section with direct links to:
    - Blog Posts
    - Gallery Albums
    - Hosted Happenings Series

### Notes

- Public rendering only surfaces links that are public/published as applicable.
- Admin can still stage links ahead of publish; hidden/draft content remains admin-visible but not public-visible.

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

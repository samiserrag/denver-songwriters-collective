# Stop-Gate Investigation: Org Linking Permissions + Member Tag Notifications

Date: 2026-03-18
Owner: Repo Executor
Status: Investigation + critique (awaiting approval)

## Requested Outcome

1. Admin can link any event/blog/gallery/member to any organization (not limited to current user-owned content).
2. Organization managers (claim/invite) can link events/blogs/galleries only when those items are tied to members tagged on that organization.
3. Organization managers can add tagged members; newly tagged members receive an email notice and can remove themselves easily.
4. "Claim or update this organization profile" CTA on Friends pages should route to feedback form with relevant subject prefilled.

## Evidence (Current State)

### A) Admin editor supports global options but events are series-only

- Admin editor content-link select is explicitly `event_series` (`Add event series...`):
  - `web/src/app/(protected)/dashboard/admin/organizations/AdminOrganizationsClient.tsx:571`
  - `web/src/app/(protected)/dashboard/admin/organizations/AdminOrganizationsClient.tsx:581`
- Admin API options query aggregates by `series_id` and returns only one row per series:
  - `web/src/app/api/admin/organizations/route.ts:413`
  - `web/src/app/api/admin/organizations/route.ts:423`
- API allows content link types only `blog_post | gallery_album | event_series`:
  - `web/src/app/api/admin/organizations/route.ts:11`

### B) Schema also enforces series-only event links

- `organization_content_links.link_type` check excludes direct event links:
  - `supabase/migrations/20260318234500_organization_content_links.sql:8`
- Public policy validates `event_series` via `events.series_id`:
  - `supabase/migrations/20260318234500_organization_content_links.sql:61`
  - `supabase/migrations/20260318234500_organization_content_links.sql:65`

### C) Public Friends pages consume only `event_series` links

- Directory page maps related content by `link_type === "event_series"`:
  - `web/src/app/friends-of-the-collective/page.tsx:416`
- Profile page maps related content by `link_type === "event_series"`:
  - `web/src/app/friends-of-the-collective/[slug]/page.tsx:333`

### D) Manager (non-admin) org editor cannot currently edit member/content links

- Manager edit form sends only base org fields; no `member_tags`/`content_links` payload:
  - `web/src/app/(protected)/dashboard/my-organizations/[id]/_components/OrganizationEditForm.tsx:68`
- Manager PATCH API only accepts `MANAGER_EDITABLE_FIELDS` and rejects empty updates:
  - `web/src/app/api/my-organizations/[id]/route.ts:5`
  - `web/src/app/api/my-organizations/[id]/route.ts:83`

### E) Tag-add email + self-removal path do not currently exist

- Member tags table/policies exist for admin/managers but no user self-removal policy:
  - `supabase/migrations/20260318154500_friends_host_spotlight_and_member_tags.sql:58`
  - `supabase/migrations/20260318154500_friends_host_spotlight_and_member_tags.sql:120`
- Invite flow has email sending infra and accepted-notification pattern we can reuse:
  - `web/src/app/api/my-organizations/[id]/invite/route.ts:147`
  - `web/src/app/api/organization-invites/accept/route.ts:112`

### F) Claim CTA currently routes to dashboard, not feedback

- Card CTA points to `/dashboard/my-organizations`:
  - `web/src/app/friends-of-the-collective/page.tsx:646`
- Profile CTA points to `/dashboard/my-organizations`:
  - `web/src/app/friends-of-the-collective/[slug]/page.tsx:424`
- Feedback page already supports query-based prefill (`category`, `subject`, `pageUrl`):
  - `web/src/app/feedback/page.tsx:39`
  - `web/src/app/feedback/page.tsx:43`

### G) Data fields for "tied to tagged members" filtering are available

- Blog ownership: `blog_posts.author_id`:
  - `web/src/lib/supabase/database.types.ts:296`
- Gallery ownership: `gallery_albums.created_by`:
  - `web/src/lib/supabase/database.types.ts:1605`
- Event ownership/hosts: `events.host_id`, `event_hosts.user_id`:
  - `web/src/lib/supabase/database.types.ts:1191`
  - `web/src/lib/supabase/database.types.ts:596`

## Coupling Critique

1. **Schema + API + UI coupling is tight around `event_series`**
   - Changing to direct event links touches migration constraints/policies, API normalization, admin UI selects, manager UI, and Friends page renderers.
2. **Manager restrictions are app-layer today**
   - Current manager PATCH endpoint has no relation-link support; adding it introduces role-specific filtering + validation logic that must be authoritative server-side.
3. **Tagging notifications couple with mutation path**
   - Email notices should trigger only for newly added member tags, which requires diffing before/after tag sets in both admin and manager update surfaces.
4. **Self-removal is policy-coupled**
   - To make self-removal simple and safe, DB policy for `organization_member_tags` should allow deletion by `profile_id = auth.uid()` in addition to manager/admin policies.

## Risks

1. **Blocking / correctness**: managers could bypass UI filtering via crafted requests unless PATCH performs strict server-side validation of member/content links against tagged-member ownership.
2. **Blocking / correctness**: migrating content link type handling may hide existing linked series on public pages if renderer/API compatibility is not preserved.
3. **Non-blocking / correctness**: tag-add email fanout could fail partially and block saves if not isolated from primary transaction/update flow.
4. **Non-blocking / cosmetic**: claim CTA change could regress existing tests/wording if only one Friends surface is updated.

## Proposed Delta Plan (In-Scope)

1. **Add direct event link support while preserving existing series links**
   - Migration updates `organization_content_links` check constraint to include `event`.
   - Public select policy accepts `link_type='event'` via `events.id::text = target_id` and public/published checks.
   - Keep `event_series` behavior intact for backward compatibility.

2. **Add manager relation editing with scoped options**
   - Extend manager edit surface to include Tagged Members + Related Content (blog/gallery/event).
   - Add manager options API returning:
     - members: all profiles (for tagging)
     - content options: blogs/galleries/events filtered to tagged member IDs (for non-admin), all for admin.
   - Enforce same restriction in PATCH regardless of client.

3. **Notify tagged members and enable easy self-removal**
   - On tag sync, detect newly added profile IDs; send notification emails to `profiles.email` when present.
   - Add self-removal policy for tagged members (`DELETE` allowed when `profile_id = auth.uid()`).
   - Add a minimal authenticated endpoint + confirmation route/button flow linked from email to remove own tag quickly.

4. **Change claim/update CTA to feedback-prefill deep link**
   - Update both Friends directory and profile CTA destinations to `/feedback?category=feature&subject=...&pageUrl=...`.

## Migrations Required

Yes.

1. `organization_content_links` check/policy update for new `event` link type.
2. `organization_member_tags` self-delete policy for tagged users.

Both are additive and reversible via follow-up migration.

## Rollback Plan

1. Revert UI/API changes in a single rollback commit.
2. Ship a rollback migration that:
   - removes `event` path from policy and check constraint,
   - removes self-delete policy for tagged members.
3. Existing `event_series` links remain valid throughout.

## Test Impact

Add/update tests for:

1. Admin org portal copy + event selector expectation (`Add event...` vs series-only wording).
2. Manager PATCH authorization: rejects content links not tied to tagged members.
3. Manager PATCH authorization: accepts links tied to at least one tagged member.
4. Member tag add workflow: sends notification email (or non-blocking failure behavior).
5. Self-removal endpoint: tagged user can remove own tag; others cannot.
6. Friends CTA links now target feedback-prefill URL.

## Open Assumption

Assumption: your "any event" requirement is event-level linking (individual events), not series-only linking.

If approved, implementation will support both legacy `event_series` and new `event` link type so existing data keeps working.

## Approval Gate

Per governance stop-gate, implementation is paused pending explicit approval to execute this plan.

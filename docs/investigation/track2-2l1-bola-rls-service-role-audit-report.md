# Track 2 2L.1 BOLA/RLS/Service-Role Audit Report

Status: Investigation only
Runtime behavior changed: No
Base inspected: `10e2427faa9c8ce849a4630f8c603ccfb0a6b305`
Branch: `codex/track2-2l1-bola-rls-service-role-audit`

This report is the 2L.1 audit artifact required by
`docs/investigation/track2-2l0-bola-rls-service-role-audit-adr.md`. It inventories
ID-bearing Track 2 routes, helpers, service-role usage, RLS assumptions, public/private
resource boundaries, test coverage, and remediation blockers. It does not remediate any
finding.

Evidence basis:

- Required orientation docs were read: `AGENTS.md`, `docs/GOVERNANCE.md`,
  `docs/investigation/track2-roadmap.md`,
  `docs/investigation/agent-concierge-unification-plan.md`, and
  `docs/investigation/track2-2l0-bola-rls-service-role-audit-adr.md`.
- Source inventory was read from `web/**`, `supabase/migrations/**`, `docs/**`, and
  `tools/**`.
- No live Supabase policy query was run from this clone because `web/.env.local` is not
  present. The RLS inventory below is therefore source/migration based and must be
  confirmed with live `pg_policies` and anon/authenticated smoke queries before any RLS
  remediation PR is closed.

## 1. Summary

The current Track 2-relevant event edit surfaces are not open write surfaces. Existing
event AI interpretation is authenticated and calls `canManageEvent()` before loading
current event context (`web/src/app/api/events/interpret/route.ts:2182`,
`web/src/app/api/events/interpret/route.ts:2282`). Existing event apply is still routed
through existing host/admin edit endpoints, with the published-event high-risk AI gate in
`web/src/app/api/my-events/[id]/route.ts:53` and `web/src/app/api/my-events/[id]/route.ts:711`.

The largest BOLA risk is not a single uncovered current route. It is that Track 2 plans to
add more ID-bearing endpoints for agent search, cancel, URL extraction, import records,
analytics, and public AI-shaped reads. Those future endpoints must not assume that
Supabase RLS is the primary authorization boundary when they use service-role clients.
`web/src/lib/supabase/serviceRoleClient.ts:4` explicitly documents that service-role
clients bypass all RLS, and the roadmap calls this out as the reason for Track 2 2L.

Current code has several strong local authorization patterns:

- `canManageEvent()` authorizes site admins, primary hosts, and accepted event hosts for
  event management (`web/src/lib/events/eventManageAuth.ts:8`).
- `canEditEventVisibility()` narrows visibility changes to admins, primary hosts, and
  accepted primary hosts (`web/src/lib/events/eventManageAuth.ts:39`).
- Attendee invite management excludes cohosts and requires admin or primary host
  (`web/src/app/api/my-events/[id]/attendee-invites/route.ts:33`).
- Venue editing requires admin, an active venue manager grant, or an event host/cohost at
  the venue (`web/src/lib/venue/managerAuth.ts:198`).
- Organization manager routes require an active organization manager grant or admin
  (`web/src/app/api/my-organizations/[id]/route.ts:176`).

The audit still finds blockers before Track 2 implementation proceeds:

- There is no single enforced BOLA test matrix covering every Track 2 ID-bearing route,
  helper, worker, and future route family.
- Service-role usage is broad and not tracked in a required manifest or per-route
  negative test suite.
- Future resource families named by Track 2, including import runs, source records,
  analytics events, festivals, and first-class performers, do not yet have implemented
  RLS, ownership rules, or negative tests.
- Public serialization cannot rely on table RLS alone. Existing public routes often use
  allowlisted query shapes, but future `/events.json`, JSON-LD, and AI-shaped endpoints
  need schema-driven public serializers and explicit tests from 2I.
- Live RLS policy verification remains open because this report did not connect to the
  database.

## 2. Route/worker/helper inventory

This section groups the current and planned Track 2-relevant surfaces by resource family.
It focuses on routes, workers, helpers, and server actions that carry object IDs or can
reach object IDs.

| Surface | Current routes/helpers | Current authorization boundary | Service-role/RLS note | Track 2 assessment |
| --- | --- | --- | --- | --- |
| Existing-event AI interpret | `POST /api/events/interpret` in `web/src/app/api/events/interpret/route.ts` | Requires authenticated Supabase user, rate limit, edit mode `eventId`, and `canManageEvent()` before current event context is loaded (`route.ts:2207`, `route.ts:2213`, `route.ts:2275`, `route.ts:2282`) | Uses request-scoped Supabase client for auth and context. No write occurs in the route. | Acceptable read/preview boundary for current disabled-write state. Future 2F apply must add a narrower server write gate rather than treating LLM output as trusted. |
| Existing-event series write | `GET/PATCH/DELETE /api/my-events/[id]` in `web/src/app/api/my-events/[id]/route.ts` | Requires auth and `canManageEvent()` for read/write/delete (`route.ts:314`, `route.ts:321`, `route.ts:394`, `route.ts:401`, `route.ts:1125`, `route.ts:1132`). Visibility changes also require `canEditEventVisibility()` (`route.ts:427`). | Mostly request-scoped client. Service-role appears in helper paths for venue resolution/promotion elsewhere, not as the main event update client. | Current human endpoint is covered by server checks, but future AI apply must use 2F field/risk/confirmation rules before reaching this broad update path. |
| Existing-event occurrence write | `GET/POST/DELETE /api/my-events/[id]/overrides` in `web/src/app/api/my-events/[id]/overrides/route.ts` | `checkOverrideAuth()` allows admin, primary host, or accepted event host (`route.ts:120`). It gates GET, POST, and DELETE (`route.ts:150`, `route.ts:195`, `route.ts:530`). | Uses request-scoped client for override upsert/delete. | Good current server-side event ownership check. Needs cross-event negative tests for future AI occurrence apply and cancel. |
| Existing-event telemetry | `POST /api/events/telemetry/edit-turn`, `POST /api/events/telemetry` | Both require authenticated user before emitting telemetry (`edit-turn/route.ts:37`, `telemetry/route.ts:34`). | No database write in current implementation. | Low BOLA risk today. Future 2K analytics must use event registry, redaction, bot filtering, and small-count suppression. |
| Event creation and venue promotion | `POST /api/my-events` in `web/src/app/api/my-events/route.ts` | Requires auth (`route.ts:498`), uses host/admin checks for CSC/admin-only fields (`route.ts:506`, `route.ts:529`), and inserts events with `host_id` set to the session user (`route.ts:305`, `route.ts:982`). | Admin-only canonical venue creation uses service-role after ambiguity checks (`route.ts:701`, `route.ts:726`). | No object-level BOLA on event ID because it creates a new event, but venue auto-promotion requires regression tests before 2J URL-paste creates venues. |
| Cohost management | `POST/DELETE /api/my-events/[id]/cohosts` | POST requires admin or accepted host/cohost on that event (`cohosts/route.ts:20`). DELETE narrows non-admin removal: accepted primary host for removing others, self-removal for own row (`cohosts/route.ts:249`, `cohosts/route.ts:275`). | Uses service-role for profile lookup, event host insert/delete, and host promotion after server auth (`cohosts/route.ts:48`, `cohosts/route.ts:90`, `cohosts/route.ts:231`). | Covered by local checks, but service-role writes need route-level negative tests for cross-event and pending-host cases. |
| Attendee invites | `GET/POST/PATCH /api/my-events/[id]/attendee-invites` | `checkAttendeeInviteAuth()` allows admin or primary host only; cohosts excluded (`attendee-invites/route.ts:33`). PATCH verifies `invite_id` belongs to `event_id` (`attendee-invites/route.ts:576`). | Uses service-role for invite reads/writes and auth-admin email resolution after server auth (`attendee-invites/route.ts:69`, `attendee-invites/route.ts:144`, `attendee-invites/route.ts:435`). | One of the better-documented current boundaries. Keep as model for future per-resource BOLA tests. |
| Public event detail/read | `web/src/app/events/[id]/page.tsx`, `GET /api/events/[id]/rsvp`, `GET/POST /api/events/[id]/comments`, embeds, OG routes | Detail page redirects unpublished events unless admin/host/accepted host (`events/[id]/page.tsx:365`) and gates invite-only with admin/host/accepted host or `checkInviteeAccess()` (`events/[id]/page.tsx:390`). RSVP/comments check event access and invitee access before private event access (`rsvp/route.ts:122`, `comments/route.ts:127`). Embed and OG require published public events (`embed/events/[id]/route.ts:367`, `og/event/[id]/route.tsx:34`). | Event page uses service-role only for slug redirect lookup, then re-fetches the target event with the request-scoped client (`events/[id]/page.tsx:308`). | Current private-read behavior has focused tests. Future public `/events.json` and JSON-LD must use explicit public-safe serializers rather than raw event rows. |
| Event claims, RSVPs, comments, watchers | `/api/events/[id]/claim`, `/api/events/[id]/rsvp`, `/api/events/[id]/comments`, `/api/events/[id]/watch` | Claims require authenticated user and user-scoped event fetch (`claim/route.ts:60`, `claim/route.ts:78`). RSVP/comments require auth for writes and access checks for invite-only events. | Some service-role use exists for admin email fanout and invite-only fallback reads. | Covered enough for current user workflows, but Track 2 should add a consolidated matrix for unauthenticated, non-owner, invitee, cohost, primary host, and admin. |
| Venue management | `GET/PATCH /api/venues/[id]`, `DELETE /api/my-venues/[id]`, admin venue routes | Public GET allowlists venue fields (`venues/[id]/route.ts:31`). PATCH requires auth and either `canEditVenue()` or admin (`venues/[id]/route.ts:75`, `venues/[id]/route.ts:92`). `DELETE /api/my-venues/[id]` requires active venue grant and protects sole owners (`my-venues/[id]/route.ts:26`, `my-venues/[id]/route.ts:42`). | Venue PATCH uses service-role because venue update RLS is admin-only (`venues/[id]/route.ts:140`). `canEditVenue()` grants event hosts/cohosts at the venue (`managerAuth.ts:198`). | Boundary is intentional but broad. Future 2J venue enrichment and 2D import must test manager vs unrelated host vs event host at another venue. |
| Organization management | `GET/PATCH/DELETE /api/my-organizations/[id]`, admin org routes, org invite routes | `getActiveGrant()` checks organization manager grant (`my-organizations/[id]/route.ts:176`). GET/PATCH allow admin or manager; DELETE requires active grant and protects sole owner (`my-organizations/[id]/route.ts:701`, `my-organizations/[id]/route.ts:749`, `my-organizations/[id]/route.ts:899`). | Service-role is used for relation fetches, tag/content sync, and content existence checks after auth (`my-organizations/[id]/route.ts:724`, `my-organizations/[id]/route.ts:786`). | Needs cross-organization tests for manager trying to link unrelated member/content records, especially if Track 2 adds org-aware import or public AI endpoints. |
| Admin ops import/apply | `/api/admin/ops/events/*`, `/api/admin/ops/overrides/*`, `/api/admin/ops/venues/*` | Admin checks precede service-role operations in inspected routes (`import-apply/route.ts:28`, `import-preview/route.ts:23`, `events/apply/route.ts:21`). | Service-role is used for dedupe, venue validation, event/override/venue updates, and ops audit (`import-apply/route.ts:87`, `events/apply/route.ts:80`, `events/apply/route.ts:158`). | Admin-only posture is clear, but negative tests for non-admin and malformed cross-resource IDs are not yet centralized. Future 2D import surfaces must not skip this gate. |
| Email, notification, audit, and logging helpers | `web/src/lib/email/*`, `web/src/lib/audit/*`, `web/src/lib/notifications/*`, `web/src/lib/eventUpdateSuggestions/server.ts` | Called from routes/helpers that are expected to have already authorized the actor. | Several helpers use `getServiceRoleClient()` or accept a service-role client to bypass RLS for fanout, audit, or durable notification writes. | Treat as secondary service-role sinks. Future work should document every caller and require caller-side auth before helper invocation. |
| Cron and scheduled workers | `web/src/app/api/cron/weekly-happenings/route.ts`, `web/src/app/api/cron/weekly-open-mics/route.ts` | Protected by route-level cron/shared-secret style checks, not user ownership. | Service-role is used for digest data and email fanout in related digest routes. | Not direct Track 2 edit surfaces, but future analytics retention jobs from 2K need similar explicit auth and bounded service-role access. |
| Server actions | `web/src/app/(protected)/dashboard/admin/users/actions.ts` | Uses `"use server"` and verifies super-admin/admin before privileged user operations (`actions.ts:1`, `actions.ts:208`). | Uses `createServiceRoleClient()` and `auth.admin` APIs for user deletion/admin role changes (`actions.ts:276`, `actions.ts:299`, `actions.ts:362`). | Out of current Track 2 resource scope, but demonstrates that Supabase auth-admin APIs are present and must be included if Track 2 adds server actions. |
| Future Track 2 agent endpoints | Planned `find-candidates`, `cancel`, `url-extract`, `answer`, `/events.json`, analytics endpoints, import runs, source records | Not implemented in current source. Planned in `docs/investigation/agent-concierge-unification-plan.md` and `docs/investigation/track2-roadmap.md`. | RLS and service-role model absent because resources/routes do not exist. | Blocking design requirement: define ownership, RLS, service-role policy, rate limits, and negative tests before implementation. |

## 3. RLS inventory

This inventory is based on migration/source inspection only. It must be confirmed against
the live database before any policy remediation is accepted.

| Resource family | Current migration/source evidence | Current assumption | Audit result |
| --- | --- | --- | --- |
| `events` | Early public read policy allowed broad select (`supabase/migrations/20251212000003_security_remediation.sql:121`). Private events foundation replaced it with visibility-aware policy (`20260218030000_private_events_foundation.sql:153`), then recursion hotfix removed invitee policy recursion and left public/host/cohost/admin access (`20260218032000_fix_private_events_rls_recursion.sql:14`). | RLS handles public/host/cohost/admin visibility, but invitee access is app-layer via `checkInviteeAccess()`. | Acceptable as defense-in-depth, not sufficient for future public APIs. Live policy body must be confirmed because migration history includes superseded policies. |
| `event_hosts` | RLS enabled in host permission migration (`20251209100002_host_permission_system.sql:88`). Later fix allowed anyone to view event hosts and limited inserts to approved hosts/admin (`20251210000002_fix_event_hosts_rls.sql:14`, `20251210000002_fix_event_hosts_rls.sql:20`). | Event host rows are intentionally visible enough for public display and auth checks. | Public visibility of event host membership is expected, but future APIs must avoid leaking private invite/admin context through expanded joins. |
| `event_attendee_invites` | RLS enabled and policies added for admin, primary host, and invitee read/respond (`20260218030000_private_events_foundation.sql:96`, `20260218030000_private_events_foundation.sql:102`, `20260218030000_private_events_foundation.sql:120`, `20260218030000_private_events_foundation.sql:138`). Recursion hotfix moved invitee event visibility out of `events` RLS (`20260218032000_fix_private_events_rls_recursion.sql:1`). | App-layer invitee access is canonical for private event reads. | Good historical hardening. Needs live anon/auth smoke and cross-event invite ID tests for future 2F/2D surfaces. |
| `venues` | Public select policy exists from security remediation (`20251212000003_security_remediation.sql:128`). Venue manager grants and claims have their own RLS (`20260112000000_abc8_venue_claiming.sql:47`, `20260112000000_abc8_venue_claiming.sql:111`). | Public venues are broadly readable; venue writes are server-mediated, often with service-role after `canEditVenue()`. | Public reads require serializer allowlists. Venue writes require negative tests for unrelated managers and unrelated event hosts. |
| `venue_managers`, `venue_claims`, `venue_invites` | Venue managers: own/admin policies (`20260112000000_abc8_venue_claiming.sql:47`). Venue claims: own/admin policies (`20260112000000_abc8_venue_claiming.sql:111`). Venue invites originally had broad token lookup (`20260112000000_abc8_venue_claiming.sql:205`), later tightened to manager/addressed-user access (`20260112100000_abc10b_tighten_venue_invites_rls.sql:1`, `20260112100000_abc10b_tighten_venue_invites_rls.sql:18`). | Grant and invite access is intended to be private except addressed users/managers/admin. | Good remediation history. Future URL/import venue workflows must not reintroduce token or email enumeration paths. |
| `organizations` | Directory RLS allows public select only for active/public organizations and admin manage (`20260317201000_organizations_directory.sql:33`, `20260317201000_organizations_directory.sql:35`). Manager policies added later (`20260317224500_organizations_claims_and_managers.sql:119`). | Public directory data is public-safe; manager/admin writes are server and RLS mediated. | Needs route tests for cross-org manager reads/writes and public serializer tests for any AI-shaped org response. |
| `organization_managers`, `organization_claims`, `organization_invites` | Managers and claims RLS in `20260317224500_organizations_claims_and_managers.sql:31` and `:80`; invites RLS in `20260318030500_organization_invites.sql:34`. | Managers/admins can manage org-private rows; users can act on addressed invite flows through server routes. | Needs live policy confirmation and negative tests for manager from org A trying org B resources. |
| `organization_member_tags` | RLS enabled and public select limited to public org plus public profile (`20260318154500_friends_host_spotlight_and_member_tags.sql:28`, `:30`). Manager/admin policies follow (`:50`, `:65`). | Public tag exposure is constrained to public org/profile state. | Good shape for 2I, but future public API serializers should still avoid raw rows. |
| `organization_content_links` | RLS enabled (`20260318234500_organization_content_links.sql:24`). Public select handles active public org and published `blog_post`, `gallery_album`, or `event_series` link types (`:39`). Manager policies follow (`:88`). | Public content links are intended to show only published/public content. | Non-blocking consistency gap: route input permits `event` links, but the public RLS policy evidence found only `blog_post`, `gallery_album`, and `event_series`. Confirm live policy and desired behavior before Track 2 uses public org event links. |
| `events_interpret_rate_limits` | RLS enabled; table access revoked from public roles and mediated through SECURITY DEFINER RPC (`20260223170000_events_interpret_rate_limit.sql:20`, `:22`, `:72`). | Rate-limit table is not public and is accessed only through RPC. | Good pattern for future Track 2 rate-limit tables. |
| `event_slug_redirects` | RLS enabled in migration (`20260222160000_event_slug_redirect_history.sql:17`). Public event page uses service-role for lookup, then request-scoped event fetch (`web/src/app/events/[id]/page.tsx:308`). | Redirect lookup intentionally bypasses RLS but does not itself disclose event content. | Needs explicit test/documentation because service-role masks whether public select is unavailable. |
| Future import/source/analytics/festival/performer resources | Roadmap names future import runs, source records, analytics events, festivals, and performers. Source search did not find current first-class Track 2 implementations for import runs/source records/analytics events/safe fetch/event JSON endpoint. | No current RLS to inspect. | Blocking before implementation: each table needs owner/admin/service-worker policy, public serializer policy, and cross-user negative tests. |

## 4. Service-role/admin-client inventory

`web/src/lib/supabase/serviceRoleClient.ts:4` is the canonical helper and warns that the
client bypasses all RLS. Current usage is widespread, so Track 2 should treat service-role
as a privileged sink that must only be reachable after route-local authorization.

| Category | Representative evidence | Bypass risk | Required future control |
| --- | --- | --- | --- |
| Service-role helper | `createServiceRoleClient()` and `getServiceRoleClient()` in `web/src/lib/supabase/serviceRoleClient.ts:29` and `:59` | Any caller can bypass table RLS if invoked before server auth. | Maintain a service-role manifest with route/helper, actor check, resource check, tables touched, write/read purpose, audit trail, and tests. |
| Admin pages and admin routes | Admin ops, admin venues, admin orgs, admin users, admin event suggestions, digest routes | Admin check must happen before service-role access. A missing admin gate becomes full RLS bypass. | Add route tests for unauthenticated and non-admin access to every admin route that uses service-role. |
| Event admin ops/import | `admin/ops/events/import-apply` and `admin/ops/events/apply` use service-role for dedupe, venue validation, updates, and audit after admin checks | Bulk writes can cross many event IDs. | Require admin negative tests, max batch limits, audit evidence, and per-record failure behavior before 2D import implementation expands this area. |
| Host event helpers | Cohost and attendee-invite routes use service-role after event ownership checks | Cross-event ID mistakes can mutate another event because RLS will not stop the service-role write. | Add tests that valid actor for event A cannot mutate event B with event B IDs in body/path. |
| Venue edit | Public venue PATCH uses service-role after `canEditVenue()` because venue update RLS is admin-only | A bug in `canEditVenue()` or venue/event relationship checks can permit venue edits beyond owner intent. | Add matrix tests for admin, venue manager, event host at same venue, cohost at same venue, event host at different venue, unrelated user. |
| Organization management | My-organization routes use service-role for relation fetches and sync after active grant/admin checks | Cross-org manager mistakes can expose or modify tags/content links across organizations. | Add cross-org manager negative tests and content ownership tests. |
| Public read pages using service-role | Friends of the Collective pages and gallery invite lookup use service-role in server-rendered public contexts | Public route can leak private columns if query shape is not explicitly constrained. | Require schema-driven public serializers or narrow select lists and tests proving private fields never render. |
| Email/notification/audit helpers | `web/src/lib/email/*`, `web/src/lib/audit/*`, `web/src/lib/eventUpdateSuggestions/server.ts` | Helpers may be callable from multiple routes and assume caller authorization. | Document caller contract and add tests at caller routes, not only helper unit tests. |
| Supabase auth-admin APIs | Admin user server action uses `serviceClient.auth.admin.getUserById()` and `deleteUser()` (`dashboard/admin/users/actions.ts:299`, `:362`) | Auth-admin bypass is stronger than table service-role because it changes auth users. | Out of Track 2 current scope, but any future Track 2 server action using auth-admin must be stop-gated and super-admin/admin tested. |
| Future analytics retention/import workers | Not implemented for 2K/2D | Scheduled jobs will likely need service-role. | Worker auth, idempotency, bounded table access, audit logs, and retention deletion tests are required before shipping. |

## 5. Access matrix by resource family

Legend: Allow = intended access in current or required future design. Deny = must return
404/403/401 without disclosing private resource state. Future = not implemented yet.

| Resource family | Public/anon | Auth unrelated user | Invitee | Accepted cohost | Primary host | Venue/org manager | Site admin | Service worker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public event read | Allow for published public events only | Allow for published public events only | Allow for published public events only | Allow for own event, including private where relevant | Allow for own event | No special access unless event relation grants it | Allow | Read only through explicit public serializer or admin worker contract |
| Invite-only event read | Deny | Deny unless accepted invitee | Allow via app-layer `checkInviteeAccess()` | Allow for event | Allow for event | Deny unless separate event relation | Allow | Only through bounded maintenance job |
| Draft/unpublished event read | Deny | Deny | Deny | Allow for event | Allow for event | Deny unless separate event relation | Allow | Only through bounded maintenance job |
| Event series write | Deny | Deny | Deny | Allow today through `canManageEvent()`, except visibility is narrower | Allow | Deny unless also host/cohost/admin | Allow | Future jobs only with explicit operation manifest |
| Event visibility/publish write | Deny | Deny | Deny | Deny unless accepted primary host role | Allow | Deny | Allow | Future jobs only with explicit operation manifest |
| Occurrence override write | Deny | Deny | Deny | Allow for event | Allow | Deny unless event relation | Allow | Future jobs only with explicit operation manifest |
| Cancel/delete event | Deny | Deny | Deny | Current soft-cancel/delete path is gated by `canManageEvent()` | Allow | Deny unless event relation | Allow | Future cancel worker must use 2F.0/2L policy |
| Attendee invites | Deny | Deny | Invitee can read/respond own invite through invitee flows | Deny for manager UI | Allow | Deny | Allow | Bounded notification/import jobs only |
| Cohost rows | Public visibility may exist for public display | Deny writes | Deny writes | Current accepted cohost can invite; removing others is narrower | Allow | Deny | Allow | Bounded migration/audit jobs only |
| Venue public profile | Allow public-safe fields | Allow public-safe fields | Allow public-safe fields | Allow public-safe fields; edit if cohost at venue under current helper | Allow public-safe fields; edit if host at venue under current helper | Allow edit for active venue manager | Allow | Future import/URL enrich only through safe gate |
| Venue private manager/invite data | Deny | Deny unless addressed invite | Deny | Deny unless active manager relation | Deny unless active manager relation | Allow for managed venue | Allow | Bounded maintenance job only |
| Organization public profile | Allow active/public public-safe fields | Allow active/public public-safe fields | No special access | No special access | No special access | Allow private manager view/write for managed org | Allow | Future import/public API must serialize |
| Organization private manager/tag/content management | Deny | Deny | Deny | Deny | Deny | Allow for managed org | Allow | Bounded maintenance job only |
| Import run | Future | Future deny unless owner/admin/service worker | Future | Future | Future allow only if owner/host scope matches imported event set | Future if org/venue scoped | Future allow | Future allow through job identity and audit |
| Source record | Future public only if promoted/cited and safe | Future deny unless owner/admin/service worker | Future | Future | Future allow only for owned import/run | Future if scoped | Future allow | Future allow through job identity and audit |
| Analytics event/raw metrics | Deny | Deny | Deny | Deny | Aggregate only if authorized dashboard | Aggregate only if authorized dashboard | Aggregate dashboard with small-count suppression | Retention/aggregation only |
| Festival/performer first-class records | Future public-safe only | Future private fields deny | Future | Future depending on ownership | Future depending on ownership | Future depending on org/venue relation | Future allow | Future only through scoped jobs |

## 6. Negative test coverage gaps

Existing useful coverage:

- `web/src/__tests__/pr6-negative-privilege-matrix.test.ts` covers private event read
  behavior across anon, non-invitee, accepted invitee, host/cohost, and admin for detail,
  RSVP, comments, search, OG, and embed surfaces.
- `web/src/__tests__/pr4-read-surface-hardening.test.ts` checks public read surfaces for
  visibility filters and confirms the RLS recursion fix shape.
- `web/src/__tests__/pr3-attendee-invite-management.test.ts` checks attendee invite
  authorization, host/admin-only management, invite caps, and event-scoped revoke.
- `web/src/__tests__/pr5-invitee-access.test.ts` checks invitee access revalidation,
  token accept behavior, detail/RSVP/comment gates, and no RLS graph changes.
- `web/src/__tests__/phase4-98-host-cohost-equality.test.ts` checks important cohost
  management contracts.
- `web/src/__tests__/phase0-6-venue-host-editing.test.ts` and
  `web/src/__tests__/my-events-venue-promotion-behavior.test.ts` cover venue editing and
  venue promotion contracts.

Coverage gaps that should block Track 2 implementation until assigned:

- No generated or manually maintained matrix proves every ID-bearing Track 2 route
  rejects cross-user and cross-resource access.
- No single test suite asserts that every service-role route performs route-local auth
  before the first service-role read/write.
- No cross-event AI apply negative tests exist for future 2F.1 because existing-event AI
  apply remains disabled.
- No future cancel endpoint tests exist for cross-event cancel, cancelled-occurrence
  scoping, confirmation enforcement, audit trail, and rollback affordance.
- No future URL/import tests exist for import-run owner vs unrelated user, source-record
  owner vs unrelated user, venue/org ownership inheritance, and service-worker-only
  mutation.
- No future analytics tests exist for raw event isolation, small-count suppression,
  GPC opt-out, bot/internal filtering, and dashboard authorization.
- No future public API tests exist for `/events.json`, AI-shaped public query endpoints,
  JSON-LD public-safe field allowlists, cancelled-event semantics, and citation stability.
- Admin ops import/apply routes need explicit route tests for unauthenticated users,
  non-admin users, malformed IDs, cross-resource batch entries, and audit-log evidence.
- Organization manager routes need route tests proving a manager of organization A cannot
  read, link, or mutate organization B resources.
- Venue manager/host edit routes need route tests proving an event host at venue A cannot
  edit venue B and that revoked managers lose access immediately.

## 7. Blocking gaps

1. Create and enforce a Track 2 BOLA route matrix before new ID-bearing endpoints ship.
   The matrix must list route, method, path/body/query IDs, resource family, allowed
   actors, denied actors, ownership helper, service-role usage, expected status, and test
   file.

2. Add a service-role/admin-client manifest before expanding 2D/2F/2J/2K. The manifest
   must include every `createServiceRoleClient()`, `getServiceRoleClient()`, and
   `auth.admin` usage reachable from Track 2 routes/workers/helpers, with caller-side auth
   evidence and tests.

3. Keep existing-event AI apply disabled until 2F.0 and this 2L.1 report are followed by
   implementation PRs that enforce server-decided writable fields, risk tier,
   confirmation, audit, rollback, and kill switch behavior. `canManageEvent()` alone is
   not a sufficient future AI write boundary because LLM output is untrusted and field
   risk varies.

4. Design RLS and server ownership for future import runs, source records, analytics
   events, festivals, and performer resources before creating endpoints. These resources
   currently have no implemented policy set to audit.

5. Confirm live RLS policy state with `pg_policies` plus anon/authenticated smoke queries
   before policy changes or Track 2 public/API expansion. Migration history is not enough
   because several policies were superseded by later hotfixes.

6. Require schema-driven public serializers for future `/events.json`, JSON-LD, public
   AI-shaped query endpoints, organization public data, venue public data, source records,
   and analytics aggregates. Public table RLS must not be treated as a column-level privacy
   boundary.

7. Add worker/job authorization design for future 2D imports, 2K retention/aggregation,
   and any background source revalidation. Service-role jobs need job identity, bounded
   table access, idempotency, audit, and negative tests.

## 8. Non-blocking follow-ups

- Confirm whether live admin RLS policies still depend on `auth.users.raw_app_meta_data`
  while app-layer admin checks use `profiles.role`. If both remain, document the split and
  add tests or migrate in a later approved remediation PR.
- Confirm the desired public behavior for `organization_content_links.link_type = 'event'`
  because current route code accepts `event` while the inspected public RLS policy evidence
  mentions `blog_post`, `gallery_album`, and `event_series`.
- Document the `event_slug_redirects` service-role lookup as an intentional public-page
  exception, including a test that redirect lookup does not disclose unpublished or
  invite-only event content.
- Normalize route helper names and comments so `canManageEvent()`,
  `canEditEventVisibility()`, `checkOverrideAuth()`, `checkAttendeeInviteAuth()`,
  `canEditVenue()`, and organization grant helpers are easy to map into the 2L matrix.
- Add source-level checks that new Track 2 routes with `[id]`, `eventId`, `venueId`,
  `organizationId`, `importRunId`, `sourceRecordId`, `analyticsEventId`, or arrays of IDs
  cannot be merged without matrix entries.
- Consider a docs-only owner glossary for primary host, accepted cohost, venue manager,
  organization manager, site admin, service worker, invitee, and public crawler.

## 9. Recommended remediation PR order

1. 2L.2: Track 2 BOLA matrix and test harness scaffold.
   Add a docs/test-owned matrix for current Track 2 route families and future planned
   route families. Start with event AI interpret/apply placeholders, my-events, overrides,
   cohosts, attendee invites, venue edit, organization edit, admin ops, public event reads,
   and future import/source/analytics rows.

2. 2L.3: Service-role/admin-client manifest and route assertion tests.
   Introduce a maintained manifest for service-role and auth-admin usage. Add tests that
   every Track 2 service-role route checks auth/ownership/admin before privileged access.

3. 2L.4: Current event/venue/org negative route tests.
   Fill cross-user and cross-resource tests for current ID-bearing routes, especially
   event override writes, cohost writes, attendee invite writes, venue manager/host edits,
   organization manager edits, and admin ops non-admin rejection.

4. 2L.5: Live RLS verification PR.
   Run `pg_policies` inventory and anon/authenticated smoke queries, then document or
   remediate live policy gaps under the governance RLS safety gate. Do not close this with
   policy-text inspection alone.

5. 2F.1 gate implementation can proceed only after 2F.0 approval and enough 2L matrix
   coverage exists for existing-event apply/cancel surfaces. It must use the server-side
   write gate, not direct trust in LLM output.

6. 2J.1 and 2D implementation can proceed only after their URL/import resources have
   matrix rows, ownership helpers, service-role entries, and cross-resource negative
   tests.

7. 2I and 2K implementation should proceed with serializer and analytics privacy tests
   alongside BOLA tests, because public data exposure and analytics isolation depend on the
   same resource boundary definitions.

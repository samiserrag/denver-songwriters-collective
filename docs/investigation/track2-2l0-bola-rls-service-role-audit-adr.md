# Track 2 2L.0: BOLA/RLS/Service-Role Audit ADR

**Date:** 2026-05-02
**Status:** Proposed - investigation only
**Scope:** Track 2 security ADR for future BOLA, RLS, and service-role audit
**Runtime behavior changed:** No
**Needs Sami approval before implementation:** Yes

---

## 1. Purpose

This ADR defines the required future audit plan for Track 2 object-level
authorization, Supabase RLS assumptions, and service-role usage before future
Track 2 implementation or remediation work proceeds.

The central decision: **every Track 2 route, worker, and server helper that
touches an object by ID must have documented, tested object-level authorization,
and every service-role bypass must have an explicit server-side authorization
gate.** RLS is defense-in-depth, not a substitute for route-level authorization
when server code uses privileged clients.

This PR is the stop-gate document only. It does not perform the audit, change
runtime code, add tests, edit RLS policies, add migrations, or remediate any
route.

---

## 2. Evidence and Current State

Governance evidence:

- `docs/GOVERNANCE.md:246-270` says policy, grant, and schema changes require
  migrations and stop-gate approval.
- `docs/GOVERNANCE.md:272-278` requires runtime RLS smoke queries as `anon` and
  `authenticated` for RLS policy changes, and says policy text checks alone are
  insufficient.
- `docs/GOVERNANCE.md:293-310` requires investigation claims to use concrete
  evidence and label unknowns with next steps.
- `docs/GOVERNANCE.md:387-395` allows investigation-only PRs under
  `docs/investigation/*.md` when they contain no code, migration, or config
  changes and are clearly labeled investigation-only.

Track 2 roadmap evidence:

- `docs/investigation/track2-roadmap.md:61` names 2L as the cross-cutting
  BOLA/RLS audit supporting the Track 2 graph.
- `docs/investigation/track2-roadmap.md:73-80` makes stewardship and security
  binding across Track 2, including public/private boundaries, human-in-the-loop
  writes, kill switches, rate limits, redaction, and retention.
- `docs/investigation/track2-roadmap.md:84-86` says every sub-track has a
  non-negotiable `.0` security ADR before implementation.
- `docs/investigation/track2-roadmap.md:459-469` defines 2L as the
  BOLA/RLS/service-role audit, names service-role bypass risk, and makes 2L.0
  the stop-gate before the audit begins.
- `docs/investigation/track2-roadmap.md:470-477` says 2L.1 must list every
  endpoint with an ID parameter, every RLS policy on public tables, every
  service-role/admin-client route, and flags BOLA, RLS, and service-role bypass
  as skipped-audit risks.
- `docs/investigation/track2-roadmap.md:481-495` includes 2L.0 in the
  cross-cutting security gates summary and requires rate limits and kill
  switches for new surfaces.
- `docs/investigation/track2-roadmap.md:577-600` says the security ADR phase
  blocks implementation, and that 2L.1 plus remediation run with endpoint work.
- `docs/investigation/track2-roadmap.md:742-747` defines Track 2 cross-cutting
  security completion as no unresolved BOLA/RLS/service-role gaps, documented
  object-level authorization for every ID endpoint, service-role rationale, and
  reviewed public RLS policies.
- `docs/investigation/track2-roadmap.md:762-780` allows Track 2 investigation
  docs and read-only schema audit queries, but requires explicit approval for
  migrations, new routes, read-path changes, import-pipeline changes, prompt
  rewrites, or runtime-affecting env vars.

Agent concierge plan evidence:

- `docs/investigation/agent-concierge-unification-plan.md:259-272` lists
  existing and proposed agent endpoints, including ID-bearing event,
  occurrence, cancel, URL-extract, candidate-search, and Q&A surfaces.
- `docs/investigation/agent-concierge-unification-plan.md:286-295` requires
  cancel to be permission-checked, confirmed, non-destructive, reversible, and
  tested against unauthorized events.
- `docs/investigation/agent-concierge-unification-plan.md:324-334` says the
  concierge architecture ADR must lock permissions for cross-event search.
- `docs/investigation/agent-concierge-unification-plan.md:545` says 2L.1
  BOLA/RLS/service-role audit should run in parallel with endpoint work.
- `docs/investigation/agent-concierge-unification-plan.md:581-590` requires
  explicit approval for all new endpoints, public routes, schema changes,
  cancel implementation, URL input implementation, and CRUI-touching UI work.

Current implementation state for this ADR:

- This PR is documentation only.
- No audit or remediation is performed.
- No runtime, schema, migration, prompt, contract, CRUI, `web/**`,
  `tools/symphony/**`, or `track1-claims.md` file is edited.

---

## 3. Decision Summary

Future 2L.1 audit work must produce a complete, evidence-backed inventory and
test plan before Track 2 endpoint implementation proceeds.

The required audit outputs are:

1. Route and worker inventory for every Track 2 surface that accepts, derives,
   reads, or mutates object IDs.
2. Object-level access matrix covering public, authenticated, host, cohost,
   organization, admin, worker, and service contexts.
3. Supabase RLS inventory for every public table touched by Track 2 routes,
   workers, dashboards, imports, analytics, source records, and public APIs.
4. Service-role/admin-client inventory with rationale, bypass risk, and
   server-side authorization evidence for every privileged usage.
5. Public/private resource boundary inventory for each resource type.
6. Negative test matrix for cross-user, cross-host, cross-resource, stale-role,
   mismatched-ID, and public/private access attempts.
7. Remediation criteria that block future implementation or merge when gaps are
   found.

2L.0 does not define a new runtime kill switch because it is an audit gate, not
an exposed feature surface. The audit must verify that route-specific kill
switches defined by 2F, 2I, 2J, and 2K ADRs are present where required.

---

## 4. Audit Scope

### 4.1 Surfaces to Inventory

The future 2L.1 audit must inspect every existing and planned Track 2 surface
that can be reached by a route, worker, scheduled job, server action, webhook,
admin action, or helper called by those entry points.

At minimum, the audit must cover:

- existing event create, edit, occurrence override, and telemetry routes that
  future 2F work extends
- future 2F agent routes for candidate search, apply, cancel, Q&A, and URL
  dispatch
- future 2I public event JSON-LD, `/events.json`, AI-shaped query endpoints,
  robots/crawler policy surfaces, and citation-stability redirects
- future 2J source URL, reverification, drift-detection, evidence package, and
  review-queue routes/workers
- future 2K analytics logging, dashboards, retention jobs, bot filtering, and
  aggregate reporting surfaces
- future graph/resource endpoints for venues, organizations, festivals,
  categories, performers, recurring series, import runs, source records, and
  analytics events
- any route that accepts an ID in path params, query params, request body,
  headers, cookies, or derived LLM/tool output
- any worker that takes IDs from a queue, cron job, admin action, import run, or
  source record

The audit must include implicit IDs, not only obvious `[id]` route segments.
Examples: `eventId`, `venueId`, `orgId`, `festivalId`, `performerId`,
`seriesId`, `importRunId`, `sourceRecordId`, `analyticsEventId`, `dateKey`,
slug-derived IDs, stable public IDs, and arrays of IDs.

### 4.2 Resource Types

The future audit must define object-level access rules for these resource
families before related implementation proceeds:

- events and event occurrences
- event hosts/cohosts and host invitations
- venues
- organizations
- festivals and festival relationships
- performers and performer relationships
- recurring series identities
- import runs, import candidates, and import review decisions
- known source URLs and source verification records
- drift evidence packages and review queue items
- analytics events, aggregate analytics, and dashboard slices
- public event/source representations exposed to humans, crawlers, or AI agents
- private host notes, drafts, invite-only data, emails, internal IDs, and
  operational/admin-only metadata

If a future Track 2 PR introduces a new resource family, it must either be added
to the 2L audit matrix first or ship with a documented 2L follow-up that blocks
merge until the matrix covers it.

---

## 5. Object-Level Authorization Model

### 5.1 Server-Side Ownership Checks

Every route or worker that reads or mutates non-public objects must establish
the acting principal and object relationship on the server.

The audit must record, per surface:

- how the user/session/service principal is authenticated
- which object ID is authoritative
- whether ID values from path, query, body, and derived candidate data must
  match
- which roles can read
- which roles can mutate
- which roles can administer
- which conditions downgrade, block, or require confirmation
- which tests prove unauthorized access is denied

Server logic must not trust client assertions such as `hostId`, `isAdmin`,
`orgRole`, `eventOwner`, `canManage`, `scope`, or LLM-provided target IDs.

### 5.2 Host, Cohost, and Admin Rules

The audit must explicitly distinguish:

- event owner/host via the canonical event ownership relationship
- accepted cohost with current permission to manage the event
- pending, rejected, removed, or expired cohost invitation
- organization owner/admin/member, if a route is organization-scoped
- site admin acting with elevated authority
- service worker acting under a scheduled or queue context
- anonymous public reader
- authenticated non-owner

For every writable route, the audit must identify whether the route requires:

- site admin
- event host
- accepted cohost
- organization owner/admin
- resource creator
- import-run owner
- service worker with prior object authorization
- public/anonymous access

Admin access is not a reason to skip tests. Admin-only paths still require
explicit auth checks, audit rationale, and negative tests proving ordinary
authenticated users cannot reach the path by ID guessing.

### 5.3 Public Versus Private Boundaries

The audit must separate public read behavior from authenticated/private behavior
for each resource type.

Public-safe data may be exposed only through allowlisted serializers or
documented public contracts. Private data must never leak through public,
crawler, AI-shaped, analytics, import, or source-verification responses.

Private or internal fields include, at minimum:

- drafts and unpublished events
- invite-only data
- private host notes
- email addresses
- raw analytics events
- user-level analytics records
- source-fetch raw observations not approved for public display
- import-run raw inputs and rejected candidates
- internal database IDs unless explicitly approved as stable public IDs
- service/debug metadata
- auth/session/security identifiers

Public endpoints with no authentication still need tests. The assertion is not
"auth blocks access"; the assertion is "the public serializer cannot expose
private fields or private rows."

---

## 6. RLS Audit Requirements

### 6.1 RLS Inventory

The 2L.1 audit report must list every public schema table relevant to Track 2,
including tables touched by existing Track 1 paths that future Track 2 work
extends.

For each table, the audit must record:

- whether RLS is enabled
- each policy name
- policy command: `select`, `insert`, `update`, `delete`, or `all`
- policy role: `anon`, `authenticated`, service-specific role, or other
- policy expression and `with check` expression summary
- migration file that introduced or last changed the policy
- whether policies reference other RLS-protected tables
- recursion risk
- runtime smoke evidence required for `anon` and `authenticated`
- whether server routes bypass the policy with service-role/admin clients

Any missing migration reference, unknown policy origin, or unclear runtime
behavior must be labeled `UNKNOWN` with the exact query or code inspection step
needed to resolve it.

### 6.2 RLS Versus Server Authorization

The future audit must classify each route and worker by the data-access mode it
uses:

- user-scoped Supabase client that relies on RLS
- anon/public Supabase client that relies on public RLS
- service-role/admin client that bypasses RLS
- direct SQL or database function
- mixed mode

For user/anon client routes, the audit must verify that RLS is strong enough for
the object being accessed. For service-role/admin/direct-SQL routes, the audit
must verify explicit server-side authorization before data access or mutation.

No route may claim "RLS protects this" if it uses a service-role/admin client
for the sensitive read or write.

### 6.3 Policy Change Gate

If the future audit discovers an RLS gap, remediation must ship separately from
this ADR and follow the governance migration rules:

- migration file under `supabase/migrations/`
- runtime smoke queries as `anon` and `authenticated`
- policy recursion review
- negative tests or SQL fixtures proving denied access
- clear rollback or forward-fix plan

The audit report may recommend policy changes. It must not apply them.

---

## 7. Service-Role and Admin-Client Audit Requirements

Service-role/admin clients bypass Supabase RLS. Every usage is therefore a
privileged boundary and must be justified.

The future audit must inventory every service-role/admin-client usage with:

- file path and line range
- route, worker, scheduled job, helper, or script entry point
- tables and operations touched
- whether the operation reads, writes, deletes, aggregates, or exports data
- why a user-scoped client cannot be used
- authenticated principal or service principal
- object-level authorization performed before access
- public/private fields touched
- expected denial behavior
- tests proving cross-user and cross-resource denial
- logging/audit evidence for privileged writes

Service-role usage is acceptable only when a server-owned process needs it and
the route performs explicit authorization before sensitive data is returned or
mutated. Convenience is not a sufficient rationale.

The audit must flag any privileged usage that:

- reads by arbitrary client-supplied ID before checking ownership
- writes by arbitrary client-supplied ID before checking ownership
- accepts body IDs that can disagree with path IDs
- joins private tables into public responses without allowlisted serializers
- returns raw database rows
- performs broad list queries and filters in application code after retrieval
- uses admin access for analytics or public APIs without suppression/allowlist
  boundaries
- lacks negative tests

---

## 8. Required Negative Tests

The future implementation and remediation work must add negative tests for every
new or changed Track 2 route with object-level access risk.

At minimum, tests must cover:

- authenticated user A cannot read, update, cancel, import into, or fetch
  private records for user B's event
- accepted cohost can perform only the operations the cohost role allows
- pending/rejected/removed cohost cannot manage the event
- organization member cannot administer another organization's event, venue,
  festival, source record, import run, or analytics dashboard
- non-admin cannot call admin-only endpoints by guessing IDs
- path ID and body ID mismatch is rejected
- query ID and body ID mismatch is rejected
- occurrence `dateKey` cannot be applied to an event the user cannot manage
- import-run IDs are scoped to the creating host/org/admin context
- source-record IDs are scoped to manageable events, venues, orgs, or approved
  service-worker context
- analytics dashboard filters cannot expose raw/user-level data across another
  host, org, event, or suppressed small-count segment
- public endpoints cannot reveal drafts, invite-only rows, private host notes,
  emails, raw analytics, internal IDs, or service metadata
- service-role routes deny access before returning or mutating data when object
  authorization fails
- deleted, cancelled, archived, or stale-role records do not accidentally regain
  access

Every denial test should assert status code, response shape, and absence of
private fields where practical. Tests should include both "wrong authenticated
user" and "unauthenticated/anon" cases when the route can be reached publicly.

---

## 9. Required 2L.1 Audit Report Format

The follow-up 2L.1 audit report must be investigation-only and include these
sections.

### 9.1 Route and Worker Inventory

For each entry:

- path or worker name
- method or trigger
- current/planned Track 2 sub-track
- IDs accepted by path, query, body, headers, queue payload, or derived data
- resource type
- public/private classification
- auth requirement
- server-side object authorization function or missing gap
- Supabase client mode: user, anon, service-role/admin, direct SQL, or mixed
- tests present
- tests missing
- risk severity
- remediation owner or follow-up PR

### 9.2 RLS Inventory

For each table:

- table name
- RLS enabled status
- policies by command and role
- migration reference
- recursion risk
- `anon` smoke requirement
- `authenticated` smoke requirement
- server bypassing routes
- gaps and remediation criteria

### 9.3 Service-Role Inventory

For each usage:

- file path and line range
- operation and tables touched
- rationale
- authorization check before access
- data returned or mutated
- audit/logging requirement
- negative tests present or missing
- remediation criterion

### 9.4 Access Matrix

The report must include a matrix for each resource family showing read, create,
update, cancel/delete/archive, list, export, and administer rights across:

- anonymous public reader
- authenticated non-owner
- event host
- accepted cohost
- organization member
- organization owner/admin
- site admin
- service worker

Where a role is not applicable, the matrix must say `not applicable`, not leave
the cell blank.

### 9.5 Gap Register

Every gap must include:

- evidence path and line range, policy name, or migration reference
- exploit shape
- affected resource types
- severity
- blocked future work
- remediation criterion
- whether the fix needs code, schema, policy, prompt, contract, or docs changes

---

## 10. Remediation Criteria

Future Track 2 implementation cannot proceed for a route/resource family while
that route/resource has unresolved 2L gaps.

Minimum remediation criteria:

- every ID-bearing route has server-side object authorization or a documented
  public-read allowlist boundary
- every privileged service-role/admin-client use has explicit rationale and
  authorization before sensitive access
- every public response uses allowlisted serialization for public-safe fields
- every private response is scoped to an authenticated principal with a
  documented role relationship
- RLS policies are documented with migration references and runtime smoke
  requirements
- negative tests prove cross-user and cross-resource denial
- body/path/query ID mismatches are rejected
- service-role routes do not return raw database rows unless the row type is
  already public-safe and serializer-reviewed
- remediation that changes RLS, grants, or schema ships in a migration
- remediation that changes runtime behavior includes relevant tests and, where
  required, contract updates

Severity handling:

- **Blocking:** any unauthenticated private-data exposure, cross-user mutation,
  cross-user private read, service-role bypass without authorization, public
  serializer leak, or RLS gap that exposes private tables.
- **Blocking for affected surface:** missing tests, unclear ownership model,
  unknown RLS behavior, or missing service-role rationale for a route not yet
  shipped.
- **Non-blocking follow-up:** documentation polish where tests and runtime
  behavior already prove the boundary.

---

## 11. Non-Goals

This ADR does not:

- perform the audit
- implement runtime code
- add tests
- change schema
- add or edit migrations
- change RLS policies
- remediate existing routes
- create or edit endpoints
- edit `web/**`
- edit prompt files
- edit contract files
- edit `ConversationalCreateUI.tsx`
- edit `tools/symphony/**`
- edit `docs/investigation/track1-claims.md`
- decide final resource schemas for venues, organizations, festivals,
  performers, imports, analytics, or source records
- approve any service-role usage by itself

If any of those changes are required to complete this ADR, the correct action is
to stop and ask in the PR before proceeding.

---

## 12. Stop Conditions

Stop and ask Sami via PR comment if this ADR or any follow-up requires:

- runtime code changes
- schema changes or migrations
- RLS policy changes
- prompt changes
- contract changes
- edits under `web/**`
- edits under `supabase/migrations/**`
- edits under `tools/symphony/**`
- edits to `ConversationalCreateUI.tsx`
- edits to `docs/investigation/track1-claims.md`
- performing the actual 2L.1 audit in this PR
- bundling remediation with this ADR

---

## 13. Decision

Adopt the BOLA/RLS/service-role audit plan above as the prerequisite for future
2L audit and remediation work.

Approval of this ADR means 2L.1 may be planned against this checklist. It does
not approve runtime changes, schema changes, RLS policy changes, route changes,
service-role expansion, audit execution, or remediation.

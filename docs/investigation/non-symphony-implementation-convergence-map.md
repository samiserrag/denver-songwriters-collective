# Non-Symphony Implementation Convergence Map

**Status:** Investigation / implementation planning map only
**Created:** 2026-05-03
**Scope:** Track 1, Track 2, Lane 5, Lane 6, Lane 8, and Lane 9
**Excluded:** Lane 3 / Symphony operational work
**Runtime behavior changed:** No

This map turns the recent strategy, architecture, guardrail, and source-contract work into a concrete implementation backlog for the existing application. It intentionally excludes Symphony except to note that Symphony remains pre-operational by design.

The current risk is not that the repo lacks direction. The risk is that accepted decisions remain scattered across docs and tests while the runtime continues to behave like the older product. This file names the places where that gap needs to close.

---

## 1. Executive Summary

The non-Symphony lanes have produced a strong policy and test foundation:

- Track 2 has a maintained BOLA route/resource matrix and service-role manifest with many source-contract negative tests.
- Lane 5 has a live `event_audit_log` table, helper, and event route hooks, with PR B/C alert and UI surfaces still gated.
- Lane 6 has the SOURCE-OBS-01 data model path staged through `event_sources` plus the 3b decision memo for `event_source_observations`.
- Lane 8/9 have sharpened the concierge model: helpful search, confidence, claim-aware editing, community corrections, and evidence bundles.
- Track 1 has production event creation and existing-event AI preview flows, but existing-event AI writes remain intentionally locked and community corrections are not yet first-class.

Closest to implementation:

1. **Lane 6 Step 3b migration**: create inert `event_source_observations`, no readers/writers, no verification behavior change.
2. **Track 2 route-invocation hardening**: convert the source-contract BOLA net into runtime route tests for the most sensitive service-role/admin routes.
3. **Lane 9 search reliability follow-up**: production interpreter timeout behavior still needs the venue-enrichment fallback to land and be observed.
4. **Lane 5 PR B after soak**: suspicion scorer and admin alert/digest path, gated by observed audit-log row shape.
5. **Track 1 community-correction queue ADR/schema**: separate proposed changes from applied audit logs before public/community edit flows expand.

Requires stop-gates before code:

- Any activation of SOURCE-OBS-01 or public verification badge derivation.
- Any direct write path for unclaimed community contributors.
- Any event publishing or existing-event AI write expansion.
- Any crawler, known-source reverification worker, MCP/API source surface, RSS/JSON feed, or public agent-readable endpoint.
- Lane 5 PR B/C runtime alerts, admin UI, or public transparency surfaces.

---

## 2. Accepted Rule / Capability Inventory

| Rule or capability | Source | Current status | Runtime convergence needed | Product risk if left unapplied |
|---|---|---|---|---|
| Track 2 BOLA/service-role discipline | `track2-2l2-bola-route-resource-matrix.md`, `track2-2l3-service-role-admin-client-manifest.md` | Tests/docs ahead of runtime | Route-invocation tests and targeted fixes for rows still marked `current-gap`; keep matrix/manifest updated with every ID-bearing route | Source-contract tests can pass while a real `Request` path still leaks cross-resource access |
| Existing-event AI writes stay locked until gate | `track2-roadmap.md`, `ConversationalCreateUI.tsx` `allowExistingEventWrites` | Implemented as lock; future apply path not implemented | Published-event write gate and claim-aware authority model before unlocking existing-event AI writes | Unlocking too early could let AI mutate the wrong event or high-risk fields without the right confirmation |
| Published-event high-risk confirmation | `my-events/[id]/route.ts` safety gate, Track 1 PR stack | Partially implemented | Extend from AI metadata gate into the broader claim-aware write authority model | High-risk updates may be treated too uniformly instead of field/actor/risk aware |
| Event audit log PR A | `event-audit-log.md`, `20260502190000_create_event_audit_log.sql`, `eventAudit.ts` | Live and flagged on | After soak, add scorer, alert/digest route, and admin response UI under separate flags | Audit rows exist but do not yet proactively help admins catch suspicious edits |
| Event audit log is not the review queue | `AGENTIC_EVENT_MAINTENANCE.md` `COMMUNITY-CORRECTION-01` | Policy only | Add proposed-change queue before expanding community correction surfaces | Proposed edits could be conflated with applied truth, weakening the audit trail |
| Community corrections are proposed data, not direct mutation | `COMMUNITY-CORRECTION-01` | Policy only | Schema/API/UI for proposed changes with field diffs, evidence, confidence, and review status | Helpful community contributors have no structured path, or worse, get direct writes without authority |
| Claim-aware direct edit authority | `AGENTIC_EVENT_MAINTENANCE.md` §10 | Policy only | Central field-level authority helper used by event edit, venue/org claim, and concierge flows | Verified hosts/managers and community contributors remain indistinguishable in write UX |
| Concierge search should be helpful and confidence-aware | Lane 8/9 RMU analysis, `events/interpret/route.ts`, `venueResolver.ts` | Partially implemented; timeout behavior still being hardened | Preserve venue enrichment on partial timeout; expose searched/unknown/conflict buckets in UI copy | User is asked dumb questions despite public facts being findable |
| Google Maps links are location hints, not event sources | `events/interpret/route.ts`, Lane 9 tests | Implemented in interpreter path | Keep covered in any venue enrichment or source URL changes | Maps URLs could pollute event `external_url` or source provenance |
| SOURCE-OBS-01 remains Draft / Proposed / Not Active | `CONTRACTS.md`, SOURCE_OBS docs | Enforced by docs/guardrails | Keep `verification.ts` unchanged until contract activation PR | Premature badge/source truth changes would misrepresent trust state |
| `event_sources` registry table | `20260503000000_event_sources_registry.sql` | Migration file on main; inert table design | Apply DB only under migration gate; later add 3e claim-status trigger and first writer under separate gates | Source registry exists in codebase but no observation pipeline can use it yet |
| `event_source_observations` evidence ledger | Step 3b brief and decision memo | Docs-only | 3b-execute migration, no readers/writers; later crawler/Deduper/derivation gates | Source observation plan cannot progress beyond docs |
| Known-source reverification only for v1 | `track2-roadmap.md`, `track2-2j0-safe-url-fetcher-adr.md` | ADR/planned | Implement `safeFetch` before any worker; no broad autonomous crawling | Crawler scope could grow faster than trust/safety controls |
| Public source/AI-readable surfaces must be schema-driven | `SOURCE_REGISTRY.md`, Track 2 2I docs | Planned | Public serializer and route tests before `/events.json` or AI-shaped reads | Public APIs could leak private/draft/internal fields |
| Trust layer never pay-to-play | Governance/strategy docs | Policy | Carry into verification derivation, public transparency, reputation, and retention decisions | Public trust could become tiered by payment, undermining the product thesis |

---

## 3. Code-Surface Map

### 3.1 Event Creation and Interpreter

| Surface | Current role | Accepted rules to apply | Likely work |
|---|---|---|---|
| `web/src/app/api/events/interpret/route.ts` | AI interpretation, OCR, web search, Maps hints, venue resolution, response guidance | Helpful search with fact buckets; venue enrichment separated from exact event verification; no invented cost/signup/source links; Maps as location hint only; claim-aware edit prompts later | Finish timeout fallback; add confidence/unknown/conflict output stability; later attach authority context for edit flows |
| `web/src/lib/events/venueResolver.ts` | Venue alias/candidate generation and local catalog matching | Search candidate expansion, reusable venue over custom location when source-backed, custom fallback when no confidence | Continue alias/candidate tests; add deterministic venue confidence contract if search evidence becomes structured |
| `web/src/app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx` | Main conversational create/edit UI, reusable venue creation, existing-event write lock | Display source confidence without over-asking; preserve custom/venue mutual exclusivity; keep existing-event writes locked until gate; later surface proposed corrections | UI copy for partial search success; proposed-change submission UI; claim-first links; evidence bundle attachment |
| `web/src/app/api/my-events/route.ts` | Event create and reusable venue promotion path | Audit-on-write; deterministic venue promotion; community correction queue separate from event create | Keep audit hooks; later route unclaimed bulk/helpful edits to proposed queue instead of direct event insert/update |

### 3.2 Existing Event Management

| Surface | Current role | Accepted rules to apply | Likely work |
|---|---|---|---|
| `web/src/app/api/my-events/[id]/route.ts` | Host/admin GET/PATCH/DELETE for event series | Field-level authority; high-risk confirmation; audit log; claim-aware ownership; community suggestions as proposed data | Introduce a central write-authority decision helper before broad AI apply; add route-invocation tests for high-risk/body-ID cases |
| `web/src/app/api/my-events/[id]/overrides/route.ts` | Occurrence override GET/POST/DELETE | Date-key scoping; high-risk occurrence edits; audit log; future cancellation flow | Route-invocation mismatch tests; field/risk classification for occurrence-level proposed changes |
| `web/src/lib/events/eventManageAuth.ts` | Shared event manage/visibility authorization | Path event authority; role distinctions for host/cohost/admin | Extend or wrap with field-level authority instead of using one broad `canManageEvent()` decision for all fields |
| `web/src/lib/events/verification.ts` | Active public verification display (`last_verified_at`) | Preserve until SOURCE-OBS-01 activation | No change until Step 8 activation PR; future derived model must back-compat current badge feel |

### 3.3 Community Suggestions and Proposed Corrections

| Surface | Current role | Accepted rules to apply | Likely work |
|---|---|---|---|
| `web/src/app/api/event-update-suggestions/route.ts` | Public suggestion intake with field allowlist and admin email | COMMUNITY-CORRECTION-01 evidence bundle, actor identity, field diff, review status, source URLs/images/transcript refs, no direct mutation | Refactor into or migrate toward proposed-change queue semantics; add spam/rate/event-visibility checks; avoid treating this as applied audit |
| `web/src/lib/eventUpdateSuggestions/server.ts` | Service-role insert helper for suggestions | Service-role after validation; proposal queue not audit log | Add typed evidence bundle and stricter server-side insert contract |
| Future `proposed_event_changes` table/API | Does not exist | Separate proposed edits from applied edits and source observations | Schema ADR/migration; admin review route; accepted proposal writes to event route and then `event_audit_log` |

### 3.4 Lane 5 Audit and Admin Response

| Surface | Current role | Accepted rules to apply | Likely work |
|---|---|---|---|
| `supabase/migrations/20260502190000_create_event_audit_log.sql` | Applied mutation audit table | Retention by actor role; no client inserts; host/admin reads; rows survive event deletion | Leave schema stable until soak proves shape; future retention function under PR B |
| `web/src/lib/audit/eventAudit.ts` | Fire-and-forget audit helper behind `EVENT_AUDIT_LOG_ENABLED` | Applied changes only; mirrors to Axiom; no blocking route failures | Feed suspicion scorer after soak; preserve no-throw behavior |
| `web/src/__tests__/event-audit-route-hooks.test.ts` | Source-contract coverage for audit hooks | Audit hook present on create/PATCH/DELETE/override writes | Add route-invocation or integration coverage when PR B consumes rows |
| Future `auditSuspicion.ts`, cron route, admin email/digest | Does not exist | PR B after soak; tiered alerts, throttling, config flag | Implement after row-shape soak and explicit go |
| Future `/dashboard/admin/event-audit` | Does not exist | PR C; read-only MVP for alert response | Admin UI only after PR B, behind flag |

### 3.5 Lane 6 Source Observation

| Surface | Current role | Accepted rules to apply | Likely work |
|---|---|---|---|
| `supabase/migrations/20260503000000_event_sources_registry.sql` | Inert source registry table | No URL unique constraints; `claim_status` inert until 3e trigger; admin-only RLS | Apply DB separately if not already applied; later source admin UI/writers under stop-gates |
| Future `supabase/migrations/*event_source_observations*.sql` | Does not exist | Nullable `event_id`; append-only evidence ledger; crawler-fetch indirection; no authenticated INSERT; no derivation | 3b-execute migration + tests only, no readers/writers |
| Future 3c `event_change_log` | Does not exist | Derived deltas, not raw observations or applied edits | Migration only after 3b |
| Future 3d `artist_claims` | Does not exist | `profiles(id)` subject with `artist_subject_type` discriminator | Migration after source observation backbone is stable |
| Future 3e claim-status trigger | Does not exist | Denormalized `event_sources.claim_status` maintenance | Trigger/reconciliation job after claim tables are ready |
| Future derivation function | Does not exist | SOURCE-OBS-01 primary/secondary verification state; trust-never-pay-to-play | Pure derivation helper before any UI/badge activation |

### 3.6 Track 2 Route Families

| Surface family | Current role | Accepted rules to apply | Likely work |
|---|---|---|---|
| `web/src/app/api/admin/ops/events/*` | Admin import/apply/export/bulk verify | Admin gate before parsing/service role; audit after write/export | Route-invocation mismatch tests for malformed/cross-resource batches |
| `web/src/app/api/admin/ops/overrides/*` | Admin occurrence override preview/apply/export | Event/date-key scoping; preview/export read-only; audit ordering | Route-invocation tests for cross-event/date-key mismatch |
| `web/src/app/api/admin/ops/venues/*` | Admin venue preview/apply/export | Server-derived venue IDs; update-only apply; export field guard | Route-invocation tests for cross-venue malformed payloads |
| `web/src/app/api/admin/venues/[id]/*` | Admin venue management/invites/managers/revert | Path venue/invite/manager/log scoping; audit/geocode ordering | Full route-invocation mismatch tests and audit invocation assertions |
| `web/src/app/api/admin/organizations/[id]/route.ts` | Admin organization management | Path organization/member/content scoping; email fanout after auth | Route-invocation mismatch tests and admin audit consideration |
| Planned `safeFetch`, reverify, import, analytics, public JSON routes | Not implemented | `.0` ADR gates, SSRF/rate/privacy/serializer rules | Implement foundations before workers or public APIs |

---

## 4. Lane-by-Lane Convergence Plan

### Lane 2 — Security Test Net to Runtime Proof

Current state: source-contract negative tests cover many route families and the matrix/manifest are maintained. Several rows still explicitly say "future route-invocation harness may deepen this beyond source contracts" or list `current-gap`.

Convergence:

1. Keep finishing the narrow matrix rows.
2. Start a second pass on the highest-risk `current-gap` rows with actual `Request`/route invocation tests.
3. Patch runtime only when a real route invocation test exposes a bug.
4. Avoid broad BOLA refactors; keep row-by-row file scope.

Best first runtime-proof targets:

- Admin ops events/overrides/venues, because service-role writes and batch inputs carry the biggest blast radius.
- Admin venues and admin organizations, because revert/invite/manager/member-link paths accept multiple IDs.
- `event-update-suggestions`, because it is public-facing and service-role backed.

### Lane 5 — Audit Log to Admin Response

Current state: PR A is live and flagged on. Audit rows exist; helper is fire-and-forget; runbook defines soak and PR B/C gates.

Convergence:

1. Complete the technical soak and inspect actual row shape.
2. Implement PR B only after explicit go: `auditSuspicion.ts`, cron route, alert/digest email, config flag.
3. Keep PR C separate: read-only admin audit UI, host-private edit history, public transparency line only if stop-gated.
4. Do not treat proposed community corrections as audit rows until they are accepted and applied.

### Lane 6 — Source Observation Backbone to Evidence Pipeline

Current state: `event_sources` migration file is on main as inert registry design. Step 3b docs/memo specify `event_source_observations`, but the migration is not yet written in this convergence map.

Convergence:

1. 3b-execute migration: create `event_source_observations` only, with admin/service-role posture, no readers/writers.
2. 3c `event_change_log` migration.
3. 3d `artist_claims` migration.
4. 3e `event_sources.claim_status` trigger/reconciliation job.
5. Pure derivation helper.
6. Backfill plan.
7. Contract activation PR that explicitly retires binary `last_verified_at` truth.

Every step before activation must keep `web/src/lib/events/verification.ts` unchanged.

### Lane 8 / Lane 9 — Concierge Search and Discernment

Current state: RMU exposed two issues. The first was prompt/contract coupling of venue enrichment to exact event verification. The second was production timeout behavior that dropped all search evidence before the interpreter saw it.

Convergence:

1. Land and observe the timeout fallback that preserves venue enrichment even when exact-event search times out.
2. Surface searched facts, conflicts, and true unknowns in user-facing copy without overloading the create UI.
3. Add claim-aware editing language: verified owners get direct-control flows; unauthenticated/unclaimed helpers get proposed-change flows.
4. Add confidence summaries to proposed changes and admin review packages.
5. Keep Maps links as location hints only.

### Track 1 Existing-Event Write Gate and Community Queue

Current state: existing-event AI edit wrappers remain preview/interpret-only by default. `allowExistingEventWrites={false}` is still the safety line for existing-event AI pages.

Convergence:

1. Define central actor/field/risk write authority.
2. Add proposed-change queue schema/API before allowing non-owners to contribute structured edits.
3. Use `event_audit_log` only after a proposal is applied.
4. Unlock existing-event AI writes only after route-level confirmation, field-level authority, rollback/audit evidence, and BOLA tests are in place.

---

## 5. Dependency Order

Hard blockers:

1. **SOURCE-OBS-01 activation** is blocked by source observation tables, derivation helper, backfill, tests, feature flag, and contract supersession.
2. **Community direct-write expansion** is blocked by proposed-change queue and field-level authority.
3. **Lane 5 PR B** is blocked by audit-log soak and explicit go.
4. **Known-source reverification** is blocked by safe URL fetcher implementation and source observation backbone.
5. **Public APIs / AI-readable feeds** are blocked by serializer schema, private-field tests, crawler/rate policy, and trust-layer stop-gate.
6. **Existing-event AI writes** are blocked by published-write gate completion, field-level authority, audit/rollback evidence, and route-invocation tests.

Soft blockers:

- Contributor reputation can wait until proposed corrections have real review volume.
- Public transparency line can wait until PR B proves alert/admin value.
- `artist_claims` can wait until the source observation backbone is settled.
- Full admin dashboards can wait; email deep links plus read-only table are enough for first admin audit UI.

Gate classes:

| Gate type | Examples | Approval posture |
|---|---|---|
| Docs-only | Decision memos, convergence maps, ADRs | Low risk, merge after CI |
| Migration-only inert | `event_source_observations`, future `event_change_log` | SQL review + migration apply as separate gate |
| Route-code | BOLA fixes, proposed-change intake, admin ops route tests | Focused tests + exact route scope |
| UI | Admin audit UI, proposed correction UI, source confidence display | Browser verification required |
| Production apply | Supabase migration apply, env flag flips | Explicit apply/go with evidence |
| Admin workflow | Alerts, review queue, public transparency | Soak/row-shape evidence + rollback flag |

---

## 6. First Five Implementation PR Candidates

### 1. Lane 6 Step 3b Execute: Inert `event_source_observations`

- **Lane:** Lane 6
- **Likely files:**
  - `supabase/migrations/<timestamp>_event_source_observations.sql`
  - `web/src/__tests__/source-observation-step-3b-event-source-observations.test.ts`
  - `docs/investigation/track1-claims.md` if the guardrail requires a migration claim
- **Why now:** It is the next concrete SOURCE-OBS-01 step and remains inert.
- **Risk:** Medium because schema is durable; low runtime blast radius because there are no readers/writers.
- **Stop-gate:** Yes for migration PR; DB apply remains separate.
- **Verification:** Migration content tests, RLS/tripwire, no `verification.ts` changes, no app code.

### 2. Track 2 Route-Invocation Harness for Admin Ops Events

- **Lane:** Lane 2
- **Likely files:**
  - `web/src/__tests__/track2-2l23-admin-ops-events-route-invocation.test.ts`
  - maybe the specific route file only if the test exposes a real bug
  - matrix/manifest updates
- **Why now:** Admin ops events combine service-role writes, batch input, import/apply/export, and audit ordering.
- **Risk:** Low if tests-only; medium if route bug fix required.
- **Stop-gate:** No for tests-only; yes/explicit call if runtime route behavior changes.
- **Verification:** Actual route invocation denies anonymous/non-admin and malformed cross-resource writes before service-role access.

### 3. Track 1 Proposed Community Correction Queue ADR + Schema Brief

- **Lane:** Track 1 / Lane 8 or Lane 9, coordinated with Lane 6
- **Likely files:**
  - `docs/investigation/community-corrections-proposed-change-queue-adr.md`
  - optional brief for future `proposed_event_changes`
- **Why now:** COMMUNITY-CORRECTION-01 is accepted, but the runtime still has only legacy `event_update_suggestions`.
- **Risk:** Low docs-only; important because it prevents accidental direct-write implementation.
- **Stop-gate:** Docs PR only; schema/code later.
- **Verification:** Explicit separation from `event_audit_log` and `event_source_observations`; evidence bundle and retention policy specified.

### 4. Lane 5 PR B: Audit Suspicion Scorer + Admin Digest

- **Lane:** Lane 5
- **Likely files:**
  - `web/src/lib/events/auditSuspicion.ts`
  - `web/src/app/api/cron/event-audit-alerts/route.ts`
  - email template/helper updates
  - focused tests
- **Why now:** Only after soak proves audit row shape; turns passive forensics into actionable protection.
- **Risk:** Medium due to email volume/admin fatigue.
- **Stop-gate:** Yes; requires explicit go after soak.
- **Verification:** Feature flag off by default, scorer tests, throttle tests, Axiom/DB read-only smoke, no public surface.

### 5. Lane 9 Interpreter Search Reliability Follow-Up

- **Lane:** Lane 9
- **Likely files:**
  - `web/src/app/api/events/interpret/route.ts`
  - `web/src/__tests__/interpreter-concierge-search.test.ts`
  - `web/src/__tests__/interpreter-phase9-reliability.test.ts`
  - `docs/investigation/track1-claims.md`
- **Why now:** Production showed the RMU venue issue remains when the single search call times out.
- **Risk:** Medium because it touches production AI creation behavior.
- **Stop-gate:** Normal PR review; no production data mutation.
- **Verification:** Focused regression tests, TypeScript, Axiom post-deploy, optional read-only draft-flow observation if explicitly authorized.

---

## 7. Things Not To Do Yet

- Do not activate SOURCE-OBS-01 or change `web/src/lib/events/verification.ts`.
- Do not add public trust badges, source labels, or last-checked surfaces from unimplemented observations.
- Do not let unclaimed contributors directly mutate trusted event records.
- Do not use `event_audit_log` as the proposed-change queue.
- Do not implement broad autonomous crawling; v1 is known-source reverification only after safe fetch and source-observation gates.
- Do not ship public RSS/JSON/MCP/agent-readable event surfaces without serializer, rate, source-policy, and trust-layer stop-gates.
- Do not unlock existing-event AI writes broadly from `ConversationalCreateUI.tsx`.
- Do not turn Track 2 BOLA work into a broad refactor. Keep route families narrow and evidence-backed.
- Do not start Lane 3 / Symphony operational wiring as part of this convergence work. Symphony remains intentionally pre-operational.

---

## 8. Operating Principle

The docs and tests are now ahead of runtime behavior in several places. That is not a problem if the next phase is deliberate convergence:

> **Turn one accepted rule into one narrow runtime behavior, prove it with tests and production-safe evidence, then move to the next rule.**

The product will get stronger fastest by resisting broad rewrites and closing the highest-trust gaps one small, reviewable PR at a time.

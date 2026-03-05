# Stop-Gate Track: Host Role Invariants + Capability Sync (HOST-ROLE-01)

**Date:** 2026-03-03  
**Status:** IMPLEMENTED — PRODUCTION VERIFIED

---

## 1) Context

Production data and smoke testing exposed host-role drift:

1. Events with accepted cohosts but no primary host (`events.host_id IS NULL`).
2. Events with `events.host_id` set but missing mirror `event_hosts` host row.
3. Host invite acceptance paths that could drift capability sync (`approved_hosts`, `profiles.is_host`).

This tract enforced deterministic invariants across invitation, acceptance, and existing production data.

---

## 2) Shipped Changes

| Area | Change | Commit |
|------|--------|--------|
| Invite role assignment | `/api/my-events/[id]/invite` now auto-detects event state and upgrades `cohost -> host` when event is orphaned | `c8a8cd67` |
| Accept race protection | `/api/event-invites/accept` now claims ownership with atomic CAS (`host_id IS NULL`) | `c8a8cd67` |
| Capability sync | Both accept routes sync `approved_hosts` and `profiles.is_host` when host role is accepted | `c8a8cd67` |
| Admin ghost role fix | Event edit role derivation remains nullable; admins without membership are not defaulted to `cohost` | `c8a8cd67` |

---

## 3) Data Repair Evidence

Production repair executed for historical drift:

| Metric | Before | After |
|--------|--------|-------|
| Orphaned cohost events | 4 | 0 |
| Orphaned `host_id` events | 0 | 0 |
| Approved hosts (active) | 2 | 5 |

Repaired rows were promoted to valid primary host ownership and synced into capability tables.

---

## 4) Verification

| Check | Result |
|------|--------|
| Host-role invariant tests | 16 source assertions pass |
| Host-related regression suites | Pass |
| CI | 4/4 green (CI, Build, Web Tests, RLS Tripwire) |
| Production smoke | PASS for repaired paths and invite/accept invariants |

Primary test anchors:
- `web/src/__tests__/host-role-01-invariants.test.ts`
- `web/src/__tests__/host-invite-auto-role.test.ts`

---

## 5) Contracts and Backlog Alignment

1. Host role model documented in `docs/CONTRACTS.md` under **Host Capability vs Event Roles (HOST-ROLE-01)**.
2. Backlog status set to DONE with reference to this evidence doc in `docs/BACKLOG.md`.

---

## 6) Residual Follow-Ups

1. UX-level messaging for role confusion remains separate and tracked independently.
2. Interpreter/host UX tracts continue under `INTERPRETER-10` monitoring and `INTERPRETER-13` decision checkpoint work.

---

## 7) Policy Addendum (2026-03-04)

Ownership assignment policy was tightened after the original HOST-ROLE-01 rollout.

### 7.1 Claims-only ownership enforcement

Direct host ownership assignment through invite acceptance is now blocked.

1. `/api/my-events/[id]/invite`:
   - Blocks all invite creation on orphaned events (`events.host_id IS NULL`) with HTTP 409.
   - Blocks `role_to_grant="host"` with HTTP 409 and claim-workflow guidance.
2. `/api/event-invites/accept`:
   - Blocks `role_to_grant="host"` acceptance with HTTP 409 and claim-workflow guidance.
3. `/api/invitations/[id]`:
   - Blocks accepting pending `event_hosts.role="host"` invitations with HTTP 409.
4. `/api/my-events/[id]/cohosts`:
   - Blocks cohost invites when event has no primary host.
   - No longer auto-promotes invitees to `host`; assigns `cohost` only.

### 7.2 Admin toggle consistency + feedback

1. `toggleHostStatus` now syncs both:
   - `approved_hosts.status` (`active` / `revoked`)
   - `profiles.is_host`
2. Admin user management UI now shows visible success/error notices for:
   - Host toggle
   - Artist/Host/Studio spotlight toggles
   - Admin role toggle

### 7.3 Admin email fanout for host claims

1. Event claims (`/api/events/[id]/claim`) fan out to all admin recipients (done in commit `eb45ba9f`).
2. Platform host requests (`/api/host-requests`) now also fan out to all admin recipients, with `ADMIN_EMAIL` fallback.

### 7.4 Verification anchors

- `web/src/__tests__/host-role-01-invariants.test.ts`
- `web/src/__tests__/host-invite-auto-role.test.ts`
- `web/src/__tests__/admin-user-toggle-feedback-and-sync.test.ts`
- `web/src/__tests__/event-claim-admin-email-fanout.test.ts`
- `web/src/__tests__/host-requests-admin-email-fanout.test.ts`

### 7.5 Follow-up hardening addendum (2026-03-05)

1. Commit: `bf4f132f`.
2. `updateSpotlightType` now enforces server-side eligibility before write:
   - `performer` spotlight requires songwriter identity.
   - `host` spotlight requires host identity or accepted event-host role (`host`/`cohost`).
   - `studio` spotlight requires studio identity.
3. Admin users table Host column now renders the host toggle for host-only users as well (not only songwriters), so admins can revoke/restore `is_host` directly from this surface.

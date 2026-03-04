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

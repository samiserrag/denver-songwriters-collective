# Phase 4.97 — Series Ownership Onboarding STOP-GATE

**Date:** 2026-01-27
**Status:** STOP-GATE A (Investigation Complete)
**Verdict:** PROCEED WITH CAUTION — Primitives exist, UX gaps documented

---

## 1. Executive Summary

The series ownership and collaboration system is **functionally complete** — all primitives exist for invites, claims, co-host management, and occurrence overrides. However, the **permission model is invisible to users**, leading to trial-and-error discovery of what each role can do.

**Critical Finding:** Two user journeys have broken feedback loops:
1. Claim approval: User receives no notification when approved
2. Co-host permissions: Buttons visible but non-functional silently fail

---

## 2. Audit Paths Traced

### Path 1: Accept Invite as Co-host → Manage Series → Invite Another Co-host → Leave

| Step | Implementation | File | Line |
|------|----------------|------|------|
| Invite created | POST `/api/my-events/[id]/cohosts` | `cohosts/route.ts` | 1-150 |
| Notification sent | `getCohostInvitationEmail` template | `cohosts/route.ts` | 119-130 |
| Invitee sees invitation | `InvitationsList.tsx` | `InvitationsList.tsx` | 93 |
| Accept invitation | PATCH `/api/invitations/[id]` | `invitations/[id]/route.ts` | 50-90 |
| View co-hosts | `CoHostManager.tsx` | `CoHostManager.tsx` | 180-240 |
| Attempt invite (blocked) | Role check `role === 'host'` | `cohosts/route.ts` | 30-37 |
| Leave event | `LeaveEventButton.tsx` | `LeaveEventButton.tsx` | 40-100 |

**Finding:** Co-host CANNOT invite another co-host (server-side block), but this is **never communicated in UI**. User clicks "+ Invite" → gets error.

**Risk:** HIGH — Co-hosts invited without clear role expectations.

---

### Path 2: Accept Invite as Host on Unowned Event → Confirm Ownership Display → Invite Co-host

| Step | Implementation | File | Line |
|------|----------------|------|------|
| Host invite created | `role_to_grant: "host"` | `EventInviteSection.tsx` | 79-84 |
| Accept as host | Sets `events.host_id` | `event-invites/accept/route.ts` | 163 |
| Check no existing host | `event.host_id !== null` guard | `event-invites/accept/route.ts` | 150-157 |
| Create event_hosts row | role='host' | `event-invites/accept/route.ts` | 182 |
| Redirect to edit page | Success message shown | `event-invite/page.tsx` | 150-165 |

**Finding:** "Primary Host" label appears in CoHostManager but **no explanation of what being a host means operationally**.

**Risk:** MEDIUM — Ownership works but lacks clarity.

---

### Path 3: Claim Flow → Approval Latency → What User Sees During Waiting

| Step | Implementation | File | Line |
|------|----------------|------|------|
| Submit claim | POST `event_claims` | `ClaimEventButton.tsx` | 55-80 |
| See pending state | "Pending Approval" badge | `ClaimEventButton.tsx` | 41-58 |
| Admin approves | `ClaimsTable.tsx` | `ClaimsTable.tsx` | 56-89 |
| User notified? | **NO NOTIFICATION SENT** | — | — |

**Finding:** User has **NO feedback** when claim is approved. Must manually revisit event page to discover approval.

**Risk:** CRITICAL — Broken feedback loop. Users in limbo.

---

### Path 4: Recurring Series Editing — Series-level vs Occurrence-level

| Concept | Location | Messaging |
|---------|----------|-----------|
| Series editing scope | `SeriesEditingNotice.tsx` | "Changes affect all future occurrences" |
| Link to override editor | `SeriesEditingNotice.tsx` | "To modify a single date..." |
| Override editor access | `my-events/[id]/overrides` | **Admin/primary host only** |

**Finding:** Co-hosts see "changes affect all" warning but **cannot access the occurrence override editor** to edit single dates. This creates a mental model collision — co-hosts think they shouldn't edit at all.

**Risk:** MEDIUM-HIGH — Co-hosts may accidentally edit entire series or avoid editing entirely.

---

### Path 5: Occurrence Changes Dead-Ends + Permission Scoping

| Permission | Who Can | Server Check | UI Visibility |
|------------|---------|--------------|---------------|
| Invite co-host | Primary host only | `role === 'host'` | Button shown to ALL |
| Remove co-host | Primary host only | `role === 'host'` | Button shown to ALL |
| Access override editor | Primary host + admin | Route access | Link hidden from co-hosts |
| Edit series | All hosts | Allowed | Form accessible |
| Cancel occurrence | Primary host + admin | API check | **Silent 403** |

**Finding:** CoHostManager shows "Remove" button to co-hosts, but clicking it fails silently (403 caught but no error displayed).

**Risk:** CRITICAL — Permission model invisible. Buttons appear functional but aren't.

---

## 3. Role/Permission Matrix (Series-Level)

| Capability | Primary Host | Co-host | Admin |
|------------|-------------|---------|-------|
| Edit series fields | ✅ | ✅ | ✅ |
| Publish/unpublish series | ✅ | ❌ | ✅ |
| Invite co-hosts | ✅ | ❌ | ✅ |
| Remove co-hosts | ✅ | ❌ | ✅ |
| Leave event | ✅ | ✅ | N/A |
| Access occurrence editor | ✅ | ❌ | ✅ |
| Cancel single occurrence | ✅ | ❌ | ✅ |
| Edit single occurrence | ✅ | ❌ | ✅ |
| Create event invites | ✅ | ❌ | ✅ |
| See all co-hosts | ✅ | ✅ | ✅ |

**This matrix is NOT visible anywhere in the application.**

---

## 4. Top 5 Highest-Risk UX Failures

| Rank | Issue | Risk | Impact |
|------|-------|------|--------|
| 1 | Claim approval sends no notification | CRITICAL | Users don't know they're approved |
| 2 | Co-host "Remove" button silently fails | CRITICAL | Permission model invisible |
| 3 | Co-host permissions never explained | HIGH | Trial-and-error discovery |
| 4 | Occurrence editor hidden from co-hosts without explanation | MEDIUM-HIGH | Mental model collision |
| 5 | Invite as "host" doesn't explain ownership implications | MEDIUM | Ownership unclear |

---

## 5. What Primitives Exist

### ✅ Complete

| Primitive | Status | Location |
|-----------|--------|----------|
| `event_hosts` table | ✅ | Stores role, invitation_status |
| `event_invites` table | ✅ | Token-based invites with expiry |
| `event_claims` table | ✅ | Claim requests with approval workflow |
| `occurrence_overrides` table | ✅ | Per-date overrides |
| Co-host invite flow | ✅ | API + UI complete |
| Leave event flow | ✅ | Two-step confirm with warnings |
| Claim submission | ✅ | Modal with message |
| Admin claim review | ✅ | Table with approve/reject |
| Series editing notice | ✅ | Warning about scope |
| Override editor | ✅ | Admin/host access |

### ❌ Missing

| Primitive | Impact |
|-----------|--------|
| Permission matrix UI | Users don't know what they can do |
| Claim approval notification | Users in limbo |
| Role-based button visibility | Silent failures |
| Co-host override messaging | Mental model collision |

---

## 6. STOP-GATE Verdict

### PROCEED WITH CAUTION

**Reasoning:**
- All backend primitives exist and function correctly
- RLS policies properly enforce permissions
- Critical UX gaps are **communication issues**, not missing functionality
- System is safe to use — just confusing

**Recommended Before Launch:**
1. Add claim approval notification (HIGH priority)
2. Hide non-functional buttons from co-hosts (HIGH priority)
3. Add role permissions card to CoHostManager (MEDIUM priority)
4. Add "ask primary host" messaging for co-hosts at override boundary (MEDIUM priority)

**Acceptable to Defer:**
- Comprehensive role documentation page
- In-app onboarding tutorial
- Permission tooltips on all buttons

---

## 7. Files Audited

| File | Purpose |
|------|---------|
| `api/event-invites/accept/route.ts` | Invite acceptance logic |
| `api/my-events/[id]/cohosts/route.ts` | Co-host management API |
| `components/events/ClaimEventButton.tsx` | Claim submission UI |
| `components/events/LeaveEventButton.tsx` | Leave event UI |
| `dashboard/my-events/_components/CoHostManager.tsx` | Co-host listing/invite |
| `dashboard/my-events/[id]/page.tsx` | Edit page authorization |
| `dashboard/invitations/InvitationsList.tsx` | Invitation response UI |
| `api/invitations/[id]/route.ts` | Invitation response handler |
| `components/events/SeriesEditingNotice.tsx` | Series scope warning |
| `dashboard/my-events/[id]/overrides/_components/OccurrenceEditor.tsx` | Override editor |
| `admin/claims/_components/ClaimsTable.tsx` | Admin claim review |

---

## 8. Next Steps (If Approved)

Phase 4.98 options:
1. **Add claim approval notification** — Send notification when admin approves claim
2. **Role-guard button visibility** — Hide "Remove" and "Invite" from co-hosts
3. **Add role permissions card** — Show "You are a [role]" with capability list
4. **Co-host override messaging** — Banner explaining how to request occurrence changes

**Awaiting Sami approval before any implementation.**

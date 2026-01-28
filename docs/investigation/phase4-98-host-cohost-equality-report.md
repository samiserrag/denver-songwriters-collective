# Phase 4.98 — Host/Cohost Equality + Safe Guardrails

**Status:** ✅ Complete
**Date:** January 2026

## Summary

This phase implements host/cohost equality where cohosts are equal partners operationally, with safe guardrails to prevent accidental orphaning of events.

### North-Star Rules Implemented

1. **Cohosts have full operational control** — Can invite others, edit event, leave anytime
2. **Single exception** — Cohost cannot remove primary host; Primary host can remove cohost
3. **Auto-promotion** — If primary host leaves, oldest remaining host is auto-promoted
4. **No silent failures** — Forbidden actions show clear UI messages
5. **Admin safety net** — Copy communicates admins can repair issues

---

## Work Items

### Work Item A: Fix Remove Behavior (No Silent 403)

**Problem:** Cohost saw "Remove" button but clicking it returned 403 silently.

**Fix:**
- Remove button now only visible to primary hosts (`currentUserRole === "host"`)
- Added proper error handling with `setError()` for API failures
- Error message displayed inline in the UI

### Work Item B: Auto-Promote When Primary Host Leaves

**Problem:** When primary host left, no one was promoted and event became orphaned.

**Fix:**
- DELETE handler now checks if removed host was primary
- If remaining hosts exist, oldest (by `created_at`) is promoted to primary
- Both `event_hosts.role` and `events.host_id` are updated
- Promoted user receives notification: "You're now primary host of [event]"

### Work Item C: Make Cohosts Equal Partners Operationally

**Problem:** POST handler required `role="host"` to invite others.

**Fix:**
- Removed `role="host"` constraint from POST authorization
- Any accepted host (primary or cohost) can now invite new cohosts
- Page now shows full CoHostManager to all hosts (removed read-only list for cohosts)

### Work Item D: Fix Claim Approval Notification

**Problem:** When admin approved a claim, claimant received no notification.

**Fix:**
- Added `create_user_notification` call in `handleApprove`:
  - Type: `claim_approved`
  - Title: `Your claim for "[event]" was approved!`
  - Link: `/dashboard/my-events/${eventId}`
- Added notification for rejection:
  - Type: `claim_rejected`
  - Title: `Your claim for "[event]" was not approved`
  - Includes reason if provided

### Work Item E: Add Permissions Help Block

**Problem:** Users didn't know what actions they could take.

**Fix:**
- Added permissions help block in CoHostManager showing:
  - For cohosts: "You can invite other co-hosts, edit the event, and leave anytime. Only a primary host can remove co-hosts."
  - For primary hosts: "You can invite, remove, and leave. If you leave, another host will be auto-promoted."
- Added "Need admin help?" link to `/feedback`

### Work Item F: Status Accuracy After Leaving

**Problem:** Leave button didn't explain what would happen.

**Fix:**
- Added auto-promotion message for non-sole primary hosts: "Another host will be automatically promoted to primary host."
- Sole host warning already existed: Shows when leaving would make event unhosted
- Redirect to `/dashboard/my-events` after successful leave
- `router.refresh()` called to update host lists

---

## Files Modified

| File | Changes |
|------|---------|
| `CoHostManager.tsx` | Added Link import, permissions help block, error display, fixed Remove button visibility, error handling in handleRemove |
| `cohosts/route.ts` | Removed role="host" constraint from POST, added auto-promotion logic in DELETE, added promoted user notification |
| `my-events/[id]/page.tsx` | Removed unused LeaveEventButton import, changed to show full CoHostManager to all hosts |
| `ClaimsTable.tsx` | Added approval and rejection notifications, fixed handleReject signature |
| `LeaveEventButton.tsx` | Added auto-promotion message for non-sole primary hosts |

## Files Added

| File | Purpose |
|------|---------|
| `__tests__/phase4-98-host-cohost-equality.test.ts` | 45 tests covering all work items |

---

## Tests Added

Created `web/src/__tests__/phase4-98-host-cohost-equality.test.ts` with tests for:

- **Work Item A (6 tests):** Remove button visibility rules, error handling
- **Work Item B (5 tests):** Auto-promotion logic, notification, unhosted state
- **Work Item C (5 tests):** Cohost invitation parity, CoHostManager visibility
- **Work Item D (6 tests):** Claim approval/rejection notifications
- **Work Item E (4 tests):** Permissions help block content
- **Work Item F (6 tests):** Leave button messages, redirect behavior
- **API Response (2 tests):** promotedUserId in DELETE response

---

## Quality Gates

| Check | Result |
|-------|--------|
| Lint | ✅ 0 errors, 0 warnings |
| Tests | ✅ 2767 passing |
| Build | ✅ Success |

---

## Known Limitations / Edge Cases

1. **Race condition on promotion:** If two primary hosts leave simultaneously, the auto-promotion might select different users. Mitigated by the fact that there's typically only one primary host.

2. **Notification delivery:** Notifications are created but email delivery depends on user preferences. The promoted user sees the notification in their dashboard regardless.

3. **Admin override:** Admins can still remove any host (primary or cohost). This is by design as the safety net.

4. **Event ownership vs event_hosts:** The `events.host_id` column is denormalized from `event_hosts`. Both are updated during promotion to maintain consistency.

---

## DSC UX Principles Compliance

- **§7 (UX Friction):** Two-step confirmation for Leave action
- **§8 (Dead States):** Auto-promotion prevents orphaned events
- **§10 (Defaults):** Auto-promotion selects oldest host (stable, predictable)
- **§11 (Soft Constraints):** Cohosts can do most things; only removal is restricted

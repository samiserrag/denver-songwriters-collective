# Phase ABC8 Investigation: Venue Claiming, Admin Approval, and Invite Links

> **RESOLVED** — Implementation complete. January 2026.

## 1. Executive Summary

This investigation defines a bulletproof venue ownership model that enables real venues to participate in the platform without breaking trust, ownership, or admin control.

**Key Design Decisions:**

| Decision | Chosen Approach | Rationale |
|----------|-----------------|-----------|
| Ownership model | 1:many (multiple managers) | Venues may have multiple staff who need access |
| Role structure | Owner + Manager roles | Owner can add/remove managers; managers can edit |
| Claim workflow | User-initiated → Admin approval | Matches event claim pattern (Phase 4.22.3) |
| Invite workflow | Admin-issued tokens with expiration | Prevents abuse, enables targeted outreach |
| Revocation | Admin-only with reason logging | Reversible decisions with audit trail |

**Scope Summary:**

| Category | New Tables | API Routes | UI Surfaces |
|----------|------------|------------|-------------|
| Venue Claims | 1 (`venue_claims`) | 3 | 3 |
| Venue Managers | 1 (`venue_managers`) | 4 | 2 |
| Invite Links | 1 (`venue_invites`) | 3 | 2 |
| **Total** | 3 | 10 | 7 |

---

## 2. Ownership Model

### 2.1 Current State

The `venues` table has **no ownership columns**. Current schema:

```typescript
venues: {
  id: string;
  slug: string | null;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  website_url: string | null;
  phone: string | null;
  google_maps_url: string | null;
  contact_link: string | null;
  accessibility_notes: string | null;
  parking_notes: string | null;
  notes: string | null;  // Admin-only
  neighborhood: string | null;
  created_at: string;
  updated_at: string;
}
```

**No** `owner_id`, `claimed_by`, or similar field exists.

### 2.2 Proposed Model: 1:Many with Roles

**Decision:** Support multiple managers per venue with explicit roles.

**Rationale:**
- Venues often have multiple staff (booking manager, marketing, owner)
- Single-owner model would require workarounds for delegation
- Matches `event_hosts` pattern which already supports roles

### 2.3 Proposed Table: `venue_managers`

```sql
CREATE TABLE venue_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager')),

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- How they got access
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  grant_method TEXT NOT NULL CHECK (grant_method IN ('claim_approved', 'invite_accepted', 'admin_assigned')),

  -- Revocation
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),
  revocation_reason TEXT,

  UNIQUE(venue_id, user_id)
);
```

### 2.4 Role Definitions

| Role | Description | Can Edit Venue | Can Add Managers | Can Remove Managers |
|------|-------------|----------------|------------------|---------------------|
| `owner` | Primary venue representative | Yes | Yes (managers only) | Yes (managers only) |
| `manager` | Staff with edit access | Yes | No | No |

**Invariant:** Only admins can add/remove owners. Owners cannot remove other owners.

### 2.5 Ownership States

| State | Definition | Source of Truth |
|-------|------------|-----------------|
| Unclaimed | No active entries in `venue_managers` | `venue_managers` count = 0 |
| Claimed | At least one active owner | `venue_managers` with role=owner, revoked_at IS NULL |
| Multi-managed | Multiple active managers | `venue_managers` count > 1 |

---

## 3. Claim Flow (User-Initiated)

### 3.1 Proposed Table: `venue_claims`

Follows the `event_claims` pattern exactly:

```sql
CREATE TABLE venue_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT,  -- "I'm the owner of this venue"

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,

  -- Review tracking
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate pending claims from same user
  UNIQUE(venue_id, requester_id) WHERE status = 'pending'
);
```

### 3.2 Claim Flow State Machine

```
                    ┌─────────────┐
                    │   (start)   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
        ┌──────────▶│   pending   │◀──────────┐
        │           └──────┬──────┘           │
        │                  │                  │
        │    ┌─────────────┼─────────────┐    │
        │    │             │             │    │
        │    ▼             ▼             ▼    │
        │ ┌──────┐   ┌──────────┐   ┌────────┐│
        │ │reject│   │ approve  │   │withdraw││
        │ └──┬───┘   └────┬─────┘   └───┬────┘│
        │    │            │             │     │
        │    ▼            ▼             ▼     │
        │ ┌──────┐   ┌──────────┐   ┌────────┐│
        │ │reject│   │ approved │   │withdrawn│
        │ │  ed  │   │(terminal)│   │(terminal│
        │ └──────┘   └──────────┘   └────────┘
        │                  │
        │                  │ (on approve)
        │                  ▼
        │           ┌────────────────┐
        │           │ INSERT INTO    │
        │           │ venue_managers │
        │           │ role='owner'   │
        │           └────────────────┘
        │
        │ (user may re-apply after rejection)
        └─────────────────────────────────────
```

### 3.3 State Transitions

| From | To | Actor | Conditions |
|------|----|-------|------------|
| (new) | pending | Any authenticated user | Venue is unclaimed OR user doesn't have active claim |
| pending | approved | Admin | Sets `reviewed_by`, `reviewed_at` |
| pending | rejected | Admin | Sets `rejection_reason`, `reviewed_by`, `reviewed_at` |
| pending | withdrawn | Requester | User cancels own pending claim |
| rejected | pending | Requester | User re-applies (new claim row) |

### 3.4 UI Surface: Claim Button

**Location:** Public venue detail page (`/venues/[id]`)

**Visibility Rules:**

| User State | Venue State | Button State |
|------------|-------------|--------------|
| Logged out | Unclaimed | "Log in to claim this venue" (link) |
| Logged in | Unclaimed | "Claim This Venue" (active) |
| Logged in | Has pending claim | "Claim Pending" (status badge) |
| Logged in | Is manager | Hidden (already has access) |
| Logged in | Claimed by others | "Claim This Venue" (active, for competing claim) |

**Pattern Reference:** `ClaimEventButton.tsx` (Phase 4.22.3)

---

## 4. Admin Approval Flow

### 4.1 Admin Claims Queue

**Location:** `/dashboard/admin/venue-claims`

**Query:**
```sql
SELECT vc.*,
       v.name as venue_name, v.slug as venue_slug,
       p.full_name, p.email, p.slug as requester_slug
FROM venue_claims vc
JOIN venues v ON vc.venue_id = v.id
JOIN profiles p ON vc.requester_id = p.id
WHERE vc.status = 'pending'
ORDER BY vc.created_at ASC;
```

### 4.2 Admin Review Information

At review time, admin sees:

| Field | Source | Purpose |
|-------|--------|---------|
| Venue name | `venues.name` | What's being claimed |
| Venue address | `venues.address` | Location context |
| Requester name | `profiles.full_name` | Who's claiming |
| Requester email | `profiles.email` | Contact info |
| Claim message | `venue_claims.message` | User's justification |
| Requester profile link | `/songwriters/{slug}` | Review their history |
| Venue happenings | Count of events at venue | Activity level |
| Existing claims | Other pending claims for same venue | Conflict detection |

### 4.3 Admin Actions

| Action | Effect | Required Fields |
|--------|--------|-----------------|
| Approve | Creates `venue_managers` row, sets `status='approved'` | None |
| Reject | Sets `status='rejected'` | `rejection_reason` (optional but recommended) |
| Request Info | Sends email to requester asking for more details | `message` to send |

### 4.4 Approval Side Effects

On approve:
1. Insert into `venue_managers` with `role='owner'`, `grant_method='claim_approved'`
2. Send email notification to requester (template: `venueClaimApproved`)
3. Create dashboard notification for requester
4. Log to `app_logs` for audit

### 4.5 Admin Revocation

**Location:** `/dashboard/admin/venues/[id]/managers`

| Action | Conditions | Side Effects |
|--------|------------|--------------|
| Revoke manager | Any manager | Sets `revoked_at`, `revoked_by`, `revocation_reason` |
| Revoke owner | Must not be last owner unless venue being abandoned | Same + notifies other owners if any |

**Revocation is soft-delete:** Row remains with `revoked_at` set for audit trail.

---

## 5. Invite Link Flow (Admin-Initiated)

### 5.1 Proposed Table: `venue_invites`

```sql
CREATE TABLE venue_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  -- Token for link
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- Optional: tie to specific email
  email TEXT,  -- If set, only this email can accept

  -- Role granted on accept
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('owner', 'manager')),

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',

  -- Acceptance
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES profiles(id),

  -- Revocation
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id)
);
```

### 5.2 Invite Token Lifecycle

```
                    ┌─────────────┐
                    │   (start)   │
                    └──────┬──────┘
                           │ Admin creates
                           ▼
                    ┌─────────────┐
        ┌──────────▶│   active    │
        │           └──────┬──────┘
        │                  │
        │    ┌─────────────┼─────────────┬─────────────┐
        │    │             │             │             │
        │    ▼             ▼             ▼             ▼
        │ ┌──────┐   ┌──────────┐   ┌────────┐   ┌─────────┐
        │ │expire│   │  accept  │   │ revoke │   │re-create│
        │ └──┬───┘   └────┬─────┘   └───┬────┘   └────┬────┘
        │    │            │             │             │
        │    ▼            ▼             ▼             └──────┐
        │ ┌──────┐   ┌──────────┐   ┌────────┐              │
        │ │expire│   │ accepted │   │revoked │              │
        │ │  d   │   │(terminal)│   │        │              │
        │ └──────┘   └──────────┘   └────────┘              │
        │                  │                                │
        │                  │ (on accept)                    │
        │                  ▼                                │
        │           ┌────────────────┐                      │
        │           │ INSERT INTO    │                      │
        │           │ venue_managers │                      │
        │           │ grant_method=  │                      │
        │           │'invite_accepted│                      │
        │           └────────────────┘                      │
        │                                                   │
        └───────────────────────────────────────────────────┘
```

### 5.3 Invite URL Format

```
https://denversongwriterscollective.org/venues/claim?token={token}
```

### 5.4 Invite Acceptance Logic

```typescript
// Pseudocode for /api/venues/invite/accept
async function acceptInvite(token: string, userId: string) {
  const invite = await getInvite(token);

  // Validation checks
  if (!invite) throw new Error("Invalid invite link");
  if (invite.expires_at < now()) throw new Error("Invite expired");
  if (invite.revoked_at) throw new Error("Invite revoked");
  if (invite.accepted_at) throw new Error("Invite already used");
  if (invite.email && invite.email !== user.email) {
    throw new Error("This invite is for a different email address");
  }

  // Check if user already has access
  const existingAccess = await getVenueManager(invite.venue_id, userId);
  if (existingAccess && !existingAccess.revoked_at) {
    throw new Error("You already have access to this venue");
  }

  // Accept
  await transaction(async (tx) => {
    // Mark invite as accepted
    await tx.update(venue_invites)
      .set({ accepted_at: now(), accepted_by: userId })
      .where({ id: invite.id });

    // Grant access
    await tx.insert(venue_managers)
      .values({
        venue_id: invite.venue_id,
        user_id: userId,
        role: invite.role,
        grant_method: 'invite_accepted',
        granted_by: invite.created_by
      });
  });
}
```

### 5.5 Security Considerations

| Concern | Mitigation |
|---------|------------|
| Token guessing | 32-char hex (128-bit entropy) |
| Token reuse | `accepted_at` prevents double-accept |
| Token forwarding | Optional `email` field restricts who can accept |
| Stale tokens | 7-day default expiration |
| Rogue invites | Admin-only creation, audit logged |

---

## 6. Permissions Matrix

### 6.1 Venue Actions by Role

| Action | Anonymous | Member | Venue Manager | Venue Owner | Admin |
|--------|-----------|--------|---------------|-------------|-------|
| View venue page | Yes | Yes | Yes | Yes | Yes |
| View venue notes | No | No | No | No | Yes |
| Edit venue info | No | No | Yes | Yes | Yes |
| Add manager | No | No | No | Yes* | Yes |
| Remove manager | No | No | No | Yes** | Yes |
| Remove owner | No | No | No | No | Yes |
| Submit claim | No | Yes | No*** | No*** | Yes |
| Approve claims | No | No | No | No | Yes |
| Create invite link | No | No | No | No | Yes |
| Revoke invite | No | No | No | No | Yes |

*Owner can only add managers, not other owners
**Owner can only remove managers, not other owners
***Already has access, claim not applicable

### 6.2 Venue Manager Editable Fields

| Field | Manager Can Edit | Owner Can Edit | Admin Can Edit |
|-------|------------------|----------------|----------------|
| name | Yes | Yes | Yes |
| address | Yes | Yes | Yes |
| city | Yes | Yes | Yes |
| state | Yes | Yes | Yes |
| zip | Yes | Yes | Yes |
| website_url | Yes | Yes | Yes |
| phone | Yes | Yes | Yes |
| google_maps_url | Yes | Yes | Yes |
| accessibility_notes | Yes | Yes | Yes |
| parking_notes | Yes | Yes | Yes |
| notes (admin-only) | No | No | Yes |
| slug | No | No | Yes |

### 6.3 Event-Related Venue Capabilities

| Capability | Venue Manager | Venue Owner | Notes |
|------------|---------------|-------------|-------|
| See events at venue | Yes | Yes | Public data anyway |
| Edit events at venue | No | No | Events owned by event hosts |
| Claim events at venue | Yes | Yes | Same as any member |
| Priority listing? | Deferred | Deferred | Future monetization option |

---

## 7. Conflict & Edge Cases

### 7.1 Two Users Claim Same Venue

**Scenario:** User A and User B both submit claims for "Brewery Rickoli" while it's unclaimed.

**Handling:**
1. Both claims enter `pending` status
2. Admin reviews both, sees both in queue
3. Admin approves one (creates owner)
4. Second claim remains pending — admin must explicitly reject or approve (as manager)
5. UI shows "This venue has another pending claim" when reviewing

**Decision:** Do NOT auto-reject second claim. Admin may want to approve both as co-owners.

### 7.2 Venue Already Claimed, New Claim Arrives

**Scenario:** "Mercury Cafe" has an approved owner. New user submits claim.

**Handling:**
1. Claim allowed — enters `pending` status
2. Admin reviews with context: "This venue already has owner: {name}"
3. Admin can:
   - Reject (user is not legitimate)
   - Approve as manager (user is staff, not owner)
   - Approve as owner (replace/add to ownership)

**Decision:** Claims always allowed. Admin makes judgment call.

### 7.3 Venue Claimed by Wrong Person

**Scenario:** Malicious user claims "The Walnut Room" before actual owner. Actual owner complains.

**Handling:**
1. Admin receives complaint (email/contact form)
2. Admin revokes incorrect owner with reason: "Incorrectly claimed, real owner verified"
3. Admin creates invite for actual owner
4. Or: Admin approves actual owner's claim, revokes fake owner

**Audit Trail:** All revocations logged with reason.

### 7.4 Admin Deletes Venue with Owners

**Scenario:** Admin wants to delete duplicate venue "Mercury Cafe (duplicate)" which has managers.

**Handling:**
1. `venue_managers` entries deleted via `ON DELETE CASCADE`
2. `venue_claims` entries deleted via `ON DELETE CASCADE`
3. `venue_invites` entries deleted via `ON DELETE CASCADE`
4. Email notifications sent to affected managers: "Venue was removed"

**Decision:** Hard delete cascades. Soft-delete alternative would require more complexity.

### 7.5 Venue Merged After Claim (ABC3 Pattern)

**Scenario:** "Rails End" and "Rails End Beer Company" are merged. Both have different owners.

**Handling:**
1. During merge, canonical venue keeps its managers
2. Duplicate venue's managers are transferred to canonical (if not already present)
3. Duplicate venue deleted (cascades claims/invites)
4. Notification sent to transferred managers

**Decision:** Merge transfers managers. Admin reviews for conflicts before merging.

### 7.6 User Deletes Account with Venue Ownership

**Scenario:** User with venue ownership deletes their account.

**Handling:**
- `venue_managers` entries deleted via `ON DELETE CASCADE`
- If user was sole owner, venue becomes unclaimed
- Other managers (if any) notified

**Decision:** Account deletion removes access. Venue data persists (owned by platform).

---

## 8. Audit & Safety Considerations

### 8.1 Actions That Must Be Logged

| Action | Log Target | Log Fields |
|--------|------------|------------|
| Claim submitted | `app_logs` | user_id, venue_id, claim_id |
| Claim approved | `app_logs` | admin_id, claim_id, venue_id |
| Claim rejected | `app_logs` | admin_id, claim_id, rejection_reason |
| Manager added | `app_logs` | actor_id, venue_id, user_id, role, method |
| Manager revoked | `app_logs` | actor_id, venue_id, user_id, revocation_reason |
| Invite created | `app_logs` | admin_id, venue_id, email (if set) |
| Invite accepted | `app_logs` | user_id, venue_id, invite_id |
| Invite revoked | `app_logs` | admin_id, invite_id |
| Venue edited by manager | `app_logs` | user_id, venue_id, changed_fields |

### 8.2 Reversible Actions

| Action | Reversibility | Method |
|--------|---------------|--------|
| Claim approval | Revoke the created manager | Admin revokes, reason logged |
| Claim rejection | User can re-apply | New claim row |
| Manager grant | Revoke | Soft-delete with reason |
| Manager revocation | Re-grant or new invite | Admin can re-add |
| Invite creation | Revoke | Soft-delete |
| Invite acceptance | Revoke the manager | Admin revokes |

### 8.3 Notification Triggers

| Event | Recipient | Channel | Template |
|-------|-----------|---------|----------|
| Claim submitted | Admin(s) | Dashboard + Email | `venueClaimSubmitted` |
| Claim approved | Requester | Dashboard + Email | `venueClaimApproved` |
| Claim rejected | Requester | Dashboard + Email | `venueClaimRejected` |
| Invite created | Invitee (if email) | Email only | `venueInvite` |
| Invite accepted | Creator | Dashboard | `venueInviteAccepted` |
| Manager revoked | Affected user | Dashboard + Email | `venueAccessRevoked` |
| Venue deleted | All managers | Dashboard + Email | `venueDeleted` |

### 8.4 Email Preference Category

New preference category: `venue_updates`

Maps to templates:
- `venueClaimSubmitted` (admin)
- `venueClaimApproved`
- `venueClaimRejected`
- `venueInvite`
- `venueAccessRevoked`
- `venueDeleted`

---

## 9. Open Questions

### 9.1 Ownership Transfer

**Question:** Can an owner transfer their ownership to another user without admin involvement?

**Tentative Answer:** No. All ownership changes require admin approval or admin-issued invite. This prevents social engineering attacks where venue staff are tricked into transferring control.

**Decision needed:** Confirm this restriction is acceptable.

### 9.2 Automatic Claim for Event Hosts

**Question:** If a user hosts an event at a venue, should they get any special status for claiming that venue?

**Tentative Answer:** No automatic status, but the claim review UI should show "Hosts X events at this venue" as context.

**Decision needed:** Confirm no auto-approval path.

### 9.3 Venue Manager Dashboard

**Question:** Where do venue managers access their venue editing capabilities?

**Tentative Answer:** New section in user dashboard: `/dashboard/my-venues`

**Decision needed:** Confirm dashboard location and navigation.

### 9.4 Multiple Owners vs Single Owner

**Question:** Should we allow multiple owners, or is one owner with multiple managers sufficient?

**Tentative Answer:** Allow multiple owners. Real venues may have co-owners (business partners). The schema supports this.

**Decision needed:** Confirm multiple owners allowed.

---

## 10. STOP-GATE Checklist

- [x] Ownership model documented (1:many with roles)
- [x] Claim flow state machine designed
- [x] Admin approval workflow documented
- [x] Invite link flow designed
- [x] Permissions matrix created
- [x] Conflict and edge cases documented
- [x] Audit and safety requirements specified
- [x] Open questions surfaced

**Awaiting approval to proceed with ABC8 implementation.**

---

*Investigation completed: January 2026*
*Author: Claude Code Agent*

# Phase ABC9 Investigation: Venue Manager Capabilities v1

> **Investigation Only** — No code modifications. STOP-GATE protocol applies.

## 1. Executive Summary

This investigation defines the minimum safe capability set for venue managers after ABC8 claiming is complete. The goal is to close trust/abuse gaps before adding more power.

**Current State (Post-ABC8):**
- Venue managers exist in `venue_managers` table
- Managers can view their venues at `/dashboard/my-venues`
- Managers can relinquish access
- **Managers CANNOT edit venue info** (admin-only today)

**Proposed v1 Scope:**
- Enable managers/owners to edit non-sensitive venue fields
- Add audit logging for venue edits
- Add admin UI to view/manage venue managers
- Define edge case handling

---

## 2. Current Capabilities Inventory (Post-ABC8)

### 2.1 What Venue Managers CAN Do Today

| Capability | Owner | Manager | File Path |
|-----------|-------|---------|-----------|
| View my venues dashboard | ✅ | ✅ | `dashboard/my-venues/page.tsx` |
| Relinquish access | ✅ (blocked if sole) | ✅ | `api/my-venues/[id]/route.ts` |
| Submit claim for unclaimed venue | ✅ | ✅ | `api/venues/[id]/claim/route.ts` |
| Cancel own pending claim | ✅ | ✅ | `api/venues/[id]/claim/route.ts` |

### 2.2 What Venue Managers CANNOT Do Today

| Capability | Why Not | Recommended |
|-----------|---------|-------------|
| Edit venue info | No endpoint exists | Add in ABC9 |
| View co-managers | No UI for it | Add in ABC9 |
| Invite other managers | Admin-only | Keep admin-only for v1 |
| Remove managers | Admin-only | Keep admin-only for v1 |
| See RSVPs/analytics for venue | Not implemented | Defer to ABC10+ |
| Message attendees | Not implemented | Defer |

### 2.3 Admin-Only Capabilities Today

| Capability | File Path |
|-----------|-----------|
| View/approve/reject venue claims | `api/admin/venue-claims/` |
| Create invite links | `api/admin/venues/[id]/invite/route.ts` |
| Revoke invites | `api/admin/venues/[id]/invite/[inviteId]/route.ts` |
| Edit venue info | `api/admin/venues/[id]/route.ts` |
| Delete venues | `api/admin/venues/[id]/route.ts` |

---

## 3. Proposed v1 Capability Set

### 3.1 Manager-Editable Fields

| Field | Manager | Owner | Admin | Notes |
|-------|---------|-------|-------|-------|
| `name` | ✅ | ✅ | ✅ | Business name |
| `address` | ✅ | ✅ | ✅ | Street address |
| `city` | ✅ | ✅ | ✅ | |
| `state` | ✅ | ✅ | ✅ | |
| `zip` | ✅ | ✅ | ✅ | |
| `website_url` | ✅ | ✅ | ✅ | |
| `phone` | ✅ | ✅ | ✅ | |
| `google_maps_url` | ✅ | ✅ | ✅ | |
| `accessibility_notes` | ✅ | ✅ | ✅ | |
| `parking_notes` | ✅ | ✅ | ✅ | |
| `contact_link` | ✅ | ✅ | ✅ | |
| `notes` | ❌ | ❌ | ✅ | Admin-only internal notes |
| `slug` | ❌ | ❌ | ✅ | URL affects SEO/links |
| `neighborhood` | ❌ | ❌ | ✅ | Taxonomy control |

**Decision:** Managers and owners have identical edit permissions. The role difference is:
- **Owner:** Can leave even if sole owner? No (blocked to prevent orphaning)
- **Manager:** Can always leave

### 3.2 Capabilities NOT in v1

| Capability | Reason to Defer |
|-----------|-----------------|
| Invite other managers | Risk: permission escalation without admin review |
| Remove other managers | Risk: ownership disputes without admin mediation |
| View venue analytics | Not yet built; scope creep |
| Moderate happenings at venue | Complex; needs separate design |
| Upload venue logo/cover | Storage considerations; defer |

---

## 4. Authorization Model

### 4.1 Helper Functions Required

```typescript
// Check if user is an active venue manager (any role)
async function isVenueManager(supabase, venueId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("venue_managers")
    .select("id")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .single();
  return !!data;
}

// Check if user is a venue owner specifically
async function isVenueOwner(supabase, venueId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("venue_managers")
    .select("id")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .eq("role", "owner")
    .is("revoked_at", null)
    .single();
  return !!data;
}

// Get user's role for a venue (null if not a manager)
async function getVenueRole(supabase, venueId: string, userId: string): Promise<'owner' | 'manager' | null> {
  const { data } = await supabase
    .from("venue_managers")
    .select("role")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .single();
  return data?.role ?? null;
}
```

### 4.2 Authorization Matrix for v1

| Endpoint | Admin | Owner | Manager | Public |
|----------|-------|-------|---------|--------|
| `GET /api/venues/[id]` | ✅ | ✅ | ✅ | ✅ (public data) |
| `PATCH /api/venues/[id]` (proposed) | ✅ | ✅ | ✅ | ❌ |
| `GET /api/venues/[id]/managers` (proposed) | ✅ | ✅ | ✅ | ❌ |
| `POST /api/admin/venues/[id]/invite` | ✅ | ❌ | ❌ | ❌ |
| `DELETE /api/admin/venues/[id]` | ✅ | ❌ | ❌ | ❌ |

### 4.3 RLS Policy Updates Needed

Current venues table RLS:
- Public SELECT (anyone can read)
- No UPDATE policy for managers

**Required:** Add UPDATE policy:
```sql
CREATE POLICY "venue_managers_can_update"
ON venues FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM venue_managers
    WHERE venue_managers.venue_id = venues.id
    AND venue_managers.user_id = auth.uid()
    AND venue_managers.revoked_at IS NULL
  )
)
WITH CHECK (
  -- Same condition for the new values
  EXISTS (
    SELECT 1 FROM venue_managers
    WHERE venue_managers.venue_id = venues.id
    AND venue_managers.user_id = auth.uid()
    AND venue_managers.revoked_at IS NULL
  )
);
```

**Alternative:** Keep using service role client in API and enforce checks in code (current pattern).

**Recommendation:** Use code-level checks for v1 to match existing pattern, add RLS in future hardening phase.

---

## 5. Admin Control Surfaces

### 5.1 Current Admin Surfaces

| Surface | Shows | Missing |
|---------|-------|---------|
| `/dashboard/admin/venues` | Venue list, CRUD | Manager list per venue |
| `/dashboard/admin/venue-claims` | Pending claims | Resolved claims history |

### 5.2 Proposed Admin Additions

#### A) Venue Detail Admin Panel

Add to `/dashboard/admin/venues` or new `/dashboard/admin/venues/[id]`:

- **Managers Section:**
  - List of active managers (name, role, grant_method, granted_at)
  - Revoke button with reason prompt
  - "Add Manager" quick action (admin direct grant)

- **Pending Invites Section:**
  - List of active invites (email restriction, expires_at, created_by)
  - Revoke button

- **Claims History:**
  - Past claims (approved/rejected) with dates and reasons

#### B) Audit Log View

- Filter by venue_id
- Show venue edit history
- Show manager grant/revoke history

### 5.3 Files to Create/Modify

| File | Change |
|------|--------|
| `api/venues/[id]/route.ts` | NEW - Manager PATCH endpoint |
| `api/venues/[id]/managers/route.ts` | NEW - List managers for venue |
| `dashboard/my-venues/[id]/page.tsx` | NEW - Venue edit form for managers |
| `dashboard/admin/venues/[id]/page.tsx` | NEW - Admin venue detail with managers |
| `lib/venue/authorization.ts` | NEW - Auth helper functions |
| `lib/audit/venueAudit.ts` | NEW - Audit logging |

---

## 6. Edge Cases and Required Outcomes

### 6.1 Venue Merged After Managers Exist

**Scenario:** ABC3 merge procedure deletes duplicate venue. What happens to its managers?

**Current behavior:** `venue_managers` has `ON DELETE CASCADE` - managers are deleted.

**Risk:** User loses access with no notification.

**Required outcome:**
- Before merge: Admin must check for managers on duplicate venue
- If managers exist: Either transfer them to canonical OR notify and revoke
- Add to merge procedure: "Check venue_managers count before DELETE"

**Recommendation:** Update ABC3 merge procedure to include venue_managers check.

### 6.2 Owner Account Deleted

**Scenario:** A venue owner deletes their account.

**Current behavior:** `venue_managers` has `ON DELETE CASCADE` on user_id FK - their manager row is deleted.

**Risk:** Venue could become orphaned (no owners).

**Required outcome:**
- If sole owner deletes account: Admin notification
- System should flag venues with 0 active owners
- Add to admin dashboard: "Orphaned venues" alert

### 6.3 Multiple Owners Disagree

**Scenario:** Two owners conflict on venue info edits.

**Current behavior:** Last write wins.

**Risk:** Edit wars, incorrect information.

**Required outcome:**
- Audit log tracks who made each edit
- Admin can review history and mediate
- No technical lock needed for v1 (social problem, not technical)

### 6.4 Manager Edits Vandalism

**Scenario:** Manager makes destructive edits (deletes address, adds inappropriate content).

**Risk:** Public venue page shows bad data.

**Required outcome:**
- Audit log shows who/when/what changed
- Admin can revert via direct DB query (or future revert UI)
- Repeat offenders: Admin revokes access with reason

### 6.5 Invite Token Leaked Publicly

**Scenario:** Admin creates invite, URL gets shared on social media.

**Current protection:**
- Invite has expiration (default 7 days)
- Optional email restriction
- Single-use (accepted_at set on use)

**Risk:** Random person claims manager access.

**Required outcome:**
- Current protections sufficient for v1
- Future: Add "max uses" field to invites

### 6.6 Claimed Venue Later Found Incorrect

**Scenario:** User claims "Joe's Bar" but it's actually a different business.

**Risk:** Wrong person managing wrong venue data.

**Required outcome:**
- Admin can revoke access with reason
- Rejection/revocation emails already implemented
- Add to admin UI: Quick "revoke all access" for venue

---

## 7. Audit Logging Requirements

### 7.1 Existing Mechanism

`lib/audit/moderationAudit.ts` logs to `app_logs` table:
- `level`: info/warn/error
- `message`: Action description
- `context`: JSON with details
- `user_id`: Actor
- `source`: Module identifier

### 7.2 Proposed Venue Audit Actions

| Action | Logged Fields |
|--------|---------------|
| `venue_edited` | venue_id, actor_id, changed_fields, old_values, new_values |
| `venue_manager_granted` | venue_id, user_id, role, grant_method, granted_by |
| `venue_manager_revoked` | venue_id, user_id, revoked_by, reason |
| `venue_invite_created` | venue_id, invite_id, created_by, email_restriction |
| `venue_invite_revoked` | venue_id, invite_id, revoked_by, reason |

### 7.3 Implementation

Create `lib/audit/venueAudit.ts` following `moderationAudit.ts` pattern:

```typescript
type VenueAction =
  | "venue_edited"
  | "venue_manager_granted"
  | "venue_manager_revoked"
  | "venue_invite_created"
  | "venue_invite_revoked";

export const venueAudit = {
  venueEdited: (actorId, ctx) => logVenueAction("venue_edited", actorId, ctx),
  // ... etc
};
```

---

## 8. Acceptance Criteria

### 8.1 Permission Tests

- [ ] Manager can edit allowed venue fields
- [ ] Manager cannot edit restricted fields (slug, notes, neighborhood)
- [ ] Non-manager cannot edit venue
- [ ] Admin can edit any venue
- [ ] Sole owner cannot relinquish (already tested in ABC8)

### 8.2 RLS/API Security

- [ ] Unauthenticated requests return 401
- [ ] Non-manager requests return 403
- [ ] Manager requests succeed
- [ ] Audit log written for every edit

### 8.3 Admin UI

- [ ] Admin can view managers list per venue
- [ ] Admin can revoke manager access
- [ ] Admin can see audit history

### 8.4 Smoke Checklist

| Test | Expected |
|------|----------|
| Manager edits venue website_url | Updates successfully, audit logged |
| Manager tries to edit slug | Returns 403 or field ignored |
| Non-manager tries to edit | Returns 403 |
| Admin revokes manager | User removed from venue, notified |
| View venue after manager edit | Shows updated info |

---

## 9. Risks and Recommendations

### 9.1 Top 5 Risks

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Manager vandalism | Audit logging + admin revert capability |
| 2 | Venue orphaning on merge | Update merge procedure to check managers |
| 3 | Edit wars between owners | Audit trail for admin mediation |
| 4 | Leaked invite tokens | Existing expiration + email restriction |
| 5 | Schema not in repo | Create migration file for ABC8 tables |

### 9.2 Recommended v1 Scope

**Include:**
1. Manager venue edit endpoint (`PATCH /api/venues/[id]`)
2. Manager venue edit UI (`/dashboard/my-venues/[id]`)
3. Audit logging for venue edits
4. Admin manager list view per venue
5. Update merge procedure documentation

**Exclude (defer to ABC10+):**
1. Manager-initiated invites
2. Manager-initiated removals
3. Venue analytics
4. Logo/cover image upload
5. Event moderation by venue

### 9.3 Schema Changes Required

**None for v1** - All required tables exist from ABC8.

However, ABC8 migration file should be created and committed:
- `supabase/migrations/20260112000000_abc8_venue_claiming.sql`
- Contains: venue_managers, venue_claims, venue_invites tables
- Regenerate database.types.ts

---

## 10. Open Questions

1. **Should managers see each other's contact info?** (email in profiles)
   - Recommendation: No, only name and role

2. **Should edit notifications go to all managers?**
   - Recommendation: No for v1, add later if needed

3. **Should there be a "description" field for venues?**
   - Currently no description field exists
   - Recommendation: Add in future schema update, not in v1

---

**END OF INVESTIGATION**

**Next Step:** Await STOP-GATE approval before implementation.

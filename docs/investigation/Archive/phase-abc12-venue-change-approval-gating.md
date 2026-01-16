# Phase ABC12 — Venue Change Approval Gating

> **Status:** STOP-GATE COMPLETE (Investigation Only)
> **Created:** 2026-01-12
> **Author:** Repo Agent

---

## 1. Problem Statement

With ABC8-11 complete, venue managers can now edit their venues. However, unrestricted editing creates risk:

1. **Vandalism:** Malicious managers could deface venue data (name, address)
2. **Accidental errors:** Well-meaning managers could break data integrity
3. **SEO impact:** Frequent name changes could affect search rankings
4. **Trust erosion:** Users may lose confidence if venue data is unstable

**Goal:** Prevent vandalism and accidental data corruption while keeping the manager UX fast for low-risk edits.

---

## 2. Current State (ABC10)

| Feature | Status |
|---------|--------|
| Manager edit capability | ✅ Live (`PATCH /api/my-venues/[id]`) |
| Audit trail | ✅ Live (every edit logged to `app_logs`) |
| Admin revert | ✅ Live (`POST /api/admin/venues/[id]/revert`) |
| Edit notifications | ❌ None (admin not alerted to changes) |
| Approval gating | ❌ None (all changes instant) |
| Rate limiting | ❌ None |

**Current Risk:** A rogue manager could rapidly vandalize venue data. Admin would only discover via manual review.

---

## 3. Proposed Policy Tiers

### Tier 1: Instant (No Review Required)

Low-risk fields that don't affect discoverability or trust:

| Field | Rationale |
|-------|-----------|
| `parking_notes` | Helpful info, low abuse potential |
| `accessibility_notes` | Helpful info, low abuse potential |
| `contact_link` | Links can be changed frequently |

**Behavior:** Edit applied immediately, logged to audit trail.

### Tier 2: Soft-Gated (Alert Admin)

Medium-risk fields that affect user experience:

| Field | Rationale |
|-------|-----------|
| `website_url` | Could redirect to malicious site |
| `phone` | Incorrect phone = missed bookings |
| `google_maps_url` | Could link to wrong location |

**Behavior Options:**
- **A (lighter):** Edit applied immediately, admin notified, revert available
- **B (stricter):** Edit queued, admin must approve/reject within 24h, auto-approve if no action

### Tier 3: Hard-Gated (Requires Admin Approval)

High-risk fields that define venue identity:

| Field | Rationale |
|-------|-----------|
| `name` | Core identity, SEO impact |
| `address` | Physical location, maps integration |
| `city` | Location data integrity |
| `state` | Location data integrity |
| `zip` | Location data integrity |

**Behavior:** Edit queued in pending state, admin must approve/reject. Manager sees "Pending review" status.

---

## 4. Proposed Enforcement Points

### 4.1 API Layer (`PATCH /api/my-venues/[id]`)

```typescript
// Pseudocode
const tierClassification = classifyFields(changedFields);

if (tierClassification.tier3.length > 0) {
  // Queue for approval
  await createPendingEdit(venueId, tier3Changes);
  return NextResponse.json({
    status: "pending_review",
    message: "High-impact changes require admin approval",
    pendingFields: tier3Changes
  }, { status: 202 });
}

if (tierClassification.tier2.length > 0) {
  // Apply but notify admin
  await applyEdit(venueId, allChanges);
  await notifyAdminOfEdit(venueId, tier2Changes);
}

// Tier 1: Apply silently
await applyEdit(venueId, allChanges);
```

### 4.2 Admin UI

New section in admin venue detail page:

```
## Pending Changes

| Field | Current | Proposed | Manager | Submitted |
|-------|---------|----------|---------|-----------|
| name  | "Joe's" | "HACKED" | @badguy | 2 hours ago |

[Approve] [Reject with reason]
```

### 4.3 Manager UI

When Tier 3 changes are pending:

```
⚠️ Pending Review

Your changes to venue name and address are awaiting admin approval.
Submitted: January 12, 2026 at 3:45 PM

[Cancel Request]
```

---

## 5. Abuse Controls

### 5.1 Rate Limiting

| Control | Proposed Limit |
|---------|----------------|
| Edits per venue per day | 10 |
| Tier 3 requests per venue per week | 2 |
| Total pending requests per manager | 5 |

### 5.2 Admin Notifications

| Trigger | Notification |
|---------|--------------|
| Any Tier 2 edit | Dashboard notification |
| Any Tier 3 request | Dashboard + email notification |
| 3+ edits in 1 hour | "Unusual activity" alert |
| Same field edited 3x in 24h | "Repeated edit" alert |

### 5.3 Transparency

Add to venue detail page (visible to managers):

```
Last edited by: @manager_name
Last edit: January 12, 2026 at 2:30 PM
```

---

## 6. Data Model Options

### Option A: `venue_pending_edits` Table (Recommended for Tier 3)

```sql
CREATE TABLE venue_pending_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  -- What's changing
  field_name TEXT NOT NULL,
  current_value TEXT,
  proposed_value TEXT,

  -- Review status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Prevent duplicates
  UNIQUE(venue_id, field_name, status) WHERE status = 'pending'
);
```

**Pros:**
- Clear audit trail for pending changes
- Manager can see their pending requests
- Admin can batch review

**Cons:**
- Additional table to maintain
- More complex UI flow

### Option B: Log-Only + Revert + Alerting (Current + Enhanced)

Keep current instant-edit behavior but add:
- Real-time admin notifications for all edits
- "Unusual activity" detection algorithm
- Admin can revert within minutes

**Pros:**
- Simpler implementation
- No workflow change for managers
- Leverages existing audit/revert

**Cons:**
- Reactive, not preventive
- Admin must monitor actively
- Damage occurs before revert

### Recommendation

**Hybrid Approach:**
- Tier 1/2: Option B (instant + alerting)
- Tier 3: Option A (pending queue)

This balances UX (most edits instant) with protection (identity changes gated).

---

## 7. Impacted Surfaces

### API Routes

| Route | Change Required |
|-------|-----------------|
| `PATCH /api/my-venues/[id]` | Add tier classification, pending queue logic |
| `GET /api/my-venues/[id]` | Return pending edits for this venue |
| `POST /api/admin/venues/[id]/pending/[editId]/approve` | NEW: Approve pending edit |
| `POST /api/admin/venues/[id]/pending/[editId]/reject` | NEW: Reject pending edit |
| `DELETE /api/my-venues/[id]/pending/[editId]` | NEW: Cancel pending request |

### UI Components

| Component | Change Required |
|-----------|-----------------|
| `VenueEditForm.tsx` | Show pending status, disable Tier 3 fields if pending |
| Admin venue detail page | Add "Pending Changes" section |
| `VenueManagersList.tsx` | Show "last edit" info per manager |

### Notifications

| Notification | Template Needed |
|--------------|-----------------|
| Tier 2 edit applied | `venueEditNotification.ts` |
| Tier 3 request submitted | `venuePendingEditRequest.ts` |
| Tier 3 request approved | `venuePendingEditApproved.ts` |
| Tier 3 request rejected | `venuePendingEditRejected.ts` |
| Unusual activity alert | `venueUnusualActivity.ts` |

### RLS Policies

| Table | New Policies |
|-------|--------------|
| `venue_pending_edits` | Managers see own pending, admins see all |

### Tests

| Test File | Coverage |
|-----------|----------|
| `phase-abc12-approval-gating.test.ts` | Tier classification, queue logic, approval/rejection |

---

## 8. GO/NO-GO Criteria

### GO (Start Implementation) When:

- [ ] Sami approves the tier classification (which fields in which tier)
- [ ] Sami approves the hybrid approach (Option B for Tier 1/2, Option A for Tier 3)
- [ ] Decision made on auto-approve timeout (24h? 48h? never?)
- [ ] Rate limit numbers confirmed

### NO-GO (Do Not Implement Yet) If:

- Tier classification is disputed
- Simpler "Option B only" approach preferred
- Rate limiting deferred to separate phase
- Other ABC phases take priority

---

## 9. Open Questions

1. **Auto-approve timeout:** Should Tier 3 changes auto-approve after X hours if no admin action?
   - Recommendation: No auto-approve (require explicit action)

2. **Bulk edits:** If manager submits multiple Tier 3 fields at once, one request or multiple?
   - Recommendation: One request per changed field (granular approval)

3. **Historical data:** Should we backfill "last edited by" for existing venues?
   - Recommendation: Only track going forward (audit trail has history)

4. **Manager communication:** How do we notify managers of approval/rejection?
   - Recommendation: Dashboard notification + email

---

## 10. Summary

ABC12 proposes a tiered approval system for venue edits:

| Tier | Fields | Behavior | Rationale |
|------|--------|----------|-----------|
| 1 | parking_notes, accessibility_notes, contact_link | Instant | Low risk |
| 2 | website_url, phone, google_maps_url | Instant + alert | Medium risk |
| 3 | name, address, city, state, zip | Queued for approval | High risk |

**Recommended Implementation:** Hybrid approach using existing audit/revert for Tier 1/2, new `venue_pending_edits` table for Tier 3.

**Estimated Scope:**
- 1 new database table
- 3-4 new API routes
- 2-3 UI component updates
- 4-5 new email templates
- ~40-50 new tests

---

*Investigation completed 2026-01-12. Awaiting Sami approval for ABC12 implementation.*

# Phase 4.92: Event Ownership & Claim UX Audit — STOP-GATE Investigation

**Date:** 2026-01-27
**Status:** STOP-GATE 1 — Investigation complete, awaiting approval
**Scope:** Investigation ONLY (no code, no migrations, no UI proposals)

---

## 1. Executive Summary

This investigation audits whether the current system can support proactive event invites — specifically, the workflow where an admin pre-lists real-world events and invites hosts/venues who may not yet be members.

**Finding:** The system is **NOT structurally capable** of supporting this workflow. The core primitive — a token-based `event_invites` table — does not exist. The venue ownership track has this infrastructure (`venue_invites`, `/venue-invite` acceptance page, admin invite UI), but events lack all equivalent components. Hosts can only be invited via member name search, which fails entirely for non-members. The current workaround (manual email with signup instructions) loses system state and creates dead-ends.

---

## 2. YES / NO Matrix — Investigation Checklist

### 2.1 Structural Primitives

| Question | Answer | Evidence |
|----------|--------|----------|
| Is there a persistent `event_invites` table? | **NO** | Table does not exist. Only `event_hosts` (for accepted/pending member invites) and `event_claims` (for claim requests) exist. |
| Does it support `token`? | **NO** | N/A — table doesn't exist |
| Does it support `email_restriction` (optional)? | **NO** | N/A |
| Does it support `expiry`? | **NO** | N/A |
| Does it support `role` granted (host/co-host/manager)? | **NO** | N/A |
| Is there a public `/event-invite?token=...` acceptance route? | **NO** | No such page exists. `/venue-invite` exists for venues but not events. |
| Does accepting the invite auto-assign ownership? | **NO** | N/A — no invite mechanism for non-members |
| Does it auto-accept on login/signup (like venue invites)? | **NO** | N/A |

### 2.2 Admin Capabilities

| Question | Answer | Evidence |
|----------|--------|----------|
| Can admins create event invites for non-members? | **NO** | CoHostManager only searches existing members. "Invite someone new" just shows a manual email template to copy/paste. |
| Can admins resend or revoke invites? | **PARTIAL** | Can cancel pending co-host invites (for members), but no resend. No invite system exists for non-members. |
| Is there visibility into invite status (sent/accepted/expired)? | **PARTIAL** | Pending co-host invites shown in CoHostManager. No tracking for manual emails to non-members. |

### 2.3 Host / Venue UX

| Question | Answer | Evidence |
|----------|--------|----------|
| Can a host invite another host? | **NO** | CoHostManager only creates `role: "cohost"` entries. Cannot invite as primary host. |
| Can a host invite a venue manager? | **NO** | Event and venue ownership are separate tracks. No cross-invite capability. |
| Can a venue manager invite a host? | **NO** | Same — separate tracks with no linkage. |
| Does venue ownership automatically confer event management rights? | **NO** | `venue_managers` and `event_hosts` are completely separate. Having venue access grants zero event access. |

### 2.4 Claim Flow Reality Check

| Question | Answer | Evidence |
|----------|--------|----------|
| Can a known host claim an event without admin latency? | **NO** | All claims require admin approval via `/dashboard/admin/claims`. No "trusted user" bypass. |
| Are admins notified when a claim is submitted? | **YES** | Notification sent via `create_user_notification` RPC. |
| Is there a single-click acceptance path? | **YES** | Admin can click "Approve" once in ClaimsTable. But latency exists between submission and approval. |

### 2.5 Dead-End Detection

| Dead-End | Where It Occurs | Impact |
|----------|-----------------|--------|
| Non-member invite fails at search | CoHostManager → "Invite existing member" → search returns nothing | Admin hits wall, must use manual workaround |
| Manual email loses state | Admin sends email via Gmail/Mail app | System has no record of pending invite; no way to track or resend |
| Signup doesn't preserve intent | Non-member signs up at `/signup` after receiving email | No link to the event invite; admin must re-search and re-invite |
| Claim requires "come back later" | User submits claim → must wait for admin | Cannot proceed with event management until approved |
| Co-host promotion impossible | Primary host leaves → co-host remains co-host | Event becomes unhosted; co-host cannot self-promote |

---

## 3. Top 3 UX Risks (Ranked by Severity)

### Risk 1: No Token-Based Event Invites — CRITICAL

**Severity:** Blocks entire non-member onboarding flow

**Impact:** The core use case — "admin invites non-member host" — is impossible within the system. Every non-member invite requires:
1. Manual email copy/paste
2. Out-of-band follow-up ("hey, did you sign up yet?")
3. Re-search and re-invite after signup
4. Second acceptance step

**Scale Problem:** With hundreds of events and hosts, this creates unsustainable admin burden.

---

### Risk 2: Claim Latency Blocks Real-Time Handoff — HIGH

**Severity:** Adds friction to every ownership transfer

**Impact:** Even when both parties (admin + host) are ready, the claim/approve cycle adds delay:
- User submits claim → waits
- Admin may not see claim for hours/days
- User wonders "did it work?"

**Mitigation Needed:** Either auto-approval for known users, or token-based invites that bypass claims entirely.

---

### Risk 3: Venue ≠ Event Access Creates Confusion — MEDIUM

**Severity:** Violates user expectations

**Impact:** Venue managers expect to manage events at their venue. They cannot. This creates:
- Repeated "why can't I edit this?" support requests
- Duplicate invite workflows (venue invite + event invite separately)
- Perception of arbitrary barriers

---

## 4. Missing Primitives (Explicit List)

| Primitive | Exists for Venues? | Exists for Events? |
|-----------|-------------------|-------------------|
| `*_invites` table with token hash | YES (`venue_invites`) | **NO** |
| Public `/x-invite?token=...` page | YES (`/venue-invite`) | **NO** |
| Admin "Create Invite" UI | YES (`VenueInviteSection`) | **NO** |
| Email template with acceptance link | YES | **NO** |
| `grant_method: 'invite'` tracking | YES | **NO** |
| Auto-accept on login | YES | **NO** |
| Revoke invite capability | YES | **NO** (only cancel pending member invites) |
| Invite status visibility | YES | **NO** |

---

## 5. Verdict

### Is the system structurally capable of proactive event invites?

## **NO**

**Reasoning:**
- The `event_invites` table does not exist
- There is no public acceptance page for event invites
- There is no admin UI to create token-based invites
- The only invite mechanism (CoHostManager) requires the recipient to already be a member
- Manual email workarounds lose system state and create dead-ends

**Comparison:** The venue ownership track has all of these primitives. The event ownership track has none of them.

---

## 6. STOP-GATE STATUS

## **STOP — Structural primitives missing**

The following must be created before the intended UX is achievable:

1. `event_invites` database table (schema matching `venue_invites`)
2. `/event-invite` public acceptance page
3. `/api/admin/events/[id]/invite` API routes
4. `/api/event-invites/accept` acceptance API
5. Admin UI component (EventInviteSection)
6. Event invite email template with token link

---

**STOP-GATE 1 — Approved 2026-01-27**

---

# STOP-GATE 2: Implementation Design (Design Only)

**Date:** 2026-01-27
**Status:** STOP-GATE 2 — Design complete, awaiting approval
**Scope:** DESIGN ONLY (no code, no migrations, no file changes)

---

## 7. Minimal Data Model

### 7.1 Proposed `event_invites` Table

Schema mirrors `venue_invites` with event-specific fields:

```sql
CREATE TABLE IF NOT EXISTS event_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target event
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Token (stored as SHA-256 hash, plaintext shown once)
  token_hash TEXT NOT NULL UNIQUE,

  -- Optional email restriction (if set, only this email can accept)
  email_restriction TEXT,

  -- Role granted on acceptance
  role TEXT NOT NULL DEFAULT 'host' CHECK (role IN ('host', 'cohost')),

  -- Lifecycle timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',

  -- Acceptance tracking
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES profiles(id),

  -- Revocation tracking
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),
  revoked_reason TEXT
);
```

### 7.2 Indexes

```sql
-- Fast token lookup (primary query path)
CREATE UNIQUE INDEX idx_event_invites_token_hash ON event_invites(token_hash);

-- List invites per event (admin UI)
CREATE INDEX idx_event_invites_event_id ON event_invites(event_id);

-- List invites created by user (audit)
CREATE INDEX idx_event_invites_created_by ON event_invites(created_by);
```

### 7.3 RLS Policies

| Policy | Rule |
|--------|------|
| Admin can manage all | `role = 'admin'` → full access |
| Authenticated can lookup by token | `auth.uid() IS NOT NULL` → SELECT WHERE `token_hash = ?` |
| Creator can see own invites | `auth.uid() = created_by` → SELECT |
| No public access | Anonymous users cannot query |

### 7.4 Relationship to Existing Tables

| Table | Relationship |
|-------|--------------|
| `events` | `event_invites.event_id` → `events.id` (CASCADE delete) |
| `profiles` | `created_by`, `accepted_by`, `revoked_by` → `profiles.id` |
| `event_hosts` | On acceptance, creates row with `grant_method: 'invite'` |

---

## 8. Acceptance Flow

### 8.1 Public Page: `/event-invite?token=...`

**URL:** `/event-invite?token={plaintext_token}`

**Behavior:**

```
1. Page loads with token in query param
2. If no token → show error "Invalid invite link"
3. If not authenticated:
   a. Store token in session/URL
   b. Redirect to /login?redirect=/event-invite?token={token}
   c. After login, return to this page
4. If authenticated:
   a. Call POST /api/event-invites/accept with token
   b. On success → redirect to event edit page
   c. On error → show appropriate message
```

**Error States:**

| Condition | Message |
|-----------|---------|
| Invalid/unknown token | "This invite link is invalid or has already been used." |
| Expired | "This invite has expired. Please contact the admin for a new link." |
| Already accepted | "This invite has already been accepted." |
| Revoked | "This invite has been cancelled." |
| Email mismatch | "This invite was sent to a different email address." |
| Already a host | "You're already a host for this event." |

### 8.2 Accept API: `POST /api/event-invites/accept`

**Request Body:**
```json
{
  "token": "plaintext_token_string"
}
```

**Process:**
1. Hash the token with SHA-256
2. Lookup `event_invites` WHERE `token_hash = hash`
3. Validate:
   - Not already accepted (`accepted_at IS NULL`)
   - Not revoked (`revoked_at IS NULL`)
   - Not expired (`expires_at > NOW()`)
   - Email matches if restriction set
   - User not already in `event_hosts` for this event
4. Transaction:
   - Update `event_invites` SET `accepted_at = NOW()`, `accepted_by = auth.uid()`
   - Insert into `event_hosts` with `grant_method: 'invite'`, role from invite
   - If role is 'host' and `events.host_id IS NULL`, update `events.host_id`
5. Notify invite creator (dashboard notification)
6. Return success with event ID

**Response:**
```json
{
  "success": true,
  "event_id": "uuid",
  "event_title": "Open Mic Night",
  "role": "host"
}
```

### 8.3 Auto-Accept on Signup Flow

When a non-member clicks an invite link:
1. Redirect to `/login?redirect=/event-invite?token={token}`
2. User sees "Don't have an account? Sign up"
3. After signup, callback redirects back to `/event-invite?token={token}`
4. Page auto-accepts using the preserved token
5. User lands on event edit page as new host

**Key invariant:** Token stays in URL through entire auth flow. No session storage needed.

---

## 9. Admin UX (v1)

### 9.1 Location

New component: `EventInviteSection` in `/dashboard/my-events/[id]/page.tsx`

Visible to: Admins only (v1), potentially primary hosts later

### 9.2 Create Invite UI

**Form Fields:**

| Field | Type | Required | Default |
|-------|------|----------|---------|
| Email restriction | text input | No | (none) |
| Role | dropdown | Yes | "host" |
| Expiry | dropdown | Yes | "7 days" |

**Expiry Options:** 3 days, 7 days, 14 days, 30 days

**On Submit:**
1. Call `POST /api/admin/events/[id]/invite`
2. Response includes one-time invite URL
3. Display URL in modal with copy button
4. Show pre-formatted email template with copy button

**One-Time URL Display:**
```
┌─────────────────────────────────────────────────┐
│ Invite Created                                   │
│                                                  │
│ This link will only be shown once:              │
│ ┌─────────────────────────────────────────────┐ │
│ │ https://dsc.org/event-invite?token=abc123   │ │
│ └─────────────────────────────────────────────┘ │
│                                    [Copy Link]   │
│                                                  │
│ Email Template:                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Subject: You're invited to host "Open Mic"  │ │
│ │                                             │ │
│ │ Hi,                                         │ │
│ │                                             │ │
│ │ You've been invited to host "Open Mic       │ │
│ │ Night" on the Denver Songwriters            │ │
│ │ Collective platform.                        │ │
│ │                                             │ │
│ │ Click here to accept: [link]                │ │
│ │                                             │ │
│ │ This invite expires in 7 days.              │ │
│ └─────────────────────────────────────────────┘ │
│                                 [Copy Email]     │
└─────────────────────────────────────────────────┘
```

### 9.3 Pending Invites List

Below the create form, show active invites:

| Email | Role | Created | Expires | Status | Actions |
|-------|------|---------|---------|--------|---------|
| (anyone) | host | Jan 27 | Feb 3 | Pending | [Revoke] |
| john@example.com | cohost | Jan 25 | Feb 1 | Pending | [Revoke] |

**Status Values:**
- Pending (not accepted, not revoked, not expired)
- Accepted (shows accepted_at date)
- Expired (past expires_at)
- Revoked (shows revoked_at date)

**Actions:**
- Revoke: Confirm dialog → sets `revoked_at`, `revoked_by`

### 9.4 Create Invite API: `POST /api/admin/events/[id]/invite`

**Request Body:**
```json
{
  "email_restriction": "john@example.com",  // optional
  "role": "host",
  "expires_in_days": 7
}
```

**Process:**
1. Verify user is admin
2. Generate secure random token (32 bytes hex)
3. Hash token with SHA-256
4. Insert into `event_invites`
5. Return one-time URL with plaintext token

**Response:**
```json
{
  "invite_id": "uuid",
  "invite_url": "https://dsc.org/event-invite?token=abc123...",
  "expires_at": "2026-02-03T00:00:00Z"
}
```

### 9.5 List Invites API: `GET /api/admin/events/[id]/invite`

Returns all invites for the event (including accepted/revoked for audit).

### 9.6 Revoke Invite API: `DELETE /api/admin/events/[id]/invite/[inviteId]`

Sets `revoked_at` and `revoked_by`. Does NOT hard-delete (audit trail).

---

## 10. Relationship to Existing Systems

### 10.1 `event_hosts` Table

**Current Schema:**
```sql
event_hosts (
  id, event_id, user_id, role, invited_by, invited_at,
  invitation_status, grant_method
)
```

**Integration:**
- On invite acceptance → INSERT into `event_hosts` with:
  - `grant_method: 'invite'` (new value)
  - `invitation_status: 'accepted'`
  - `invited_by: invite.created_by`
  - `role: invite.role`

**`grant_method` Values:**
- `claim` — User claimed unclaimed event, admin approved
- `invite` — User accepted token-based invite (NEW)
- `admin` — Admin directly assigned user
- `creator` — User created the event

### 10.2 `event_claims` Table

**Relationship:** Claims and invites are parallel paths to ownership.

| Path | Use Case | Admin Involvement |
|------|----------|-------------------|
| Claim | User finds unclaimed event, requests ownership | Admin approves/rejects |
| Invite | Admin proactively invites known host | None (direct grant) |

**No Conflict:** Claims are for unclaimed events. Invites are for any event. Both result in `event_hosts` rows.

### 10.3 `events.host_id` Column

**Behavior on Invite Acceptance:**
- If `events.host_id IS NULL` AND invite role is 'host':
  - SET `events.host_id = accepting_user_id`
- If `events.host_id` is already set:
  - Do NOT overwrite
  - User becomes co-host or additional host via `event_hosts`

### 10.4 CoHostManager Component

**Current:** Only searches existing members, creates `event_hosts` rows directly.

**With Invites:** CoHostManager remains for member-to-member invites. EventInviteSection handles non-member invites. Both populate `event_hosts` with different `grant_method`.

---

## 11. Explicit Non-Goals for v1

| Non-Goal | Reason | Future Phase |
|----------|--------|--------------|
| Host-to-host invites | Adds complexity; admin-only in v1 | v2 |
| Bulk invite creation | Single invite UI sufficient for launch | v2 |
| Auto-send email | Copy/paste prevents spam abuse | v2 |
| Venue-event cross-invites | Separate ownership tracks; complex | v3 |
| Trusted user auto-approval | Requires trust scoring system | v3 |
| Invite to multiple events | Per-event invites simpler | v2 |
| Mobile-optimized accept page | Desktop-first MVP | v2 |
| Invite analytics/metrics | Launch first, measure later | v2 |

---

## 12. Risk & Edge-Case Analysis

### 12.1 Security Risks

| Risk | Mitigation |
|------|------------|
| Token leakage | SHA-256 hash stored; plaintext shown once |
| Token brute-force | 32-byte random = 256 bits entropy; rate limiting on accept endpoint |
| Invite URL sharing | Email restriction option; accept requires auth |
| Expired token reuse | Expiry checked server-side; hard reject |

### 12.2 UX Edge Cases

| Scenario | Handling |
|----------|----------|
| User already a host | Accept returns "already a host" error; no duplicate row |
| User accepts after being removed | Creates new `event_hosts` row; fresh start |
| Multiple pending invites | Each can be accepted independently |
| Admin revokes after user started signup | Revoke check happens at acceptance, not page load |
| Event deleted while invite pending | CASCADE delete removes invite; accept shows "event not found" |

### 12.3 Data Integrity

| Scenario | Handling |
|----------|----------|
| Orphaned invites (event deleted) | CASCADE delete via FK |
| Double-accept race condition | Unique constraint on token_hash; transaction isolation |
| Revoke during acceptance | Transaction checks revoked_at before updating |

### 12.4 Operational Risks

| Risk | Mitigation |
|------|------------|
| Admin creates invite, forgets to send | Pending invites list visible; expiry auto-cleans |
| Invites pile up | List shows all states; manual revoke available |
| Email goes to spam | Pre-formatted subject line; copy/paste gives admin control |

---

## 13. Go/No-Go Checklist

### 13.1 Prerequisites (Must Have)

| Item | Status | Notes |
|------|--------|-------|
| `venue_invites` pattern documented | ✅ | Migration `20260112000000` |
| `venue_invites` API routes working | ✅ | Tested in production |
| `/venue-invite` page working | ✅ | Auto-accept flow proven |
| `event_hosts` table exists | ✅ | Current schema supports `grant_method` |
| Admin auth helpers exist | ✅ | `checkAdminRole()` in use |

### 13.2 Implementation Checklist

| Item | Complexity | Dependencies |
|------|------------|--------------|
| 1. Create `event_invites` migration | Low | None |
| 2. Add RLS policies | Low | Migration |
| 3. Create `/api/admin/events/[id]/invite` | Medium | Migration |
| 4. Create `/api/event-invites/accept` | Medium | Migration |
| 5. Create `/event-invite` page | Medium | Accept API |
| 6. Create EventInviteSection component | Medium | Invite API |
| 7. Integrate into event edit page | Low | Component |
| 8. Add email template | Low | None |
| 9. Write tests | Medium | All above |

### 13.3 Rollback Plan

| Scenario | Action |
|----------|--------|
| Migration fails | Standard `supabase db reset` to last known good |
| API bugs | Feature flag to disable invite creation (invites in flight still work) |
| Accept page broken | Redirect to contact support; manually process pending |

### 13.4 Success Criteria

| Metric | Target |
|--------|--------|
| Admin can create invite | Yes/No |
| Non-member can accept after signup | Yes/No |
| Member can accept immediately | Yes/No |
| `event_hosts` row created correctly | Yes/No |
| Primary host slot filled if empty | Yes/No |
| Notification sent to invite creator | Yes/No |

---

## 14. Files to Create/Modify

### 14.1 New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDDHHMMSS_event_invites.sql` | Schema + RLS |
| `web/src/app/api/admin/events/[id]/invite/route.ts` | Create/list/revoke invites |
| `web/src/app/api/event-invites/accept/route.ts` | Accept invite |
| `web/src/app/event-invite/page.tsx` | Public acceptance page |
| `web/src/components/events/EventInviteSection.tsx` | Admin UI |
| `web/src/lib/email/templates/eventInviteNotification.ts` | Email template |
| `web/src/__tests__/event-invites.test.ts` | Test coverage |

### 14.2 Modified Files

| File | Change |
|------|--------|
| `web/src/app/(protected)/dashboard/my-events/[id]/page.tsx` | Add EventInviteSection for admins |
| `web/src/lib/supabase/database.types.ts` | Regenerate after migration |
| `web/src/lib/email/registry.ts` | Register new template |

---

## 15. STOP-GATE 2 STATUS

## **STOP-GATE 2 complete — awaiting Sami approval**

**Deliverables Complete:**
1. ✅ Minimal data model (`event_invites` schema)
2. ✅ Acceptance flow (`/event-invite?token=...` behavior)
3. ✅ Admin UX (v1) design
4. ✅ Relationship to existing systems
5. ✅ Explicit non-goals for v1
6. ✅ Risk & edge-case analysis
7. ✅ Go/No-Go checklist

**Next Step:** Upon approval, proceed to STOP-GATE 3 (Implementation).

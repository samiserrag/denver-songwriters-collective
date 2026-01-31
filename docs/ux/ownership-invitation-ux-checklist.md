# Ownership & Invitation UX Checklist

> A reusable checklist for any feature involving ownership, invites, claims, roles, delegation, approvals, revocation, or acceptance flows.

**When to use this checklist:**
- Before designing any feature that grants users access to objects they don't own
- Before building invite/claim systems for new entity types
- During STOP-GATE 1 investigations to confirm primitives exist
- When debugging dead-ends in ownership transfer flows

**Reference:** This checklist is mandatory per [DSC UX Principles §16](../DSC_UX_PRINCIPLES.md).

---

## 1. Definitions (North-Star Model)

### Core Concepts

| Term | Definition |
|------|------------|
| **Ownership** | The relationship between a user and an object that grants management rights. Ownership may be exclusive (one owner) or shared (multiple owners with roles). |
| **Role** | A named permission level within an ownership relationship. Examples: `owner`, `host`, `cohost`, `manager`, `viewer`. Roles define what actions a user can take. |
| **Grant Method** | How ownership was obtained. Must be tracked for audit. Values: `creator`, `claim`, `invite`, `admin`, `transfer`. |
| **Invite** | A proactive ownership offer from someone with authority to someone who may or may not be a member yet. Token-based. Does not require approval beyond acceptance. |
| **Claim** | A reactive ownership request from a user who believes they should own an object. Requires approval from an authority (usually admin). |
| **Manager** | A role with edit/publish rights but not full ownership transfer rights. Cannot delete the object or remove owners. |
| **Primary Owner** | The single user with highest authority over an object. Can transfer ownership, delete the object, or remove all other users. |
| **Co-owner / Cohost** | A user with significant management rights but subordinate to the primary owner. Cannot remove the primary owner. |

### Token-Based Invite (Technical Definition)

A token-based invite system has these properties:

1. **Token generation:** Cryptographically random (≥32 bytes / 256 bits entropy)
2. **Storage:** Only the SHA-256 hash is stored in the database; plaintext is never persisted
3. **Display:** Plaintext token is shown exactly once to the creator, then discarded
4. **URL format:** `/{entity}-invite?token={plaintext_token}`
5. **Acceptance:** Token is hashed client-side or server-side and matched against stored hash
6. **Lifecycle states:** pending → accepted | expired | revoked

### Acceptance (Technical Definition)

Acceptance is complete when:
1. The invite/claim row is marked as accepted (`accepted_at`, `accepted_by`)
2. A corresponding access row exists in the appropriate table (e.g., `*_hosts`, `*_managers`)
3. The `grant_method` field accurately reflects how access was granted
4. If this is the first owner, the object's primary owner field is set (if applicable)
5. The granting user is notified (dashboard notification, optionally email)

---

## 2. Role & Permission Matrix Template

Copy and fill this matrix for your feature:

### Template

| Actor | Object | Create | Edit | Publish | Invite Others | Revoke Access | Delete | Transfer Ownership | Notes |
|-------|--------|--------|------|---------|---------------|---------------|--------|-------------------|-------|
| Anonymous | [Entity] | | | | | | | | |
| Authenticated (no role) | [Entity] | | | | | | | | |
| Manager | [Entity] | | | | | | | | |
| Co-owner/Cohost | [Entity] | | | | | | | | |
| Primary Owner | [Entity] | | | | | | | | |
| Admin | [Entity] | | | | | | | | |

### Extended Questions (Must Answer)

| Question | Answer |
|----------|--------|
| Can a non-member be invited? | [ ] Yes / [ ] No |
| Can a non-member accept via token? | [ ] Yes (after signup) / [ ] No |
| Does token survive login/signup redirect? | [ ] Yes / [ ] No / [ ] N/A |
| Can invites be revoked? | [ ] Yes / [ ] No |
| Can pending invites be viewed by creator? | [ ] Yes / [ ] No |
| Can pending invites be viewed by admin? | [ ] Yes / [ ] No |
| What happens if primary owner leaves? | [Describe] |
| What happens if all owners leave? | [Describe] |

---

## 3. UX Dead-End Prevention Checklist

Before implementation, confirm:

### State Tracking
- [ ] Every invite/claim has a system-tracked status (not just email)
- [ ] Status is queryable by admin (for support)
- [ ] Status is visible to the creator (for follow-up)

### Action Continuity
- [ ] No action leaves the user at a dead-end
- [ ] Every screen has a visible next step or clear completion state
- [ ] "Manual email" is never the primary path (only as copy-paste backup)

### Recovery Paths
- [ ] Expired invites can be re-sent (new invite, same intent)
- [ ] Rejected claims can be re-submitted (with new information)
- [ ] Revoked access can be re-granted (new invite)

### Common Dead-Ends to Prevent

| Dead-End | Prevention |
|----------|------------|
| "Email sent manually, system doesn't know" | Token-based invites with system tracking |
| "User signed up but invite is gone" | Token preserved in URL through auth flow |
| "Claim submitted, no idea what happens next" | Pending status visible to user + estimated response time |
| "Admin approved but user never sees it" | Dashboard notification + email with deep-link |
| "Co-owner can't do anything after owner leaves" | Auto-promotion rules or explicit handoff flow |

---

## 4. Invite Flow Checklist (Token-Based)

### Lifecycle States

| State | Condition | User-Visible? | Actionable? |
|-------|-----------|---------------|-------------|
| **Pending** | Not accepted, not revoked, not expired | Yes (to creator + admin) | Creator can revoke |
| **Accepted** | `accepted_at IS NOT NULL` | Yes (to creator + admin) | No further action |
| **Expired** | `expires_at < NOW()` and not accepted | Yes (to creator + admin) | Creator can re-invite |
| **Revoked** | `revoked_at IS NOT NULL` | Yes (to creator + admin) | Creator can re-invite |

### Create Flow

- [ ] Creator specifies: role, optional email restriction, expiry
- [ ] System generates token (32 bytes random → hex)
- [ ] System stores SHA-256 hash only
- [ ] System returns plaintext URL exactly once
- [ ] UI displays one-time URL with copy button
- [ ] UI displays pre-formatted email template with copy button
- [ ] UI warns: "This link will only be shown once"

### Share Flow

- [ ] Creator copies URL manually (no auto-send in v1)
- [ ] Creator pastes into email/message of choice
- [ ] Email template includes: object name, expiry date, accept link

### Accept Flow

- [ ] Page loads with token in query param
- [ ] If invalid/missing token → clear error message
- [ ] If not authenticated → redirect to login with `?redirect=` preserving token
- [ ] After login/signup → return to accept page with token intact
- [ ] If authenticated → call accept API
- [ ] On success → redirect to object management page
- [ ] On error → show specific error (see Error States below)

### Post-Accept Landing

- [ ] User lands on the object's edit/management page
- [ ] Success toast or banner confirms role granted
- [ ] Creator receives dashboard notification
- [ ] Creator optionally receives email (respecting preferences)

### Error States (Required User-Facing Copy)

| Condition | Message |
|-----------|---------|
| Invalid/unknown token | "This invite link is invalid or has already been used." |
| Expired | "This invite has expired. Please contact the person who invited you for a new link." |
| Already accepted | "This invite has already been accepted." |
| Revoked | "This invite has been cancelled." |
| Email mismatch | "This invite was sent to a different email address. Please log in with that email or contact the inviter." |
| Already has role | "You already have access to this [object]." |
| Object deleted | "This [object] no longer exists." |

### Token Preservation Through Auth

```
1. User clicks invite URL (not logged in)
2. Page detects no session
3. Redirect: /login?redirect=/entity-invite?token={token}
4. User logs in OR clicks "Sign up" and completes registration
5. Auth callback redirects to: /entity-invite?token={token}
6. Accept page auto-processes token
7. User lands on management page
```

**Key invariant:** Token stays in URL. No session storage. No cookies for token.

---

## 5. Claim Flow Checklist (Approval-Based)

### Lifecycle States

| State | Condition | User-Visible? | Admin-Actionable? |
|-------|-----------|---------------|-------------------|
| **Pending** | Submitted, not reviewed | Yes (to claimant + admin) | Approve or Reject |
| **Approved** | Admin approved | Yes (to claimant) | N/A |
| **Rejected** | Admin rejected | Yes (to claimant, with reason) | Can re-review |
| **Cancelled** | Claimant withdrew | Yes (to admin for audit) | N/A |

### Submit Flow

- [ ] User finds unclaimed object (or partially claimed)
- [ ] User clicks "Claim" or "Request Access"
- [ ] UI shows form: optional message/reason field
- [ ] On submit: create claim record with status=pending
- [ ] Admin receives dashboard notification
- [ ] User sees confirmation: "Claim submitted. An admin will review your request."

### Waiting UX

- [ ] User can see claim status on the object page
- [ ] User can see claim status in their dashboard
- [ ] User can cancel pending claim
- [ ] No promise of response time (avoid "within 24 hours" claims)
- [ ] Optional: "Notify me when reviewed" toggle (email preference)

### Admin Queue UX

- [ ] Admin queue is reachable from admin dashboard
- [ ] Admin queue is filterable (by status, date, object type)
- [ ] Admin queue is searchable (by object name, claimant name)
- [ ] Each claim shows: object, claimant profile link, message, submitted date
- [ ] Admin can: Approve, Reject (with reason), Request More Info

### Approve Flow

- [ ] Admin clicks "Approve"
- [ ] System creates access row with `grant_method: 'claim'`
- [ ] If first owner, update object's primary owner field
- [ ] Claimant receives dashboard notification
- [ ] Claimant receives email (approval + link to manage)

### Reject Flow

- [ ] Admin clicks "Reject"
- [ ] Admin must provide reason (required field)
- [ ] Claimant receives dashboard notification with reason
- [ ] Claimant receives email with reason
- [ ] Claimant can submit new claim with updated information

---

## 6. Parallel Ownership Tracks (Relationship Rules)

When multiple entity types have ownership (e.g., Events + Venues):

### Decision Gate (Must Answer)

| Question | Decision |
|----------|----------|
| Does ownership of A confer any rights on B? | [ ] Yes (specify) / [ ] No (explicit separation) |
| Can owner of A invite someone to B? | [ ] Yes / [ ] No |
| Can owner of B invite someone to A? | [ ] Yes / [ ] No |
| Are there shared managers (access to both)? | [ ] Yes / [ ] No |
| What's the cross-invite behavior? | [ ] Deferred to vNext / [ ] Implementing now |

### Documentation Requirement

If two ownership tracks exist, the relationship must be:
1. Explicitly documented in the feature's STOP-GATE doc
2. Visible in admin UI (show related objects)
3. Explained in user-facing UI if relevant (e.g., "Managing this venue does not automatically grant access to events at this venue")

### Default Rule

> **Unless explicitly designed otherwise, ownership tracks are separate.**
> Venue managers cannot edit events. Event hosts cannot edit venues.
> Cross-access requires explicit invitation or claim on each entity type.

---

## 7. Observability & Audit Requirements

### Minimum Audit Fields

Every ownership grant/revoke must record:

| Field | Description |
|-------|-------------|
| `who` | User ID who performed the action |
| `what` | Object type + ID affected |
| `when` | Timestamp (UTC) |
| `action` | `grant` / `revoke` / `transfer` / `approve` / `reject` |
| `grant_method` | `creator` / `claim` / `invite` / `admin` / `transfer` |
| `role` | Role granted or revoked |
| `reason` | Optional text (required for rejections) |

### Admin Visibility Requirements

- [ ] Admin can query all invites for any object
- [ ] Admin can query all claims for any object
- [ ] Admin can see full history of ownership changes
- [ ] Admin can filter by: object, user, date range, grant_method

### Audit Log Location

Audit can be implemented via:
- Dedicated `*_audit_log` table (recommended for high-volume)
- `grant_method` + timestamp fields on access tables (acceptable for low-volume)
- Application-level logging to external service (supplement only, not primary)

---

## 8. Safety & Security Checklist

### Token Security

- [ ] Token entropy: ≥256 bits (32 bytes random → 64 hex chars)
- [ ] Token storage: SHA-256 hash only, never plaintext
- [ ] Token display: Shown exactly once, with copy button
- [ ] Token in URL: HTTPS only (never HTTP)

### Rate Limiting

- [ ] Accept endpoint: Rate limit per IP (e.g., 10/minute)
- [ ] Accept endpoint: Rate limit per user (e.g., 5/minute)
- [ ] Token lookup: No timing attacks (constant-time comparison)

### Brute Force Mitigation

- [ ] 256-bit tokens = 2^256 possibilities (infeasible to brute-force)
- [ ] Failed attempts do not reveal whether token exists
- [ ] Consider: lockout after N failed attempts per IP

### RLS Expectations

| Query | Auth Requirement |
|-------|------------------|
| Token lookup by hash | Authenticated user required |
| List own pending invites | Authenticated + user_id match |
| List all invites (admin) | Authenticated + admin role |
| Create invite | Authenticated + admin role (or owner in v2) |
| Accept invite | Authenticated |

### Token Leakage Prevention

- [ ] Tokens never logged (server logs, client analytics)
- [ ] Tokens never in error messages
- [ ] Tokens never sent to third-party services
- [ ] Tokens have expiry (default 7 days, max 30 days)

---

## 9. Test Checklist

### Contract Tests (Required)

| Test Case | What to Assert |
|-----------|----------------|
| Invalid token | Returns 400/404, clear error message |
| Expired token | Returns 400/410, "expired" error |
| Revoked token | Returns 400/410, "cancelled" error |
| Already accepted | Returns 400/409, "already used" error |
| Email restriction mismatch | Returns 403, "wrong email" error |
| Already has role | Returns 409, "already has access" error |
| Double-accept race | Only one succeeds, other gets 409 |
| Revoke-before-accept | Accept fails after revoke timestamp |
| Redirect preserves token | After login, token still in URL |
| Accept creates access row | `*_hosts` or `*_managers` row exists |
| Accept sets grant_method | `grant_method = 'invite'` |
| Accept notifies creator | Notification created |
| Primary owner set if empty | `object.owner_id` updated |

### UI Tests (Recommended)

| Test Case | What to Assert |
|-----------|----------------|
| Create invite shows URL once | URL visible, copy button works |
| Pending invites list renders | All pending invites shown |
| Revoke button works | Invite status changes to revoked |
| Accept page redirects if logged out | Redirect includes token |
| Accept page shows success | Toast/banner appears |
| Error states show correct message | Each error has distinct copy |

### Claim Flow Tests (Required)

| Test Case | What to Assert |
|-----------|----------------|
| Submit claim creates pending record | Status = pending |
| Admin notified on claim | Notification exists |
| Approve creates access row | `grant_method = 'claim'` |
| Reject records reason | Reason stored and visible |
| Claimant notified on approve/reject | Notification with correct type |
| Duplicate claim prevented | Cannot submit if pending exists |

---

## 10. STOP-GATE Questions (Must Answer Before Implementation)

Copy this section into your STOP-GATE 1 document and answer each question:

### Primitives

- [ ] Does the `*_invites` table exist?
- [ ] Does the `*_claims` table exist (if claims are needed)?
- [ ] Does the `*_hosts` / `*_managers` access table exist?
- [ ] Is there a `grant_method` column?
- [ ] Is there a public `/entity-invite?token=...` page?
- [ ] Is there an admin UI to create invites?
- [ ] Is there an admin UI to review claims?

### Flow Selection

- [ ] Which flow is primary for this entity: invite or claim?
- [ ] Are both flows needed, or can we defer one?
- [ ] Who can create invites? (admin-only vs owners)
- [ ] Who can approve claims? (admin-only vs delegated)

### Defaults & Edge Cases

- [ ] What is the default owner for pre-seeded/imported objects?
- [ ] What happens if an object has no owner? (Dead state?)
- [ ] Is there an admin-only escape hatch? (Direct grant without invite/claim)
- [ ] What's the UX if a user never claims/accepts?

### Rollback & Safety

- [ ] What's the rollback plan if migration fails?
- [ ] Can invites be disabled via feature flag?
- [ ] What's the manual recovery path if accept page breaks?

---

## 11. How to Apply This Checklist

### Step 1: Define Roles & Ownership Objects

- List all roles that will exist (owner, cohost, manager, etc.)
- Define what each role can do (use the permission matrix template)
- Identify the object type(s) involved

### Step 2: Choose Invite vs Claim Paths

- **Invite:** Proactive. Authority reaches out to user. No approval queue.
- **Claim:** Reactive. User reaches out to authority. Approval required.
- Most features need both, but prioritize one for v1.

### Step 3: Confirm Primitives Exist

- Check if database tables exist
- Check if API routes exist
- Check if UI components exist
- If primitives are missing, document in STOP-GATE 1

### Step 4: Write STOP-GATE 1 Doc

- Use the YES/NO matrix from this checklist
- Answer all STOP-GATE questions
- Document dead-ends and risks
- End with clear verdict: "Primitives present" or "Primitives missing"

### Step 5: Propose STOP-GATE 2 Design

Only after STOP-GATE 1 approval:
- Design the data model (if new)
- Design the acceptance flow
- Design the admin UX
- Design the user-facing UX
- Document non-goals
- Document risks and rollback plan

---

## Appendix A: Example — Events & Venues (Phase 4.92)

This appendix references findings from Phase 4.92 investigation.

### Context

DSC has two ownership tracks:
- **Events:** owned by hosts via `event_hosts` table
- **Venues:** owned by managers via `venue_managers` table

### Findings (Phase 4.92)

| Primitive | Venues | Events |
|-----------|--------|--------|
| Token-based invites table | ✅ `venue_invites` | ❌ Missing |
| Public accept page | ✅ `/venue-invite` | ❌ Missing |
| Admin invite UI | ✅ `VenueInviteSection` | ❌ Missing |
| Claims table | ✅ `venue_claims` | ✅ `event_claims` |
| Admin claims queue | ✅ | ✅ |

### Dead-Ends Found

1. Admin cannot invite non-member hosts (only search existing members)
2. Manual email workaround loses system state
3. Signup doesn't preserve invite intent
4. Claim latency creates "come back later" UX

### Resolution

Phase 4.92 STOP-GATE 2 proposes creating `event_invites` table mirroring `venue_invites`, plus `/event-invite` accept page and `EventInviteSection` admin component.

### Cross-Track Rule

> Venue ownership does NOT confer event management rights.
> Event ownership does NOT confer venue management rights.
> Cross-access requires explicit invitation on each entity.

This was an explicit design decision (Phase 4.92 Section 10.4), not an oversight.

---

## Appendix B: Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│             INVITE vs CLAIM Quick Reference             │
├─────────────────────────────────────────────────────────┤
│ INVITE (Proactive)          │ CLAIM (Reactive)          │
│ • Authority → User          │ • User → Authority        │
│ • Token-based               │ • Approval-based          │
│ • No queue, instant accept  │ • Admin queue required    │
│ • Good for known contacts   │ • Good for unknown users  │
│ • Requires invite UI        │ • Requires claim button   │
├─────────────────────────────────────────────────────────┤
│                    BOTH REQUIRE                         │
│ • Access table with grant_method column                 │
│ • Admin visibility into pending/accepted/rejected       │
│ • User notification on completion                       │
│ • Audit trail (who/what/when/how)                       │
└─────────────────────────────────────────────────────────┘
```

---

## Revision History

| Date | Version | Change |
|------|---------|--------|
| 2026-01-27 | 1.0 | Initial checklist created (Phase 4.92 extraction) |

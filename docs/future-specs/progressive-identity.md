# Progressive Identity Spec

**Status:** Draft - Awaiting Approval
**Created:** December 2024
**Author:** Claude Code

---

## Scope: Shared Infrastructure

> **This spec applies to BOTH products in the dual-track strategy.**

Progressive Identity is part of the **shared core** — the same email-only identity system powers both:

| Product | Progressive Identity Role |
|---------|--------------------------|
| **The Colorado Songwriters Collective** | Email verification for claims; optional upgrade to full profile |
| **Open Mic Manager (white-label)** | Email verification for claims; NO profiles in MVP |

### Key Principle: No Passwords

Neither product requires passwords for basic performer actions:
- **View lineup**: No identity needed
- **Claim/cancel slot**: Verified email only
- **Confirm offered slot**: Magic link (email-based)

### Product Divergence

| Aspect | DSC | White-Label MVP |
|--------|-----|-----------------|
| Full profiles | Yes (optional) | No |
| Profile upgrade path | Verified email → profile | Not in MVP |
| Host accounts | Approved hosts | Simple accounts |
| Admin dashboard | Full featured | Host-only controls |

---

## Overview

Progressive Identity enables guests to perform limited actions (claim slots, confirm offers, cancel claims) via email verification without creating a full account. This bridges the gap between fully-anonymous walk-up guests and registered members.

## Goals

1. **Lower friction for first-time performers** - They can claim a slot with just an email
2. **Enable guest self-service** - Guests can confirm offers and cancel their own claims
3. **Preserve privacy** - Emails are never displayed publicly
4. **Maintain security** - Prevent abuse while allowing legitimate guest actions
5. **Path to membership** - Verified guests can convert to full accounts seamlessly

---

## 1. Guest Actions Without an Account

### Allowed Actions (with email verification)

| Action | Current State | Progressive Identity |
|--------|---------------|---------------------|
| **Claim open slot** | Requires login | Email + verification code |
| **Join waitlist** | Requires login | Email + verification code |
| **Confirm offered slot** | Requires login | Magic link from email |
| **Cancel own claim** | Requires login | Magic link from email |
| **View TV display** | Public | No change (remains public) |

### NOT Allowed for Guests

- View/manage other claims
- Add guests (host-only action)
- Mark performed/no-show (host-only action)
- Control "Now Playing" (host-only action)
- RSVP to events (requires account for event tracking)
- Access dashboard or profile features

### Guest Display Behavior

- TV display shows guest name (no QR code, no profile link)
- Public slot list shows "Guest: {name}" (no email displayed)
- Host slot management shows guest name + masked email (j***@example.com)

---

## 2. Email Verification Mechanism

### Option A: One-Time Code (Recommended)

**Flow for claiming:**
1. Guest enters name + email on claim form
2. System sends 6-digit code to email (expires in 15 minutes)
3. Guest enters code on same page
4. Claim is created with `guest_verified = true`

**Flow for confirming offers / cancelling:**
1. System emails guest when slot is offered or as a reminder
2. Email contains magic link with signed token
3. Click link → lands on page with pre-filled action (confirm/cancel)
4. Action completes immediately (token validates identity)

### Why One-Time Code vs Magic Link for Initial Claim

| Aspect | One-Time Code | Magic Link |
|--------|---------------|------------|
| **User stays on page** | Yes | No (redirected away) |
| **Mobile-friendly** | Yes (no app switching) | Requires email app |
| **Easier to copy/paste** | Yes (6 digits) | No (long URL) |
| **Phishing resistance** | Higher (no URL to spoof) | Lower |

### Token/Code Specifications

```
Initial claim verification code:
- 6 alphanumeric characters (uppercase, no ambiguous chars like 0/O, 1/I)
- Valid for 15 minutes
- Single use (invalidated after verification)
- Rate limited: 3 codes per email per hour

Action magic links (confirm/cancel):
- JWT signed with secret key
- Contains: email, claim_id, action, expires_at
- Valid for 24 hours (matches offer window)
- Single use (token marked used after action)
```

---

## 3. Abuse Prevention

### Rate Limits

| Limit | Value | Scope |
|-------|-------|-------|
| Verification codes per email | 3 per hour | Per email address |
| Verification attempts | 5 per code | Per code |
| Claims per email per event | 1 | Per event |
| Total guest claims per event | Configurable (default: 50% of slots) | Per event |

### One-Guest-Per-Event Rule

- Same email can only have ONE active claim per event
- Cancelled claims don't count (email can reclaim)
- Prevents one person hoarding multiple slots

### Lockouts

- **Code lockout**: 5 failed verification attempts → 30-minute lockout
- **Email lockout**: 10 failed verifications in 24h → 24-hour block
- **IP lockout**: 50 verification attempts in 1h → 1-hour block (soft, per IP)

### Spam Prevention

- Require valid email format (RFC 5322)
- Consider email domain reputation (optional: block disposable email domains)
- Honeypot field on claim form (hidden input that bots fill)
- CAPTCHA on initial claim if abuse detected (not by default)

### Host Override

- Hosts can add guests without email verification (existing flow)
- Hosts can cancel guest claims without guest consent
- Hosts see masked email for guest communication

---

## 4. Privacy Constraints

### Email Visibility

| Context | Email Display |
|---------|---------------|
| Public slot list | Never shown |
| TV display | Never shown |
| Host slot management | Masked: j***@example.com |
| Admin panel | Full email (for support) |
| Guest's own view (via magic link) | Full email |

### Data Retention

- Unverified claim attempts: Deleted after 1 hour
- Verified guest emails: Retained with claim
- Cancelled claims: Email retained for 30 days (abuse tracking), then anonymized
- Completed claims: Email retained indefinitely (for re-engagement)

### GDPR/Privacy Considerations

- Guest email stored only for operational purposes
- No marketing without explicit opt-in
- Guest can request email deletion (anonymizes claim to "Guest: {name}")
- No sharing of guest emails with third parties

---

## 5. Database Changes

### New Table: `guest_verifications`

```sql
CREATE TABLE public.guest_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  timeslot_id UUID REFERENCES event_timeslots(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES timeslot_claims(id) ON DELETE SET NULL,

  -- Verification code (for initial claim)
  code TEXT, -- 6-char alphanumeric, hashed
  code_expires_at TIMESTAMPTZ,
  code_attempts INT DEFAULT 0,

  -- Action token (for confirm/cancel via email)
  action_token TEXT, -- JWT or signed token
  action_type TEXT, -- 'confirm' | 'cancel'
  token_expires_at TIMESTAMPTZ,
  token_used BOOLEAN DEFAULT FALSE,

  -- State
  verified_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  CONSTRAINT valid_action_type CHECK (action_type IN ('confirm', 'cancel', NULL))
);

-- Indexes for common queries
CREATE INDEX idx_guest_verifications_email ON guest_verifications(email);
CREATE INDEX idx_guest_verifications_code ON guest_verifications(code) WHERE code IS NOT NULL;
CREATE INDEX idx_guest_verifications_token ON guest_verifications(action_token) WHERE action_token IS NOT NULL;
CREATE INDEX idx_guest_verifications_event ON guest_verifications(event_id);

-- Unique: one active verification per email per event
CREATE UNIQUE INDEX idx_guest_verifications_unique_active
  ON guest_verifications(email, event_id)
  WHERE verified_at IS NULL AND locked_until IS NULL;
```

### Modified Table: `timeslot_claims`

```sql
-- Add columns for guest email tracking
ALTER TABLE public.timeslot_claims
  ADD COLUMN guest_email TEXT,
  ADD COLUMN guest_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN guest_verification_id UUID REFERENCES guest_verifications(id);

-- Index for guest email lookups
CREATE INDEX idx_timeslot_claims_guest_email ON timeslot_claims(guest_email)
  WHERE guest_email IS NOT NULL;

-- Constraint: guest_email required when guest_name is set (for new guest claims)
-- Note: Existing host-added guests won't have email, so this is nullable
```

### RLS Policies

```sql
-- Guest verifications: Only viewable by the guest (via signed token) or admin
CREATE POLICY "Admins can view all verifications"
  ON guest_verifications FOR SELECT
  USING (is_admin());

-- No public INSERT/UPDATE/DELETE on guest_verifications - API-only
-- Service role handles all verification operations

-- Modified claim policies for guest self-service
-- Guests can view their own claims via verified email match
CREATE POLICY "Guests can view own claims via email"
  ON timeslot_claims FOR SELECT
  USING (
    -- Standard member access
    member_id = auth.uid()
    OR
    -- Guest access requires verified email match (checked via API, not RLS)
    -- This is a placeholder - actual guest access uses service role + token validation
    FALSE
  );
```

**Note:** Guest operations bypass RLS using service role client, with token validation in API layer.

---

## 6. API Endpoints

### New Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/guest/request-code` | POST | None | Request verification code |
| `/api/guest/verify-code` | POST | None | Verify code + create claim |
| `/api/guest/action` | POST | Token | Confirm offer or cancel claim |
| `/api/guest/resend-code` | POST | None | Resend verification code |

### Endpoint Details

#### POST `/api/guest/request-code`

```typescript
// Request
{
  event_id: string;
  slot_index: number;
  guest_name: string;
  guest_email: string;
}

// Response (success)
{
  success: true,
  message: "Verification code sent",
  verification_id: string, // Used for verify-code call
  expires_at: string // ISO timestamp
}

// Response (rate limited)
{
  error: "Too many requests",
  retry_after: 3600 // seconds
}
```

#### POST `/api/guest/verify-code`

```typescript
// Request
{
  verification_id: string;
  code: string; // 6-char code from email
}

// Response (success)
{
  success: true,
  claim: TimeslotClaim,
  action_url: string // URL for future actions (confirm/cancel)
}

// Response (invalid)
{
  error: "Invalid or expired code",
  attempts_remaining: 2
}
```

#### POST `/api/guest/action`

```typescript
// Request (via magic link query params or body)
{
  token: string; // Signed JWT
  action: "confirm" | "cancel"
}

// Response (success)
{
  success: true,
  message: "Slot confirmed" | "Claim cancelled"
}
```

### Threat Model Notes

| Threat | Mitigation |
|--------|------------|
| **Email enumeration** | Generic "code sent" response regardless of email existence |
| **Code brute force** | 5 attempts per code, lockout after failures |
| **Token theft** | Tokens are single-use, expire in 24h |
| **Replay attacks** | Token marked `used=true` after first action |
| **CSRF on actions** | Token in URL, no cookies needed (stateless) |
| **Man-in-middle** | HTTPS only, no sensitive data in URL params |
| **Spam via email endpoint** | Rate limits + optional CAPTCHA |
| **Disposable emails** | Optional: integrate email validation service |

---

## 7. Migration & Rollout Plan

### Phase 1: Database Migration (Non-Breaking)

1. Add `guest_verifications` table
2. Add `guest_email`, `guest_verified`, `guest_verification_id` columns to `timeslot_claims`
3. Both columns nullable - existing claims unaffected
4. Deploy migration, verify no issues

### Phase 2: API Endpoints (Feature-Flagged)

1. Implement guest verification endpoints
2. Add `ENABLE_GUEST_VERIFICATION=false` env var
3. When disabled, endpoints return 404
4. Deploy to production with flag off

### Phase 3: UI Integration (Feature-Flagged)

1. Add "Claim as Guest" option to `TimeslotClaimButton`
2. Create `GuestClaimForm` component with email + code verification
3. Add `GuestActionPage` for magic link handling (`/guest/action?token=...`)
4. All behind same feature flag

### Phase 4: Email Templates

1. Create email templates:
   - Verification code email
   - Slot offered notification (with confirm link)
   - Claim confirmation receipt
   - Reminder before offer expires
2. Test with Fastmail SMTP

### Phase 5: Staged Rollout

1. **Alpha (1 week)**: Enable for 1-2 test events with cooperative hosts
2. **Beta (2 weeks)**: Enable for all new events, existing events opt-in
3. **GA**: Enable for all events, host can disable via event settings

### Rollback Plan

- Feature flag can instantly disable guest verification
- Existing member flows completely unaffected
- Guest claims created during test period remain valid (just can't create new ones)

---

## 8. Event Settings Addition

New event configuration options:

```typescript
// events table additions
{
  allow_guest_verification: boolean; // Default: true (when feature is GA)
  max_guest_claims_percent: number;  // Default: 50 (% of total slots)
}
```

Host can:
- Disable guest self-signup entirely (host-only guest adds)
- Limit percentage of slots available to unverified guests
- See which slots are guest vs member claims

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Guest claim completion rate | >70% (code sent → verified) |
| Offer confirmation rate (guest) | >80% (within 24h window) |
| Guest-to-member conversion | >10% (within 30 days) |
| Abuse rate | <1% of attempts flagged |
| Host satisfaction | Qualitative feedback |

---

## 10. Open Questions

1. **Should guest claims require host approval?**
   - Pro: More control for hosts
   - Con: Adds friction, delays confirmation
   - Recommendation: No - treat same as member claims

2. **Should guests see other guests' names?**
   - Currently: Yes (public on slot list)
   - Alternative: Only show to authenticated users
   - Recommendation: Keep public (transparency)

3. **Should we integrate disposable email detection?**
   - Pro: Reduces spam/abuse
   - Con: Adds dependency, false positives
   - Recommendation: Phase 2 enhancement if abuse detected

4. **What about phone verification?**
   - More universal than email
   - Higher cost (SMS fees)
   - Recommendation: Email first, phone as future option

---

## Approval Checklist

- [ ] Product owner approves guest action scope
- [ ] Security review of threat model
- [ ] Privacy review of email handling
- [ ] Host feedback on workflow changes
- [ ] Engineering capacity confirmed for implementation

---

**Next Steps (after approval):**
1. Create database migration
2. Implement API endpoints with tests
3. Build UI components
4. Create email templates
5. Staged rollout per plan

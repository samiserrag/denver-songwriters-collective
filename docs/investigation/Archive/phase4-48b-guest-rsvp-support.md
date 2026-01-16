# Phase 4.48b Investigation: Guest RSVP Support + RSVP Attendee List Parity

**Date:** January 2026
**Status:** STOP-GATE — Awaiting Sami Approval
**Author:** Claude (Repo Agent)

---

## Executive Summary

This investigation documents the schema, RLS, and API changes required to enable guest RSVPs (name + email without login) and ensure parity with the timeslot system's guest support.

**Current State:**
- `event_rsvps.user_id` is **required** (NOT NULL)
- No `guest_name` or `guest_email` columns exist
- RSVP API returns 401 for unauthenticated users
- AttendeeList only shows RSVPs with profile joins (no guest support)

**Proposed Solution:**
- Mirror `timeslot_claims` guest pattern (guest_name, guest_email, guest_verified, guest_verification_id)
- Make `user_id` nullable with CHECK constraint: member OR guest
- Reuse existing `guest_verifications` table for verification codes
- Update RLS policies for guest INSERT/UPDATE
- Update AttendeeList to render guests as plain text (no link)

---

## A) Current `event_rsvps` Schema

### Source: `supabase/migrations/20251209100001_dsc_events_rsvp_system.sql`

```sql
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- ❌ NOT NULL
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
  waitlist_position integer,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);
```

**Additional column from `20251216000002_add_offer_expires_at.sql`:**
```sql
ALTER TABLE event_rsvps
ADD COLUMN offer_expires_at TIMESTAMPTZ NULL;
```

### Current Status Values
- `confirmed` — Active RSVP
- `waitlist` — Waiting for spot
- `cancelled` — User cancelled
- `offered` — Promoted from waitlist (implied by `offer_expires_at` column)

### Current Indexes
```sql
CREATE INDEX idx_event_rsvps_event ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON event_rsvps(user_id);
CREATE INDEX idx_event_rsvps_status ON event_rsvps(event_id, status);
CREATE INDEX idx_event_rsvps_offer_expires ON event_rsvps(offer_expires_at) WHERE offer_expires_at IS NOT NULL;
```

---

## B) Current `event_rsvps` RLS Policies

### Source: `20251209100001_dsc_events_rsvp_system.sql` + `20251210000001_fix_rls_auth_users.sql`

| Policy Name | Operation | Condition |
|-------------|-----------|-----------|
| "Anyone can view non-cancelled RSVPs" | SELECT | `status IN ('confirmed', 'waitlist')` |
| "Users can create own RSVPs" | INSERT | `auth.uid() = user_id` |
| "Users can update own RSVPs" | UPDATE | `auth.uid() = user_id` |
| "Users can delete own RSVPs" | DELETE | `auth.uid() = user_id` |
| "Admins can manage all RSVPs" | ALL | `public.is_admin()` |

**Critical Issue:** All user policies require `auth.uid() = user_id`, which blocks guest inserts.

---

## C) Existing Guest Pattern: `timeslot_claims`

### Source: `20251216100001_timeslot_system.sql` + `20251216200001_guest_verification_schema.sql`

```sql
CREATE TABLE IF NOT EXISTS public.timeslot_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeslot_id uuid NOT NULL REFERENCES public.event_timeslots(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,  -- ✅ Nullable
  guest_name text,
  guest_email text,                    -- Added by guest_verification migration
  guest_verified boolean DEFAULT FALSE, -- Added by guest_verification migration
  guest_verification_id uuid REFERENCES public.guest_verifications(id),
  status text NOT NULL DEFAULT 'confirmed',
  -- ...
  CONSTRAINT member_or_guest CHECK (member_id IS NOT NULL OR guest_name IS NOT NULL)
);
```

**Key Pattern:**
- `member_id` is **nullable** (allows guest claims)
- CHECK constraint enforces "member OR guest"
- `guest_name` is publicly visible
- `guest_email` is private (never displayed, used for verification)
- `guest_verified` tracks verification status
- Links to `guest_verifications` table for verification flow

### Guest Verifications Table

```sql
CREATE TABLE IF NOT EXISTS public.guest_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  timeslot_id uuid REFERENCES public.event_timeslots(id),
  claim_id uuid REFERENCES public.timeslot_claims(id),
  guest_name text NOT NULL,
  -- Verification code
  code text,
  code_expires_at timestamptz,
  code_attempts integer DEFAULT 0,
  -- Action tokens (for confirm/cancel via email)
  action_token text,
  action_type text CHECK (action_type IN ('confirm', 'cancel')),
  token_expires_at timestamptz,
  token_used boolean DEFAULT FALSE,
  -- State
  verified_at timestamptz,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Feature Flag:** `ENABLE_GUEST_VERIFICATION` (currently OFF by default)

---

## D) Proposed Schema Migration

### File: `supabase/migrations/20260106000001_guest_rsvp_support.sql`

```sql
-- =====================================================
-- Phase 4.48b: Guest RSVP Support
-- Adds guest_name, guest_email, guest_verified, guest_verification_id
-- Makes user_id nullable with CHECK constraint
-- =====================================================

-- STEP 1: Add guest columns to event_rsvps
ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS guest_name text;

ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS guest_email text;

ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS guest_verified boolean DEFAULT FALSE;

ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS guest_verification_id uuid REFERENCES public.guest_verifications(id);

COMMENT ON COLUMN public.event_rsvps.guest_name IS 'Guest display name (publicly visible)';
COMMENT ON COLUMN public.event_rsvps.guest_email IS 'Guest email (private, for verification/notifications)';
COMMENT ON COLUMN public.event_rsvps.guest_verified IS 'Whether guest email was verified';
COMMENT ON COLUMN public.event_rsvps.guest_verification_id IS 'Link to guest_verifications record';

-- STEP 2: Make user_id nullable
ALTER TABLE public.event_rsvps
ALTER COLUMN user_id DROP NOT NULL;

-- STEP 3: Add CHECK constraint - must be member OR guest
ALTER TABLE public.event_rsvps
ADD CONSTRAINT member_or_guest_rsvp
CHECK (user_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_email IS NOT NULL));

-- STEP 4: Add indexes for guest fields
CREATE INDEX IF NOT EXISTS idx_event_rsvps_guest_email
  ON public.event_rsvps(guest_email)
  WHERE guest_email IS NOT NULL;

-- STEP 5: Add unique constraint for guest email per event
-- Prevents duplicate guest RSVPs with same email
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_rsvps_guest_email_event
  ON public.event_rsvps(event_id, lower(guest_email))
  WHERE guest_email IS NOT NULL AND status != 'cancelled';

-- STEP 6: Update guest_verifications to support RSVP claims
-- Add rsvp_id column (similar to claim_id for timeslots)
ALTER TABLE public.guest_verifications
ADD COLUMN IF NOT EXISTS rsvp_id uuid REFERENCES public.event_rsvps(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.guest_verifications.rsvp_id IS 'Link to event_rsvps record (for RSVP verification)';

-- STEP 7: Update existing unique constraint to allow per-event uniqueness
-- The existing UNIQUE(event_id, user_id) only covers members
-- No change needed - partial unique index above handles guest deduplication
```

---

## E) Proposed RLS Policy Changes

### File: `supabase/migrations/20260106000002_guest_rsvp_rls.sql`

```sql
-- =====================================================
-- Phase 4.48b: RLS Policies for Guest RSVP Support
-- =====================================================

-- STEP 1: Drop existing insert policy (requires auth.uid() = user_id)
DROP POLICY IF EXISTS "Users can create own RSVPs" ON public.event_rsvps;

-- STEP 2: New insert policy - members can insert own, guests via service role
CREATE POLICY "Users can create own RSVPs"
  ON public.event_rsvps FOR INSERT
  WITH CHECK (
    -- Authenticated user inserting their own RSVP
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- Note: Guest inserts (user_id IS NULL) happen via service role in API
-- This is the same pattern as timeslot_claims guest flow

-- STEP 3: Update policy to allow viewing offered status
DROP POLICY IF EXISTS "Anyone can view non-cancelled RSVPs" ON public.event_rsvps;

CREATE POLICY "Anyone can view non-cancelled RSVPs"
  ON public.event_rsvps FOR SELECT
  USING (status IN ('confirmed', 'waitlist', 'offered'));

-- STEP 4: Guest update/cancel happens via service role with verification
-- No RLS policy change needed - service role bypasses RLS
-- API layer validates guest_verification_id + token

-- STEP 5: Grant service role permissions (for guest operations)
-- Service role already has full access via SECURITY DEFINER or bypass
```

---

## F) API Changes Required

### 1. `/api/events/[id]/rsvp/route.ts` — POST

**Current:** Requires `session.user.id`, returns 401 if not logged in.

**Proposed:**
```typescript
// If session exists: use user_id
// If no session: require { guest_name, guest_email }
if (!session) {
  const { guest_name, guest_email } = body;
  if (!guest_name?.trim() || !guest_email?.trim()) {
    return NextResponse.json({ error: "Guest name and email required" }, { status: 400 });
  }
  // Validate email format
  // Check for duplicate guest_email for this event
  // Insert via service role client
  // Trigger guest verification flow
}
```

### 2. New: `/api/guest/rsvp/request-code/route.ts`

**Purpose:** Request verification code for guest RSVP (same pattern as timeslot)

### 3. New: `/api/guest/rsvp/verify-code/route.ts`

**Purpose:** Verify code and confirm guest RSVP

### 4. New: `/api/guest/rsvp/action/route.ts`

**Purpose:** Handle confirm/cancel via signed token (same as timeslot guest action)

---

## G) UI Changes Required

### 1. RSVPButton — Guest Form

**When not logged in:**
- Show inline form: Name + Email fields
- Submit triggers verification code flow
- Success: show pending state, check email message

### 2. AttendeeList — Render Guests

**Current query (line 44-58):**
```typescript
.select(`
  id,
  status,
  user:profiles!event_rsvps_user_id_fkey (
    id, slug, full_name, avatar_url
  )
`)
```

**Proposed query:**
```typescript
.select(`
  id,
  status,
  guest_name,
  user:profiles!event_rsvps_user_id_fkey (
    id, slug, full_name, avatar_url
  )
`)
```

**Render logic:**
```typescript
// If user profile exists: render linked name
// Else if guest_name exists: render plain text name
// Else: "Anonymous"
```

### 3. RSVPButton — Success Banner Theme Fix

Replace hardcoded `emerald-*` classes with theme tokens:
```tsx
// Before
className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"

// After
className="bg-[var(--pill-bg-success)] text-[var(--pill-fg-success)] border-[var(--pill-border-success)]"
```

---

## H) Test Plan

### Unit Tests

| Test | File | Description |
|------|------|-------------|
| Guest RSVP create | `__tests__/phase4-48b-guest-rsvp.test.ts` | POST with guest_name + email creates RSVP |
| Member RSVP create | (existing) | POST with session creates RSVP with user_id |
| Duplicate prevention - guest | `__tests__/phase4-48b-guest-rsvp.test.ts` | Same email same event returns error |
| Duplicate prevention - member | (existing) | Same user_id same event returns error |
| Guest cancel with valid token | `__tests__/phase4-48b-guest-rsvp.test.ts` | DELETE with valid token cancels |
| Guest cancel with invalid token | `__tests__/phase4-48b-guest-rsvp.test.ts` | DELETE with invalid token returns 403 |
| AttendeeList renders guest name | `__tests__/phase4-48b-attendee-list.test.tsx` | Guest name shown as plain text |
| AttendeeList renders member link | `__tests__/phase4-48b-attendee-list.test.tsx` | Member name links to profile |
| AttendeeList empty state | `__tests__/phase4-48b-attendee-list.test.tsx` | Shows "No RSVPs yet" when empty |
| Success banner theme tokens | `__tests__/phase4-48b-theme.test.tsx` | No hardcoded emerald-* classes |

### Integration Tests (Manual Smoke)

1. **Guest RSVP Flow:**
   - Visit event page (not logged in)
   - Click RSVP, fill name + email
   - Receive verification code email
   - Enter code, see success state
   - Refresh page, see name in attendee list

2. **Guest Cancellation:**
   - Complete guest RSVP
   - Click manage link in email
   - Cancel RSVP
   - Refresh page, name removed from list

3. **Theme Contrast:**
   - RSVP as member in Sunrise theme
   - Verify success banner text readable (not green-on-green)

---

## I) Documentation Updates

### CONTRACTS.md

Add section:
```markdown
## RSVP System

### Guest RSVP Contract
- Guests must provide: `guest_name` + `guest_email`
- `guest_email` is private (never displayed publicly)
- `guest_name` is displayed in attendee list
- Guest must verify email to confirm RSVP (verification code flow)
- Guest can cancel via signed token in email

### Attendee List Contract
- Always visible (show empty state if no RSVPs)
- Displays confirmed RSVPs only (not waitlist, cancelled)
- Member names link to `/songwriters/{slug}`
- Guest names render as plain text (no link)
- Order: created_at ascending
```

### SMOKE-PROD.md

Add checks:
```markdown
## RSVP System

- [ ] Guest can RSVP without login (name + email form appears)
- [ ] Guest receives verification code email
- [ ] Guest appears in attendee list after verification
- [ ] Guest can cancel via email link
- [ ] Member RSVP works (one-click)
- [ ] Member appears in attendee list with profile link
- [ ] Success banner readable in Sunrise theme
- [ ] Success banner readable in Night theme
```

---

## J) Risk Assessment

| Risk | Mitigation |
|------|------------|
| Guest email abuse/spam | Rate limiting: 3 codes/email/hour, 5 attempts before lockout |
| Duplicate guest RSVPs | Unique index on (event_id, lower(guest_email)) |
| Guest impersonation | Verification code required before RSVP confirmed |
| Data migration issues | Additive schema changes only, no data transformation |
| Breaking existing RSVPs | user_id nullable change is safe - existing rows have user_id |

---

## K) STOP-GATE Checklist

### Before Approval

| Item | Status |
|------|--------|
| Current schema documented | ✅ |
| Current RLS policies documented | ✅ |
| Guest pattern from timeslot_claims documented | ✅ |
| Migration SQL prepared | ✅ |
| RLS policy changes prepared | ✅ |
| API changes outlined | ✅ |
| UI changes outlined | ✅ |
| Test plan prepared | ✅ |
| Documentation updates planned | ✅ |

### After Approval

- [ ] Create migration files
- [ ] Run `npx supabase db push`
- [ ] Implement API changes
- [ ] Implement UI changes
- [ ] Write tests
- [ ] Update documentation
- [ ] Verify in production

---

**STOP-GATE: Awaiting Sami approval to proceed with schema migration and implementation.**

Questions for Sami:
1. Approve schema migration to add guest support to event_rsvps?
2. Reuse existing `guest_verifications` table (add `rsvp_id` column)?
3. Enable guest verification feature flag (`ENABLE_GUEST_VERIFICATION=true`)?

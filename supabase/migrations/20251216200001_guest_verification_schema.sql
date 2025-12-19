-- =====================================================
-- PROGRESSIVE IDENTITY - PHASE 1: Database Schema
-- Adds guest verification infrastructure for email-only identity
--
-- Tables created:
--   - guest_verifications: Stores verification codes and action tokens
--
-- Columns added to timeslot_claims:
--   - guest_email, guest_verified, guest_verification_id
--
-- This migration is additive and non-breaking.
-- Feature flag ENABLE_GUEST_VERIFICATION remains OFF.
-- =====================================================

-- =====================================================
-- STEP 1: Create guest_verifications table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.guest_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  timeslot_id uuid REFERENCES public.event_timeslots(id) ON DELETE SET NULL,
  claim_id uuid REFERENCES public.timeslot_claims(id) ON DELETE SET NULL,
  guest_name text NOT NULL,

  -- Verification code (for initial claim)
  code text, -- 6-char alphanumeric, hashed
  code_expires_at timestamptz,
  code_attempts integer DEFAULT 0,

  -- Action token (for confirm/cancel via email)
  action_token text, -- JWT or signed token
  action_type text,
  token_expires_at timestamptz,
  token_used boolean DEFAULT FALSE,

  -- State
  verified_at timestamptz,
  locked_until timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_action_type CHECK (action_type IS NULL OR action_type IN ('confirm', 'cancel'))
);

COMMENT ON TABLE public.guest_verifications IS 'Stores verification codes and action tokens for guest email-only identity';
COMMENT ON COLUMN public.guest_verifications.email IS 'Guest email address (never displayed publicly)';
COMMENT ON COLUMN public.guest_verifications.guest_name IS 'Guest display name (publicly visible on slot)';
COMMENT ON COLUMN public.guest_verifications.code IS 'Hashed 6-character verification code';
COMMENT ON COLUMN public.guest_verifications.code_expires_at IS 'When verification code expires (15 minutes)';
COMMENT ON COLUMN public.guest_verifications.code_attempts IS 'Number of failed verification attempts';
COMMENT ON COLUMN public.guest_verifications.action_token IS 'JWT for confirm/cancel actions via magic link';
COMMENT ON COLUMN public.guest_verifications.action_type IS 'Type of action: confirm or cancel';
COMMENT ON COLUMN public.guest_verifications.token_expires_at IS 'When action token expires (24 hours)';
COMMENT ON COLUMN public.guest_verifications.token_used IS 'Whether token has been used (single-use)';
COMMENT ON COLUMN public.guest_verifications.verified_at IS 'When email was verified';
COMMENT ON COLUMN public.guest_verifications.locked_until IS 'Lockout until this time if too many failed attempts';

-- =====================================================
-- STEP 2: Create indexes for guest_verifications
-- =====================================================

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_guest_verifications_email
  ON public.guest_verifications(email);

-- Index for code lookup (partial - only where code exists)
CREATE INDEX IF NOT EXISTS idx_guest_verifications_code
  ON public.guest_verifications(code)
  WHERE code IS NOT NULL;

-- Index for action token lookup (partial - only where token exists)
CREATE INDEX IF NOT EXISTS idx_guest_verifications_token
  ON public.guest_verifications(action_token)
  WHERE action_token IS NOT NULL;

-- Index for event-based queries
CREATE INDEX IF NOT EXISTS idx_guest_verifications_event
  ON public.guest_verifications(event_id);

-- Unique index: one active verification per email per event
-- (not verified yet and not locked out)
CREATE UNIQUE INDEX IF NOT EXISTS idx_guest_verifications_unique_active
  ON public.guest_verifications(email, event_id)
  WHERE verified_at IS NULL AND locked_until IS NULL;

-- =====================================================
-- STEP 3: Add columns to timeslot_claims
-- =====================================================

-- Guest email for verified guest claims
ALTER TABLE public.timeslot_claims
  ADD COLUMN IF NOT EXISTS guest_email text;

-- Whether guest email has been verified
ALTER TABLE public.timeslot_claims
  ADD COLUMN IF NOT EXISTS guest_verified boolean DEFAULT FALSE;

-- Link to guest_verifications table
ALTER TABLE public.timeslot_claims
  ADD COLUMN IF NOT EXISTS guest_verification_id uuid REFERENCES public.guest_verifications(id);

COMMENT ON COLUMN public.timeslot_claims.guest_email IS 'Guest email address (never displayed publicly, nullable for host-added guests)';
COMMENT ON COLUMN public.timeslot_claims.guest_verified IS 'Whether guest email has been verified';
COMMENT ON COLUMN public.timeslot_claims.guest_verification_id IS 'Link to guest_verifications record';

-- =====================================================
-- STEP 4: Add index for guest email lookups on claims
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_timeslot_claims_guest_email
  ON public.timeslot_claims(guest_email)
  WHERE guest_email IS NOT NULL;

-- =====================================================
-- STEP 5: Enable RLS on guest_verifications
-- =====================================================

ALTER TABLE public.guest_verifications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 6: RLS Policies for guest_verifications
-- Service role only for INSERT/UPDATE/DELETE
-- Admin can SELECT for debugging/support
-- =====================================================

-- Admin can view all verifications (for support)
CREATE POLICY "Admins can view all verifications"
  ON public.guest_verifications FOR SELECT
  USING (is_admin());

-- No INSERT/UPDATE/DELETE policies for anon or authenticated
-- All operations go through service role in API layer

-- =====================================================
-- STEP 7: Grant permissions
-- =====================================================

-- Anonymous users cannot access guest_verifications directly
-- (service role handles all operations)
REVOKE ALL ON public.guest_verifications FROM anon;

-- Authenticated users also cannot access directly
-- (service role handles all operations)
REVOKE ALL ON public.guest_verifications FROM authenticated;

-- Grant SELECT to authenticated for admin policy to work
GRANT SELECT ON public.guest_verifications TO authenticated;

-- =====================================================
-- STEP 8: Create trigger for updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_guest_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guest_verifications_updated_at ON public.guest_verifications;
CREATE TRIGGER guest_verifications_updated_at
  BEFORE UPDATE ON public.guest_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_guest_verifications_updated_at();

-- =====================================================
-- MIGRATION COMPLETE
-- Feature flag ENABLE_GUEST_VERIFICATION stays OFF
-- =====================================================

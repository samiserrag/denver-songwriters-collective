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
-- First drop if exists (idempotent)
ALTER TABLE public.event_rsvps
DROP CONSTRAINT IF EXISTS member_or_guest_rsvp;

ALTER TABLE public.event_rsvps
ADD CONSTRAINT member_or_guest_rsvp
CHECK (user_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_email IS NOT NULL));

-- STEP 4: Add indexes for guest fields
CREATE INDEX IF NOT EXISTS idx_event_rsvps_guest_email
  ON public.event_rsvps(guest_email)
  WHERE guest_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_guest_verification
  ON public.event_rsvps(guest_verification_id)
  WHERE guest_verification_id IS NOT NULL;

-- STEP 5: Add unique constraint for guest email per event
-- Prevents duplicate guest RSVPs with same email
-- Using partial unique index for active (non-cancelled) RSVPs only
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_rsvps_guest_email_event
  ON public.event_rsvps(event_id, lower(guest_email))
  WHERE guest_email IS NOT NULL AND status != 'cancelled';

-- STEP 6: Update guest_verifications to support RSVP claims
-- Add rsvp_id column (similar to claim_id for timeslots)
ALTER TABLE public.guest_verifications
ADD COLUMN IF NOT EXISTS rsvp_id uuid REFERENCES public.event_rsvps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guest_verifications_rsvp
  ON public.guest_verifications(rsvp_id)
  WHERE rsvp_id IS NOT NULL;

COMMENT ON COLUMN public.guest_verifications.rsvp_id IS 'Link to event_rsvps record (for RSVP verification)';

-- STEP 7: Existing UNIQUE(event_id, user_id) only covers members
-- No change needed - partial unique index above handles guest deduplication

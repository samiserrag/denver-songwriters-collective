-- =====================================================
-- FIX: Expand valid_action_type constraint
--
-- Problem: Guest comment flow sets action_type = 'comment' but
-- the original constraint only allowed ('confirm', 'cancel').
-- This caused 500 errors in production.
--
-- Solution: Add 'comment' and 'cancel_rsvp' to allowed values.
-- =====================================================

-- Drop the existing constraint
ALTER TABLE public.guest_verifications
  DROP CONSTRAINT IF EXISTS valid_action_type;

-- Add expanded constraint with all action types
ALTER TABLE public.guest_verifications
  ADD CONSTRAINT valid_action_type
  CHECK (action_type IS NULL OR action_type IN ('confirm', 'cancel', 'comment', 'cancel_rsvp'));

-- Update comment to reflect all action types
COMMENT ON COLUMN public.guest_verifications.action_type IS 'Type of action: confirm, cancel, comment, or cancel_rsvp';

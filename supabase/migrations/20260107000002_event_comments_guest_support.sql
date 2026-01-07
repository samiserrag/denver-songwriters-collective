-- =====================================================
-- Phase 4.49b: Event Comments Guest Support
-- Adds guest columns, makes user_id nullable, adds is_deleted
-- =====================================================

-- STEP 1: Add guest columns to event_comments
ALTER TABLE public.event_comments
ADD COLUMN IF NOT EXISTS guest_name text;

ALTER TABLE public.event_comments
ADD COLUMN IF NOT EXISTS guest_email text;

ALTER TABLE public.event_comments
ADD COLUMN IF NOT EXISTS guest_verified boolean DEFAULT FALSE;

ALTER TABLE public.event_comments
ADD COLUMN IF NOT EXISTS guest_verification_id uuid REFERENCES public.guest_verifications(id);

ALTER TABLE public.event_comments
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT FALSE;

COMMENT ON COLUMN public.event_comments.guest_name IS 'Guest display name (publicly visible)';
COMMENT ON COLUMN public.event_comments.guest_email IS 'Guest email (private, for verification)';
COMMENT ON COLUMN public.event_comments.guest_verified IS 'Whether guest email was verified';
COMMENT ON COLUMN public.event_comments.guest_verification_id IS 'Link to guest_verifications record';
COMMENT ON COLUMN public.event_comments.is_deleted IS 'Soft delete flag for moderation';

-- STEP 2: Make user_id nullable
ALTER TABLE public.event_comments
ALTER COLUMN user_id DROP NOT NULL;

-- STEP 3: Add CHECK constraint - must be member OR guest
ALTER TABLE public.event_comments
DROP CONSTRAINT IF EXISTS member_or_guest_comment;

ALTER TABLE public.event_comments
ADD CONSTRAINT member_or_guest_comment
CHECK (user_id IS NOT NULL OR (guest_name IS NOT NULL AND guest_email IS NOT NULL));

-- STEP 4: Add indexes for guest fields
CREATE INDEX IF NOT EXISTS idx_event_comments_guest_email
  ON public.event_comments(guest_email)
  WHERE guest_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_comments_guest_verification
  ON public.event_comments(guest_verification_id)
  WHERE guest_verification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_comments_visible
  ON public.event_comments(event_id)
  WHERE is_deleted = FALSE AND is_hidden = FALSE;

-- STEP 5: Add comment_id to guest_verifications for polymorphic target
ALTER TABLE public.guest_verifications
ADD COLUMN IF NOT EXISTS comment_id uuid REFERENCES public.event_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guest_verifications_comment
  ON public.guest_verifications(comment_id)
  WHERE comment_id IS NOT NULL;

COMMENT ON COLUMN public.guest_verifications.comment_id IS 'Link to event_comments record (for comment verification)';

-- STEP 6: Update RLS policies for guest comments

-- Drop existing insert policy to recreate with guest support
DROP POLICY IF EXISTS "Users can create comments" ON public.event_comments;

-- Recreate: authenticated users can insert their own comments
CREATE POLICY "Users can create comments"
  ON public.event_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add policy for viewing non-deleted comments (public read)
DROP POLICY IF EXISTS "Anyone can view public comments" ON public.event_comments;
CREATE POLICY "Anyone can view public comments"
  ON public.event_comments FOR SELECT
  USING (is_hidden = false AND is_host_only = false AND is_deleted = false);

-- Users can always view their own comments (even hidden/deleted)
DROP POLICY IF EXISTS "Users can view own comments" ON public.event_comments;
CREATE POLICY "Users can view own comments"
  ON public.event_comments FOR SELECT
  USING (user_id = auth.uid());

-- STEP 7: Grant service role ability to insert guest comments
-- Service role bypasses RLS, so no explicit policy needed
-- Guest comments are inserted via /api/guest/event-comment/verify-code using service role

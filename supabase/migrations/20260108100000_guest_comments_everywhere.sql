-- Guest Comments Everywhere Migration
--
-- Adds guest comment support (email verification flow) to:
-- - gallery_photo_comments
-- - gallery_album_comments
-- - blog_comments
-- - profile_comments
--
-- Pattern matches event_comments: user_id becomes nullable, adds guest_* columns
-- Guest comments require email verification before being stored

--------------------------------------------------------------------------------
-- 1. GALLERY_PHOTO_COMMENTS: Add guest columns
--------------------------------------------------------------------------------

-- Make user_id nullable (guests have user_id = NULL)
ALTER TABLE public.gallery_photo_comments
  ALTER COLUMN user_id DROP NOT NULL;

-- Add guest columns
ALTER TABLE public.gallery_photo_comments
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_verification_id uuid REFERENCES public.guest_verifications(id);

-- Add constraint: must have user_id OR guest info
ALTER TABLE public.gallery_photo_comments
  ADD CONSTRAINT gallery_photo_comments_user_or_guest
  CHECK (
    user_id IS NOT NULL
    OR (guest_name IS NOT NULL AND guest_email IS NOT NULL)
  );

--------------------------------------------------------------------------------
-- 2. GALLERY_ALBUM_COMMENTS: Add guest columns
--------------------------------------------------------------------------------

-- Make user_id nullable
ALTER TABLE public.gallery_album_comments
  ALTER COLUMN user_id DROP NOT NULL;

-- Add guest columns
ALTER TABLE public.gallery_album_comments
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_verification_id uuid REFERENCES public.guest_verifications(id);

-- Add constraint
ALTER TABLE public.gallery_album_comments
  ADD CONSTRAINT gallery_album_comments_user_or_guest
  CHECK (
    user_id IS NOT NULL
    OR (guest_name IS NOT NULL AND guest_email IS NOT NULL)
  );

--------------------------------------------------------------------------------
-- 3. BLOG_COMMENTS: Add guest columns
--------------------------------------------------------------------------------

-- Make author_id nullable (blog uses author_id instead of user_id)
ALTER TABLE public.blog_comments
  ALTER COLUMN author_id DROP NOT NULL;

-- Add guest columns
ALTER TABLE public.blog_comments
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_verification_id uuid REFERENCES public.guest_verifications(id);

-- Add constraint
ALTER TABLE public.blog_comments
  ADD CONSTRAINT blog_comments_user_or_guest
  CHECK (
    author_id IS NOT NULL
    OR (guest_name IS NOT NULL AND guest_email IS NOT NULL)
  );

--------------------------------------------------------------------------------
-- 4. PROFILE_COMMENTS: Add guest columns
--------------------------------------------------------------------------------

-- Make author_id nullable
ALTER TABLE public.profile_comments
  ALTER COLUMN author_id DROP NOT NULL;

-- Add guest columns
ALTER TABLE public.profile_comments
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_verification_id uuid REFERENCES public.guest_verifications(id);

-- Add constraint
ALTER TABLE public.profile_comments
  ADD CONSTRAINT profile_comments_user_or_guest
  CHECK (
    author_id IS NOT NULL
    OR (guest_name IS NOT NULL AND guest_email IS NOT NULL)
  );

--------------------------------------------------------------------------------
-- 5. UPDATE RLS POLICIES FOR GUEST COMMENTS
--------------------------------------------------------------------------------

-- Gallery photo comments: allow inserting guest comments (via service role)
-- The existing insert policy requires user_id = auth.uid(), which blocks guests
-- Guest inserts are done via service role client, so no policy change needed

-- Gallery album comments: same as above

-- Blog comments: allow selecting guest comments
-- Drop and recreate select policy to include guest comments
DROP POLICY IF EXISTS "blog_comments_select_approved" ON public.blog_comments;
CREATE POLICY "blog_comments_select_approved"
  ON public.blog_comments
  FOR SELECT
  USING (is_approved = true);

-- Profile comments: Update select to include guest comments
-- The existing policy filters by is_deleted/is_hidden, which works for guests too

--------------------------------------------------------------------------------
-- 6. EXTEND guest_verifications action_type FOR NEW COMMENT TYPES
--------------------------------------------------------------------------------

-- The existing constraint allows: confirm, cancel, comment, cancel_rsvp
-- We need to add: gallery_photo_comment, gallery_album_comment, blog_comment, profile_comment, timeslot
ALTER TABLE public.guest_verifications
  DROP CONSTRAINT IF EXISTS valid_action_type;

ALTER TABLE public.guest_verifications
  ADD CONSTRAINT valid_action_type
  CHECK (
    action_type IS NULL
    OR action_type IN (
      'confirm', 'cancel', 'comment', 'cancel_rsvp', 'timeslot',
      'gallery_photo_comment', 'gallery_album_comment',
      'blog_comment', 'profile_comment'
    )
  );

--------------------------------------------------------------------------------
-- 7. ADD TARGET COLUMNS TO guest_verifications FOR NEW ENTITY TYPES
--------------------------------------------------------------------------------

-- Add columns for gallery, blog, and profile targets
ALTER TABLE public.guest_verifications
  ADD COLUMN IF NOT EXISTS gallery_image_id uuid REFERENCES public.gallery_images(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS gallery_album_id uuid REFERENCES public.gallery_albums(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS blog_post_id uuid REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

--------------------------------------------------------------------------------
-- 8. INDEXES FOR GUEST COMMENT QUERIES
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_gallery_photo_comments_guest_verification
  ON public.gallery_photo_comments(guest_verification_id)
  WHERE guest_verification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gallery_album_comments_guest_verification
  ON public.gallery_album_comments(guest_verification_id)
  WHERE guest_verification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_blog_comments_guest_verification
  ON public.blog_comments(guest_verification_id)
  WHERE guest_verification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profile_comments_guest_verification
  ON public.profile_comments(guest_verification_id)
  WHERE guest_verification_id IS NOT NULL;

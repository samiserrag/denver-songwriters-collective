-- Threaded Replies + Profile Comments Migration
--
-- This migration adds:
-- 1. parent_id columns to comment tables that don't have them (for threading)
-- 2. is_hidden column to support owner moderation
-- 3. New profile_comments table for comments on member profiles
--
-- Threading model: 1-level nesting (parent_id references same table)
-- Moderation model:
--   - Author can delete own comment
--   - Entity owner can hide/unhide comments on their entity
--   - Admin can override hide/unhide/delete anywhere

--------------------------------------------------------------------------------
-- 1. ADD PARENT_ID TO BLOG_COMMENTS
--------------------------------------------------------------------------------

ALTER TABLE public.blog_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.blog_comments(id) ON DELETE CASCADE;

-- Index for efficient thread fetching
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent_created
  ON public.blog_comments(parent_id, created_at);

--------------------------------------------------------------------------------
-- 2. ADD PARENT_ID + IS_HIDDEN TO GALLERY_ALBUM_COMMENTS
--------------------------------------------------------------------------------

ALTER TABLE public.gallery_album_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.gallery_album_comments(id) ON DELETE CASCADE;

ALTER TABLE public.gallery_album_comments
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.gallery_album_comments
  ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES public.profiles(id);

-- Index for efficient thread fetching
CREATE INDEX IF NOT EXISTS idx_gallery_album_comments_parent_created
  ON public.gallery_album_comments(parent_id, created_at);

--------------------------------------------------------------------------------
-- 3. ADD PARENT_ID + IS_HIDDEN TO GALLERY_PHOTO_COMMENTS
--------------------------------------------------------------------------------

ALTER TABLE public.gallery_photo_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.gallery_photo_comments(id) ON DELETE CASCADE;

ALTER TABLE public.gallery_photo_comments
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.gallery_photo_comments
  ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES public.profiles(id);

-- Index for efficient thread fetching
CREATE INDEX IF NOT EXISTS idx_gallery_photo_comments_parent_created
  ON public.gallery_photo_comments(parent_id, created_at);

--------------------------------------------------------------------------------
-- 4. ADD PARENT_ID + IS_HIDDEN TO OPEN_MIC_COMMENTS
--------------------------------------------------------------------------------

ALTER TABLE public.open_mic_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.open_mic_comments(id) ON DELETE CASCADE;

ALTER TABLE public.open_mic_comments
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE public.open_mic_comments
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.open_mic_comments
  ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES public.profiles(id);

-- Index for efficient thread fetching
CREATE INDEX IF NOT EXISTS idx_open_mic_comments_parent_created
  ON public.open_mic_comments(parent_id, created_at);

--------------------------------------------------------------------------------
-- 5. CREATE PROFILE_COMMENTS TABLE
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profile_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.profile_comments(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 1000),
  is_deleted boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  hidden_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for profile comments
CREATE INDEX IF NOT EXISTS idx_profile_comments_profile_created
  ON public.profile_comments(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_comments_author_created
  ON public.profile_comments(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_comments_parent_created
  ON public.profile_comments(parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_profile_comments_not_deleted_hidden
  ON public.profile_comments(profile_id) WHERE is_deleted = false AND is_hidden = false;

-- Enable RLS
ALTER TABLE public.profile_comments ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 6. PROFILE_COMMENTS RLS POLICIES
--------------------------------------------------------------------------------

-- SELECT: Public can see non-deleted, non-hidden comments on public profiles
CREATE POLICY "profile_comments_select_public"
  ON public.profile_comments
  FOR SELECT
  USING (
    is_deleted = false
    AND is_hidden = false
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_comments.profile_id
        AND p.is_public = true
    )
  );

-- SELECT: Managers can see all comments they manage (for moderation)
-- Manager = author, profile owner, or admin
CREATE POLICY "profile_comments_select_manager"
  ON public.profile_comments
  FOR SELECT
  TO authenticated
  USING (
    author_id = auth.uid()
    OR profile_id = auth.uid()
    OR public.is_admin()
  );

-- INSERT: Authenticated users can comment on public profiles
CREATE POLICY "profile_comments_insert"
  ON public.profile_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND is_deleted = false
    AND is_hidden = false
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = profile_comments.profile_id
        AND p.is_public = true
    )
  );

-- UPDATE: Profile owner can hide/unhide, author can edit content
-- Admin can do anything
CREATE POLICY "profile_comments_update"
  ON public.profile_comments
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR profile_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    -- Soft delete by author only sets is_deleted
    (author_id = auth.uid() AND is_deleted = true)
    -- Profile owner can hide/unhide
    OR (profile_id = auth.uid())
    -- Admin can do anything
    OR public.is_admin()
  );

-- No hard DELETE - use soft delete via UPDATE

--------------------------------------------------------------------------------
-- 7. UPDATE GALLERY COMMENTS POLICIES FOR HIDE/UNHIDE
--------------------------------------------------------------------------------

-- Drop existing update policies and recreate with hide support
DROP POLICY IF EXISTS "gallery_album_comments_update_soft_delete" ON public.gallery_album_comments;
DROP POLICY IF EXISTS "gallery_album_comments_select_own" ON public.gallery_album_comments;

-- SELECT: Managers can see hidden comments for moderation
CREATE POLICY "gallery_album_comments_select_manager"
  ON public.gallery_album_comments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.gallery_albums a
      WHERE a.id = gallery_album_comments.album_id
        AND a.created_by = auth.uid()
    )
  );

-- UPDATE: Owner can hide/unhide, author can delete
CREATE POLICY "gallery_album_comments_update_moderation"
  ON public.gallery_album_comments
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.gallery_albums a
      WHERE a.id = gallery_album_comments.album_id
        AND a.created_by = auth.uid()
    )
  )
  WITH CHECK (
    -- Author can soft-delete
    (user_id = auth.uid() AND is_deleted = true)
    -- Owner can hide/unhide
    OR EXISTS (
      SELECT 1 FROM public.gallery_albums a
      WHERE a.id = gallery_album_comments.album_id
        AND a.created_by = auth.uid()
    )
    -- Admin can do anything
    OR public.is_admin()
  );

-- Photo comments: similar treatment
DROP POLICY IF EXISTS "gallery_photo_comments_update_soft_delete" ON public.gallery_photo_comments;
DROP POLICY IF EXISTS "gallery_photo_comments_select_own" ON public.gallery_photo_comments;

-- SELECT: Managers can see hidden comments for moderation
CREATE POLICY "gallery_photo_comments_select_manager"
  ON public.gallery_photo_comments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.gallery_images i
      WHERE i.id = gallery_photo_comments.image_id
        AND i.uploaded_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.gallery_images i
      JOIN public.gallery_albums a ON a.id = i.album_id
      WHERE i.id = gallery_photo_comments.image_id
        AND a.created_by = auth.uid()
    )
  );

-- UPDATE: Owner can hide/unhide, author can delete
CREATE POLICY "gallery_photo_comments_update_moderation"
  ON public.gallery_photo_comments
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.gallery_images i
      WHERE i.id = gallery_photo_comments.image_id
        AND i.uploaded_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.gallery_images i
      JOIN public.gallery_albums a ON a.id = i.album_id
      WHERE i.id = gallery_photo_comments.image_id
        AND a.created_by = auth.uid()
    )
  )
  WITH CHECK (
    -- Author can soft-delete
    (user_id = auth.uid() AND is_deleted = true)
    -- Image uploader can hide/unhide
    OR EXISTS (
      SELECT 1 FROM public.gallery_images i
      WHERE i.id = gallery_photo_comments.image_id
        AND i.uploaded_by = auth.uid()
    )
    -- Album owner can hide/unhide
    OR EXISTS (
      SELECT 1
      FROM public.gallery_images i
      JOIN public.gallery_albums a ON a.id = i.album_id
      WHERE i.id = gallery_photo_comments.image_id
        AND a.created_by = auth.uid()
    )
    -- Admin can do anything
    OR public.is_admin()
  );

--------------------------------------------------------------------------------
-- 8. GRANTS
--------------------------------------------------------------------------------

-- Profile comments grants
GRANT SELECT ON public.profile_comments TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profile_comments TO authenticated;

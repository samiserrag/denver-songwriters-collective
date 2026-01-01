-- Fix gallery comments RLS policies
--
-- Issue: Users could not delete their own comments despite having permission.
-- Root cause: The SELECT policy only allowed is_deleted = false, which blocked
-- UPDATE operations from completing when setting is_deleted = true.
--
-- Fix: Add SELECT policies that allow comment managers (author, admin,
-- image/album owner) to see their manageable comments regardless of is_deleted.

--------------------------------------------------------------------------------
-- 1. FIX ALBUM COMMENTS
--------------------------------------------------------------------------------

-- Add SELECT policy for comment managers
DROP POLICY IF EXISTS "gallery_album_comments_select_own" ON public.gallery_album_comments;

CREATE POLICY "gallery_album_comments_select_own"
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

-- Recreate UPDATE policy with fully-qualified function call
DROP POLICY IF EXISTS "gallery_album_comments_update_soft_delete" ON public.gallery_album_comments;

CREATE POLICY "gallery_album_comments_update_soft_delete"
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
    is_deleted = true
  );

--------------------------------------------------------------------------------
-- 2. FIX PHOTO COMMENTS
--------------------------------------------------------------------------------

-- Add SELECT policy for comment managers
DROP POLICY IF EXISTS "gallery_photo_comments_select_own" ON public.gallery_photo_comments;

CREATE POLICY "gallery_photo_comments_select_own"
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

-- Recreate UPDATE policy with fully-qualified function call
DROP POLICY IF EXISTS "gallery_photo_comments_update_soft_delete" ON public.gallery_photo_comments;

CREATE POLICY "gallery_photo_comments_update_soft_delete"
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
    is_deleted = true
  );

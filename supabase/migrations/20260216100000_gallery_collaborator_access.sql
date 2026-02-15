-- ============================================================================
-- Migration: gallery_collaborator_access
-- Purpose: Grant accepted collaborators read access to gallery_albums and
--          tighten gallery_images INSERT to require album ownership or
--          accepted collaboration (closes pre-existing security hole).
-- ============================================================================

-- 1) gallery_albums: Allow accepted collaborators to SELECT the album
--    This lets collaborators load the album detail page in the dashboard.
CREATE POLICY "gallery_albums_collaborator_select"
  ON public.gallery_albums
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gallery_album_links l
      WHERE l.album_id = gallery_albums.id
        AND l.target_type = 'profile'
        AND l.target_id = auth.uid()
        AND l.link_role = 'collaborator'
    )
  );

-- 2) gallery_images: Replace INSERT policy to require album ownership OR
--    accepted collaboration (in addition to uploaded_by = auth.uid()).
--
--    BEFORE: only checked auth.uid() = uploaded_by (any user could insert
--    into any album_id).
--    AFTER: also requires the user is album owner or accepted collaborator.
DROP POLICY IF EXISTS "gallery_images_insert" ON public.gallery_images;

CREATE POLICY "gallery_images_insert"
  ON public.gallery_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND album_id IS NOT NULL
    AND (
      -- Album owner
      EXISTS (
        SELECT 1 FROM public.gallery_albums a
        WHERE a.id = gallery_images.album_id
          AND a.created_by = auth.uid()
      )
      OR
      -- Accepted collaborator
      EXISTS (
        SELECT 1 FROM public.gallery_album_links l
        WHERE l.album_id = gallery_images.album_id
          AND l.target_type = 'profile'
          AND l.target_id = auth.uid()
          AND l.link_role = 'collaborator'
      )
    )
  );

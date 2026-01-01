-- ============================================================================
-- GALLERY ALBUMS: User Owner RLS Policies
-- Allows regular users to create and manage their own albums
-- ============================================================================
-- Existing policies (kept intact):
--   - gallery_albums_public_read: Anyone can SELECT published albums
--   - gallery_albums_admin_all: Admins can do everything
-- New policies:
--   - gallery_albums_owner_select: Users can see their own unpublished albums
--   - gallery_albums_owner_insert: Users can create albums for themselves
--   - gallery_albums_owner_update: Users can update their own albums
--   - gallery_albums_owner_delete: Users can delete their own albums
-- ============================================================================

-- Drop existing user-owner policies if they exist (idempotent)
DROP POLICY IF EXISTS "gallery_albums_owner_select" ON public.gallery_albums;
DROP POLICY IF EXISTS "gallery_albums_owner_insert" ON public.gallery_albums;
DROP POLICY IF EXISTS "gallery_albums_owner_update" ON public.gallery_albums;
DROP POLICY IF EXISTS "gallery_albums_owner_delete" ON public.gallery_albums;

-- Users can view their own albums (including unpublished)
CREATE POLICY "gallery_albums_owner_select"
ON public.gallery_albums
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Users can create albums only for themselves
CREATE POLICY "gallery_albums_owner_insert"
ON public.gallery_albums
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Users can update their own albums
CREATE POLICY "gallery_albums_owner_update"
ON public.gallery_albums
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Users can delete their own albums
CREATE POLICY "gallery_albums_owner_delete"
ON public.gallery_albums
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

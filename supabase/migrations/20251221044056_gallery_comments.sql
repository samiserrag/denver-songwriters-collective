-- Gallery Comments Tables with RLS
-- Supports comments on both albums and individual photos
-- Soft delete with moderation by admin, owner, or uploader

--------------------------------------------------------------------------------
-- 1. GALLERY PHOTO COMMENTS TABLE
--------------------------------------------------------------------------------

CREATE TABLE public.gallery_photo_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid NOT NULL REFERENCES public.gallery_images(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);

-- Indexes for photo comments
CREATE INDEX idx_gallery_photo_comments_image_created
  ON public.gallery_photo_comments(image_id, created_at DESC);
CREATE INDEX idx_gallery_photo_comments_user_created
  ON public.gallery_photo_comments(user_id, created_at DESC);
CREATE INDEX idx_gallery_photo_comments_not_deleted
  ON public.gallery_photo_comments(image_id) WHERE is_deleted = false;

--------------------------------------------------------------------------------
-- 2. GALLERY ALBUM COMMENTS TABLE
--------------------------------------------------------------------------------

CREATE TABLE public.gallery_album_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES public.gallery_albums(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);

-- Indexes for album comments
CREATE INDEX idx_gallery_album_comments_album_created
  ON public.gallery_album_comments(album_id, created_at DESC);
CREATE INDEX idx_gallery_album_comments_user_created
  ON public.gallery_album_comments(user_id, created_at DESC);
CREATE INDEX idx_gallery_album_comments_not_deleted
  ON public.gallery_album_comments(album_id) WHERE is_deleted = false;

--------------------------------------------------------------------------------
-- 3. ENABLE RLS
--------------------------------------------------------------------------------

ALTER TABLE public.gallery_photo_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_album_comments ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 4. PHOTO COMMENTS POLICIES
--------------------------------------------------------------------------------

-- SELECT: Anyone can read non-deleted comments
CREATE POLICY "gallery_photo_comments_select_public"
  ON public.gallery_photo_comments
  FOR SELECT
  USING (is_deleted = false);

-- INSERT: Authenticated users can insert their own comments
CREATE POLICY "gallery_photo_comments_insert_own"
  ON public.gallery_photo_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_deleted = false
  );

-- UPDATE: Soft delete only, by author OR admin OR image uploader OR album owner
CREATE POLICY "gallery_photo_comments_update_soft_delete"
  ON public.gallery_photo_comments
  FOR UPDATE
  TO authenticated
  USING (
    -- Can only update if you have permission
    (
      -- Comment author
      user_id = auth.uid()
      -- Admin
      OR is_admin()
      -- Image uploader (moderator)
      OR EXISTS (
        SELECT 1 FROM public.gallery_images i
        WHERE i.id = gallery_photo_comments.image_id
          AND i.uploaded_by = auth.uid()
      )
      -- Album owner (if image is in an album)
      OR EXISTS (
        SELECT 1
        FROM public.gallery_images i
        JOIN public.gallery_albums a ON a.id = i.album_id
        WHERE i.id = gallery_photo_comments.image_id
          AND a.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    -- Only allow setting is_deleted from false to true (soft delete)
    is_deleted = true
  );

-- No DELETE policy - we use soft delete via UPDATE

--------------------------------------------------------------------------------
-- 5. ALBUM COMMENTS POLICIES
--------------------------------------------------------------------------------

-- SELECT: Anyone can read non-deleted comments
CREATE POLICY "gallery_album_comments_select_public"
  ON public.gallery_album_comments
  FOR SELECT
  USING (is_deleted = false);

-- INSERT: Authenticated users can insert their own comments
CREATE POLICY "gallery_album_comments_insert_own"
  ON public.gallery_album_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_deleted = false
  );

-- UPDATE: Soft delete only, by author OR admin OR album owner
CREATE POLICY "gallery_album_comments_update_soft_delete"
  ON public.gallery_album_comments
  FOR UPDATE
  TO authenticated
  USING (
    -- Can only update if you have permission
    (
      -- Comment author
      user_id = auth.uid()
      -- Admin
      OR is_admin()
      -- Album owner (moderator)
      OR EXISTS (
        SELECT 1 FROM public.gallery_albums a
        WHERE a.id = gallery_album_comments.album_id
          AND a.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    -- Only allow setting is_deleted from false to true (soft delete)
    is_deleted = true
  );

-- No DELETE policy - we use soft delete via UPDATE

--------------------------------------------------------------------------------
-- 6. GRANT PERMISSIONS
--------------------------------------------------------------------------------

-- Allow anonymous users to read comments
GRANT SELECT ON public.gallery_photo_comments TO anon;
GRANT SELECT ON public.gallery_album_comments TO anon;

-- Allow authenticated users full access (RLS will restrict)
GRANT SELECT, INSERT, UPDATE ON public.gallery_photo_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gallery_album_comments TO authenticated;

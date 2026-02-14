-- ============================================================================
-- Migration: gallery_require_album
-- Purpose: Enforce that every gallery image must belong to an album.
--          1. SET NOT NULL on gallery_images.album_id (safe: 0 NULL rows exist)
--          2. Change FK from ON DELETE SET NULL to ON DELETE RESTRICT
--             (cannot delete an album that still has photos)
-- ============================================================================

-- 1) Make album_id NOT NULL (all existing rows already have a value)
ALTER TABLE public.gallery_images
  ALTER COLUMN album_id SET NOT NULL;

-- 2) Replace the FK constraint: SET NULL → RESTRICT
--    Drop the old FK and recreate with RESTRICT behavior.
ALTER TABLE public.gallery_images
  DROP CONSTRAINT IF EXISTS gallery_images_album_id_fkey;

ALTER TABLE public.gallery_images
  ADD CONSTRAINT gallery_images_album_id_fkey
    FOREIGN KEY (album_id)
    REFERENCES public.gallery_albums(id)
    ON DELETE RESTRICT;

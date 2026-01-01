-- Migration: Gallery Hide/Publish Moderation Model
-- Purpose: Remove approval gate, add hide/unhide + draft/publish controls
--
-- Changes:
-- 1. Add is_hidden to gallery_images and gallery_albums
-- 2. Add is_published to gallery_images (albums already have it)
-- 3. Backfill existing data to be published and not hidden
-- 4. Publish albums that have images (prevents empty /gallery)

-- Step 1: Add is_hidden column to gallery_images
ALTER TABLE public.gallery_images
ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Step 2: Add is_hidden column to gallery_albums
ALTER TABLE public.gallery_albums
ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Step 3: Add is_published column to gallery_images (defaults to true for good-actor model)
ALTER TABLE public.gallery_images
ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

-- Step 4: Backfill - set all existing images to published (including previously approved ones)
UPDATE public.gallery_images
SET is_published = true
WHERE is_published IS DISTINCT FROM true;

-- Step 5: Publish albums that have images (prevents empty /gallery trap)
UPDATE public.gallery_albums a
SET is_published = true
WHERE a.is_published = false
AND EXISTS (SELECT 1 FROM public.gallery_images i WHERE i.album_id = a.id);

-- Step 6: Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_gallery_images_hidden ON public.gallery_images(is_hidden) WHERE is_hidden = true;
CREATE INDEX IF NOT EXISTS idx_gallery_images_published ON public.gallery_images(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_gallery_albums_hidden ON public.gallery_albums(is_hidden) WHERE is_hidden = true;

-- Add comments for documentation
COMMENT ON COLUMN public.gallery_images.is_hidden IS 'Admin moderation: hidden images do not appear publicly';
COMMENT ON COLUMN public.gallery_images.is_published IS 'User control: unpublished images are drafts';
COMMENT ON COLUMN public.gallery_albums.is_hidden IS 'Admin moderation: hidden albums do not appear publicly';

-- ============================================================================
-- Migration: gallery_missing_columns_backfill
-- Purpose: Add columns to gallery_albums and gallery_images that were applied
--          directly to production but never captured in a migration file.
--          Required for CI (Supabase RLS Tripwire) which runs migrations
--          from scratch.
--
-- Columns added:
--   gallery_albums.is_hidden    BOOLEAN NOT NULL DEFAULT false
--   gallery_images.is_hidden    BOOLEAN NOT NULL DEFAULT false
--   gallery_images.is_published BOOLEAN NOT NULL DEFAULT true
-- ============================================================================

-- 1) gallery_albums.is_hidden
ALTER TABLE public.gallery_albums
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gallery_albums_hidden
  ON public.gallery_albums (is_hidden)
  WHERE is_hidden = true;

-- 2) gallery_images.is_hidden
ALTER TABLE public.gallery_images
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_gallery_images_hidden
  ON public.gallery_images (is_hidden)
  WHERE is_hidden = true;

-- 3) gallery_images.is_published
ALTER TABLE public.gallery_images
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_gallery_images_published
  ON public.gallery_images (is_published)
  WHERE is_published = true;

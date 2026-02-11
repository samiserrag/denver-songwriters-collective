-- MEDIA-EMBED-01 Phase 1 (Option A): structured media URLs on canonical entities
-- Additive-only migration. No RLS changes.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS youtube_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS spotify_url TEXT NULL;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS youtube_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS spotify_url TEXT NULL;

ALTER TABLE public.gallery_albums
  ADD COLUMN IF NOT EXISTS youtube_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS spotify_url TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'youtube_url'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN youtube_url TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'spotify_url'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN spotify_url TEXT NULL;
  END IF;
END $$;

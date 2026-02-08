-- Add admin-configurable asset URLs to site_settings
-- These allow admins to update hero image, email header image, and playlist links
-- without code changes.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS email_header_image_url text,
  ADD COLUMN IF NOT EXISTS youtube_playlist_url text,
  ADD COLUMN IF NOT EXISTS spotify_playlist_url text;

-- Seed defaults into the global row
UPDATE public.site_settings
SET
  hero_image_url = COALESCE(hero_image_url, '/images/hero-bg.jpg'),
  email_header_image_url = COALESCE(email_header_image_url, 'https://oipozdbfxyskoscsgbfq.supabase.co/storage/v1/object/public/email-images/DSC%20Email%20Header1.png')
WHERE id = 'global';

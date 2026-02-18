-- Add dedicated social share image URL to site settings.
-- This allows Open Graph/Twitter image selection to be managed
-- independently from the homepage hero background image.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS social_share_image_url text;

UPDATE public.site_settings
SET social_share_image_url = COALESCE(
  social_share_image_url,
  'https://oipozdbfxyskoscsgbfq.supabase.co/storage/v1/object/public/Site%20Branding/CSC%20MAIN%20Header%20Large%20(1).png'
)
WHERE id = 'global';

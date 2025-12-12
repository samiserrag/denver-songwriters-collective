-- Add TikTok URL field to profiles table
-- This allows users to share their TikTok profile

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tiktok_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.tiktok_url IS 'URL to user TikTok profile';

-- Add 'fan' role to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'fan';

-- Add social media and tipping link columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS twitter_url text,
ADD COLUMN IF NOT EXISTS youtube_url text,
ADD COLUMN IF NOT EXISTS spotify_url text,
ADD COLUMN IF NOT EXISTS website_url text,
ADD COLUMN IF NOT EXISTS venmo_handle text,
ADD COLUMN IF NOT EXISTS cashapp_handle text,
ADD COLUMN IF NOT EXISTS paypal_url text;

-- Add comment for documentation
COMMENT ON COLUMN profiles.onboarding_complete IS 'Whether the user has completed the onboarding wizard';
COMMENT ON COLUMN profiles.instagram_url IS 'Instagram profile URL';
COMMENT ON COLUMN profiles.facebook_url IS 'Facebook profile URL';
COMMENT ON COLUMN profiles.twitter_url IS 'Twitter/X profile URL';
COMMENT ON COLUMN profiles.youtube_url IS 'YouTube channel URL';
COMMENT ON COLUMN profiles.spotify_url IS 'Spotify artist URL';
COMMENT ON COLUMN profiles.website_url IS 'Personal website URL';
COMMENT ON COLUMN profiles.venmo_handle IS 'Venmo handle for tips (without @)';
COMMENT ON COLUMN profiles.cashapp_handle IS 'Cash App handle for tips (without $)';
COMMENT ON COLUMN profiles.paypal_url IS 'PayPal.me URL for tips';

-- Add zip_code column to profiles for location-based member discovery
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip_code TEXT;
COMMENT ON COLUMN profiles.zip_code IS 'Zip/postal code for location-based member discovery';

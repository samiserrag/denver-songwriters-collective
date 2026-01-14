-- Add cover_image_url column to venues table
-- Allows venue managers and admins to upload cover images for venues

ALTER TABLE venues
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN venues.cover_image_url IS 'URL to venue cover/banner image stored in gallery-images bucket';

-- Note: RLS for venues table already allows public SELECT.
-- UPDATE is enforced via API allowlist pattern (MANAGER_EDITABLE_VENUE_FIELDS in managerAuth.ts)
-- The API route uses service role client for updates after authorization check.
-- No additional RLS changes needed.

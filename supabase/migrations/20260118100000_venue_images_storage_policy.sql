-- ==========================================================
-- Migration: Add storage policies for venue images
-- ==========================================================
-- Allows venue managers and admins to upload to venues/{venue_id}/* path
-- in the avatars bucket.
-- ==========================================================

-- Venue managers can upload venue images to venues/{venue_id}/* path
-- This checks that the user is a manager for the venue_id in the path
CREATE POLICY "Venue managers can upload venue images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'venues'
  AND EXISTS (
    SELECT 1 FROM venue_managers
    WHERE venue_managers.venue_id = (storage.foldername(name))[2]::uuid
    AND venue_managers.user_id = auth.uid()
    AND venue_managers.revoked_at IS NULL
  )
);

-- Admins can upload any venue images
CREATE POLICY "Admins can upload venue images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'venues'
  AND is_admin()
);

-- Venue managers can delete venue images they uploaded
CREATE POLICY "Venue managers can delete venue images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'venues'
  AND EXISTS (
    SELECT 1 FROM venue_managers
    WHERE venue_managers.venue_id = (storage.foldername(name))[2]::uuid
    AND venue_managers.user_id = auth.uid()
    AND venue_managers.revoked_at IS NULL
  )
);

-- Admins can delete any venue images
CREATE POLICY "Admins can delete any venue images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'venues'
  AND is_admin()
);

-- ==========================================================
-- Also add policy for profile-gallery path (used by ProfilePhotosSection)
-- ==========================================================

-- Users can upload their own profile gallery images
CREATE POLICY "Users can upload profile gallery images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'profile-gallery'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Users can delete their own profile gallery images
CREATE POLICY "Users can delete profile gallery images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'profile-gallery'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

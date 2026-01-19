-- ==========================================================
-- Migration: Add storage policies for venue cover images
-- ==========================================================
-- Allows venue managers and admins to upload to venue-covers/{venue_id}/*
-- path in the gallery-images bucket.
-- ==========================================================

-- Venue managers can upload venue cover images
CREATE POLICY "Venue managers can upload venue covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gallery-images'
  AND (storage.foldername(name))[1] = 'venue-covers'
  AND EXISTS (
    SELECT 1 FROM venue_managers
    WHERE venue_managers.venue_id = (storage.foldername(name))[2]::uuid
    AND venue_managers.user_id = auth.uid()
    AND venue_managers.revoked_at IS NULL
  )
);

-- Admins can upload any venue cover images
CREATE POLICY "Admins can upload venue covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gallery-images'
  AND (storage.foldername(name))[1] = 'venue-covers'
  AND is_admin()
);

-- Venue managers can update their venue cover images
CREATE POLICY "Venue managers can update venue covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gallery-images'
  AND (storage.foldername(name))[1] = 'venue-covers'
  AND EXISTS (
    SELECT 1 FROM venue_managers
    WHERE venue_managers.venue_id = (storage.foldername(name))[2]::uuid
    AND venue_managers.user_id = auth.uid()
    AND venue_managers.revoked_at IS NULL
  )
)
WITH CHECK (
  bucket_id = 'gallery-images'
  AND (storage.foldername(name))[1] = 'venue-covers'
  AND EXISTS (
    SELECT 1 FROM venue_managers
    WHERE venue_managers.venue_id = (storage.foldername(name))[2]::uuid
    AND venue_managers.user_id = auth.uid()
    AND venue_managers.revoked_at IS NULL
  )
);

-- Admins can update any venue cover images
CREATE POLICY "Admins can update venue covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gallery-images'
  AND (storage.foldername(name))[1] = 'venue-covers'
  AND is_admin()
)
WITH CHECK (
  bucket_id = 'gallery-images'
  AND (storage.foldername(name))[1] = 'venue-covers'
  AND is_admin()
);

-- Venue managers can delete their venue cover images
CREATE POLICY "Venue managers can delete venue covers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gallery-images'
  AND (storage.foldername(name))[1] = 'venue-covers'
  AND EXISTS (
    SELECT 1 FROM venue_managers
    WHERE venue_managers.venue_id = (storage.foldername(name))[2]::uuid
    AND venue_managers.user_id = auth.uid()
    AND venue_managers.revoked_at IS NULL
  )
);

-- Admins can delete any venue cover images
CREATE POLICY "Admins can delete venue covers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gallery-images'
  AND (storage.foldername(name))[1] = 'venue-covers'
  AND is_admin()
);

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

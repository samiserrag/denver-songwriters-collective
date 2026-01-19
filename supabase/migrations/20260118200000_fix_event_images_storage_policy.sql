-- ==========================================================
-- Migration: Fix event-images storage policies for admin uploads
-- ==========================================================
-- Problem: The original event-images bucket policy (20251209200002) required
-- {user_id}/* paths, but EventPhotosSection uploads to {event_id}/* paths.
-- The later migration (20260118120000) added event host/admin policies for
-- {event_id}/* but didn't remove the conflicting old policy.
--
-- This migration fixes the conflict by:
-- 1. Dropping the old user-id based policy that conflicts
-- 2. Ensuring admin upload policy works for {event_id}/* paths
-- ==========================================================

-- Drop the old conflicting policy that expects {user_id}/* paths
-- This policy blocks uploads to {event_id}/* paths for admins
DROP POLICY IF EXISTS "Authenticated users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own event images" ON storage.objects;

-- The newer policies from 20260118120000 should already exist:
-- - "Event hosts can upload to event-images bucket"
-- - "Admins can upload to event-images bucket"
-- - "Event hosts can update event-images storage"
-- - "Admins can update event-images storage"
-- - "Event hosts can delete event-images storage"
-- - "Admins can delete event-images storage"

-- Recreate admin policies with DROP IF EXISTS to ensure they exist
-- (idempotent in case the previous migration wasn't applied)

-- Admins can upload any event images (using {event_id}/* path)
DROP POLICY IF EXISTS "Admins can upload to event-images bucket" ON storage.objects;
CREATE POLICY "Admins can upload to event-images bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-images'
  AND is_admin()
);

-- Admins can update any event images in storage
DROP POLICY IF EXISTS "Admins can update event-images storage" ON storage.objects;
CREATE POLICY "Admins can update event-images storage"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-images' AND is_admin())
WITH CHECK (bucket_id = 'event-images' AND is_admin());

-- Admins can delete any event images from storage
DROP POLICY IF EXISTS "Admins can delete event-images storage" ON storage.objects;
CREATE POLICY "Admins can delete event-images storage"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-images' AND is_admin());

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

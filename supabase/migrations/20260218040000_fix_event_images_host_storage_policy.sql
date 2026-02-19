-- ==========================================================
-- Hotfix: Add missing event host storage policies for event-images bucket
-- ==========================================================
-- Problem: Migration 20260118120000 defined host-level storage policies for
-- event-images, but was never applied to production. Migration 20260118200000
-- dropped the old user-id-based policy, leaving ONLY the admin INSERT policy.
-- Result: Only admins could upload event images; hosts got RLS violation.
--
-- Error observed:
-- "StorageApiError: new row violates row-level security policy"
-- on storage.objects INSERT for event-images/{event_id}/{uuid}.jpg
--
-- Fix: Create the missing host-level storage policies for INSERT, UPDATE, DELETE.
-- ==========================================================

-- Event hosts can upload event images to event-images bucket
-- Path format: {event_id}/{uuid}.{ext}
CREATE POLICY "Event hosts can upload to event-images bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-images'
  AND (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = (storage.foldername(name))[1]::uuid
      AND events.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM event_hosts
      WHERE event_hosts.event_id = (storage.foldername(name))[1]::uuid
      AND event_hosts.user_id = auth.uid()
      AND event_hosts.invitation_status = 'accepted'
    )
  )
);

-- Event hosts can update their event images in storage
CREATE POLICY "Event hosts can update event-images storage"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-images'
  AND (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = (storage.foldername(name))[1]::uuid
      AND events.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM event_hosts
      WHERE event_hosts.event_id = (storage.foldername(name))[1]::uuid
      AND event_hosts.user_id = auth.uid()
      AND event_hosts.invitation_status = 'accepted'
    )
  )
)
WITH CHECK (
  bucket_id = 'event-images'
  AND (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = (storage.foldername(name))[1]::uuid
      AND events.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM event_hosts
      WHERE event_hosts.event_id = (storage.foldername(name))[1]::uuid
      AND event_hosts.user_id = auth.uid()
      AND event_hosts.invitation_status = 'accepted'
    )
  )
);

-- Event hosts can delete their event images from storage
CREATE POLICY "Event hosts can delete event-images storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-images'
  AND (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = (storage.foldername(name))[1]::uuid
      AND events.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM event_hosts
      WHERE event_hosts.event_id = (storage.foldername(name))[1]::uuid
      AND event_hosts.user_id = auth.uid()
      AND event_hosts.invitation_status = 'accepted'
    )
  )
);

-- ==========================================================
-- END OF HOTFIX
-- ==========================================================

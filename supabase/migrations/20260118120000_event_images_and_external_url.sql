-- ==========================================================
-- Migration: Add event images table and external_url field
-- ==========================================================
-- 1. Creates event_images table for event photo galleries (same pattern as venue_images)
-- 2. Adds external_url column to events table for outside happening links
-- ==========================================================

-- ==========================================================
-- 1. ADD EXTERNAL_URL COLUMN TO EVENTS TABLE
-- ==========================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS external_url TEXT;

COMMENT ON COLUMN events.external_url IS 'External website URL for the happening (e.g., venue event page, Facebook event)';

-- ==========================================================
-- 2. CREATE EVENT_IMAGES TABLE
-- ==========================================================

CREATE TABLE IF NOT EXISTS event_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL -- Soft-delete pattern
);

-- Index for fast lookup by event
CREATE INDEX IF NOT EXISTS idx_event_images_event_id ON event_images(event_id);

-- Index for finding active images (not soft-deleted)
CREATE INDEX IF NOT EXISTS idx_event_images_active ON event_images(event_id) WHERE deleted_at IS NULL;

-- ==========================================================
-- 3. RLS POLICIES FOR EVENT_IMAGES
-- ==========================================================

ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view active event images (public gallery)
CREATE POLICY "Anyone can view active event images"
ON event_images FOR SELECT
TO public
USING (deleted_at IS NULL);

-- Event hosts can view all images for their events (including soft-deleted)
CREATE POLICY "Event hosts can view their event images"
ON event_images FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_images.event_id
    AND events.host_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM event_hosts
    WHERE event_hosts.event_id = event_images.event_id
    AND event_hosts.user_id = auth.uid()
    AND event_hosts.invitation_status = 'accepted'
  )
);

-- Admins can view all event images
CREATE POLICY "Admins can view all event images"
ON event_images FOR SELECT
TO authenticated
USING (is_admin());

-- Event hosts can upload images for their events
CREATE POLICY "Event hosts can upload event images"
ON event_images FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_images.event_id
    AND events.host_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM event_hosts
    WHERE event_hosts.event_id = event_images.event_id
    AND event_hosts.user_id = auth.uid()
    AND event_hosts.invitation_status = 'accepted'
  )
);

-- Admins can upload images for any event
CREATE POLICY "Admins can upload event images"
ON event_images FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- Event hosts can update their event images (soft-delete)
CREATE POLICY "Event hosts can update event images"
ON event_images FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_images.event_id
    AND events.host_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM event_hosts
    WHERE event_hosts.event_id = event_images.event_id
    AND event_hosts.user_id = auth.uid()
    AND event_hosts.invitation_status = 'accepted'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_images.event_id
    AND events.host_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM event_hosts
    WHERE event_hosts.event_id = event_images.event_id
    AND event_hosts.user_id = auth.uid()
    AND event_hosts.invitation_status = 'accepted'
  )
);

-- Admins can update any event images
CREATE POLICY "Admins can update event images"
ON event_images FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Event hosts can delete their event images
CREATE POLICY "Event hosts can delete event images"
ON event_images FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_images.event_id
    AND events.host_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM event_hosts
    WHERE event_hosts.event_id = event_images.event_id
    AND event_hosts.user_id = auth.uid()
    AND event_hosts.invitation_status = 'accepted'
  )
);

-- Admins can delete any event images
CREATE POLICY "Admins can delete event images"
ON event_images FOR DELETE
TO authenticated
USING (is_admin());

-- ==========================================================
-- 4. STORAGE POLICIES FOR EVENT IMAGES
-- ==========================================================
-- Event images stored at: event-images/{event_id}/{uuid}.{ext}
-- Note: event-images bucket already exists (used by EventForm cover image)

-- Event hosts can upload event images to event-images bucket
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

-- Admins can upload any event images
CREATE POLICY "Admins can upload to event-images bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-images'
  AND is_admin()
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

-- Admins can update any event images in storage
CREATE POLICY "Admins can update event-images storage"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-images' AND is_admin())
WITH CHECK (bucket_id = 'event-images' AND is_admin());

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

-- Admins can delete any event images from storage
CREATE POLICY "Admins can delete event-images storage"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-images' AND is_admin());

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

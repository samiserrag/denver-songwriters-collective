-- ==========================================================
-- Migration: venue_images table for venue photo gallery
-- ==========================================================
-- Allows venue managers and admins to upload photos for venues.
-- Photos appear on public venue detail pages.
-- ==========================================================

-- 1. Create venue_images table
CREATE TABLE IF NOT EXISTS venue_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- 2. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_venue_images_venue_id_created
  ON venue_images(venue_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_images_venue_active
  ON venue_images(venue_id)
  WHERE deleted_at IS NULL;

-- 3. Enable RLS
ALTER TABLE venue_images ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Venue managers can view their venue's images
CREATE POLICY "Venue managers can view venue images"
  ON venue_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM venue_managers
      WHERE venue_managers.venue_id = venue_images.venue_id
      AND venue_managers.user_id = auth.uid()
      AND venue_managers.revoked_at IS NULL
    )
  );

-- Admins can view all venue images
CREATE POLICY "Admins can view all venue images"
  ON venue_images FOR SELECT
  TO authenticated
  USING (is_admin());

-- Public can view active venue images (for venue detail pages)
CREATE POLICY "Public can view active venue images"
  ON venue_images FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

-- Authenticated public can also view active venue images
CREATE POLICY "Authenticated can view active venue images"
  ON venue_images FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Venue managers can insert images for their venues
CREATE POLICY "Venue managers can insert venue images"
  ON venue_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venue_managers
      WHERE venue_managers.venue_id = venue_images.venue_id
      AND venue_managers.user_id = auth.uid()
      AND venue_managers.revoked_at IS NULL
    )
  );

-- Admins can insert venue images
CREATE POLICY "Admins can insert venue images"
  ON venue_images FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Venue managers can update their venue's images (for soft delete)
CREATE POLICY "Venue managers can update venue images"
  ON venue_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM venue_managers
      WHERE venue_managers.venue_id = venue_images.venue_id
      AND venue_managers.user_id = auth.uid()
      AND venue_managers.revoked_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM venue_managers
      WHERE venue_managers.venue_id = venue_images.venue_id
      AND venue_managers.user_id = auth.uid()
      AND venue_managers.revoked_at IS NULL
    )
  );

-- Admins can update any venue images
CREATE POLICY "Admins can update venue images"
  ON venue_images FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Venue managers can hard delete their venue's images
CREATE POLICY "Venue managers can delete venue images"
  ON venue_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM venue_managers
      WHERE venue_managers.venue_id = venue_images.venue_id
      AND venue_managers.user_id = auth.uid()
      AND venue_managers.revoked_at IS NULL
    )
  );

-- Admins can delete any venue images
CREATE POLICY "Admins can delete venue images"
  ON venue_images FOR DELETE
  TO authenticated
  USING (is_admin());

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

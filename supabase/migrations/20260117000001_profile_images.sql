-- ==========================================================
-- Migration: profile_images table for member photo gallery
-- ==========================================================
-- Allows members to upload multiple profile photos and choose
-- which one to display as their profile avatar.
-- ==========================================================

-- 1. Create profile_images table
CREATE TABLE IF NOT EXISTS profile_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

-- 2. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_profile_images_user_id_created
  ON profile_images(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_images_user_active
  ON profile_images(user_id)
  WHERE deleted_at IS NULL;

-- 3. Enable RLS
ALTER TABLE profile_images ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Users can view their own profile images
CREATE POLICY "Users can view own profile images"
  ON profile_images FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all profile images
CREATE POLICY "Admins can view all profile images"
  ON profile_images FOR SELECT
  TO authenticated
  USING (is_admin());

-- Public can view profile images for public profiles (for profile detail pages)
CREATE POLICY "Public can view public profile images"
  ON profile_images FOR SELECT
  TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_images.user_id
      AND profiles.is_public = true
    )
  );

-- Authenticated public can also view public profile images
CREATE POLICY "Authenticated can view public profile images"
  ON profile_images FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_images.user_id
      AND profiles.is_public = true
    )
  );

-- Users can insert their own profile images
CREATE POLICY "Users can insert own profile images"
  ON profile_images FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile images (for soft delete)
CREATE POLICY "Users can update own profile images"
  ON profile_images FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can hard delete their own profile images
CREATE POLICY "Users can delete own profile images"
  ON profile_images FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

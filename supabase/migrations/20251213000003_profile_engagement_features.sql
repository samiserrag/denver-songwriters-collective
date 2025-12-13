-- Migration: Profile Engagement Features
-- Date: December 13, 2024
-- Purpose: Add last_active tracking and featured_song_url for profiles

-- ============================================================================
-- 1. ADD last_active_at COLUMN
-- Tracks when user was last active (for dormancy detection)
-- ============================================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for efficient querying of inactive profiles
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at
ON profiles(last_active_at);

-- ============================================================================
-- 2. ADD featured_song_url COLUMN
-- Single featured song link (YouTube, Spotify, SoundCloud, etc.)
-- ============================================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS featured_song_url TEXT;

-- ============================================================================
-- 3. CREATE FUNCTION to update last_active_at
-- Can be called from API routes when user performs actions
-- ============================================================================
CREATE OR REPLACE FUNCTION update_profile_last_active()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_active_at when profile is updated
  NEW.last_active_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update last_active_at on profile changes
DROP TRIGGER IF EXISTS trg_update_last_active ON profiles;
CREATE TRIGGER trg_update_last_active
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profile_last_active();

-- ============================================================================
-- 4. HELPER QUERY: Find dormant profiles (6+ months inactive)
-- Run this periodically to identify accounts needing outreach
-- ============================================================================
-- SELECT id, full_name, email, last_active_at, role
-- FROM profiles
-- WHERE last_active_at < NOW() - INTERVAL '6 months'
--   AND role IN ('performer', 'host', 'studio')
-- ORDER BY last_active_at ASC;

-- ============================================================================
-- 5. Set initial last_active_at for existing profiles
-- Uses created_at as fallback for accounts without activity
-- ============================================================================
UPDATE profiles
SET last_active_at = COALESCE(updated_at, created_at, NOW())
WHERE last_active_at IS NULL;

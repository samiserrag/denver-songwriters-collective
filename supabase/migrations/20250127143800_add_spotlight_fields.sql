-- Add spotlight performer fields to profiles table
-- Part of Phase 7C: Spotlight Performers

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS featured_rank INT DEFAULT 9999;

-- Index for spotlight queries (optional performance optimization)
CREATE INDEX IF NOT EXISTS idx_profiles_spotlight
ON profiles(is_featured DESC, featured_rank ASC, created_at DESC)
WHERE role = 'performer';

-- Comment for documentation
COMMENT ON COLUMN profiles.is_featured IS 'Whether this performer is featured/spotlighted on homepage';
COMMENT ON COLUMN profiles.featured_rank IS 'Rank for featured performers (lower = higher priority, default 9999)';

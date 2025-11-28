-- Add spotlight fields for events and studios
-- Part of Phase 7D: Featured Studios & Events

-- Add spotlight fields to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

ALTER TABLE events
ADD COLUMN IF NOT EXISTS featured_rank INT DEFAULT 9999;

-- Index for spotlight queries on studios (profiles already has is_featured/featured_rank)
CREATE INDEX IF NOT EXISTS idx_profiles_studios_spotlight
ON profiles(is_featured DESC, featured_rank ASC, created_at DESC)
WHERE role = 'studio';

-- Index for spotlight queries on events
CREATE INDEX IF NOT EXISTS idx_events_spotlight
ON events(is_featured DESC, featured_rank ASC, event_date ASC);

-- Comments for documentation
COMMENT ON COLUMN events.is_featured IS 'Whether this event is featured/spotlighted on homepage';
COMMENT ON COLUMN events.featured_rank IS 'Rank for featured events (lower = higher priority, default 9999)';

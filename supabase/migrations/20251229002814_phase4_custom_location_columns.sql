-- Phase 4.0: Custom Location Columns
-- Adds custom location fields to events table for non-venue locations
-- All columns are nullable per contract

-- Add custom location columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_location_name text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_address text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_city text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_state text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_latitude double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_longitude double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_notes text;

-- Add index for custom location name searches
CREATE INDEX IF NOT EXISTS idx_events_custom_location_name
ON events (custom_location_name)
WHERE custom_location_name IS NOT NULL;

-- Add comment documenting the invariants
COMMENT ON COLUMN events.custom_location_name IS 'Custom location name - mutually exclusive with venue_id. If set, venue_id must be NULL.';
COMMENT ON COLUMN events.custom_address IS 'Street address for custom location';
COMMENT ON COLUMN events.custom_city IS 'City for custom location';
COMMENT ON COLUMN events.custom_state IS 'State for custom location';
COMMENT ON COLUMN events.custom_latitude IS 'Latitude for custom location (not displayed to users)';
COMMENT ON COLUMN events.custom_longitude IS 'Longitude for custom location (not displayed to users)';
COMMENT ON COLUMN events.location_notes IS 'Additional location instructions (e.g., "Back room", "Meet at north entrance")';

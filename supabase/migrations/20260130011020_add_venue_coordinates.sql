-- Phase 0.5: Add coordinate columns to venues for Map View support
-- Safe to apply: all columns are nullable, no data modification

-- Add coordinate columns
ALTER TABLE venues ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS longitude double precision;

-- Add geocoding metadata columns
ALTER TABLE venues ADD COLUMN IF NOT EXISTS geocode_source text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

-- Add CHECK constraint for valid coordinate ranges
ALTER TABLE venues ADD CONSTRAINT venues_latitude_range
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
ALTER TABLE venues ADD CONSTRAINT venues_longitude_range
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

-- Add CHECK constraint for geocode_source values
ALTER TABLE venues ADD CONSTRAINT venues_geocode_source_values
  CHECK (geocode_source IS NULL OR geocode_source IN ('manual', 'api'));

-- Create partial index for efficient coordinate queries (bounding box queries)
CREATE INDEX IF NOT EXISTS idx_venues_coordinates
  ON venues (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN venues.latitude IS 'Venue latitude in decimal degrees (WGS84)';
COMMENT ON COLUMN venues.longitude IS 'Venue longitude in decimal degrees (WGS84)';
COMMENT ON COLUMN venues.geocode_source IS 'How coordinates were obtained: manual or api';
COMMENT ON COLUMN venues.geocoded_at IS 'When coordinates were last updated';

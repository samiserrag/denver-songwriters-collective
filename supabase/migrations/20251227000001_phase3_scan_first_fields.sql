-- ============================================================
-- PHASE 3: SCAN-FIRST CARD CONTRACT SCHEMA
-- Migration: 20251227_phase3_scan_first_fields.sql
-- ============================================================

-- EVENTS TABLE ADDITIONS
ALTER TABLE events ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/Denver';
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_mode text DEFAULT 'venue';
ALTER TABLE events ADD COLUMN IF NOT EXISTS online_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_free boolean;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cost_label text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS signup_mode text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS signup_url text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS signup_deadline timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS age_policy text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source text DEFAULT 'community';

-- VENUES TABLE ADDITIONS
ALTER TABLE venues ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS parking_notes text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS accessibility_notes text;

-- CHECK CONSTRAINTS (IDEMPOTENT)
DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_location_mode_check 
    CHECK (location_mode IS NULL OR location_mode IN ('venue', 'online', 'hybrid'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_signup_mode_check 
    CHECK (signup_mode IS NULL OR signup_mode IN ('in_person', 'online', 'both', 'walk_in'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_source_check 
    CHECK (source IS NULL OR source IN ('community', 'venue', 'admin', 'import'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_events_is_free 
  ON events(is_free) WHERE is_free = true AND is_published = true;

CREATE INDEX IF NOT EXISTS idx_events_location_mode 
  ON events(location_mode) WHERE location_mode IN ('online', 'hybrid') AND is_published = true;

CREATE INDEX IF NOT EXISTS idx_venues_neighborhood 
  ON venues(neighborhood) WHERE neighborhood IS NOT NULL;

-- COMMENTS
COMMENT ON COLUMN events.timezone IS 'IANA timezone (e.g., America/Denver). All times are local to this zone.';
COMMENT ON COLUMN events.location_mode IS 'venue = in-person only, online = virtual only, hybrid = both options';
COMMENT ON COLUMN events.online_url IS 'URL for virtual event access (Zoom, YouTube, etc.)';
COMMENT ON COLUMN events.is_free IS 'true = free, false = paid/donation, NULL = unknown';
COMMENT ON COLUMN events.cost_label IS 'Human-readable cost (Free, $10, $5-15, Donation)';
COMMENT ON COLUMN events.signup_mode IS 'How attendees sign up: in_person, online, both, walk_in';
COMMENT ON COLUMN events.signup_url IS 'URL for online signup/registration';
COMMENT ON COLUMN events.signup_deadline IS 'When online signup closes';
COMMENT ON COLUMN events.age_policy IS 'Age restriction as free text (21+, All ages, 18+ after 9pm, etc.)';
COMMENT ON COLUMN events.source IS 'Data origin: community, venue, admin, import';
COMMENT ON COLUMN venues.neighborhood IS 'Denver neighborhood (RiNo, Capitol Hill, etc.)';
COMMENT ON COLUMN venues.parking_notes IS 'Parking instructions for attendees';
COMMENT ON COLUMN venues.accessibility_notes IS 'Wheelchair access, hearing loops, etc.';

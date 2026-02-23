-- Migration: Convert event_type from single enum to text[] array
-- Purpose: Allow events to have multiple types (e.g., a blues jam tagged as both "jam_session" and "blues")
-- REVIEWED: policy change acknowledged

-- 1. Drop old scalar default before type conversion
--    (Postgres can fail casting enum default to text[])
ALTER TABLE events ALTER COLUMN event_type DROP DEFAULT;

-- 2. Convert single enum to text array, preserving existing values as single-element arrays
ALTER TABLE events ALTER COLUMN event_type TYPE text[] USING ARRAY[event_type::text];

-- 3. Set new array default
ALTER TABLE events ALTER COLUMN event_type SET DEFAULT ARRAY['open_mic']::text[];

-- 4. CHECK constraint replaces enum-level enforcement
--    Uses cardinality() instead of array_length() because array_length returns NULL
--    for empty arrays, and CHECK accepts NULL (would allow empty arrays through)
ALTER TABLE events ADD CONSTRAINT events_event_type_valid CHECK (
  cardinality(event_type) > 0
  AND event_type <@ ARRAY[
    'open_mic','showcase','song_circle','workshop','other',
    'gig','meetup','kindred_group','jam_session',
    'poetry','irish','blues','bluegrass','comedy'
  ]::text[]
);

-- 5. GIN index for fast @> (contains) and && (overlaps) queries
CREATE INDEX idx_events_event_type_gin ON events USING GIN (event_type);

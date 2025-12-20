-- Migration: Add event series support for recurring events
-- Each event in a series gets its own row with its own event_date
-- series_id links events that belong to the same recurring series

-- Add series columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS series_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS series_index INTEGER DEFAULT NULL;

-- Create index for efficient series queries
CREATE INDEX IF NOT EXISTS idx_events_series_id ON events(series_id) WHERE series_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN events.series_id IS 'UUID linking events that belong to the same recurring series. NULL for non-recurring events.';
COMMENT ON COLUMN events.series_index IS 'Position in the series (0-based). Used for ordering and identifying the original event.';

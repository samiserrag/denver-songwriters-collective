-- Audit columns for event lifecycle (enables future notifications + history)
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS last_major_update_at timestamptz;

COMMENT ON COLUMN events.cancelled_at IS 'When event was cancelled';
COMMENT ON COLUMN events.cancel_reason IS 'Host message explaining cancellation';
COMMENT ON COLUMN events.published_at IS 'When event was first published';
COMMENT ON COLUMN events.last_major_update_at IS 'Last change to date/time/venue/location_mode';

-- Phase 4.21: Occurrence Overrides for Recurring Events
--
-- This table stores per-occurrence exceptions/overrides for recurring event series.
-- Instead of storing individual DB rows for each computed occurrence,
-- we keep the series as-is and only store exceptions (cancellations, time changes, flyer overrides).
--
-- The expansion logic in nextOccurrence.ts will check this table when generating occurrences.

-- Create the occurrence_overrides table
CREATE TABLE IF NOT EXISTS occurrence_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the parent event (series template)
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- The specific date being overridden (YYYY-MM-DD format)
  date_key TEXT NOT NULL,

  -- Status: 'normal' (no change), 'cancelled'
  status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'cancelled')),

  -- Optional time override (only start_time for now)
  override_start_time TIME NULL,

  -- Optional flyer/poster override (URL, same as events.cover_image_url)
  override_cover_image_url TEXT NULL,

  -- Optional notes for this specific occurrence
  override_notes TEXT NULL,

  -- Audit fields
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure one override per event+date
  CONSTRAINT occurrence_overrides_event_date_unique UNIQUE (event_id, date_key)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_occurrence_overrides_event_id ON occurrence_overrides(event_id);
CREATE INDEX IF NOT EXISTS idx_occurrence_overrides_date_key ON occurrence_overrides(date_key);
CREATE INDEX IF NOT EXISTS idx_occurrence_overrides_status ON occurrence_overrides(status) WHERE status = 'cancelled';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_occurrence_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_occurrence_overrides_updated_at ON occurrence_overrides;
CREATE TRIGGER trigger_occurrence_overrides_updated_at
  BEFORE UPDATE ON occurrence_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_occurrence_overrides_updated_at();

-- RLS Policies
-- Read: Public can read (same visibility as events)
-- Write: Admin only for Phase 4.21 (hosts later via host permission check)

ALTER TABLE occurrence_overrides ENABLE ROW LEVEL SECURITY;

-- Anyone can read overrides (needed for displaying cancelled status)
CREATE POLICY "occurrence_overrides_select_public"
  ON occurrence_overrides
  FOR SELECT
  USING (true);

-- Only admins can insert overrides
CREATE POLICY "occurrence_overrides_insert_admin"
  ON occurrence_overrides
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only admins can update overrides
CREATE POLICY "occurrence_overrides_update_admin"
  ON occurrence_overrides
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only admins can delete overrides
CREATE POLICY "occurrence_overrides_delete_admin"
  ON occurrence_overrides
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Comment for documentation
COMMENT ON TABLE occurrence_overrides IS
'Per-occurrence exceptions for recurring events. Used to cancel specific dates or override time/flyer without modifying the series template.';

COMMENT ON COLUMN occurrence_overrides.date_key IS
'Date in YYYY-MM-DD format matching the computed occurrence date from expansion.';

COMMENT ON COLUMN occurrence_overrides.status IS
'normal = no status change, cancelled = this occurrence is cancelled.';

-- Phase: Occurrence Mode Form
-- Add JSONB patch column for flexible per-occurrence field overrides
-- Additive-only: new column with NULL default, no destructive changes

BEGIN;

-- Add new JSONB column for flexible field overrides
ALTER TABLE occurrence_overrides
  ADD COLUMN IF NOT EXISTS override_patch JSONB NULL;

-- GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_occurrence_overrides_patch
  ON occurrence_overrides USING GIN(override_patch);

COMMENT ON COLUMN occurrence_overrides.override_patch IS
'JSONB map of field overrides for this specific occurrence.
Keys are field names from the ALLOWED_OVERRIDE_FIELDS allowlist.
Applied by merging: { ...baseEvent, ...override_patch }
Example: {"title": "Special Night", "venue_id": "abc-123"}';

COMMIT;

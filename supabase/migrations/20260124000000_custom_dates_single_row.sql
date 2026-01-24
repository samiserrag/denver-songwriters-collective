-- Migration: Custom Date Series Single-Row Model
-- Adds custom_dates TEXT[] column, 'duplicate' status value, and converts legacy multi-row custom series

-- 1. Add custom_dates column to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS custom_dates TEXT[];

-- 2. Expand status CHECK constraint to include 'duplicate'
-- Drop both possible constraint names (different environments may use either)
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_valid;
-- Re-create with canonical name including 'duplicate'
ALTER TABLE public.events ADD CONSTRAINT events_status_valid
  CHECK (status IN ('draft', 'active', 'needs_verification', 'unverified', 'inactive', 'cancelled', 'duplicate'));

-- 3. Update trigger to force is_published=false for 'duplicate' status (same as cancelled)
CREATE OR REPLACE FUNCTION public.enforce_event_status_invariants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Rule 1: If publishing, status cannot be 'draft' - promote to 'active'
  IF NEW.is_published = true AND NEW.status = 'draft' THEN
    NEW.status := 'active';
  END IF;

  -- Rule 2: If status is NULL and published, default to 'active'
  IF NEW.is_published = true AND NEW.status IS NULL THEN
    NEW.status := 'active';
  END IF;

  -- Rule 3: Cancelled or duplicate events cannot be published
  IF NEW.status = 'cancelled' OR NEW.status = 'duplicate' THEN
    NEW.is_published := false;
  END IF;

  -- Rule 4: Ensure status is never NULL (default to 'draft' for unpublished)
  IF NEW.status IS NULL THEN
    NEW.status := 'draft';
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Retroactive conversion: Convert legacy multi-row custom-date series to single-row model
-- Legacy definition: series_id IS NOT NULL AND recurrence_rule IS NULL AND day_of_week IS NULL
-- Strategy:
--   a) Pick canonical row per series_id (prefer is_published=true, then lowest series_index)
--   b) Set canonical row: recurrence_rule='custom', custom_dates=array of all dates, event_date=min date
--   c) Soft-retire sibling rows: status='duplicate', is_published=false, last_verified_at=NULL

-- Step 4a: Identify canonical rows and collect dates per series
WITH legacy_series AS (
  -- Find all events that are part of legacy custom-date series
  SELECT
    id,
    series_id,
    series_index,
    event_date,
    is_published,
    ROW_NUMBER() OVER (
      PARTITION BY series_id
      ORDER BY
        -- Prefer published rows first
        CASE WHEN is_published = true THEN 0 ELSE 1 END,
        -- Then lowest series_index
        COALESCE(series_index, 999)
    ) AS row_rank
  FROM public.events
  WHERE series_id IS NOT NULL
    AND (recurrence_rule IS NULL OR recurrence_rule = '')
    AND (day_of_week IS NULL OR day_of_week = '')
),
series_dates AS (
  -- Collect all dates per series_id
  SELECT
    series_id,
    ARRAY_AGG(event_date ORDER BY event_date) AS all_dates,
    MIN(event_date) AS anchor_date
  FROM legacy_series
  WHERE event_date IS NOT NULL
  GROUP BY series_id
),
canonical_ids AS (
  -- The canonical row per series (rank=1)
  SELECT id, series_id
  FROM legacy_series
  WHERE row_rank = 1
)
-- Step 4b: Update canonical rows
UPDATE public.events e
SET
  recurrence_rule = 'custom',
  custom_dates = sd.all_dates,
  event_date = sd.anchor_date,
  series_id = NULL,
  series_index = NULL
FROM canonical_ids ci
JOIN series_dates sd ON sd.series_id = ci.series_id
WHERE e.id = ci.id;

-- Step 4c: Soft-retire sibling rows (all remaining legacy custom-date rows)
-- After Step 4a promoted the canonical, remaining rows still have series_id set
-- Keep series_id for audit trail, just mark as duplicate + unpublish
UPDATE public.events
SET
  status = 'duplicate',
  is_published = false,
  last_verified_at = NULL
WHERE series_id IS NOT NULL
  AND (recurrence_rule IS NULL OR recurrence_rule = '')
  AND (day_of_week IS NULL OR day_of_week = '');

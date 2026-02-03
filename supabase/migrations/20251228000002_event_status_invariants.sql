-- Migration: Enforce event status/is_published invariants
-- Prevents the bug where is_published=true but status='draft' makes events invisible

-- =============================================================================
-- TRIGGER: Enforce status/is_published consistency on INSERT and UPDATE
-- =============================================================================

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

  -- Rule 3: Cancelled events cannot be published
  IF NEW.status = 'cancelled' THEN
    NEW.is_published := false;
  END IF;

  -- Rule 4: Ensure status is never NULL (default to 'draft' for unpublished)
  IF NEW.status IS NULL THEN
    NEW.status := 'draft';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_enforce_event_status_invariants ON public.events;

-- Create trigger for both INSERT and UPDATE
CREATE TRIGGER trigger_enforce_event_status_invariants
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_status_invariants();

-- =============================================================================
-- CONSTRAINT: Add NOT NULL constraint on status with default
-- =============================================================================

-- First, ensure no NULL values exist (should be fixed by earlier data cleanup)
UPDATE public.events SET status = 'draft' WHERE status IS NULL AND is_published = false;
UPDATE public.events SET status = 'active' WHERE status IS NULL AND is_published = true;

-- Add NOT NULL constraint with default
ALTER TABLE public.events
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN status SET NOT NULL;

-- =============================================================================
-- CONSTRAINT: Valid status values (if not already exists)
-- =============================================================================

DO $$
BEGIN
  -- Add check constraint for valid status values if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_status_valid' AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_status_valid
      CHECK (status IN ('draft', 'active', 'needs_verification', 'unverified', 'inactive', 'cancelled'));
  END IF;
END $$;

-- =============================================================================
-- COMMENT: Document the invariants
-- =============================================================================

COMMENT ON FUNCTION public.enforce_event_status_invariants() IS
'Enforces event status/is_published invariants:
1. Published events cannot have draft status (auto-promoted to active)
2. Published events with NULL status default to active
3. Cancelled events are always unpublished
4. Status is never NULL (defaults to draft)';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

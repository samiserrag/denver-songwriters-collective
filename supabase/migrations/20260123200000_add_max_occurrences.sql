-- Add max_occurrences column to events table
-- null = infinite (no end date), integer = stops after N occurrences
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS max_occurrences integer;

-- Add comment for clarity
COMMENT ON COLUMN public.events.max_occurrences IS 'Maximum number of occurrences for recurring events. NULL means infinite (no end date).';

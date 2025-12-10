-- Add cover_image_url column to events table for DSC event photos
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS cover_image_url text DEFAULT NULL;

-- Add index for DSC events with images
CREATE INDEX IF NOT EXISTS idx_events_dsc_cover ON public.events(is_dsc_event, cover_image_url)
WHERE is_dsc_event = true AND cover_image_url IS NOT NULL;

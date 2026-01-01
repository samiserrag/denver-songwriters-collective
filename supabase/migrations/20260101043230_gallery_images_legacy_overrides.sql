-- Migration: Add legacy venue/event override fields to gallery_images
-- Purpose: Allow users to tag photos from venues/events not yet in the database
--
-- Schema: gallery_images gains three optional columns:
--   - custom_venue_name: text for venue name when venue_id is NULL
--   - custom_event_name: text for event name when event_id is NULL
--   - custom_event_date: date for event date when using custom_event_name
--
-- Mutual exclusivity enforced in application layer:
--   - If venue_id is set, custom_venue_name should be NULL
--   - If event_id is set, custom_event_name and custom_event_date should be NULL

ALTER TABLE public.gallery_images
ADD COLUMN custom_venue_name text,
ADD COLUMN custom_event_name text,
ADD COLUMN custom_event_date date;

-- Add comments for documentation
COMMENT ON COLUMN public.gallery_images.custom_venue_name IS 'User-entered venue name for photos from venues not in venues table';
COMMENT ON COLUMN public.gallery_images.custom_event_name IS 'User-entered event name for photos from events not in events table';
COMMENT ON COLUMN public.gallery_images.custom_event_date IS 'Date of custom event (used with custom_event_name)';

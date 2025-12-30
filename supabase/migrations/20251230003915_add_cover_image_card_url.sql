-- Add cover_image_card_url field for 4:3 card thumbnails
-- This stores a cropped/resized version of the poster optimized for card display
-- The original cover_image_url remains unchanged for detail pages

ALTER TABLE events
ADD COLUMN IF NOT EXISTS cover_image_card_url TEXT;

COMMENT ON COLUMN events.cover_image_card_url IS 'URL to 4:3 aspect ratio card thumbnail, auto-generated from cover_image_url on upload';

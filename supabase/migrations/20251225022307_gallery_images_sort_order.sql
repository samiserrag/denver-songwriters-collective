-- Add sort_order column to gallery_images for drag-and-drop ordering
ALTER TABLE gallery_images ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Index for efficient ordering within albums
CREATE INDEX idx_gallery_images_album_sort ON gallery_images(album_id, sort_order);

-- Index for ordering all images
CREATE INDEX idx_gallery_images_sort ON gallery_images(sort_order);

-- Backfill existing images with sort_order based on created_at (oldest first)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM gallery_images
)
UPDATE gallery_images
SET sort_order = numbered.rn
FROM numbered
WHERE gallery_images.id = numbered.id;

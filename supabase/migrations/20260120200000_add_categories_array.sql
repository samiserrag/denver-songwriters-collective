-- Add categories array column to events table
-- Allows happenings to have multiple categories (music, poetry, comedy, variety, other)

-- Add the new categories array column
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}';

-- Migrate existing category data to categories array
UPDATE public.events
SET categories = ARRAY[category]
WHERE category IS NOT NULL AND category != '' AND (categories IS NULL OR categories = '{}');

-- Add comment for documentation
COMMENT ON COLUMN public.events.categories IS 'Array of content categories (music, poetry, comedy, variety, other)';

-- ==========================================================
-- ADD SPOTLIGHT_TYPE TO PROFILES
-- Migration: 20251209000006_add_spotlight_type.sql
-- ==========================================================
-- Allows admins to specify the TYPE of spotlight for a user:
-- - 'performer': Artist/Performer spotlight
-- - 'host': Open Mic Host spotlight
-- - 'studio': Studio spotlight
-- - NULL: No spotlight (is_featured should be false)

-- Add spotlight_type column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS spotlight_type TEXT;

-- Add check constraint to ensure valid spotlight types
ALTER TABLE profiles ADD CONSTRAINT spotlight_type_check
  CHECK (spotlight_type IS NULL OR spotlight_type IN ('performer', 'host', 'studio'));

-- Migrate existing spotlighted users - set their spotlight_type based on their role
UPDATE profiles
SET spotlight_type = role::text
WHERE is_featured = true AND spotlight_type IS NULL;

-- Create index for efficient spotlight queries
CREATE INDEX IF NOT EXISTS profiles_spotlight_type_idx ON profiles(spotlight_type) WHERE spotlight_type IS NOT NULL;

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

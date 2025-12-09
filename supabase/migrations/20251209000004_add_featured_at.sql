-- ==========================================================
-- ADD FEATURED_AT TIMESTAMP TO PROFILES
-- Migration: 20251209000004_add_featured_at.sql
-- ==========================================================
-- Tracks when a user was featured for spotlight history

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS featured_at TIMESTAMP WITH TIME ZONE;

-- Create index for ordering spotlight history
CREATE INDEX IF NOT EXISTS profiles_featured_at_idx ON profiles(featured_at DESC NULLS LAST);

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

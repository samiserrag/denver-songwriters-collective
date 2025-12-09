-- ==========================================================
-- ADD IS_HOST BOOLEAN TO PROFILES
-- Migration: 20251209000005_add_is_host_to_profiles.sql
-- ==========================================================
-- Allows performers to also be hosts without changing their primary role
-- This enables dual-role functionality for performers who host open mics

-- Add is_host column (defaults to false for all existing users)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_host BOOLEAN DEFAULT false;

-- Set is_host to true for existing users with role = 'host'
UPDATE profiles SET is_host = true WHERE role = 'host';

-- Create index for querying hosts (including performers who are also hosts)
CREATE INDEX IF NOT EXISTS profiles_is_host_idx ON profiles(is_host) WHERE is_host = true;

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

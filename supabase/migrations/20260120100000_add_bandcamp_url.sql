-- Migration: Add bandcamp_url column to profiles table
-- Purpose: Allow members to add their Bandcamp profile URL for music discovery

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bandcamp_url TEXT;

COMMENT ON COLUMN profiles.bandcamp_url IS 'Bandcamp profile URL for the member';

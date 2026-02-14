-- Fix the profiles_tiktok_url_format CHECK constraint.
-- The original constraint (added manually to production, never in a migration)
-- used '^(https?:\/\/).+' which PostgreSQL's regex engine rejected for valid
-- URLs like 'https://www.tiktok.com/@user'. The escaped forward slashes
-- were interpreted as literal backslash-slash sequences.
--
-- This migration drops the broken constraint and recreates it with a simpler
-- regex that correctly matches any URL starting with http:// or https://.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tiktok_url_format;

ALTER TABLE profiles ADD CONSTRAINT profiles_tiktok_url_format
  CHECK (tiktok_url IS NULL OR tiktok_url ~* '^https?://');

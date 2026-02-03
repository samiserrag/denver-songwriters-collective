-- Migration: Add status column to events table
-- This column was missing from the migration sequence but is referenced by later migrations.
-- It must run BEFORE 20251213000001_cleanup_test_events.sql which uses events.status

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

COMMENT ON COLUMN public.events.status IS 'Event lifecycle status: draft, active, needs_verification, unverified, inactive, cancelled';

-- Migration: Make events.end_time nullable
--
-- CI CONTEXT:
-- Fresh-migration replay fails applying 20251213000002_venue_updates_december.sql
-- with SQLSTATE 23502 (NOT NULL violation) on public.events.end_time.
-- That migration inserts events without specifying end_time.
--
-- EVIDENCE:
-- - Original events table (20250101000000_init_schema.sql line 74) has end_time TIME NOT NULL
-- - Migration 20251213000002 INSERT statements omit end_time for some events
-- - Events can reasonably have unknown end times (e.g., "until close")
--
-- This migration must run BEFORE 20251213000002_venue_updates_december.sql

ALTER TABLE public.events
ALTER COLUMN end_time DROP NOT NULL;

COMMENT ON COLUMN public.events.end_time IS 'End time of the event. NULL means end time is unknown or variable.';

-- Migration: Add day_of_week column to events table
-- This column was missing from the migration sequence but is referenced by later migrations.
-- It must run BEFORE 20251211000005_data_validation_queries.sql which uses events.day_of_week

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS day_of_week TEXT;

COMMENT ON COLUMN public.events.day_of_week IS 'Day of week for recurring events: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday';

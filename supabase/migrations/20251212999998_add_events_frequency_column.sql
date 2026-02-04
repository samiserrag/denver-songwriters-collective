-- Migration: Add events.frequency column
--
-- CI CONTEXT:
-- Fresh-migration replay fails applying 20251213000002_venue_updates_december.sql
-- with SQLSTATE 42703 (column "frequency" does not exist).
-- That migration inserts events with a frequency column that was never created.
--
-- EVIDENCE:
-- - Original events table uses recurrence_rule (20251130000001)
-- - Migration 20251213000002 uses frequency column in INSERT statements
-- - Likely an alias or intended replacement for recurrence_rule
-- - Production DB may have been manually modified to add this column
--
-- This migration must run BEFORE 20251213000002_venue_updates_december.sql

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS frequency TEXT;

COMMENT ON COLUMN public.events.frequency IS 'Frequency of recurring events (legacy alias for recurrence_rule): weekly, biweekly, monthly, intermittent, etc.';

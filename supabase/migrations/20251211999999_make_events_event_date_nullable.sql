-- Migration: Make events.event_date nullable for recurring templates
--
-- CI CONTEXT:
-- Fresh-migration replay fails applying 20251212000001_venue_and_event_data_enrichment.sql
-- with SQLSTATE 23502 (NOT NULL violation) on public.events.event_date.
-- That migration inserts recurring event templates without event_date.
--
-- EVIDENCE:
-- - TypeScript types (database.types.ts:1121) show event_date: string | null
-- - Runtime code (nextOccurrence.ts, recurrenceContract.ts) handles null gracefully
-- - Recurrence contract: "event_date defines START of series, not ONLY date"
-- - Recurring events use day_of_week + recurrence_rule for occurrence expansion
--
-- This migration must run BEFORE 20251212000001_venue_and_event_data_enrichment.sql

ALTER TABLE public.events
ALTER COLUMN event_date DROP NOT NULL;

COMMENT ON COLUMN public.events.event_date IS 'Required for one-time events; optional for recurring templates where recurrence_rule/day_of_week define occurrences.';

-- Migration: Add unique constraint on venues.name
--
-- CI CONTEXT:
-- Fresh-migration replay fails applying 20251213000002_venue_updates_december.sql
-- with SQLSTATE 42P10 (no unique constraint matching ON CONFLICT specification).
-- That migration uses ON CONFLICT (name) but venues.name has no unique constraint.
--
-- EVIDENCE:
-- - Original venues table (20251130000001) has NO unique constraint on name
-- - Migration 20251213000002 incorrectly assumes ON CONFLICT (name) is valid
-- - Production DB may have been manually modified to add constraint
--
-- This migration must run BEFORE 20251213000002_venue_updates_december.sql

-- Add unique constraint on venues.name to support ON CONFLICT (name) clauses
ALTER TABLE public.venues
ADD CONSTRAINT venues_name_unique UNIQUE (name);

COMMENT ON CONSTRAINT venues_name_unique ON public.venues IS 'Ensures venue names are unique for ON CONFLICT upsert operations';

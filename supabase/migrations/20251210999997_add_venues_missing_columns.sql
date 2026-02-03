-- Migration: Add missing columns to venues table
-- These columns are used by 20251212000001_venue_and_event_data_enrichment.sql
-- but were never added to the venues table schema.

ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS contact_link TEXT;

COMMENT ON COLUMN public.venues.notes IS 'Internal admin notes about the venue';
COMMENT ON COLUMN public.venues.contact_link IS 'Contact email or link for the venue';

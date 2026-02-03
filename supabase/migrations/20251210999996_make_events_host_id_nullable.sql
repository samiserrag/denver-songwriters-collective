-- Migration: Make events.host_id nullable
-- The enrichment migration (20251212000001) and later migrations assume host_id can be NULL
-- for community-submitted events that don't have an assigned host yet.
-- The original schema had host_id as NOT NULL, but this was changed to support unowned events.

ALTER TABLE public.events
ALTER COLUMN host_id DROP NOT NULL;

COMMENT ON COLUMN public.events.host_id IS 'Optional host/owner of the event. NULL for community-submitted or imported events.';

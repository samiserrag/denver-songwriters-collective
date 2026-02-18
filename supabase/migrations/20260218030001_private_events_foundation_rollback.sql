-- ROLLBACK: Private Events Foundation
-- Apply this ONLY if 20260218030000_private_events_foundation.sql needs to be reverted.
-- DO NOT apply during normal operation.
--
-- Steps:
-- 1. Restore original public_read_events policy
-- 2. Drop event_attendee_invites table
-- 3. Drop visibility column from events

-- Restore original permissive read policy
DROP POLICY IF EXISTS "public_read_events" ON public.events;
CREATE POLICY "public_read_events" ON public.events
  FOR SELECT TO anon, authenticated
  USING (true);

-- Drop attendee invites table (cascades policies and indexes)
DROP TABLE IF EXISTS public.event_attendee_invites CASCADE;

-- Drop visibility indexes
DROP INDEX IF EXISTS idx_events_visibility;
DROP INDEX IF EXISTS idx_events_published_public;

-- Drop visibility column
ALTER TABLE public.events DROP COLUMN IF EXISTS visibility;

-- Drop helper function
DROP FUNCTION IF EXISTS public.update_attendee_invites_updated_at();

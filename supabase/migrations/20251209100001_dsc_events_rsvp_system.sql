-- =====================================================
-- PHASE 1: MINIMAL SCHEMA FOR DSC EVENTS + RSVP
-- =====================================================

-- =====================================================
-- CLEANUP: Drop existing policies to make idempotent
-- (Only if table exists - fresh installs won't have it)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'event_rsvps' AND relnamespace = 'public'::regnamespace) THEN
    DROP POLICY IF EXISTS "Anyone can view non-cancelled RSVPs" ON public.event_rsvps;
    DROP POLICY IF EXISTS "Users can create own RSVPs" ON public.event_rsvps;
    DROP POLICY IF EXISTS "Users can update own RSVPs" ON public.event_rsvps;
    DROP POLICY IF EXISTS "Users can delete own RSVPs" ON public.event_rsvps;
    DROP POLICY IF EXISTS "Admins can manage all RSVPs" ON public.event_rsvps;
  END IF;
END
$$;

-- =====================================================
-- SCHEMA
-- =====================================================

-- Step 1: Add columns to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS is_dsc_event boolean DEFAULT false;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS capacity integer DEFAULT NULL;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS host_notes text DEFAULT NULL;

-- Step 2: Create event_rsvps table
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
  waitlist_position integer,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Step 3: Add indexes
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON public.event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_status ON public.event_rsvps(event_id, status);
CREATE INDEX IF NOT EXISTS idx_events_dsc ON public.events(is_dsc_event) WHERE is_dsc_event = true;

-- Step 4: Enable RLS
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies
CREATE POLICY "Anyone can view non-cancelled RSVPs"
  ON public.event_rsvps FOR SELECT
  USING (status IN ('confirmed', 'waitlist'));

CREATE POLICY "Users can create own RSVPs"
  ON public.event_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own RSVPs"
  ON public.event_rsvps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own RSVPs"
  ON public.event_rsvps FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all RSVPs"
  ON public.event_rsvps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'role' = 'admin'
    )
  );

-- Step 6: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;

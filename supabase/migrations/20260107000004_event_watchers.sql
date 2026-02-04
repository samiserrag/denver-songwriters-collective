-- =====================================================
-- Phase 4.51a: Event Watchers
-- Notification backstop for unowned events
-- =====================================================

-- Create event_watchers table
CREATE TABLE IF NOT EXISTS public.event_watchers (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Index for efficient lookup by event
CREATE INDEX IF NOT EXISTS idx_event_watchers_event ON public.event_watchers(event_id);

-- Index for efficient lookup by user
CREATE INDEX IF NOT EXISTS idx_event_watchers_user ON public.event_watchers(user_id);

-- RLS policies
ALTER TABLE public.event_watchers ENABLE ROW LEVEL SECURITY;

-- Admins can manage all watchers
CREATE POLICY "Admins can manage event watchers"
  ON public.event_watchers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can view their own watcher entries
CREATE POLICY "Users can view own watcher entries"
  ON public.event_watchers FOR SELECT
  USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.event_watchers TO authenticated;

-- Comment
COMMENT ON TABLE public.event_watchers IS 'Notification backstop for unowned events - watchers receive notifications until a real host is assigned';

-- =====================================================
-- Auto-cleanup trigger: Remove watchers when host assigned
-- =====================================================

CREATE OR REPLACE FUNCTION public.cleanup_event_watchers_on_host_assign()
RETURNS TRIGGER AS $$
BEGIN
  -- When host_id changes from NULL to a value, remove all watchers
  IF OLD.host_id IS NULL AND NEW.host_id IS NOT NULL THEN
    DELETE FROM public.event_watchers WHERE event_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists (idempotent)
DROP TRIGGER IF EXISTS cleanup_watchers_on_host_assign ON public.events;

-- Create trigger
CREATE TRIGGER cleanup_watchers_on_host_assign
  AFTER UPDATE OF host_id ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_event_watchers_on_host_assign();

-- =====================================================
-- Backfill: Add Sami as watcher for all unowned events
-- UUID: a407c8e5-4f3c-4795-b199-05d824578659
-- Only runs if the profile exists (production) - skips in fresh db/CI
-- =====================================================

INSERT INTO public.event_watchers (event_id, user_id)
SELECT e.id, 'a407c8e5-4f3c-4795-b199-05d824578659'::uuid
FROM public.events e
WHERE e.host_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = 'a407c8e5-4f3c-4795-b199-05d824578659'::uuid
  )
ON CONFLICT DO NOTHING;

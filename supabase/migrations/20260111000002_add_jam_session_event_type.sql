-- Phase 4.59: Add jam_session event type
-- Jam Sessions are casual music gatherings (not DSC official)

-- Add 'jam_session' if not already in the enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'jam_session' AND enumtypid = 'event_type'::regtype) THEN
    ALTER TYPE event_type ADD VALUE 'jam_session';
  END IF;
END $$;

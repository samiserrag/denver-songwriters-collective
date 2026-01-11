-- Phase 4.56: Add new event types to enum
-- Adds: gig, meetup, kindred_group

-- PostgreSQL enums require ALTER TYPE to add values
-- These are idempotent using IF NOT EXISTS (PostgreSQL 14+)

-- Add 'gig' if not already in the enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'gig' AND enumtypid = 'event_type'::regtype) THEN
    ALTER TYPE event_type ADD VALUE 'gig';
  END IF;
END $$;

-- Add 'meetup' if not already in the enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'meetup' AND enumtypid = 'event_type'::regtype) THEN
    ALTER TYPE event_type ADD VALUE 'meetup';
  END IF;
END $$;

-- Add 'kindred_group' for Kindred Songwriter Groups
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'kindred_group' AND enumtypid = 'event_type'::regtype) THEN
    ALTER TYPE event_type ADD VALUE 'kindred_group';
  END IF;
END $$;

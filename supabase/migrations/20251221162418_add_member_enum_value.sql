-- Migration: Add 'member' enum value to user_role
-- This must be a separate migration from the one that uses it,
-- because PostgreSQL cannot use a newly added enum value in the
-- same transaction where it was added.

-- Add 'member' to user_role enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'member'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'member';
  END IF;
END $$;

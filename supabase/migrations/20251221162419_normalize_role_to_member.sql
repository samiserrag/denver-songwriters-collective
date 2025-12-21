-- Migration: Normalize profiles.role to 'member' for all non-admin users
-- Identity flags (is_songwriter, is_host, is_studio, is_fan) drive UX going forward.
-- The role column is only for access control: 'admin' vs 'member'.
-- Legacy enum values (performer, host, studio, fan) are kept but no longer used.

-- Step 1: Add 'member' to user_role enum if not exists
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

-- Step 2: Update profiles.role default to 'member'
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'member'::user_role;

-- Step 3: Update handle_new_user() trigger to use 'member' role and set is_fan = true
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role, is_fan, created_at)
  VALUES (NEW.id, NEW.email, 'member'::user_role, true, NOW());
  RETURN NEW;
END;
$function$;

-- Step 4: Temporarily disable role change trigger for migration
ALTER TABLE profiles DISABLE TRIGGER trg_prevent_role_change;

-- Step 5: Migrate all existing non-admin users to role = 'member'
-- This preserves is_songwriter, is_host, is_studio, is_fan flags which drive UX.
UPDATE profiles
SET role = 'member'::user_role
WHERE role != 'admin';

-- Step 6: Re-enable role change trigger
ALTER TABLE profiles ENABLE TRIGGER trg_prevent_role_change;

-- Verification query (run manually to confirm counts):
-- SELECT role, COUNT(*) FROM profiles GROUP BY role ORDER BY role;

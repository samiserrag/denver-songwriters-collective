-- Harden role-change protection: Remove NULL role exception
--
-- Previously, the trigger allowed role changes when OLD.role IS NULL,
-- intended for initial onboarding. This was unnecessary since:
-- 1. New users should have role set to 'performer' on insert
-- 2. The exception creates a potential attack vector if a user's role is ever NULL
--
-- This migration:
-- 1. Sets column default to 'performer'
-- 2. Updates handle_new_user() to explicitly set role = 'performer'
-- 3. Removes the NULL exception from prevent_role_change()

-- Step 1: Set column default for new inserts
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'performer'::user_role;

-- Step 2: Update handle_new_user() to set role on insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, is_fan, created_at)
  VALUES (NEW.id, NEW.email, 'performer'::user_role, true, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Harden prevent_role_change() - only admins can change role
CREATE OR REPLACE FUNCTION prevent_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow admins to change any role
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  -- Block all role changes for non-admins
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Permission denied: You cannot change your user role.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Backfill any NULL roles to 'performer' (safety net)
UPDATE profiles SET role = 'performer'::user_role WHERE role IS NULL;

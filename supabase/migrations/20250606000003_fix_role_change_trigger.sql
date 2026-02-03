-- Fix: Allow users to set their initial role during onboarding
-- The previous trigger blocked ALL role changes for non-admins,
-- including setting the role for the first time (from NULL to a value).
-- This migration allows initial role selection while still preventing
-- users from changing their role once it's been set.

CREATE OR REPLACE FUNCTION prevent_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow admins to edit anything
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  -- Allow initial role selection (when role was previously NULL)
  -- This enables new users to complete onboarding
  IF OLD.role IS NULL THEN
    RETURN NEW;
  END IF;

  -- If role was changed by non-admin after initial selection, reject
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Permission denied: You cannot change your user role.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The trigger trg_prevent_role_change already exists and references this function,
-- so we don't need to recreate the trigger - just updating the function is sufficient.

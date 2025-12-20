-- Migration: Add email column to profiles table
-- This allows easier querying of profiles by email address

-- Add email column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Create unique index on email (allows NULL values but enforces uniqueness on non-null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email) WHERE email IS NOT NULL;

-- Backfill email from auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS NULL;

-- Update the handle_new_user trigger to also copy email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_fan, created_at)
  VALUES (NEW.id, NEW.email, true, NOW());
  RETURN NEW;
END;
$$;

-- Add comment for documentation
COMMENT ON COLUMN profiles.email IS 'User email copied from auth.users for easier querying';

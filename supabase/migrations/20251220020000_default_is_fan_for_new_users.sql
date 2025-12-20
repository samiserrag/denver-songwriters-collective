-- Migration: Default is_fan = true for new users
-- Purpose: Ensure new users appear on Members page immediately after signup

-- Update the handle_new_user() trigger to set is_fan = true by default
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, is_fan, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    true,  -- Default to fan so users appear on Members page immediately
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: Set is_fan = true for existing users who have no identity flags
-- This ensures they appear on the Members page
UPDATE public.profiles
SET is_fan = true, updated_at = NOW()
WHERE is_songwriter = false
  AND is_studio = false
  AND is_host = false
  AND is_fan = false;

-- ==========================================================
-- FIX SPOTLIGHT_TYPE CONSTRAINT
-- Migration: 20251209000007_fix_spotlight_type_constraint.sql
-- ==========================================================
-- Ensures the spotlight_type constraint exists and is correct

-- Drop the constraint if it exists (to avoid duplicate errors)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS spotlight_type_check;

-- Re-add the constraint
ALTER TABLE profiles ADD CONSTRAINT spotlight_type_check
  CHECK (spotlight_type IS NULL OR spotlight_type IN ('performer', 'host', 'studio'));

-- Also update the handle_new_user function to explicitly handle new columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    created_at,
    updated_at,
    is_featured,
    featured_rank,
    is_host
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    NOW(),
    false,
    9999,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

-- Add slug column to profiles for SEO-friendly URLs
-- Format: first-last (e.g., sami-serrag)

BEGIN;

-- 1) Add nullable slug column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slug text;

-- 2) Create function to generate slug from full_name
-- SECURITY DEFINER required so auth triggers can call this function
CREATE OR REPLACE FUNCTION public.generate_profile_slug(full_name text, profile_id uuid)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 1;
BEGIN
  -- Generate base slug: lowercase first, then remove non-alphanumeric
  base_slug := regexp_replace(
    lower(coalesce(nullif(trim(full_name), ''), 'member')),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  -- Trim leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);
  -- Limit length
  base_slug := left(base_slug, 100);

  -- Check if base slug is unique
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE slug = final_slug AND id != profile_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Backfill slugs for existing profiles
UPDATE profiles
SET slug = generate_profile_slug(full_name, id)
WHERE slug IS NULL OR slug = '';

-- 4) Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_slug ON profiles (slug);

-- 5) Create trigger to auto-generate slug on insert/update
-- SECURITY DEFINER required so auth triggers can execute this function
CREATE OR REPLACE FUNCTION public.handle_profile_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate slug if not provided or if full_name changed
  IF NEW.slug IS NULL OR NEW.slug = '' OR
     (TG_OP = 'UPDATE' AND OLD.full_name IS DISTINCT FROM NEW.full_name AND NEW.slug = OLD.slug) THEN
    NEW.slug := public.generate_profile_slug(NEW.full_name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_slug_generate ON public.profiles;
CREATE TRIGGER on_profile_slug_generate
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_slug();

COMMIT;

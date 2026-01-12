-- Phase ABC4: Add friendly slugs to venues
-- Similar to profile slugs, venues get SEO-friendly URLs

-- Add slug column to venues
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS slug text;

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS venues_slug_unique ON public.venues(slug) WHERE slug IS NOT NULL;

-- Function to generate a slug from venue name
-- Handles collision by appending -2, -3, etc.
CREATE OR REPLACE FUNCTION public.generate_venue_slug(venue_name text, venue_id uuid)
RETURNS text AS $$
DECLARE
  base_slug text;
  candidate_slug text;
  counter int := 1;
BEGIN
  -- Generate base slug: lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(trim(venue_name));
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- If empty after sanitization, use 'venue'
  IF base_slug = '' THEN
    base_slug := 'venue';
  END IF;

  -- Try base slug first
  candidate_slug := base_slug;

  -- Check for collisions and append counter if needed
  WHILE EXISTS (SELECT 1 FROM public.venues WHERE slug = candidate_slug AND id != venue_id) LOOP
    counter := counter + 1;
    candidate_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN candidate_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to auto-generate slug on insert or name change
CREATE OR REPLACE FUNCTION public.venue_slug_trigger()
RETURNS trigger AS $$
BEGIN
  -- Only generate if name is set and slug is null or name changed
  IF NEW.name IS NOT NULL AND (NEW.slug IS NULL OR OLD.name IS DISTINCT FROM NEW.name) THEN
    NEW.slug := public.generate_venue_slug(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new venues and updates
DROP TRIGGER IF EXISTS venue_slug_auto ON public.venues;
CREATE TRIGGER venue_slug_auto
  BEFORE INSERT OR UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.venue_slug_trigger();

-- Backfill existing venues with slugs
UPDATE public.venues
SET slug = public.generate_venue_slug(name, id)
WHERE slug IS NULL;

-- Verify backfill
DO $$
DECLARE
  null_count int;
BEGIN
  SELECT COUNT(*) INTO null_count FROM public.venues WHERE slug IS NULL;
  IF null_count > 0 THEN
    RAISE WARNING 'There are still % venues without slugs', null_count;
  END IF;
END $$;

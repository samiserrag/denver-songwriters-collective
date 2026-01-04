-- Clean up event slugs to use title only (no UUID suffix)
-- Format: event-title (e.g., open-mic-night)
-- Handles duplicates by adding numeric suffix

BEGIN;

-- 1) Create function to generate clean slug from title
CREATE OR REPLACE FUNCTION generate_event_slug(event_title text, event_id uuid)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 1;
BEGIN
  -- Generate base slug from title
  base_slug := lower(regexp_replace(
    coalesce(nullif(trim(event_title), ''), 'event'),
    '[^a-z0-9]+',
    '-',
    'g'
  ));
  -- Trim leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);
  -- Limit length
  base_slug := left(base_slug, 100);

  -- Check if base slug is unique
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM events WHERE slug = final_slug AND id != event_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- 2) Drop existing unique index (we'll recreate after update)
DROP INDEX IF EXISTS idx_events_slug;

-- 3) Regenerate all event slugs with clean format
UPDATE events
SET slug = generate_event_slug(title, id);

-- 4) Recreate unique index
CREATE UNIQUE INDEX idx_events_slug ON events (slug);

-- 5) Create trigger to auto-generate slug on insert/update
CREATE OR REPLACE FUNCTION handle_event_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate slug if not provided or if title changed
  IF NEW.slug IS NULL OR NEW.slug = '' OR
     (TG_OP = 'UPDATE' AND OLD.title IS DISTINCT FROM NEW.title AND NEW.slug = OLD.slug) THEN
    NEW.slug := generate_event_slug(NEW.title, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_event_slug_generate ON events;
CREATE TRIGGER on_event_slug_generate
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION handle_event_slug();

COMMIT;

-- Add date suffix to slugs for single-occurrence (non-recurring) events
-- Format: event-title-yyyy-mm-dd (e.g., sloan-lake-song-circle-jam-2026-02-01)
-- Recurring events keep their existing title-only slugs
-- This prevents future conflicts when creating events with the same name on different dates

BEGIN;

-- 1) Update the slug generation function to include date for non-recurring events
CREATE OR REPLACE FUNCTION generate_event_slug(event_title text, event_id uuid, event_date date DEFAULT NULL, is_recurring boolean DEFAULT false)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 1;
BEGIN
  -- Generate base slug: lowercase first, then remove non-alphanumeric
  base_slug := regexp_replace(
    lower(coalesce(nullif(trim(event_title), ''), 'event')),
    '[^a-z0-9]+',
    '-',
    'g'
  );
  -- Trim leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);
  -- Limit length (leave room for date suffix)
  base_slug := left(base_slug, 80);

  -- For single-occurrence events (no recurrence), add date suffix
  -- This prevents slug collisions for same-named events on different dates
  IF event_date IS NOT NULL AND NOT is_recurring THEN
    base_slug := base_slug || '-' || to_char(event_date, 'YYYY-MM-DD');
  END IF;

  -- Check if base slug is unique
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM events WHERE slug = final_slug AND id != event_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- 2) Update the trigger to pass event_date and recurrence info
CREATE OR REPLACE FUNCTION handle_event_slug()
RETURNS TRIGGER AS $$
DECLARE
  is_recurring boolean;
BEGIN
  -- Determine if event is recurring (has recurrence_rule set)
  is_recurring := NEW.recurrence_rule IS NOT NULL AND NEW.recurrence_rule != '';

  -- Only generate slug if not provided or if title/date changed
  IF NEW.slug IS NULL OR NEW.slug = '' OR
     (TG_OP = 'UPDATE' AND OLD.title IS DISTINCT FROM NEW.title AND NEW.slug = OLD.slug) OR
     (TG_OP = 'UPDATE' AND OLD.event_date IS DISTINCT FROM NEW.event_date AND NOT is_recurring AND NEW.slug = OLD.slug) THEN
    NEW.slug := generate_event_slug(NEW.title, NEW.id, NEW.event_date::date, is_recurring);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Regenerate slugs for existing non-recurring events to add date suffix
-- Only events that:
-- - Have no recurrence_rule (single occurrence)
-- - Have an event_date set
UPDATE events
SET slug = generate_event_slug(title, id, event_date::date, false)
WHERE (recurrence_rule IS NULL OR recurrence_rule = '')
  AND event_date IS NOT NULL;

COMMIT;

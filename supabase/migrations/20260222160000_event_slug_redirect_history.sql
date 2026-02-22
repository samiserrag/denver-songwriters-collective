-- Preserve old event slugs so shared links keep working after title/date edits.
-- This migration adds:
-- 1) event_slug_redirects table (old_slug -> event_id)
-- 2) handle_event_slug() trigger update to record previous slugs on change

CREATE TABLE IF NOT EXISTS public.event_slug_redirects (
  old_slug TEXT PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_slug_redirects_event_id
  ON public.event_slug_redirects(event_id);

ALTER TABLE public.event_slug_redirects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_event_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  is_recurring_event BOOLEAN;
  previous_slug TEXT;
BEGIN
  is_recurring_event := COALESCE(
    NEW.recurrence_rule IS NOT NULL OR NEW.is_recurring = true,
    false
  );

  previous_slug := CASE WHEN TG_OP = 'UPDATE' THEN OLD.slug ELSE NULL END;

  -- Only generate slug if not provided or if title/date changed while slug wasn't manually edited.
  IF NEW.slug IS NULL OR NEW.slug = '' OR
     (TG_OP = 'UPDATE' AND OLD.title IS DISTINCT FROM NEW.title AND NEW.slug = OLD.slug) OR
     (TG_OP = 'UPDATE' AND OLD.event_date IS DISTINCT FROM NEW.event_date AND NOT is_recurring_event AND NEW.slug = OLD.slug) THEN
    NEW.slug := public.generate_event_slug(NEW.title, NEW.id, NEW.event_date::date, is_recurring_event);
  END IF;

  -- On slug changes, preserve the previous slug for redirect lookup.
  IF TG_OP = 'UPDATE'
     AND previous_slug IS NOT NULL
     AND previous_slug <> ''
     AND NEW.slug IS DISTINCT FROM previous_slug THEN
    INSERT INTO public.event_slug_redirects (old_slug, event_id, updated_at)
    VALUES (previous_slug, NEW.id, now())
    ON CONFLICT (old_slug) DO UPDATE
      SET event_id = EXCLUDED.event_id,
          updated_at = now();

    -- Keep all historical slugs for this event pointing at the latest slug.
    UPDATE public.event_slug_redirects
       SET updated_at = now()
     WHERE event_id = NEW.id
       AND old_slug <> NEW.slug;
  END IF;

  -- The active slug should never remain in redirect history.
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    DELETE FROM public.event_slug_redirects
     WHERE old_slug = NEW.slug;
  END IF;

  RETURN NEW;
END;
$$;

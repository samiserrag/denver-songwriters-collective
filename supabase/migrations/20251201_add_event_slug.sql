BEGIN;

-- 1) Add nullable slug column
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug text;

-- 2) Backfill slugs using title + venue city + id (guarantees uniqueness by appending id)
UPDATE events e
SET slug = lower(regexp_replace(
  coalesce(e.title, '') || ' ' || coalesce(v.city, '') || '-' || e.id,
  '[^a-z0-9]+',
  '-',
  'g'
))
FROM venues v
WHERE v.id = e.venue_id
  AND (e.slug IS NULL OR e.slug = '');

-- 3) For events without a joined venue, use title + id
UPDATE events
SET slug = lower(regexp_replace(
  coalesce(title, '') || '-' || id,
  '[^a-z0-9]+',
  '-',
  'g'
))
WHERE slug IS NULL OR slug = '';

-- 4) Trim stray hyphens and limit length
UPDATE events
SET slug = left(trim(both '-' from slug), 255)
WHERE slug IS NOT NULL;

-- 5) Ensure uniqueness (index). If a collision occurs, the appended id above prevents duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug ON events (slug);

COMMIT;

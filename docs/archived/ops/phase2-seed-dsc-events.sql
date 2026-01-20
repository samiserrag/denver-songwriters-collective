-- ============================================================================
-- Phase 2.2: Seed DSC Events for Testing
-- Purpose: Create a few DSC events so /happenings can be validated with mixed types.
-- This file is safe + auditable + includes rollback.
--
-- Investigation results (2025-12-27):
--   event_type enum: open_mic, showcase, song_circle, workshop, other
--   status values: active, unverified, needs_verification, inactive, cancelled
--   venue_id: 16c0a286-163c-49ec-8167-f22ab31f86fb (Second Dawn Brewing - Central Park)
--
-- SEED_TAG: [DSC-SEED-P2-2]
-- ============================================================================

-- --------------------------------------------------------------------------
-- INSERTS
-- --------------------------------------------------------------------------
INSERT INTO public.events (
  title,
  description,
  event_type,
  is_dsc_event,
  event_date,
  start_time,
  end_time,
  venue_id,
  is_published,
  status
) VALUES
(
  'DSC Monthly Songwriter Showcase [DSC-SEED-P2-2]',
  'Join us for our monthly showcase featuring local songwriters performing original music. Seed event for Phase 2.2 validation. [DSC-SEED-P2-2]',
  'showcase',
  true,
  CURRENT_DATE + 7,
  '19:00:00',
  '22:00:00',
  '16c0a286-163c-49ec-8167-f22ab31f86fb',
  true,
  'active'
),
(
  'Songwriting Workshop: Craft Your Chorus [DSC-SEED-P2-2]',
  'Learn techniques for writing memorable choruses with local songwriting coaches. Seed event for Phase 2.2 validation. [DSC-SEED-P2-2]',
  'workshop',
  true,
  CURRENT_DATE + 14,
  '14:00:00',
  '16:00:00',
  '16c0a286-163c-49ec-8167-f22ab31f86fb',
  true,
  'active'
),
(
  'DSC Special Night: Acoustic Sessions [DSC-SEED-P2-2]',
  'An intimate evening of acoustic performances and community connection. Seed event for Phase 2.2 validation. [DSC-SEED-P2-2]',
  'showcase',
  true,
  CURRENT_DATE + 21,
  '18:00:00',
  '21:00:00',
  '16c0a286-163c-49ec-8167-f22ab31f86fb',
  true,
  'active'
)
RETURNING id, title, event_type, is_dsc_event, event_date, status;

-- --------------------------------------------------------------------------
-- VERIFICATION
-- --------------------------------------------------------------------------
SELECT id, title, event_type, is_dsc_event, event_date, status
FROM public.events
WHERE is_dsc_event = true
ORDER BY event_date NULLS LAST, created_at DESC NULLS LAST;

-- --------------------------------------------------------------------------
-- ROLLBACK (run manually if needed)
-- --------------------------------------------------------------------------
-- DELETE FROM public.events
-- WHERE title ILIKE '%[DSC-SEED-P2-2]%' OR description ILIKE '%[DSC-SEED-P2-2]%';

-- MEDIA-EMBED-02 Phase 1.5: multi-embed ordered list table
-- Additive migration. No existing tables or columns are modified.

-- 1. Create the media_embeds table
CREATE TABLE IF NOT EXISTS public.media_embeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('event', 'event_override', 'profile')),
  target_id uuid NOT NULL,
  date_key text,
  position int NOT NULL DEFAULT 0,
  url text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('youtube', 'spotify', 'external')),
  kind text NOT NULL CHECK (kind IN ('video', 'audio', 'external')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- date_key required only for event_override, must be null otherwise
  CONSTRAINT media_embeds_date_key_check CHECK (
    (target_type = 'event_override' AND date_key IS NOT NULL)
    OR (target_type <> 'event_override' AND date_key IS NULL)
  )
);

-- 2. Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_media_embeds_target
  ON public.media_embeds (target_type, target_id, date_key);

CREATE INDEX IF NOT EXISTS idx_media_embeds_target_position
  ON public.media_embeds (target_type, target_id, date_key, position);

CREATE INDEX IF NOT EXISTS idx_media_embeds_created_by
  ON public.media_embeds (created_by);

-- 3. Enable RLS
ALTER TABLE public.media_embeds ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies

-- Public reads for profile embeds: only when profile is public
CREATE POLICY media_embeds_public_read_profile ON public.media_embeds
  FOR SELECT TO anon, authenticated
  USING (
    target_type = 'profile'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = media_embeds.target_id
        AND p.is_public = true
    )
  );

-- Public reads for event embeds: all events are publicly readable
CREATE POLICY media_embeds_public_read_event ON public.media_embeds
  FOR SELECT TO anon, authenticated
  USING (
    target_type IN ('event', 'event_override')
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = media_embeds.target_id
    )
  );

-- Owner can manage their own profile embeds
CREATE POLICY media_embeds_owner_manage_profile ON public.media_embeds
  FOR ALL TO authenticated
  USING (
    target_type = 'profile'
    AND target_id = auth.uid()
  )
  WITH CHECK (
    target_type = 'profile'
    AND target_id = auth.uid()
  );

-- Admin can manage any embeds
CREATE POLICY media_embeds_admin_manage ON public.media_embeds
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Grant table access to roles
GRANT SELECT ON public.media_embeds TO anon;
GRANT ALL ON public.media_embeds TO authenticated;

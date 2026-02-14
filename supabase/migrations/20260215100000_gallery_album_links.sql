-- ============================================================================
-- Migration: gallery_album_links
-- Purpose: Generalized link table for gallery albums to appear on
--          creator/collaborator profiles, venue pages, and event pages.
--          Supports future target types without schema changes to gallery_albums.
-- ============================================================================

-- 1) Create the link table
CREATE TABLE public.gallery_album_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id    UUID NOT NULL REFERENCES public.gallery_albums(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id   UUID NOT NULL,
  link_role   TEXT NOT NULL DEFAULT 'creator',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT gallery_album_links_target_type_check
    CHECK (target_type IN ('profile', 'venue', 'event')),

  CONSTRAINT gallery_album_links_link_role_check
    CHECK (link_role IN ('creator', 'collaborator', 'venue', 'event')),

  CONSTRAINT gallery_album_links_unique
    UNIQUE (album_id, target_type, target_id, link_role)
);

-- 2) Indexes for efficient page queries
CREATE INDEX idx_gallery_album_links_target
  ON public.gallery_album_links (target_type, target_id);

CREATE INDEX idx_gallery_album_links_album
  ON public.gallery_album_links (album_id);

-- 3) Enable RLS
ALTER TABLE public.gallery_album_links ENABLE ROW LEVEL SECURITY;

-- Public can read links only for published, non-hidden albums
CREATE POLICY "gallery_album_links_public_read"
  ON public.gallery_album_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.gallery_albums
      WHERE id = gallery_album_links.album_id
        AND is_published = true
        AND is_hidden = false
    )
  );

-- Album owner can manage links for their own albums
CREATE POLICY "gallery_album_links_owner_manage"
  ON public.gallery_album_links
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gallery_albums
      WHERE id = gallery_album_links.album_id
        AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gallery_albums
      WHERE id = gallery_album_links.album_id
        AND created_by = auth.uid()
    )
  );

-- Admin can manage all links
CREATE POLICY "gallery_album_links_admin_all"
  ON public.gallery_album_links
  FOR ALL
  TO authenticated
  USING ((select is_admin()))
  WITH CHECK ((select is_admin()));

-- 4) Table-level grants (required in addition to RLS policies)
GRANT SELECT ON public.gallery_album_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_album_links TO authenticated;

-- 5) Atomic reconcile RPC function
--    Deletes all existing links for an album and re-inserts the desired set
--    in a single transaction. If the insert fails, the delete rolls back too.
--    SECURITY INVOKER: RLS policies on gallery_album_links apply to the caller.
CREATE OR REPLACE FUNCTION public.reconcile_gallery_album_links(
  p_album_id UUID,
  p_links    JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Validate that p_links is a JSONB array
  IF jsonb_typeof(p_links) != 'array' THEN
    RAISE EXCEPTION 'p_links must be a JSONB array';
  END IF;

  -- Validate target_type / link_role consistency:
  --   venue target_type must have venue link_role
  --   event target_type must have event link_role
  --   profile target_type must have creator or collaborator link_role
  -- This prevents accidental cross-role rows.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_links) AS elem
    WHERE (
      (elem->>'target_type' = 'venue' AND elem->>'link_role' != 'venue')
      OR (elem->>'target_type' = 'event' AND elem->>'link_role' != 'event')
      OR (elem->>'target_type' = 'profile' AND elem->>'link_role' NOT IN ('creator', 'collaborator'))
    )
  ) THEN
    RAISE EXCEPTION 'target_type/link_role mismatch: venue must use venue role, event must use event role, profile must use creator or collaborator role';
  END IF;

  -- Delete all existing links for this album
  DELETE FROM public.gallery_album_links
  WHERE album_id = p_album_id;

  -- Insert the desired link set
  INSERT INTO public.gallery_album_links (album_id, target_type, target_id, link_role)
  SELECT
    p_album_id,
    elem->>'target_type',
    (elem->>'target_id')::UUID,
    elem->>'link_role'
  FROM jsonb_array_elements(p_links) AS elem
  ON CONFLICT (album_id, target_type, target_id, link_role) DO NOTHING;
END;
$$;

-- Revoke from anon, grant to authenticated only
REVOKE ALL ON FUNCTION public.reconcile_gallery_album_links(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_gallery_album_links(UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.reconcile_gallery_album_links(UUID, JSONB) TO authenticated;

-- 6) Backfill: create link rows for all existing albums (idempotent)

-- 6a) Creator links: every album gets a profile link for created_by
INSERT INTO public.gallery_album_links (album_id, target_type, target_id, link_role)
SELECT id, 'profile', created_by, 'creator'
FROM public.gallery_albums
WHERE NOT EXISTS (
  SELECT 1 FROM public.gallery_album_links gal
  WHERE gal.album_id = gallery_albums.id
    AND gal.target_type = 'profile'
    AND gal.target_id = gallery_albums.created_by
    AND gal.link_role = 'creator'
);

-- 6b) Venue links: albums with venue_id set
INSERT INTO public.gallery_album_links (album_id, target_type, target_id, link_role)
SELECT id, 'venue', venue_id, 'venue'
FROM public.gallery_albums
WHERE venue_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.gallery_album_links gal
    WHERE gal.album_id = gallery_albums.id
      AND gal.target_type = 'venue'
      AND gal.target_id = gallery_albums.venue_id
      AND gal.link_role = 'venue'
  );

-- 6c) Event links: albums with event_id set
INSERT INTO public.gallery_album_links (album_id, target_type, target_id, link_role)
SELECT id, 'event', event_id, 'event'
FROM public.gallery_albums
WHERE event_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.gallery_album_links gal
    WHERE gal.album_id = gallery_albums.id
      AND gal.target_type = 'event'
      AND gal.target_id = gallery_albums.event_id
      AND gal.link_role = 'event'
  );

-- ============================================================================
-- Migration: gallery_collaboration_invites
-- Purpose: Opt-in collaboration for gallery albums. Collaborators must accept
--          an invite before the album appears on their profile.
--          Separates invite lifecycle from display links.
-- ============================================================================

-- 1) Create the invites table
CREATE TABLE public.gallery_collaboration_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id     UUID NOT NULL REFERENCES public.gallery_albums(id) ON DELETE CASCADE,
  invitee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by   UUID NOT NULL REFERENCES public.profiles(id),
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ NULL,

  CONSTRAINT gallery_collab_invites_status_check
    CHECK (status IN ('pending', 'accepted', 'declined')),

  CONSTRAINT gallery_collab_invites_unique
    UNIQUE (album_id, invitee_id)
);

-- 2) Indexes
CREATE INDEX idx_gallery_collab_invites_invitee
  ON public.gallery_collaboration_invites (invitee_id, status);

CREATE INDEX idx_gallery_collab_invites_album
  ON public.gallery_collaboration_invites (album_id);

-- 3) Enable RLS
ALTER TABLE public.gallery_collaboration_invites ENABLE ROW LEVEL SECURITY;

-- Invitee can read their own invites
CREATE POLICY "gallery_collab_invites_invitee_read"
  ON public.gallery_collaboration_invites
  FOR SELECT
  TO authenticated
  USING (invitee_id = auth.uid());

-- Invitee can update their own invite (accept/decline)
CREATE POLICY "gallery_collab_invites_invitee_respond"
  ON public.gallery_collaboration_invites
  FOR UPDATE
  TO authenticated
  USING (invitee_id = auth.uid())
  WITH CHECK (
    invitee_id = auth.uid()
    AND status IN ('accepted', 'declined')
  );

-- Album owner can read invites for their albums
CREATE POLICY "gallery_collab_invites_owner_read"
  ON public.gallery_collaboration_invites
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gallery_albums
      WHERE id = gallery_collaboration_invites.album_id
        AND created_by = auth.uid()
    )
  );

-- Album owner can insert and delete invites for their albums
CREATE POLICY "gallery_collab_invites_owner_manage"
  ON public.gallery_collaboration_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gallery_albums
      WHERE id = gallery_collaboration_invites.album_id
        AND created_by = auth.uid()
    )
  );

CREATE POLICY "gallery_collab_invites_owner_delete"
  ON public.gallery_collaboration_invites
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gallery_albums
      WHERE id = gallery_collaboration_invites.album_id
        AND created_by = auth.uid()
    )
  );

-- Admin can manage all invites
CREATE POLICY "gallery_collab_invites_admin_all"
  ON public.gallery_collaboration_invites
  FOR ALL
  TO authenticated
  USING ((select is_admin()))
  WITH CHECK ((select is_admin()));

-- 4) Table-level grants
GRANT SELECT ON public.gallery_collaboration_invites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_collaboration_invites TO authenticated;

-- 5) Update reconcile_gallery_album_links to exclude collaborator rows
--    Collaborator links are now managed exclusively by invite accept/leave/remove flows.
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

  -- Validate target_type / link_role consistency
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_links) AS elem
    WHERE (
      (elem->>'target_type' = 'venue' AND elem->>'link_role' != 'venue')
      OR (elem->>'target_type' = 'event' AND elem->>'link_role' != 'event')
      OR (elem->>'target_type' = 'profile' AND elem->>'link_role' NOT IN ('creator', 'collaborator'))
    )
  ) THEN
    RAISE EXCEPTION 'target_type/link_role mismatch';
  END IF;

  -- Delete existing non-collaborator links only (preserve collaborator links)
  DELETE FROM public.gallery_album_links
  WHERE album_id = p_album_id
    AND link_role != 'collaborator';

  -- Insert only non-collaborator link rows (skip any collaborator rows in p_links)
  INSERT INTO public.gallery_album_links (album_id, target_type, target_id, link_role)
  SELECT
    p_album_id,
    elem->>'target_type',
    (elem->>'target_id')::UUID,
    elem->>'link_role'
  FROM jsonb_array_elements(p_links) AS elem
  WHERE elem->>'link_role' != 'collaborator'
  ON CONFLICT (album_id, target_type, target_id, link_role) DO NOTHING;
END;
$$;

-- 6) Backfill: create accepted invite rows for existing collaborator links
--    This preserves existing collaborator visibility while enabling the new opt-in flow.
INSERT INTO public.gallery_collaboration_invites (album_id, invitee_id, invited_by, status, responded_at)
SELECT
  gal.album_id,
  gal.target_id,
  ga.created_by,
  'accepted',
  gal.created_at
FROM public.gallery_album_links gal
JOIN public.gallery_albums ga ON ga.id = gal.album_id
WHERE gal.link_role = 'collaborator'
  AND gal.target_type = 'profile'
ON CONFLICT (album_id, invitee_id) DO NOTHING;

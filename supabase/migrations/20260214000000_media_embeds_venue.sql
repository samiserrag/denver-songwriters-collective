-- MEDIA-EMBED-02D: Add venue support to media_embeds
-- Additive migration. Expands CHECK constraint and adds RLS policies for venues.

-- 1. Expand target_type CHECK to include 'venue'
ALTER TABLE public.media_embeds
  DROP CONSTRAINT IF EXISTS media_embeds_target_type_check;

ALTER TABLE public.media_embeds
  ADD CONSTRAINT media_embeds_target_type_check
  CHECK (target_type IN ('event', 'event_override', 'profile', 'blog_post', 'gallery_album', 'venue'));

-- 2. RLS: Public read for venue embeds (venues are always public, no is_published gate)
CREATE POLICY media_embeds_public_read_venue ON public.media_embeds
  FOR SELECT TO anon, authenticated
  USING (target_type = 'venue');

-- 3. RLS: Venue manager/owner can manage venue embeds
--    Checks venue_managers for an active (non-revoked) grant.
--    Event hosts at venue are excluded — they edit event embeds, not venue embeds.
CREATE POLICY media_embeds_manager_manage_venue ON public.media_embeds
  FOR ALL TO authenticated
  USING (
    target_type = 'venue'
    AND EXISTS (
      SELECT 1 FROM public.venue_managers vm
      WHERE vm.venue_id = media_embeds.target_id
        AND vm.user_id = auth.uid()
        AND vm.revoked_at IS NULL
    )
  )
  WITH CHECK (
    target_type = 'venue'
    AND EXISTS (
      SELECT 1 FROM public.venue_managers vm
      WHERE vm.venue_id = media_embeds.target_id
        AND vm.user_id = auth.uid()
        AND vm.revoked_at IS NULL
    )
  );

-- Note: media_embeds_admin_manage already covers admin ALL for any target_type.
-- No additional admin policy needed.

-- MEDIA-EMBED-02B: Extend media_embeds for events, overrides, blog, gallery
-- Additive migration. Adds CHECK constraint values and new RLS policies.

-- 1. Expand target_type CHECK to include blog_post and gallery_album
ALTER TABLE public.media_embeds
  DROP CONSTRAINT IF EXISTS media_embeds_target_type_check;

ALTER TABLE public.media_embeds
  ADD CONSTRAINT media_embeds_target_type_check
  CHECK (target_type IN ('event', 'event_override', 'profile', 'blog_post', 'gallery_album'));

-- 2. RLS: Host/cohost can manage event embeds
--    Allows INSERT/UPDATE/DELETE for rows where target_type='event'
--    and user is event host_id OR accepted cohost in event_hosts OR admin.
CREATE POLICY media_embeds_host_manage_event ON public.media_embeds
  FOR ALL TO authenticated
  USING (
    target_type = 'event'
    AND (
      EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = media_embeds.target_id
          AND e.host_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.event_hosts eh
        WHERE eh.event_id = media_embeds.target_id
          AND eh.user_id = auth.uid()
          AND eh.invitation_status = 'accepted'
      )
    )
  )
  WITH CHECK (
    target_type = 'event'
    AND (
      EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = media_embeds.target_id
          AND e.host_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.event_hosts eh
        WHERE eh.event_id = media_embeds.target_id
          AND eh.user_id = auth.uid()
          AND eh.invitation_status = 'accepted'
      )
    )
  );

-- 3. RLS: Host/cohost can manage event_override embeds
--    Same host/cohost check, but for target_type='event_override'.
CREATE POLICY media_embeds_host_manage_override ON public.media_embeds
  FOR ALL TO authenticated
  USING (
    target_type = 'event_override'
    AND (
      EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = media_embeds.target_id
          AND e.host_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.event_hosts eh
        WHERE eh.event_id = media_embeds.target_id
          AND eh.user_id = auth.uid()
          AND eh.invitation_status = 'accepted'
      )
    )
  )
  WITH CHECK (
    target_type = 'event_override'
    AND (
      EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = media_embeds.target_id
          AND e.host_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.event_hosts eh
        WHERE eh.event_id = media_embeds.target_id
          AND eh.user_id = auth.uid()
          AND eh.invitation_status = 'accepted'
      )
    )
  );

-- 4. RLS: Public read for blog_post embeds (when blog post is published)
CREATE POLICY media_embeds_public_read_blog ON public.media_embeds
  FOR SELECT TO anon, authenticated
  USING (
    target_type = 'blog_post'
    AND EXISTS (
      SELECT 1 FROM public.blog_posts bp
      WHERE bp.id = media_embeds.target_id
        AND bp.is_published = true
    )
  );

-- 5. RLS: Public read for gallery_album embeds (when album is published)
CREATE POLICY media_embeds_public_read_gallery ON public.media_embeds
  FOR SELECT TO anon, authenticated
  USING (
    target_type = 'gallery_album'
    AND EXISTS (
      SELECT 1 FROM public.gallery_albums ga
      WHERE ga.id = media_embeds.target_id
        AND ga.is_published = true
    )
  );

-- Note: Admin manage policy (media_embeds_admin_manage) already covers
-- INSERT/UPDATE/DELETE for admins on all target_types including blog_post
-- and gallery_album. No additional admin policy needed.

-- Note: Grants are unchanged from the base migration:
--   anon = SELECT only
--   authenticated = SELECT, INSERT, UPDATE, DELETE
-- No additional grants needed.

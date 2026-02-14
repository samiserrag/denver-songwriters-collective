-- MEDIA-EMBED-02E: Allow blog post authors to manage their own media embeds.
-- Additive RLS policy only. Does NOT change public read or admin policies.
--
-- Pattern follows media_embeds_host_manage_event and
-- blog_gallery_images author policies (JOIN on blog_posts.author_id).

CREATE POLICY media_embeds_author_manage_blog ON public.media_embeds
  FOR ALL TO authenticated
  USING (
    target_type = 'blog_post'
    AND EXISTS (
      SELECT 1 FROM public.blog_posts bp
      WHERE bp.id = media_embeds.target_id
        AND bp.author_id = auth.uid()
    )
  )
  WITH CHECK (
    target_type = 'blog_post'
    AND EXISTS (
      SELECT 1 FROM public.blog_posts bp
      WHERE bp.id = media_embeds.target_id
        AND bp.author_id = auth.uid()
    )
  );

-- No grant changes. Existing posture:
--   anon  = SELECT only
--   authenticated = SELECT, INSERT, UPDATE, DELETE
-- No changes to media_embeds_public_read_blog or media_embeds_admin_manage.

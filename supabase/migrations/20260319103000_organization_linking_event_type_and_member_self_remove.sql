-- Friends organizations: allow direct event links and tagged-member self-removal
-- REVIEWED: policy change acknowledged

ALTER TABLE public.organization_content_links
  DROP CONSTRAINT IF EXISTS organization_content_links_link_type_check;

ALTER TABLE public.organization_content_links
  ADD CONSTRAINT organization_content_links_link_type_check
  CHECK (link_type IN ('blog_post', 'gallery_album', 'event_series', 'event'));

DROP POLICY IF EXISTS organization_content_links_select_public ON public.organization_content_links;
CREATE POLICY organization_content_links_select_public
ON public.organization_content_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = organization_content_links.organization_id
      AND o.is_active = true
      AND o.visibility = 'public'
  )
  AND (
    (
      organization_content_links.link_type = 'blog_post'
      AND EXISTS (
        SELECT 1
        FROM public.blog_posts bp
        WHERE bp.id::text = organization_content_links.target_id
          AND bp.is_published = true
      )
    )
    OR
    (
      organization_content_links.link_type = 'gallery_album'
      AND EXISTS (
        SELECT 1
        FROM public.gallery_albums ga
        WHERE ga.id::text = organization_content_links.target_id
          AND ga.is_published = true
          AND COALESCE(ga.is_hidden, false) = false
      )
    )
    OR
    (
      organization_content_links.link_type = 'event_series'
      AND EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.series_id::text = organization_content_links.target_id
          AND e.is_published = true
          AND e.visibility = 'public'
      )
    )
    OR
    (
      organization_content_links.link_type = 'event'
      AND EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id::text = organization_content_links.target_id
          AND e.is_published = true
          AND e.visibility = 'public'
      )
    )
  )
);

DROP POLICY IF EXISTS organization_member_tags_delete_self ON public.organization_member_tags;
CREATE POLICY organization_member_tags_delete_self
ON public.organization_member_tags
FOR DELETE
TO authenticated
USING (profile_id = auth.uid());

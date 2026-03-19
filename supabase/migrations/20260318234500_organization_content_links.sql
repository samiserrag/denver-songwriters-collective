-- Friends of the Collective: explicit links from organizations to CSC content
-- Adds first-class relations for blog posts, gallery albums, and hosted event series.
-- REVIEWED: policy change acknowledged

CREATE TABLE IF NOT EXISTS public.organization_content_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('blog_post', 'gallery_album', 'event_series')),
  target_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  label_override TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, link_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_org_content_links_org_sort
  ON public.organization_content_links (organization_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_org_content_links_target
  ON public.organization_content_links (link_type, target_id);

ALTER TABLE public.organization_content_links ENABLE ROW LEVEL SECURITY;

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
  )
);

DROP POLICY IF EXISTS organization_content_links_select_admin ON public.organization_content_links;
CREATE POLICY organization_content_links_select_admin
ON public.organization_content_links
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS organization_content_links_manage_admin ON public.organization_content_links;
CREATE POLICY organization_content_links_manage_admin
ON public.organization_content_links
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS organization_content_links_select_manager ON public.organization_content_links;
CREATE POLICY organization_content_links_select_manager
ON public.organization_content_links
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_content_links.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
);

DROP POLICY IF EXISTS organization_content_links_insert_manager ON public.organization_content_links;
CREATE POLICY organization_content_links_insert_manager
ON public.organization_content_links
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_content_links.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
);

DROP POLICY IF EXISTS organization_content_links_update_manager ON public.organization_content_links;
CREATE POLICY organization_content_links_update_manager
ON public.organization_content_links
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_content_links.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_content_links.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
);

DROP POLICY IF EXISTS organization_content_links_delete_manager ON public.organization_content_links;
CREATE POLICY organization_content_links_delete_manager
ON public.organization_content_links
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_content_links.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
);

CREATE OR REPLACE FUNCTION public.update_organization_content_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_content_links_updated_at ON public.organization_content_links;
CREATE TRIGGER organization_content_links_updated_at
  BEFORE UPDATE ON public.organization_content_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_content_links_updated_at();

GRANT ALL ON public.organization_content_links TO service_role;

COMMENT ON TABLE public.organization_content_links IS
  'Curated links from organizations to related CSC blog posts, gallery albums, and hosted event series.';

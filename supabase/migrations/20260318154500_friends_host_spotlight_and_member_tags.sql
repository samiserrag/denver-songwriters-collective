-- Friends of the Collective: host spotlight reasons + organization member tags
-- REVIEWED: policy change acknowledged

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS host_spotlight_reason TEXT;

COMMENT ON COLUMN public.profiles.host_spotlight_reason IS
  'Admin-authored reason shown when a host is spotlighted on Friends of the Collective.';

CREATE TABLE IF NOT EXISTS public.organization_member_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  tag_reason TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_org_member_tags_org_sort
  ON public.organization_member_tags (organization_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_org_member_tags_profile
  ON public.organization_member_tags (profile_id);

ALTER TABLE public.organization_member_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_member_tags_select_public ON public.organization_member_tags;
CREATE POLICY organization_member_tags_select_public
ON public.organization_member_tags
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = organization_member_tags.organization_id
      AND o.is_active = true
      AND o.visibility = 'public'
  )
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = organization_member_tags.profile_id
      AND p.is_public = true
  )
);

DROP POLICY IF EXISTS organization_member_tags_select_admin ON public.organization_member_tags;
CREATE POLICY organization_member_tags_select_admin
ON public.organization_member_tags
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS organization_member_tags_manage_admin ON public.organization_member_tags;
CREATE POLICY organization_member_tags_manage_admin
ON public.organization_member_tags
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS organization_member_tags_select_manager ON public.organization_member_tags;
CREATE POLICY organization_member_tags_select_manager
ON public.organization_member_tags
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_member_tags.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
);

DROP POLICY IF EXISTS organization_member_tags_insert_manager ON public.organization_member_tags;
CREATE POLICY organization_member_tags_insert_manager
ON public.organization_member_tags
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_member_tags.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
);

DROP POLICY IF EXISTS organization_member_tags_update_manager ON public.organization_member_tags;
CREATE POLICY organization_member_tags_update_manager
ON public.organization_member_tags
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_member_tags.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_member_tags.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
);

DROP POLICY IF EXISTS organization_member_tags_delete_manager ON public.organization_member_tags;
CREATE POLICY organization_member_tags_delete_manager
ON public.organization_member_tags
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_member_tags.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
);

CREATE OR REPLACE FUNCTION public.update_organization_member_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_member_tags_updated_at ON public.organization_member_tags;
CREATE TRIGGER organization_member_tags_updated_at
  BEFORE UPDATE ON public.organization_member_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_member_tags_updated_at();

GRANT ALL ON public.organization_member_tags TO service_role;

COMMENT ON TABLE public.organization_member_tags IS
  'Links organizations to tagged members for Friends of the Collective cards.';

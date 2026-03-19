-- ==========================================================
-- Migration: organization_images table + storage policies
-- ==========================================================
-- Adds upload-managed photos for Friends of the Collective organizations.
-- Mirrors profile/venue photo workflows:
-- - multiple photos
-- - soft delete
-- - RLS for managers/admins
-- - storage path: avatars/organizations/{organization_id}/*
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.organization_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_organization_images_org_created
  ON public.organization_images (organization_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_organization_images_org_active
  ON public.organization_images (organization_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.organization_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization managers can view organization images" ON public.organization_images;
CREATE POLICY "Organization managers can view organization images"
  ON public.organization_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_managers om
      WHERE om.organization_id = organization_images.organization_id
        AND om.user_id = auth.uid()
        AND om.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admins can view organization images" ON public.organization_images;
CREATE POLICY "Admins can view organization images"
  ON public.organization_images FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Public can view active organization images" ON public.organization_images;
CREATE POLICY "Public can view active organization images"
  ON public.organization_images FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Authenticated can view active organization images" ON public.organization_images;
CREATE POLICY "Authenticated can view active organization images"
  ON public.organization_images FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Organization managers can insert organization images" ON public.organization_images;
CREATE POLICY "Organization managers can insert organization images"
  ON public.organization_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_managers om
      WHERE om.organization_id = organization_images.organization_id
        AND om.user_id = auth.uid()
        AND om.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admins can insert organization images" ON public.organization_images;
CREATE POLICY "Admins can insert organization images"
  ON public.organization_images FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Organization managers can update organization images" ON public.organization_images;
CREATE POLICY "Organization managers can update organization images"
  ON public.organization_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_managers om
      WHERE om.organization_id = organization_images.organization_id
        AND om.user_id = auth.uid()
        AND om.revoked_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_managers om
      WHERE om.organization_id = organization_images.organization_id
        AND om.user_id = auth.uid()
        AND om.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admins can update organization images" ON public.organization_images;
CREATE POLICY "Admins can update organization images"
  ON public.organization_images FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Organization managers can delete organization images" ON public.organization_images;
CREATE POLICY "Organization managers can delete organization images"
  ON public.organization_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_managers om
      WHERE om.organization_id = organization_images.organization_id
        AND om.user_id = auth.uid()
        AND om.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admins can delete organization images" ON public.organization_images;
CREATE POLICY "Admins can delete organization images"
  ON public.organization_images FOR DELETE
  TO authenticated
  USING (is_admin());

-- ==========================================================
-- Storage policies for avatars/organizations/{organization_id}/*
-- ==========================================================

DROP POLICY IF EXISTS "Organization managers can upload organization images" ON storage.objects;
CREATE POLICY "Organization managers can upload organization images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'organizations'
    AND EXISTS (
      SELECT 1
      FROM public.organization_managers om
      WHERE om.organization_id = (storage.foldername(name))[2]::uuid
        AND om.user_id = auth.uid()
        AND om.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admins can upload organization images" ON storage.objects;
CREATE POLICY "Admins can upload organization images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'organizations'
    AND is_admin()
  );

DROP POLICY IF EXISTS "Organization managers can delete organization images" ON storage.objects;
CREATE POLICY "Organization managers can delete organization images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'organizations'
    AND EXISTS (
      SELECT 1
      FROM public.organization_managers om
      WHERE om.organization_id = (storage.foldername(name))[2]::uuid
        AND om.user_id = auth.uid()
        AND om.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admins can delete organization images" ON storage.objects;
CREATE POLICY "Admins can delete organization images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'organizations'
    AND is_admin()
  );

COMMENT ON TABLE public.organization_images IS
  'Upload-managed image gallery for Friends of the Collective organization profiles.';

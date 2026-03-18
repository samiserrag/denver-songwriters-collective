-- Phase 3: Organization invite links for manager/owner access
-- REVIEWED: policy change acknowledged
--
-- Adds token-based invite flow for organizations so existing managers/admins
-- can invite teammates to self-manage profiles.

CREATE TABLE IF NOT EXISTS public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  email_restriction TEXT,
  role_to_grant TEXT NOT NULL DEFAULT 'manager' CHECK (role_to_grant IN ('owner', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id),
  revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_organization_invites_token_hash
  ON public.organization_invites(token_hash);

CREATE INDEX IF NOT EXISTS idx_organization_invites_organization_id
  ON public.organization_invites(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_invites_active
  ON public.organization_invites(organization_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_manage_organization_invites ON public.organization_invites;
CREATE POLICY admins_manage_organization_invites
ON public.organization_invites
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS managers_manage_organization_invites ON public.organization_invites;
CREATE POLICY managers_manage_organization_invites
ON public.organization_invites
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_invites.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organization_invites.organization_id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
);

CREATE OR REPLACE FUNCTION public.update_organization_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_invites_updated_at ON public.organization_invites;
CREATE TRIGGER organization_invites_updated_at
  BEFORE UPDATE ON public.organization_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_invites_updated_at();

GRANT ALL ON public.organization_invites TO service_role;

COMMENT ON TABLE public.organization_invites IS
  'Token-based invite links for adding organization managers/owners.';

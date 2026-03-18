-- Phase 2: Organization claim + self-management workflow
-- Adds:
-- - organization_managers: grants users owner/manager access to org profiles
-- - organization_claims: pending/approved/rejected/cancelled claim requests
-- - manager update/select policies on organizations

CREATE TABLE IF NOT EXISTS public.organization_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  grant_method TEXT NOT NULL CHECK (grant_method IN ('claim', 'invite', 'admin')),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_reason TEXT,
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_managers_org_id
  ON public.organization_managers(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_managers_user_id
  ON public.organization_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_org_managers_active
  ON public.organization_managers(organization_id, user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.organization_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_managers_select_own ON public.organization_managers;
CREATE POLICY organization_managers_select_own
ON public.organization_managers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS organization_managers_select_admin ON public.organization_managers;
CREATE POLICY organization_managers_select_admin
ON public.organization_managers
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS organization_managers_manage_admin ON public.organization_managers;
CREATE POLICY organization_managers_manage_admin
ON public.organization_managers
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.organization_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_claims_org_id
  ON public.organization_claims(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_claims_requester_id
  ON public.organization_claims(requester_id);
CREATE INDEX IF NOT EXISTS idx_org_claims_status
  ON public.organization_claims(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_claims_pending_unique
  ON public.organization_claims(organization_id, requester_id)
  WHERE status = 'pending';

ALTER TABLE public.organization_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_claims_select_own ON public.organization_claims;
CREATE POLICY organization_claims_select_own
ON public.organization_claims
FOR SELECT
TO authenticated
USING (requester_id = auth.uid());

DROP POLICY IF EXISTS organization_claims_insert_own ON public.organization_claims;
CREATE POLICY organization_claims_insert_own
ON public.organization_claims
FOR INSERT
TO authenticated
WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS organization_claims_cancel_own ON public.organization_claims;
CREATE POLICY organization_claims_cancel_own
ON public.organization_claims
FOR UPDATE
TO authenticated
USING (requester_id = auth.uid() AND status = 'pending')
WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS organization_claims_select_admin ON public.organization_claims;
CREATE POLICY organization_claims_select_admin
ON public.organization_claims
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS organization_claims_update_admin ON public.organization_claims;
CREATE POLICY organization_claims_update_admin
ON public.organization_claims
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Allow org managers to view and update organizations they actively manage.
DROP POLICY IF EXISTS organizations_select_manager ON public.organizations;
CREATE POLICY organizations_select_manager
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
);

DROP POLICY IF EXISTS organizations_update_manager ON public.organizations;
CREATE POLICY organizations_update_manager
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_managers om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.revoked_at IS NULL
  )
);

CREATE OR REPLACE FUNCTION public.update_organization_managers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_managers_updated_at ON public.organization_managers;
CREATE TRIGGER organization_managers_updated_at
  BEFORE UPDATE ON public.organization_managers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_managers_updated_at();

CREATE OR REPLACE FUNCTION public.update_organization_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_claims_updated_at ON public.organization_claims;
CREATE TRIGGER organization_claims_updated_at
  BEFORE UPDATE ON public.organization_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_claims_updated_at();

GRANT ALL ON public.organization_managers TO service_role;
GRANT ALL ON public.organization_claims TO service_role;

COMMENT ON TABLE public.organization_managers IS
  'Access grants for users who can manage organization profiles.';

COMMENT ON TABLE public.organization_claims IS
  'Claim requests from members who want to manage an organization profile.';

-- =====================================================
-- PHASE ABC8: VENUE CLAIMING SYSTEM
-- =====================================================
-- Enables users to claim venue ownership (admin-approved),
-- admin-issued invite links, and multi-manager support.
--
-- Tables created:
--   1. venue_managers - active access grants with roles
--   2. venue_claims - user claim requests (pending/approved/rejected)
--   3. venue_invites - admin-issued invite tokens
--
-- Policy decisions (locked):
--   - Ownership transfer: admin-only
--   - Event host priority: no auto-approval
--   - Multiple owners: allowed
--   - Dashboard: /dashboard/my-venues

-- =====================================================
-- CLEANUP: Drop existing policies to make idempotent
-- =====================================================
DROP POLICY IF EXISTS "Users can view own venue access" ON public.venue_managers;
DROP POLICY IF EXISTS "Admins can manage all venue managers" ON public.venue_managers;
DROP POLICY IF EXISTS "Users can create own venue claims" ON public.venue_claims;
DROP POLICY IF EXISTS "Users can view own venue claims" ON public.venue_claims;
DROP POLICY IF EXISTS "Users can cancel own pending venue claims" ON public.venue_claims;
DROP POLICY IF EXISTS "Admins can manage all venue claims" ON public.venue_claims;
DROP POLICY IF EXISTS "Admins can manage all venue invites" ON public.venue_invites;

-- =====================================================
-- TABLE 1: venue_managers
-- =====================================================
-- Active access grants; supports multiple owners/managers per venue.
-- Soft-delete via revoked_at for audit trail.

CREATE TABLE IF NOT EXISTS public.venue_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'manager')),
  grant_method text NOT NULL CHECK (grant_method IN ('claim', 'invite', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz NULL,
  revoked_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_reason text NULL
);

-- Partial unique index: only one active grant per (venue_id, user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_managers_active_unique
ON public.venue_managers(venue_id, user_id) WHERE revoked_at IS NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_venue_managers_venue_id
ON public.venue_managers(venue_id);

CREATE INDEX IF NOT EXISTS idx_venue_managers_user_id
ON public.venue_managers(user_id);

CREATE INDEX IF NOT EXISTS idx_venue_managers_venue_active
ON public.venue_managers(venue_id, revoked_at);

-- =====================================================
-- TABLE 2: venue_claims
-- =====================================================
-- User-initiated claim requests, admin-approved.
-- Mirrors event_claims structure.

CREATE TABLE IF NOT EXISTS public.venue_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  rejection_reason text NULL,
  cancelled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: only one pending claim per (venue_id, requester_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_claims_pending_unique
ON public.venue_claims(venue_id, requester_id) WHERE status = 'pending';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_venue_claims_status
ON public.venue_claims(status);

CREATE INDEX IF NOT EXISTS idx_venue_claims_venue_id
ON public.venue_claims(venue_id);

CREATE INDEX IF NOT EXISTS idx_venue_claims_requester_id
ON public.venue_claims(requester_id);

-- =====================================================
-- TABLE 3: venue_invites
-- =====================================================
-- Admin-issued invite tokens with expiration.
-- Token stored as hash for security; plaintext shown once.

CREATE TABLE IF NOT EXISTS public.venue_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  email_restriction text NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz NULL,
  accepted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz NULL,
  revoked_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_reason text NULL
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_venue_invites_venue_id
ON public.venue_invites(venue_id);

CREATE INDEX IF NOT EXISTS idx_venue_invites_expires_at
ON public.venue_invites(expires_at);

-- Partial index for active invites lookup
CREATE INDEX IF NOT EXISTS idx_venue_invites_active
ON public.venue_invites(venue_id) WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- =====================================================
-- RLS POLICIES: venue_managers
-- =====================================================
ALTER TABLE public.venue_managers ENABLE ROW LEVEL SECURITY;

-- Users can view their own venue access grants
CREATE POLICY "Users can view own venue access"
  ON public.venue_managers FOR SELECT
  USING (user_id = auth.uid());

-- Admins can manage all venue managers
CREATE POLICY "Admins can manage all venue managers"
  ON public.venue_managers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES: venue_claims
-- =====================================================
ALTER TABLE public.venue_claims ENABLE ROW LEVEL SECURITY;

-- Users can create their own claims (requester_id must match auth.uid())
CREATE POLICY "Users can create own venue claims"
  ON public.venue_claims FOR INSERT
  WITH CHECK (requester_id = auth.uid());

-- Users can view their own claims
CREATE POLICY "Users can view own venue claims"
  ON public.venue_claims FOR SELECT
  USING (requester_id = auth.uid());

-- Users can cancel their own pending claims only
CREATE POLICY "Users can cancel own pending venue claims"
  ON public.venue_claims FOR UPDATE
  USING (
    requester_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    requester_id = auth.uid()
    AND status = 'cancelled'
    AND cancelled_at IS NOT NULL
  );

-- Admins can manage all claims
CREATE POLICY "Admins can manage all venue claims"
  ON public.venue_claims FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- =====================================================
-- RLS POLICIES: venue_invites
-- =====================================================
ALTER TABLE public.venue_invites ENABLE ROW LEVEL SECURITY;

-- Only admins can access invite records
-- (Invite redemption happens via API which checks token hash)
CREATE POLICY "Admins can manage all venue invites"
  ON public.venue_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- =====================================================
-- GRANTS
-- =====================================================
-- venue_managers: users need SELECT for their own, INSERT/UPDATE via admin RLS
GRANT SELECT ON public.venue_managers TO authenticated;
GRANT INSERT, UPDATE ON public.venue_managers TO authenticated;

-- venue_claims: users need INSERT/SELECT/UPDATE for claims
GRANT SELECT, INSERT, UPDATE ON public.venue_claims TO authenticated;

-- venue_invites: admin-only via RLS, but need grants for authenticated to hit policies
GRANT SELECT, INSERT, UPDATE ON public.venue_invites TO authenticated;

-- =====================================================
-- TRIGGER: Updated at timestamp for venue_claims
-- =====================================================
-- Note: venue_claims doesn't have updated_at column to keep it simple
-- If needed later, add column and trigger

-- =====================================================
-- COMMENTS for documentation
-- =====================================================
COMMENT ON TABLE public.venue_managers IS 'ABC8: Active venue access grants with owner/manager roles';
COMMENT ON TABLE public.venue_claims IS 'ABC8: User-initiated venue ownership claims (admin-approved)';
COMMENT ON TABLE public.venue_invites IS 'ABC8: Admin-issued venue invite tokens with expiration';

COMMENT ON COLUMN public.venue_managers.role IS 'owner or manager - owners can add/remove managers';
COMMENT ON COLUMN public.venue_managers.grant_method IS 'How access was granted: claim (approved), invite (accepted), or admin (direct)';
COMMENT ON COLUMN public.venue_managers.revoked_at IS 'Soft-delete timestamp; NULL = active access';

COMMENT ON COLUMN public.venue_claims.status IS 'pending, approved, rejected, or cancelled (by user)';
COMMENT ON COLUMN public.venue_claims.cancelled_at IS 'Set when user cancels their own pending claim';

COMMENT ON COLUMN public.venue_invites.token_hash IS 'SHA-256 hash of invite token; plaintext shown once to admin';
COMMENT ON COLUMN public.venue_invites.email_restriction IS 'If set, only this email (lowercased) can accept invite';
COMMENT ON COLUMN public.venue_invites.expires_at IS 'Invite expires after this time (default 7 days from creation)';

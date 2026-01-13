-- ABC8: Venue Claiming, Admin Approval, and Invite Links
--
-- BACKFILL NOTE: This migration was backfilled into the repo after the schema
-- was applied directly to the database. Applied to production: January 2026.
--
-- This migration creates the venue ownership model with:
-- - venue_managers: Links users to venues with roles (owner/manager)
-- - venue_claims: Tracks ownership claim requests
-- - venue_invites: Admin-issued invite tokens for granting access

-- ============================================================================
-- Table: venue_managers
-- ============================================================================
-- Links users to venues they manage. Supports multiple managers per venue.
-- Soft-delete via revoked_at for audit trail.

CREATE TABLE IF NOT EXISTS venue_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager')),

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- How they got access
  created_by UUID REFERENCES profiles(id),
  grant_method TEXT NOT NULL CHECK (grant_method IN ('claim', 'invite', 'admin')),

  -- Revocation (soft-delete)
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),
  revoked_reason TEXT,

  -- Prevent duplicate active grants
  UNIQUE(venue_id, user_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_venue_managers_venue_id ON venue_managers(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_managers_user_id ON venue_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_managers_active ON venue_managers(venue_id, user_id)
  WHERE revoked_at IS NULL;

-- RLS Policies
ALTER TABLE venue_managers ENABLE ROW LEVEL SECURITY;

-- Users can see their own grants
CREATE POLICY "users_see_own_grants" ON venue_managers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can see all grants
CREATE POLICY "admins_see_all_grants" ON venue_managers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins/service role can insert/update/delete
CREATE POLICY "admins_manage_grants" ON venue_managers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- Table: venue_claims
-- ============================================================================
-- Tracks venue ownership claim requests. Users submit claims, admins review.

CREATE TABLE IF NOT EXISTS venue_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,  -- User's claim justification

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  rejection_reason TEXT,

  -- Review tracking
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),

  -- Cancellation tracking
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_venue_claims_venue_id ON venue_claims(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_claims_requester_id ON venue_claims(requester_id);
CREATE INDEX IF NOT EXISTS idx_venue_claims_status ON venue_claims(status);
CREATE INDEX IF NOT EXISTS idx_venue_claims_pending ON venue_claims(venue_id, requester_id)
  WHERE status = 'pending';

-- RLS Policies
ALTER TABLE venue_claims ENABLE ROW LEVEL SECURITY;

-- Users can see their own claims
CREATE POLICY "users_see_own_claims" ON venue_claims
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid());

-- Users can create their own claims
CREATE POLICY "users_create_own_claims" ON venue_claims
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- Users can update their own pending claims (cancel)
CREATE POLICY "users_cancel_own_claims" ON venue_claims
  FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() AND status = 'pending')
  WITH CHECK (requester_id = auth.uid());

-- Admins can see all claims
CREATE POLICY "admins_see_all_claims" ON venue_claims
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update any claim (approve/reject)
CREATE POLICY "admins_update_claims" ON venue_claims
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- Table: venue_invites
-- ============================================================================
-- Admin-issued invite tokens for granting venue access.
-- Token is hashed (SHA-256) - plaintext shown only once at creation.

CREATE TABLE IF NOT EXISTS venue_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  -- Token (stored as hash, plaintext never persisted)
  token_hash TEXT NOT NULL UNIQUE,

  -- Optional email restriction
  email_restriction TEXT,

  -- Role granted on acceptance (managers by default)
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('owner', 'manager')),

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',

  -- Acceptance
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES profiles(id),

  -- Revocation
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),
  revoked_reason TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_venue_invites_venue_id ON venue_invites(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_invites_token_hash ON venue_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_venue_invites_active ON venue_invites(venue_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- RLS Policies
ALTER TABLE venue_invites ENABLE ROW LEVEL SECURITY;

-- Admins can see all invites
CREATE POLICY "admins_see_all_invites" ON venue_invites
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Anyone can look up an invite by token_hash (for acceptance)
CREATE POLICY "anyone_can_lookup_by_token" ON venue_invites
  FOR SELECT TO authenticated
  USING (TRUE);

-- Only admins can create invites
CREATE POLICY "admins_create_invites" ON venue_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update invites (revoke)
-- Authenticated users can update to accept (accepted_by = auth.uid())
CREATE POLICY "update_invites" ON venue_invites
  FOR UPDATE TO authenticated
  USING (TRUE)
  WITH CHECK (
    -- Admin can do anything
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Non-admin can only set accepted_at/accepted_by to claim
    (accepted_by = auth.uid() AND accepted_at IS NOT NULL)
  );

-- ============================================================================
-- Grants for service role (used by API routes)
-- ============================================================================
-- Service role bypasses RLS, so these ensure the tables are accessible

GRANT ALL ON venue_managers TO service_role;
GRANT ALL ON venue_claims TO service_role;
GRANT ALL ON venue_invites TO service_role;

-- ============================================================================
-- Update triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_venue_managers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER venue_managers_updated_at
  BEFORE UPDATE ON venue_managers
  FOR EACH ROW
  EXECUTE FUNCTION update_venue_managers_updated_at();

CREATE OR REPLACE FUNCTION update_venue_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER venue_claims_updated_at
  BEFORE UPDATE ON venue_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_venue_claims_updated_at();

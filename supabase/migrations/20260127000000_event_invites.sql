-- Phase 4.94: Event Invites v1
--
-- Token-based invite system for events (parity with venue_invites).
-- Allows admins and primary hosts to invite users to become hosts or co-hosts.
--
-- Key constraints:
-- - Primary owner = events.host_id (single owner)
-- - Collaborators = event_hosts (role host|cohost)
-- - role_to_grant='host' only succeeds when events.host_id IS NULL
-- - Invite expiry blocks acceptance only; does NOT remove access after acceptance
-- - Token is stored as SHA-256 hash; plaintext shown only once at creation

-- ============================================================================
-- Table: event_invites
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- Token (stored as hash, plaintext never persisted)
  token_hash TEXT NOT NULL UNIQUE,

  -- Optional email restriction
  email_restriction TEXT,

  -- Role granted on acceptance
  role_to_grant TEXT NOT NULL DEFAULT 'cohost'
    CHECK (role_to_grant IN ('host', 'cohost')),

  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  -- Acceptance
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id),

  -- Revocation (soft-delete pattern)
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id),
  revoked_reason TEXT
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_event_invites_token_hash
  ON public.event_invites(token_hash);

CREATE INDEX IF NOT EXISTS idx_event_invites_event_id
  ON public.event_invites(event_id);

CREATE INDEX IF NOT EXISTS idx_event_invites_active
  ON public.event_invites(event_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ============================================================================
-- RLS Policies
-- ============================================================================
-- Security model:
-- - No public SELECT-by-token policy (acceptance uses service role)
-- - Only admin and primary host can manage invites
-- - Email restriction validated in API, not RLS (avoids auth.users leakage)

ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "admins_manage_event_invites" ON public.event_invites
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Primary host can manage invites for their own events
CREATE POLICY "primary_host_manage_event_invites" ON public.event_invites
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_invites.event_id
      AND events.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_invites.event_id
      AND events.host_id = auth.uid()
    )
  );

-- ============================================================================
-- Grants for service role (used by API routes)
-- ============================================================================
-- Service role bypasses RLS for token lookup during acceptance

GRANT ALL ON public.event_invites TO service_role;

-- ============================================================================
-- Update trigger for consistency (optional but good practice)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_event_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- No updated_at column in this table, but keeping pattern for future
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

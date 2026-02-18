-- PR2: Private Events Foundation
--
-- Adds visibility column to events and creates event_attendee_invites table.
-- Replaces the permissive public_read_events RLS policy with a visibility-aware policy.
--
-- Key design decisions:
-- - Default visibility is 'public' (zero behavior change for existing events)
-- - event_attendee_invites is separate from event_invites (different access plane:
--   event_invites = host/cohost role assignment, event_attendee_invites = visibility gating)
-- - Co-hosts CANNOT create attendee invites (host/admin only, per Sami decision)
-- - Max 200 invites per event enforced at application layer, not DB constraint
-- - Non-member token cookie duration: 24 hours (enforced at application layer)
--
-- Rollback: See _archived/20260218030001_private_events_foundation_rollback.sql
--
-- @see docs/investigation/private-invite-only-events-stopgate.md

-- ============================================================================
-- 1. Add visibility column to events
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'invite_only'));

-- Index for filtering public events in discovery queries
CREATE INDEX IF NOT EXISTS idx_events_visibility
  ON public.events(visibility);

-- Composite index for common discovery query: published + public
CREATE INDEX IF NOT EXISTS idx_events_published_public
  ON public.events(is_published, visibility)
  WHERE is_published = true AND visibility = 'public';

-- ============================================================================
-- 2. Create event_attendee_invites table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_attendee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- Invite target (at least one must be non-null)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  CONSTRAINT invite_target_required CHECK (user_id IS NOT NULL OR email IS NOT NULL),

  -- Token for email-based access (stored as SHA-256 hash)
  token_hash TEXT UNIQUE,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id),

  -- Prevent duplicate invites per member or email per event
  UNIQUE (event_id, user_id),
  UNIQUE (event_id, email)
);

-- ============================================================================
-- 3. Indexes for event_attendee_invites
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_attendee_invites_event_id
  ON public.event_attendee_invites(event_id);

CREATE INDEX IF NOT EXISTS idx_attendee_invites_user_id
  ON public.event_attendee_invites(user_id);

CREATE INDEX IF NOT EXISTS idx_attendee_invites_token_hash
  ON public.event_attendee_invites(token_hash);

CREATE INDEX IF NOT EXISTS idx_attendee_invites_email
  ON public.event_attendee_invites(email);

-- Active invites (not yet accepted/revoked/expired) for management queries
CREATE INDEX IF NOT EXISTS idx_attendee_invites_active
  ON public.event_attendee_invites(event_id)
  WHERE status = 'pending';

-- Accepted invites for RLS visibility check (hot path)
CREATE INDEX IF NOT EXISTS idx_attendee_invites_accepted
  ON public.event_attendee_invites(event_id, user_id)
  WHERE status = 'accepted';

-- ============================================================================
-- 4. Enable RLS on event_attendee_invites
-- ============================================================================

ALTER TABLE public.event_attendee_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS Policies for event_attendee_invites
-- ============================================================================

-- Admins: full access
CREATE POLICY "admins_manage_attendee_invites" ON public.event_attendee_invites
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

-- Hosts: manage invites for their own events (host/admin only; co-hosts excluded)
CREATE POLICY "host_manage_attendee_invites" ON public.event_attendee_invites
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_attendee_invites.event_id
      AND events.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_attendee_invites.event_id
      AND events.host_id = auth.uid()
    )
  );

-- Invitees: read own invites
CREATE POLICY "invitee_read_own_attendee_invites" ON public.event_attendee_invites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Invitees: respond to own invites (accept/decline)
CREATE POLICY "invitee_respond_attendee_invites" ON public.event_attendee_invites
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 6. Replace public_read_events with visibility-aware policy
-- ============================================================================

-- Drop the existing permissive "read all" policy
DROP POLICY IF EXISTS "public_read_events" ON public.events;

-- New visibility-aware policy:
-- - Public events: visible to everyone (anon + authenticated)
-- - Invite-only events: visible to host, accepted co-hosts, accepted invitees, admins
CREATE POLICY "public_read_events" ON public.events
  FOR SELECT TO anon, authenticated
  USING (
    -- Public events: visible to everyone
    visibility = 'public'
    OR
    -- Invite-only: visible to the primary host
    (visibility = 'invite_only' AND host_id = auth.uid())
    OR
    -- Invite-only: visible to accepted co-hosts
    (visibility = 'invite_only' AND EXISTS (
      SELECT 1 FROM public.event_hosts
      WHERE event_hosts.event_id = events.id
      AND event_hosts.user_id = auth.uid()
      AND event_hosts.invitation_status = 'accepted'
    ))
    OR
    -- Invite-only: visible to accepted attendee invitees
    (visibility = 'invite_only' AND EXISTS (
      SELECT 1 FROM public.event_attendee_invites
      WHERE event_attendee_invites.event_id = events.id
      AND event_attendee_invites.user_id = auth.uid()
      AND event_attendee_invites.status = 'accepted'
    ))
    OR
    -- Admins see everything
    (visibility = 'invite_only' AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    ))
  );

-- ============================================================================
-- 7. Grants for service role (used by API routes for token-based access)
-- ============================================================================

GRANT ALL ON public.event_attendee_invites TO service_role;

-- ============================================================================
-- 8. Updated_at trigger
-- ============================================================================

-- Reuse the generic update timestamp trigger pattern
CREATE OR REPLACE FUNCTION public.update_attendee_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- No updated_at column needed for invites (lifecycle tracked via status + timestamps)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

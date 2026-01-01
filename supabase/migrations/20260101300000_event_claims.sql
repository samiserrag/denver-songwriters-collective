-- =====================================================
-- PHASE 4.22.3: EVENT CLAIMS SYSTEM
-- =====================================================
-- Allows users to request ownership of unclaimed events
-- (events where host_id IS NULL). Admins can approve/reject.

-- =====================================================
-- CLEANUP: Drop existing policies to make idempotent
-- =====================================================
DROP POLICY IF EXISTS "Users can create own claims" ON public.event_claims;
DROP POLICY IF EXISTS "Users can view own claims" ON public.event_claims;
DROP POLICY IF EXISTS "Admins can manage all claims" ON public.event_claims;

-- =====================================================
-- TABLE: event_claims
-- =====================================================
CREATE TABLE IF NOT EXISTS public.event_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Partial unique index: only one pending claim per (event_id, requester_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_claims_pending_unique
ON public.event_claims(event_id, requester_id) WHERE status = 'pending';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_event_claims_event_status
ON public.event_claims(event_id, status);

CREATE INDEX IF NOT EXISTS idx_event_claims_requester_status
ON public.event_claims(requester_id, status);

CREATE INDEX IF NOT EXISTS idx_event_claims_status
ON public.event_claims(status);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE public.event_claims ENABLE ROW LEVEL SECURITY;

-- Users can insert claims where requester_id = auth.uid()
CREATE POLICY "Users can create own claims"
  ON public.event_claims FOR INSERT
  WITH CHECK (requester_id = auth.uid());

-- Users can view their own claims
CREATE POLICY "Users can view own claims"
  ON public.event_claims FOR SELECT
  USING (requester_id = auth.uid());

-- Admins can manage all claims (SELECT, UPDATE, DELETE)
CREATE POLICY "Admins can manage all claims"
  ON public.event_claims FOR ALL
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
GRANT SELECT, INSERT ON public.event_claims TO authenticated;
-- UPDATE only needed for admins, handled by RLS policy
GRANT UPDATE ON public.event_claims TO authenticated;

-- =====================================================
-- TRIGGER: Updated at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_event_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_event_claims_updated_at ON public.event_claims;
CREATE TRIGGER set_event_claims_updated_at
  BEFORE UPDATE ON public.event_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_claims_updated_at();

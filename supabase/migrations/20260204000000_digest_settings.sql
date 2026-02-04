-- ============================================================
-- Digest Settings — Admin-Controlled Automation Toggle
-- ============================================================
-- Stores per-digest-type automation settings (on/off toggle).
-- Primary control for cron jobs; env vars become emergency-only.
--
-- Phase: GTM-2 (Admin Email Control Panel + Friendly Opt-Out)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.digest_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_type TEXT NOT NULL UNIQUE,   -- 'weekly_open_mics' | 'weekly_happenings'
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT valid_digest_type CHECK (digest_type IN ('weekly_open_mics', 'weekly_happenings'))
);

-- Seed with both digest types (disabled by default — admin enables via control panel)
INSERT INTO public.digest_settings (digest_type, is_enabled)
VALUES
  ('weekly_open_mics', false),
  ('weekly_happenings', false)
ON CONFLICT (digest_type) DO NOTHING;

-- RLS: server-only table (service role bypasses RLS)
-- Admin reads/writes via API routes that use service role client
ALTER TABLE public.digest_settings ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated roles
-- Only service role client can read/write (which bypasses RLS)

COMMENT ON TABLE public.digest_settings IS
  'Admin-controlled automation toggle for weekly digest cron jobs. Primary control; env vars are emergency-only.';
COMMENT ON COLUMN public.digest_settings.digest_type IS
  'Digest identifier: weekly_open_mics or weekly_happenings';
COMMENT ON COLUMN public.digest_settings.is_enabled IS
  'Whether the automated cron job should send this digest';
COMMENT ON COLUMN public.digest_settings.updated_by IS
  'Admin user who last changed the setting';

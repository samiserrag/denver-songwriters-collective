-- ============================================================
-- Digest Send Log — Idempotency Guard
-- ============================================================
-- Prevents duplicate digest emails by logging each successful
-- send with a unique constraint on (digest_type, week_key).
--
-- A second cron invocation (retry, race, misconfiguration)
-- will fail the INSERT and skip sending.
--
-- Phase: Email Safety Fixes (P1)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.digest_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_type TEXT NOT NULL,        -- 'weekly_open_mics' | 'weekly_happenings'
  week_key TEXT NOT NULL,           -- e.g. '2026-W05' (ISO week in America/Denver)
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_count INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT digest_send_log_unique UNIQUE (digest_type, week_key)
);

-- Index for quick lookups by digest_type + week_key
CREATE INDEX IF NOT EXISTS idx_digest_send_log_type_week
  ON public.digest_send_log (digest_type, week_key);

-- RLS: server-only table (service role bypasses RLS)
ALTER TABLE public.digest_send_log ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated roles
-- Only service role client can read/write (which bypasses RLS)

COMMENT ON TABLE public.digest_send_log IS
  'Idempotency guard for weekly digest cron jobs. Each (digest_type, week_key) pair can only be inserted once.';
COMMENT ON COLUMN public.digest_send_log.digest_type IS
  'Digest identifier: weekly_open_mics or weekly_happenings';
COMMENT ON COLUMN public.digest_send_log.week_key IS
  'ISO week key in America/Denver timezone, e.g. 2026-W05';

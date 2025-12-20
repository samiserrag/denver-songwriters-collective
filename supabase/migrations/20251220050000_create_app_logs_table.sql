-- Migration: Create app_logs table for application error/debug logging
-- This allows admins to view and debug issues from the admin panel

CREATE TABLE IF NOT EXISTS app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  source TEXT, -- e.g., 'onboarding', 'event-creation', 'api/my-events'
  url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read logs
CREATE POLICY "Admins can read all logs"
  ON app_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow inserts from authenticated users (for logging their own errors)
CREATE POLICY "Authenticated users can insert logs"
  ON app_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anonymous inserts too (for unauthenticated error logging)
CREATE POLICY "Anonymous can insert logs"
  ON app_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create indexes for efficient querying
CREATE INDEX idx_app_logs_created_at ON app_logs(created_at DESC);
CREATE INDEX idx_app_logs_level ON app_logs(level);
CREATE INDEX idx_app_logs_source ON app_logs(source);
CREATE INDEX idx_app_logs_user_id ON app_logs(user_id) WHERE user_id IS NOT NULL;

-- Add comment
COMMENT ON TABLE app_logs IS 'Application error and debug logs viewable by admins';

-- Auto-cleanup old logs (keep last 30 days) - optional scheduled function
-- This can be run manually or via a cron job
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM app_logs
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

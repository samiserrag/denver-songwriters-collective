-- Harden user_deletion_log: Service role only for INSERT
--
-- Remove the INSERT policy so only service role can write logs.
-- This prevents malicious users from spamming fake deletion logs.
-- Server actions already use serviceClient which bypasses RLS.

-- Drop the INSERT policy (default deny under RLS)
DROP POLICY IF EXISTS "Server actions can insert deletion logs" ON user_deletion_log;

-- Verify RLS is still enabled (no-op if already enabled)
ALTER TABLE user_deletion_log ENABLE ROW LEVEL SECURITY;

-- SELECT policy remains: is_admin()
-- (Already created in previous migration, no changes needed)

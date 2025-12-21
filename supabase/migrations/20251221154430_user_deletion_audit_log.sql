-- User Deletion Audit Log
--
-- Tracks all user deletions with storage cleanup details for:
-- 1. Compliance and accountability
-- 2. Debugging partial failures
-- 3. Understanding deletion patterns

CREATE TABLE public.user_deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Actor: who performed the deletion
  actor_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_is_admin BOOLEAN NOT NULL DEFAULT false,
  actor_is_super_admin BOOLEAN NOT NULL DEFAULT false,

  -- Target: who was deleted
  target_user_id UUID NOT NULL,  -- No FK since user is deleted
  target_was_admin BOOLEAN NOT NULL DEFAULT false,

  -- Mode: how deletion was triggered
  mode TEXT NOT NULL CHECK (mode IN ('admin_delete', 'self_delete')),

  -- Storage cleanup details
  -- Example: {"avatars": {"attempted": 2, "deleted": 2, "failed": 0}, ...}
  buckets JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Failure details array
  -- Example: [{"bucket": "gallery-images", "path": "abc.jpg", "error": "Not found"}]
  failures JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Final status
  status TEXT NOT NULL CHECK (status IN ('success', 'partial_success', 'failed')),

  -- Optional notes (e.g., auth delete error message)
  notes TEXT NULL
);

-- Index for querying by target user
CREATE INDEX idx_user_deletion_log_target ON user_deletion_log(target_user_id);

-- Index for querying by actor
CREATE INDEX idx_user_deletion_log_actor ON user_deletion_log(actor_user_id);

-- Index for status filtering
CREATE INDEX idx_user_deletion_log_status ON user_deletion_log(status);

-- Enable RLS
ALTER TABLE user_deletion_log ENABLE ROW LEVEL SECURITY;

-- SELECT: Admins only
CREATE POLICY "Admins can view deletion logs"
  ON user_deletion_log
  FOR SELECT
  USING (is_admin());

-- INSERT: Allow from server actions (authenticated admins or self-delete)
-- Since server actions use service role for auth.admin operations but
-- authenticate via createSupabaseServerClient, we allow:
-- 1. Admins (for admin_delete mode)
-- 2. Any authenticated user where actor_user_id matches their id (for self_delete)
CREATE POLICY "Server actions can insert deletion logs"
  ON user_deletion_log
  FOR INSERT
  WITH CHECK (
    is_admin()
    OR (auth.uid() IS NOT NULL AND actor_user_id = auth.uid())
  );

-- No UPDATE or DELETE - logs are immutable

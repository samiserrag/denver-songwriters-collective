-- =====================================================
-- FIX: Allow users to delete their own notifications
-- =====================================================
-- Bug: Notifications could not be deleted because:
--   1. No DELETE privilege was granted (only SELECT, INSERT, UPDATE)
--   2. No RLS policy existed for DELETE operations
--
-- This migration adds both the privilege and the policy.
-- =====================================================

-- 1. Add RLS policy for DELETE (users can delete their own notifications)
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- 2. Grant DELETE privilege to authenticated users
GRANT DELETE ON public.notifications TO authenticated;

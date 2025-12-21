-- User Deletion Cascade Audit
--
-- Ensures deleting a profile hard-deletes ALL user-owned data.
-- This migration updates FKs to ON DELETE CASCADE where appropriate.
--
-- Decision matrix:
-- - User-owned content (posts, comments, claims, images): CASCADE
-- - Admin/audit metadata (reviewed_by, verified_by, updated_by): SET NULL
-- - Featured content tied to user identity: CASCADE (removes highlight)

-- ============================================================================
-- 1. admin_notifications: User's notifications should be deleted
-- ============================================================================
ALTER TABLE admin_notifications
  DROP CONSTRAINT IF EXISTS admin_notifications_user_id_fkey;

ALTER TABLE admin_notifications
  ADD CONSTRAINT admin_notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id)
  ON DELETE CASCADE;

-- ============================================================================
-- 2. change_reports: User's reports deleted, reviewer metadata preserved
-- ============================================================================
ALTER TABLE change_reports
  DROP CONSTRAINT IF EXISTS change_reports_reporter_id_fkey;

ALTER TABLE change_reports
  ADD CONSTRAINT change_reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES profiles(id)
  ON DELETE CASCADE;

ALTER TABLE change_reports
  DROP CONSTRAINT IF EXISTS change_reports_reviewed_by_fkey;

ALTER TABLE change_reports
  ADD CONSTRAINT change_reports_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id)
  ON DELETE SET NULL;

-- ============================================================================
-- 3. event_lineup_state: Metadata only, preserve record
-- ============================================================================
ALTER TABLE event_lineup_state
  DROP CONSTRAINT IF EXISTS event_lineup_state_updated_by_fkey;

ALTER TABLE event_lineup_state
  ADD CONSTRAINT event_lineup_state_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES profiles(id)
  ON DELETE SET NULL;

-- ============================================================================
-- 4. event_slots: User's slot claims should be deleted
-- ============================================================================
ALTER TABLE event_slots
  DROP CONSTRAINT IF EXISTS event_slots_performer_id_fkey;

ALTER TABLE event_slots
  ADD CONSTRAINT event_slots_performer_id_fkey
  FOREIGN KEY (performer_id) REFERENCES profiles(id)
  ON DELETE CASCADE;

-- ============================================================================
-- 5. events.verified_by: Admin verification metadata, preserve record
-- ============================================================================
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_verified_by_fkey;

ALTER TABLE events
  ADD CONSTRAINT events_verified_by_fkey
  FOREIGN KEY (verified_by) REFERENCES profiles(id)
  ON DELETE SET NULL;

-- ============================================================================
-- 6. monthly_highlights.performer_id: Featured performer deleted = remove highlight
-- ============================================================================
ALTER TABLE monthly_highlights
  DROP CONSTRAINT IF EXISTS monthly_highlights_performer_id_fkey;

ALTER TABLE monthly_highlights
  ADD CONSTRAINT monthly_highlights_performer_id_fkey
  FOREIGN KEY (performer_id) REFERENCES profiles(id)
  ON DELETE CASCADE;

-- Note: monthly_highlights.created_by stays SET NULL (admin metadata)

-- ============================================================================
-- Data Integrity Check: Verify no orphaned rows exist
-- ============================================================================
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Check for orphaned admin_notifications
  SELECT COUNT(*) INTO orphan_count
  FROM admin_notifications n
  LEFT JOIN profiles p ON n.user_id = p.id
  WHERE n.user_id IS NOT NULL AND p.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Found % orphaned admin_notifications rows', orphan_count;
  END IF;

  -- Check for orphaned change_reports (reporter)
  SELECT COUNT(*) INTO orphan_count
  FROM change_reports cr
  LEFT JOIN profiles p ON cr.reporter_id = p.id
  WHERE cr.reporter_id IS NOT NULL AND p.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Found % orphaned change_reports (reporter) rows', orphan_count;
  END IF;

  -- Check for orphaned event_slots
  SELECT COUNT(*) INTO orphan_count
  FROM event_slots es
  LEFT JOIN profiles p ON es.performer_id = p.id
  WHERE es.performer_id IS NOT NULL AND p.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Found % orphaned event_slots rows', orphan_count;
  END IF;

  -- Check for orphaned monthly_highlights (performer)
  SELECT COUNT(*) INTO orphan_count
  FROM monthly_highlights mh
  LEFT JOIN profiles p ON mh.performer_id = p.id
  WHERE mh.performer_id IS NOT NULL AND p.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Found % orphaned monthly_highlights (performer) rows', orphan_count;
  END IF;

  RAISE NOTICE 'Data integrity check complete';
END $$;

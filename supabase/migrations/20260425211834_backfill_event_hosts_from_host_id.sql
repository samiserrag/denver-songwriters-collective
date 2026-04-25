-- Backfill event_hosts rows for legacy events that have events.host_id set
-- but no corresponding accepted entry in event_hosts.
--
-- Without this row, the dashboard's "Leave Event" button is hidden because
-- currentUserRole is derived from event_hosts and resolves to null for the
-- primary host. After this backfill, primary hosts can step down via the
-- existing co-host management flow.
--
-- Idempotent: ON CONFLICT clause prevents duplicates if a row already exists
-- for (event_id, user_id).

INSERT INTO event_hosts (event_id, user_id, role, invitation_status, invited_by, responded_at, created_at)
SELECT
  e.id,
  e.host_id,
  'host',
  'accepted',
  e.host_id,
  COALESCE(e.created_at, NOW()),
  COALESCE(e.created_at, NOW())
FROM events e
WHERE e.host_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM event_hosts eh
    WHERE eh.event_id = e.id
      AND eh.user_id = e.host_id
  )
ON CONFLICT (event_id, user_id) DO NOTHING;

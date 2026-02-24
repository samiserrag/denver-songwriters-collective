-- Fix: Scope admin "FOR ALL" RLS policies to "authenticated" role only.
--
-- Root cause: Policies using is_admin() with FOR ALL targeting PUBLIC (all roles)
-- cause "permission denied for function is_admin" when the anon role performs
-- SELECT queries. PostgreSQL evaluates ALL applicable policies for a given
-- command, and is_admin() is SECURITY DEFINER without EXECUTE granted to anon.
-- This silently returns 0 rows for anonymous users on any table with such a policy.
--
-- Fix: Since admins are always authenticated, scope these policies to the
-- "authenticated" role. Anonymous users then only evaluate the public read
-- policies, avoiding the is_admin() call entirely.
--
-- Affected tables: approved_hosts, blog_comments, blog_gallery_images,
-- event_hosts, event_rsvps (already fixed live), event_slots, events (2 policies),
-- host_requests, open_mic_claims, spotlights, studio_appointments, studio_services

BEGIN;

-- event_rsvps (already applied live, this ensures migration matches)
DROP POLICY IF EXISTS "Admins can manage all RSVPs" ON event_rsvps;
CREATE POLICY "Admins can manage all RSVPs" ON event_rsvps
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- approved_hosts
DROP POLICY IF EXISTS "Admins can manage approved hosts" ON approved_hosts;
CREATE POLICY "Admins can manage approved hosts" ON approved_hosts
  FOR ALL TO authenticated USING (is_admin());

-- blog_comments
DROP POLICY IF EXISTS "blog_comments_admin" ON blog_comments;
CREATE POLICY "blog_comments_admin" ON blog_comments
  FOR ALL TO authenticated USING ((SELECT is_admin())) WITH CHECK ((SELECT is_admin()));

-- blog_gallery_images
DROP POLICY IF EXISTS "blog_gallery_admin" ON blog_gallery_images;
CREATE POLICY "blog_gallery_admin" ON blog_gallery_images
  FOR ALL TO authenticated USING ((SELECT is_admin())) WITH CHECK ((SELECT is_admin()));

-- event_hosts
DROP POLICY IF EXISTS "Admins can manage all event hosts" ON event_hosts;
CREATE POLICY "Admins can manage all event hosts" ON event_hosts
  FOR ALL TO authenticated USING (is_admin());

-- event_slots
DROP POLICY IF EXISTS "host_manage_event_slots" ON event_slots;
CREATE POLICY "host_manage_event_slots" ON event_slots
  FOR ALL TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_slots.event_id
      AND events.host_id = auth.uid()
    )) OR is_admin()
  );

-- events: admin policy
DROP POLICY IF EXISTS "Admins can do anything on events" ON events;
CREATE POLICY "Admins can do anything on events" ON events
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- events: host manage own
DROP POLICY IF EXISTS "host_manage_own_events" ON events;
CREATE POLICY "host_manage_own_events" ON events
  FOR ALL TO authenticated
  USING ((auth.uid() = host_id) OR is_admin())
  WITH CHECK ((auth.uid() = host_id) OR is_admin());

-- host_requests
DROP POLICY IF EXISTS "Admins can manage all host requests" ON host_requests;
CREATE POLICY "Admins can manage all host requests" ON host_requests
  FOR ALL TO authenticated USING (is_admin());

-- open_mic_claims
DROP POLICY IF EXISTS "open_mic_claims_admin_all" ON open_mic_claims;
CREATE POLICY "open_mic_claims_admin_all" ON open_mic_claims
  FOR ALL TO authenticated USING (is_admin());

-- spotlights
DROP POLICY IF EXISTS "admin_manage_spotlights" ON spotlights;
CREATE POLICY "admin_manage_spotlights" ON spotlights
  FOR ALL TO authenticated USING (is_admin());

-- studio_appointments
DROP POLICY IF EXISTS "studio_manage_appointments" ON studio_appointments;
CREATE POLICY "studio_manage_appointments" ON studio_appointments
  FOR ALL TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM studio_services
      WHERE studio_services.id = studio_appointments.service_id
      AND studio_services.studio_id = auth.uid()
    )) OR is_admin()
  );

-- studio_services
DROP POLICY IF EXISTS "studio_manage_own_services" ON studio_services;
CREATE POLICY "studio_manage_own_services" ON studio_services
  FOR ALL TO authenticated
  USING ((studio_id = auth.uid()) OR is_admin())
  WITH CHECK ((studio_id = auth.uid()) OR is_admin());

COMMIT;

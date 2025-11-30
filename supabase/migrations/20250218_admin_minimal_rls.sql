-- Create is_admin() helper
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Minimal RLS expansion: Give admins full access to events table
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do anything on events"
  ON events
  FOR ALL
  USING ( is_admin() )
  WITH CHECK ( is_admin() );

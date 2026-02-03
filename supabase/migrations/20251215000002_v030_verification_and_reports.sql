-- v0.3.0: Verification audit trail + change reports

-- 1. Add verification fields to events
ALTER TABLE events
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);

-- 2. Create change_reports table
CREATE TABLE IF NOT EXISTS change_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  proposed_value TEXT NOT NULL,
  notes TEXT,
  reporter_email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected')),
  admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id)
);

-- 3. RLS for change_reports
ALTER TABLE change_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert change reports"
ON change_reports FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view and manage change reports"
ON change_reports FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- 4. Prevent public from reading change_reports
CREATE POLICY "Block public select on change_reports"
ON change_reports FOR SELECT
TO anon
USING (false);


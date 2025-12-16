-- v0.3.0 Verification System Migration
-- Adds event verification tracking and change reports table

-- Add verification columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);

-- Create index for verification queries
CREATE INDEX IF NOT EXISTS idx_events_last_verified_at ON events(last_verified_at);
CREATE INDEX IF NOT EXISTS idx_events_verified_by ON events(verified_by);

-- Create change_reports table for community-submitted corrections
CREATE TABLE IF NOT EXISTS change_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  field_name VARCHAR(50) NOT NULL,
  proposed_value VARCHAR(500) NOT NULL,
  notes TEXT,
  reporter_id UUID REFERENCES profiles(id),
  reporter_email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for change_reports
CREATE INDEX IF NOT EXISTS idx_change_reports_event_id ON change_reports(event_id);
CREATE INDEX IF NOT EXISTS idx_change_reports_status ON change_reports(status);
CREATE INDEX IF NOT EXISTS idx_change_reports_created_at ON change_reports(created_at);

-- Enable RLS on change_reports
ALTER TABLE change_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for change_reports

-- Anyone can INSERT a change report (anonymous or authenticated)
CREATE POLICY "Anyone can submit change reports"
ON change_reports FOR INSERT
TO public
WITH CHECK (true);

-- Authenticated users can view their own reports
CREATE POLICY "Users can view their own change reports"
ON change_reports FOR SELECT
TO authenticated
USING (reporter_id = auth.uid());

-- Admins can view all change reports
CREATE POLICY "Admins can view all change reports"
ON change_reports FOR SELECT
TO authenticated
USING (is_admin());

-- Admins can update change reports
CREATE POLICY "Admins can update change reports"
ON change_reports FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Admins can delete change reports
CREATE POLICY "Admins can delete change reports"
ON change_reports FOR DELETE
TO authenticated
USING (is_admin());

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_change_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_change_reports_updated_at ON change_reports;
CREATE TRIGGER trigger_change_reports_updated_at
  BEFORE UPDATE ON change_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_change_reports_updated_at();

-- Comment on table
COMMENT ON TABLE change_reports IS 'Community-submitted corrections/updates to event data for admin review';
COMMENT ON COLUMN change_reports.field_name IS 'The field being corrected (max 50 chars)';
COMMENT ON COLUMN change_reports.proposed_value IS 'The proposed new value (max 500 chars)';
COMMENT ON COLUMN change_reports.notes IS 'Optional notes from reporter (max 1000 chars enforced at API level)';

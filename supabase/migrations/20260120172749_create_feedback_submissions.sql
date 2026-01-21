-- Create feedback_submissions table for centralized feedback intake
-- Supports bug reports, feature requests, and general feedback

CREATE TABLE IF NOT EXISTS public.feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Submitter info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Feedback content
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'other')),
  subject TEXT NOT NULL CHECK (char_length(subject) <= 200),
  description TEXT NOT NULL CHECK (char_length(description) <= 5000),
  page_url TEXT,

  -- Rate limiting / spam prevention
  ip_hash TEXT NOT NULL, -- SHA-256 hash, never raw IP

  -- Admin workflow
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'wont_fix')),
  admin_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for rate limiting queries (ip_hash + created_at)
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_ip_rate_limit
  ON public.feedback_submissions (ip_hash, created_at);

-- Index for admin workflow (status filtering)
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_status
  ON public.feedback_submissions (status);

-- Index for user_id lookups (if user is logged in)
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_user_id
  ON public.feedback_submissions (user_id)
  WHERE user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public INSERT allowed (anyone can submit feedback)
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback_submissions
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Admin-only SELECT
CREATE POLICY "Admins can view all feedback"
  ON public.feedback_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin-only UPDATE
CREATE POLICY "Admins can update feedback"
  ON public.feedback_submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin-only DELETE
CREATE POLICY "Admins can delete feedback"
  ON public.feedback_submissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_feedback_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_feedback_submissions_updated_at
  BEFORE UPDATE ON public.feedback_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_feedback_submissions_updated_at();

-- Comment for documentation
COMMENT ON TABLE public.feedback_submissions IS 'Centralized feedback intake for bug reports, feature requests, and general feedback';

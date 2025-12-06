-- Create volunteer_signups table for community volunteer sign-ups
CREATE TABLE IF NOT EXISTS public.volunteer_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  preferred_roles text[] DEFAULT '{}',
  availability text[] DEFAULT '{}',
  notes text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_volunteer_signups_email ON public.volunteer_signups(email);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_volunteer_signups_status ON public.volunteer_signups(status);

-- Enable RLS
ALTER TABLE public.volunteer_signups ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public insert (anyone can sign up to volunteer)
CREATE POLICY "Anyone can submit volunteer signup"
  ON public.volunteer_signups
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Only admins can read volunteer signups
CREATE POLICY "Admins can read volunteer signups"
  ON public.volunteer_signups
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Policy: Only admins can update volunteer signups
CREATE POLICY "Admins can update volunteer signups"
  ON public.volunteer_signups
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy: Only admins can delete volunteer signups
CREATE POLICY "Admins can delete volunteer signups"
  ON public.volunteer_signups
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_volunteer_signups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_volunteer_signups_updated_at
  BEFORE UPDATE ON public.volunteer_signups
  FOR EACH ROW
  EXECUTE FUNCTION update_volunteer_signups_updated_at();

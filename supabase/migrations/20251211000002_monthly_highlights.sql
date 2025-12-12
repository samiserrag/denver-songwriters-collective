-- Create monthly_highlights table for featured content on the homepage
-- This allows admins to highlight specific events, performers, or custom content each month

CREATE TABLE IF NOT EXISTS public.monthly_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  highlight_type TEXT NOT NULL CHECK (highlight_type IN ('event', 'performer', 'venue', 'custom')),
  -- Reference to related entities (optional, based on highlight_type)
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  performer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  -- Custom content (for custom highlights)
  image_url TEXT,
  link_url TEXT,
  link_text TEXT DEFAULT 'Learn More',
  -- Display settings
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  -- Date range for when this highlight should be shown
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Add index for efficient querying of active highlights
CREATE INDEX IF NOT EXISTS idx_monthly_highlights_active ON public.monthly_highlights (is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_monthly_highlights_order ON public.monthly_highlights (display_order);

-- Enable RLS
ALTER TABLE public.monthly_highlights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view active highlights
CREATE POLICY "monthly_highlights_select_all" ON public.monthly_highlights
  FOR SELECT USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "monthly_highlights_insert_admin" ON public.monthly_highlights
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "monthly_highlights_update_admin" ON public.monthly_highlights
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "monthly_highlights_delete_admin" ON public.monthly_highlights
  FOR DELETE USING (public.is_admin());

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_monthly_highlights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS monthly_highlights_updated_at ON public.monthly_highlights;
CREATE TRIGGER monthly_highlights_updated_at
  BEFORE UPDATE ON public.monthly_highlights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_monthly_highlights_updated_at();

-- Add some initial sample data (optional - can be removed)
-- INSERT INTO public.monthly_highlights (title, description, highlight_type, is_active, display_order)
-- VALUES
--   ('Featured This Month', 'Check out what''s happening in the Denver music scene!', 'custom', true, 1);

COMMENT ON TABLE public.monthly_highlights IS 'Monthly highlighted content for the homepage - events, performers, venues, or custom content';

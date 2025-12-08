-- ===============================
-- OPEN MIC COMMENTS/REVIEWS
-- ===============================
-- Allow users to leave comments on open mic events (no ratings)

CREATE TABLE IF NOT EXISTS public.open_mic_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast event lookups
CREATE INDEX IF NOT EXISTS idx_open_mic_comments_event_id ON public.open_mic_comments(event_id);
CREATE INDEX IF NOT EXISTS idx_open_mic_comments_user_id ON public.open_mic_comments(user_id);

-- Enable RLS
ALTER TABLE public.open_mic_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments
CREATE POLICY "Anyone can read open mic comments"
  ON public.open_mic_comments
  FOR SELECT
  USING (true);

-- Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
  ON public.open_mic_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
  ON public.open_mic_comments
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own comments, admins can delete any
CREATE POLICY "Users can delete their own comments"
  ON public.open_mic_comments
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ===============================
-- COMMENTS
-- ===============================
COMMENT ON TABLE public.open_mic_comments IS 'User comments/reviews on open mic events';
COMMENT ON COLUMN public.open_mic_comments.event_id IS 'The open mic event being commented on';
COMMENT ON COLUMN public.open_mic_comments.user_id IS 'The user who wrote the comment';
COMMENT ON COLUMN public.open_mic_comments.content IS 'The comment text';

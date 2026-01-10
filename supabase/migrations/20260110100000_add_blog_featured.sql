-- Add is_featured column to blog_posts
--
-- Only one post should be featured at a time (admin-controlled)
-- Featured post appears prominently on homepage

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Index for quick featured post lookup
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured
  ON public.blog_posts(is_featured)
  WHERE is_featured = true;

-- Optional: Add a partial unique constraint if we want to enforce only one featured post
-- For now, we'll handle this in the application layer by unfeaturing others when featuring one

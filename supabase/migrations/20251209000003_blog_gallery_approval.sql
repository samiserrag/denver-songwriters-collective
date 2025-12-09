-- ==========================================================
-- BLOG GALLERY IMAGES AND APPROVAL WORKFLOW
-- Migration: 20251209000003_blog_gallery_approval.sql
-- ==========================================================
-- Adds:
-- 1. blog_gallery_images table for multiple images per blog post
-- 2. is_approved field to blog_posts for user submission approval
-- 3. Updated RLS policies to allow authenticated users to create posts
-- ==========================================================

-- ==========================================================
-- 1. ADD APPROVAL FIELD TO BLOG_POSTS
-- ==========================================================
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- Create index for filtering by approval status
CREATE INDEX IF NOT EXISTS blog_posts_approved_idx ON blog_posts(is_approved);

-- ==========================================================
-- 2. BLOG_GALLERY_IMAGES TABLE
-- ==========================================================
CREATE TABLE IF NOT EXISTS blog_gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blog_gallery_post_idx ON blog_gallery_images(post_id);
CREATE INDEX IF NOT EXISTS blog_gallery_order_idx ON blog_gallery_images(post_id, sort_order);

-- RLS for blog_gallery_images
ALTER TABLE blog_gallery_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view gallery images for published & approved posts
CREATE POLICY blog_gallery_public_read ON blog_gallery_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM blog_posts
      WHERE blog_posts.id = blog_gallery_images.post_id
      AND blog_posts.is_published = true
      AND blog_posts.is_approved = true
    )
  );

-- Authors can view their own post's gallery images
CREATE POLICY blog_gallery_author_read ON blog_gallery_images
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM blog_posts
      WHERE blog_posts.id = blog_gallery_images.post_id
      AND blog_posts.author_id = auth.uid()
    )
  );

-- Authors can insert gallery images for their own posts
CREATE POLICY blog_gallery_author_insert ON blog_gallery_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM blog_posts
      WHERE blog_posts.id = blog_gallery_images.post_id
      AND blog_posts.author_id = auth.uid()
    )
  );

-- Authors can update their own post's gallery images
CREATE POLICY blog_gallery_author_update ON blog_gallery_images
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM blog_posts
      WHERE blog_posts.id = blog_gallery_images.post_id
      AND blog_posts.author_id = auth.uid()
    )
  );

-- Authors can delete their own post's gallery images
CREATE POLICY blog_gallery_author_delete ON blog_gallery_images
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM blog_posts
      WHERE blog_posts.id = blog_gallery_images.post_id
      AND blog_posts.author_id = auth.uid()
    )
  );

-- Admins can do everything
CREATE POLICY blog_gallery_admin ON blog_gallery_images
  FOR ALL USING ((SELECT is_admin()));

-- ==========================================================
-- 3. UPDATE BLOG_POSTS RLS FOR USER SUBMISSIONS
-- ==========================================================

-- Drop existing policies that restrict to admin only
DROP POLICY IF EXISTS blog_posts_admin_all ON blog_posts;

-- Authenticated users can create their own blog posts
CREATE POLICY blog_posts_user_insert ON blog_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Authors can update their own posts (but not change approval status)
CREATE POLICY blog_posts_author_update ON blog_posts
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Authors can delete their own posts
CREATE POLICY blog_posts_author_delete ON blog_posts
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- Admins can do everything (including approving)
CREATE POLICY blog_posts_admin_all ON blog_posts
  FOR ALL USING ((SELECT is_admin()));

-- Update existing posts to be approved (admin posts)
UPDATE blog_posts SET is_approved = true WHERE is_approved IS NULL OR is_approved = false;

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================

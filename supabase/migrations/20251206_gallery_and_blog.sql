-- ==========================================================
-- GALLERY AND BLOG TABLES
-- ==========================================================

-- ==========================================================
-- 1. GALLERY_IMAGES TABLE - For event photos from users/admins
-- ==========================================================
CREATE TABLE IF NOT EXISTS gallery_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  is_approved BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX gallery_images_uploaded_by_idx ON gallery_images(uploaded_by);
CREATE INDEX gallery_images_event_idx ON gallery_images(event_id);
CREATE INDEX gallery_images_venue_idx ON gallery_images(venue_id);
CREATE INDEX gallery_images_approved_idx ON gallery_images(is_approved);

-- RLS for gallery_images
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved images
CREATE POLICY gallery_images_public_read ON gallery_images
  FOR SELECT USING (is_approved = true);

-- Users can view their own images (even unapproved)
CREATE POLICY gallery_images_own_read ON gallery_images
  FOR SELECT USING (auth.uid() = uploaded_by);

-- Authenticated users can upload images
CREATE POLICY gallery_images_insert ON gallery_images
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- Users can update their own images
CREATE POLICY gallery_images_update_own ON gallery_images
  FOR UPDATE USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

-- Users can delete their own images
CREATE POLICY gallery_images_delete_own ON gallery_images
  FOR DELETE USING (auth.uid() = uploaded_by);

-- Admins can do anything with gallery images
CREATE POLICY gallery_images_admin ON gallery_images
  FOR ALL USING ((select is_admin()));

-- ==========================================================
-- 2. BLOG_POSTS TABLE - For blog articles
-- ==========================================================
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX blog_posts_author_idx ON blog_posts(author_id);
CREATE INDEX blog_posts_slug_idx ON blog_posts(slug);
CREATE INDEX blog_posts_published_idx ON blog_posts(is_published);
CREATE INDEX blog_posts_published_at_idx ON blog_posts(published_at DESC);

-- RLS for blog_posts
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts
CREATE POLICY blog_posts_public_read ON blog_posts
  FOR SELECT USING (is_published = true);

-- Authors can see their own drafts
CREATE POLICY blog_posts_author_read ON blog_posts
  FOR SELECT USING (auth.uid() = author_id);

-- Only admins can create/update/delete blog posts
CREATE POLICY blog_posts_admin_all ON blog_posts
  FOR ALL USING ((select is_admin()));

-- ==========================================================
-- 3. SEED FIRST BLOG POST - Open Mic Etiquette
-- ==========================================================
-- Note: This will be inserted via a separate seed file or manually
-- since we need a valid author_id (admin user)

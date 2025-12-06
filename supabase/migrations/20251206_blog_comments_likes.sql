-- Blog Comments
CREATE TABLE IF NOT EXISTS blog_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blog_comments_post_idx ON blog_comments(post_id);
CREATE INDEX IF NOT EXISTS blog_comments_author_idx ON blog_comments(author_id);

ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved comments
CREATE POLICY blog_comments_public_read ON blog_comments
  FOR SELECT USING (is_approved = true);

-- Authors can see their own comments
CREATE POLICY blog_comments_author_read ON blog_comments
  FOR SELECT USING (auth.uid() = author_id);

-- Authenticated users can create comments
CREATE POLICY blog_comments_insert ON blog_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Users can update/delete their own comments
CREATE POLICY blog_comments_update_own ON blog_comments
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY blog_comments_delete_own ON blog_comments
  FOR DELETE USING (auth.uid() = author_id);

-- Admins can manage all comments
CREATE POLICY blog_comments_admin ON blog_comments
  FOR ALL USING ((select is_admin()));

-- Blog Likes
CREATE TABLE IF NOT EXISTS blog_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS blog_likes_post_idx ON blog_likes(post_id);
CREATE INDEX IF NOT EXISTS blog_likes_user_idx ON blog_likes(user_id);

ALTER TABLE blog_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can see like counts (via count queries)
CREATE POLICY blog_likes_public_read ON blog_likes
  FOR SELECT USING (true);

-- Authenticated users can like posts
CREATE POLICY blog_likes_insert ON blog_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike (delete their own likes)
CREATE POLICY blog_likes_delete_own ON blog_likes
  FOR DELETE USING (auth.uid() = user_id);

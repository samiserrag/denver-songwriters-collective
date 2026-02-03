-- Gallery comments + album approval

-- 1. Add is_approved to gallery_albums if not exists
ALTER TABLE gallery_albums
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;

-- 2. Create gallery_comments table
CREATE TABLE IF NOT EXISTS gallery_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES gallery_albums(id) ON DELETE CASCADE,
  image_id UUID REFERENCES gallery_images(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT album_or_image CHECK (
    (album_id IS NOT NULL AND image_id IS NULL) OR
    (album_id IS NULL AND image_id IS NOT NULL)
  )
);

-- 3. RLS for gallery_comments
ALTER TABLE gallery_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read approved comments"
ON gallery_comments FOR SELECT
TO anon, authenticated
USING (is_approved = true);

CREATE POLICY "Authenticated users can insert comments"
ON gallery_comments FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can update own comments"
ON gallery_comments FOR UPDATE
TO authenticated
USING (author_id = auth.uid());

CREATE POLICY "Users can delete own comments"
ON gallery_comments FOR DELETE
TO authenticated
USING (author_id = auth.uid());

CREATE POLICY "Admins can manage all comments"
ON gallery_comments FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);


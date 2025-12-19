-- Add gallery_albums table for organizing photos into collections
CREATE TABLE IF NOT EXISTS gallery_albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gallery_albums_slug_idx ON gallery_albums(slug);
CREATE INDEX IF NOT EXISTS gallery_albums_published_idx ON gallery_albums(is_published);

-- Add album_id to gallery_images
ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES gallery_albums(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS gallery_images_album_idx ON gallery_images(album_id);

-- RLS for gallery_albums
ALTER TABLE gallery_albums ENABLE ROW LEVEL SECURITY;

-- Anyone can view published albums
CREATE POLICY gallery_albums_public_read ON gallery_albums
  FOR SELECT USING (is_published = true);

-- Admins can do everything with albums
CREATE POLICY gallery_albums_admin_all ON gallery_albums
  FOR ALL USING ((select is_admin()));

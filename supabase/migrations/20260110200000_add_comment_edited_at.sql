-- Migration: Add edited_at column to all comment tables
-- Purpose: Track when comments were last edited for transparency

-- Add edited_at to blog_comments
ALTER TABLE blog_comments
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

-- Add edited_at to gallery_photo_comments
ALTER TABLE gallery_photo_comments
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

-- Add edited_at to gallery_album_comments
ALTER TABLE gallery_album_comments
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

-- Add edited_at to profile_comments
ALTER TABLE profile_comments
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

-- Add edited_at to event_comments
ALTER TABLE event_comments
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NULL;

-- Add is_deleted to blog_comments if missing (for consistency)
ALTER TABLE blog_comments
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Add is_hidden to blog_comments if missing (for consistency)
ALTER TABLE blog_comments
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Add hidden_by to blog_comments if missing (for consistency)
ALTER TABLE blog_comments
ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Comments:
-- edited_at is NULL when comment has never been edited
-- edited_at is set to NOW() when content is modified
-- This provides transparency to users about when a comment was edited

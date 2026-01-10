-- Migration: Add delete_comment action type for guest comment deletion
-- Purpose: Allow guests to delete their own comments via email verification

-- Drop and recreate constraint with new action type
ALTER TABLE guest_verifications DROP CONSTRAINT IF EXISTS valid_action_type;

ALTER TABLE guest_verifications ADD CONSTRAINT valid_action_type
CHECK (
  action_type IS NULL OR action_type IN (
    'confirm',
    'cancel',
    'comment',
    'cancel_rsvp',
    'timeslot',
    'gallery_photo_comment',
    'gallery_album_comment',
    'blog_comment',
    'profile_comment',
    'delete_comment'
  )
);

-- Comments:
-- delete_comment: Used when a guest wants to delete their own comment
-- The guest provides their email, receives a code, and upon verification
-- the comment is soft-deleted (is_deleted = true)

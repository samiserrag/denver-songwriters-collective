-- Add new event_type enum values for genre-specific categories
-- These allow proper emoji/icon mapping in digest emails and event forms
-- No RLS changes — enum extension only

ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'poetry';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'irish';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'blues';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'bluegrass';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'comedy';

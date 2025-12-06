-- Add signup_time and category fields safely
ALTER TABLE events
ADD COLUMN IF NOT EXISTS signup_time TEXT;

ALTER TABLE events
ADD COLUMN IF NOT EXISTS category TEXT;

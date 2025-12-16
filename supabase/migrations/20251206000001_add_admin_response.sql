-- Add admin response field for template responses
ALTER TABLE event_update_suggestions 
ADD COLUMN IF NOT EXISTS admin_response TEXT;

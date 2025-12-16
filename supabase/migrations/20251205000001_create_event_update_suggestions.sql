-- 20251205_create_event_update_suggestions.sql
-- Event update suggestion moderation table

CREATE TABLE IF NOT EXISTS event_update_suggestions (
  id BIGSERIAL PRIMARY KEY,
  batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  submitter_email TEXT,
  submitter_name TEXT,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);

-- Enable RLS; policies will be added in a later step.
ALTER TABLE event_update_suggestions ENABLE ROW LEVEL SECURITY;

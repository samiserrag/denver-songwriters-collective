// web/src/types/eventUpdateSuggestion.ts

// Local TypeScript representation of the `event_update_suggestions` table.
// Based on supabase/migrations/20251205_create_event_update_suggestions.sql
// This is intentionally decoupled from generated DB types for safer incremental changes.

export interface EventUpdateSuggestion {
  id: number;                // BIGSERIAL PRIMARY KEY
  batch_id: string;          // UUID NOT NULL DEFAULT gen_random_uuid()
  event_id: string | null;   // UUID REFERENCES events(id) ON DELETE CASCADE

  submitter_email: string | null;
  submitter_name: string | null;

  field: string;             // TEXT NOT NULL
  old_value: string | null;  // TEXT
  new_value: string;         // TEXT NOT NULL

  notes: string | null;

  status: string;            // TEXT NOT NULL DEFAULT 'pending'

  created_at: string;        // TIMESTAMPTZ NOT NULL DEFAULT NOW()
  reviewed_at: string | null;
  reviewed_by: string | null;
}

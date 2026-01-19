// web/src/lib/eventUpdateSuggestions/server.ts

import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import type { EventUpdateSuggestion } from "@/types/eventUpdateSuggestion";

export type EventUpdateSuggestionInsert = Omit<
  EventUpdateSuggestion,
  "id" | "created_at" | "reviewed_at" | "reviewed_by"
> & { batch_id?: string };

/**
 * Insert an event update suggestion using service role client.
 * This allows both authenticated users and guests to submit suggestions.
 * The API route validates input before calling this function.
 */
export async function insertEventUpdateSuggestion(
  payload: EventUpdateSuggestionInsert
) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("event_update_suggestions")
    .insert(payload)
    .select("*")
    .single();

  return { data, error };
}

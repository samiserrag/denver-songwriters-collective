// web/src/lib/eventUpdateSuggestions/server.ts

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EventUpdateSuggestion } from "@/types/eventUpdateSuggestion";

export type EventUpdateSuggestionInsert = Omit<
  EventUpdateSuggestion,
  "id" | "created_at" | "reviewed_at" | "reviewed_by"
> & { batch_id?: string };

export async function insertEventUpdateSuggestion(
  payload: EventUpdateSuggestionInsert
) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("event_update_suggestions")
    .insert(payload)
    .select("*")
    .single();

  return { data, error };
}

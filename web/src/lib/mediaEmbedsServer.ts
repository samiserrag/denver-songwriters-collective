import type { SupabaseClient } from "@supabase/supabase-js";
import { buildEmbedRowsSafe, type MediaEmbedTargetType, type BuildEmbedRowsError } from "./mediaEmbeds";

interface UpsertScope {
  type: MediaEmbedTargetType;
  id: string;
  date_key?: string | null;
}

export interface UpsertMediaEmbedsResult {
  data: unknown[];
  errors: BuildEmbedRowsError[];
}

/**
 * Replace all media embeds for a given scope with a new ordered list.
 * Empty urls array clears all rows for that scope.
 * Invalid rows are skipped (not inserted) and returned in `errors`.
 */
export async function upsertMediaEmbeds(
  supabase: SupabaseClient,
  scope: UpsertScope,
  urls: string[],
  createdBy: string
): Promise<UpsertMediaEmbedsResult> {
  // Delete existing rows for this scope
  let deleteQuery = supabase
    .from("media_embeds")
    .delete()
    .eq("target_type", scope.type)
    .eq("target_id", scope.id);

  if (scope.type === "event_override" && scope.date_key) {
    deleteQuery = deleteQuery.eq("date_key", scope.date_key);
  } else {
    deleteQuery = deleteQuery.is("date_key", null);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    throw new Error(`Failed to clear existing embeds: ${deleteError.message}`);
  }

  // Build rows, collecting per-row errors instead of failing the batch
  const { rows, errors } = buildEmbedRowsSafe(urls, scope, createdBy);
  if (rows.length === 0) return { data: [], errors };

  const { data, error: insertError } = await supabase
    .from("media_embeds")
    .insert(rows)
    .select();

  if (insertError) {
    throw new Error(`Failed to insert embeds: ${insertError.message}`);
  }

  return { data: data ?? [], errors };
}

/**
 * Read ordered embeds for a scope.
 */
export async function readMediaEmbeds(
  supabase: SupabaseClient,
  scope: UpsertScope
) {
  let query = supabase
    .from("media_embeds")
    .select("id, target_type, target_id, date_key, position, url, provider, kind, created_by, created_at")
    .eq("target_type", scope.type)
    .eq("target_id", scope.id)
    .order("position", { ascending: true });

  if (scope.type === "event_override" && scope.date_key) {
    query = query.eq("date_key", scope.date_key);
  } else {
    query = query.is("date_key", null);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to read embeds: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Read embeds for an event occurrence with override-first fallback:
 * 1. Try event_override scope for this date_key
 * 2. If empty, fall back to base event scope
 */
export async function readEventEmbedsWithFallback(
  supabase: SupabaseClient,
  eventId: string,
  dateKey?: string | null
) {
  // Try override first when a date_key is present
  if (dateKey) {
    const overrideEmbeds = await readMediaEmbeds(supabase, {
      type: "event_override",
      id: eventId,
      date_key: dateKey,
    });
    if (overrideEmbeds.length > 0) return overrideEmbeds;
  }

  // Fall back to base event embeds
  return readMediaEmbeds(supabase, { type: "event", id: eventId });
}

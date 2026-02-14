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
 *
 * Uses the `upsert_media_embeds` RPC to run delete + insert atomically
 * in a single database transaction. If the insert fails (e.g. constraint
 * violation), the delete is rolled back automatically — preventing the
 * destructive "delete then fail" wipe that occurred with separate calls.
 */
export async function upsertMediaEmbeds(
  supabase: SupabaseClient,
  scope: UpsertScope,
  urls: string[],
  createdBy: string
): Promise<UpsertMediaEmbedsResult> {
  // Build rows client-side, collecting per-row errors instead of failing the batch
  const { rows, errors } = buildEmbedRowsSafe(urls, scope, createdBy);

  // Prepare rows as JSON for the RPC (only fields the function expects)
  const rpcRows = rows.map((r) => ({
    position: r.position,
    url: r.url,
    provider: r.provider,
    kind: r.kind,
    created_by: r.created_by,
  }));

  const { data, error } = await supabase.rpc("upsert_media_embeds", {
    p_target_type: scope.type,
    p_target_id: scope.id,
    p_date_key: scope.date_key ?? null,
    p_rows: rpcRows,
  });

  if (error) {
    throw new Error(`Failed to upsert embeds: ${error.message}`);
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

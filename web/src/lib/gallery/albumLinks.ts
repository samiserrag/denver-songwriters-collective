import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlbumLinkRow {
  target_type: "profile" | "venue" | "event";
  target_id: string;
  link_role: "creator" | "collaborator" | "venue" | "event";
}

export interface AlbumLinkInput {
  /** album.created_by — always required */
  createdBy: string;
  /** album.event_id — optional */
  eventId?: string | null;
  /** album.venue_id — optional */
  venueId?: string | null;
  /** collaborator profile IDs — optional, max 10 enforced by UI */
  collaboratorIds?: string[];
}

// ---------------------------------------------------------------------------
// Build the desired link set from album fields
// ---------------------------------------------------------------------------

/**
 * Deterministically builds the full set of desired link rows for an album.
 * This is a pure function — no DB calls.
 *
 * Rules:
 * - Always includes a creator link (profile / created_by / creator)
 * - Adds collaborator links for each distinct collaborator ID (profile / id / collaborator)
 *   - A collaborator ID equal to created_by is allowed (separate link_role)
 * - Adds a venue link if venueId is set (venue / venue_id / venue)
 * - Adds an event link if eventId is set (event / event_id / event)
 */
export function buildDesiredAlbumLinks(input: AlbumLinkInput): AlbumLinkRow[] {
  const links: AlbumLinkRow[] = [];

  // Creator link — always present
  links.push({
    target_type: "profile",
    target_id: input.createdBy,
    link_role: "creator",
  });

  // Collaborator links
  if (input.collaboratorIds && input.collaboratorIds.length > 0) {
    const seen = new Set<string>();
    for (const id of input.collaboratorIds) {
      if (id && !seen.has(id)) {
        seen.add(id);
        links.push({
          target_type: "profile",
          target_id: id,
          link_role: "collaborator",
        });
      }
    }
  }

  // Venue link
  if (input.venueId) {
    links.push({
      target_type: "venue",
      target_id: input.venueId,
      link_role: "venue",
    });
  }

  // Event link
  if (input.eventId) {
    links.push({
      target_type: "event",
      target_id: input.eventId,
      link_role: "event",
    });
  }

  return links;
}

// ---------------------------------------------------------------------------
// Reconcile: atomic delete-all + re-insert via RPC
// ---------------------------------------------------------------------------

/**
 * Atomically reconcile album links by calling the
 * `reconcile_gallery_album_links` RPC.
 *
 * If the RPC fails, the entire transaction rolls back (no partial wipe).
 * Follows the same pattern as `upsertMediaEmbeds` in mediaEmbedsServer.ts.
 *
 * @param supabase - authenticated Supabase client (browser or server)
 * @param albumId  - the album UUID
 * @param input    - album fields used to compute the desired link set
 */
export async function reconcileAlbumLinks(
  supabase: SupabaseClient,
  albumId: string,
  input: AlbumLinkInput
): Promise<void> {
  const links = buildDesiredAlbumLinks(input);

  const { error } = await supabase.rpc("reconcile_gallery_album_links", {
    p_album_id: albumId,
    p_links: links,
  });

  if (error) {
    throw new Error(`Failed to reconcile album links: ${error.message}`);
  }
}

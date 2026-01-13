/**
 * Venue Manager Authorization Helpers
 *
 * Provides authorization checks for venue management operations.
 * Used by API routes and UI components to determine user capabilities.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// =============================================================================
// Types
// =============================================================================

type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type VenueManagerRow = Database["public"]["Tables"]["venue_managers"]["Row"];

export type VenueRole = "owner" | "manager";

export interface VenueManagerGrant {
  id: string;
  venue_id: string;
  user_id: string;
  role: VenueRole;
  created_at: string | null;
  grant_method: string;
  revoked_at: string | null;
}

// =============================================================================
// Manager-Editable Fields
// =============================================================================

/**
 * Fields that venue managers (owner or manager role) can edit.
 *
 * EXCLUDED (system-managed):
 * - id, slug, created_at, updated_at
 *
 * EXCLUDED (admin-only):
 * - notes (internal admin notes, not public)
 *
 * All fields in this list MUST exist in the venues table schema.
 */
export const MANAGER_EDITABLE_VENUE_FIELDS = [
  "name",
  "address",
  "city",
  "state",
  "zip",
  "phone",
  "website_url",
  "google_maps_url",
  "map_link",
  "contact_link",
  "neighborhood",
  "accessibility_notes",
  "parking_notes",
] as const;

export type ManagerEditableVenueField =
  (typeof MANAGER_EDITABLE_VENUE_FIELDS)[number];

export type ManagerEditableVenuePatch = Pick<
  VenueRow,
  ManagerEditableVenueField
>;

/**
 * Validates that a patch object only contains allowed fields.
 * Returns the sanitized patch with only allowed fields.
 */
export function sanitizeVenuePatch(
  patch: Record<string, unknown>
): Partial<ManagerEditableVenuePatch> {
  const sanitized: Record<string, string | null> = {};
  const allowedSet = new Set<string>(MANAGER_EDITABLE_VENUE_FIELDS);

  for (const key of Object.keys(patch)) {
    if (allowedSet.has(key)) {
      sanitized[key] = patch[key] as string | null;
    }
  }

  return sanitized as Partial<ManagerEditableVenuePatch>;
}

/**
 * Returns list of fields in the patch that are NOT allowed.
 * Useful for error messages.
 */
export function getDisallowedFields(
  patch: Record<string, unknown>
): string[] {
  const allowedSet = new Set<string>(MANAGER_EDITABLE_VENUE_FIELDS);
  return Object.keys(patch).filter((key) => !allowedSet.has(key));
}

// =============================================================================
// Authorization Checks
// =============================================================================

/**
 * Check if a user has an active (non-revoked) venue manager grant.
 * Returns the grant if found, null otherwise.
 */
export async function getActiveVenueGrant(
  supabase: SupabaseClient<Database>,
  venueId: string,
  userId: string
): Promise<VenueManagerGrant | null> {
  const { data, error } = await supabase
    .from("venue_managers")
    .select("id, venue_id, user_id, role, created_at, grant_method, revoked_at")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .single();

  if (error || !data) {
    return null;
  }

  return data as VenueManagerGrant;
}

/**
 * Check if user is a venue manager (any role: owner or manager).
 */
export async function isVenueManager(
  supabase: SupabaseClient<Database>,
  venueId: string,
  userId: string
): Promise<boolean> {
  const grant = await getActiveVenueGrant(supabase, venueId, userId);
  return grant !== null;
}

/**
 * Check if user is specifically a venue owner.
 */
export async function isVenueOwner(
  supabase: SupabaseClient<Database>,
  venueId: string,
  userId: string
): Promise<boolean> {
  const grant = await getActiveVenueGrant(supabase, venueId, userId);
  return grant?.role === "owner";
}

/**
 * Get the user's role for a venue, or null if no active grant.
 */
export async function getVenueRole(
  supabase: SupabaseClient<Database>,
  venueId: string,
  userId: string
): Promise<VenueRole | null> {
  const grant = await getActiveVenueGrant(supabase, venueId, userId);
  return grant?.role as VenueRole | null;
}

/**
 * Check if user can edit a venue.
 * User can edit if they are:
 * - A venue manager (owner or manager role) for this venue, OR
 * - An admin
 *
 * Note: This function does NOT check admin status - caller should check separately.
 */
export async function canEditVenue(
  supabase: SupabaseClient<Database>,
  venueId: string,
  userId: string
): Promise<boolean> {
  return isVenueManager(supabase, venueId, userId);
}

/**
 * Get all venues a user manages (non-revoked grants).
 */
export async function getManagedVenues(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<VenueManagerGrant[]> {
  const { data, error } = await supabase
    .from("venue_managers")
    .select("id, venue_id, user_id, role, created_at, grant_method, revoked_at")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (error || !data) {
    return [];
  }

  return data as VenueManagerGrant[];
}

/**
 * Get all managers for a venue (for admin view).
 * Includes revoked grants for audit trail.
 */
export async function getVenueManagers(
  supabase: SupabaseClient<Database>,
  venueId: string,
  includeRevoked = false
): Promise<VenueManagerRow[]> {
  let query = supabase
    .from("venue_managers")
    .select("*")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });

  if (!includeRevoked) {
    query = query.is("revoked_at", null);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data;
}

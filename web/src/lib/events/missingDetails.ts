/**
 * Missing Details Computation
 *
 * Phase 4.1: Determines if an event has missing critical information
 * that the community could help fill in.
 *
 * Rules:
 * 1. Online events (location_mode='online') need: online_url
 * 2. Hybrid events (location_mode='hybrid') need: online_url + (venue_id OR custom_location_name)
 * 3. Venue events need: venue_id OR custom_location_name (not both venue_name alone)
 * 4. DSC events need: age_policy
 * 5. All events benefit from: is_free (cost clarity)
 * 6. "Orphan" events: have venue_name but no venue_id and no custom location
 */

export interface MissingDetailsInput {
  // Location
  location_mode?: "venue" | "online" | "hybrid" | string | null;
  venue_id?: string | null;
  venue_name?: string | null;
  custom_location_name?: string | null;
  online_url?: string | null;

  // Cost
  is_free?: boolean | null;

  // Age
  age_policy?: string | null;

  // Event type
  is_dsc_event?: boolean | null;
  event_type?: string | null;
}

export interface MissingDetailsResult {
  missing: boolean;
  reasons: string[];
}

/**
 * Compute whether an event has missing details
 * Returns { missing: boolean, reasons: string[] }
 */
export function computeMissingDetails(event: MissingDetailsInput): MissingDetailsResult {
  const reasons: string[] = [];

  const locationMode = event.location_mode || "venue";
  const hasVenueId = !!event.venue_id;
  const hasCustomLocation = !!event.custom_location_name;
  const hasOnlineUrl = !!event.online_url;
  const hasVenueNameOnly = !!event.venue_name && !hasVenueId && !hasCustomLocation;

  // Rule 1: Online events need online_url
  if (locationMode === "online" && !hasOnlineUrl) {
    reasons.push("Online event missing URL");
  }

  // Rule 2: Hybrid events need online_url + physical location
  if (locationMode === "hybrid") {
    if (!hasOnlineUrl) {
      reasons.push("Hybrid event missing online URL");
    }
    if (!hasVenueId && !hasCustomLocation) {
      reasons.push("Hybrid event missing physical location");
    }
  }

  // Rule 3: Venue events need proper location reference
  if (locationMode === "venue") {
    if (!hasVenueId && !hasCustomLocation && !event.venue_name) {
      reasons.push("Missing venue information");
    }
  }

  // Rule 4: DSC events need age_policy
  if (event.is_dsc_event && !event.age_policy) {
    reasons.push("DSC event missing age policy");
  }

  // Rule 5: Unknown cost (is_free is null)
  if (event.is_free === null || event.is_free === undefined) {
    reasons.push("Cost information unknown");
  }

  // Rule 6: Orphan venue (has name but no proper reference)
  // This is informational - the venue exists but isn't linked
  if (hasVenueNameOnly) {
    reasons.push("Venue not linked to database");
  }

  return {
    missing: reasons.length > 0,
    reasons
  };
}

/**
 * Simple boolean check for use in components
 */
export function hasMissingDetails(event: MissingDetailsInput): boolean {
  return computeMissingDetails(event).missing;
}

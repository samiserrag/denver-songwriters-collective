/**
 * Google Maps URL Helper
 *
 * Ops Console v1: Generates Google Maps search URLs for venue lookup.
 * Admin copies the generated URL, searches Google Maps, then pastes
 * the actual place URL back into the CSV.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VenueForMapsSearch {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// URL Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a Google Maps search URL for a venue.
 *
 * Priority order for query building:
 * 1. name + address + city + state (most specific)
 * 2. name + city + state (if no address)
 * 3. name only (fallback)
 *
 * @param venue - Venue data for search
 * @returns Google Maps search URL
 */
export function generateGoogleMapsSearchUrl(venue: VenueForMapsSearch): string {
  const parts: string[] = [];

  // Always include name
  if (venue.name && venue.name.trim()) {
    parts.push(venue.name.trim());
  }

  // Add address if available
  if (venue.address && venue.address.trim()) {
    parts.push(venue.address.trim());
  }

  // Add city if available
  if (venue.city && venue.city.trim()) {
    parts.push(venue.city.trim());
  }

  // Add state if available
  if (venue.state && venue.state.trim()) {
    parts.push(venue.state.trim());
  }

  // Build query string
  const query = parts.join(" ").trim();

  if (!query) {
    return "";
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Validates if a URL looks like a valid Google Maps place URL.
 *
 * Valid patterns:
 * - https://www.google.com/maps/place/...
 * - https://maps.google.com/...
 * - https://goo.gl/maps/...
 */
export function isValidGoogleMapsUrl(url: string): boolean {
  if (!url || !url.trim()) {
    return false;
  }

  const trimmed = url.trim().toLowerCase();

  // Must start with http or https
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return false;
  }

  // Check for Google Maps domains
  const validPatterns = [
    "google.com/maps",
    "maps.google.com",
    "goo.gl/maps",
  ];

  return validPatterns.some((pattern) => trimmed.includes(pattern));
}

/**
 * Extracts venue ID suggestion from current data for display.
 * Returns a human-readable summary for the helper UI.
 */
export function getVenueSearchSummary(venue: VenueForMapsSearch): string {
  const parts: string[] = [];

  if (venue.name) parts.push(venue.name);
  if (venue.address) parts.push(venue.address);
  if (venue.city && venue.state) {
    parts.push(`${venue.city}, ${venue.state}`);
  } else if (venue.city) {
    parts.push(venue.city);
  } else if (venue.state) {
    parts.push(venue.state);
  }

  return parts.join(" • ") || "No venue data";
}

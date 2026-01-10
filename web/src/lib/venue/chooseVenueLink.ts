/**
 * chooseVenueLink - Determines the best "homepage" link for a venue
 *
 * This is for venue NAME links (maps page or website).
 * NOT for "Get Directions" functionality - that uses getGoogleMapsUrl() separately.
 *
 * Priority:
 * 1. google_maps_url (if valid URL) - direct venue page on Google Maps
 * 2. website_url (if valid URL) - venue's own website
 * 3. null (no link available) - render as plain text
 *
 * Security:
 * - Only allows http:// and https:// URLs
 * - Invalid URLs treated as null (plain text fallback)
 */
export function chooseVenueLink(venue: {
  google_maps_url?: string | null;
  website_url?: string | null;
} | null | undefined): string | null {
  if (!venue) return null;

  // Priority 1: Google Maps URL (direct venue page)
  if (venue.google_maps_url && isValidUrl(venue.google_maps_url)) {
    return venue.google_maps_url;
  }

  // Priority 2: Website URL
  if (venue.website_url && isValidUrl(venue.website_url)) {
    return venue.website_url;
  }

  return null;
}

/**
 * Validates that a URL is safe to render as a link
 * Only allows http:// and https:// schemes
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  // Must start with http:// or https://
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return false;
  }

  // Verify it's a parseable URL
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

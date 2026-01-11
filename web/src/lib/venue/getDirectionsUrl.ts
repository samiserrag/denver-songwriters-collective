/**
 * getVenueDirectionsUrl - Generates a Google Maps Directions URL for a venue
 *
 * This is specifically for "Get Directions" functionality.
 * ALWAYS returns a directions URL (/maps/dir/), never a place page URL.
 *
 * Priority:
 * 1. name + fullAddress (best: finds the actual venue)
 * 2. name only (fallback: searches by venue name)
 * 3. null (no usable data)
 *
 * Note: This does NOT use google_maps_url - that's for "View on Maps" button.
 * The directions URL format ensures Google Maps opens in directions mode.
 */

interface VenueDirectionsInput {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export function getVenueDirectionsUrl(venue: VenueDirectionsInput): string | null {
  if (!venue) return null;

  const { name, address, city, state, zip } = venue;

  // Build full address from components
  const addressParts = [address, city, state, zip].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : null;

  // Priority 1: name + address (best match)
  if (name && fullAddress) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${name} ${fullAddress}`)}`;
  }

  // Priority 2: name only (fallback)
  if (name) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name)}`;
  }

  // No usable data
  return null;
}

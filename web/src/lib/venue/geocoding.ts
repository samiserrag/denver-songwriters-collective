/**
 * Venue Geocoding Service
 *
 * Phase 0.6: Automatic geocoding for venue addresses.
 * Uses Google Geocoding API to convert addresses to coordinates.
 *
 * Design Decisions:
 * - Server-side only (API key not exposed to client)
 * - Silent failure (never blocks venue saves)
 * - Supports manual override (if lat/lng provided, use them)
 */

// =============================================================================
// Types
// =============================================================================

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  geocode_source: "api" | "manual";
  geocoded_at: string;
}

export interface VenueAddressFields {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

interface GoogleGeocodingResponse {
  status: string;
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

// =============================================================================
// Constants
// =============================================================================

const GEOCODING_API_URL = "https://maps.googleapis.com/maps/api/geocode/json";

// Colorado bounding box for validation
const COLORADO_BOUNDS = {
  minLat: 36.99,
  maxLat: 41.01,
  minLng: -109.06,
  maxLng: -102.04,
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Geocode a venue address using Google Geocoding API.
 *
 * @returns GeocodingResult if successful, null if failed
 */
export async function geocodeVenueAddress(
  address: VenueAddressFields
): Promise<GeocodingResult | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;

  if (!apiKey) {
    console.warn("[Geocoding] GOOGLE_GEOCODING_API_KEY not configured");
    return null;
  }

  // Build address string
  const addressParts = [
    address.address,
    address.city,
    address.state,
    address.zip,
  ].filter(Boolean);

  if (addressParts.length < 2) {
    console.warn("[Geocoding] Insufficient address data for geocoding");
    return null;
  }

  const fullAddress = addressParts.join(", ");

  try {
    const url = new URL(GEOCODING_API_URL);
    url.searchParams.append("address", fullAddress);
    url.searchParams.append("key", apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error("[Geocoding] API request failed:", response.status);
      return null;
    }

    const data: GoogleGeocodingResponse = await response.json();

    if (data.status !== "OK" || !data.results?.[0]) {
      console.warn("[Geocoding] No results for address:", fullAddress);
      return null;
    }

    const location = data.results[0].geometry.location;
    const { lat, lng } = location;

    // Validate coordinates are within Colorado (sanity check)
    if (!isWithinColorado(lat, lng)) {
      console.warn(
        "[Geocoding] Coordinates outside Colorado bounds:",
        lat,
        lng
      );
      // Still return the result - let the caller decide what to do
    }

    return {
      latitude: lat,
      longitude: lng,
      geocode_source: "api",
      geocoded_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[Geocoding] Error geocoding address:", error);
    return null;
  }
}

/**
 * Check if coordinates are within Colorado bounding box.
 */
export function isWithinColorado(lat: number, lng: number): boolean {
  return (
    lat >= COLORADO_BOUNDS.minLat &&
    lat <= COLORADO_BOUNDS.maxLat &&
    lng >= COLORADO_BOUNDS.minLng &&
    lng <= COLORADO_BOUNDS.maxLng
  );
}

/**
 * Determine if we should re-geocode based on address field changes.
 *
 * @param oldVenue Previous venue state (or null for new venues)
 * @param newVenue New venue data being saved
 * @returns true if address fields changed and geocoding is needed
 */
export function shouldRegeocode(
  oldVenue: VenueAddressFields | null,
  newVenue: VenueAddressFields
): boolean {
  // New venue - always geocode if we have address data
  if (!oldVenue) {
    return Boolean(newVenue.address || newVenue.city);
  }

  // Check if any address field changed
  const addressFields: (keyof VenueAddressFields)[] = [
    "address",
    "city",
    "state",
    "zip",
  ];

  for (const field of addressFields) {
    const oldValue = normalizeValue(oldVenue[field]);
    const newValue = normalizeValue(newVenue[field]);

    if (oldValue !== newValue) {
      return true;
    }
  }

  return false;
}

/**
 * Normalize a value for comparison (null, undefined, empty string all become null).
 */
function normalizeValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Process venue data for geocoding.
 *
 * This is the main entry point for API routes.
 * Handles the decision of whether to geocode and merges results.
 *
 * @param existingVenue Current venue data (null for new venues)
 * @param updates Updates being applied to the venue
 * @returns Updated fields including coordinates (if geocoded)
 */
export async function processVenueGeocoding(
  existingVenue: (VenueAddressFields & {
    latitude?: number | null;
    longitude?: number | null;
    geocode_source?: string | null;
  }) | null,
  updates: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = { ...updates };

  // If lat/lng are explicitly provided in updates, use them as manual override
  if (
    typeof updates.latitude === "number" &&
    typeof updates.longitude === "number"
  ) {
    result.geocode_source = "manual";
    result.geocoded_at = new Date().toISOString();
    return result;
  }

  // Build the new venue state by merging existing with updates
  const newVenueState: VenueAddressFields = {
    address: (updates.address as string | null | undefined) ?? existingVenue?.address,
    city: (updates.city as string | null | undefined) ?? existingVenue?.city,
    state: (updates.state as string | null | undefined) ?? existingVenue?.state,
    zip: (updates.zip as string | null | undefined) ?? existingVenue?.zip,
  };

  // Check if we need to geocode
  if (!shouldRegeocode(existingVenue, newVenueState)) {
    return result;
  }

  // Perform geocoding
  const geocodeResult = await geocodeVenueAddress(newVenueState);

  if (geocodeResult) {
    result.latitude = geocodeResult.latitude;
    result.longitude = geocodeResult.longitude;
    result.geocode_source = geocodeResult.geocode_source;
    result.geocoded_at = geocodeResult.geocoded_at;
  } else {
    // Geocoding failed - don't block the save, just leave coords as-is
    console.warn("[Geocoding] Failed to geocode, coordinates not updated");
  }

  return result;
}

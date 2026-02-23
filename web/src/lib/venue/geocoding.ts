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
  google_maps_url?: string | null;
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

export type GeocodingStatusReason =
  | "not_required"
  | "manual_override"
  | "google_api_success"
  | "google_maps_url_success"
  | "missing_api_key"
  | "insufficient_address"
  | "no_results"
  | "api_error";

export interface GeocodingStatus {
  attempted: boolean;
  success: boolean;
  reason: GeocodingStatusReason;
  details?: string;
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

const GOOGLE_MAPS_3D_4D_REGEX = /!3d(-?[0-9]+\.[0-9]+)!4d(-?[0-9]+\.[0-9]+)/;
const GOOGLE_MAPS_AT_REGEX = /@(-?[0-9]+\.[0-9]+),(-?[0-9]+\.[0-9]+)/;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCoordsFromMapsString(input: string): { latitude: number; longitude: number } | null {
  const from3d4d = input.match(GOOGLE_MAPS_3D_4D_REGEX);
  if (from3d4d) {
    return {
      latitude: Number.parseFloat(from3d4d[1]),
      longitude: Number.parseFloat(from3d4d[2]),
    };
  }

  const fromAt = input.match(GOOGLE_MAPS_AT_REGEX);
  if (fromAt) {
    return {
      latitude: Number.parseFloat(fromAt[1]),
      longitude: Number.parseFloat(fromAt[2]),
    };
  }

  return null;
}

async function geocodeFromGoogleMapsUrl(
  googleMapsUrl: string
): Promise<{ result: GeocodingResult | null; details?: string }> {
  const trimmed = googleMapsUrl.trim();
  if (!trimmed) return { result: null, details: "Empty google_maps_url" };

  // Full Google Maps links often already embed coordinates.
  const directCoords = parseCoordsFromMapsString(trimmed);
  if (directCoords) {
    return {
      result: {
        latitude: directCoords.latitude,
        longitude: directCoords.longitude,
        geocode_source: "api",
        geocoded_at: new Date().toISOString(),
      },
    };
  }

  try {
    // Short links usually return a redirect with a Location header containing coords.
    const response = await fetch(trimmed, { method: "HEAD", redirect: "manual" });
    const redirectLocation = response.headers.get("location");
    if (!redirectLocation) {
      return { result: null, details: "No redirect location in google_maps_url HEAD response" };
    }

    const redirectedCoords = parseCoordsFromMapsString(redirectLocation);
    if (!redirectedCoords) {
      return { result: null, details: "Redirect URL did not include parseable coordinates" };
    }

    return {
      result: {
        latitude: redirectedCoords.latitude,
        longitude: redirectedCoords.longitude,
        geocode_source: "api",
        geocoded_at: new Date().toISOString(),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown google_maps_url parse error";
    return { result: null, details: message };
  }
}

async function geocodeVenueAddressWithStatus(
  address: VenueAddressFields
): Promise<{ result: GeocodingResult | null; status: GeocodingStatus }> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    const details = "Missing Google API key (GOOGLE_GEOCODING_API_KEY / GOOGLE_MAPS_API_KEY)";
    console.warn(`[Geocoding] ${details}`);
    return {
      result: null,
      status: {
        attempted: true,
        success: false,
        reason: "missing_api_key",
        details,
      },
    };
  }

  const addressParts = [
    address.address,
    address.city,
    address.state,
    address.zip,
  ].filter(Boolean);

  if (addressParts.length < 2) {
    const details = "Insufficient address data for geocoding";
    console.warn(`[Geocoding] ${details}`);
    return {
      result: null,
      status: {
        attempted: true,
        success: false,
        reason: "insufficient_address",
        details,
      },
    };
  }

  const fullAddress = addressParts.join(", ");
  let lastDetails = "Unknown geocoding error";

  // Retry once for transient HTTP/network issues.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const url = new URL(GEOCODING_API_URL);
      url.searchParams.append("address", fullAddress);
      url.searchParams.append("key", apiKey);

      const response = await fetch(url.toString());

      if (!response.ok) {
        lastDetails = `Geocoding API HTTP ${response.status}`;
        if (attempt < 2) {
          await sleep(250);
          continue;
        }
        return {
          result: null,
          status: {
            attempted: true,
            success: false,
            reason: "api_error",
            details: lastDetails,
          },
        };
      }

      const data: GoogleGeocodingResponse = await response.json();

      if (data.status === "OK" && data.results?.[0]) {
        const location = data.results[0].geometry.location;
        const { lat, lng } = location;

        if (!isWithinColorado(lat, lng)) {
          console.warn("[Geocoding] Coordinates outside Colorado bounds:", lat, lng);
        }

        return {
          result: {
            latitude: lat,
            longitude: lng,
            geocode_source: "api",
            geocoded_at: new Date().toISOString(),
          },
          status: {
            attempted: true,
            success: true,
            reason: "google_api_success",
          },
        };
      }

      if (data.status === "ZERO_RESULTS") {
        lastDetails = `No geocoding results for address: ${fullAddress}`;
        return {
          result: null,
          status: {
            attempted: true,
            success: false,
            reason: "no_results",
            details: lastDetails,
          },
        };
      }

      lastDetails = `Geocoding API status: ${data.status}`;
      if (attempt < 2) {
        await sleep(250);
        continue;
      }

      return {
        result: null,
        status: {
          attempted: true,
          success: false,
          reason: "api_error",
          details: lastDetails,
        },
      };
    } catch (error) {
      lastDetails = error instanceof Error ? error.message : "Unknown fetch error";
      if (attempt < 2) {
        await sleep(250);
        continue;
      }
      return {
        result: null,
        status: {
          attempted: true,
          success: false,
          reason: "api_error",
          details: lastDetails,
        },
      };
    }
  }

  return {
    result: null,
    status: {
      attempted: true,
      success: false,
      reason: "api_error",
      details: lastDetails,
    },
  };
}

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
  const { result } = await geocodeVenueAddressWithStatus(address);
  return result;
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
    return Boolean(newVenue.address || newVenue.city || newVenue.google_maps_url);
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
  const { updates: geocodedUpdates } = await processVenueGeocodingWithStatus(
    existingVenue,
    updates
  );
  return geocodedUpdates;
}

export async function processVenueGeocodingWithStatus(
  existingVenue: (VenueAddressFields & {
    latitude?: number | null;
    longitude?: number | null;
    geocode_source?: string | null;
  }) | null,
  updates: Record<string, unknown>
): Promise<{ updates: Record<string, unknown>; geocodingStatus: GeocodingStatus }> {
  const result = { ...updates };

  // If lat/lng are explicitly provided in updates, use them as manual override
  if (
    typeof updates.latitude === "number" &&
    typeof updates.longitude === "number"
  ) {
    result.geocode_source = "manual";
    result.geocoded_at = new Date().toISOString();
    return {
      updates: result,
      geocodingStatus: {
        attempted: false,
        success: true,
        reason: "manual_override",
      },
    };
  }

  // Build the new venue state by merging existing with updates
  const newVenueState: VenueAddressFields = {
    address: (updates.address as string | null | undefined) ?? existingVenue?.address,
    city: (updates.city as string | null | undefined) ?? existingVenue?.city,
    state: (updates.state as string | null | undefined) ?? existingVenue?.state,
    zip: (updates.zip as string | null | undefined) ?? existingVenue?.zip,
    google_maps_url:
      (updates.google_maps_url as string | null | undefined) ??
      existingVenue?.google_maps_url,
  };

  // Check if we need to geocode
  if (!shouldRegeocode(existingVenue, newVenueState)) {
    return {
      updates: result,
      geocodingStatus: {
        attempted: false,
        success: false,
        reason: "not_required",
      },
    };
  }

  // Perform geocoding
  const { result: geocodeResult, status } = await geocodeVenueAddressWithStatus(
    newVenueState
  );

  if (geocodeResult) {
    result.latitude = geocodeResult.latitude;
    result.longitude = geocodeResult.longitude;
    result.geocode_source = geocodeResult.geocode_source;
    result.geocoded_at = geocodeResult.geocoded_at;
    return {
      updates: result,
      geocodingStatus: status,
    };
  }

  if (newVenueState.google_maps_url) {
    const urlFallback = await geocodeFromGoogleMapsUrl(newVenueState.google_maps_url);
    if (urlFallback.result) {
      result.latitude = urlFallback.result.latitude;
      result.longitude = urlFallback.result.longitude;
      result.geocode_source = urlFallback.result.geocode_source;
      result.geocoded_at = urlFallback.result.geocoded_at;
      return {
        updates: result,
        geocodingStatus: {
          attempted: true,
          success: true,
          reason: "google_maps_url_success",
          details: "Resolved coordinates from google_maps_url fallback",
        },
      };
    }

    return {
      updates: result,
      geocodingStatus: {
        ...status,
        details: [
          status.details,
          urlFallback.details
            ? `google_maps_url fallback failed: ${urlFallback.details}`
            : null,
        ]
          .filter(Boolean)
          .join(" | "),
      },
    };
  }

  // Geocoding failed - don't block the save, but report explicit status
  console.warn("[Geocoding] Failed to geocode, coordinates not updated");
  return {
    updates: result,
    geocodingStatus: status,
  };
}

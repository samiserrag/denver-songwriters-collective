/**
 * Phase 1.4: Location Filter for Happenings
 *
 * Provides city/ZIP-based filtering with radius-based "nearby" expansion.
 * Uses venue lat/lng data only (no external geocoding).
 *
 * Key concepts:
 * - Centroid: average lat/lng of exact-match venues WITH coordinates
 * - Nearby: venues within radius miles of centroid (Haversine distance)
 * - Bounding box pre-filter: narrows candidates before Haversine computation
 */

import { SupabaseClient } from "@supabase/supabase-js";

// Valid radius options in miles
export const VALID_RADII = [5, 10, 25, 50] as const;
export type ValidRadius = (typeof VALID_RADII)[number];
export const DEFAULT_RADIUS: ValidRadius = 10;

export interface LocationFilterResult {
  /** All venue IDs to include (exact matches + nearby) */
  includedVenueIds: string[];
  /** Only the exact-match venue IDs (by zip or city) */
  exactMatchVenueIds: string[];
  /** Computed centroid from exact matches with coords, or null if none have coords */
  centroid: { lat: number; lng: number } | null;
  /** Count of exact-match venues */
  exactMatchCount: number;
  /** Count of nearby venues (excluding exact matches) */
  nearbyCount: number;
  /** Reason for empty result, or null if venues found */
  emptyReason: "no_venues" | "no_coords" | null;
  /** Which filter mode was used */
  mode: "zip" | "city" | null;
  /** Normalized input values */
  normalized: {
    zip?: string;
    city?: string;
    radiusMiles: ValidRadius;
  };
}

/**
 * Normalize radius input to valid value.
 * Invalid/missing values coerce to default (10).
 */
export function normalizeRadiusMiles(input?: string): ValidRadius {
  if (!input) return DEFAULT_RADIUS;

  const parsed = parseInt(input, 10);
  if (isNaN(parsed)) return DEFAULT_RADIUS;

  // Find closest valid radius or default
  if (VALID_RADII.includes(parsed as ValidRadius)) {
    return parsed as ValidRadius;
  }

  return DEFAULT_RADIUS;
}

/**
 * Normalize city input.
 * - Trims whitespace
 * - Strips state suffix after comma (e.g., "Denver, CO" -> "Denver")
 */
export function normalizeCity(input?: string): string | undefined {
  if (!input) return undefined;

  let cleaned = input.trim();
  if (!cleaned) return undefined;

  // Strip state suffix after comma
  const commaIndex = cleaned.indexOf(",");
  if (commaIndex > 0) {
    cleaned = cleaned.substring(0, commaIndex).trim();
  }

  return cleaned || undefined;
}

/**
 * Normalize ZIP input.
 * - Trims whitespace
 * - Removes internal spaces
 */
export function normalizeZip(input?: string): string | undefined {
  if (!input) return undefined;

  const cleaned = input.trim().replace(/\s+/g, "");
  return cleaned || undefined;
}

/**
 * Compute Haversine distance between two points in miles.
 */
export function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Compute bounding box for a radius around a centroid.
 * Returns lat/lng min/max values.
 */
export function computeBoundingBox(
  centroidLat: number,
  centroidLng: number,
  radiusMiles: number
): {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
} {
  // 1 degree latitude ≈ 69 miles
  const latDelta = radiusMiles / 69;

  // Longitude varies by latitude; cos(lat) factor
  // Guard against extreme latitudes (won't happen in Colorado, but be safe)
  const cosLat = Math.max(0.01, Math.cos((centroidLat * Math.PI) / 180));
  const lngDelta = radiusMiles / (69 * cosLat);

  return {
    latMin: centroidLat - latDelta,
    latMax: centroidLat + latDelta,
    lngMin: centroidLng - lngDelta,
    lngMax: centroidLng + lngDelta,
  };
}

interface VenueWithCoords {
  id: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Get location-filtered venue IDs based on city or ZIP with radius.
 *
 * Algorithm:
 * 1. Query exact-match venues by zip or city
 * 2. Compute centroid from exact matches with coords
 * 3. If centroid exists, query nearby venues within radius
 * 4. Return union of exact matches + nearby
 */
export async function getLocationFilteredVenues(
  supabase: SupabaseClient,
  params: {
    zip?: string;
    city?: string;
    radiusMiles?: number;
  }
): Promise<LocationFilterResult> {
  const radiusMiles = normalizeRadiusMiles(String(params.radiusMiles ?? ""));
  const normalizedZip = normalizeZip(params.zip);
  const normalizedCity = normalizeCity(params.city);

  // ZIP wins over city
  const mode: "zip" | "city" | null = normalizedZip
    ? "zip"
    : normalizedCity
      ? "city"
      : null;

  // No location filter requested
  if (!mode) {
    return {
      includedVenueIds: [],
      exactMatchVenueIds: [],
      centroid: null,
      exactMatchCount: 0,
      nearbyCount: 0,
      emptyReason: null,
      mode: null,
      normalized: { radiusMiles },
    };
  }

  // Step 1: Query exact-match venues
  let exactMatchQuery = supabase
    .from("venues")
    .select("id, latitude, longitude");

  if (mode === "zip") {
    exactMatchQuery = exactMatchQuery.eq("zip", normalizedZip!);
  } else {
    // Case-insensitive city match using ilike for exact match
    exactMatchQuery = exactMatchQuery.ilike("city", normalizedCity!);
  }

  const { data: exactMatches, error: exactError } = await exactMatchQuery;

  if (exactError) {
    console.error("[locationFilter] Exact match query error:", exactError);
    return {
      includedVenueIds: [],
      exactMatchVenueIds: [],
      centroid: null,
      exactMatchCount: 0,
      nearbyCount: 0,
      emptyReason: "no_venues",
      mode,
      normalized: {
        zip: normalizedZip,
        city: normalizedCity,
        radiusMiles,
      },
    };
  }

  const exactMatchVenues = (exactMatches || []) as VenueWithCoords[];

  // No venues match the zip/city
  if (exactMatchVenues.length === 0) {
    return {
      includedVenueIds: [],
      exactMatchVenueIds: [],
      centroid: null,
      exactMatchCount: 0,
      nearbyCount: 0,
      emptyReason: "no_venues",
      mode,
      normalized: {
        zip: normalizedZip,
        city: normalizedCity,
        radiusMiles,
      },
    };
  }

  const exactMatchIds = exactMatchVenues.map((v) => v.id);

  // Step 2: Compute centroid from venues WITH coords
  const venuesWithCoords = exactMatchVenues.filter(
    (v) => v.latitude !== null && v.longitude !== null
  );

  if (venuesWithCoords.length === 0) {
    // Venues exist but none have coords - can't compute centroid or nearby
    return {
      includedVenueIds: exactMatchIds,
      exactMatchVenueIds: exactMatchIds,
      centroid: null,
      exactMatchCount: exactMatchVenues.length,
      nearbyCount: 0,
      emptyReason: "no_coords",
      mode,
      normalized: {
        zip: normalizedZip,
        city: normalizedCity,
        radiusMiles,
      },
    };
  }

  // Compute centroid
  const sumLat = venuesWithCoords.reduce((sum, v) => sum + v.latitude!, 0);
  const sumLng = venuesWithCoords.reduce((sum, v) => sum + v.longitude!, 0);
  const centroid = {
    lat: sumLat / venuesWithCoords.length,
    lng: sumLng / venuesWithCoords.length,
  };

  // Step 3: Query nearby venues within radius using bounding box + Haversine
  const bbox = computeBoundingBox(centroid.lat, centroid.lng, radiusMiles);

  // Query candidates in bounding box (excluding exact matches to avoid duplicates)
  const { data: nearbyCandidates, error: nearbyError } = await supabase
    .from("venues")
    .select("id, latitude, longitude")
    .not("id", "in", `(${exactMatchIds.join(",")})`)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", bbox.latMin)
    .lte("latitude", bbox.latMax)
    .gte("longitude", bbox.lngMin)
    .lte("longitude", bbox.lngMax);

  if (nearbyError) {
    console.error("[locationFilter] Nearby query error:", nearbyError);
    // Still return exact matches even if nearby query fails
    return {
      includedVenueIds: exactMatchIds,
      exactMatchVenueIds: exactMatchIds,
      centroid,
      exactMatchCount: exactMatchVenues.length,
      nearbyCount: 0,
      emptyReason: null,
      mode,
      normalized: {
        zip: normalizedZip,
        city: normalizedCity,
        radiusMiles,
      },
    };
  }

  // Step 4: Apply Haversine filter to candidates
  const nearbyVenues = ((nearbyCandidates || []) as VenueWithCoords[]).filter(
    (v) => {
      const distance = haversineDistanceMiles(
        centroid.lat,
        centroid.lng,
        v.latitude!,
        v.longitude!
      );
      return distance <= radiusMiles;
    }
  );

  const nearbyIds = nearbyVenues.map((v) => v.id);

  // Union of exact matches + nearby
  const includedVenueIds = [...new Set([...exactMatchIds, ...nearbyIds])];

  return {
    includedVenueIds,
    exactMatchVenueIds: exactMatchIds,
    centroid,
    exactMatchCount: exactMatchVenues.length,
    nearbyCount: nearbyIds.length,
    emptyReason: null,
    mode,
    normalized: {
      zip: normalizedZip,
      city: normalizedCity,
      radiusMiles,
    },
  };
}

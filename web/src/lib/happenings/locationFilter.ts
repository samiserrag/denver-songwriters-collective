/**
 * Phase 1.4: Location Filter for Happenings
 *
 * Provides city/ZIP-based filtering with radius-based "nearby" expansion.
 * Uses venue lat/lng data and ZIP centroid geocoding fallback.
 *
 * Key concepts:
 * - Centroid: average lat/lng of exact-match venues WITH coordinates
 * - Nearby: venues within radius miles of centroid (Haversine distance)
 * - Bounding box pre-filter: narrows candidates before Haversine computation
 */

import { SupabaseClient } from "@supabase/supabase-js";

// Valid radius options in miles
export const VALID_RADII = [5, 10, 15, 25, 50] as const;
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
  emptyReason: "no_venues" | "no_coords" | "invalid_zip" | "zip_lookup_failed" | null;
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

interface GoogleGeocodingResponse {
  status: string;
  results?: Array<{
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

type ZipCentroidLookupResult =
  | { ok: true; centroid: { lat: number; lng: number } }
  | { ok: false; reason: "invalid_zip" | "zip_lookup_failed" };

interface ZipCentroidCacheEntry {
  expiresAt: number;
  result: ZipCentroidLookupResult;
}

const GEOCODING_API_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const ZIP_LOOKUP_SUCCESS_CACHE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const ZIP_LOOKUP_FAILURE_CACHE_MS = 1000 * 60 * 60; // 1 hour
const zipCentroidCache = new Map<string, ZipCentroidCacheEntry>();

/**
 * Normalize ZIP input to canonical US 5-digit ZIP.
 * Accepts ZIP+4, returns first 5 digits.
 */
export function normalizeUsZip5(input?: string): string | undefined {
  const normalized = normalizeZip(input);
  if (!normalized) return undefined;

  const match = normalized.match(/^(\d{5})(?:-\d{4})?$/);
  if (!match) return undefined;

  return match[1];
}

async function lookupZipCentroid(zip5: string): Promise<ZipCentroidLookupResult> {
  const cached = zipCentroidCache.get(zip5);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  if (cached) {
    zipCentroidCache.delete(zip5);
  }

  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    const failure: ZipCentroidLookupResult = {
      ok: false,
      reason: "zip_lookup_failed",
    };
    zipCentroidCache.set(zip5, {
      expiresAt: Date.now() + ZIP_LOOKUP_FAILURE_CACHE_MS,
      result: failure,
    });
    return failure;
  }

  try {
    const url = new URL(GEOCODING_API_URL);
    url.searchParams.append("components", `postal_code:${zip5}|country:US`);
    url.searchParams.append("key", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      const failure: ZipCentroidLookupResult = {
        ok: false,
        reason: "zip_lookup_failed",
      };
      zipCentroidCache.set(zip5, {
        expiresAt: Date.now() + ZIP_LOOKUP_FAILURE_CACHE_MS,
        result: failure,
      });
      return failure;
    }

    const data: GoogleGeocodingResponse = await response.json();
    if (data.status === "ZERO_RESULTS") {
      const failure: ZipCentroidLookupResult = {
        ok: false,
        reason: "invalid_zip",
      };
      zipCentroidCache.set(zip5, {
        expiresAt: Date.now() + ZIP_LOOKUP_FAILURE_CACHE_MS,
        result: failure,
      });
      return failure;
    }

    const location = data.results?.[0]?.geometry?.location;
    if (data.status === "OK" && location) {
      const success: ZipCentroidLookupResult = {
        ok: true,
        centroid: { lat: location.lat, lng: location.lng },
      };
      zipCentroidCache.set(zip5, {
        expiresAt: Date.now() + ZIP_LOOKUP_SUCCESS_CACHE_MS,
        result: success,
      });
      return success;
    }

    const failure: ZipCentroidLookupResult = {
      ok: false,
      reason: "zip_lookup_failed",
    };
    zipCentroidCache.set(zip5, {
      expiresAt: Date.now() + ZIP_LOOKUP_FAILURE_CACHE_MS,
      result: failure,
    });
    return failure;
  } catch {
    const failure: ZipCentroidLookupResult = {
      ok: false,
      reason: "zip_lookup_failed",
    };
    zipCentroidCache.set(zip5, {
      expiresAt: Date.now() + ZIP_LOOKUP_FAILURE_CACHE_MS,
      result: failure,
    });
    return failure;
  }
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
  const normalizedZipInput = normalizeZip(params.zip);
  const normalizedZip5 = normalizeUsZip5(params.zip);
  const normalizedCity = normalizeCity(params.city);
  const zipRequested = Boolean(normalizedZipInput);

  // ZIP wins over city
  const mode: "zip" | "city" | null = zipRequested
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

  // ZIP provided but invalid format (must be 5 digits or ZIP+4)
  if (mode === "zip" && !normalizedZip5) {
    return {
      includedVenueIds: [],
      exactMatchVenueIds: [],
      centroid: null,
      exactMatchCount: 0,
      nearbyCount: 0,
      emptyReason: "invalid_zip",
      mode,
      normalized: {
        zip: normalizedZipInput,
        city: normalizedCity,
        radiusMiles,
      },
    };
  }

  // Step 1: Query exact-match venues
  let exactMatchQuery = supabase
    .from("venues")
    .select("id, latitude, longitude");

  if (mode === "zip") {
    exactMatchQuery = exactMatchQuery.eq("zip", normalizedZip5!);
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
        zip: normalizedZipInput,
        city: normalizedCity,
        radiusMiles,
      },
    };
  }

  const exactMatchVenues = (exactMatches || []) as VenueWithCoords[];

  // No venues match the city (ZIP may still fall back to geocoding)
  if (exactMatchVenues.length === 0 && mode === "city") {
    return {
      includedVenueIds: [],
      exactMatchVenueIds: [],
      centroid: null,
      exactMatchCount: 0,
      nearbyCount: 0,
      emptyReason: "no_venues",
      mode,
      normalized: {
        zip: normalizedZipInput,
        city: normalizedCity,
        radiusMiles,
      },
    };
  }

  const exactMatchIds = exactMatchVenues.map((v) => v.id);
  const exactMatchCount = exactMatchVenues.length;
  let centroid: { lat: number; lng: number } | null = null;

  if (exactMatchVenues.length === 0 && mode === "zip") {
    const zipLookup = await lookupZipCentroid(normalizedZip5!);
    if (!zipLookup.ok) {
      return {
        includedVenueIds: [],
        exactMatchVenueIds: [],
        centroid: null,
        exactMatchCount: 0,
        nearbyCount: 0,
        emptyReason: zipLookup.reason,
        mode,
        normalized: {
          zip: normalizedZip5,
          city: normalizedCity,
          radiusMiles,
        },
      };
    }

    centroid = zipLookup.centroid;
  }

  // Step 2: Compute centroid from venues WITH coords
  if (!centroid) {
    const venuesWithCoords = exactMatchVenues.filter(
      (v) => v.latitude !== null && v.longitude !== null
    );

    if (venuesWithCoords.length === 0) {
      // Venues exist but none have coords - can't compute centroid or nearby
      return {
        includedVenueIds: exactMatchIds,
        exactMatchVenueIds: exactMatchIds,
        centroid: null,
        exactMatchCount,
        nearbyCount: 0,
        emptyReason: "no_coords",
        mode,
        normalized: {
          zip: normalizedZip5 ?? normalizedZipInput,
          city: normalizedCity,
          radiusMiles,
        },
      };
    }

    // Compute centroid from exact-match venues
    const sumLat = venuesWithCoords.reduce((sum, v) => sum + v.latitude!, 0);
    const sumLng = venuesWithCoords.reduce((sum, v) => sum + v.longitude!, 0);
    centroid = {
      lat: sumLat / venuesWithCoords.length,
      lng: sumLng / venuesWithCoords.length,
    };
  }

  // Step 3: Query nearby venues within radius using bounding box + Haversine
  const bbox = computeBoundingBox(centroid.lat, centroid.lng, radiusMiles);

  // Query candidates in bounding box (excluding exact matches to avoid duplicates)
  let nearbyQuery = supabase
    .from("venues")
    .select("id, latitude, longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", bbox.latMin)
    .lte("latitude", bbox.latMax)
    .gte("longitude", bbox.lngMin)
    .lte("longitude", bbox.lngMax);

  if (exactMatchIds.length > 0) {
    nearbyQuery = nearbyQuery.not("id", "in", `(${exactMatchIds.join(",")})`);
  }

  const { data: nearbyCandidates, error: nearbyError } = await nearbyQuery;

  if (nearbyError) {
    console.error("[locationFilter] Nearby query error:", nearbyError);
    // Still return exact matches even if nearby query fails.
    // If no exact matches exist (ZIP geocode fallback path), return empty result.
    if (exactMatchIds.length === 0) {
      return {
        includedVenueIds: [],
        exactMatchVenueIds: [],
        centroid,
        exactMatchCount,
        nearbyCount: 0,
        emptyReason: "no_venues",
        mode,
        normalized: {
          zip: normalizedZip5 ?? normalizedZipInput,
          city: normalizedCity,
          radiusMiles,
        },
      };
    }

    return {
      includedVenueIds: exactMatchIds,
      exactMatchVenueIds: exactMatchIds,
      centroid,
      exactMatchCount,
      nearbyCount: 0,
      emptyReason: null,
      mode,
      normalized: {
        zip: normalizedZip5 ?? normalizedZipInput,
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

  // ZIP geocoded successfully but no venues found in radius
  if (includedVenueIds.length === 0) {
    return {
      includedVenueIds: [],
      exactMatchVenueIds: exactMatchIds,
      centroid,
      exactMatchCount,
      nearbyCount: 0,
      emptyReason: "no_venues",
      mode,
      normalized: {
        zip: normalizedZip5 ?? normalizedZipInput,
        city: normalizedCity,
        radiusMiles,
      },
    };
  }

  return {
    includedVenueIds,
    exactMatchVenueIds: exactMatchIds,
    centroid,
    exactMatchCount,
    nearbyCount: nearbyIds.length,
    emptyReason: null,
    mode,
    normalized: {
      zip: normalizedZip5 ?? normalizedZipInput,
      city: normalizedCity,
      radiusMiles,
    },
  };
}

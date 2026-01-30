/**
 * Phase 1.0: Map Pin Data Adapter
 *
 * Transforms occurrence data into MapPin format for rendering on the map.
 * Groups multiple events at the same venue into a single pin.
 *
 * STOP-GATE 1 Contract:
 * - One pin per venue (multiple events grouped)
 * - Coordinate resolution: override venue > event venue > custom coords
 * - Online-only events excluded
 * - Missing coordinates logged and excluded
 */

import type { EventOccurrenceEntry } from "@/lib/events/nextOccurrence";
import type { EventType } from "@/types/events";

/**
 * A single event displayed on a map pin.
 */
export interface MapPinEvent {
  /** Event identity */
  eventId: string;
  eventSlug: string;

  /** Display fields */
  title: string;
  eventType: EventType;

  /** Occurrence-specific */
  dateKey: string;
  displayDate: string;
  startTime: string | null;

  /** Link construction */
  href: string;

  /** Visual indicators */
  isCancelled: boolean;
  isRescheduled: boolean;
}

/**
 * A map pin representing a venue with one or more events.
 */
export interface MapPinData {
  /** Venue-level grouping key */
  venueId: string;

  /** Pin coordinates (required - never null in Map View) */
  latitude: number;
  longitude: number;

  /** Venue display info */
  venueName: string;
  venueSlug: string | null;

  /** Events at this venue (1 or more) */
  events: MapPinEvent[];
}

/**
 * Venue data shape from the joined query.
 */
interface VenueData {
  id: string;
  name: string;
  slug?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
}

/**
 * Override venue map shape.
 */
interface OverrideVenueData {
  name: string;
  slug?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
}

/**
 * Configuration for map pin generation.
 */
export interface MapPinConfig {
  /** Max pins to render before showing fallback message */
  maxPins: number;
  /** Override venue map for resolving override_patch.venue_id */
  overrideVenueMap?: Map<string, OverrideVenueData>;
}

/**
 * Result of map pin generation.
 */
export interface MapPinResult {
  /** Pins ready to render (grouped by venue) */
  pins: MapPinData[];
  /** Number of events excluded due to missing coordinates */
  excludedMissingCoords: number;
  /** Number of events excluded due to online-only location */
  excludedOnlineOnly: number;
  /** Whether max pin limit was exceeded */
  limitExceeded: boolean;
  /** Total events processed */
  totalProcessed: number;
}

/**
 * Format a date key into a display date string.
 */
function formatDisplayDate(dateKey: string): string {
  const date = new Date(dateKey + "T12:00:00Z");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Denver",
  });
}

/**
 * Format time from HH:MM:SS to display format.
 */
function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

/**
 * Resolve coordinates for an occurrence.
 *
 * Priority:
 * 1. override_patch.venue_id -> lookup venue coords
 * 2. event.venue_id -> lookup venue coords
 * 3. event.custom_latitude/custom_longitude
 * 4. null (excluded from map)
 */
function resolveCoordinates(
  entry: EventOccurrenceEntry<any>,
  overrideVenueMap?: Map<string, OverrideVenueData>
): {
  latitude: number;
  longitude: number;
  venueName: string;
  venueSlug: string | null;
  venueId: string;
} | null {
  const event = entry.event;
  const overridePatch = entry.override?.override_patch as Record<string, unknown> | null;

  // Priority 1: Override venue
  const overrideVenueId = overridePatch?.venue_id as string | undefined;
  if (overrideVenueId && overrideVenueMap) {
    const overrideVenue = overrideVenueMap.get(overrideVenueId);
    if (
      overrideVenue &&
      typeof overrideVenue.latitude === "number" &&
      typeof overrideVenue.longitude === "number"
    ) {
      return {
        latitude: overrideVenue.latitude,
        longitude: overrideVenue.longitude,
        venueName: overrideVenue.name,
        venueSlug: overrideVenue.slug || null,
        venueId: overrideVenueId,
      };
    }
  }

  // Priority 2: Event venue (from joined query)
  const venue = event.venue as VenueData | null;
  if (venue && typeof venue.latitude === "number" && typeof venue.longitude === "number") {
    return {
      latitude: venue.latitude,
      longitude: venue.longitude,
      venueName: venue.name,
      venueSlug: venue.slug || null,
      venueId: venue.id,
    };
  }

  // Priority 3: Custom location coordinates
  if (
    typeof event.custom_latitude === "number" &&
    typeof event.custom_longitude === "number"
  ) {
    const customName =
      event.custom_location_name ||
      (event.custom_city && event.custom_state
        ? `${event.custom_city}, ${event.custom_state}`
        : "Custom Location");
    return {
      latitude: event.custom_latitude,
      longitude: event.custom_longitude,
      venueName: customName,
      venueSlug: null,
      venueId: `custom-${event.id}-${entry.dateKey}`,
    };
  }

  // No coordinates available
  return null;
}

/**
 * Check if an event is online-only (no physical location).
 */
function isOnlineOnly(event: any): boolean {
  return event.location_mode === "online";
}

/**
 * Transform occurrence entries into map pin data.
 *
 * Groups events by venue and excludes online-only events and
 * events without coordinates.
 */
export function occurrencesToMapPins(
  entries: EventOccurrenceEntry<any>[],
  config: MapPinConfig
): MapPinResult {
  const { maxPins, overrideVenueMap } = config;

  let excludedMissingCoords = 0;
  let excludedOnlineOnly = 0;
  const totalProcessed = entries.length;

  // Group by venue
  const pinsByVenue = new Map<string, MapPinData>();

  for (const entry of entries) {
    // Skip online-only events
    if (isOnlineOnly(entry.event)) {
      excludedOnlineOnly++;
      continue;
    }

    // Resolve coordinates
    const coords = resolveCoordinates(entry, overrideVenueMap);
    if (!coords) {
      excludedMissingCoords++;
      if (excludedMissingCoords <= 10) {
        // Provide specific reason for exclusion
        const reason = entry.event.location_mode === "venue" && !entry.event.venue_id
          ? "location_mode='venue' but venue_id is NULL"
          : "no coordinates available";
        console.warn(
          `[MapPin] Event "${entry.event.title}" (${entry.event.id}) excluded from map: ${reason}`
        );
      }
      continue;
    }

    const { latitude, longitude, venueName, venueSlug, venueId } = coords;

    // Create or update pin for this venue
    let pin = pinsByVenue.get(venueId);
    if (!pin) {
      pin = {
        venueId,
        latitude,
        longitude,
        venueName,
        venueSlug,
        events: [],
      };
      pinsByVenue.set(venueId, pin);
    }

    // Create event entry
    const mapEvent: MapPinEvent = {
      eventId: entry.event.id,
      eventSlug: entry.event.slug || entry.event.id,
      title: entry.event.title || "Untitled Event",
      eventType: entry.event.event_type || "other",
      dateKey: entry.dateKey,
      displayDate: formatDisplayDate(entry.displayDate || entry.dateKey),
      startTime: formatTime(
        entry.override?.override_start_time || entry.event.start_time
      ),
      href: `/events/${entry.event.slug || entry.event.id}?date=${entry.dateKey}`,
      isCancelled: entry.isCancelled || false,
      isRescheduled: entry.isRescheduled || false,
    };

    pin.events.push(mapEvent);
  }

  // Sort events within each pin by date/time
  for (const pin of pinsByVenue.values()) {
    pin.events.sort((a, b) => {
      const dateCompare = a.dateKey.localeCompare(b.dateKey);
      if (dateCompare !== 0) return dateCompare;
      // Same date, sort by time
      if (a.startTime && b.startTime) {
        return a.startTime.localeCompare(b.startTime);
      }
      return 0;
    });
  }

  // Convert to array
  const pins = Array.from(pinsByVenue.values());

  // Check limit
  const limitExceeded = pins.length > maxPins;

  return {
    pins: limitExceeded ? [] : pins,
    excludedMissingCoords,
    excludedOnlineOnly,
    limitExceeded,
    totalProcessed,
  };
}

/**
 * Constants for map configuration.
 */
export const MAP_DEFAULTS = {
  /** Denver metro center */
  CENTER: {
    lat: 39.7392,
    lng: -104.9903,
  },
  /** Default zoom level */
  ZOOM: 11,
  /** Zoom threshold for clustering (desktop) */
  CLUSTER_ZOOM_DESKTOP: 12,
  /** Zoom threshold for clustering (mobile) */
  CLUSTER_ZOOM_MOBILE: 14,
  /** Max pins before showing fallback message */
  MAX_PINS: 500,
} as const;

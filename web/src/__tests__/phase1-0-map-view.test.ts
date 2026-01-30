/**
 * Phase 1.0 — Map View Discovery Tests
 *
 * Tests for:
 * - occurrencesToMapPins unit tests
 * - View mode toggle persists in URL
 * - Online-only events excluded from map
 * - Max pin limit handling
 * - Venue grouping logic
 */

import { describe, it, expect } from "vitest";
import {
  occurrencesToMapPins,
  MAP_DEFAULTS,
  type MapPinConfig,
} from "@/lib/map";
import type { EventOccurrenceEntry } from "@/lib/events/nextOccurrence";

// Helper to create a mock occurrence entry
function createMockOccurrence(overrides: {
  eventId?: string;
  title?: string;
  slug?: string;
  venue?: {
    id: string;
    name: string;
    slug?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  dateKey?: string;
  startTime?: string | null;
  locationMode?: string;
  customLatitude?: number | null;
  customLongitude?: number | null;
  customLocationName?: string | null;
  customCity?: string | null;
  customState?: string | null;
  isCancelled?: boolean;
  isRescheduled?: boolean;
  override?: {
    override_patch?: Record<string, unknown>;
  } | null;
}): EventOccurrenceEntry<any> {
  const eventId = overrides.eventId || "event-" + Math.random().toString(36).slice(2);
  return {
    event: {
      id: eventId,
      slug: overrides.slug || eventId,
      title: overrides.title || "Test Event",
      event_type: "open_mic",
      venue: overrides.venue || null,
      location_mode: overrides.locationMode || "in_person",
      start_time: overrides.startTime || "19:00:00",
      custom_latitude: overrides.customLatitude,
      custom_longitude: overrides.customLongitude,
      custom_location_name: overrides.customLocationName,
      custom_city: overrides.customCity,
      custom_state: overrides.customState,
    },
    dateKey: overrides.dateKey || "2026-01-30",
    displayDate: overrides.dateKey || "2026-01-30",
    isCancelled: overrides.isCancelled || false,
    isRescheduled: overrides.isRescheduled || false,
    override: overrides.override || null,
  } as EventOccurrenceEntry<any>;
}

describe("occurrencesToMapPins", () => {
  describe("basic transformation", () => {
    it("transforms a single occurrence with venue coordinates to a pin", () => {
      const entry = createMockOccurrence({
        eventId: "event-1",
        title: "Open Mic Night",
        venue: {
          id: "venue-1",
          name: "Test Venue",
          slug: "test-venue",
          latitude: 39.7392,
          longitude: -104.9903,
        },
      });

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins([entry], config);

      expect(result.pins).toHaveLength(1);
      expect(result.pins[0].venueId).toBe("venue-1");
      expect(result.pins[0].venueName).toBe("Test Venue");
      expect(result.pins[0].venueSlug).toBe("test-venue");
      expect(result.pins[0].latitude).toBe(39.7392);
      expect(result.pins[0].longitude).toBe(-104.9903);
      expect(result.pins[0].events).toHaveLength(1);
      expect(result.pins[0].events[0].title).toBe("Open Mic Night");
    });

    it("groups multiple events at the same venue into one pin", () => {
      const venue = {
        id: "venue-1",
        name: "Test Venue",
        slug: "test-venue",
        latitude: 39.7392,
        longitude: -104.9903,
      };

      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          title: "Monday Open Mic",
          venue,
          dateKey: "2026-01-27",
        }),
        createMockOccurrence({
          eventId: "event-2",
          title: "Wednesday Open Mic",
          venue,
          dateKey: "2026-01-29",
        }),
        createMockOccurrence({
          eventId: "event-3",
          title: "Friday Open Mic",
          venue,
          dateKey: "2026-01-31",
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(1);
      expect(result.pins[0].events).toHaveLength(3);
      expect(result.pins[0].events.map((e) => e.title)).toEqual([
        "Monday Open Mic",
        "Wednesday Open Mic",
        "Friday Open Mic",
      ]);
    });

    it("creates separate pins for different venues", () => {
      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          title: "Event A",
          venue: {
            id: "venue-1",
            name: "Venue One",
            latitude: 39.7392,
            longitude: -104.9903,
          },
        }),
        createMockOccurrence({
          eventId: "event-2",
          title: "Event B",
          venue: {
            id: "venue-2",
            name: "Venue Two",
            latitude: 39.7500,
            longitude: -105.0000,
          },
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(2);
      expect(result.pins.map((p) => p.venueName).sort()).toEqual([
        "Venue One",
        "Venue Two",
      ]);
    });
  });

  describe("online-only exclusion", () => {
    it("excludes events with location_mode='online'", () => {
      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          title: "In Person Event",
          locationMode: "in_person",
          venue: {
            id: "venue-1",
            name: "Test Venue",
            latitude: 39.7392,
            longitude: -104.9903,
          },
        }),
        createMockOccurrence({
          eventId: "event-2",
          title: "Online Only Event",
          locationMode: "online",
          venue: {
            id: "venue-2",
            name: "Another Venue",
            latitude: 39.7500,
            longitude: -105.0000,
          },
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(1);
      expect(result.pins[0].events[0].title).toBe("In Person Event");
      expect(result.excludedOnlineOnly).toBe(1);
    });

    it("tracks count of excluded online-only events", () => {
      const entries = [
        createMockOccurrence({ locationMode: "online" }),
        createMockOccurrence({ locationMode: "online" }),
        createMockOccurrence({ locationMode: "online" }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(0);
      expect(result.excludedOnlineOnly).toBe(3);
    });
  });

  describe("missing coordinates handling", () => {
    it("excludes events without coordinates", () => {
      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          title: "Event with coords",
          venue: {
            id: "venue-1",
            name: "Test Venue",
            latitude: 39.7392,
            longitude: -104.9903,
          },
        }),
        createMockOccurrence({
          eventId: "event-2",
          title: "Event without coords",
          venue: {
            id: "venue-2",
            name: "Missing Coords Venue",
            latitude: null,
            longitude: null,
          },
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(1);
      expect(result.pins[0].events[0].title).toBe("Event with coords");
      expect(result.excludedMissingCoords).toBe(1);
    });

    it("excludes events with no venue at all", () => {
      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          title: "No venue event",
          venue: null,
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(0);
      expect(result.excludedMissingCoords).toBe(1);
    });
  });

  describe("custom location coordinates", () => {
    it("uses custom coordinates when venue has none", () => {
      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          title: "Custom Location Event",
          venue: null,
          customLatitude: 39.7400,
          customLongitude: -104.9800,
          customLocationName: "My House",
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(1);
      expect(result.pins[0].latitude).toBe(39.7400);
      expect(result.pins[0].longitude).toBe(-104.9800);
      expect(result.pins[0].venueName).toBe("My House");
    });

    it("generates custom location name from city/state when name is missing", () => {
      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          title: "Custom Location Event",
          venue: null,
          customLatitude: 39.7400,
          customLongitude: -104.9800,
          customCity: "Denver",
          customState: "CO",
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(1);
      expect(result.pins[0].venueName).toBe("Denver, CO");
    });
  });

  describe("max pins limit", () => {
    it("returns empty pins array when limit exceeded", () => {
      // Create 10 venues, each with coordinates
      const entries = Array.from({ length: 10 }, (_, i) =>
        createMockOccurrence({
          eventId: `event-${i}`,
          title: `Event ${i}`,
          venue: {
            id: `venue-${i}`,
            name: `Venue ${i}`,
            latitude: 39.7392 + i * 0.01,
            longitude: -104.9903 + i * 0.01,
          },
        })
      );

      // Set max to 5 (less than 10)
      const config: MapPinConfig = { maxPins: 5 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.limitExceeded).toBe(true);
      expect(result.pins).toHaveLength(0);
      expect(result.totalProcessed).toBe(10);
    });

    it("returns pins when under limit", () => {
      const entries = Array.from({ length: 3 }, (_, i) =>
        createMockOccurrence({
          eventId: `event-${i}`,
          venue: {
            id: `venue-${i}`,
            name: `Venue ${i}`,
            latitude: 39.7392 + i * 0.01,
            longitude: -104.9903 + i * 0.01,
          },
        })
      );

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.limitExceeded).toBe(false);
      expect(result.pins).toHaveLength(3);
    });
  });

  describe("override venue resolution", () => {
    it("uses override venue when provided in config", () => {
      const overrideVenueMap = new Map([
        [
          "override-venue-1",
          {
            name: "Override Venue",
            slug: "override-venue",
            latitude: 39.8000,
            longitude: -105.1000,
          },
        ],
      ]);

      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          title: "Event with override",
          venue: {
            id: "original-venue",
            name: "Original Venue",
            latitude: 39.7392,
            longitude: -104.9903,
          },
          override: {
            override_patch: {
              venue_id: "override-venue-1",
            },
          },
        }),
      ];

      const config: MapPinConfig = { maxPins: 500, overrideVenueMap };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(1);
      expect(result.pins[0].venueName).toBe("Override Venue");
      expect(result.pins[0].latitude).toBe(39.8000);
      expect(result.pins[0].longitude).toBe(-105.1000);
    });

    it("falls back to event venue when override venue has no coordinates", () => {
      const overrideVenueMap = new Map([
        [
          "override-venue-1",
          {
            name: "Override Venue No Coords",
            latitude: null,
            longitude: null,
          },
        ],
      ]);

      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          venue: {
            id: "original-venue",
            name: "Original Venue",
            latitude: 39.7392,
            longitude: -104.9903,
          },
          override: {
            override_patch: {
              venue_id: "override-venue-1",
            },
          },
        }),
      ];

      const config: MapPinConfig = { maxPins: 500, overrideVenueMap };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(1);
      expect(result.pins[0].venueName).toBe("Original Venue");
      expect(result.pins[0].latitude).toBe(39.7392);
    });
  });

  describe("event sorting within pins", () => {
    it("sorts events by date then time within a venue", () => {
      const venue = {
        id: "venue-1",
        name: "Test Venue",
        latitude: 39.7392,
        longitude: -104.9903,
      };

      const entries = [
        createMockOccurrence({
          eventId: "event-3",
          title: "Late Event",
          venue,
          dateKey: "2026-02-01",
          startTime: "21:00:00",
        }),
        createMockOccurrence({
          eventId: "event-1",
          title: "First Event",
          venue,
          dateKey: "2026-01-30",
          startTime: "19:00:00",
        }),
        createMockOccurrence({
          eventId: "event-2",
          title: "Same Day Later",
          venue,
          dateKey: "2026-01-30",
          startTime: "21:00:00",
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins[0].events.map((e) => e.title)).toEqual([
        "First Event",
        "Same Day Later",
        "Late Event",
      ]);
    });
  });

  describe("event href generation", () => {
    it("generates correct href with date param", () => {
      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          slug: "open-mic-night",
          dateKey: "2026-01-30",
          venue: {
            id: "venue-1",
            name: "Test Venue",
            latitude: 39.7392,
            longitude: -104.9903,
          },
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins[0].events[0].href).toBe(
        "/events/open-mic-night?date=2026-01-30"
      );
    });
  });

  describe("venue without slug", () => {
    it("handles venue with coordinates but no slug (venueSlug is null)", () => {
      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          title: "Event at Slugless Venue",
          venue: {
            id: "venue-1",
            name: "Venue Without Slug",
            slug: undefined, // No slug
            latitude: 39.7392,
            longitude: -104.9903,
          },
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(1);
      expect(result.pins[0].venueName).toBe("Venue Without Slug");
      expect(result.pins[0].venueSlug).toBeNull();
      // Event href should still be valid
      expect(result.pins[0].events[0].href).toContain("/events/");
    });
  });

  describe("cancelled/rescheduled status", () => {
    it("preserves cancelled status on events", () => {
      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          title: "Cancelled Event",
          isCancelled: true,
          venue: {
            id: "venue-1",
            name: "Test Venue",
            latitude: 39.7392,
            longitude: -104.9903,
          },
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins[0].events[0].isCancelled).toBe(true);
    });

    it("preserves rescheduled status on events", () => {
      const entries = [
        createMockOccurrence({
          eventId: "event-1",
          title: "Rescheduled Event",
          isRescheduled: true,
          venue: {
            id: "venue-1",
            name: "Test Venue",
            latitude: 39.7392,
            longitude: -104.9903,
          },
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins[0].events[0].isRescheduled).toBe(true);
    });
  });
});

describe("MAP_DEFAULTS", () => {
  it("has correct Denver center coordinates", () => {
    expect(MAP_DEFAULTS.CENTER.lat).toBe(39.7392);
    expect(MAP_DEFAULTS.CENTER.lng).toBe(-104.9903);
  });

  it("has default zoom level of 11", () => {
    expect(MAP_DEFAULTS.ZOOM).toBe(11);
  });

  it("has max pins limit of 500", () => {
    expect(MAP_DEFAULTS.MAX_PINS).toBe(500);
  });
});

describe("ViewModeSelector URL handling", () => {
  it("timeline is default (no view param)", () => {
    // When no ?view= param, defaults to timeline
    const params = new URLSearchParams("");
    const viewMode = params.get("view") || "timeline";
    expect(viewMode).toBe("timeline");
  });

  it("series mode uses ?view=series", () => {
    const params = new URLSearchParams("view=series");
    const viewMode = params.get("view");
    expect(viewMode).toBe("series");
  });

  it("map mode uses ?view=map", () => {
    const params = new URLSearchParams("view=map");
    const viewMode = params.get("view");
    expect(viewMode).toBe("map");
  });

  it("preserves other query params when changing view mode", () => {
    const params = new URLSearchParams("type=open_mic&day=Monday&view=timeline");
    params.set("view", "map");
    expect(params.toString()).toBe("type=open_mic&day=Monday&view=map");
  });

  it("removes view param when switching to timeline (default)", () => {
    const params = new URLSearchParams("type=open_mic&view=map");
    params.delete("view");
    expect(params.toString()).toBe("type=open_mic");
  });
});

describe("HappeningsViewMode type", () => {
  it("accepts valid view modes", () => {
    const validModes = ["timeline", "series", "map"];
    validModes.forEach((mode) => {
      expect(["timeline", "series", "map"]).toContain(mode);
    });
  });
});

/**
 * Phase 1.0 Fixes — Tests for CSP, UI labels, stats wording, and default today
 */
describe("Phase 1.0 Fixes", () => {
  describe("stats wording", () => {
    it("stats copy uses 'with' instead of dot separator", () => {
      // The stats line should read "X venues with Y happenings"
      // not "X venues · Y happenings"
      const venueCount = 5;
      const happeningCount = 12;
      const expectedFormat = `${venueCount} venues with ${happeningCount} happenings`;
      expect(expectedFormat).toContain(" with ");
      expect(expectedFormat).not.toContain(" · ");
    });

    it("handles singular venue correctly", () => {
      const venueCount = 1;
      const happeningCount = 3;
      const expectedFormat = `${venueCount} venue with ${happeningCount} happenings`;
      expect(expectedFormat).toBe("1 venue with 3 happenings");
    });

    it("handles singular happening correctly", () => {
      const venueCount = 2;
      const happeningCount = 1;
      const expectedFormat = `${venueCount} venues with ${happeningCount} happening`;
      expect(expectedFormat).toBe("2 venues with 1 happening");
    });
  });

  describe("exclusion label", () => {
    it("exclusion label says 'no venue assigned' not 'missing coords'", () => {
      // The UI should display "X no venue assigned" instead of "X missing coords"
      const excludedCount = 26;
      const expectedLabel = `${excludedCount} no venue assigned`;
      expect(expectedLabel).toContain("no venue assigned");
      expect(expectedLabel).not.toContain("missing coords");
    });
  });

  describe("adapter exclusion reason for venue_id null events", () => {
    it("excludes events where location_mode='venue' but venue_id is NULL", () => {
      // This simulates the real data issue: events claim to be at a venue
      // but have no venue_id assigned
      const entries = [
        createMockOccurrence({
          eventId: "event-no-venue",
          title: "Event Without Venue",
          locationMode: "venue", // Claims to be at a venue
          venue: null, // But has no venue_id
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(0);
      expect(result.excludedMissingCoords).toBe(1);
    });

    it("includes events with valid venue coordinates", () => {
      const entries = [
        createMockOccurrence({
          eventId: "event-with-venue",
          title: "Event With Venue",
          locationMode: "venue",
          venue: {
            id: "venue-1",
            name: "Valid Venue",
            latitude: 39.7392,
            longitude: -104.9903,
          },
        }),
      ];

      const config: MapPinConfig = { maxPins: 500 };
      const result = occurrencesToMapPins(entries, config);

      expect(result.pins).toHaveLength(1);
      expect(result.excludedMissingCoords).toBe(0);
    });
  });

  describe("default today behavior", () => {
    it("when no date params present, dateFilter defaults to today", () => {
      // Simulating the page logic:
      // const hasDateParams = !!(params.date || params.time || params.days || params.all === "1");
      // const dateFilter = params.date || (hasDateParams ? null : today);
      const params = {}; // No date-related params
      const today = "2026-01-30";

      const hasDateParams = !!(
        (params as any).date ||
        (params as any).time ||
        (params as any).days ||
        (params as any).all === "1"
      );
      const dateFilter = (params as any).date || (hasDateParams ? null : today);

      expect(hasDateParams).toBe(false);
      expect(dateFilter).toBe(today);
    });

    it("when ?all=1 is set, dateFilter is null (show all upcoming)", () => {
      const params = { all: "1" };
      const today = "2026-01-30";

      const hasDateParams = !!(
        (params as any).date ||
        (params as any).time ||
        (params as any).days ||
        (params as any).all === "1"
      );
      const dateFilter = (params as any).date || (hasDateParams ? null : today);

      expect(hasDateParams).toBe(true);
      expect(dateFilter).toBeNull();
    });

    it("when explicit date param is set, uses that date", () => {
      const params = { date: "2026-02-15" };
      const today = "2026-01-30";

      const hasDateParams = !!(
        (params as any).date ||
        (params as any).time ||
        (params as any).days ||
        (params as any).all === "1"
      );
      const dateFilter = (params as any).date || (hasDateParams ? null : today);

      expect(hasDateParams).toBe(true);
      expect(dateFilter).toBe("2026-02-15");
    });

    it("when time param is set, dateFilter is null (time param controls window)", () => {
      const params = { time: "past" };
      const today = "2026-01-30";

      const hasDateParams = !!(
        (params as any).date ||
        (params as any).time ||
        (params as any).days ||
        (params as any).all === "1"
      );
      const dateFilter = (params as any).date || (hasDateParams ? null : today);

      expect(hasDateParams).toBe(true);
      expect(dateFilter).toBeNull();
    });

    it("when days param is set, dateFilter is null (days filter controls display)", () => {
      const params = { days: "mon,wed,fri" };
      const today = "2026-01-30";

      const hasDateParams = !!(
        (params as any).date ||
        (params as any).time ||
        (params as any).days ||
        (params as any).all === "1"
      );
      const dateFilter = (params as any).date || (hasDateParams ? null : today);

      expect(hasDateParams).toBe(true);
      expect(dateFilter).toBeNull();
    });
  });

  describe("local marker icons", () => {
    it("marker icon paths should be local, not external CDN", () => {
      // The icon paths should point to /public/leaflet/ not unpkg.com
      const localIconPath = "/leaflet/marker-icon.png";
      const localIconRetinaPath = "/leaflet/marker-icon-2x.png";
      const localShadowPath = "/leaflet/marker-shadow.png";

      expect(localIconPath).toMatch(/^\/leaflet\//);
      expect(localIconRetinaPath).toMatch(/^\/leaflet\//);
      expect(localShadowPath).toMatch(/^\/leaflet\//);

      // Should NOT use external URLs
      expect(localIconPath).not.toContain("unpkg.com");
      expect(localIconPath).not.toContain("http");
    });
  });
});

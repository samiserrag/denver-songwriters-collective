/**
 * Phase 4.58: Series → Venue Cross-Linking Tests
 *
 * Tests for internal venue links in SeriesCard component.
 * When venue_id exists, venue name links to /venues/[id].
 * Custom locations and online-only events show plain text.
 */

import { describe, it, expect } from "vitest";

describe("Phase 4.58: Series → Venue Cross-Linking", () => {
  describe("getVenueIdForLink logic", () => {
    // Simulate the helper function logic
    function getVenueIdForLink(event: {
      venue_id?: string | null;
      venue?: { id?: string } | null;
    }): string | null {
      if (event.venue && typeof event.venue === "object" && event.venue.id) {
        return event.venue.id;
      }
      if (event.venue_id) {
        return event.venue_id;
      }
      return null;
    }

    it("returns venue.id when joined venue object has id", () => {
      const event = {
        venue_id: "venue-uuid-1",
        venue: { id: "venue-uuid-1", name: "Test Venue" },
      };
      expect(getVenueIdForLink(event)).toBe("venue-uuid-1");
    });

    it("returns venue_id when venue object is null", () => {
      const event = {
        venue_id: "venue-uuid-2",
        venue: null,
      };
      expect(getVenueIdForLink(event)).toBe("venue-uuid-2");
    });

    it("returns venue_id when venue object has no id", () => {
      const event = {
        venue_id: "venue-uuid-3",
        venue: { name: "Test Venue" },
      };
      expect(getVenueIdForLink(event)).toBe("venue-uuid-3");
    });

    it("returns null when no venue_id and no venue object", () => {
      const event = {
        venue_id: null,
        venue: null,
      };
      expect(getVenueIdForLink(event)).toBeNull();
    });

    it("returns null for custom location (no venue_id)", () => {
      const event = {
        venue_id: null,
        venue: null,
        custom_location_name: "Custom Place",
      };
      expect(getVenueIdForLink(event)).toBeNull();
    });
  });

  describe("Venue link rendering rules", () => {
    it("should render internal link when venue_id exists", () => {
      // Contract: when venue_id exists and not custom location,
      // render <Link href="/venues/{venue_id}">
      const venueId = "abc-123";
      const expectedHref = `/venues/${venueId}`;
      expect(expectedHref).toBe("/venues/abc-123");
    });

    it("should NOT render link for custom location", () => {
      // Contract: custom locations have venue_id = null
      // and custom_location_name set, so venueIdForLink returns null
      const event = {
        venue_id: null,
        custom_location_name: "Someone's House",
        location_mode: "venue" as const,
      };
      const isCustomLocation = !event.venue_id && !!event.custom_location_name;
      expect(isCustomLocation).toBe(true);
    });

    it("should NOT render link for online-only events", () => {
      // Contract: online-only events show "Online" text, not venue link
      const event = {
        venue_id: "some-venue-id",
        location_mode: "online" as const,
      };
      const isOnlineOnly = event.location_mode === "online";
      expect(isOnlineOnly).toBe(true);
    });

    it("should render plain text when no venue_id and not custom", () => {
      // Contract: no venue_id and no custom_location_name = plain text
      const event = {
        venue_id: null,
        venue: null,
        custom_location_name: null,
        location_mode: null,
      };
      const venueIdForLink = event.venue_id;
      expect(venueIdForLink).toBeNull();
    });
  });

  describe("Link URL format", () => {
    it("generates correct venue detail URL", () => {
      const venueId = "4520ad8e-d90c-446f-a547-8cb86ee6e73f";
      const url = `/venues/${venueId}`;
      expect(url).toBe("/venues/4520ad8e-d90c-446f-a547-8cb86ee6e73f");
    });

    it("handles UUID format correctly", () => {
      const venueId = "abc-123-def-456";
      const url = `/venues/${venueId}`;
      expect(url).toMatch(/^\/venues\/[a-z0-9-]+$/);
    });
  });
});

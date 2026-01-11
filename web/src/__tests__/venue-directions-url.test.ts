/**
 * Tests for getVenueDirectionsUrl helper
 *
 * Verifies that "Get Directions" always generates a Google Maps Directions URL
 * (/maps/dir/) format, never using google_maps_url (which is for "View on Maps").
 */

import { describe, it, expect } from "vitest";
import { getVenueDirectionsUrl } from "../lib/venue/getDirectionsUrl";

describe("getVenueDirectionsUrl", () => {
  describe("with full address", () => {
    it("should return directions URL with name + full address", () => {
      const url = getVenueDirectionsUrl({
        name: "Tavern on 26th",
        address: "10040 W 26th Ave",
        city: "Lakewood",
        state: "CO",
        zip: "80215",
      });

      expect(url).toBe(
        "https://www.google.com/maps/dir/?api=1&destination=Tavern%20on%2026th%2010040%20W%2026th%20Ave%2C%20Lakewood%2C%20CO%2C%2080215"
      );
    });

    it("should properly encode special characters in venue name", () => {
      const url = getVenueDirectionsUrl({
        name: "O'Toole's & Murphy's",
        address: "123 Main St",
        city: "Denver",
        state: "CO",
        zip: "80202",
      });

      expect(url).toContain("O'Toole's%20%26%20Murphy's");
      expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
    });

    it("should properly encode unicode characters", () => {
      const url = getVenueDirectionsUrl({
        name: "Café München",
        address: "456 Oak St",
        city: "Denver",
        state: "CO",
        zip: "80203",
      });

      expect(url).toContain("Caf%C3%A9%20M%C3%BCnchen");
    });
  });

  describe("with partial address", () => {
    it("should work with just address and city", () => {
      const url = getVenueDirectionsUrl({
        name: "The Venue",
        address: "789 Broadway",
        city: "Denver",
        state: null,
        zip: null,
      });

      expect(url).toBe(
        "https://www.google.com/maps/dir/?api=1&destination=The%20Venue%20789%20Broadway%2C%20Denver"
      );
    });

    it("should work with address only (no city/state/zip)", () => {
      const url = getVenueDirectionsUrl({
        name: "Local Spot",
        address: "100 Test Lane",
        city: null,
        state: null,
        zip: null,
      });

      expect(url).toBe(
        "https://www.google.com/maps/dir/?api=1&destination=Local%20Spot%20100%20Test%20Lane"
      );
    });
  });

  describe("with name only (no address)", () => {
    it("should return directions URL with just the venue name", () => {
      const url = getVenueDirectionsUrl({
        name: "Red Rocks Amphitheatre",
        address: null,
        city: null,
        state: null,
        zip: null,
      });

      expect(url).toBe(
        "https://www.google.com/maps/dir/?api=1&destination=Red%20Rocks%20Amphitheatre"
      );
    });

    it("should handle name with spaces and special chars", () => {
      const url = getVenueDirectionsUrl({
        name: "Denver's Best Venue (Downtown)",
        address: null,
        city: null,
        state: null,
        zip: null,
      });

      expect(url).toContain("Denver's%20Best%20Venue%20(Downtown)");
    });
  });

  describe("edge cases", () => {
    it("should return null when name is null/empty", () => {
      expect(getVenueDirectionsUrl({
        name: null,
        address: "123 Main St",
        city: "Denver",
        state: "CO",
        zip: "80202",
      })).toBeNull();

      expect(getVenueDirectionsUrl({
        name: "",
        address: "123 Main St",
        city: "Denver",
        state: "CO",
        zip: "80202",
      })).toBeNull();
    });

    it("should return null for null input", () => {
      expect(getVenueDirectionsUrl(null as unknown as { name: string })).toBeNull();
    });

    it("should return null for empty object", () => {
      expect(getVenueDirectionsUrl({})).toBeNull();
    });

    it("should handle undefined fields gracefully", () => {
      const url = getVenueDirectionsUrl({
        name: "Test Venue",
        address: undefined,
        city: undefined,
        state: undefined,
        zip: undefined,
      });

      expect(url).toBe(
        "https://www.google.com/maps/dir/?api=1&destination=Test%20Venue"
      );
    });
  });

  describe("URL format validation", () => {
    it("should always use /maps/dir/ path (not place page)", () => {
      const url = getVenueDirectionsUrl({
        name: "Any Venue",
        address: "Any Address",
        city: "Any City",
        state: "ST",
        zip: "12345",
      });

      expect(url).toContain("/maps/dir/");
      expect(url).toContain("api=1");
      expect(url).toContain("destination=");
    });

    it("should never return a google_maps_url style place page", () => {
      // This test documents that we DON'T use venue.google_maps_url
      // That's for "View on Maps" button, not directions
      const url = getVenueDirectionsUrl({
        name: "Test",
        address: "123 St",
        city: "Denver",
        state: "CO",
        zip: "80202",
      });

      // Should NOT contain place IDs or /place/ paths
      expect(url).not.toContain("/place/");
      expect(url).not.toContain("ChI"); // Google place IDs start with ChI
    });
  });
});

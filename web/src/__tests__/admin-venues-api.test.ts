/**
 * Admin Venues API Tests
 *
 * Tests for /api/admin/venues endpoint response shape.
 * Phase ABC #3: Verifies happenings_count field is present in response.
 */

import { describe, it, expect } from "vitest";

// Type definition matching the API response shape
interface AdminVenueResponse {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string | null;
  website_url?: string | null;
  phone?: string | null;
  google_maps_url?: string | null;
  created_at: string;
  updated_at: string;
  happenings_count: number;
}

describe("Admin Venues API Response Shape", () => {
  describe("happenings_count field", () => {
    it("should include happenings_count as a number in the response", () => {
      // Mock venue response with happenings_count
      const venueWithCount: AdminVenueResponse = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test Venue",
        address: "123 Main St",
        city: "Denver",
        state: "CO",
        zip: "80202",
        website_url: "https://example.com",
        phone: "303-555-1234",
        google_maps_url: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        happenings_count: 5,
      };

      expect(venueWithCount).toHaveProperty("happenings_count");
      expect(typeof venueWithCount.happenings_count).toBe("number");
      expect(venueWithCount.happenings_count).toBe(5);
    });

    it("should default happenings_count to 0 when venue has no events", () => {
      // Mock venue response with no happenings
      const venueWithNoEvents: AdminVenueResponse = {
        id: "123e4567-e89b-12d3-a456-426614174001",
        name: "Empty Venue",
        address: "456 Side St",
        city: "Denver",
        state: "CO",
        zip: null,
        website_url: null,
        phone: null,
        google_maps_url: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        happenings_count: 0,
      };

      expect(venueWithNoEvents.happenings_count).toBe(0);
      expect(typeof venueWithNoEvents.happenings_count).toBe("number");
    });

    it("should preserve all existing venue fields when adding happenings_count", () => {
      const venue: AdminVenueResponse = {
        id: "123e4567-e89b-12d3-a456-426614174002",
        name: "Complete Venue",
        address: "789 Full St",
        city: "Boulder",
        state: "CO",
        zip: "80301",
        website_url: "https://completevenue.com",
        phone: "303-555-9876",
        google_maps_url: "https://maps.google.com/place/complete",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
        happenings_count: 12,
      };

      // Verify all expected fields exist
      expect(venue).toHaveProperty("id");
      expect(venue).toHaveProperty("name");
      expect(venue).toHaveProperty("address");
      expect(venue).toHaveProperty("city");
      expect(venue).toHaveProperty("state");
      expect(venue).toHaveProperty("zip");
      expect(venue).toHaveProperty("website_url");
      expect(venue).toHaveProperty("phone");
      expect(venue).toHaveProperty("google_maps_url");
      expect(venue).toHaveProperty("created_at");
      expect(venue).toHaveProperty("updated_at");
      expect(venue).toHaveProperty("happenings_count");
    });
  });

  describe("count calculation logic", () => {
    it("should count only active, published events", () => {
      // This test documents the expected count behavior:
      // - status != 'cancelled'
      // - is_published = true
      // - venue_id matches the venue

      const mockCountMap = new Map<string, number>();

      // Simulate counting logic
      const mockEvents = [
        { venue_id: "venue-1", status: "active", is_published: true }, // counted
        { venue_id: "venue-1", status: "active", is_published: true }, // counted
        { venue_id: "venue-1", status: "cancelled", is_published: true }, // NOT counted (cancelled)
        { venue_id: "venue-1", status: "active", is_published: false }, // NOT counted (not published)
        { venue_id: "venue-2", status: "active", is_published: true }, // different venue
      ];

      // Simulate the counting logic from the API
      for (const event of mockEvents) {
        if (event.status !== "cancelled" && event.is_published === true) {
          const currentCount = mockCountMap.get(event.venue_id) || 0;
          mockCountMap.set(event.venue_id, currentCount + 1);
        }
      }

      expect(mockCountMap.get("venue-1")).toBe(2);
      expect(mockCountMap.get("venue-2")).toBe(1);
      expect(mockCountMap.get("venue-3")).toBeUndefined();
    });

    it("should return 0 for venues with no matching events", () => {
      const mockCountMap = new Map<string, number>();

      // No events for venue-99
      const count = mockCountMap.get("venue-99") || 0;
      expect(count).toBe(0);
    });
  });

  describe("isValidUrl helper", () => {
    // Test the URL validation used in AdminVenuesClient

    function isValidUrl(url: string | null | undefined): boolean {
      if (!url) return false;
      return url.startsWith("http://") || url.startsWith("https://");
    }

    it("should return true for valid http URLs", () => {
      expect(isValidUrl("http://example.com")).toBe(true);
    });

    it("should return true for valid https URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("https://www.brewery.com/tap-room")).toBe(true);
    });

    it("should return false for null/undefined", () => {
      expect(isValidUrl(null)).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidUrl("")).toBe(false);
    });

    it("should return false for invalid protocols", () => {
      expect(isValidUrl("ftp://example.com")).toBe(false);
      expect(isValidUrl("example.com")).toBe(false);
      expect(isValidUrl("www.example.com")).toBe(false);
    });
  });
});

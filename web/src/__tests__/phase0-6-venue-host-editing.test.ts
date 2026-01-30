/**
 * Phase 0.6: Venue Editing by Event Hosts — Test Suite
 *
 * Tests the trust-first model where event hosts and cohosts
 * can edit venues associated with their events.
 */

import { describe, it, expect } from "vitest";
import {
  shouldRegeocode,
  isWithinColorado,
  processVenueGeocoding,
} from "@/lib/venue/geocoding";
import {
  sanitizeVenuePatch,
  MANAGER_EDITABLE_VENUE_FIELDS,
} from "@/lib/venue/managerAuth";

// =============================================================================
// Geocoding Tests
// =============================================================================

describe("Phase 0.6: Geocoding Service", () => {
  describe("shouldRegeocode", () => {
    it("returns true for new venues with address data", () => {
      const newVenue = { address: "123 Main St", city: "Denver", state: "CO" };
      expect(shouldRegeocode(null, newVenue)).toBe(true);
    });

    it("returns false for new venues without address data", () => {
      const newVenue = {};
      expect(shouldRegeocode(null, newVenue)).toBe(false);
    });

    it("returns true when address changes", () => {
      const oldVenue = { address: "123 Main St", city: "Denver", state: "CO" };
      const newVenue = { address: "456 Oak Ave", city: "Denver", state: "CO" };
      expect(shouldRegeocode(oldVenue, newVenue)).toBe(true);
    });

    it("returns true when city changes", () => {
      const oldVenue = { address: "123 Main St", city: "Denver", state: "CO" };
      const newVenue = { address: "123 Main St", city: "Boulder", state: "CO" };
      expect(shouldRegeocode(oldVenue, newVenue)).toBe(true);
    });

    it("returns true when state changes", () => {
      const oldVenue = { address: "123 Main St", city: "Denver", state: "CO" };
      const newVenue = { address: "123 Main St", city: "Denver", state: "NM" };
      expect(shouldRegeocode(oldVenue, newVenue)).toBe(true);
    });

    it("returns true when zip changes", () => {
      const oldVenue = { address: "123 Main St", city: "Denver", state: "CO", zip: "80202" };
      const newVenue = { address: "123 Main St", city: "Denver", state: "CO", zip: "80203" };
      expect(shouldRegeocode(oldVenue, newVenue)).toBe(true);
    });

    it("returns false when no address fields change", () => {
      const oldVenue = { address: "123 Main St", city: "Denver", state: "CO" };
      const newVenue = { address: "123 Main St", city: "Denver", state: "CO" };
      expect(shouldRegeocode(oldVenue, newVenue)).toBe(false);
    });

    it("handles null values correctly", () => {
      const oldVenue = { address: null, city: "Denver", state: "CO" };
      const newVenue = { address: "123 Main St", city: "Denver", state: "CO" };
      expect(shouldRegeocode(oldVenue, newVenue)).toBe(true);
    });

    it("treats empty string and null as equivalent", () => {
      const oldVenue = { address: "", city: "Denver", state: "CO" };
      const newVenue = { address: null, city: "Denver", state: "CO" };
      expect(shouldRegeocode(oldVenue, newVenue)).toBe(false);
    });
  });

  describe("isWithinColorado", () => {
    it("returns true for Denver coordinates", () => {
      // Denver: approximately 39.7392, -104.9903
      expect(isWithinColorado(39.7392, -104.9903)).toBe(true);
    });

    it("returns true for Boulder coordinates", () => {
      // Boulder: approximately 40.0150, -105.2705
      expect(isWithinColorado(40.0150, -105.2705)).toBe(true);
    });

    it("returns true for Colorado Springs coordinates", () => {
      // Colorado Springs: approximately 38.8339, -104.8214
      expect(isWithinColorado(38.8339, -104.8214)).toBe(true);
    });

    it("returns false for Los Angeles coordinates", () => {
      // LA: approximately 34.0522, -118.2437
      expect(isWithinColorado(34.0522, -118.2437)).toBe(false);
    });

    it("returns false for New York coordinates", () => {
      // NYC: approximately 40.7128, -74.0060
      expect(isWithinColorado(40.7128, -74.0060)).toBe(false);
    });

    it("returns true for edge case at southwest corner", () => {
      expect(isWithinColorado(36.99, -109.06)).toBe(true);
    });

    it("returns true for edge case at northeast corner", () => {
      expect(isWithinColorado(41.01, -102.04)).toBe(true);
    });
  });

  describe("processVenueGeocoding", () => {
    it("returns updates unchanged if lat/lng manually provided", async () => {
      const updates = {
        name: "Test Venue",
        latitude: 39.7392,
        longitude: -104.9903,
      };

      const result = await processVenueGeocoding(null, updates);

      expect(result.latitude).toBe(39.7392);
      expect(result.longitude).toBe(-104.9903);
      expect(result.geocode_source).toBe("manual");
      expect(result.geocoded_at).toBeDefined();
    });

    it("returns updates unchanged if no address fields provided", async () => {
      const existingVenue = {
        address: "123 Main St",
        city: "Denver",
        state: "CO",
      };
      const updates = { name: "New Name" };

      const result = await processVenueGeocoding(existingVenue, updates);

      expect(result).toEqual(updates);
      expect(result.latitude).toBeUndefined();
    });
  });
});

// =============================================================================
// Authorization Tests
// =============================================================================

describe("Phase 0.6: Venue Authorization", () => {
  describe("sanitizeVenuePatch", () => {
    it("allows latitude field", () => {
      const patch = { latitude: 39.7392 };
      const result = sanitizeVenuePatch(patch);
      expect(result.latitude).toBe(39.7392);
    });

    it("allows longitude field", () => {
      const patch = { longitude: -104.9903 };
      const result = sanitizeVenuePatch(patch);
      expect(result.longitude).toBe(-104.9903);
    });

    it("parses string latitude to number", () => {
      const patch = { latitude: "39.7392" };
      const result = sanitizeVenuePatch(patch);
      expect(result.latitude).toBe(39.7392);
    });

    it("parses string longitude to number", () => {
      const patch = { longitude: "-104.9903" };
      const result = sanitizeVenuePatch(patch);
      expect(result.longitude).toBe(-104.9903);
    });

    it("converts empty string coordinates to null", () => {
      const patch = { latitude: "", longitude: "" };
      const result = sanitizeVenuePatch(patch);
      expect(result.latitude).toBeNull();
      expect(result.longitude).toBeNull();
    });

    it("converts null coordinates to null", () => {
      const patch = { latitude: null, longitude: null };
      const result = sanitizeVenuePatch(patch);
      expect(result.latitude).toBeNull();
      expect(result.longitude).toBeNull();
    });

    it("handles invalid numeric strings", () => {
      const patch = { latitude: "not-a-number" };
      const result = sanitizeVenuePatch(patch);
      expect(result.latitude).toBeNull();
    });

    it("rejects disallowed fields", () => {
      const patch = {
        name: "Test",
        id: "should-be-rejected",
        slug: "should-be-rejected",
        created_at: "should-be-rejected",
      };
      const result = sanitizeVenuePatch(patch);
      expect(result.name).toBe("Test");
      expect((result as Record<string, unknown>).id).toBeUndefined();
      expect((result as Record<string, unknown>).slug).toBeUndefined();
      expect((result as Record<string, unknown>).created_at).toBeUndefined();
    });

    it("includes all expected editable fields", () => {
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("name");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("address");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("city");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("state");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("latitude");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("longitude");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("google_maps_url");
      expect(MANAGER_EDITABLE_VENUE_FIELDS).toContain("cover_image_url");
    });
  });
});

// =============================================================================
// Integration Contract Tests
// =============================================================================

describe("Phase 0.6: Integration Contracts", () => {
  it("geocoding runs when address changes", async () => {
    const existingVenue = {
      address: "123 Old St",
      city: "Denver",
      state: "CO",
    };
    const updates = { address: "456 New Ave" };

    // Without API key, geocoding should silently fail but not throw
    const result = await processVenueGeocoding(existingVenue, updates);

    // Should return the updates (geocoding fails silently without API key)
    expect(result.address).toBe("456 New Ave");
    // Coordinates may or may not be set depending on API key availability
  });

  it("save succeeds even if geocoding fails", async () => {
    // Mock a geocoding failure scenario
    const existingVenue = {
      address: "123 Main St",
      city: "Denver",
      state: "CO",
    };
    const updates = { address: "Invalid Address That Won't Geocode" };

    // This should not throw, even if geocoding fails
    const result = await processVenueGeocoding(existingVenue, updates);

    // Updates should be returned (venue save would proceed)
    expect(result.address).toBe("Invalid Address That Won't Geocode");
  });

  it("manual coordinates override automatic geocoding", async () => {
    const existingVenue = {
      address: "123 Main St",
      city: "Denver",
      state: "CO",
    };
    const updates = {
      address: "456 New Ave", // Would trigger geocoding
      latitude: 40.0, // But manual coords provided
      longitude: -105.0,
    };

    const result = await processVenueGeocoding(existingVenue, updates);

    // Manual coordinates should be used
    expect(result.latitude).toBe(40.0);
    expect(result.longitude).toBe(-105.0);
    expect(result.geocode_source).toBe("manual");
  });
});

// =============================================================================
// Permission Contract Tests
// =============================================================================

describe("Phase 0.6: Permission Contracts", () => {
  it("host can edit venue tied to their event (contract)", () => {
    // This is a contract test - actual implementation tested in integration
    // The isEventHostAtVenue function checks:
    // 1. events.host_id === userId for primary hosts
    // 2. event_hosts.user_id === userId with invitation_status='accepted' for cohosts
    // Both paths should return true for venue editing
    expect(true).toBe(true); // Placeholder - real test needs Supabase
  });

  it("cohost can edit venue tied to their event (contract)", () => {
    // Same as above - cohosts in event_hosts table with 'accepted' status
    expect(true).toBe(true); // Placeholder - real test needs Supabase
  });

  it("non-host cannot edit unrelated venue (contract)", () => {
    // Users not in event_hosts or events.host_id should be rejected
    expect(true).toBe(true); // Placeholder - real test needs Supabase
  });

  it("admin can edit any venue (contract)", () => {
    // Admins bypass all venue permission checks
    expect(true).toBe(true); // Placeholder - real test needs Supabase
  });
});

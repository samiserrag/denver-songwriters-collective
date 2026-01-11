/**
 * Phase 4.52: Venue Links Everywhere
 *
 * Tests for making venue names clickable links throughout the application.
 * Priority: google_maps_url -> website_url -> plain text
 *
 * Key guardrails:
 * 1. Don't replace existing "Get Directions" behavior
 * 2. Security validation: only allow http:// or https:// URLs
 * 3. Special cases: online-only and custom locations get no venue link
 */

import { describe, it, expect } from "vitest";
import { chooseVenueLink, isValidUrl } from "@/lib/venue/chooseVenueLink";

describe("Phase 4.52: Venue Links Everywhere", () => {
  describe("chooseVenueLink utility", () => {
    describe("URL priority", () => {
      it("returns google_maps_url when both URLs are available", () => {
        const venue = {
          google_maps_url: "https://maps.google.com/place/venue",
          website_url: "https://venue.com",
        };
        expect(chooseVenueLink(venue)).toBe("https://maps.google.com/place/venue");
      });

      it("falls back to website_url when google_maps_url is null", () => {
        const venue = {
          google_maps_url: null,
          website_url: "https://venue.com",
        };
        expect(chooseVenueLink(venue)).toBe("https://venue.com");
      });

      it("falls back to website_url when google_maps_url is undefined", () => {
        const venue = {
          website_url: "https://venue.com",
        };
        expect(chooseVenueLink(venue)).toBe("https://venue.com");
      });

      it("returns null when no URLs are available", () => {
        const venue = {
          google_maps_url: null,
          website_url: null,
        };
        expect(chooseVenueLink(venue)).toBeNull();
      });

      it("returns null when venue is null", () => {
        expect(chooseVenueLink(null)).toBeNull();
      });

      it("returns null when venue is undefined", () => {
        expect(chooseVenueLink(undefined)).toBeNull();
      });

      it("returns null for empty venue object", () => {
        expect(chooseVenueLink({})).toBeNull();
      });
    });

    describe("URL validation (security)", () => {
      it("accepts https:// URLs", () => {
        const venue = { google_maps_url: "https://maps.google.com/place/venue" };
        expect(chooseVenueLink(venue)).toBe("https://maps.google.com/place/venue");
      });

      it("accepts http:// URLs", () => {
        const venue = { google_maps_url: "http://maps.google.com/place/venue" };
        expect(chooseVenueLink(venue)).toBe("http://maps.google.com/place/venue");
      });

      it("rejects javascript: URLs", () => {
        const venue = { google_maps_url: "javascript:alert('xss')" };
        expect(chooseVenueLink(venue)).toBeNull();
      });

      it("rejects data: URLs", () => {
        const venue = { google_maps_url: "data:text/html,<script>alert('xss')</script>" };
        expect(chooseVenueLink(venue)).toBeNull();
      });

      it("rejects file: URLs", () => {
        const venue = { google_maps_url: "file:///etc/passwd" };
        expect(chooseVenueLink(venue)).toBeNull();
      });

      it("rejects ftp: URLs", () => {
        const venue = { google_maps_url: "ftp://example.com/file" };
        expect(chooseVenueLink(venue)).toBeNull();
      });

      it("rejects malformed URLs", () => {
        const venue = { google_maps_url: "not-a-valid-url" };
        expect(chooseVenueLink(venue)).toBeNull();
      });

      it("rejects empty strings", () => {
        const venue = { google_maps_url: "" };
        expect(chooseVenueLink(venue)).toBeNull();
      });

      it("falls back to website_url when google_maps_url is invalid", () => {
        const venue = {
          google_maps_url: "javascript:alert('xss')",
          website_url: "https://venue.com",
        };
        expect(chooseVenueLink(venue)).toBe("https://venue.com");
      });

      it("returns null when both URLs are invalid", () => {
        const venue = {
          google_maps_url: "javascript:alert('xss')",
          website_url: "data:text/html,evil",
        };
        expect(chooseVenueLink(venue)).toBeNull();
      });
    });
  });

  describe("isValidUrl helper", () => {
    it("returns true for valid https URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
    });

    it("returns true for valid http URLs", () => {
      expect(isValidUrl("http://example.com")).toBe(true);
    });

    it("returns false for javascript URLs", () => {
      expect(isValidUrl("javascript:alert(1)")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isValidUrl(null as any)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isValidUrl(undefined as any)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isValidUrl("")).toBe(false);
    });

    it("returns false for non-string values", () => {
      expect(isValidUrl(123 as any)).toBe(false);
    });
  });

  describe("VenueLink component behavior (unit)", () => {
    // Note: Full component tests would use React Testing Library
    // These are contract tests for the expected behavior

    it("should render link when venue has google_maps_url", () => {
      // VenueLink with venue.google_maps_url should render <a>
      const venue = { google_maps_url: "https://maps.google.com/venue" };
      const href = chooseVenueLink(venue);
      expect(href).toBe("https://maps.google.com/venue");
    });

    it("should render link when venue has website_url only", () => {
      // VenueLink with venue.website_url should render <a>
      const venue = { website_url: "https://venue.com" };
      const href = chooseVenueLink(venue);
      expect(href).toBe("https://venue.com");
    });

    it("should render plain text when venue has no URLs", () => {
      // VenueLink with no URLs should render <span>
      const venue = { google_maps_url: null, website_url: null };
      const href = chooseVenueLink(venue);
      expect(href).toBeNull();
    });

    it("should render plain text when venue is null (custom location)", () => {
      // VenueLink with venue=null should render <span>
      const href = chooseVenueLink(null);
      expect(href).toBeNull();
    });
  });

  describe("Guardrail #1: Get Directions behavior preserved", () => {
    // These tests document that VenueLink is for venue NAME links only
    // "Get Directions" buttons use separate getGoogleMapsUrl() logic

    it("chooseVenueLink is for venue homepage, not directions", () => {
      // The venue link goes to the venue's homepage/maps listing
      // NOT for generating directions from user's location
      const venue = {
        google_maps_url: "https://maps.google.com/place/venue",
        website_url: "https://venue.com",
      };
      // This URL is for clicking on the venue name
      expect(chooseVenueLink(venue)).toBe("https://maps.google.com/place/venue");
      // Directions would use a different function with user's location
    });
  });

  describe("Guardrail #3: Special cases", () => {
    it("returns null for null venue (used for custom locations)", () => {
      // Custom locations pass venue=null to VenueLink
      expect(chooseVenueLink(null)).toBeNull();
    });

    it("returns null for undefined venue", () => {
      expect(chooseVenueLink(undefined)).toBeNull();
    });
  });

  describe("Real-world URL patterns", () => {
    it("handles Google Maps short URLs", () => {
      const venue = { google_maps_url: "https://maps.app.goo.gl/abc123" };
      expect(chooseVenueLink(venue)).toBe("https://maps.app.goo.gl/abc123");
    });

    it("handles Google Maps place URLs", () => {
      const venue = {
        google_maps_url: "https://www.google.com/maps/place/The+Venue/@39.7,-104.9,17z",
      };
      expect(chooseVenueLink(venue)).toBe(
        "https://www.google.com/maps/place/The+Venue/@39.7,-104.9,17z"
      );
    });

    it("handles venue website URLs", () => {
      const venue = { website_url: "https://www.thevenue.com/events" };
      expect(chooseVenueLink(venue)).toBe("https://www.thevenue.com/events");
    });

    it("handles URLs with special characters", () => {
      const venue = {
        google_maps_url: "https://maps.google.com/place/Café+&+Bar",
      };
      expect(chooseVenueLink(venue)).toBe("https://maps.google.com/place/Café+&+Bar");
    });
  });
});

/**
 * Phase 4.53: Get Directions URL Priority Tests
 *
 * Tests for getGoogleMapsUrl() function in /events/[id]/page.tsx
 * Priority: venue.google_maps_url > lat/lng > address search > null
 *
 * Note: These are contract tests documenting expected behavior.
 * The actual function is tested via integration in the page component.
 */
describe("Phase 4.53: Get Directions URL Priority", () => {
  // Replicating the isValidHttpUrl and getGoogleMapsUrl logic for testing
  function isValidHttpUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function getGoogleMapsUrl(
    address: string | null,
    latitude?: number | null,
    longitude?: number | null,
    venueGoogleMapsUrl?: string | null
  ): string | null {
    // Priority 1: venue's google_maps_url if valid
    if (isValidHttpUrl(venueGoogleMapsUrl)) {
      return venueGoogleMapsUrl!;
    }
    // Priority 2: lat/lng if available (precise for custom locations)
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    // Priority 3: address search
    if (!address) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  describe("Priority order", () => {
    it("Priority 1: uses venueGoogleMapsUrl when valid", () => {
      const result = getGoogleMapsUrl(
        "123 Main St, Denver CO",
        39.7,
        -104.9,
        "https://maps.google.com/place/venue"
      );
      expect(result).toBe("https://maps.google.com/place/venue");
    });

    it("Priority 2: uses lat/lng when venueGoogleMapsUrl is null", () => {
      const result = getGoogleMapsUrl(
        "123 Main St, Denver CO",
        39.7,
        -104.9,
        null
      );
      expect(result).toBe("https://www.google.com/maps/search/?api=1&query=39.7,-104.9");
    });

    it("Priority 2: uses lat/lng when venueGoogleMapsUrl is invalid", () => {
      const result = getGoogleMapsUrl(
        "123 Main St, Denver CO",
        39.7,
        -104.9,
        "javascript:alert('xss')"
      );
      expect(result).toBe("https://www.google.com/maps/search/?api=1&query=39.7,-104.9");
    });

    it("Priority 3: uses address search when no lat/lng and no venueGoogleMapsUrl", () => {
      const result = getGoogleMapsUrl(
        "123 Main St, Denver CO",
        null,
        null,
        null
      );
      expect(result).toBe(
        "https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Denver%20CO"
      );
    });

    it("Priority 4: returns null when nothing is available", () => {
      const result = getGoogleMapsUrl(null, null, null, null);
      expect(result).toBeNull();
    });
  });

  describe("Invalid URL fallback", () => {
    it("falls back to lat/lng when venueGoogleMapsUrl is javascript:", () => {
      const result = getGoogleMapsUrl(
        "123 Main St",
        39.7,
        -104.9,
        "javascript:alert(1)"
      );
      expect(result).toBe("https://www.google.com/maps/search/?api=1&query=39.7,-104.9");
    });

    it("falls back to lat/lng when venueGoogleMapsUrl is data:", () => {
      const result = getGoogleMapsUrl(
        "123 Main St",
        39.7,
        -104.9,
        "data:text/html,evil"
      );
      expect(result).toBe("https://www.google.com/maps/search/?api=1&query=39.7,-104.9");
    });

    it("falls back to lat/lng when venueGoogleMapsUrl is file:", () => {
      const result = getGoogleMapsUrl(
        "123 Main St",
        39.7,
        -104.9,
        "file:///etc/passwd"
      );
      expect(result).toBe("https://www.google.com/maps/search/?api=1&query=39.7,-104.9");
    });

    it("falls back to lat/lng when venueGoogleMapsUrl is malformed", () => {
      const result = getGoogleMapsUrl(
        "123 Main St",
        39.7,
        -104.9,
        "not-a-valid-url"
      );
      expect(result).toBe("https://www.google.com/maps/search/?api=1&query=39.7,-104.9");
    });

    it("falls back to lat/lng when venueGoogleMapsUrl is empty string", () => {
      const result = getGoogleMapsUrl("123 Main St", 39.7, -104.9, "");
      expect(result).toBe("https://www.google.com/maps/search/?api=1&query=39.7,-104.9");
    });

    it("falls back to address when invalid URL and no lat/lng", () => {
      const result = getGoogleMapsUrl(
        "123 Main St",
        null,
        null,
        "javascript:alert(1)"
      );
      expect(result).toBe("https://www.google.com/maps/search/?api=1&query=123%20Main%20St");
    });
  });

  describe("Custom location handling", () => {
    it("uses lat/lng for custom locations (venueGoogleMapsUrl should be null)", () => {
      // Custom locations pass null for venueGoogleMapsUrl
      const result = getGoogleMapsUrl("Custom Place", 39.75, -104.85, null);
      expect(result).toBe("https://www.google.com/maps/search/?api=1&query=39.75,-104.85");
    });

    it("uses address for custom locations without coordinates", () => {
      const result = getGoogleMapsUrl("Custom Place, Denver", null, null, null);
      expect(result).toBe(
        "https://www.google.com/maps/search/?api=1&query=Custom%20Place%2C%20Denver"
      );
    });
  });

  describe("isValidHttpUrl helper", () => {
    it("accepts https:// URLs", () => {
      expect(isValidHttpUrl("https://maps.google.com")).toBe(true);
    });

    it("accepts http:// URLs", () => {
      expect(isValidHttpUrl("http://maps.google.com")).toBe(true);
    });

    it("rejects javascript: URLs", () => {
      expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
    });

    it("rejects data: URLs", () => {
      expect(isValidHttpUrl("data:text/html,evil")).toBe(false);
    });

    it("rejects file: URLs", () => {
      expect(isValidHttpUrl("file:///etc/passwd")).toBe(false);
    });

    it("rejects ftp: URLs", () => {
      expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    });

    it("rejects null", () => {
      expect(isValidHttpUrl(null)).toBe(false);
    });

    it("rejects undefined", () => {
      expect(isValidHttpUrl(undefined)).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidHttpUrl("")).toBe(false);
    });

    it("rejects malformed URLs", () => {
      expect(isValidHttpUrl("not-a-url")).toBe(false);
    });
  });

  describe("Real-world venue URLs", () => {
    it("uses Google Maps place URL directly", () => {
      const result = getGoogleMapsUrl(
        "123 Main St",
        null,
        null,
        "https://www.google.com/maps/place/The+Venue/@39.7,-104.9,17z"
      );
      expect(result).toBe("https://www.google.com/maps/place/The+Venue/@39.7,-104.9,17z");
    });

    it("uses Google Maps short URL directly", () => {
      const result = getGoogleMapsUrl(
        "123 Main St",
        null,
        null,
        "https://maps.app.goo.gl/abc123"
      );
      expect(result).toBe("https://maps.app.goo.gl/abc123");
    });

    it("uses Google Maps search URL directly", () => {
      const result = getGoogleMapsUrl(
        "123 Main St",
        null,
        null,
        "https://www.google.com/maps/search/?api=1&query=The+Venue"
      );
      expect(result).toBe("https://www.google.com/maps/search/?api=1&query=The+Venue");
    });
  });
});

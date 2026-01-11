/**
 * Phase 4.60: Google Maps URL Fallback Tests
 *
 * Tests the priority order for "Get Directions" URL generation:
 * 1. venue.google_maps_url (valid http/https)
 * 2. lat/lng (for custom locations)
 * 3. venue name + address search
 * 4. address-only search
 * 5. name-only search
 * 6. null (disabled)
 */

import { describe, it, expect } from "vitest";

// Replicate the getGoogleMapsUrl function logic for testing
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
  venueGoogleMapsUrl?: string | null,
  venueName?: string | null
): string | null {
  // Priority 1: venue's google_maps_url if valid
  if (isValidHttpUrl(venueGoogleMapsUrl)) {
    return venueGoogleMapsUrl!;
  }
  // Priority 2: lat/lng if available (precise for custom locations)
  if (latitude && longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  // Priority 3: venue name + address search (finds the actual place, not just the building)
  if (venueName && address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venueName} ${address}`)}`;
  }
  // Priority 4: address-only search (fallback when no venue name)
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  // Priority 5: name-only search (fallback when no address)
  if (venueName) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName)}`;
  }
  return null;
}

describe("Phase 4.60: Google Maps URL Fallback", () => {
  describe("Priority 1: venue.google_maps_url", () => {
    it("uses google_maps_url when valid HTTPS", () => {
      const url = getGoogleMapsUrl(
        "10040 W 26th Ave",
        null,
        null,
        "https://maps.google.com/place/TavernOn26th",
        "Tavern on 26th"
      );
      expect(url).toBe("https://maps.google.com/place/TavernOn26th");
    });

    it("uses google_maps_url when valid HTTP", () => {
      const url = getGoogleMapsUrl(
        "123 Main St",
        null,
        null,
        "http://maps.google.com/place/SomeVenue",
        "Some Venue"
      );
      expect(url).toBe("http://maps.google.com/place/SomeVenue");
    });

    it("ignores invalid google_maps_url (not http/https)", () => {
      const url = getGoogleMapsUrl(
        "10040 W 26th Ave",
        null,
        null,
        "ftp://invalid.com",
        "Tavern on 26th"
      );
      expect(url).toContain("Tavern%20on%2026th");
    });

    it("ignores empty string google_maps_url", () => {
      const url = getGoogleMapsUrl(
        "10040 W 26th Ave",
        null,
        null,
        "",
        "Tavern on 26th"
      );
      expect(url).toContain("Tavern%20on%2026th");
    });
  });

  describe("Priority 2: lat/lng for custom locations", () => {
    it("uses lat/lng when provided (custom location)", () => {
      const url = getGoogleMapsUrl(
        "123 Custom St",
        39.754329,
        -105.110135,
        null,
        "My House"
      );
      expect(url).toBe("https://www.google.com/maps/search/?api=1&query=39.754329,-105.110135");
    });

    it("prefers lat/lng over name+address search", () => {
      const url = getGoogleMapsUrl(
        "123 Main St",
        40.0,
        -105.0,
        null,
        "Some Place"
      );
      expect(url).toBe("https://www.google.com/maps/search/?api=1&query=40,-105");
    });
  });

  describe("Priority 3: venue name + address search", () => {
    it("searches venue name + address when both available", () => {
      const url = getGoogleMapsUrl(
        "10040 W 26th Ave",
        null,
        null,
        null,
        "Tavern on 26th"
      );
      expect(url).toBe(
        "https://www.google.com/maps/search/?api=1&query=Tavern%20on%2026th%2010040%20W%2026th%20Ave"
      );
    });

    it("properly encodes special characters in venue name", () => {
      const url = getGoogleMapsUrl(
        "123 Main St",
        null,
        null,
        null,
        "O'Malley's Pub & Grill"
      );
      expect(url).toContain("O'Malley's%20Pub%20%26%20Grill");
    });

    it("properly encodes commas in address", () => {
      const url = getGoogleMapsUrl(
        "123 Main St, Denver, CO 80202",
        null,
        null,
        null,
        "Venue Name"
      );
      expect(url).toContain("Denver%2C%20CO");
    });
  });

  describe("Priority 4: address-only search", () => {
    it("falls back to address-only when venue name is null", () => {
      const url = getGoogleMapsUrl(
        "10040 W 26th Ave",
        null,
        null,
        null,
        null
      );
      expect(url).toBe(
        "https://www.google.com/maps/search/?api=1&query=10040%20W%2026th%20Ave"
      );
    });

    it("falls back to address-only when venue name is empty string", () => {
      const url = getGoogleMapsUrl(
        "10040 W 26th Ave",
        null,
        null,
        null,
        ""
      );
      expect(url).toBe(
        "https://www.google.com/maps/search/?api=1&query=10040%20W%2026th%20Ave"
      );
    });
  });

  describe("Priority 5: name-only search", () => {
    it("falls back to name-only when address is null", () => {
      const url = getGoogleMapsUrl(
        null,
        null,
        null,
        null,
        "Tavern on 26th"
      );
      expect(url).toBe(
        "https://www.google.com/maps/search/?api=1&query=Tavern%20on%2026th"
      );
    });

    it("falls back to name-only when address is empty string", () => {
      const url = getGoogleMapsUrl(
        "",
        null,
        null,
        null,
        "Tavern on 26th"
      );
      expect(url).toBe(
        "https://www.google.com/maps/search/?api=1&query=Tavern%20on%2026th"
      );
    });
  });

  describe("Priority 6: null (disabled)", () => {
    it("returns null when nothing available", () => {
      const url = getGoogleMapsUrl(null, null, null, null, null);
      expect(url).toBeNull();
    });

    it("returns null when all values are empty strings", () => {
      const url = getGoogleMapsUrl("", null, null, "", "");
      expect(url).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("google_maps_url takes priority over lat/lng", () => {
      const url = getGoogleMapsUrl(
        "123 Main St",
        40.0,
        -105.0,
        "https://maps.google.com/place/Specific",
        "Venue"
      );
      expect(url).toBe("https://maps.google.com/place/Specific");
    });

    it("handles unicode venue names", () => {
      const url = getGoogleMapsUrl(
        "123 Main St",
        null,
        null,
        null,
        "Café Música"
      );
      expect(url).toContain("Caf%C3%A9%20M%C3%BAsica");
    });

    it("handles very long venue names", () => {
      const longName = "The Very Long Named Establishment With Many Words In The Name";
      const url = getGoogleMapsUrl("123 St", null, null, null, longName);
      expect(url).toContain(encodeURIComponent(longName));
    });
  });

  describe("Custom location behavior", () => {
    it("custom location with lat/lng uses coordinates", () => {
      // Simulating: isCustomLocation = true, so we pass lat/lng but no venueGoogleMapsUrl
      const url = getGoogleMapsUrl(
        "123 Custom Location St",
        39.7392,
        -104.9903,
        null, // No google_maps_url for custom locations
        "Custom Venue Name"
      );
      // lat/lng takes priority
      expect(url).toBe("https://www.google.com/maps/search/?api=1&query=39.7392,-104.9903");
    });

    it("custom location without lat/lng uses name+address", () => {
      const url = getGoogleMapsUrl(
        "123 Custom Location St",
        null,
        null,
        null,
        "Custom Venue Name"
      );
      expect(url).toContain("Custom%20Venue%20Name%20123%20Custom%20Location%20St");
    });
  });

  describe("Online-only events", () => {
    it("online events should not show Get Directions (handled by UI)", () => {
      // The UI should hide the button for online events
      // This test documents that the function itself doesn't know about location_mode
      // The calling code should not call this function for online events
      const url = getGoogleMapsUrl(null, null, null, null, null);
      expect(url).toBeNull();
    });
  });
});

describe("URL hygiene", () => {
  it("only generates https URLs for search fallbacks", () => {
    const url = getGoogleMapsUrl("123 Main St", null, null, null, "Venue");
    expect(url).toMatch(/^https:\/\//);
  });

  it("generates proper Google Maps search URL format", () => {
    const url = getGoogleMapsUrl("123 Main St", null, null, null, "Venue");
    expect(url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  });

  it("accepts valid http:// google_maps_url", () => {
    const url = getGoogleMapsUrl(
      "123 Main St",
      null,
      null,
      "http://maps.google.com/place/OldUrl",
      "Venue"
    );
    expect(url).toBe("http://maps.google.com/place/OldUrl");
  });
});

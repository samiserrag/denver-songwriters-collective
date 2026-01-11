/**
 * Google Maps Helper Tests
 *
 * Tests for googleMapsHelper.ts functions.
 */

import { describe, it, expect } from "vitest";
import {
  generateGoogleMapsSearchUrl,
  isValidGoogleMapsUrl,
  getVenueSearchSummary,
} from "@/lib/ops/googleMapsHelper";

describe("generateGoogleMapsSearchUrl", () => {
  it("generates URL with all fields", () => {
    const venue = {
      name: "Test Venue",
      address: "123 Main St",
      city: "Denver",
      state: "CO",
    };

    const url = generateGoogleMapsSearchUrl(venue);

    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Test%20Venue%20123%20Main%20St%20Denver%20CO"
    );
  });

  it("handles missing address", () => {
    const venue = {
      name: "Test Venue",
      city: "Denver",
      state: "CO",
    };

    const url = generateGoogleMapsSearchUrl(venue);

    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Test%20Venue%20Denver%20CO"
    );
  });

  it("handles missing city and state", () => {
    const venue = {
      name: "Test Venue",
      address: "123 Main St",
    };

    const url = generateGoogleMapsSearchUrl(venue);

    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Test%20Venue%20123%20Main%20St"
    );
  });

  it("handles name only", () => {
    const venue = {
      name: "Test Venue",
    };

    const url = generateGoogleMapsSearchUrl(venue);

    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Test%20Venue"
    );
  });

  it("returns empty string for empty venue", () => {
    const venue = {
      name: "",
    };

    const url = generateGoogleMapsSearchUrl(venue);

    expect(url).toBe("");
  });

  it("encodes special characters", () => {
    const venue = {
      name: "The \"Best\" Venue & Bar",
      address: "123 Main St #100",
    };

    const url = generateGoogleMapsSearchUrl(venue);

    expect(url).toContain(encodeURIComponent("The \"Best\" Venue & Bar"));
    expect(url).toContain(encodeURIComponent("123 Main St #100"));
  });

  it("trims whitespace", () => {
    const venue = {
      name: "  Test Venue  ",
      city: "  Denver  ",
    };

    const url = generateGoogleMapsSearchUrl(venue);

    expect(url).not.toContain("%20%20");
    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Test%20Venue%20Denver"
    );
  });

  it("handles null fields", () => {
    const venue = {
      name: "Test Venue",
      address: null,
      city: null,
      state: null,
    };

    const url = generateGoogleMapsSearchUrl(venue);

    expect(url).toBe(
      "https://www.google.com/maps/search/?api=1&query=Test%20Venue"
    );
  });
});

describe("isValidGoogleMapsUrl", () => {
  it("accepts google.com/maps URLs", () => {
    expect(isValidGoogleMapsUrl("https://www.google.com/maps/place/123")).toBe(true);
    expect(isValidGoogleMapsUrl("https://google.com/maps/place/123")).toBe(true);
    expect(isValidGoogleMapsUrl("http://www.google.com/maps/place/123")).toBe(true);
  });

  it("accepts maps.google.com URLs", () => {
    expect(isValidGoogleMapsUrl("https://maps.google.com/place/123")).toBe(true);
    expect(isValidGoogleMapsUrl("http://maps.google.com/?q=test")).toBe(true);
  });

  it("accepts goo.gl/maps short URLs", () => {
    expect(isValidGoogleMapsUrl("https://goo.gl/maps/abc123")).toBe(true);
  });

  it("rejects non-Google Maps URLs", () => {
    expect(isValidGoogleMapsUrl("https://example.com")).toBe(false);
    expect(isValidGoogleMapsUrl("https://bing.com/maps")).toBe(false);
    expect(isValidGoogleMapsUrl("https://apple.com/maps")).toBe(false);
  });

  it("rejects non-http URLs", () => {
    expect(isValidGoogleMapsUrl("ftp://google.com/maps")).toBe(false);
    expect(isValidGoogleMapsUrl("google.com/maps")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isValidGoogleMapsUrl("")).toBe(false);
    expect(isValidGoogleMapsUrl("   ")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(isValidGoogleMapsUrl("HTTPS://WWW.GOOGLE.COM/MAPS/place")).toBe(true);
  });
});

describe("getVenueSearchSummary", () => {
  it("formats all fields", () => {
    const venue = {
      name: "Test Venue",
      address: "123 Main St",
      city: "Denver",
      state: "CO",
    };

    const summary = getVenueSearchSummary(venue);

    expect(summary).toBe("Test Venue • 123 Main St • Denver, CO");
  });

  it("handles missing address", () => {
    const venue = {
      name: "Test Venue",
      city: "Denver",
      state: "CO",
    };

    const summary = getVenueSearchSummary(venue);

    expect(summary).toBe("Test Venue • Denver, CO");
  });

  it("handles missing city", () => {
    const venue = {
      name: "Test Venue",
      state: "CO",
    };

    const summary = getVenueSearchSummary(venue);

    expect(summary).toBe("Test Venue • CO");
  });

  it("handles missing state", () => {
    const venue = {
      name: "Test Venue",
      city: "Denver",
    };

    const summary = getVenueSearchSummary(venue);

    expect(summary).toBe("Test Venue • Denver");
  });

  it("handles name only", () => {
    const venue = {
      name: "Test Venue",
    };

    const summary = getVenueSearchSummary(venue);

    expect(summary).toBe("Test Venue");
  });

  it("returns placeholder for empty venue", () => {
    const venue = {
      name: "",
    };

    const summary = getVenueSearchSummary(venue);

    expect(summary).toBe("No venue data");
  });
});

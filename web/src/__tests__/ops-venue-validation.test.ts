/**
 * Venue Validation Tests
 *
 * Tests for venueValidation.ts functions.
 */

import { describe, it, expect } from "vitest";
import {
  validateVenueRow,
  normalizeVenueRow,
  validateVenueRows,
} from "@/lib/ops/venueValidation";

describe("validateVenueRow", () => {
  const validRow = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test Venue",
    address: "123 Main St",
    city: "Denver",
    state: "CO",
    zip: "80202",
    website_url: "https://example.com",
    phone: "303-555-1234",
    google_maps_url: "https://maps.google.com/place/123",
    notes: "Great venue",
  };

  it("accepts a valid row", () => {
    const result = validateVenueRow(validRow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing id", () => {
    const row = { ...validRow, id: "" };
    const result = validateVenueRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: id");
  });

  it("rejects invalid UUID format", () => {
    const row = { ...validRow, id: "not-a-uuid" };
    const result = validateVenueRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid UUID format"))).toBe(true);
  });

  it("rejects missing name", () => {
    const row = { ...validRow, name: "" };
    const result = validateVenueRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: name");
  });

  it("rejects whitespace-only name", () => {
    const row = { ...validRow, name: "   " };
    const result = validateVenueRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: name");
  });

  it("rejects invalid website_url protocol", () => {
    const row = { ...validRow, website_url: "ftp://example.com" };
    const result = validateVenueRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid website_url"))).toBe(true);
  });

  it("rejects invalid google_maps_url protocol", () => {
    const row = { ...validRow, google_maps_url: "maps.google.com" };
    const result = validateVenueRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid google_maps_url"))).toBe(true);
  });

  it("accepts http:// URLs", () => {
    const row = { ...validRow, website_url: "http://example.com" };
    const result = validateVenueRow(row);
    expect(result.valid).toBe(true);
  });

  it("accepts https:// URLs", () => {
    const row = { ...validRow, google_maps_url: "https://maps.google.com" };
    const result = validateVenueRow(row);
    expect(result.valid).toBe(true);
  });

  it("adds warning for missing city", () => {
    const row = { ...validRow, city: "" };
    const result = validateVenueRow(row);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("Missing city");
  });

  it("adds warning for missing state", () => {
    const row = { ...validRow, state: "" };
    const result = validateVenueRow(row);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("Missing state");
  });

  it("allows empty optional fields", () => {
    const row = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Minimal Venue",
      address: "",
      city: "",
      state: "",
      zip: "",
      website_url: "",
      phone: "",
      google_maps_url: "",
      notes: "",
    };
    const result = validateVenueRow(row);
    expect(result.valid).toBe(true);
  });
});

describe("normalizeVenueRow", () => {
  it("trims whitespace", () => {
    const row = {
      id: "  123e4567-e89b-12d3-a456-426614174000  ",
      name: "  Test Venue  ",
      address: "  123 Main St  ",
      city: "  Denver  ",
      state: "  CO  ",
      zip: "  80202  ",
      website_url: "  https://example.com  ",
      phone: "  303-555-1234  ",
      google_maps_url: "  https://maps.google.com  ",
      notes: "  Notes  ",
    };
    const result = normalizeVenueRow(row);
    expect(result.id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(result.name).toBe("Test Venue");
    expect(result.city).toBe("Denver");
  });

  it("converts empty strings to null", () => {
    const row = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Test Venue",
      address: "",
      city: "",
      state: "",
      zip: "",
      website_url: "",
      phone: "",
      google_maps_url: "",
      notes: "",
    };
    const result = normalizeVenueRow(row);
    expect(result.address).toBeNull();
    expect(result.city).toBeNull();
    expect(result.website_url).toBeNull();
    expect(result.google_maps_url).toBeNull();
  });

  it("converts whitespace-only to null", () => {
    const row = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Test Venue",
      address: "   ",
      city: "   ",
      state: "   ",
      zip: "   ",
      website_url: "   ",
      phone: "   ",
      google_maps_url: "   ",
      notes: "   ",
    };
    const result = normalizeVenueRow(row);
    expect(result.address).toBeNull();
    expect(result.city).toBeNull();
    expect(result.notes).toBeNull();
  });
});

describe("validateVenueRows", () => {
  it("separates valid and invalid rows", () => {
    const rows = [
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Valid Venue",
        address: "",
        city: "",
        state: "",
        zip: "",
        website_url: "",
        phone: "",
        google_maps_url: "",
        notes: "",
      },
      {
        id: "invalid-id",
        name: "Invalid Venue",
        address: "",
        city: "",
        state: "",
        zip: "",
        website_url: "",
        phone: "",
        google_maps_url: "",
        notes: "",
      },
    ];

    const result = validateVenueRows(rows);
    expect(result.validRows).toHaveLength(1);
    expect(result.invalidRows).toHaveLength(1);
    expect(result.allValid).toBe(false);
  });

  it("returns 1-indexed row numbers in errors", () => {
    const rows = [
      {
        id: "invalid",
        name: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        website_url: "",
        phone: "",
        google_maps_url: "",
        notes: "",
      },
    ];

    const result = validateVenueRows(rows);
    expect(result.invalidRows[0].rowIndex).toBe(1);
  });

  it("returns allValid: true when all rows valid", () => {
    const rows = [
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Venue 1",
        address: "",
        city: "",
        state: "",
        zip: "",
        website_url: "",
        phone: "",
        google_maps_url: "",
        notes: "",
      },
      {
        id: "223e4567-e89b-12d3-a456-426614174000",
        name: "Venue 2",
        address: "",
        city: "",
        state: "",
        zip: "",
        website_url: "",
        phone: "",
        google_maps_url: "",
        notes: "",
      },
    ];

    const result = validateVenueRows(rows);
    expect(result.allValid).toBe(true);
    expect(result.validRows).toHaveLength(2);
  });
});

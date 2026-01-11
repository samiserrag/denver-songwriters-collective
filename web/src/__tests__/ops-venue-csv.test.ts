/**
 * Venue CSV Parser Tests
 *
 * Tests for venueCsvParser.ts functions.
 */

import { describe, it, expect } from "vitest";
import {
  parseVenueCsv,
  serializeVenueCsv,
  VENUE_CSV_HEADERS,
} from "@/lib/ops/venueCsvParser";

describe("parseVenueCsv", () => {
  const validHeader = VENUE_CSV_HEADERS.join(",");

  it("parses valid CSV with header and data", () => {
    const csv = `${validHeader}
123e4567-e89b-12d3-a456-426614174000,Test Venue,123 Main St,Denver,CO,80202,https://example.com,303-555-1234,https://maps.google.com,Great venue`;

    const result = parseVenueCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(result.rows[0].name).toBe("Test Venue");
    expect(result.rows[0].notes).toBe("Great venue");
  });

  it("handles empty optional fields", () => {
    const csv = `${validHeader}
123e4567-e89b-12d3-a456-426614174000,Minimal Venue,,,,,,,,`;

    const result = parseVenueCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows[0].name).toBe("Minimal Venue");
    expect(result.rows[0].address).toBe("");
    expect(result.rows[0].google_maps_url).toBe("");
  });

  it("rejects empty CSV", () => {
    const result = parseVenueCsv("");

    expect(result.success).toBe(false);
    expect(result.errors).toContain("CSV is empty");
  });

  it("rejects wrong column count in header", () => {
    const csv = "id,name,address,city\n123,Test,Main,Denver";

    const result = parseVenueCsv(csv);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid header count"))).toBe(true);
  });

  it("rejects wrong column names", () => {
    const csv =
      "id,venue_name,address,city,state,zip,website_url,phone,google_maps_url,notes\n123,Test,Main,Denver,CO,80202,,,";

    const result = parseVenueCsv(csv);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid header at column 2"))).toBe(
      true
    );
  });

  it("rejects row with wrong column count", () => {
    const csv = `${validHeader}
123,Test,Main`;

    const result = parseVenueCsv(csv);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Row 2"))).toBe(true);
  });

  it("handles Windows line endings", () => {
    const csv = `${validHeader}\r\n123e4567-e89b-12d3-a456-426614174000,Test,Main,Denver,CO,80202,,,, `;

    const result = parseVenueCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
  });

  it("handles Mac line endings", () => {
    const csv = `${validHeader}\r123e4567-e89b-12d3-a456-426614174000,Test,Main,Denver,CO,80202,,,,`;

    const result = parseVenueCsv(csv);

    expect(result.success).toBe(true);
  });

  it("skips blank lines", () => {
    const csv = `${validHeader}

123e4567-e89b-12d3-a456-426614174000,Test,Main,Denver,CO,80202,,,,

`;

    const result = parseVenueCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
  });

  it("parses multiple rows", () => {
    const csv = `${validHeader}
123e4567-e89b-12d3-a456-426614174001,Venue 1,Main,Denver,CO,80202,,,,
123e4567-e89b-12d3-a456-426614174002,Venue 2,Main,Denver,CO,80202,,,,
123e4567-e89b-12d3-a456-426614174003,Venue 3,Main,Denver,CO,80202,,,,`;

    const result = parseVenueCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(3);
  });
});

describe("serializeVenueCsv", () => {
  it("serializes venues to CSV with header", () => {
    const venues = [
      {
        id: "123",
        name: "Test Venue",
        address: "123 Main St",
        city: "Denver",
        state: "CO",
        zip: "80202",
        website_url: "https://example.com",
        phone: "303-555-1234",
        google_maps_url: "https://maps.google.com",
        notes: "Great venue",
      },
    ];

    const csv = serializeVenueCsv(venues);
    const lines = csv.split("\n");

    expect(lines[0]).toBe(VENUE_CSV_HEADERS.join(","));
    expect(lines[1]).toContain("123");
    expect(lines[1]).toContain("Test Venue");
    expect(lines[1]).toContain("Great venue");
  });

  it("handles null values as empty strings", () => {
    const venues = [
      {
        id: "123",
        name: "Minimal Venue",
        address: null,
        city: null,
        state: null,
        zip: null,
        website_url: null,
        phone: null,
        google_maps_url: null,
        notes: null,
      },
    ];

    const csv = serializeVenueCsv(venues);
    const lines = csv.split("\n");

    expect(lines[1]).toBe("123,Minimal Venue,,,,,,,,");
  });

  it("escapes commas in values", () => {
    const venues = [
      {
        id: "123",
        name: "Venue, Inc.",
        address: "123 Main St, Suite 100",
        city: "Denver",
        state: "CO",
        zip: "80202",
        website_url: null,
        phone: null,
        google_maps_url: null,
        notes: null,
      },
    ];

    const csv = serializeVenueCsv(venues);
    const lines = csv.split("\n");

    expect(lines[1]).toContain('"Venue, Inc."');
    expect(lines[1]).toContain('"123 Main St, Suite 100"');
  });

  it("escapes quotes in values", () => {
    const venues = [
      {
        id: "123",
        name: 'The "Best" Venue',
        address: null,
        city: "Denver",
        state: "CO",
        zip: null,
        website_url: null,
        phone: null,
        google_maps_url: null,
        notes: null,
      },
    ];

    const csv = serializeVenueCsv(venues);
    const lines = csv.split("\n");

    expect(lines[1]).toContain('"The ""Best"" Venue"');
  });

  it("returns header only for empty array", () => {
    const csv = serializeVenueCsv([]);
    expect(csv).toBe(VENUE_CSV_HEADERS.join(","));
  });

  it("serializes multiple venues", () => {
    const venues = [
      { id: "1", name: "Venue 1", address: null, city: null, state: null, zip: null, website_url: null, phone: null, google_maps_url: null, notes: null },
      { id: "2", name: "Venue 2", address: null, city: null, state: null, zip: null, website_url: null, phone: null, google_maps_url: null, notes: null },
      { id: "3", name: "Venue 3", address: null, city: null, state: null, zip: null, website_url: null, phone: null, google_maps_url: null, notes: null },
    ];

    const csv = serializeVenueCsv(venues);
    const lines = csv.split("\n");

    expect(lines).toHaveLength(4); // Header + 3 rows
  });
});

describe("VENUE_CSV_HEADERS", () => {
  it("has 10 columns", () => {
    expect(VENUE_CSV_HEADERS).toHaveLength(10);
  });

  it("starts with id and name", () => {
    expect(VENUE_CSV_HEADERS[0]).toBe("id");
    expect(VENUE_CSV_HEADERS[1]).toBe("name");
  });

  it("includes google_maps_url", () => {
    expect(VENUE_CSV_HEADERS).toContain("google_maps_url");
  });
});

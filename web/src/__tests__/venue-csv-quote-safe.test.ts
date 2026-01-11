/**
 * Venue CSV Quote-Safe Parsing Tests
 *
 * Phase 4.64: Fix for venues CSV re-upload validation failure.
 * Bug: Naive comma splitting broke on quoted fields containing commas.
 * Fix: Added parseCsvLine() with RFC 4180 quote handling.
 */

import { describe, it, expect } from "vitest";
import {
  parseVenueCsv,
  serializeVenueCsv,
  VENUE_CSV_HEADERS,
  type DatabaseVenue,
} from "@/lib/ops/venueCsvParser";

describe("Venue CSV Quote-Safe Parsing", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Round-trip: serialize → parse preserves data exactly
  // ─────────────────────────────────────────────────────────────────────────

  describe("Round-trip (export → import)", () => {
    it("should preserve simple venue data through round-trip", () => {
      const venues: DatabaseVenue[] = [
        {
          id: "uuid-1",
          name: "Simple Venue",
          address: "123 Main St",
          city: "Denver",
          state: "CO",
          zip: "80202",
          website_url: "https://example.com",
          phone: "303-555-1234",
          google_maps_url: "https://maps.google.com/place/123",
          notes: "No special notes",
        },
      ];

      const csv = serializeVenueCsv(venues);
      const result = parseVenueCsv(csv);

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe("uuid-1");
      expect(result.rows[0].name).toBe("Simple Venue");
      expect(result.rows[0].address).toBe("123 Main St");
    });

    it("should preserve venue with commas in name through round-trip", () => {
      const venues: DatabaseVenue[] = [
        {
          id: "uuid-2",
          name: "Coffee Shop, Downtown",
          address: "456 Market St",
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
      const result = parseVenueCsv(csv);

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Coffee Shop, Downtown");
    });

    it("should preserve venue with commas in address through round-trip", () => {
      const venues: DatabaseVenue[] = [
        {
          id: "uuid-3",
          name: "The Venue",
          address: "Suite 100, Building A, 789 Broadway",
          city: "Denver",
          state: "CO",
          zip: "80203",
          website_url: null,
          phone: null,
          google_maps_url: null,
          notes: null,
        },
      ];

      const csv = serializeVenueCsv(venues);
      const result = parseVenueCsv(csv);

      expect(result.success).toBe(true);
      expect(result.rows[0].address).toBe("Suite 100, Building A, 789 Broadway");
    });

    it("should preserve venue with commas in notes through round-trip", () => {
      const venues: DatabaseVenue[] = [
        {
          id: "uuid-4",
          name: "Music Hall",
          address: "100 Main St",
          city: "Denver",
          state: "CO",
          zip: null,
          website_url: null,
          phone: null,
          google_maps_url: null,
          notes: "Great venue, friendly staff, good parking",
        },
      ];

      const csv = serializeVenueCsv(venues);
      const result = parseVenueCsv(csv);

      expect(result.success).toBe(true);
      expect(result.rows[0].notes).toBe("Great venue, friendly staff, good parking");
    });

    it("should preserve venue with escaped quotes through round-trip", () => {
      const venues: DatabaseVenue[] = [
        {
          id: "uuid-5",
          name: 'The "Best" Venue',
          address: "200 Main St",
          city: "Denver",
          state: "CO",
          zip: null,
          website_url: null,
          phone: null,
          google_maps_url: null,
          notes: 'Owner said "great acoustics"',
        },
      ];

      const csv = serializeVenueCsv(venues);
      const result = parseVenueCsv(csv);

      expect(result.success).toBe(true);
      expect(result.rows[0].name).toBe('The "Best" Venue');
      expect(result.rows[0].notes).toBe('Owner said "great acoustics"');
    });

    it("should preserve venue with both commas and quotes through round-trip", () => {
      const venues: DatabaseVenue[] = [
        {
          id: "uuid-6",
          name: 'Joe\'s Bar, "The Original"',
          address: "300 Main St",
          city: "Denver",
          state: "CO",
          zip: null,
          website_url: null,
          phone: null,
          google_maps_url: null,
          notes: 'Contact: Joe, owner. He said "call anytime"',
        },
      ];

      const csv = serializeVenueCsv(venues);
      const result = parseVenueCsv(csv);

      expect(result.success).toBe(true);
      expect(result.rows[0].name).toBe('Joe\'s Bar, "The Original"');
      expect(result.rows[0].notes).toBe('Contact: Joe, owner. He said "call anytime"');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Column count validation
  // ─────────────────────────────────────────────────────────────────────────

  describe("Column count validation", () => {
    it("should always produce exactly 10 columns per row", () => {
      const venues: DatabaseVenue[] = [
        {
          id: "uuid-1",
          name: "Comma, in, every, field",
          address: "1, 2, 3, Main St",
          city: "Denver, CO",
          state: "CO",
          zip: "80,202",
          website_url: "https://example.com?a=1,b=2",
          phone: "303,555,1234",
          google_maps_url: "https://maps.google.com?q=a,b",
          notes: "Note 1, Note 2, Note 3",
        },
      ];

      const csv = serializeVenueCsv(venues);
      const result = parseVenueCsv(csv);

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      // Verify all 10 fields are present and correct
      expect(Object.keys(result.rows[0])).toHaveLength(VENUE_CSV_HEADERS.length);
    });

    it("should reject CSV with wrong column count (too few)", () => {
      const csv = `id,name,address,city,state,zip,website_url,phone,google_maps_url,notes
uuid-1,Missing Columns,123 Main`;

      const result = parseVenueCsv(csv);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("expected 10 columns");
    });

    it("should reject CSV with wrong column count (too many unquoted)", () => {
      const csv = `id,name,address,city,state,zip,website_url,phone,google_maps_url,notes
uuid-1,Name,Address,City,State,Zip,URL,Phone,Maps,Notes,Extra`;

      const result = parseVenueCsv(csv);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("expected 10 columns, got 11");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // The exact bug scenario: quoted commas that caused false column count
  // ─────────────────────────────────────────────────────────────────────────

  describe("Bug regression: quoted commas", () => {
    it("should NOT fail on quoted field with comma (the original bug)", () => {
      // This is the exact pattern that was failing before the fix
      const csv = `id,name,address,city,state,zip,website_url,phone,google_maps_url,notes
uuid-1,"Coffee Shop, Downtown",123 Main St,Denver,CO,80202,,,,"Great place, nice staff"`;

      const result = parseVenueCsv(csv);

      // Before fix: would fail with "expected 10 columns, got 12"
      // After fix: should succeed
      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Coffee Shop, Downtown");
      expect(result.rows[0].notes).toBe("Great place, nice staff");
    });

    it("should handle multiple rows with mixed quoting", () => {
      const csv = `id,name,address,city,state,zip,website_url,phone,google_maps_url,notes
uuid-1,Simple Name,123 Main St,Denver,CO,80202,,,,
uuid-2,"Comma, Name","456, Market St",Denver,CO,80203,,,,"Note, with, commas"
uuid-3,Another Simple,789 Broadway,Denver,CO,80204,,,,`;

      const result = parseVenueCsv(csv);

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].name).toBe("Simple Name");
      expect(result.rows[1].name).toBe("Comma, Name");
      expect(result.rows[1].address).toBe("456, Market St");
      expect(result.rows[1].notes).toBe("Note, with, commas");
      expect(result.rows[2].name).toBe("Another Simple");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("should handle empty fields correctly", () => {
      const csv = `id,name,address,city,state,zip,website_url,phone,google_maps_url,notes
uuid-1,Name Only,,,,,,,,`;

      const result = parseVenueCsv(csv);

      expect(result.success).toBe(true);
      expect(result.rows[0].name).toBe("Name Only");
      expect(result.rows[0].address).toBe("");
      expect(result.rows[0].notes).toBe("");
    });

    it("should handle CRLF line endings", () => {
      const csv = "id,name,address,city,state,zip,website_url,phone,google_maps_url,notes\r\nuuid-1,Name,Addr,City,ST,12345,,,,";

      const result = parseVenueCsv(csv);

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
    });

    it("should handle trailing newline", () => {
      const csv = `id,name,address,city,state,zip,website_url,phone,google_maps_url,notes
uuid-1,Name,Addr,City,ST,12345,,,,
`;

      const result = parseVenueCsv(csv);

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
    });

    it("should handle empty CSV", () => {
      const result = parseVenueCsv("");

      expect(result.success).toBe(false);
      expect(result.errors[0]).toBe("CSV is empty");
    });

    it("should handle whitespace-only CSV", () => {
      const result = parseVenueCsv("   \n  \n  ");

      expect(result.success).toBe(false);
      expect(result.errors[0]).toBe("CSV is empty");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Header validation
  // ─────────────────────────────────────────────────────────────────────────

  describe("Header validation", () => {
    it("should require exact header match", () => {
      const csv = `id,name,wrong_column,city,state,zip,website_url,phone,google_maps_url,notes
uuid-1,Name,Addr,City,ST,12345,,,,`;

      const result = parseVenueCsv(csv);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('expected "address"');
      expect(result.errors[0]).toContain('got "wrong_column"');
    });

    it("should reject header with wrong column count", () => {
      const csv = `id,name,address
uuid-1,Name,Addr`;

      const result = parseVenueCsv(csv);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Invalid header count");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-line detection (STOP-GATE)
  // ─────────────────────────────────────────────────────────────────────────

  describe("Multi-line cell detection", () => {
    it("should reject cells with embedded newlines", () => {
      // This tests the STOP-GATE for multi-line cells
      // In practice this can only happen if someone manually constructs bad input
      // because the serializer doesn't produce multi-line cells
      const csvWithNewline = 'id,name,address,city,state,zip,website_url,phone,google_maps_url,notes\nuuid-1,"Line1\nLine2",Addr,City,ST,12345,,,,';

      // This would require the parser to somehow get a newline inside a cell
      // which can't happen with line-by-line processing
      // But the check exists for safety
      const result = parseVenueCsv(csvWithNewline);

      // With line-by-line processing, the newline splits the row incorrectly
      // so this will fail on column count, not the multi-line check
      expect(result.success).toBe(false);
    });
  });
});

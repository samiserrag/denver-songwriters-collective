/**
 * Venue Diff Tests
 *
 * Tests for venueDiff.ts functions.
 */

import { describe, it, expect } from "vitest";
import { computeVenueDiff, buildUpdatePayloads } from "@/lib/ops/venueDiff";
import { VenueRow } from "@/lib/ops/venueValidation";
import { DatabaseVenue } from "@/lib/ops/venueCsvParser";

describe("computeVenueDiff", () => {
  const makeDbVenue = (overrides: Partial<DatabaseVenue> = {}): DatabaseVenue => ({
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test Venue",
    address: "123 Main St",
    city: "Denver",
    state: "CO",
    zip: "80202",
    website_url: "https://example.com",
    phone: "303-555-1234",
    google_maps_url: "https://maps.google.com",
    notes: "Original notes",
    ...overrides,
  });

  const makeVenueRow = (overrides: Partial<VenueRow> = {}): VenueRow => ({
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test Venue",
    address: "123 Main St",
    city: "Denver",
    state: "CO",
    zip: "80202",
    website_url: "https://example.com",
    phone: "303-555-1234",
    google_maps_url: "https://maps.google.com",
    notes: "Original notes",
    ...overrides,
  });

  it("detects no changes when data is identical", () => {
    const current = [makeDbVenue()];
    const incoming = [makeVenueRow()];

    const result = computeVenueDiff(current, incoming);

    expect(result.updates).toHaveLength(0);
    expect(result.notFound).toHaveLength(0);
    expect(result.unchanged).toBe(1);
  });

  it("detects single field change", () => {
    const current = [makeDbVenue()];
    const incoming = [makeVenueRow({ name: "New Name" })];

    const result = computeVenueDiff(current, incoming);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].changes).toHaveLength(1);
    expect(result.updates[0].changes[0]).toEqual({
      field: "name",
      oldValue: "Test Venue",
      newValue: "New Name",
    });
  });

  it("detects multiple field changes", () => {
    const current = [makeDbVenue()];
    const incoming = [
      makeVenueRow({
        name: "New Name",
        city: "Boulder",
        google_maps_url: "https://maps.google.com/new",
      }),
    ];

    const result = computeVenueDiff(current, incoming);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].changes).toHaveLength(3);
    expect(result.updates[0].changes.map((c) => c.field)).toContain("name");
    expect(result.updates[0].changes.map((c) => c.field)).toContain("city");
    expect(result.updates[0].changes.map((c) => c.field)).toContain("google_maps_url");
  });

  it("treats null and empty string as equivalent", () => {
    const current = [makeDbVenue({ notes: null })];
    const incoming = [makeVenueRow({ notes: null })];

    const result = computeVenueDiff(current, incoming);

    expect(result.updates).toHaveLength(0);
    expect(result.unchanged).toBe(1);
  });

  it("treats empty string and null as equivalent (reverse)", () => {
    const current = [makeDbVenue({ notes: "" })];
    const incoming = [makeVenueRow({ notes: null })];

    const result = computeVenueDiff(current, incoming);

    expect(result.updates).toHaveLength(0);
    expect(result.unchanged).toBe(1);
  });

  it("detects change from null to value", () => {
    const current = [makeDbVenue({ google_maps_url: null })];
    const incoming = [makeVenueRow({ google_maps_url: "https://maps.google.com" })];

    const result = computeVenueDiff(current, incoming);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].changes[0]).toEqual({
      field: "google_maps_url",
      oldValue: null,
      newValue: "https://maps.google.com",
    });
  });

  it("detects change from value to null", () => {
    const current = [makeDbVenue({ notes: "Some notes" })];
    const incoming = [makeVenueRow({ notes: null })];

    const result = computeVenueDiff(current, incoming);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].changes[0]).toEqual({
      field: "notes",
      oldValue: "Some notes",
      newValue: null,
    });
  });

  it("reports IDs not found in database", () => {
    const current: DatabaseVenue[] = [];
    const incoming = [makeVenueRow({ id: "missing-id-uuid-0000-000000000000" })];

    const result = computeVenueDiff(current, incoming);

    expect(result.updates).toHaveLength(0);
    expect(result.notFound).toContain("missing-id-uuid-0000-000000000000");
    expect(result.unchanged).toBe(0);
  });

  it("handles multiple venues with mixed changes", () => {
    const current = [
      makeDbVenue({ id: "id-1", name: "Venue 1" }),
      makeDbVenue({ id: "id-2", name: "Venue 2" }),
      makeDbVenue({ id: "id-3", name: "Venue 3" }),
    ];
    const incoming = [
      makeVenueRow({ id: "id-1", name: "Venue 1" }), // Unchanged
      makeVenueRow({ id: "id-2", name: "Updated Venue 2" }), // Changed
      makeVenueRow({ id: "id-4", name: "New Venue" }), // Not found
    ];

    const result = computeVenueDiff(current, incoming);

    expect(result.unchanged).toBe(1);
    expect(result.updates).toHaveLength(1);
    expect(result.notFound).toHaveLength(1);
    expect(result.notFound[0]).toBe("id-4");
  });

  it("trims whitespace before comparison", () => {
    const current = [makeDbVenue({ name: "Test Venue" })];
    const incoming = [makeVenueRow({ name: "  Test Venue  " })];

    // Note: normalization should happen before diff, but diff also handles it
    // The actual VenueRow should already be normalized
    const result = computeVenueDiff(current, incoming);

    // If incoming is normalized, no diff. This tests the normalizeForComparison helper.
    expect(result.updates).toHaveLength(0);
  });
});

describe("buildUpdatePayloads", () => {
  it("builds payload with only changed fields", () => {
    const diffs = [
      {
        id: "123",
        name: "Test Venue",
        changes: [
          { field: "name", oldValue: "Old", newValue: "New" },
          { field: "city", oldValue: "Denver", newValue: "Boulder" },
        ],
      },
    ];

    const payloads = buildUpdatePayloads(diffs);

    expect(payloads).toHaveLength(1);
    expect(payloads[0].id).toBe("123");
    expect(payloads[0].updates).toEqual({
      name: "New",
      city: "Boulder",
    });
  });

  it("handles null values in updates", () => {
    const diffs = [
      {
        id: "123",
        name: "Test Venue",
        changes: [{ field: "notes", oldValue: "Some notes", newValue: null }],
      },
    ];

    const payloads = buildUpdatePayloads(diffs);

    expect(payloads[0].updates).toEqual({
      notes: null,
    });
  });

  it("returns empty array for no diffs", () => {
    const payloads = buildUpdatePayloads([]);
    expect(payloads).toHaveLength(0);
  });
});

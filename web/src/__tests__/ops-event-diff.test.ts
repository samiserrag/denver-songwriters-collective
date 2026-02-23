/**
 * Event Diff Tests
 *
 * Tests for eventDiff.ts functions.
 */

import { describe, it, expect } from "vitest";
import { computeEventDiff, buildEventUpdatePayloads } from "@/lib/ops/eventDiff";
import { EventRow, DatabaseEvent } from "@/lib/ops/eventCsvParser";

describe("computeEventDiff", () => {
  const makeDbEvent = (overrides: Partial<DatabaseEvent> = {}): DatabaseEvent => ({
    id: "123e4567-e89b-12d3-a456-426614174000",
    title: "Test Event",
    event_type: ["open_mic"],
    status: "active",
    is_recurring: true,
    event_date: "2026-01-15",
    day_of_week: "Monday",
    start_time: "19:00:00",
    end_time: "22:00:00",
    venue_id: "223e4567-e89b-12d3-a456-426614174000",
    is_published: true,
    host_notes: "Original notes",
    ...overrides,
  });

  const makeEventRow = (overrides: Partial<EventRow> = {}): EventRow => ({
    id: "123e4567-e89b-12d3-a456-426614174000",
    title: "Test Event",
    event_type: "open_mic",
    status: "active",
    is_recurring: true,
    event_date: "2026-01-15",
    day_of_week: "Monday",
    start_time: "19:00:00",
    end_time: "22:00:00",
    venue_id: "223e4567-e89b-12d3-a456-426614174000",
    is_published: true,
    notes: "Original notes",
    ...overrides,
  });

  it("detects no changes when data is identical", () => {
    const current = [makeDbEvent()];
    const incoming = [makeEventRow()];

    const result = computeEventDiff(current, incoming);

    expect(result.updates).toHaveLength(0);
    expect(result.notFound).toHaveLength(0);
    expect(result.unchanged).toBe(1);
  });

  it("detects single field change", () => {
    const current = [makeDbEvent()];
    const incoming = [makeEventRow({ title: "New Title" })];

    const result = computeEventDiff(current, incoming);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].changes).toHaveLength(1);
    expect(result.updates[0].changes[0]).toEqual({
      field: "title",
      oldValue: "Test Event",
      newValue: "New Title",
    });
  });

  it("detects multiple field changes", () => {
    const current = [makeDbEvent()];
    const incoming = [
      makeEventRow({
        title: "New Title",
        status: "cancelled",
        venue_id: "333e4567-e89b-12d3-a456-426614174000",
      }),
    ];

    const result = computeEventDiff(current, incoming);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].changes).toHaveLength(3);
    expect(result.updates[0].changes.map((c) => c.field)).toContain("title");
    expect(result.updates[0].changes.map((c) => c.field)).toContain("status");
    expect(result.updates[0].changes.map((c) => c.field)).toContain("venue_id");
  });

  it("treats null and empty string as equivalent", () => {
    const current = [makeDbEvent({ host_notes: null })];
    const incoming = [makeEventRow({ notes: null })];

    const result = computeEventDiff(current, incoming);

    expect(result.updates).toHaveLength(0);
    expect(result.unchanged).toBe(1);
  });

  it("treats empty string and null as equivalent (reverse)", () => {
    const current = [makeDbEvent({ host_notes: "" })];
    const incoming = [makeEventRow({ notes: null })];

    const result = computeEventDiff(current, incoming);

    expect(result.updates).toHaveLength(0);
    expect(result.unchanged).toBe(1);
  });

  it("detects change from null to value", () => {
    const current = [makeDbEvent({ venue_id: null })];
    const incoming = [makeEventRow({ venue_id: "333e4567-e89b-12d3-a456-426614174000" })];

    const result = computeEventDiff(current, incoming);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].changes[0]).toEqual({
      field: "venue_id",
      oldValue: null,
      newValue: "333e4567-e89b-12d3-a456-426614174000",
    });
  });

  it("detects change from value to null", () => {
    const current = [makeDbEvent({ host_notes: "Some notes" })];
    const incoming = [makeEventRow({ notes: null })];

    const result = computeEventDiff(current, incoming);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].changes[0]).toEqual({
      field: "notes",
      oldValue: "Some notes",
      newValue: null,
    });
  });

  it("reports IDs not found in database", () => {
    const current: DatabaseEvent[] = [];
    const incoming = [makeEventRow({ id: "missing-id-uuid-0000-000000000000" })];

    const result = computeEventDiff(current, incoming);

    expect(result.updates).toHaveLength(0);
    expect(result.notFound).toContain("missing-id-uuid-0000-000000000000");
    expect(result.unchanged).toBe(0);
  });

  it("handles multiple events with mixed changes", () => {
    const current = [
      makeDbEvent({ id: "id-1", title: "Event 1" }),
      makeDbEvent({ id: "id-2", title: "Event 2" }),
      makeDbEvent({ id: "id-3", title: "Event 3" }),
    ];
    const incoming = [
      makeEventRow({ id: "id-1", title: "Event 1" }), // Unchanged
      makeEventRow({ id: "id-2", title: "Updated Event 2" }), // Changed
      makeEventRow({ id: "id-4", title: "New Event" }), // Not found
    ];

    const result = computeEventDiff(current, incoming);

    expect(result.unchanged).toBe(1);
    expect(result.updates).toHaveLength(1);
    expect(result.notFound).toHaveLength(1);
    expect(result.notFound[0]).toBe("id-4");
  });

  it("trims whitespace before comparison", () => {
    const current = [makeDbEvent({ title: "Test Event" })];
    const incoming = [makeEventRow({ title: "  Test Event  " })];

    const result = computeEventDiff(current, incoming);

    expect(result.updates).toHaveLength(0);
  });

  it("detects boolean field changes", () => {
    const current = [makeDbEvent({ is_recurring: true })];
    const incoming = [makeEventRow({ is_recurring: false })];

    const result = computeEventDiff(current, incoming);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].changes[0]).toEqual({
      field: "is_recurring",
      oldValue: true,
      newValue: false,
    });
  });
});

describe("buildEventUpdatePayloads", () => {
  it("builds payload with only changed fields", () => {
    const diffs = [
      {
        id: "123",
        title: "Test Event",
        changes: [
          { field: "title", oldValue: "Old", newValue: "New" },
          { field: "status", oldValue: "active", newValue: "cancelled" },
        ],
      },
    ];

    const payloads = buildEventUpdatePayloads(diffs);

    expect(payloads).toHaveLength(1);
    expect(payloads[0].id).toBe("123");
    expect(payloads[0].updates).toEqual({
      title: "New",
      status: "cancelled",
    });
  });

  it("maps notes field to host_notes", () => {
    const diffs = [
      {
        id: "123",
        title: "Test Event",
        changes: [{ field: "notes", oldValue: "Old notes", newValue: "New notes" }],
      },
    ];

    const payloads = buildEventUpdatePayloads(diffs);

    expect(payloads[0].updates).toEqual({
      host_notes: "New notes",
    });
  });

  it("handles null values in updates", () => {
    const diffs = [
      {
        id: "123",
        title: "Test Event",
        changes: [{ field: "venue_id", oldValue: "some-uuid", newValue: null }],
      },
    ];

    const payloads = buildEventUpdatePayloads(diffs);

    expect(payloads[0].updates).toEqual({
      venue_id: null,
    });
  });

  it("returns empty array for no diffs", () => {
    const payloads = buildEventUpdatePayloads([]);
    expect(payloads).toHaveLength(0);
  });
});

/**
 * Event Validation Tests
 *
 * Tests for eventValidation.ts functions.
 */

import { describe, it, expect } from "vitest";
import {
  validateEventRow,
  normalizeEventRow,
  validateEventRows,
  VALID_EVENT_TYPES,
  VALID_STATUSES,
  VALID_DAYS_OF_WEEK,
} from "@/lib/ops/eventValidation";

describe("validateEventRow", () => {
  const validRow = {
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
    notes: "Great venue",
  };

  it("accepts a valid row", () => {
    const result = validateEventRow(validRow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing id", () => {
    const row = { ...validRow, id: "" };
    const result = validateEventRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: id");
  });

  it("rejects invalid UUID format", () => {
    const row = { ...validRow, id: "not-a-uuid" };
    const result = validateEventRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid UUID format"))).toBe(true);
  });

  it("rejects missing title", () => {
    const row = { ...validRow, title: "" };
    const result = validateEventRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: title");
  });

  it("rejects whitespace-only title", () => {
    const row = { ...validRow, title: "   " };
    const result = validateEventRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: title");
  });

  it("rejects missing event_type", () => {
    const row = { ...validRow, event_type: "" };
    const result = validateEventRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: event_type");
  });

  it("warns on unknown event_type but does not reject", () => {
    const row = { ...validRow, event_type: "unknown_type" };
    const result = validateEventRow(row);
    // Unknown types are allowed (forward compatibility) but warned
    expect(result.warnings.some((w) => w.includes("Unknown event_type"))).toBe(true);
  });

  it("rejects invalid status", () => {
    const row = { ...validRow, status: "invalid_status" };
    const result = validateEventRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid status"))).toBe(true);
  });

  it("rejects invalid event_date format", () => {
    const row = { ...validRow, event_date: "01-15-2026" };
    const result = validateEventRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid event_date format"))).toBe(true);
  });

  it("rejects invalid day_of_week", () => {
    const row = { ...validRow, day_of_week: "Funday" };
    const result = validateEventRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid day_of_week"))).toBe(true);
  });

  it("rejects invalid start_time format", () => {
    const row = { ...validRow, start_time: "7pm" };
    const result = validateEventRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid start_time format"))).toBe(true);
  });

  it("accepts HH:MM time format", () => {
    const row = { ...validRow, start_time: "19:00" };
    const result = validateEventRow(row);
    expect(result.valid).toBe(true);
  });

  it("rejects invalid venue_id format", () => {
    const row = { ...validRow, venue_id: "not-a-uuid" };
    const result = validateEventRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid UUID format for venue_id"))).toBe(true);
  });

  it("adds warning for missing start_time", () => {
    const row = { ...validRow, start_time: null };
    const result = validateEventRow(row);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("Missing start_time");
  });

  it("adds warning for missing venue_id", () => {
    const row = { ...validRow, venue_id: null };
    const result = validateEventRow(row);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("Missing venue_id");
  });

  it("allows empty optional fields", () => {
    const row = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      title: "Minimal Event",
      event_type: "open_mic",
      status: "active",
      is_recurring: null,
      event_date: null,
      day_of_week: null,
      start_time: null,
      end_time: null,
      venue_id: null,
      is_published: null,
      notes: null,
    };
    const result = validateEventRow(row);
    expect(result.valid).toBe(true);
  });
});

describe("normalizeEventRow", () => {
  it("trims whitespace", () => {
    const row = {
      id: "  123e4567-e89b-12d3-a456-426614174000  ",
      title: "  Test Event  ",
      event_type: "  open_mic  ",
      status: "  active  ",
      is_recurring: true,
      event_date: "  2026-01-15  ",
      day_of_week: "  Monday  ",
      start_time: "  19:00:00  ",
      end_time: "  22:00:00  ",
      venue_id: "  223e4567-e89b-12d3-a456-426614174000  ",
      is_published: true,
      notes: "  Notes  ",
    };
    const result = normalizeEventRow(row);
    expect(result.id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(result.title).toBe("Test Event");
    expect(result.day_of_week).toBe("Monday");
  });

  it("converts empty strings to null", () => {
    const row = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      title: "Test Event",
      event_type: "open_mic",
      status: "active",
      is_recurring: null,
      event_date: "",
      day_of_week: "",
      start_time: "",
      end_time: "",
      venue_id: "",
      is_published: null,
      notes: "",
    };
    const result = normalizeEventRow(row);
    expect(result.event_date).toBeNull();
    expect(result.day_of_week).toBeNull();
    expect(result.venue_id).toBeNull();
    expect(result.notes).toBeNull();
  });

  it("converts whitespace-only to null", () => {
    const row = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      title: "Test Event",
      event_type: "open_mic",
      status: "active",
      is_recurring: null,
      event_date: "   ",
      day_of_week: "   ",
      start_time: "   ",
      end_time: "   ",
      venue_id: "   ",
      is_published: null,
      notes: "   ",
    };
    const result = normalizeEventRow(row);
    expect(result.event_date).toBeNull();
    expect(result.day_of_week).toBeNull();
    expect(result.notes).toBeNull();
  });
});

describe("validateEventRows", () => {
  it("separates valid and invalid rows", () => {
    const rows = [
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "Valid Event",
        event_type: "open_mic",
        status: "active",
        is_recurring: null,
        event_date: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        venue_id: null,
        is_published: null,
        notes: null,
      },
      {
        id: "invalid-id",
        title: "Invalid Event",
        event_type: "open_mic",
        status: "active",
        is_recurring: null,
        event_date: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        venue_id: null,
        is_published: null,
        notes: null,
      },
    ];

    const result = validateEventRows(rows);
    expect(result.validRows).toHaveLength(1);
    expect(result.invalidRows).toHaveLength(1);
    expect(result.allValid).toBe(false);
  });

  it("returns 1-indexed row numbers in errors", () => {
    const rows = [
      {
        id: "invalid",
        title: "",
        event_type: "open_mic",
        status: "active",
        is_recurring: null,
        event_date: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        venue_id: null,
        is_published: null,
        notes: null,
      },
    ];

    const result = validateEventRows(rows);
    expect(result.invalidRows[0].rowIndex).toBe(1);
  });

  it("returns allValid: true when all rows valid", () => {
    const rows = [
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "Event 1",
        event_type: "open_mic",
        status: "active",
        is_recurring: null,
        event_date: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        venue_id: null,
        is_published: null,
        notes: null,
      },
      {
        id: "223e4567-e89b-12d3-a456-426614174000",
        title: "Event 2",
        event_type: "showcase",
        status: "draft",
        is_recurring: null,
        event_date: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        venue_id: null,
        is_published: null,
        notes: null,
      },
    ];

    const result = validateEventRows(rows);
    expect(result.allValid).toBe(true);
    expect(result.validRows).toHaveLength(2);
  });

  it("collects warnings separately", () => {
    const rows = [
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "Event without venue",
        event_type: "open_mic",
        status: "active",
        is_recurring: null,
        event_date: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        venue_id: null,
        is_published: null,
        notes: null,
      },
    ];

    const result = validateEventRows(rows);
    expect(result.allValid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].warnings.length).toBeGreaterThan(0);
  });
});

describe("Constants", () => {
  it("VALID_EVENT_TYPES includes expected values", () => {
    expect(VALID_EVENT_TYPES).toContain("open_mic");
    expect(VALID_EVENT_TYPES).toContain("showcase");
    expect(VALID_EVENT_TYPES).toContain("song_circle");
    expect(VALID_EVENT_TYPES).toContain("workshop");
    expect(VALID_EVENT_TYPES).toContain("jam_session");
  });

  it("VALID_STATUSES includes expected values", () => {
    expect(VALID_STATUSES).toContain("active");
    expect(VALID_STATUSES).toContain("draft");
    expect(VALID_STATUSES).toContain("cancelled");
  });

  it("VALID_DAYS_OF_WEEK includes all 7 days", () => {
    expect(VALID_DAYS_OF_WEEK).toHaveLength(7);
    expect(VALID_DAYS_OF_WEEK).toContain("Monday");
    expect(VALID_DAYS_OF_WEEK).toContain("Sunday");
  });
});

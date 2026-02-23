/**
 * Event CSV Parser Tests
 *
 * Tests for eventCsvParser.ts functions.
 */

import { describe, it, expect } from "vitest";
import {
  parseEventCsv,
  serializeEventCsv,
  EVENT_CSV_HEADERS,
} from "@/lib/ops/eventCsvParser";

describe("parseEventCsv", () => {
  const validHeader = EVENT_CSV_HEADERS.join(",");

  it("parses valid CSV with header and data", () => {
    const csv = `${validHeader}
123e4567-e89b-12d3-a456-426614174000,Test Event,open_mic,active,true,2026-01-15,Monday,19:00:00,22:00:00,223e4567-e89b-12d3-a456-426614174000,true,Some notes`;

    const result = parseEventCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(result.rows[0].title).toBe("Test Event");
    expect(result.rows[0].event_type).toBe("open_mic");
    expect(result.rows[0].is_recurring).toBe(true);
    expect(result.rows[0].notes).toBe("Some notes");
  });

  it("handles empty optional fields", () => {
    const csv = `${validHeader}
123e4567-e89b-12d3-a456-426614174000,Minimal Event,open_mic,active,,,,,,,false,`;

    const result = parseEventCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows[0].title).toBe("Minimal Event");
    expect(result.rows[0].event_date).toBeNull();
    expect(result.rows[0].venue_id).toBeNull();
  });

  it("rejects empty CSV", () => {
    const result = parseEventCsv("");

    expect(result.success).toBe(false);
    expect(result.errors).toContain("CSV is empty");
  });

  it("rejects wrong column count in header", () => {
    const csv = "id,title,event_type,status\n123,Test,open_mic,active";

    const result = parseEventCsv(csv);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid header count"))).toBe(true);
  });

  it("rejects wrong column names", () => {
    const csv =
      "id,name,event_type,status,is_recurring,event_date,day_of_week,start_time,end_time,venue_id,is_published,notes\n123,Test,open_mic,active,,,,,,,,";

    const result = parseEventCsv(csv);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid header at column 2"))).toBe(
      true
    );
  });

  it("rejects row with wrong column count", () => {
    const csv = `${validHeader}
123,Test,open_mic`;

    const result = parseEventCsv(csv);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Row 2"))).toBe(true);
  });

  it("handles Windows line endings", () => {
    const csv = `${validHeader}\r\n123e4567-e89b-12d3-a456-426614174000,Test,open_mic,active,,,,,,,,`;

    const result = parseEventCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
  });

  it("handles Mac line endings", () => {
    const csv = `${validHeader}\r123e4567-e89b-12d3-a456-426614174000,Test,open_mic,active,,,,,,,,`;

    const result = parseEventCsv(csv);

    expect(result.success).toBe(true);
  });

  it("skips blank lines", () => {
    const csv = `${validHeader}

123e4567-e89b-12d3-a456-426614174000,Test,open_mic,active,,,,,,,,

`;

    const result = parseEventCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
  });

  it("parses multiple rows", () => {
    const csv = `${validHeader}
123e4567-e89b-12d3-a456-426614174001,Event 1,open_mic,active,,,,,,,,
123e4567-e89b-12d3-a456-426614174002,Event 2,showcase,draft,,,,,,,,
123e4567-e89b-12d3-a456-426614174003,Event 3,workshop,active,,,,,,,,`;

    const result = parseEventCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(3);
  });

  it("parses boolean values correctly", () => {
    const csv = `${validHeader}
123e4567-e89b-12d3-a456-426614174000,Test,open_mic,active,true,,,,,,,
223e4567-e89b-12d3-a456-426614174000,Test 2,open_mic,active,false,,,,,,,
323e4567-e89b-12d3-a456-426614174000,Test 3,open_mic,active,,,,,,,,`;

    const result = parseEventCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows[0].is_recurring).toBe(true);
    expect(result.rows[1].is_recurring).toBe(false);
    expect(result.rows[2].is_recurring).toBeNull();
  });
});

describe("serializeEventCsv", () => {
  it("serializes events to CSV with header", () => {
    const events = [
      {
        id: "123",
        title: "Test Event",
        event_type: ["open_mic"],
        status: "active",
        is_recurring: true,
        event_date: "2026-01-15",
        day_of_week: "Monday",
        start_time: "19:00:00",
        end_time: "22:00:00",
        venue_id: "456",
        is_published: true,
        host_notes: "Great venue",
      },
    ];

    const csv = serializeEventCsv(events);
    const lines = csv.split("\n");

    expect(lines[0]).toBe(EVENT_CSV_HEADERS.join(","));
    expect(lines[1]).toContain("123");
    expect(lines[1]).toContain("Test Event");
    expect(lines[1]).toContain("Great venue");
  });

  it("handles null values as empty strings", () => {
    const events = [
      {
        id: "123",
        title: "Minimal Event",
        event_type: ["open_mic"],
        status: null,
        is_recurring: null,
        event_date: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        venue_id: null,
        is_published: null,
        host_notes: null,
      },
    ];

    const csv = serializeEventCsv(events);
    const lines = csv.split("\n");

    expect(lines[1]).toBe("123,Minimal Event,open_mic,,,,,,,,,");
  });

  it("escapes commas in values", () => {
    const events = [
      {
        id: "123",
        title: "Event, Inc.",
        event_type: ["open_mic"],
        status: "active",
        is_recurring: null,
        event_date: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        venue_id: null,
        is_published: null,
        host_notes: "Notes, with, commas",
      },
    ];

    const csv = serializeEventCsv(events);
    const lines = csv.split("\n");

    expect(lines[1]).toContain('"Event, Inc."');
    expect(lines[1]).toContain('"Notes, with, commas"');
  });

  it("escapes quotes in values", () => {
    const events = [
      {
        id: "123",
        title: 'The "Best" Event',
        event_type: ["open_mic"],
        status: "active",
        is_recurring: null,
        event_date: null,
        day_of_week: null,
        start_time: null,
        end_time: null,
        venue_id: null,
        is_published: null,
        host_notes: null,
      },
    ];

    const csv = serializeEventCsv(events);
    const lines = csv.split("\n");

    expect(lines[1]).toContain('"The ""Best"" Event"');
  });

  it("returns header only for empty array", () => {
    const csv = serializeEventCsv([]);
    expect(csv).toBe(EVENT_CSV_HEADERS.join(","));
  });

  it("serializes multiple events", () => {
    const events = [
      { id: "1", title: "Event 1", event_type: ["open_mic"], status: "active", is_recurring: null, event_date: null, day_of_week: null, start_time: null, end_time: null, venue_id: null, is_published: null, host_notes: null },
      { id: "2", title: "Event 2", event_type: ["showcase"], status: "draft", is_recurring: null, event_date: null, day_of_week: null, start_time: null, end_time: null, venue_id: null, is_published: null, host_notes: null },
      { id: "3", title: "Event 3", event_type: ["workshop"], status: "active", is_recurring: null, event_date: null, day_of_week: null, start_time: null, end_time: null, venue_id: null, is_published: null, host_notes: null },
    ];

    const csv = serializeEventCsv(events);
    const lines = csv.split("\n");

    expect(lines).toHaveLength(4); // Header + 3 rows
  });
});

describe("EVENT_CSV_HEADERS", () => {
  it("has 12 columns", () => {
    expect(EVENT_CSV_HEADERS).toHaveLength(12);
  });

  it("starts with id and title", () => {
    expect(EVENT_CSV_HEADERS[0]).toBe("id");
    expect(EVENT_CSV_HEADERS[1]).toBe("title");
  });

  it("does NOT include verification timestamps", () => {
    expect(EVENT_CSV_HEADERS).not.toContain("last_verified_at");
    expect(EVENT_CSV_HEADERS).not.toContain("verified_by");
  });

  it("includes key fields", () => {
    expect(EVENT_CSV_HEADERS).toContain("event_type");
    expect(EVENT_CSV_HEADERS).toContain("status");
    expect(EVENT_CSV_HEADERS).toContain("venue_id");
    expect(EVENT_CSV_HEADERS).toContain("is_recurring");
  });
});

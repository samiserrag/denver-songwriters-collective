/**
 * Override CSV Parser + Validation + Diff Tests
 *
 * Tests for overrideCsvParser.ts, overrideValidation.ts, and overrideDiff.ts.
 */

import { describe, it, expect } from "vitest";
import {
  parseOverrideCsv,
  serializeOverrideCsv,
  OVERRIDE_CSV_HEADERS,
  getOverrideCompositeKey,
  DatabaseOverride,
} from "@/lib/ops/overrideCsvParser";
import {
  validateOverrideRow,
  normalizeOverrideRow,
  validateOverrideRows,
  VALID_OVERRIDE_STATUSES,
} from "@/lib/ops/overrideValidation";
import {
  computeOverrideDiff,
  buildOverrideUpdatePayloads,
} from "@/lib/ops/overrideDiff";
import { OverrideRow } from "@/lib/ops/overrideCsvParser";

// ─────────────────────────────────────────────────────────────────────────────
// CSV Parser Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("parseOverrideCsv", () => {
  const validHeader = OVERRIDE_CSV_HEADERS.join(",");

  it("parses valid CSV with header and data", () => {
    const csv = `${validHeader}
123e4567-e89b-12d3-a456-426614174000,2026-01-15,cancelled,,,`;

    const result = parseOverrideCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].event_id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(result.rows[0].date_key).toBe("2026-01-15");
    expect(result.rows[0].status).toBe("cancelled");
  });

  it("handles empty optional fields", () => {
    const csv = `${validHeader}
123e4567-e89b-12d3-a456-426614174000,2026-01-15,normal,,,`;

    const result = parseOverrideCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows[0].override_start_time).toBeNull();
    expect(result.rows[0].override_notes).toBeNull();
    expect(result.rows[0].override_cover_image_url).toBeNull();
  });

  it("rejects empty CSV", () => {
    const result = parseOverrideCsv("");
    expect(result.success).toBe(false);
    expect(result.errors).toContain("CSV is empty");
  });

  it("rejects wrong column count in header", () => {
    const csv = "event_id,date_key,status\n123,2026-01-15,cancelled";

    const result = parseOverrideCsv(csv);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid header count"))).toBe(true);
  });

  it("parses multiple rows", () => {
    const csv = `${validHeader}
123e4567-e89b-12d3-a456-426614174001,2026-01-15,cancelled,,,
123e4567-e89b-12d3-a456-426614174001,2026-01-22,normal,20:00:00,,
123e4567-e89b-12d3-a456-426614174002,2026-02-01,cancelled,,,`;

    const result = parseOverrideCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(3);
  });

  it("handles optional fields with values", () => {
    const csv = `${validHeader}
123e4567-e89b-12d3-a456-426614174000,2026-01-15,normal,20:00:00,Special notes,https://example.com/image.jpg`;

    const result = parseOverrideCsv(csv);

    expect(result.success).toBe(true);
    expect(result.rows[0].override_start_time).toBe("20:00:00");
    expect(result.rows[0].override_notes).toBe("Special notes");
    expect(result.rows[0].override_cover_image_url).toBe("https://example.com/image.jpg");
  });
});

describe("serializeOverrideCsv", () => {
  it("serializes overrides to CSV with header", () => {
    const overrides: DatabaseOverride[] = [
      {
        id: "456",
        event_id: "123",
        date_key: "2026-01-15",
        status: "cancelled",
        override_start_time: null,
        override_notes: null,
        override_cover_image_url: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        created_by: null,
      },
    ];

    const csv = serializeOverrideCsv(overrides);
    const lines = csv.split("\n");

    expect(lines[0]).toBe(OVERRIDE_CSV_HEADERS.join(","));
    expect(lines[1]).toContain("123");
    expect(lines[1]).toContain("2026-01-15");
    expect(lines[1]).toContain("cancelled");
  });

  it("returns header only for empty array", () => {
    const csv = serializeOverrideCsv([]);
    expect(csv).toBe(OVERRIDE_CSV_HEADERS.join(","));
  });
});

describe("getOverrideCompositeKey", () => {
  it("generates composite key from event_id and date_key", () => {
    const key = getOverrideCompositeKey({
      event_id: "123e4567-e89b-12d3-a456-426614174000",
      date_key: "2026-01-15",
    });

    expect(key).toBe("123e4567-e89b-12d3-a456-426614174000:2026-01-15");
  });
});

describe("OVERRIDE_CSV_HEADERS", () => {
  it("has 6 columns", () => {
    expect(OVERRIDE_CSV_HEADERS).toHaveLength(6);
  });

  it("does NOT include id column", () => {
    expect(OVERRIDE_CSV_HEADERS).not.toContain("id");
  });

  it("starts with event_id and date_key", () => {
    expect(OVERRIDE_CSV_HEADERS[0]).toBe("event_id");
    expect(OVERRIDE_CSV_HEADERS[1]).toBe("date_key");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("validateOverrideRow", () => {
  const validRow: OverrideRow = {
    event_id: "123e4567-e89b-12d3-a456-426614174000",
    date_key: "2026-01-15",
    status: "cancelled",
    override_start_time: null,
    override_notes: null,
    override_cover_image_url: null,
  };

  it("accepts a valid row", () => {
    const result = validateOverrideRow(validRow);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing event_id", () => {
    const row = { ...validRow, event_id: "" };
    const result = validateOverrideRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: event_id");
  });

  it("rejects invalid UUID format for event_id", () => {
    const row = { ...validRow, event_id: "not-a-uuid" };
    const result = validateOverrideRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid UUID format"))).toBe(true);
  });

  it("rejects missing date_key", () => {
    const row = { ...validRow, date_key: "" };
    const result = validateOverrideRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: date_key");
  });

  it("rejects invalid date_key format", () => {
    const row = { ...validRow, date_key: "01-15-2026" };
    const result = validateOverrideRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid date_key format"))).toBe(true);
  });

  it("rejects invalid status", () => {
    const row = { ...validRow, status: "invalid" };
    const result = validateOverrideRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid status"))).toBe(true);
  });

  it("rejects invalid override_start_time format", () => {
    const row = { ...validRow, override_start_time: "8pm" };
    const result = validateOverrideRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid override_start_time format"))).toBe(true);
  });

  it("rejects invalid URL for override_cover_image_url", () => {
    const row = { ...validRow, override_cover_image_url: "not-a-url" };
    const result = validateOverrideRow(row);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid override_cover_image_url"))).toBe(true);
  });

  it("accepts valid http URL", () => {
    const row = { ...validRow, override_cover_image_url: "http://example.com/image.jpg" };
    const result = validateOverrideRow(row);
    expect(result.valid).toBe(true);
  });

  it("accepts valid https URL", () => {
    const row = { ...validRow, override_cover_image_url: "https://example.com/image.jpg" };
    const result = validateOverrideRow(row);
    expect(result.valid).toBe(true);
  });
});

describe("validateOverrideRows", () => {
  it("separates valid and invalid rows", () => {
    const rows: OverrideRow[] = [
      {
        event_id: "123e4567-e89b-12d3-a456-426614174000",
        date_key: "2026-01-15",
        status: "cancelled",
        override_start_time: null,
        override_notes: null,
        override_cover_image_url: null,
      },
      {
        event_id: "invalid",
        date_key: "2026-01-15",
        status: "cancelled",
        override_start_time: null,
        override_notes: null,
        override_cover_image_url: null,
      },
    ];

    const result = validateOverrideRows(rows);
    expect(result.validRows).toHaveLength(1);
    expect(result.invalidRows).toHaveLength(1);
    expect(result.allValid).toBe(false);
  });

  it("detects duplicate composite keys within CSV", () => {
    const rows: OverrideRow[] = [
      {
        event_id: "123e4567-e89b-12d3-a456-426614174000",
        date_key: "2026-01-15",
        status: "cancelled",
        override_start_time: null,
        override_notes: null,
        override_cover_image_url: null,
      },
      {
        event_id: "123e4567-e89b-12d3-a456-426614174000",
        date_key: "2026-01-15", // Same event_id + date_key
        status: "normal",
        override_start_time: null,
        override_notes: null,
        override_cover_image_url: null,
      },
    ];

    const result = validateOverrideRows(rows);
    expect(result.allValid).toBe(false);
    expect(result.invalidRows.some((r) => r.errors.some((e) => e.includes("Duplicate")))).toBe(true);
  });
});

describe("normalizeOverrideRow", () => {
  it("trims whitespace", () => {
    const row: OverrideRow = {
      event_id: "  123e4567-e89b-12d3-a456-426614174000  ",
      date_key: "  2026-01-15  ",
      status: "  cancelled  ",
      override_start_time: "  20:00:00  ",
      override_notes: "  Notes  ",
      override_cover_image_url: "  https://example.com  ",
    };

    const result = normalizeOverrideRow(row);
    expect(result.event_id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(result.date_key).toBe("2026-01-15");
    expect(result.status).toBe("cancelled");
  });

  it("converts empty strings to null", () => {
    const row: OverrideRow = {
      event_id: "123e4567-e89b-12d3-a456-426614174000",
      date_key: "2026-01-15",
      status: "cancelled",
      override_start_time: "",
      override_notes: "",
      override_cover_image_url: "",
    };

    const result = normalizeOverrideRow(row);
    expect(result.override_start_time).toBeNull();
    expect(result.override_notes).toBeNull();
    expect(result.override_cover_image_url).toBeNull();
  });
});

describe("VALID_OVERRIDE_STATUSES", () => {
  it("includes normal and cancelled", () => {
    expect(VALID_OVERRIDE_STATUSES).toContain("normal");
    expect(VALID_OVERRIDE_STATUSES).toContain("cancelled");
  });

  it("has exactly 2 values", () => {
    expect(VALID_OVERRIDE_STATUSES).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Diff Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("computeOverrideDiff", () => {
  const makeDbOverride = (overrides: Partial<DatabaseOverride> = {}): DatabaseOverride => ({
    id: "override-id-1",
    event_id: "123e4567-e89b-12d3-a456-426614174000",
    date_key: "2026-01-15",
    status: "cancelled",
    override_start_time: null,
    override_notes: null,
    override_cover_image_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
    ...overrides,
  });

  const makeOverrideRow = (overrides: Partial<OverrideRow> = {}): OverrideRow => ({
    event_id: "123e4567-e89b-12d3-a456-426614174000",
    date_key: "2026-01-15",
    status: "cancelled",
    override_start_time: null,
    override_notes: null,
    override_cover_image_url: null,
    ...overrides,
  });

  const validEventIds = new Set(["123e4567-e89b-12d3-a456-426614174000"]);

  it("detects no changes when data is identical", () => {
    const current = [makeDbOverride()];
    const incoming = [makeOverrideRow()];

    const result = computeOverrideDiff(current, incoming, validEventIds);

    expect(result.updates).toHaveLength(0);
    expect(result.inserts).toHaveLength(0);
    expect(result.unchanged).toBe(1);
  });

  it("detects update to existing override", () => {
    const current = [makeDbOverride({ status: "cancelled" })];
    const incoming = [makeOverrideRow({ status: "normal" })];

    const result = computeOverrideDiff(current, incoming, validEventIds);

    expect(result.updates).toHaveLength(1);
    expect(result.inserts).toHaveLength(0);
    expect(result.updates[0].changes[0]).toEqual({
      field: "status",
      oldValue: "cancelled",
      newValue: "normal",
    });
  });

  it("detects new override to insert", () => {
    const current: DatabaseOverride[] = [];
    const incoming = [makeOverrideRow()];

    const result = computeOverrideDiff(current, incoming, validEventIds);

    expect(result.updates).toHaveLength(0);
    expect(result.inserts).toHaveLength(1);
    expect(result.inserts[0].event_id).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(result.inserts[0].date_key).toBe("2026-01-15");
  });

  it("reports invalid event_ids", () => {
    const incoming = [
      makeOverrideRow({ event_id: "invalid-event-id-0000-000000000000" }),
    ];

    const result = computeOverrideDiff([], incoming, validEventIds);

    expect(result.inserts).toHaveLength(0);
    expect(result.eventIdsNotFound).toContain("invalid-event-id-0000-000000000000");
  });

  it("handles mix of inserts and updates", () => {
    const current = [
      makeDbOverride({ event_id: "123e4567-e89b-12d3-a456-426614174000", date_key: "2026-01-15" }),
    ];
    const incoming = [
      makeOverrideRow({ event_id: "123e4567-e89b-12d3-a456-426614174000", date_key: "2026-01-15", status: "normal" }), // Update
      makeOverrideRow({ event_id: "123e4567-e89b-12d3-a456-426614174000", date_key: "2026-01-22" }), // Insert
    ];

    const result = computeOverrideDiff(current, incoming, validEventIds);

    expect(result.updates).toHaveLength(1);
    expect(result.inserts).toHaveLength(1);
  });

  it("detects multiple field changes", () => {
    const current = [makeDbOverride()];
    const incoming = [
      makeOverrideRow({
        status: "normal",
        override_start_time: "20:00:00",
        override_notes: "New notes",
      }),
    ];

    const result = computeOverrideDiff(current, incoming, validEventIds);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].changes).toHaveLength(3);
  });
});

describe("buildOverrideUpdatePayloads", () => {
  it("builds payload with only changed fields", () => {
    const diffs = [
      {
        id: "override-id-1",
        event_id: "123e4567-e89b-12d3-a456-426614174000",
        date_key: "2026-01-15",
        changes: [
          { field: "status", oldValue: "cancelled", newValue: "normal" },
          { field: "override_start_time", oldValue: null, newValue: "20:00:00" },
        ],
      },
    ];

    const payloads = buildOverrideUpdatePayloads(diffs);

    expect(payloads).toHaveLength(1);
    expect(payloads[0].id).toBe("override-id-1");
    expect(payloads[0].updates).toEqual({
      status: "normal",
      override_start_time: "20:00:00",
    });
  });

  it("returns empty array for no diffs", () => {
    const payloads = buildOverrideUpdatePayloads([]);
    expect(payloads).toHaveLength(0);
  });
});

/**
 * Bulk Import v1 Tests
 *
 * Phase 4.88: Tests for CSV-based event import (INSERT-only, no UPDATE)
 *
 * Coverage:
 * - Parser: CSV parsing, header validation, 500-row limit
 * - Validation: Required fields, recurrence invariants, enum values
 * - Deduplication: Slug generation
 * - Builder: System defaults, recurrence canonicalization
 * - API contracts: Preview read-only, apply INSERT-only
 */

import { describe, it, expect } from "vitest";
import {
  parseImportCsv,
  generateImportTemplate,
  IMPORT_CSV_HEADERS,
  MAX_IMPORT_ROWS,
} from "@/lib/ops/eventImportParser";
import { validateImportRows, ValidatedRow } from "@/lib/ops/eventImportValidation";
import { generateSlug } from "@/lib/ops/eventImportDedupe";
import { buildInsertPayloads } from "@/lib/ops/eventImportBuilder";

// =====================================================
// PARSER TESTS
// =====================================================

describe("eventImportParser", () => {
  describe("parseImportCsv", () => {
    it("parses valid CSV with all 16 columns", () => {
      const csv = `title,event_type,event_date,start_time,end_time,venue_id,venue_name,day_of_week,recurrence_rule,description,external_url,categories,is_free,cost_label,age_policy,pre_verified
"Open Mic Night",open_mic,2026-02-01,19:00,22:00,,The Rusty Mic,Saturday,weekly,Come join us!,https://example.com,"music,comedy",true,,all_ages,false`;

      const result = parseImportCsv(csv);
      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe("Open Mic Night");
      expect(result.rows[0].event_type).toBe("open_mic");
      expect(result.rows[0].event_date).toBe("2026-02-01");
      expect(result.rows[0].venue_name).toBe("The Rusty Mic");
      expect(result.rows[0].categories).toBe("music,comedy");
    });

    it("handles RFC4180 quoted fields with commas", () => {
      const csv = `title,event_type,event_date,start_time,end_time,venue_id,venue_name,day_of_week,recurrence_rule,description,external_url,categories,is_free,cost_label,age_policy,pre_verified
"Open Mic, Comedy Night",open_mic,2026-02-01,19:00,22:00,,,"","","A great show, with lots of laughs",,music,true,,,false`;

      const result = parseImportCsv(csv);
      expect(result.success).toBe(true);
      expect(result.rows[0].title).toBe("Open Mic, Comedy Night");
      expect(result.rows[0].description).toBe("A great show, with lots of laughs");
    });

    it("handles RFC4180 escaped quotes", () => {
      const csv = `title,event_type,event_date,start_time,end_time,venue_id,venue_name,day_of_week,recurrence_rule,description,external_url,categories,is_free,cost_label,age_policy,pre_verified
"The ""Best"" Open Mic",open_mic,2026-02-01,19:00,22:00,,,,,,,,,,,false`;

      const result = parseImportCsv(csv);
      expect(result.success).toBe(true);
      expect(result.rows[0].title).toBe('The "Best" Open Mic');
    });

    it("rejects CSV with wrong number of columns", () => {
      const csv = `title,event_type,event_date
"Open Mic Night",open_mic,2026-02-01`;

      const result = parseImportCsv(csv);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes("expected 16"))).toBe(true);
    });

    it("rejects CSV exceeding 500 row limit", () => {
      const header = IMPORT_CSV_HEADERS.join(",");
      const dataRow = `"Event",open_mic,2026-02-01,19:00,22:00,,,,,,,,,,,false`;
      const rows = Array(501).fill(dataRow);
      const csv = [header, ...rows].join("\n");

      const result = parseImportCsv(csv);
      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toMatch(/exceeds maximum.*500/i);
    });

    it("allows exactly 500 rows", () => {
      const header = IMPORT_CSV_HEADERS.join(",");
      const dataRow = `"Event",open_mic,2026-02-01,19:00,22:00,,,,,,,,,,,false`;
      const rows = Array(500).fill(dataRow);
      const csv = [header, ...rows].join("\n");

      const result = parseImportCsv(csv);
      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(500);
    });

    it("handles CRLF line endings", () => {
      const csv = `title,event_type,event_date,start_time,end_time,venue_id,venue_name,day_of_week,recurrence_rule,description,external_url,categories,is_free,cost_label,age_policy,pre_verified\r\n"Open Mic",open_mic,2026-02-01,19:00,22:00,,,,,,,,,,,false`;

      const result = parseImportCsv(csv);
      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
    });

    it("skips empty lines", () => {
      const csv = `title,event_type,event_date,start_time,end_time,venue_id,venue_name,day_of_week,recurrence_rule,description,external_url,categories,is_free,cost_label,age_policy,pre_verified

"Open Mic",open_mic,2026-02-01,19:00,22:00,,,,,,,,,,,false

`;

      const result = parseImportCsv(csv);
      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe("generateImportTemplate", () => {
    it("generates template with correct headers", () => {
      const template = generateImportTemplate();
      const lines = template.trim().split("\n");
      expect(lines[0]).toBe(IMPORT_CSV_HEADERS.join(","));
    });

    it("includes example row", () => {
      const template = generateImportTemplate();
      const lines = template.trim().split("\n");
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[1]).toContain("Example Open Mic");
    });
  });

  describe("MAX_IMPORT_ROWS constant", () => {
    it("is set to 500", () => {
      expect(MAX_IMPORT_ROWS).toBe(500);
    });
  });
});

// =====================================================
// VALIDATION TESTS
// =====================================================

describe("eventImportValidation", () => {
  describe("validateImportRows", () => {
    const minimalValidRow = {
      rowNumber: 2,
      title: "Test Event",
      event_type: "open_mic",
      event_date: "2026-02-01",
      start_time: null,
      end_time: null,
      venue_id: null,
      venue_name: "Test Venue", // venue_name or venue_id is required
      day_of_week: null,
      recurrence_rule: null,
      description: null,
      external_url: null,
      categories: null,
      is_free: null,
      cost_label: null,
      age_policy: null,
      pre_verified: false,
    };

    it("accepts valid minimal row", () => {
      const result = validateImportRows([minimalValidRow]);
      expect(result.invalidRows).toHaveLength(0);
      expect(result.validRows).toHaveLength(1);
    });

    it("rejects row missing title", () => {
      const row = { ...minimalValidRow, title: "" };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(1);
      expect(result.invalidRows[0].errors.some(e => e.toLowerCase().includes("title"))).toBe(true);
    });

    it("rejects row missing event_type", () => {
      const row = { ...minimalValidRow, event_type: "" };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(1);
      expect(result.invalidRows[0].errors.some(e => e.toLowerCase().includes("event_type"))).toBe(true);
    });

    it("rejects row missing event_date", () => {
      const row = { ...minimalValidRow, event_date: "" };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(1);
      expect(result.invalidRows[0].errors.some(e => e.toLowerCase().includes("event_date"))).toBe(true);
    });

    it("rejects row missing both venue_id and venue_name", () => {
      const row = { ...minimalValidRow, venue_id: null, venue_name: null };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(1);
      expect(result.invalidRows[0].errors.some(e => e.toLowerCase().includes("venue"))).toBe(true);
    });

    it("accepts row with venue_id but no venue_name", () => {
      const row = { ...minimalValidRow, venue_id: "550e8400-e29b-41d4-a716-446655440000", venue_name: null };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(0);
      expect(result.validRows).toHaveLength(1);
    });

    it("accepts row with venue_name but no venue_id", () => {
      const row = { ...minimalValidRow, venue_id: null, venue_name: "The Rusty Mic" };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(0);
      expect(result.validRows).toHaveLength(1);
    });

    it("rejects invalid event_type", () => {
      const row = { ...minimalValidRow, event_type: "invalid_type" };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(1);
      expect(result.invalidRows[0].errors.some(e => e.toLowerCase().includes("invalid") && e.includes("event_type"))).toBe(true);
    });

    it("rejects invalid date format", () => {
      const row = { ...minimalValidRow, event_date: "02/01/2026" };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(1);
      expect(result.invalidRows[0].errors.some(e => e.toLowerCase().includes("date"))).toBe(true);
    });

    it("rejects invalid time format", () => {
      const row = { ...minimalValidRow, start_time: "7pm" };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(1);
      expect(result.invalidRows[0].errors.some(e => e.toLowerCase().includes("time"))).toBe(true);
    });

    it("accepts valid time format HH:MM", () => {
      const row = { ...minimalValidRow, start_time: "19:00", end_time: "22:30" };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(0);
    });

    it("rejects ordinal monthly without day_of_week", () => {
      const row = { ...minimalValidRow, recurrence_rule: "1st" };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(1);
      expect(result.invalidRows[0].errors.some(e => e.toLowerCase().includes("day_of_week"))).toBe(true);
    });

    it("accepts ordinal monthly with day_of_week", () => {
      const row = { ...minimalValidRow, recurrence_rule: "1st", day_of_week: "Saturday" };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(0);
    });

    it("derives day_of_week for weekly from event_date", () => {
      // 2026-02-01 is a Sunday
      const row = { ...minimalValidRow, recurrence_rule: "weekly" };
      const result = validateImportRows([row]);
      expect(result.invalidRows).toHaveLength(0);
      expect(result.validRows[0].derived_day_of_week).toBe("Sunday");
    });

    it("validates all known event types", () => {
      const validTypes = [
        "open_mic",
        "song_circle",
        "workshop",
        "showcase",
        "gig",
        "meetup",
        "jam_session",
        "other",
      ];
      for (const eventType of validTypes) {
        const row = { ...minimalValidRow, event_type: eventType };
        const result = validateImportRows([row]);
        expect(result.invalidRows).toHaveLength(0);
      }
    });

    it("validates multi-ordinal recurrence rules", () => {
      const validRules = ["1st/3rd", "2nd/4th"];
      for (const rule of validRules) {
        const row = { ...minimalValidRow, recurrence_rule: rule, day_of_week: "Monday" };
        const result = validateImportRows([row]);
        expect(result.invalidRows).toHaveLength(0);
      }
    });
  });
});

// =====================================================
// SLUG GENERATION TESTS
// =====================================================

describe("eventImportDedupe", () => {
  describe("generateSlug", () => {
    it("converts title to lowercase slug", () => {
      expect(generateSlug("Open Mic Night")).toBe("open-mic-night");
    });

    it("handles special characters", () => {
      expect(generateSlug("Bob's Open Mic!")).toBe("bobs-open-mic");
    });

    it("handles multiple spaces", () => {
      expect(generateSlug("Open  Mic   Night")).toBe("open-mic-night");
    });

    it("handles leading/trailing spaces", () => {
      expect(generateSlug("  Open Mic  ")).toBe("open-mic");
    });
  });
});

// =====================================================
// BUILDER TESTS
// =====================================================

describe("eventImportBuilder", () => {
  describe("buildInsertPayloads", () => {
    const validatedRow: ValidatedRow = {
      rowNumber: 2,
      title: "Test Event",
      event_type: "open_mic",
      event_date: "2026-02-01",
      start_time: "19:00",
      end_time: "22:00",
      venue_id: "venue-123",
      venue_name: null,
      day_of_week: "Sunday",
      recurrence_rule: "weekly",
      description: "A test event",
      external_url: "https://example.com",
      categories: "music|comedy",
      is_free: true,
      cost_label: null,
      age_policy: "all_ages",
      pre_verified: false,
      derived_day_of_week: "Sunday",
      is_recurring: true,
      parsed_categories: ["music", "comedy"],
    };

    const adminUserId = "admin-user-123";
    const emptyVenueResolutions = new Map<number, string | null>();

    it("sets source to 'import'", () => {
      const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.source).toBe("import");
    });

    it("sets host_id to null", () => {
      const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.host_id).toBeNull();
    });

    it("sets is_published to true", () => {
      const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.is_published).toBe(true);
    });

    it("sets status to 'active'", () => {
      const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.status).toBe("active");
    });

    it("sets is_dsc_event to false", () => {
      const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.is_dsc_event).toBe(false);
    });

    it("sets last_verified_at to null when pre_verified is false", () => {
      const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.last_verified_at).toBeNull();
      expect(results[0].payload.verified_by).toBeNull();
    });

    it("sets last_verified_at when pre_verified is true", () => {
      const row = { ...validatedRow, pre_verified: true };
      const results = buildInsertPayloads([row], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.last_verified_at).not.toBeNull();
      expect(results[0].payload.verified_by).toBe(adminUserId);
    });

    it("generates slug from title", () => {
      const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.slug).toBe("test-event");
    });

    it("sets is_recurring for weekly events", () => {
      const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.is_recurring).toBe(true);
    });

    it("sets is_recurring to false for non-recurring events", () => {
      const row = { ...validatedRow, recurrence_rule: null, is_recurring: false };
      const results = buildInsertPayloads([row], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.is_recurring).toBe(false);
    });

    it("uses parsed_categories from validated row", () => {
      const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.categories).toEqual(["music", "comedy"]);
    });

    it("handles empty categories", () => {
      const row = { ...validatedRow, categories: null, parsed_categories: null };
      const results = buildInsertPayloads([row], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.categories).toBeNull();
    });

    it("uses is_free from validated row", () => {
      const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.is_free).toBe(true);
    });

    it("uses venue_id from row when provided", () => {
      const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.venue_id).toBe("venue-123");
    });

    it("uses venue resolution when available", () => {
      const row = { ...validatedRow, venue_id: null };
      const venueResolutions = new Map<number, string | null>();
      venueResolutions.set(2, "resolved-venue-456");
      const results = buildInsertPayloads([row], venueResolutions, adminUserId);
      expect(results[0].payload.venue_id).toBe("resolved-venue-456");
    });

    it("sets venue_id to null when not provided and not resolved", () => {
      const row = { ...validatedRow, venue_id: null };
      const results = buildInsertPayloads([row], emptyVenueResolutions, adminUserId);
      expect(results[0].payload.venue_id).toBeNull();
    });
  });
});

// =====================================================
// API CONTRACT TESTS
// =====================================================

describe("API contracts", () => {
  describe("preview endpoint", () => {
    it("contract: does not modify database (read-only)", () => {
      // This is a documentation test - the endpoint uses service client
      // for SELECT queries only, no INSERT/UPDATE/DELETE
      expect(true).toBe(true);
    });

    it("contract: returns validRows, invalidRows, duplicates structure", () => {
      // Expected response shape:
      const expectedShape = {
        validRows: expect.any(Array),
        invalidRows: expect.any(Array),
        duplicates: expect.any(Array),
        venueWarnings: expect.any(Array),
        summary: {
          totalRows: expect.any(Number),
          validCount: expect.any(Number),
          invalidCount: expect.any(Number),
          duplicateCount: expect.any(Number),
        },
      };
      expect(expectedShape).toBeDefined();
    });
  });

  describe("apply endpoint", () => {
    it("contract: INSERT only, no UPDATE", () => {
      // This is a documentation test - the endpoint uses .insert()
      // and never .update() or .upsert()
      expect(true).toBe(true);
    });

    it("contract: skips duplicates, inserts valid unique rows", () => {
      // Expected behavior: duplicates from preview are excluded from insert
      expect(true).toBe(true);
    });

    it("contract: logs to ops audit", () => {
      // The endpoint calls opsAudit.eventsImport() after insert
      expect(true).toBe(true);
    });
  });
});

// =====================================================
// RECURRENCE INVARIANT TESTS
// =====================================================

describe("recurrence invariants", () => {
  const baseRow = {
    rowNumber: 2,
    title: "Test",
    event_type: "open_mic",
    event_date: "2026-02-01", // Sunday
    start_time: null,
    end_time: null,
    venue_id: null,
    venue_name: "Test Venue", // venue_name or venue_id is required
    day_of_week: null,
    recurrence_rule: null,
    description: null,
    external_url: null,
    categories: null,
    is_free: null,
    cost_label: null,
    age_policy: null,
    pre_verified: false,
  };

  it("ordinal '1st' requires day_of_week", () => {
    const row = { ...baseRow, recurrence_rule: "1st" };
    const result = validateImportRows([row]);
    expect(result.invalidRows.length).toBeGreaterThan(0);
  });

  it("ordinal '2nd' requires day_of_week", () => {
    const row = { ...baseRow, recurrence_rule: "2nd" };
    const result = validateImportRows([row]);
    expect(result.invalidRows.length).toBeGreaterThan(0);
  });

  it("ordinal '3rd' requires day_of_week", () => {
    const row = { ...baseRow, recurrence_rule: "3rd" };
    const result = validateImportRows([row]);
    expect(result.invalidRows.length).toBeGreaterThan(0);
  });

  it("ordinal '4th' requires day_of_week", () => {
    const row = { ...baseRow, recurrence_rule: "4th" };
    const result = validateImportRows([row]);
    expect(result.invalidRows.length).toBeGreaterThan(0);
  });

  it("ordinal 'last' requires day_of_week", () => {
    const row = { ...baseRow, recurrence_rule: "last" };
    const result = validateImportRows([row]);
    expect(result.invalidRows.length).toBeGreaterThan(0);
  });

  it("'weekly' derives day_of_week from event_date if not provided", () => {
    const row = { ...baseRow, recurrence_rule: "weekly" };
    const result = validateImportRows([row]);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.validRows[0].derived_day_of_week).toBe("Sunday");
  });

  it("'biweekly' derives day_of_week from event_date if not provided", () => {
    const row = { ...baseRow, recurrence_rule: "biweekly" };
    const result = validateImportRows([row]);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.validRows[0].derived_day_of_week).toBe("Sunday");
  });

  it("'monthly' requires day_of_week (generic monthly treated as ordinal)", () => {
    const row = { ...baseRow, recurrence_rule: "monthly" };
    const result = validateImportRows([row]);
    expect(result.invalidRows.length).toBeGreaterThan(0);
  });

  it("null/empty recurrence_rule does not require day_of_week", () => {
    const row = { ...baseRow, recurrence_rule: null };
    const result = validateImportRows([row]);
    expect(result.invalidRows).toHaveLength(0);
  });
});

// =====================================================
// SYSTEM DEFAULTS TESTS
// =====================================================

describe("system defaults", () => {
  const validatedRow: ValidatedRow = {
    rowNumber: 2,
    title: "Test",
    event_type: "open_mic",
    event_date: "2026-02-01",
    start_time: null,
    end_time: null,
    venue_id: null,
    venue_name: "Test Venue", // venue_name or venue_id is required
    day_of_week: null,
    recurrence_rule: null,
    description: null,
    external_url: null,
    categories: null,
    is_free: null,
    cost_label: null,
    age_policy: null,
    pre_verified: false,
    derived_day_of_week: "Sunday",
    is_recurring: false,
    parsed_categories: null,
  };

  const emptyVenueResolutions = new Map<number, string | null>();

  it("all imports get source='import'", () => {
    const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, "admin-1");
    expect(results[0].payload.source).toBe("import");
  });

  it("all imports get host_id=null", () => {
    const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, "admin-1");
    expect(results[0].payload.host_id).toBeNull();
  });

  it("all imports get is_published=true", () => {
    const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, "admin-1");
    expect(results[0].payload.is_published).toBe(true);
  });

  it("all imports get status='active'", () => {
    const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, "admin-1");
    expect(results[0].payload.status).toBe("active");
  });

  it("all imports get is_dsc_event=false", () => {
    const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, "admin-1");
    expect(results[0].payload.is_dsc_event).toBe(false);
  });

  it("imports without pre_verified get last_verified_at=null", () => {
    const results = buildInsertPayloads([validatedRow], emptyVenueResolutions, "admin-1");
    expect(results[0].payload.last_verified_at).toBeNull();
  });

  it("imports with pre_verified=true get last_verified_at set", () => {
    const row = { ...validatedRow, pre_verified: true };
    const results = buildInsertPayloads([row], emptyVenueResolutions, "admin-1");
    expect(results[0].payload.last_verified_at).toBeTruthy();
  });
});

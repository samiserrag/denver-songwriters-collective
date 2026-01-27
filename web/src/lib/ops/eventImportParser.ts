/**
 * Event Import CSV Parser
 *
 * Parses CSV files for bulk event import (INSERT-only).
 * Uses 16-column schema defined in Phase 4.88.
 *
 * Does NOT support UPDATE - for updates use the existing eventCsvParser.ts
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportRow {
  rowNumber: number;
  title: string;
  event_type: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue_id: string | null;
  venue_name: string | null;
  day_of_week: string | null;
  recurrence_rule: string | null;
  description: string | null;
  external_url: string | null;
  categories: string | null;
  is_free: boolean | null;
  cost_label: string | null;
  age_policy: string | null;
  pre_verified: boolean;
}

export interface ImportParseResult {
  success: boolean;
  rows: ImportRow[];
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const IMPORT_CSV_HEADERS = [
  "title",
  "event_type",
  "event_date",
  "start_time",
  "end_time",
  "venue_id",
  "venue_name",
  "day_of_week",
  "recurrence_rule",
  "description",
  "external_url",
  "categories",
  "is_free",
  "cost_label",
  "age_policy",
  "pre_verified",
] as const;

export const MAX_IMPORT_ROWS = 500;

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a CSV string into import rows.
 */
export function parseImportCsv(csv: string): ImportParseResult {
  const errors: string[] = [];
  const rows: ImportRow[] = [];

  // Normalize line endings and split
  const lines = csv
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return { success: false, rows: [], errors: ["CSV is empty"] };
  }

  // Validate header
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine);

  if (headers.length !== IMPORT_CSV_HEADERS.length) {
    errors.push(
      `Invalid header count: expected ${IMPORT_CSV_HEADERS.length}, got ${headers.length}`
    );
    return { success: false, rows: [], errors };
  }

  for (let i = 0; i < IMPORT_CSV_HEADERS.length; i++) {
    if (headers[i].toLowerCase().trim() !== IMPORT_CSV_HEADERS[i].toLowerCase()) {
      errors.push(
        `Invalid header at column ${i + 1}: expected "${IMPORT_CSV_HEADERS[i]}", got "${headers[i].trim()}"`
      );
    }
  }

  if (errors.length > 0) {
    return { success: false, rows: [], errors };
  }

  // Check row limit (excluding header)
  const dataRowCount = lines.length - 1;
  if (dataRowCount > MAX_IMPORT_ROWS) {
    return {
      success: false,
      rows: [],
      errors: [
        `CSV exceeds maximum row limit: ${dataRowCount} rows provided, maximum is ${MAX_IMPORT_ROWS}. Please split into multiple files.`,
      ],
    };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const rowNumber = i + 1; // 1-indexed for user display
    const values = parseCsvLine(line);

    if (values.length !== IMPORT_CSV_HEADERS.length) {
      errors.push(
        `Row ${rowNumber}: expected ${IMPORT_CSV_HEADERS.length} columns, got ${values.length}`
      );
      continue;
    }

    // Check for embedded newlines (STOP-GATE: v1 doesn't support multi-line cells)
    for (let j = 0; j < values.length; j++) {
      if (values[j].includes("\n")) {
        errors.push(
          `Row ${rowNumber}, column "${IMPORT_CSV_HEADERS[j]}": Multi-line cell detected. ` +
            `v1 import does not support multi-line cells.`
        );
      }
    }

    const row: ImportRow = {
      rowNumber,
      title: values[0].trim(),
      event_type: values[1].trim().toLowerCase(),
      event_date: values[2].trim(),
      start_time: values[3].trim() || null,
      end_time: values[4].trim() || null,
      venue_id: values[5].trim() || null,
      venue_name: values[6].trim() || null,
      day_of_week: values[7].trim() || null,
      recurrence_rule: values[8].trim().toLowerCase() || null,
      description: values[9].trim() || null,
      external_url: values[10].trim() || null,
      categories: values[11].trim() || null,
      is_free: parseBoolean(values[12]),
      cost_label: values[13].trim() || null,
      age_policy: values[14].trim() || null,
      pre_verified: parseBoolean(values[15]) ?? false,
    };

    rows.push(row);
  }

  return {
    success: errors.length === 0,
    rows,
    errors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a template CSV string with headers and an example row.
 */
export function generateImportTemplate(): string {
  const header = IMPORT_CSV_HEADERS.join(",");
  const example = [
    '"Example Open Mic"',
    "open_mic",
    "2026-02-01",
    "19:00",
    "22:00",
    "",
    '"Example Venue"',
    "Sunday",
    "weekly",
    '"Weekly open mic night for all skill levels"',
    "",
    "music",
    "true",
    "",
    "all_ages",
    "false",
  ].join(",");

  return `${header}\n${example}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a single CSV line, handling quoted values with commas.
 * RFC 4180 compliant.
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted section
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  values.push(current);
  return values;
}

/**
 * Parses a boolean string value.
 */
function parseBoolean(value: string): boolean | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "true" || trimmed === "1" || trimmed === "yes") return true;
  if (trimmed === "false" || trimmed === "0" || trimmed === "no") return false;
  return null;
}

/**
 * Occurrence Override CSV Parser
 *
 * Parses and serializes occurrence override data for bulk operations.
 * Supports create-or-update via upsert on (event_id, date_key) composite key.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OverrideRow {
  event_id: string;
  date_key: string;
  status: string;
  override_start_time: string | null;
  override_notes: string | null;
  override_cover_image_url: string | null;
}

export interface DatabaseOverride {
  id: string;
  event_id: string;
  date_key: string;
  status: string;
  override_start_time: string | null;
  override_notes: string | null;
  override_cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ParseResult {
  success: boolean;
  rows: OverrideRow[];
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const OVERRIDE_CSV_HEADERS = [
  "event_id",
  "date_key",
  "status",
  "override_start_time",
  "override_notes",
  "override_cover_image_url",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a CSV string into override rows.
 */
export function parseOverrideCsv(csv: string): ParseResult {
  const errors: string[] = [];
  const rows: OverrideRow[] = [];

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

  if (headers.length !== OVERRIDE_CSV_HEADERS.length) {
    errors.push(
      `Invalid header count: expected ${OVERRIDE_CSV_HEADERS.length}, got ${headers.length}`
    );
    return { success: false, rows: [], errors };
  }

  for (let i = 0; i < OVERRIDE_CSV_HEADERS.length; i++) {
    if (headers[i].toLowerCase() !== OVERRIDE_CSV_HEADERS[i].toLowerCase()) {
      errors.push(
        `Invalid header at column ${i + 1}: expected "${OVERRIDE_CSV_HEADERS[i]}", got "${headers[i]}"`
      );
    }
  }

  if (errors.length > 0) {
    return { success: false, rows: [], errors };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = parseCsvLine(line);

    if (values.length !== OVERRIDE_CSV_HEADERS.length) {
      errors.push(
        `Row ${i + 1}: expected ${OVERRIDE_CSV_HEADERS.length} columns, got ${values.length}`
      );
      continue;
    }

    const row: OverrideRow = {
      event_id: values[0].trim(),
      date_key: values[1].trim(),
      status: values[2].trim(),
      override_start_time: values[3].trim() || null,
      override_notes: values[4].trim() || null,
      override_cover_image_url: values[5].trim() || null,
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
// Serializer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serializes database overrides to CSV string.
 */
export function serializeOverrideCsv(overrides: DatabaseOverride[]): string {
  const lines: string[] = [];

  // Header
  lines.push(OVERRIDE_CSV_HEADERS.join(","));

  // Data rows
  for (const override of overrides) {
    const values = [
      override.event_id,
      override.date_key,
      override.status,
      override.override_start_time ?? "",
      override.override_notes ?? "",
      override.override_cover_image_url ?? "",
    ];

    lines.push(values.map(escapeCsvValue).join(","));
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a single CSV line, handling quoted values with commas.
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
 * Escapes a value for CSV output.
 */
function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generates a composite key for an override row.
 * Used for matching rows during upsert.
 */
export function getOverrideCompositeKey(row: { event_id: string; date_key: string }): string {
  return `${row.event_id}:${row.date_key}`;
}

/**
 * Event CSV Parser
 *
 * Parses and serializes event data for bulk operations.
 * Update-only: requires existing event IDs.
 * Does NOT include verification timestamps (managed via UI buttons).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EventRow {
  id: string;
  title: string;
  event_type: string;
  status: string;
  is_recurring: boolean | null;
  event_date: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_id: string | null;
  is_published: boolean | null;
  notes: string | null;
}

export interface DatabaseEvent {
  id: string;
  title: string;
  event_type: string;
  status: string | null;
  is_recurring: boolean | null;
  event_date: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_id: string | null;
  is_published: boolean | null;
  host_notes: string | null;
}

export interface ParseResult {
  success: boolean;
  rows: EventRow[];
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_CSV_HEADERS = [
  "id",
  "title",
  "event_type",
  "status",
  "is_recurring",
  "event_date",
  "day_of_week",
  "start_time",
  "end_time",
  "venue_id",
  "is_published",
  "notes",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a CSV string into event rows.
 */
export function parseEventCsv(csv: string): ParseResult {
  const errors: string[] = [];
  const rows: EventRow[] = [];

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

  if (headers.length !== EVENT_CSV_HEADERS.length) {
    errors.push(
      `Invalid header count: expected ${EVENT_CSV_HEADERS.length}, got ${headers.length}`
    );
    return { success: false, rows: [], errors };
  }

  for (let i = 0; i < EVENT_CSV_HEADERS.length; i++) {
    if (headers[i].toLowerCase() !== EVENT_CSV_HEADERS[i].toLowerCase()) {
      errors.push(
        `Invalid header at column ${i + 1}: expected "${EVENT_CSV_HEADERS[i]}", got "${headers[i]}"`
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

    if (values.length !== EVENT_CSV_HEADERS.length) {
      errors.push(
        `Row ${i + 1}: expected ${EVENT_CSV_HEADERS.length} columns, got ${values.length}`
      );
      continue;
    }

    const row: EventRow = {
      id: values[0].trim(),
      title: values[1].trim(),
      event_type: values[2].trim(),
      status: values[3].trim(),
      is_recurring: parseBoolean(values[4]),
      event_date: values[5].trim() || null,
      day_of_week: values[6].trim() || null,
      start_time: values[7].trim() || null,
      end_time: values[8].trim() || null,
      venue_id: values[9].trim() || null,
      is_published: parseBoolean(values[10]),
      notes: values[11].trim() || null,
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
 * Serializes database events to CSV string.
 */
export function serializeEventCsv(events: DatabaseEvent[]): string {
  const lines: string[] = [];

  // Header
  lines.push(EVENT_CSV_HEADERS.join(","));

  // Data rows
  for (const event of events) {
    const values = [
      event.id,
      event.title,
      event.event_type,
      event.status ?? "",
      formatBoolean(event.is_recurring),
      event.event_date ?? "",
      event.day_of_week ?? "",
      event.start_time ?? "",
      event.end_time ?? "",
      event.venue_id ?? "",
      formatBoolean(event.is_published),
      event.host_notes ?? "",
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
 * Parses a boolean string value.
 */
function parseBoolean(value: string): boolean | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "true" || trimmed === "1") return true;
  if (trimmed === "false" || trimmed === "0") return false;
  return null;
}

/**
 * Formats a boolean for CSV output.
 */
function formatBoolean(value: boolean | null): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

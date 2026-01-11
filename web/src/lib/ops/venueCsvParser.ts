/**
 * Venue CSV Parser
 *
 * Ops Console v1: Simple CSV parse/serialize for venue bulk operations.
 *
 * IMPORTANT (Tightening Note #2):
 * v1 parser assumes no multi-line cells. If any cell contains newline
 * characters, parsing will STOP with an error recommending PapaParse.
 */

import { VenueRow } from "./venueValidation";

// ─────────────────────────────────────────────────────────────────────────────
// CSV Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical CSV header order for venues.
 * All exports use this order; imports must match exactly.
 */
export const VENUE_CSV_HEADERS = [
  "id",
  "name",
  "address",
  "city",
  "state",
  "zip",
  "website_url",
  "phone",
  "google_maps_url",
  "notes",
] as const;

export type VenueCsvHeader = (typeof VENUE_CSV_HEADERS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Parse Result Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VenueCsvParseResult {
  success: boolean;
  rows: Record<string, string>[];
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a CSV string into venue rows.
 *
 * Rules:
 * - First row must be header matching VENUE_CSV_HEADERS exactly
 * - Comma-delimited (no quoted fields in v1)
 * - STOP if any cell contains newline (multi-line not supported)
 */
export function parseVenueCsv(csvText: string): VenueCsvParseResult {
  const errors: string[] = [];
  const rows: Record<string, string>[] = [];

  // Normalize line endings
  const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split into lines
  const lines = normalized.split("\n").filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return { success: false, rows: [], errors: ["CSV is empty"] };
  }

  // Parse header row
  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim());

  // Validate headers match exactly
  if (headers.length !== VENUE_CSV_HEADERS.length) {
    errors.push(
      `Invalid header count: expected ${VENUE_CSV_HEADERS.length} columns, got ${headers.length}`
    );
    return { success: false, rows: [], errors };
  }

  for (let i = 0; i < VENUE_CSV_HEADERS.length; i++) {
    if (headers[i] !== VENUE_CSV_HEADERS[i]) {
      errors.push(
        `Invalid header at column ${i + 1}: expected "${VENUE_CSV_HEADERS[i]}", got "${headers[i]}"`
      );
    }
  }

  if (errors.length > 0) {
    return { success: false, rows: [], errors };
  }

  // Parse data rows
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const rowNumber = lineIndex + 1; // 1-indexed for user display

    // Check for newlines within cells (STOP-GATE per tightening note #2)
    // This would only happen if someone manually edited the CSV with quoted multi-line
    // Since we don't support quotes, this shouldn't occur, but check anyway
    const cells = line.split(",");

    if (cells.length !== VENUE_CSV_HEADERS.length) {
      errors.push(
        `Row ${rowNumber}: expected ${VENUE_CSV_HEADERS.length} columns, got ${cells.length}`
      );
      continue;
    }

    // Build row object
    const row: Record<string, string> = {};
    for (let i = 0; i < VENUE_CSV_HEADERS.length; i++) {
      const cellValue = cells[i];

      // STOP-GATE: Check for embedded newlines (would indicate quoted multi-line)
      if (cellValue.includes("\n")) {
        return {
          success: false,
          rows: [],
          errors: [
            `Row ${rowNumber}, column "${VENUE_CSV_HEADERS[i]}": Multi-line cell detected. ` +
              `STOP-GATE: v1 parser does not support multi-line cells. ` +
              `Recommend adding PapaParse library for proper CSV handling.`,
          ],
        };
      }

      row[VENUE_CSV_HEADERS[i]] = cellValue;
    }

    rows.push(row);
  }

  if (errors.length > 0) {
    return { success: false, rows: [], errors };
  }

  return { success: true, rows, errors: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Serialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escapes a CSV cell value.
 * If value contains comma, quote, or newline, wrap in quotes and escape quotes.
 */
function escapeCsvCell(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // If contains comma, quote, or newline, need to escape
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    // Replace quotes with double quotes and wrap in quotes
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Database venue type (what we get from Supabase).
 */
export interface DatabaseVenue {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  website_url?: string | null;
  phone?: string | null;
  google_maps_url?: string | null;
  notes?: string | null;
}

/**
 * Serializes venue records to CSV string.
 */
export function serializeVenueCsv(venues: DatabaseVenue[]): string {
  const lines: string[] = [];

  // Header row
  lines.push(VENUE_CSV_HEADERS.join(","));

  // Data rows
  for (const venue of venues) {
    const cells = VENUE_CSV_HEADERS.map((header) => {
      const value = venue[header as keyof DatabaseVenue];
      return escapeCsvCell(value);
    });
    lines.push(cells.join(","));
  }

  return lines.join("\n");
}

/**
 * Converts a VenueRow (from validation) to DatabaseVenue format.
 */
export function venueRowToDatabase(row: VenueRow): DatabaseVenue {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    website_url: row.website_url,
    phone: row.phone,
    google_maps_url: row.google_maps_url,
    notes: row.notes,
  };
}

/**
 * Event Validation
 *
 * Validates event rows from CSV import.
 * Returns errors (blocking) and warnings (informational).
 */

import { EventRow } from "./eventCsvParser";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RowValidationResult {
  rowIndex: number;
  row: EventRow;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BatchValidationResult {
  allValid: boolean;
  validRows: EventRow[];
  invalidRows: RowValidationResult[];
  warnings: RowValidationResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Event type enum values from database
// Note: jam_session is in TypeScript types but migration may not be applied
export const VALID_EVENT_TYPES = [
  "open_mic",
  "showcase",
  "song_circle",
  "workshop",
  "other",
  "gig",
  "meetup",
  "jam_session",
  "poetry",
  "irish",
  "blues",
  "bluegrass",
  "comedy",
] as const;

export const VALID_STATUSES = ["active", "draft", "cancelled"] as const;

export const VALID_DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// UUID v4 regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Date format YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Time format HH:MM:SS or HH:MM
const TIME_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

// ─────────────────────────────────────────────────────────────────────────────
// Single Row Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a single event row.
 */
export function validateEventRow(row: EventRow): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required: id
  if (!row.id || !row.id.trim()) {
    errors.push("Missing required field: id");
  } else if (!UUID_REGEX.test(row.id)) {
    errors.push(`Invalid UUID format for id: ${row.id}`);
  }

  // Required: title
  if (!row.title || !row.title.trim()) {
    errors.push("Missing required field: title");
  }

  // Required: event_type
  if (!row.event_type || !row.event_type.trim()) {
    errors.push("Missing required field: event_type");
  } else if (!VALID_EVENT_TYPES.includes(row.event_type as (typeof VALID_EVENT_TYPES)[number])) {
    // Warn instead of error for unknown event types (forward compatibility)
    warnings.push(`Unknown event_type: ${row.event_type}`);
  }

  // Required: status
  if (!row.status || !row.status.trim()) {
    errors.push("Missing required field: status");
  } else if (!VALID_STATUSES.includes(row.status as (typeof VALID_STATUSES)[number])) {
    errors.push(`Invalid status: ${row.status}. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  // Optional: event_date (must be valid format if provided)
  if (row.event_date && !DATE_REGEX.test(row.event_date)) {
    errors.push(`Invalid event_date format: ${row.event_date}. Expected YYYY-MM-DD`);
  }

  // Optional: day_of_week (must be valid if provided)
  if (row.day_of_week && !VALID_DAYS_OF_WEEK.includes(row.day_of_week as (typeof VALID_DAYS_OF_WEEK)[number])) {
    errors.push(`Invalid day_of_week: ${row.day_of_week}. Must be one of: ${VALID_DAYS_OF_WEEK.join(", ")}`);
  }

  // Optional: start_time (must be valid format if provided)
  if (row.start_time && !TIME_REGEX.test(row.start_time)) {
    errors.push(`Invalid start_time format: ${row.start_time}. Expected HH:MM or HH:MM:SS`);
  }

  // Optional: end_time (must be valid format if provided)
  if (row.end_time && !TIME_REGEX.test(row.end_time)) {
    errors.push(`Invalid end_time format: ${row.end_time}. Expected HH:MM or HH:MM:SS`);
  }

  // Optional: venue_id (must be valid UUID if provided)
  if (row.venue_id && !UUID_REGEX.test(row.venue_id)) {
    errors.push(`Invalid UUID format for venue_id: ${row.venue_id}`);
  }

  // Warnings for missing recommended fields
  if (!row.start_time) {
    warnings.push("Missing start_time");
  }

  if (!row.venue_id) {
    warnings.push("Missing venue_id");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates multiple event rows.
 * Returns valid rows normalized and invalid rows with errors.
 */
export function validateEventRows(rows: EventRow[]): BatchValidationResult {
  const validRows: EventRow[] = [];
  const invalidRows: RowValidationResult[] = [];
  const warnings: RowValidationResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const result = validateEventRow(row);

    if (result.valid) {
      validRows.push(normalizeEventRow(row));

      if (result.warnings.length > 0) {
        warnings.push({
          rowIndex: i + 1, // 1-indexed for user display
          row,
          valid: true,
          errors: [],
          warnings: result.warnings,
        });
      }
    } else {
      invalidRows.push({
        rowIndex: i + 1, // 1-indexed for user display
        row,
        valid: false,
        errors: result.errors,
        warnings: result.warnings,
      });
    }
  }

  return {
    allValid: invalidRows.length === 0,
    validRows,
    invalidRows,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes an event row (trims whitespace, converts empty to null).
 */
export function normalizeEventRow(row: EventRow): EventRow {
  return {
    id: row.id.trim(),
    title: row.title.trim(),
    event_type: row.event_type.trim(),
    status: row.status.trim(),
    is_recurring: row.is_recurring,
    event_date: normalizeString(row.event_date),
    day_of_week: normalizeString(row.day_of_week),
    start_time: normalizeString(row.start_time),
    end_time: normalizeString(row.end_time),
    venue_id: normalizeString(row.venue_id),
    is_published: row.is_published,
    notes: normalizeString(row.notes),
  };
}

/**
 * Normalizes a string value (trims, converts empty/whitespace to null).
 */
function normalizeString(value: string | null): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

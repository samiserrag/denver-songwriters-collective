/**
 * Override Validation
 *
 * Validates occurrence override rows from CSV import.
 * Returns errors (blocking) and warnings (informational).
 */

import { OverrideRow } from "./overrideCsvParser";

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
  row: OverrideRow;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BatchValidationResult {
  allValid: boolean;
  validRows: OverrideRow[];
  invalidRows: RowValidationResult[];
  warnings: RowValidationResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const VALID_OVERRIDE_STATUSES = ["normal", "cancelled"] as const;

// UUID v4 regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Date format YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Time format HH:MM:SS or HH:MM
const TIME_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;

// URL format (http or https)
const URL_REGEX = /^https?:\/\/.+/i;

// ─────────────────────────────────────────────────────────────────────────────
// Single Row Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a single override row.
 */
export function validateOverrideRow(row: OverrideRow): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required: event_id
  if (!row.event_id || !row.event_id.trim()) {
    errors.push("Missing required field: event_id");
  } else if (!UUID_REGEX.test(row.event_id)) {
    errors.push(`Invalid UUID format for event_id: ${row.event_id}`);
  }

  // Required: date_key
  if (!row.date_key || !row.date_key.trim()) {
    errors.push("Missing required field: date_key");
  } else if (!DATE_REGEX.test(row.date_key)) {
    errors.push(`Invalid date_key format: ${row.date_key}. Expected YYYY-MM-DD`);
  }

  // Required: status
  if (!row.status || !row.status.trim()) {
    errors.push("Missing required field: status");
  } else if (!VALID_OVERRIDE_STATUSES.includes(row.status as (typeof VALID_OVERRIDE_STATUSES)[number])) {
    errors.push(
      `Invalid status: ${row.status}. Must be one of: ${VALID_OVERRIDE_STATUSES.join(", ")}`
    );
  }

  // Optional: override_start_time (must be valid format if provided)
  if (row.override_start_time && !TIME_REGEX.test(row.override_start_time)) {
    errors.push(
      `Invalid override_start_time format: ${row.override_start_time}. Expected HH:MM or HH:MM:SS`
    );
  }

  // Optional: override_cover_image_url (must be valid URL if provided)
  if (row.override_cover_image_url && !URL_REGEX.test(row.override_cover_image_url)) {
    errors.push(
      `Invalid override_cover_image_url: ${row.override_cover_image_url}. Must be http or https URL`
    );
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
 * Validates multiple override rows.
 * Returns valid rows normalized and invalid rows with errors.
 */
export function validateOverrideRows(rows: OverrideRow[]): BatchValidationResult {
  const validRows: OverrideRow[] = [];
  const invalidRows: RowValidationResult[] = [];
  const warnings: RowValidationResult[] = [];

  // Track duplicate composite keys
  const seenKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const result = validateOverrideRow(row);

    // Check for duplicates within CSV
    const compositeKey = `${row.event_id}:${row.date_key}`;
    if (seenKeys.has(compositeKey)) {
      result.errors.push(
        `Duplicate (event_id, date_key) pair: ${compositeKey}. Each combination must be unique.`
      );
      result.valid = false;
    } else {
      seenKeys.add(compositeKey);
    }

    if (result.valid) {
      validRows.push(normalizeOverrideRow(row));

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
 * Normalizes an override row (trims whitespace, converts empty to null).
 */
export function normalizeOverrideRow(row: OverrideRow): OverrideRow {
  return {
    event_id: row.event_id.trim(),
    date_key: row.date_key.trim(),
    status: row.status.trim(),
    override_start_time: normalizeString(row.override_start_time),
    override_notes: normalizeString(row.override_notes),
    override_cover_image_url: normalizeString(row.override_cover_image_url),
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

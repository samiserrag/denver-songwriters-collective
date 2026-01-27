/**
 * Event Import Validation
 *
 * Validates import rows against business rules:
 * - Required fields (title, event_type, event_date)
 * - Event type enum
 * - Recurrence invariants (ordinal monthly requires day_of_week)
 * - Day of week derivation for weekly/biweekly
 */

import { ImportRow } from "./eventImportParser";
import {
  isOrdinalMonthlyRule,
  canonicalizeDayOfWeek,
  deriveDayOfWeekFromDate,
} from "@/lib/events/recurrenceCanonicalization";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidatedRow extends ImportRow {
  // Derived fields
  derived_day_of_week: string | null;
  is_recurring: boolean;
  // Parsed categories
  parsed_categories: string[] | null;
}

export interface ValidationError {
  row: number;
  errors: string[];
}

export interface ValidationResult {
  validRows: ValidatedRow[];
  invalidRows: ValidationError[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const VALID_EVENT_TYPES = new Set([
  "song_circle",
  "workshop",
  "meetup",
  "showcase",
  "open_mic",
  "gig",
  "kindred_group",
  "jam_session",
  "other",
]);

export const VALID_DAY_NAMES = new Set([
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

const WEEKLY_RULES = new Set(["weekly", "biweekly"]);

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates all import rows.
 * Returns arrays of valid rows (with derived fields) and invalid rows (with errors).
 */
export function validateImportRows(rows: ImportRow[]): ValidationResult {
  const validRows: ValidatedRow[] = [];
  const invalidRows: ValidationError[] = [];

  for (const row of rows) {
    const errors = validateRow(row);

    if (errors.length === 0) {
      // Derive additional fields for valid rows
      const derivedDayOfWeek = deriveDayOfWeekForRow(row);
      const isRecurring = row.recurrence_rule !== null;
      const parsedCategories = parseCategories(row.categories);

      validRows.push({
        ...row,
        derived_day_of_week: derivedDayOfWeek,
        is_recurring: isRecurring,
        parsed_categories: parsedCategories,
      });
    } else {
      invalidRows.push({
        row: row.rowNumber,
        errors,
      });
    }
  }

  return { validRows, invalidRows };
}

/**
 * Validates a single row and returns an array of error messages.
 */
function validateRow(row: ImportRow): string[] {
  const errors: string[] = [];

  // Required fields
  if (!row.title) {
    errors.push("Missing required field: title");
  }

  if (!row.event_type) {
    errors.push("Missing required field: event_type");
  } else if (!VALID_EVENT_TYPES.has(row.event_type)) {
    errors.push(
      `Invalid event_type: "${row.event_type}". Valid types: ${Array.from(VALID_EVENT_TYPES).join(", ")}`
    );
  }

  if (!row.event_date) {
    errors.push("Missing required field: event_date");
  } else if (!isValidDateFormat(row.event_date)) {
    errors.push(
      `Invalid event_date format: "${row.event_date}". Expected YYYY-MM-DD`
    );
  }

  // Time format validation (optional fields)
  if (row.start_time && !isValidTimeFormat(row.start_time)) {
    errors.push(
      `Invalid start_time format: "${row.start_time}". Expected HH:MM (24-hour)`
    );
  }

  if (row.end_time && !isValidTimeFormat(row.end_time)) {
    errors.push(
      `Invalid end_time format: "${row.end_time}". Expected HH:MM (24-hour)`
    );
  }

  // Day of week validation (if provided)
  if (row.day_of_week && !VALID_DAY_NAMES.has(row.day_of_week.toLowerCase())) {
    errors.push(
      `Invalid day_of_week: "${row.day_of_week}". Valid days: ${Array.from(VALID_DAY_NAMES).join(", ")}`
    );
  }

  // Recurrence validation
  if (row.recurrence_rule) {
    const recurrenceErrors = validateRecurrence(row);
    errors.push(...recurrenceErrors);
  }

  // UUID format for venue_id (if provided)
  if (row.venue_id && !isValidUuid(row.venue_id)) {
    errors.push(
      `Invalid venue_id format: "${row.venue_id}". Expected UUID format`
    );
  }

  // URL format for external_url (if provided)
  if (row.external_url && !isValidUrl(row.external_url)) {
    errors.push(
      `Invalid external_url format: "${row.external_url}". Expected valid URL`
    );
  }

  return errors;
}

/**
 * Validates recurrence rules and returns errors.
 */
function validateRecurrence(row: ImportRow): string[] {
  const errors: string[] = [];
  const rule = row.recurrence_rule!.toLowerCase();

  // Check if ordinal monthly rule requires day_of_week
  if (isOrdinalMonthlyRule(rule)) {
    if (!row.day_of_week) {
      errors.push(
        `Ordinal monthly recurrence "${rule}" requires day_of_week. ` +
          `Specify which day of the week this event occurs on.`
      );
    }
  }

  // Weekly/biweekly can derive day_of_week from event_date
  // No error needed - we'll derive it in the builder

  return errors;
}

/**
 * Derives day_of_week for a row using canonicalization.
 */
function deriveDayOfWeekForRow(row: ImportRow): string | null {
  // If already provided, normalize to Title Case
  if (row.day_of_week) {
    return normalizeDayName(row.day_of_week);
  }

  // For weekly/biweekly, derive from event_date directly
  // (canonicalizeDayOfWeek only handles ordinal monthly rules)
  if (row.recurrence_rule && WEEKLY_RULES.has(row.recurrence_rule.toLowerCase())) {
    return deriveDayOfWeekFromDate(row.event_date);
  }

  // For ordinal monthly rules, use canonicalization
  if (row.recurrence_rule && isOrdinalMonthlyRule(row.recurrence_rule)) {
    return canonicalizeDayOfWeek(row.recurrence_rule, null, row.event_date);
  }

  // For one-time events or custom rules, derive from event_date for consistency
  if (row.event_date) {
    return deriveDayOfWeekFromDate(row.event_date);
  }

  return null;
}

/**
 * Parses pipe-delimited categories string into array.
 */
function parseCategories(categories: string | null): string[] | null {
  if (!categories) return null;

  const parsed = categories
    .split("|")
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);

  return parsed.length > 0 ? parsed : null;
}

/**
 * Normalizes day name to Title Case.
 */
function normalizeDayName(day: string): string {
  const lower = day.toLowerCase().trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Format Validators
// ─────────────────────────────────────────────────────────────────────────────

function isValidDateFormat(date: string): boolean {
  // YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  // Validate actual date
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(date + "T12:00:00Z");

  return (
    !isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

function isValidTimeFormat(time: string): boolean {
  // HH:MM format (24-hour)
  if (!/^\d{2}:\d{2}$/.test(time)) return false;

  const [hours, minutes] = time.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function isValidUuid(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    uuid
  );
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

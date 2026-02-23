/**
 * Event Import Builder
 *
 * Builds INSERT payloads for validated, non-duplicate import rows.
 * Enforces system-managed defaults:
 * - source = 'import'
 * - host_id = null
 * - is_published = true
 * - status = 'active'
 * - last_verified_at = null (unless pre_verified = true)
 */

import { ValidatedRow } from "./eventImportValidation";
import { generateSlug } from "./eventImportDedupe";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EventInsertPayload {
  // System-generated
  slug: string;
  source: string;
  host_id: string | null;
  is_published: boolean;
  status: string;
  is_dsc_event: boolean;

  // From CSV
  title: string;
  event_type: string[];
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue_id: string | null;
  day_of_week: string | null;
  recurrence_rule: string | null;
  is_recurring: boolean;
  description: string | null;
  external_url: string | null;
  categories: string[] | null;
  is_free: boolean | null;
  cost_label: string | null;
  age_policy: string | null;

  // Verification (based on pre_verified)
  last_verified_at: string | null;
  verified_by: string | null;
}

export interface InsertResult {
  rowNumber: number;
  payload: EventInsertPayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds insert payloads for a list of validated rows.
 *
 * @param rows - Validated, non-duplicate rows
 * @param venueResolutions - Map of rowNumber to resolved venue_id
 * @param adminUserId - Admin user ID for verified_by when pre_verified
 */
export function buildInsertPayloads(
  rows: ValidatedRow[],
  venueResolutions: Map<number, string | null>,
  adminUserId: string
): InsertResult[] {
  const now = new Date().toISOString();

  return rows.map((row) => {
    // Use resolved venue_id if available, otherwise use original
    const finalVenueId =
      venueResolutions.get(row.rowNumber) ?? row.venue_id ?? null;

    // Normalize event_type to match DB enum
    const eventType = normalizeEventType(row.event_type);

    // Normalize recurrence_rule
    const recurrenceRule = normalizeRecurrenceRule(row.recurrence_rule);

    const payload: EventInsertPayload = {
      // System-enforced defaults
      slug: generateSlug(row.title),
      source: "import",
      host_id: null,
      is_published: true,
      status: "active",
      is_dsc_event: false,

      // From CSV
      title: row.title,
      event_type: [eventType],
      event_date: row.event_date,
      start_time: row.start_time,
      end_time: row.end_time,
      venue_id: finalVenueId,
      day_of_week: row.derived_day_of_week,
      recurrence_rule: recurrenceRule,
      is_recurring: row.is_recurring,
      description: row.description,
      external_url: row.external_url,
      categories: row.parsed_categories,
      is_free: row.is_free,
      cost_label: row.cost_label,
      age_policy: row.age_policy,

      // Verification
      last_verified_at: row.pre_verified ? now : null,
      verified_by: row.pre_verified ? adminUserId : null,
    };

    return {
      rowNumber: row.rowNumber,
      payload,
    };
  });
}

/**
 * Normalizes event type to match DB enum.
 */
function normalizeEventType(eventType: string): string {
  // Already validated, just ensure lowercase
  return eventType.toLowerCase();
}

/**
 * Normalizes recurrence rule.
 * Handles various formats and returns standardized value.
 */
function normalizeRecurrenceRule(rule: string | null): string | null {
  if (!rule) return null;

  const normalized = rule.toLowerCase().trim();

  // Map common variations
  const mapping: Record<string, string> = {
    "1st": "1st",
    "2nd": "2nd",
    "3rd": "3rd",
    "4th": "4th",
    "5th": "5th",
    last: "last",
    "1st/3rd": "1st/3rd",
    "2nd/4th": "2nd/4th",
    "1st and 3rd": "1st/3rd",
    "2nd and 4th": "2nd/4th",
    "first": "1st",
    "second": "2nd",
    "third": "3rd",
    "fourth": "4th",
    "fifth": "5th",
    weekly: "weekly",
    biweekly: "biweekly",
    monthly: "monthly",
  };

  return mapping[normalized] || normalized;
}

/**
 * Filters rows to exclude duplicates.
 */
export function filterNonDuplicates(
  rows: ValidatedRow[],
  duplicateRowNumbers: Set<number>
): ValidatedRow[] {
  return rows.filter((row) => !duplicateRowNumbers.has(row.rowNumber));
}

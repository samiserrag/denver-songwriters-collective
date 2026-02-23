/**
 * Event Diff
 *
 * Computes differences between current database state and incoming CSV data.
 * Used for preview before applying changes.
 */

import { EventRow } from "./eventCsvParser";
import { DatabaseEvent } from "./eventCsvParser";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldChange {
  field: string;
  oldValue: string | string[] | boolean | null;
  newValue: string | string[] | boolean | null;
}

export interface EventDiff {
  id: string;
  title: string;
  changes: FieldChange[];
}

export interface DiffResult {
  updates: EventDiff[];
  notFound: string[];
  unchanged: number;
}

export interface UpdatePayload {
  id: string;
  updates: Record<string, string | string[] | boolean | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Fields that can be compared (excludes id which is the key)
const COMPARABLE_FIELDS = [
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
// Comparison Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes a value for comparison.
 * - null, undefined, and empty string are treated as equivalent
 * - Trims whitespace from strings
 */
function normalizeForComparison(value: string | string[] | boolean | null | undefined): string | string[] | boolean | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return [...value].sort();
  if (typeof value === "boolean") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Compares two values for equality after normalization.
 */
function valuesEqual(
  a: string | string[] | boolean | null | undefined,
  b: string | string[] | boolean | null | undefined
): boolean {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);
  if (Array.isArray(normA) && Array.isArray(normB)) {
    return JSON.stringify(normA) === JSON.stringify(normB);
  }
  // Handle array vs string comparison (e.g., DB event_type string[] vs CSV string)
  if (Array.isArray(normA) && typeof normB === "string") {
    return normA.length === 1 && normA[0] === normB;
  }
  if (typeof normA === "string" && Array.isArray(normB)) {
    return normB.length === 1 && normB[0] === normA;
  }
  return normA === normB;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the diff between current database events and incoming CSV rows.
 */
export function computeEventDiff(
  current: DatabaseEvent[],
  incoming: EventRow[]
): DiffResult {
  const updates: EventDiff[] = [];
  const notFound: string[] = [];
  let unchanged = 0;

  // Build lookup map for current events
  const currentMap = new Map<string, DatabaseEvent>();
  for (const event of current) {
    currentMap.set(event.id, event);
  }

  // Compare each incoming row
  for (const row of incoming) {
    const existing = currentMap.get(row.id);

    if (!existing) {
      notFound.push(row.id);
      continue;
    }

    const changes: FieldChange[] = [];

    // Compare each field
    for (const field of COMPARABLE_FIELDS) {
      const oldValue = getFieldValue(existing, field);
      const newValue = getFieldValue(row, field);

      if (!valuesEqual(oldValue, newValue)) {
        changes.push({
          field,
          oldValue: normalizeForComparison(oldValue),
          newValue: normalizeForComparison(newValue),
        });
      }
    }

    if (changes.length > 0) {
      updates.push({
        id: row.id,
        title: existing.title,
        changes,
      });
    } else {
      unchanged++;
    }
  }

  return {
    updates,
    notFound,
    unchanged,
  };
}

/**
 * Gets the value of a field from a database event or CSV row.
 * Handles the mapping of "notes" (CSV) to "host_notes" (DB).
 */
function getFieldValue(
  eventOrRow: DatabaseEvent | EventRow,
  field: (typeof COMPARABLE_FIELDS)[number]
): string | string[] | boolean | null {
  // Check if this is a DatabaseEvent (has host_notes) or EventRow (has notes)
  if ("host_notes" in eventOrRow) {
    const event = eventOrRow as DatabaseEvent;
    switch (field) {
      case "title":
        return event.title;
      case "event_type":
        return event.event_type;
      case "status":
        return event.status;
      case "is_recurring":
        return event.is_recurring;
      case "event_date":
        return event.event_date;
      case "day_of_week":
        return event.day_of_week;
      case "start_time":
        return event.start_time;
      case "end_time":
        return event.end_time;
      case "venue_id":
        return event.venue_id;
      case "is_published":
        return event.is_published;
      case "notes":
        return event.host_notes; // Note: DB field is host_notes, CSV field is notes
      default:
        return null;
    }
  } else {
    const row = eventOrRow as EventRow;
    switch (field) {
      case "title":
        return row.title;
      case "event_type":
        return row.event_type;
      case "status":
        return row.status;
      case "is_recurring":
        return row.is_recurring;
      case "event_date":
        return row.event_date;
      case "day_of_week":
        return row.day_of_week;
      case "start_time":
        return row.start_time;
      case "end_time":
        return row.end_time;
      case "venue_id":
        return row.venue_id;
      case "is_published":
        return row.is_published;
      case "notes":
        return row.notes;
      default:
        return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update Payload Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds update payloads from diffs for database operations.
 */
export function buildEventUpdatePayloads(diffs: EventDiff[]): UpdatePayload[] {
  return diffs.map((diff) => {
    const updates: Record<string, string | string[] | boolean | null> = {};

    for (const change of diff.changes) {
      // Map CSV field names to database field names
      const dbField = change.field === "notes" ? "host_notes" : change.field;
      if (dbField === "event_type") {
        updates[dbField] = Array.isArray(change.newValue)
          ? [...new Set(change.newValue)]
          : change.newValue
            ? [...new Set((change.newValue as string).split("|").map(t => t.trim()).filter(Boolean))]
            : null;
      } else {
        updates[dbField] = change.newValue;
      }
    }

    return {
      id: diff.id,
      updates,
    };
  });
}

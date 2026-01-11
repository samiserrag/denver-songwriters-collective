/**
 * Override Diff
 *
 * Computes differences between current database state and incoming CSV data.
 * Supports upsert: identifies updates to existing overrides and new inserts.
 */

import { OverrideRow, DatabaseOverride, getOverrideCompositeKey } from "./overrideCsvParser";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface OverrideUpdate {
  id: string; // existing override ID
  event_id: string;
  date_key: string;
  changes: FieldChange[];
}

export interface OverrideInsert {
  event_id: string;
  date_key: string;
  status: string;
  override_start_time: string | null;
  override_notes: string | null;
  override_cover_image_url: string | null;
}

export interface DiffResult {
  updates: OverrideUpdate[];
  inserts: OverrideInsert[];
  eventIdsNotFound: string[];
  unchanged: number;
}

export interface UpdatePayload {
  id: string;
  updates: Record<string, string | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Fields that can be compared (excludes composite key fields)
const COMPARABLE_FIELDS = [
  "status",
  "override_start_time",
  "override_notes",
  "override_cover_image_url",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Comparison Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes a value for comparison.
 * - null, undefined, and empty string are treated as equivalent
 * - Trims whitespace from strings
 */
function normalizeForComparison(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Compares two values for equality after normalization.
 */
function valuesEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);
  return normA === normB;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the diff between current database overrides and incoming CSV rows.
 * Also validates that event_ids exist in the events table.
 *
 * @param current - Existing overrides from database
 * @param incoming - Rows from CSV import
 * @param validEventIds - Set of event IDs that exist in the events table
 */
export function computeOverrideDiff(
  current: DatabaseOverride[],
  incoming: OverrideRow[],
  validEventIds: Set<string>
): DiffResult {
  const updates: OverrideUpdate[] = [];
  const inserts: OverrideInsert[] = [];
  const eventIdsNotFound: string[] = [];
  let unchanged = 0;

  // Build lookup map for current overrides by composite key
  const currentMap = new Map<string, DatabaseOverride>();
  for (const override of current) {
    const key = getOverrideCompositeKey(override);
    currentMap.set(key, override);
  }

  // Compare each incoming row
  for (const row of incoming) {
    // Validate event_id exists
    if (!validEventIds.has(row.event_id)) {
      if (!eventIdsNotFound.includes(row.event_id)) {
        eventIdsNotFound.push(row.event_id);
      }
      continue;
    }

    const key = getOverrideCompositeKey(row);
    const existing = currentMap.get(key);

    if (!existing) {
      // New override to insert
      inserts.push({
        event_id: row.event_id,
        date_key: row.date_key,
        status: row.status,
        override_start_time: row.override_start_time,
        override_notes: row.override_notes,
        override_cover_image_url: row.override_cover_image_url,
      });
      continue;
    }

    // Check for changes
    const changes: FieldChange[] = [];

    for (const field of COMPARABLE_FIELDS) {
      const oldValue = existing[field];
      const newValue = row[field];

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
        id: existing.id,
        event_id: row.event_id,
        date_key: row.date_key,
        changes,
      });
    } else {
      unchanged++;
    }
  }

  return {
    updates,
    inserts,
    eventIdsNotFound,
    unchanged,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Update Payload Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds update payloads from diffs for database operations.
 */
export function buildOverrideUpdatePayloads(diffs: OverrideUpdate[]): UpdatePayload[] {
  return diffs.map((diff) => {
    const updates: Record<string, string | null> = {};

    for (const change of diff.changes) {
      updates[change.field] = change.newValue;
    }

    return {
      id: diff.id,
      updates,
    };
  });
}

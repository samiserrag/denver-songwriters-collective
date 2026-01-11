/**
 * Venue Diff Computation
 *
 * Ops Console v1: Computes differences between current DB state and incoming CSV.
 * Update-only mode - IDs not found in DB are reported but not created.
 */

import { VenueRow } from "./venueValidation";
import { DatabaseVenue } from "./venueCsvParser";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface VenueDiff {
  id: string;
  name: string; // For display purposes
  changes: FieldChange[];
}

export interface VenueDiffResult {
  updates: VenueDiff[];
  notFound: string[]; // IDs in CSV but not in DB
  unchanged: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff Fields
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fields to compare for diff.
 * Excludes: id (key), created_at, updated_at, neighborhood, contact_link,
 * accessibility_notes, parking_notes (not in CSV schema v1)
 */
const DIFF_FIELDS = [
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

// ─────────────────────────────────────────────────────────────────────────────
// Comparison Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes a value for comparison.
 * - null, undefined, and empty string are treated as equivalent
 * - Trims whitespace
 */
function normalizeForComparison(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Compares two values for equality (with null/empty normalization).
 */
function valuesAreEqual(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);

  // Both null = equal
  if (normA === null && normB === null) return true;

  // One null, one not = not equal
  if (normA === null || normB === null) return false;

  // Both non-null = string compare
  return normA === normB;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Diff Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the diff between current DB venues and incoming CSV rows.
 *
 * Returns:
 * - updates: Venues with at least one changed field
 * - notFound: IDs in CSV but not in DB (v1 = update-only, no creates)
 * - unchanged: Count of venues with no changes
 */
export function computeVenueDiff(
  currentVenues: DatabaseVenue[],
  incomingRows: VenueRow[]
): VenueDiffResult {
  const updates: VenueDiff[] = [];
  const notFound: string[] = [];
  let unchanged = 0;

  // Build lookup map for current venues
  const currentMap = new Map<string, DatabaseVenue>();
  for (const venue of currentVenues) {
    currentMap.set(venue.id, venue);
  }

  // Compare each incoming row
  for (const incoming of incomingRows) {
    const current = currentMap.get(incoming.id);

    if (!current) {
      // ID not found in DB
      notFound.push(incoming.id);
      continue;
    }

    // Compare fields
    const changes: FieldChange[] = [];

    for (const field of DIFF_FIELDS) {
      const oldValue = current[field as keyof DatabaseVenue] as
        | string
        | null
        | undefined;
      const newValue = incoming[field as keyof VenueRow] as
        | string
        | null
        | undefined;

      if (!valuesAreEqual(oldValue, newValue)) {
        changes.push({
          field,
          oldValue: normalizeForComparison(oldValue),
          newValue: normalizeForComparison(newValue),
        });
      }
    }

    if (changes.length > 0) {
      updates.push({
        id: incoming.id,
        name: incoming.name || current.name, // Use incoming name for display
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
 * Builds update payloads for Supabase from diff results.
 * Only includes changed fields (not the full row).
 */
export function buildUpdatePayloads(
  diffs: VenueDiff[]
): { id: string; updates: Record<string, string | null> }[] {
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

/**
 * Event Import Deduplication
 *
 * Detects duplicates before insert using:
 * 1. Slug collision (generated slug already exists)
 * 2. Title + event_date + venue_id match (case-insensitive title)
 *
 * Also handles venue resolution from venue_name.
 */

import { ValidatedRow } from "./eventImportValidation";
import { SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DedupeResult {
  row: number;
  reason: "slug_collision" | "title_date_venue_match";
  matched_id: string;
  matched_slug?: string;
  matched_title?: string;
}

export interface VenueWarning {
  row: number;
  warning: string;
}

export interface VenueResolution {
  row: number;
  resolved_venue_id: string | null;
}

export interface DedupeCheckResult {
  duplicates: DedupeResult[];
  venueWarnings: VenueWarning[];
  venueResolutions: Map<number, string | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a slug from title (matches DB trigger behavior).
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Spaces to hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Trim hyphens
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication Check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks for duplicates and resolves venue names.
 * Does NOT modify the database.
 */
export async function checkDuplicates(
  rows: ValidatedRow[],
  supabase: SupabaseClient
): Promise<DedupeCheckResult> {
  const duplicates: DedupeResult[] = [];
  const venueWarnings: VenueWarning[] = [];
  const venueResolutions = new Map<number, string | null>();

  // Collect all slugs and titles for batch lookup
  const slugsToCheck = rows.map((r) => generateSlug(r.title));
  const titlesToCheck = rows.map((r) => r.title.toLowerCase().trim());

  // Batch fetch existing events by slug
  const { data: existingBySlug } = await supabase
    .from("events")
    .select("id, slug, title")
    .in("slug", slugsToCheck);

  const slugMap = new Map<string, { id: string; slug: string; title: string }>();
  for (const e of existingBySlug || []) {
    if (e.slug) {
      slugMap.set(e.slug, { id: e.id, slug: e.slug, title: e.title });
    }
  }

  // Batch fetch existing events by title (for title+date+venue check)
  const { data: existingByTitle } = await supabase
    .from("events")
    .select("id, title, event_date, venue_id")
    .in(
      "title",
      titlesToCheck.map((t) => t) // Note: ilike would be better but batch query uses in()
    );

  // Build lookup for title+date+venue
  const titleDateVenueMap = new Map<string, { id: string; title: string }>();
  for (const e of existingByTitle || []) {
    const key = `${e.title?.toLowerCase()}|${e.event_date}|${e.venue_id || "null"}`;
    titleDateVenueMap.set(key, { id: e.id, title: e.title });
  }

  // Resolve venue names to IDs
  const venueNamesToResolve = rows
    .filter((r) => !r.venue_id && r.venue_name)
    .map((r) => r.venue_name!.toLowerCase().trim());

  const venueNameMap = new Map<string, { id: string; count: number }>();
  if (venueNamesToResolve.length > 0) {
    const { data: venues } = await supabase
      .from("venues")
      .select("id, name")
      .in(
        "name",
        venueNamesToResolve.map((n) => n) // Note: exact match
      );

    // Build map with count for ambiguity detection
    const nameCountMap = new Map<string, string[]>();
    for (const v of venues || []) {
      const lowerName = v.name?.toLowerCase().trim();
      if (lowerName) {
        if (!nameCountMap.has(lowerName)) {
          nameCountMap.set(lowerName, []);
        }
        nameCountMap.get(lowerName)!.push(v.id);
      }
    }

    for (const [name, ids] of nameCountMap) {
      venueNameMap.set(name, { id: ids[0], count: ids.length });
    }
  }

  // Track slugs within this batch to detect intra-batch collisions
  const batchSlugs = new Set<string>();

  // Check each row
  for (const row of rows) {
    const slug = generateSlug(row.title);

    // Check 1: Slug collision with existing DB
    const existingSlug = slugMap.get(slug);
    if (existingSlug) {
      duplicates.push({
        row: row.rowNumber,
        reason: "slug_collision",
        matched_id: existingSlug.id,
        matched_slug: existingSlug.slug,
        matched_title: existingSlug.title,
      });
      continue; // Skip further checks for this row
    }

    // Check 1b: Slug collision within batch
    if (batchSlugs.has(slug)) {
      // Find the first row with this slug
      const firstRow = rows.find(
        (r) => generateSlug(r.title) === slug && r.rowNumber < row.rowNumber
      );
      duplicates.push({
        row: row.rowNumber,
        reason: "slug_collision",
        matched_id: `batch-row-${firstRow?.rowNumber}`,
        matched_slug: slug,
        matched_title: firstRow?.title,
      });
      continue;
    }
    batchSlugs.add(slug);

    // Resolve venue for this row
    let resolvedVenueId = row.venue_id;
    if (!row.venue_id && row.venue_name) {
      const lowerVenueName = row.venue_name.toLowerCase().trim();
      const venueMatch = venueNameMap.get(lowerVenueName);

      if (!venueMatch) {
        venueWarnings.push({
          row: row.rowNumber,
          warning: `Venue not found: "${row.venue_name}"`,
        });
        resolvedVenueId = null;
      } else if (venueMatch.count > 1) {
        venueWarnings.push({
          row: row.rowNumber,
          warning: `Multiple venues match: "${row.venue_name}" (${venueMatch.count} matches)`,
        });
        resolvedVenueId = null;
      } else {
        resolvedVenueId = venueMatch.id;
      }
    }
    venueResolutions.set(row.rowNumber, resolvedVenueId);

    // Check 2: Title + event_date + venue_id match
    const titleKey = row.title.toLowerCase().trim();
    const lookupKey = `${titleKey}|${row.event_date}|${resolvedVenueId || "null"}`;
    const existingMatch = titleDateVenueMap.get(lookupKey);

    if (existingMatch) {
      duplicates.push({
        row: row.rowNumber,
        reason: "title_date_venue_match",
        matched_id: existingMatch.id,
        matched_title: existingMatch.title,
      });
      continue;
    }
  }

  return { duplicates, venueWarnings, venueResolutions };
}

/**
 * Validates that all venue_id references exist.
 * Returns list of invalid venue_ids with row numbers.
 */
export async function validateVenueIds(
  rows: ValidatedRow[],
  supabase: SupabaseClient
): Promise<Array<{ row: number; venue_id: string }>> {
  const venueIds = rows
    .filter((r) => r.venue_id)
    .map((r) => ({ row: r.rowNumber, venue_id: r.venue_id! }));

  if (venueIds.length === 0) return [];

  const uniqueIds = [...new Set(venueIds.map((v) => v.venue_id))];

  const { data: existingVenues } = await supabase
    .from("venues")
    .select("id")
    .in("id", uniqueIds);

  const existingSet = new Set((existingVenues || []).map((v) => v.id));

  return venueIds.filter((v) => !existingSet.has(v.venue_id));
}

/**
 * Events CSV Import Preview API
 *
 * POST /api/admin/ops/events/import-preview
 *
 * Parses CSV, validates rows, checks for duplicates, and returns preview.
 * READ-ONLY - does not modify the database.
 *
 * Admin-only endpoint.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { parseImportCsv } from "@/lib/ops/eventImportParser";
import { validateImportRows } from "@/lib/ops/eventImportValidation";
import {
  checkDuplicates,
  validateVenueIds,
} from "@/lib/ops/eventImportDedupe";

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse request body
  let csv: string;
  try {
    const body = await request.json();
    csv = body.csv;
    if (!csv || typeof csv !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid csv field in request body" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  // Step 1: Parse CSV
  const parseResult = parseImportCsv(csv);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        summary: {
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          duplicates: 0,
        },
        parseErrors: parseResult.errors,
        validRows: [],
        invalidRows: [],
        duplicates: [],
        venueWarnings: [],
      },
      { status: 400 }
    );
  }

  // Step 2: Validate rows
  const validationResult = validateImportRows(parseResult.rows);

  // Step 3: Check for duplicates (using service client for read access)
  const serviceClient = createServiceRoleClient();
  const dedupeResult = await checkDuplicates(
    validationResult.validRows,
    serviceClient
  );

  // Step 4: Validate venue_id references
  const invalidVenueRefs = await validateVenueIds(
    validationResult.validRows,
    serviceClient
  );

  // Add venue validation errors to invalid rows
  for (const invalid of invalidVenueRefs) {
    const existingInvalid = validationResult.invalidRows.find(
      (r) => r.row === invalid.row
    );
    if (existingInvalid) {
      existingInvalid.errors.push(
        `Invalid venue_id reference: "${invalid.venue_id}" does not exist`
      );
    } else {
      validationResult.invalidRows.push({
        row: invalid.row,
        errors: [
          `Invalid venue_id reference: "${invalid.venue_id}" does not exist`,
        ],
      });
    }
  }

  // Calculate counts
  const duplicateRowNumbers = new Set(dedupeResult.duplicates.map((d) => d.row));
  const invalidRowNumbers = new Set(validationResult.invalidRows.map((r) => r.row));

  // Valid rows are those not in duplicates and not in invalidRows
  const readyToInsert = validationResult.validRows.filter(
    (row) =>
      !duplicateRowNumbers.has(row.rowNumber) &&
      !invalidRowNumbers.has(row.rowNumber)
  );

  // Build response
  return NextResponse.json({
    success: true,
    summary: {
      totalRows: parseResult.rows.length,
      validRows: readyToInsert.length,
      invalidRows: validationResult.invalidRows.length,
      duplicates: dedupeResult.duplicates.length,
    },
    validRows: readyToInsert.map((row) => ({
      row: row.rowNumber,
      title: row.title,
      event_type: row.event_type,
      event_date: row.event_date,
      day_of_week: row.derived_day_of_week,
      recurrence_rule: row.recurrence_rule,
      venue_id: dedupeResult.venueResolutions.get(row.rowNumber) ?? row.venue_id,
      venue_name: row.venue_name,
      pre_verified: row.pre_verified,
    })),
    invalidRows: validationResult.invalidRows,
    duplicates: dedupeResult.duplicates,
    venueWarnings: dedupeResult.venueWarnings,
  });
}

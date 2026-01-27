/**
 * Events CSV Import Apply API
 *
 * POST /api/admin/ops/events/import-apply
 *
 * Parses CSV, validates, dedupes, and INSERTs valid non-duplicate rows.
 * Returns list of inserted event IDs.
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
import { buildInsertPayloads } from "@/lib/ops/eventImportBuilder";
import { opsAudit } from "@/lib/audit/opsAudit";
import { Database } from "@/lib/supabase/database.types";

type EventInsert = Database["public"]["Tables"]["events"]["Insert"];

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
          inserted: 0,
          skipped_dedupe: 0,
          skipped_validation: 0,
          errors: 0,
        },
        parseErrors: parseResult.errors,
        inserted: [],
        skipped: [],
        errors: [],
      },
      { status: 400 }
    );
  }

  // Step 2: Validate rows
  const validationResult = validateImportRows(parseResult.rows);

  // Step 3: Check for duplicates
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

  // Build sets of rows to skip
  const duplicateRowNumbers = new Set(dedupeResult.duplicates.map((d) => d.row));
  const invalidRowNumbers = new Set(validationResult.invalidRows.map((r) => r.row));
  const invalidVenueRowNumbers = new Set(invalidVenueRefs.map((r) => r.row));

  // Combine all skip reasons
  const allSkippedRows = new Set([
    ...duplicateRowNumbers,
    ...invalidRowNumbers,
    ...invalidVenueRowNumbers,
  ]);

  // Filter to rows ready for insert
  const rowsToInsert = validationResult.validRows.filter(
    (row) => !allSkippedRows.has(row.rowNumber)
  );

  // Step 5: Build insert payloads
  const insertResults = buildInsertPayloads(
    rowsToInsert,
    dedupeResult.venueResolutions,
    user.id
  );

  // Step 6: Execute inserts
  const inserted: Array<{ row: number; id: string; title: string }> = [];
  const insertErrors: Array<{ row: number; error: string }> = [];

  for (const { rowNumber, payload } of insertResults) {
    const { data, error } = await serviceClient
      .from("events")
      .insert(payload as EventInsert)
      .select("id, title")
      .single();

    if (error) {
      insertErrors.push({
        row: rowNumber,
        error: error.message,
      });
    } else if (data) {
      inserted.push({
        row: rowNumber,
        id: data.id,
        title: data.title,
      });
    }
  }

  // Step 7: Log the import action
  await opsAudit.eventsImport(user.id, {
    totalRows: parseResult.rows.length,
    insertedCount: inserted.length,
    skippedDedupeCount: duplicateRowNumbers.size,
    skippedValidationCount: invalidRowNumbers.size + invalidVenueRowNumbers.size,
    errorCount: insertErrors.length,
    insertedIds: inserted.map((i) => i.id),
  });

  // Build skipped list for response
  const skipped: Array<{ row: number; reason: string }> = [];

  for (const inv of validationResult.invalidRows) {
    skipped.push({
      row: inv.row,
      reason: `validation_failed: ${inv.errors.join("; ")}`,
    });
  }

  for (const inv of invalidVenueRefs) {
    if (!invalidRowNumbers.has(inv.row)) {
      skipped.push({
        row: inv.row,
        reason: `invalid_venue_id: ${inv.venue_id}`,
      });
    }
  }

  for (const dup of dedupeResult.duplicates) {
    skipped.push({
      row: dup.row,
      reason: `${dup.reason}: matched ${dup.matched_id}`,
    });
  }

  // Return response
  return NextResponse.json({
    success: insertErrors.length === 0,
    summary: {
      inserted: inserted.length,
      skipped_dedupe: duplicateRowNumbers.size,
      skipped_validation: invalidRowNumbers.size + invalidVenueRowNumbers.size,
      errors: insertErrors.length,
    },
    inserted,
    skipped: skipped.sort((a, b) => a.row - b.row),
    errors: insertErrors,
    venueWarnings: dedupeResult.venueWarnings,
  });
}

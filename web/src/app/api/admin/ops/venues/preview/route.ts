/**
 * Venue CSV Preview API
 *
 * POST /api/admin/ops/venues/preview
 *
 * Parses and validates uploaded CSV, computes diff against current DB state.
 * Does NOT apply changes - use /apply endpoint for that.
 * Admin-only endpoint.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { parseVenueCsv } from "@/lib/ops/venueCsvParser";
import { validateVenueRows } from "@/lib/ops/venueValidation";
import { computeVenueDiff } from "@/lib/ops/venueDiff";
import { opsAudit } from "@/lib/audit/opsAudit";

export async function POST(request: Request) {
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
  let body: { csv?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.csv || typeof body.csv !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'csv' field" },
      { status: 400 }
    );
  }

  // Parse CSV
  const parseResult = parseVenueCsv(body.csv);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        valid: false,
        parseErrors: parseResult.errors,
      },
      { status: 400 }
    );
  }

  // Validate rows
  const validationResult = validateVenueRows(parseResult.rows);

  if (!validationResult.allValid) {
    return NextResponse.json(
      {
        valid: false,
        rowErrors: validationResult.invalidRows.map((inv) => ({
          row: inv.rowIndex,
          errors: inv.validation.errors,
          warnings: inv.validation.warnings,
        })),
      },
      { status: 400 }
    );
  }

  // Fetch current venues from DB for diff
  const serviceClient = createServiceRoleClient();
  const venueIds = validationResult.validRows.map((r) => r.id);

  const { data: currentVenues, error: fetchError } = await serviceClient
    .from("venues")
    .select("id, name, address, city, state, zip, website_url, phone, google_maps_url, notes")
    .in("id", venueIds);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  // Compute diff
  const diff = computeVenueDiff(currentVenues || [], validationResult.validRows);

  // Log preview action
  await opsAudit.venuesCsvPreview(user.id, {
    rowCount: validationResult.validRows.length,
    updatedCount: diff.updates.length,
    notFoundIds: diff.notFound,
  });

  return NextResponse.json({
    valid: true,
    diff: {
      updates: diff.updates,
      notFound: diff.notFound,
      unchanged: diff.unchanged,
    },
    summary: {
      totalRows: validationResult.validRows.length,
      willUpdate: diff.updates.length,
      willSkip: diff.notFound.length,
      unchanged: diff.unchanged,
    },
  });
}

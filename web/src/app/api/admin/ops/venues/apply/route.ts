/**
 * Venue CSV Apply API
 *
 * POST /api/admin/ops/venues/apply
 *
 * Re-validates CSV and applies updates to database.
 * Update-only mode - IDs not found in DB are skipped (not created).
 * Admin-only endpoint.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { parseVenueCsv } from "@/lib/ops/venueCsvParser";
import { validateVenueRows } from "@/lib/ops/venueValidation";
import { computeVenueDiff, buildUpdatePayloads } from "@/lib/ops/venueDiff";
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

  // Re-validate everything (don't trust client)
  const parseResult = parseVenueCsv(body.csv);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        applied: 0,
        skipped: 0,
        error: "CSV parsing failed",
        parseErrors: parseResult.errors,
      },
      { status: 400 }
    );
  }

  const validationResult = validateVenueRows(parseResult.rows);

  if (!validationResult.allValid) {
    return NextResponse.json(
      {
        applied: 0,
        skipped: 0,
        error: "Validation failed",
        rowErrors: validationResult.invalidRows.map((inv) => ({
          row: inv.rowIndex,
          errors: inv.validation.errors,
        })),
      },
      { status: 400 }
    );
  }

  // Fetch current venues
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

  // No updates to apply
  if (diff.updates.length === 0) {
    await opsAudit.venuesCsvApply(user.id, {
      updatedCount: 0,
      skippedCount: diff.notFound.length,
      notFoundIds: diff.notFound,
    });

    return NextResponse.json({
      applied: 0,
      skipped: diff.notFound.length,
      unchanged: diff.unchanged,
      message: "No changes to apply",
    });
  }

  // Build update payloads
  const updatePayloads = buildUpdatePayloads(diff.updates);

  // Apply updates one by one (could batch, but safer for error handling)
  let appliedCount = 0;
  const errors: { id: string; error: string }[] = [];

  for (const payload of updatePayloads) {
    const { error: updateError } = await serviceClient
      .from("venues")
      .update(payload.updates)
      .eq("id", payload.id);

    if (updateError) {
      errors.push({ id: payload.id, error: updateError.message });
    } else {
      appliedCount++;
    }
  }

  // Log apply action
  await opsAudit.venuesCsvApply(user.id, {
    updatedCount: appliedCount,
    skippedCount: diff.notFound.length,
    notFoundIds: diff.notFound,
  });

  // Return result
  if (errors.length > 0) {
    return NextResponse.json({
      applied: appliedCount,
      skipped: diff.notFound.length,
      unchanged: diff.unchanged,
      errors,
      message: `Applied ${appliedCount} updates with ${errors.length} errors`,
    });
  }

  return NextResponse.json({
    applied: appliedCount,
    skipped: diff.notFound.length,
    unchanged: diff.unchanged,
    message: `Successfully applied ${appliedCount} updates`,
  });
}

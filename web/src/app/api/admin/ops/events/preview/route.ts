/**
 * Events CSV Preview API
 *
 * POST /api/admin/ops/events/preview
 *
 * Accepts CSV content and returns a preview of changes that would be applied.
 * Does not modify the database.
 *
 * Admin-only endpoint.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { parseEventCsv, DatabaseEvent } from "@/lib/ops/eventCsvParser";
import { validateEventRows } from "@/lib/ops/eventValidation";
import { computeEventDiff } from "@/lib/ops/eventDiff";
import { opsAudit } from "@/lib/audit/opsAudit";

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

  // Parse CSV
  const parseResult = parseEventCsv(csv);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "CSV parsing failed",
        parseErrors: parseResult.errors,
      },
      { status: 400 }
    );
  }

  // Validate rows
  const validationResult = validateEventRows(parseResult.rows);
  if (!validationResult.allValid) {
    return NextResponse.json(
      {
        error: "Validation failed",
        validationErrors: validationResult.invalidRows,
        warnings: validationResult.warnings,
      },
      { status: 400 }
    );
  }

  // Fetch current events from database
  const serviceClient = createServiceRoleClient();

  // Get list of IDs from CSV
  const csvIds = validationResult.validRows.map((r) => r.id);

  const { data: currentEvents, error: fetchError } = await serviceClient
    .from("events")
    .select(
      "id, title, event_type, status, is_recurring, event_date, day_of_week, start_time, end_time, venue_id, is_published, host_notes"
    )
    .in("id", csvIds);

  if (fetchError) {
    return NextResponse.json(
      { error: `Database error: ${fetchError.message}` },
      { status: 500 }
    );
  }

  // Validate venue_ids exist (if any venues are specified)
  const venueIds = validationResult.validRows
    .map((r) => r.venue_id)
    .filter((id): id is string => id !== null);

  let invalidVenueIds: string[] = [];
  if (venueIds.length > 0) {
    const { data: venues, error: venueError } = await serviceClient
      .from("venues")
      .select("id")
      .in("id", venueIds);

    if (venueError) {
      return NextResponse.json(
        { error: `Database error checking venues: ${venueError.message}` },
        { status: 500 }
      );
    }

    const existingVenueIds = new Set((venues || []).map((v) => v.id));
    invalidVenueIds = venueIds.filter((id) => !existingVenueIds.has(id));
  }

  if (invalidVenueIds.length > 0) {
    return NextResponse.json(
      {
        error: "Invalid venue_id references",
        invalidVenueIds,
      },
      { status: 400 }
    );
  }

  // Compute diff
  const diff = computeEventDiff(
    (currentEvents || []) as DatabaseEvent[],
    validationResult.validRows
  );

  // Log the preview action
  await opsAudit.eventsCsvPreview(user.id, {
    rowCount: parseResult.rows.length,
    updatedCount: diff.updates.length,
    unchangedCount: diff.unchanged,
    notFoundIds: diff.notFound,
  });

  // Return preview
  return NextResponse.json({
    summary: {
      totalRows: parseResult.rows.length,
      updates: diff.updates.length,
      unchanged: diff.unchanged,
      notFound: diff.notFound.length,
    },
    updates: diff.updates,
    notFound: diff.notFound,
    warnings: validationResult.warnings,
  });
}

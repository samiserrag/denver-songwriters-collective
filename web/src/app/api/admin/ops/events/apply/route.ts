/**
 * Events CSV Apply API
 *
 * POST /api/admin/ops/events/apply
 *
 * Accepts CSV content and applies changes to the database.
 * Validates and computes diff before applying.
 *
 * Admin-only endpoint.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { parseEventCsv, DatabaseEvent } from "@/lib/ops/eventCsvParser";
import { validateEventRows } from "@/lib/ops/eventValidation";
import { computeEventDiff, buildEventUpdatePayloads } from "@/lib/ops/eventDiff";
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
    const invalidVenueIds = venueIds.filter((id) => !existingVenueIds.has(id));

    if (invalidVenueIds.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid venue_id references",
          invalidVenueIds,
        },
        { status: 400 }
      );
    }
  }

  // Compute diff
  const diff = computeEventDiff(
    (currentEvents || []) as DatabaseEvent[],
    validationResult.validRows
  );

  // If no updates, return early
  if (diff.updates.length === 0) {
    return NextResponse.json({
      success: true,
      summary: {
        updated: 0,
        unchanged: diff.unchanged,
        notFound: diff.notFound.length,
      },
      notFound: diff.notFound,
    });
  }

  // Build update payloads
  const payloads = buildEventUpdatePayloads(diff.updates);

  // Apply updates
  let updatedCount = 0;
  const errors: { id: string; error: string }[] = [];

  for (const payload of payloads) {
    const { error: updateError } = await serviceClient
      .from("events")
      .update(payload.updates)
      .eq("id", payload.id);

    if (updateError) {
      errors.push({ id: payload.id, error: updateError.message });
    } else {
      updatedCount++;
    }
  }

  // Log the apply action
  await opsAudit.eventsCsvApply(user.id, {
    rowCount: parseResult.rows.length,
    updatedCount,
    skippedCount: diff.unchanged,
    notFoundIds: diff.notFound,
    errorCount: errors.length,
  });

  // Return result
  return NextResponse.json({
    success: errors.length === 0,
    summary: {
      updated: updatedCount,
      unchanged: diff.unchanged,
      notFound: diff.notFound.length,
      errors: errors.length,
    },
    notFound: diff.notFound,
    errors: errors.length > 0 ? errors : undefined,
  });
}

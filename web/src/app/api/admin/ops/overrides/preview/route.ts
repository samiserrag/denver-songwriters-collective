/**
 * Overrides CSV Preview API
 *
 * POST /api/admin/ops/overrides/preview
 *
 * Accepts CSV content and returns a preview of changes that would be applied.
 * Supports upsert: identifies both updates to existing overrides and new inserts.
 * Does not modify the database.
 *
 * Admin-only endpoint.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import {
  parseOverrideCsv,
  DatabaseOverride,
} from "@/lib/ops/overrideCsvParser";
import { validateOverrideRows } from "@/lib/ops/overrideValidation";
import { computeOverrideDiff } from "@/lib/ops/overrideDiff";
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
  const parseResult = parseOverrideCsv(csv);
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
  const validationResult = validateOverrideRows(parseResult.rows);
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

  const serviceClient = createServiceRoleClient();

  // Get unique event_ids from CSV to validate they exist
  const eventIds = [...new Set(validationResult.validRows.map((r) => r.event_id))];

  const { data: events, error: eventsError } = await serviceClient
    .from("events")
    .select("id")
    .in("id", eventIds);

  if (eventsError) {
    return NextResponse.json(
      { error: `Database error: ${eventsError.message}` },
      { status: 500 }
    );
  }

  const validEventIds = new Set((events || []).map((e) => e.id));

  // Fetch existing overrides for the event_ids in the CSV
  const { data: currentOverrides, error: fetchError } = await serviceClient
    .from("occurrence_overrides")
    .select(
      "id, event_id, date_key, status, override_start_time, override_notes, override_cover_image_url, created_at, updated_at, created_by"
    )
    .in("event_id", eventIds);

  if (fetchError) {
    return NextResponse.json(
      { error: `Database error: ${fetchError.message}` },
      { status: 500 }
    );
  }

  // Compute diff (with upsert logic)
  const diff = computeOverrideDiff(
    (currentOverrides || []) as DatabaseOverride[],
    validationResult.validRows,
    validEventIds
  );

  // Log the preview action
  await opsAudit.overridesCsvPreview(user.id, {
    rowCount: parseResult.rows.length,
    updatedCount: diff.updates.length,
    insertCount: diff.inserts.length,
    unchangedCount: diff.unchanged,
    eventIdsNotFound: diff.eventIdsNotFound,
  });

  // Return preview
  return NextResponse.json({
    summary: {
      totalRows: parseResult.rows.length,
      inserts: diff.inserts.length,
      updates: diff.updates.length,
      unchanged: diff.unchanged,
      eventIdsNotFound: diff.eventIdsNotFound.length,
    },
    inserts: diff.inserts.map((i) => ({
      event_id: i.event_id,
      date_key: i.date_key,
      status: i.status,
    })),
    updates: diff.updates.map((u) => ({
      event_id: u.event_id,
      date_key: u.date_key,
      changes: u.changes,
    })),
    eventIdsNotFound: diff.eventIdsNotFound,
    warnings: validationResult.warnings,
  });
}

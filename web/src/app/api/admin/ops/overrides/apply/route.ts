/**
 * Overrides CSV Apply API
 *
 * POST /api/admin/ops/overrides/apply
 *
 * Accepts CSV content and applies changes to the database.
 * Supports upsert: inserts new overrides and updates existing ones.
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
import { computeOverrideDiff, buildOverrideUpdatePayloads } from "@/lib/ops/overrideDiff";
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

  // Check for invalid event_ids
  const invalidEventIds = eventIds.filter((id) => !validEventIds.has(id));
  if (invalidEventIds.length > 0) {
    return NextResponse.json(
      {
        error: "Invalid event_id references",
        invalidEventIds,
      },
      { status: 400 }
    );
  }

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

  // If no changes, return early
  if (diff.inserts.length === 0 && diff.updates.length === 0) {
    return NextResponse.json({
      success: true,
      summary: {
        inserted: 0,
        updated: 0,
        unchanged: diff.unchanged,
      },
    });
  }

  let insertedCount = 0;
  let updatedCount = 0;
  const errors: { key: string; error: string }[] = [];

  // Apply inserts
  for (const insert of diff.inserts) {
    const { error: insertError } = await serviceClient
      .from("occurrence_overrides")
      .insert({
        event_id: insert.event_id,
        date_key: insert.date_key,
        status: insert.status,
        override_start_time: insert.override_start_time,
        override_notes: insert.override_notes,
        override_cover_image_url: insert.override_cover_image_url,
        created_by: user.id,
      });

    if (insertError) {
      errors.push({
        key: `${insert.event_id}:${insert.date_key}`,
        error: insertError.message,
      });
    } else {
      insertedCount++;
    }
  }

  // Apply updates
  const updatePayloads = buildOverrideUpdatePayloads(diff.updates);
  for (const payload of updatePayloads) {
    const { error: updateError } = await serviceClient
      .from("occurrence_overrides")
      .update({
        ...payload.updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.id);

    if (updateError) {
      errors.push({
        key: payload.id,
        error: updateError.message,
      });
    } else {
      updatedCount++;
    }
  }

  // Log the apply action
  await opsAudit.overridesCsvApply(user.id, {
    rowCount: parseResult.rows.length,
    insertedCount,
    updatedCount,
    unchangedCount: diff.unchanged,
    errorCount: errors.length,
  });

  // Return result
  return NextResponse.json({
    success: errors.length === 0,
    summary: {
      inserted: insertedCount,
      updated: updatedCount,
      unchanged: diff.unchanged,
      errors: errors.length,
    },
    errors: errors.length > 0 ? errors : undefined,
  });
}

/**
 * Venue Edit Revert API - ABC10a
 *
 * POST: Revert a venue edit using an audit log entry
 * Admin-only endpoint for undoing venue changes.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { venueAudit, VenueAuditContext } from "@/lib/audit/venueAudit";
import { sanitizeVenuePatch } from "@/lib/venue/managerAuth";

interface AuditLogContext {
  action: string;
  actorId: string;
  actorRole: string;
  venueId: string;
  venueName?: string;
  updatedFields: string[];
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await params;
    const supabase = await createSupabaseServerClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin-only
    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { log_id, reason } = body;

    if (!log_id) {
      return NextResponse.json(
        { error: "Missing log_id parameter" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // Fetch the audit log entry
    const { data: logEntry, error: logError } = await serviceClient
      .from("app_logs")
      .select("id, context")
      .eq("id", log_id)
      .eq("source", "venue_audit")
      .single();

    if (logError || !logEntry) {
      return NextResponse.json(
        { error: "Audit log entry not found" },
        { status: 404 }
      );
    }

    const context = logEntry.context as unknown as AuditLogContext;

    // Verify the log entry is for this venue
    if (context.venueId !== venueId) {
      return NextResponse.json(
        { error: "Log entry does not match this venue" },
        { status: 400 }
      );
    }

    // Verify it's a venue_edit action (not already a revert)
    if (context.action !== "venue_edit") {
      return NextResponse.json(
        { error: "Can only revert venue_edit actions" },
        { status: 400 }
      );
    }

    // Get the previous values to restore
    const valuesToRestore = context.previousValues;

    if (!valuesToRestore || Object.keys(valuesToRestore).length === 0) {
      return NextResponse.json(
        { error: "No previous values to restore" },
        { status: 400 }
      );
    }

    // Sanitize the values to restore (safety: only allow manager-editable fields)
    const sanitizedRestore = sanitizeVenuePatch(valuesToRestore);

    if (Object.keys(sanitizedRestore).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to restore after sanitization" },
        { status: 400 }
      );
    }

    // Fetch current venue values for the revert audit log
    const { data: currentVenue, error: fetchError } = await serviceClient
      .from("venues")
      .select(
        "id, name, slug, address, city, state, zip, phone, website_url, google_maps_url, map_link, contact_link, neighborhood, accessibility_notes, parking_notes"
      )
      .eq("id", venueId)
      .single();

    if (fetchError || !currentVenue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Capture current values for the fields being reverted
    const currentValues: Record<string, unknown> = {};
    for (const key of Object.keys(sanitizedRestore)) {
      currentValues[key] = currentVenue[key as keyof typeof currentVenue];
    }

    // Apply the revert
    const { data: updatedVenue, error: updateError } = await serviceClient
      .from("venues")
      .update(sanitizedRestore)
      .eq("id", venueId)
      .select()
      .single();

    if (updateError) {
      console.error("[VenueRevert] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to revert venue" },
        { status: 500 }
      );
    }

    // Log the revert action
    const revertContext: VenueAuditContext = {
      venueId,
      venueName: currentVenue.name,
      updatedFields: Object.keys(sanitizedRestore),
      previousValues: currentValues, // What we're changing FROM
      newValues: sanitizedRestore, // What we're changing TO (the restored values)
      actorRole: "admin",
      reason: reason || "Admin revert via Edit History",
      revertedLogId: log_id,
    };

    await venueAudit.venueEditReverted(user.id, revertContext);

    return NextResponse.json({
      success: true,
      venue: updatedVenue,
      revertedFields: Object.keys(sanitizedRestore),
      revertedLogId: log_id,
    });
  } catch (error) {
    console.error("[VenueRevert] Error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

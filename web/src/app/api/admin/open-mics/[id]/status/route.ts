// web/src/app/api/admin/open-mics/[id]/status/route.ts
// Admin-only endpoint to update open mic event status

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";

// Allowed status values (whitelist)
const ALLOWED_STATUSES = ["active", "inactive", "cancelled"] as const;
type OpenMicStatus = typeof ALLOWED_STATUSES[number];

const LEGACY_VERIFICATION_STATUSES = new Set(["needs_verification", "unverified"]);

function isValidStatus(status: string): status is OpenMicStatus {
  return ALLOWED_STATUSES.includes(status as OpenMicStatus);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid event ID format" }, { status: 400 });
    }

    // Authenticate user
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check admin role
    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Access denied - admin only" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json() as { status?: string; note?: string };

    if (!body.status) {
      return NextResponse.json({ error: "Missing required field: status" }, { status: 400 });
    }

    const normalizedStatus = LEGACY_VERIFICATION_STATUSES.has(body.status)
      ? "active"
      : body.status;

    if (!isValidStatus(normalizedStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const newStatus = normalizedStatus;
    const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";

    // Use service role client for admin operations
    const serviceClient = createServiceRoleClient();

    // Fetch the event and verify it's an open_mic
    const { data: event, error: fetchError } = await serviceClient
      .from("events")
      .select("id, event_type, status, notes")
      .eq("id", id)
      .single();

    if (fetchError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.event_type !== "open_mic") {
      return NextResponse.json(
        { error: "This endpoint only handles open_mic events" },
        { status: 400 }
      );
    }

    // Build the audit note
    const timestamp = new Date().toISOString();
    const auditNote = `[ADMIN_STATUS: set_to=${newStatus} | at=${timestamp} | by=${user.id}${note ? ` | note=${note}` : ""}]`;

    // Append to existing notes
    const existingNotes = event.notes || "";
    const updatedNotes = existingNotes
      ? `${existingNotes}\n${auditNote}`
      : auditNote;

    // Build update object
    const updateData: {
      status: string;
      notes: string;
      last_verified_at?: string;
      verified_by?: string;
    } = {
      status: newStatus,
      notes: updatedNotes,
    };

    // If setting to active, update verification fields
    if (newStatus === "active") {
      updateData.last_verified_at = timestamp;
      updateData.verified_by = user.id;
    }

    // Perform single-row update
    const { data: updatedEvent, error: updateError } = await serviceClient
      .from("events")
      .update(updateData)
      .eq("id", id)
      .select("id, title, status, notes, last_verified_at, verified_by")
      .single();

    if (updateError) {
      console.error("Failed to update event status:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update event" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedEvent,
    });
  } catch (err) {
    console.error("Admin open-mics status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

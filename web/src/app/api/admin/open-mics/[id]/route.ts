/**
 * Phase 4.41: Admin event delete endpoint with guardrails
 *
 * DELETE /api/admin/open-mics/[id]
 *
 * Hard deletes an event. Only allowed if:
 * - No RSVPs exist
 * - No timeslot claims exist
 *
 * Returns 409 Conflict if blocked, with reason.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";

export async function DELETE(
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

    // Use service role client for admin operations
    const serviceClient = createServiceRoleClient();

    // Check if event exists
    const { data: event, error: fetchError } = await serviceClient
      .from("events")
      .select("id, title, event_type")
      .eq("id", id)
      .single();

    if (fetchError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check for RSVPs
    const { count: rsvpCount, error: rsvpError } = await serviceClient
      .from("event_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id);

    if (rsvpError) {
      console.error("Error checking RSVPs:", rsvpError);
      return NextResponse.json({ error: "Failed to check RSVPs" }, { status: 500 });
    }

    if (rsvpCount && rsvpCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: event has ${rsvpCount} RSVP${rsvpCount > 1 ? "s" : ""}` },
        { status: 409 }
      );
    }

    // Check for timeslot claims - join through event_timeslots
    // First get timeslot IDs for this event, then count claims
    const { data: eventTimeslots, error: timeslotError } = await serviceClient
      .from("event_timeslots")
      .select("id")
      .eq("event_id", id);

    if (timeslotError) {
      console.error("Error checking timeslots:", timeslotError);
      return NextResponse.json({ error: "Failed to check timeslots" }, { status: 500 });
    }

    const timeslotIds = (eventTimeslots || []).map((t) => t.id);

    let claimCount = 0;
    if (timeslotIds.length > 0) {
      const { count, error: claimError } = await serviceClient
        .from("timeslot_claims")
        .select("id", { count: "exact", head: true })
        .in("timeslot_id", timeslotIds);

      if (claimError) {
        console.error("Error checking timeslot claims:", claimError);
        return NextResponse.json({ error: "Failed to check timeslot claims" }, { status: 500 });
      }

      claimCount = count || 0;
    }

    if (claimCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: event has ${claimCount} timeslot claim${claimCount > 1 ? "s" : ""}` },
        { status: 409 }
      );
    }

    // Safe to delete - perform hard delete
    const { error: deleteError } = await serviceClient
      .from("events")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Failed to delete event:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete event" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Event "${event.title}" permanently deleted`,
    });
  } catch (err) {
    console.error("Admin event delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";

// Map field_name values to actual events table columns
const FIELD_TO_COLUMN: Record<string, string> = {
  title: "title",
  venue_name: "venue_name",
  venue_address: "venue_address",
  day_of_week: "day_of_week",
  start_time: "start_time",
  end_time: "end_time",
  signup_time: "signup_time",
  description: "description",
  notes: "notes",
  status: "status",
};

interface PatchBody {
  action: "approve" | "reject";
  admin_notes?: string;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    // Authenticate user
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify admin role server-side
    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Access denied - admin only" }, { status: 403 });
    }

    // Parse request body
    const body = (await request.json()) as PatchBody;
    if (!body.action || !["approve", "reject"].includes(body.action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
    const serviceClient = createServiceRoleClient();

    // Fetch the change report
    const { data: report, error: fetchError } = await serviceClient
      .from("change_reports")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: "Change report not found" }, { status: 404 });
    }

    if (report.status !== "pending") {
      return NextResponse.json(
        { error: "Report has already been processed" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (body.action === "approve") {
      // Map field_name to column
      const columnName = FIELD_TO_COLUMN[report.field_name];

      // For "other" field, we don't auto-update - admin needs to handle manually
      if (report.field_name === "other") {
        // Just mark as approved without updating event
        const { error: updateError } = await serviceClient
          .from("change_reports")
          .update({
            status: "approved",
            reviewed_by: user.id,
            reviewed_at: now,
            admin_notes: body.admin_notes || "Manual review required for 'other' field type",
          })
          .eq("id", id);

        if (updateError) {
          console.error("Error updating change report:", updateError);
          return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
        }

        return NextResponse.json({
          message: "Report approved. 'Other' field requires manual event update.",
          report_id: id,
        });
      }

      if (!columnName) {
        return NextResponse.json(
          { error: `Unknown field: ${report.field_name}` },
          { status: 400 }
        );
      }

      // Update the event with the proposed value
      const eventUpdate: Record<string, unknown> = {
        [columnName]: report.proposed_value,
        last_verified_at: now,
        verified_by: user.id,
      };

      const { error: eventError } = await serviceClient
        .from("events")
        .update(eventUpdate)
        .eq("id", report.event_id);

      if (eventError) {
        console.error("Error updating event:", eventError);
        return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
      }

      // Update the change report status
      const { error: reportError } = await serviceClient
        .from("change_reports")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: now,
          admin_notes: body.admin_notes || null,
        })
        .eq("id", id);

      if (reportError) {
        console.error("Error updating change report:", reportError);
        return NextResponse.json({ error: "Failed to update report status" }, { status: 500 });
      }

      return NextResponse.json({
        message: "Change approved and event updated",
        report_id: id,
        event_id: report.event_id,
        field_updated: columnName,
      });

    } else {
      // Reject the report
      const { error: rejectError } = await serviceClient
        .from("change_reports")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: now,
          admin_notes: body.admin_notes || null,
        })
        .eq("id", id);

      if (rejectError) {
        console.error("Error rejecting change report:", rejectError);
        return NextResponse.json({ error: "Failed to reject report" }, { status: 500 });
      }

      return NextResponse.json({
        message: "Change report rejected",
        report_id: id,
      });
    }
  } catch (err) {
    console.error("Error in change reports API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    // Authenticate user
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify admin role server-side
    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Access denied - admin only" }, { status: 403 });
    }

    // Use service role client to bypass RLS
    const serviceClient = createServiceRoleClient();

    const { error } = await serviceClient
      .from("change_reports")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting change report:", error);
      return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Report deleted" });
  } catch (err) {
    console.error("Error in change reports DELETE:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

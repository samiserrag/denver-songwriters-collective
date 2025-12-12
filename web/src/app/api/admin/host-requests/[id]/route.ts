import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";

// PATCH - Approve or reject host request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { action, rejection_reason } = await request.json();

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Get the request
  const { data: hostRequest, error: fetchError } = await supabase
    .from("host_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !hostRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (action === "approve") {
    // Update request status
    const { error: updateError } = await supabase
      .from("host_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating host request:", updateError);
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
    }

    // Add to approved hosts
    const { error: insertError } = await supabase
      .from("approved_hosts")
      .insert({
        user_id: hostRequest.user_id,
        approved_by: user.id,
      });

    if (insertError) {
      console.error("Error adding approved host:", insertError);
      return NextResponse.json({ error: "Failed to add approved host" }, { status: 500 });
    }
  } else {
    // Reject
    const { error: rejectError } = await supabase
      .from("host_requests")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason,
      })
      .eq("id", id);

    if (rejectError) {
      console.error("Error rejecting host request:", rejectError);
      return NextResponse.json({ error: "Failed to reject request" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

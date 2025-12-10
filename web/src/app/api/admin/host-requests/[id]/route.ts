import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH - Approve or reject host request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabase.auth.getUser();
  if (user?.user?.app_metadata?.role !== "admin") {
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
    await supabase
      .from("host_requests")
      .update({
        status: "approved",
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Add to approved hosts
    const { error: insertError } = await supabase
      .from("approved_hosts")
      .insert({
        user_id: hostRequest.user_id,
        approved_by: session.user.id,
      });

    if (insertError) {
      console.error("Error adding approved host:", insertError);
    }
  } else {
    // Reject
    await supabase
      .from("host_requests")
      .update({
        status: "rejected",
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason,
      })
      .eq("id", id);
  }

  return NextResponse.json({ success: true });
}

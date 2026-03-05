import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH - Respond to invitation (accept/decline)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invitationId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action } = await request.json();

  if (!["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Verify this invitation belongs to user and is pending
  const { data: invitation, error: fetchError } = await supabase
    .from("event_hosts")
    .select("*")
    .eq("id", invitationId)
    .eq("user_id", sessionUser.id)
    .eq("invitation_status", "pending")
    .single();

  if (fetchError || !invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const newStatus = action === "accept" ? "accepted" : "declined";

  if (action === "accept" && invitation.role === "host") {
    return NextResponse.json(
      {
        error:
          "Host ownership must be approved via the host claim workflow. This invitation cannot be accepted.",
      },
      { status: 409 }
    );
  }

  // Standard path: co-host accept/decline, or host decline
  const { data: updated, error: updateError } = await supabase
    .from("event_hosts")
    .update({
      invitation_status: newStatus,
      responded_at: new Date().toISOString()
    })
    .eq("id", invitationId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Notify the person who invited them
  if (invitation.invited_by) {
    const statusText = action === "accept" ? "accepted" : "declined";
    const roleLabel = invitation.role === "host" ? "Host" : "Co-host";
    const { error: notifyError } = await supabase.rpc("create_user_notification", {
      p_user_id: invitation.invited_by,
      p_type: "invitation_response",
      p_title: `${roleLabel} invitation ${statusText}`,
      p_message: `Your ${roleLabel.toLowerCase()} invitation was ${statusText}`,
      p_link: `/dashboard/my-events/${invitation.event_id}`
    });

    if (notifyError) {
      console.error("Failed to send invitation response notification:", notifyError);
    }
  }

  return NextResponse.json(updated);
}

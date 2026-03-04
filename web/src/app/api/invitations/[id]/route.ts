import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
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

  // For host role acceptance, atomically claim events.host_id
  // Uses service-role client to bypass RLS on events table
  if (action === "accept" && invitation.role === "host") {
    const serviceClient = createServiceRoleClient();

    // Atomic conditional update: only succeeds if host_id IS NULL
    const { data: claimed, error: claimError } = await serviceClient
      .from("events")
      .update({ host_id: sessionUser.id })
      .eq("id", invitation.event_id)
      .is("host_id", null)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("[InvitationAccept] Failed to claim host_id:", claimError);
      return NextResponse.json(
        { error: "Failed to grant host access" },
        { status: 500 }
      );
    }

    if (!claimed) {
      // host_id was already set (race condition or stale invite)
      return NextResponse.json(
        { error: "This event already has a primary host" },
        { status: 409 }
      );
    }

    // Now update invitation status with service-role (ensures consistency)
    const { data: updated, error: updateError } = await serviceClient
      .from("event_hosts")
      .update({
        invitation_status: newStatus,
        responded_at: new Date().toISOString()
      })
      .eq("id", invitationId)
      .eq("user_id", sessionUser.id)
      .eq("invitation_status", "pending")
      .select()
      .single();

    if (updateError) {
      // Rollback host_id claim
      await serviceClient
        .from("events")
        .update({ host_id: null })
        .eq("id", invitation.event_id)
        .eq("host_id", sessionUser.id);

      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // HOST-ROLE-01: Sync approved_hosts on host invite acceptance.
    {
      const { error: hostSyncError } = await serviceClient
        .from("approved_hosts")
        .upsert(
          {
            user_id: sessionUser.id,
            status: "active",
            approved_at: new Date().toISOString(),
            approved_by: invitation.invited_by || sessionUser.id,
          },
          { onConflict: "user_id" }
        );
      if (hostSyncError) {
        console.error("[InvitationAccept] approved_hosts sync failed:", hostSyncError);
      } else {
        await serviceClient
          .from("profiles")
          .update({ is_host: true })
          .eq("id", sessionUser.id);
        console.log(
          `[InvitationAccept] Synced approved_hosts for userId=${sessionUser.id}`
        );
      }
    }

    // Notify the person who invited them
    if (invitation.invited_by) {
      const { error: notifyError } = await supabase.rpc("create_user_notification", {
        p_user_id: invitation.invited_by,
        p_type: "invitation_response",
        p_title: `Host invitation accepted`,
        p_message: `Your host invitation was accepted`,
        p_link: `/dashboard/my-events/${invitation.event_id}`
      });

      if (notifyError) {
        console.error("Failed to send invitation response notification:", notifyError);
      }
    }

    return NextResponse.json(updated);
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

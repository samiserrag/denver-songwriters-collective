/**
 * Event Invite Revoke API - Phase 4.94
 *
 * DELETE: Revoke a pending invite
 *
 * Authorization: Admin OR primary host (events.host_id === auth.uid())
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const { id: eventId, inviteId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkAdminRole(supabase, session.user.id);

    // Fetch event to check ownership
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, host_id")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check authorization
    if (!isAdmin && event.host_id !== session.user.id) {
      return NextResponse.json(
        { error: "Only admins or the primary host can revoke invites" },
        { status: 403 }
      );
    }

    // Fetch invite to check state
    // Type cast: event_invites table not yet in generated types (migration pending)
    const { data: invite, error: inviteError } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { eq: (col: string, val: string) => { single: () => Promise<{ data: { id: string; accepted_at: string | null; revoked_at: string | null } | null; error: unknown }> } } } } })
      .from("event_invites")
      .select("id, accepted_at, revoked_at")
      .eq("id", inviteId)
      .eq("event_id", eventId)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Cannot revoke already accepted invite
    if (invite.accepted_at) {
      return NextResponse.json(
        { error: "Cannot revoke an accepted invite" },
        { status: 400 }
      );
    }

    // Cannot revoke already revoked invite
    if (invite.revoked_at) {
      return NextResponse.json(
        { error: "Invite is already revoked" },
        { status: 400 }
      );
    }

    // Parse optional reason from body
    let reason: string | null = null;
    try {
      const body = await request.json();
      reason = body.reason?.trim() || null;
    } catch {
      // Body is optional for DELETE
    }

    // Revoke the invite
    // Type cast: event_invites table not yet in generated types (migration pending)
    const { error: updateError } = await (supabase as unknown as { from: (table: string) => { update: (data: object) => { eq: (col: string, val: string) => Promise<{ error: unknown }> } } })
      .from("event_invites")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: session.user.id,
        revoked_reason: reason,
      })
      .eq("id", inviteId);

    if (updateError) {
      console.error("[EventInviteRevoke] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to revoke invite" },
        { status: 500 }
      );
    }

    console.log(
      `[EventInviteRevoke] Revoked invite ${inviteId} for event ${eventId}`
    );

    return NextResponse.json({
      success: true,
      message: "Invite revoked",
    });
  } catch (error) {
    console.error("[EventInviteRevoke] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

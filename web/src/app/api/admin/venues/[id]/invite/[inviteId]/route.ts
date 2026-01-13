/**
 * Admin Venue Invite Management API - ABC8
 *
 * DELETE: Revoke an invite
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const { id: venueId, inviteId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkAdminRole(supabase, session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const revokeReason = body.reason?.trim() || null;

    // Verify invite exists and belongs to this venue
    const { data: invite, error: findError } = await supabase
      .from("venue_invites")
      .select("id, accepted_at, revoked_at")
      .eq("id", inviteId)
      .eq("venue_id", venueId)
      .single();

    if (findError || !invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.accepted_at) {
      return NextResponse.json(
        { error: "Cannot revoke an already accepted invite" },
        { status: 400 }
      );
    }

    if (invite.revoked_at) {
      return NextResponse.json(
        { error: "Invite is already revoked" },
        { status: 400 }
      );
    }

    // Revoke the invite
    const { error: updateError } = await supabase
      .from("venue_invites")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: session.user.id,
        revoked_reason: revokeReason,
      })
      .eq("id", inviteId);

    if (updateError) {
      console.error("[VenueInviteRevoke] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to revoke invite" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Invite revoked successfully",
    });
  } catch (error) {
    console.error("[VenueInviteRevoke] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

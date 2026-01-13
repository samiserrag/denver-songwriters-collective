/**
 * Venue Invite Accept API - ABC8
 *
 * POST: Accept an invite token and gain venue access
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json(
        { error: "Invite token is required" },
        { status: 400 }
      );
    }

    // Hash the token to look it up
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Find the invite
    const { data: invite, error: findError } = await supabase
      .from("venue_invites")
      .select("id, venue_id, email_restriction, expires_at, accepted_at, revoked_at, created_by")
      .eq("token_hash", tokenHash)
      .single();

    if (findError || !invite) {
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invite.accepted_at) {
      return NextResponse.json(
        { error: "This invite has already been used" },
        { status: 400 }
      );
    }

    // Check if revoked
    if (invite.revoked_at) {
      return NextResponse.json(
        { error: "This invite has been revoked" },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This invite has expired" },
        { status: 400 }
      );
    }

    // Check email restriction if set
    if (invite.email_restriction) {
      const userEmail = session.user.email?.toLowerCase();
      if (userEmail !== invite.email_restriction) {
        return NextResponse.json(
          { error: "This invite is restricted to a different email address" },
          { status: 403 }
        );
      }
    }

    // Check if user already has access to this venue
    const { data: existingManager } = await supabase
      .from("venue_managers")
      .select("id")
      .eq("venue_id", invite.venue_id)
      .eq("user_id", session.user.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (existingManager) {
      return NextResponse.json(
        { error: "You already have access to this venue" },
        { status: 409 }
      );
    }

    // Mark invite as accepted
    const { error: acceptError } = await supabase
      .from("venue_invites")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: session.user.id,
      })
      .eq("id", invite.id);

    if (acceptError) {
      console.error("[VenueInviteAccept] Accept error:", acceptError);
      return NextResponse.json(
        { error: "Failed to accept invite" },
        { status: 500 }
      );
    }

    // Grant manager access (invites grant manager role, not owner)
    const { error: grantError } = await supabase.from("venue_managers").insert({
      venue_id: invite.venue_id,
      user_id: session.user.id,
      role: "manager",
      grant_method: "invite",
      created_by: null, // Invite-based, no direct creator
    });

    if (grantError) {
      console.error("[VenueInviteAccept] Grant error:", grantError);
      // Rollback invite acceptance
      await supabase
        .from("venue_invites")
        .update({ accepted_at: null, accepted_by: null })
        .eq("id", invite.id);

      return NextResponse.json(
        { error: "Failed to grant venue access" },
        { status: 500 }
      );
    }

    // Fetch venue info for response
    const { data: venue } = await supabase
      .from("venues")
      .select("id, name, slug")
      .eq("id", invite.venue_id)
      .single();

    // ABC11c: Notify the invite creator that the invite was accepted
    if (invite.created_by) {
      // Get acceptor's profile for the notification message
      const { data: acceptorProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", session.user.id)
        .single();

      const acceptorName =
        acceptorProfile?.full_name ||
        acceptorProfile?.email ||
        session.user.email ||
        "Someone";

      const venueName = venue?.name || "the venue";
      const venueLink = `/dashboard/admin/venues/${invite.venue_id}`;

      // Create notification for the invite creator
      await supabase.rpc("create_user_notification", {
        p_user_id: invite.created_by,
        p_type: "venue_invite_accepted",
        p_title: `Venue invite accepted`,
        p_message: `${acceptorName} accepted your invite and is now a manager of ${venueName}.`,
        p_link: venueLink,
      });
    }

    return NextResponse.json({
      success: true,
      venue: venue || { id: invite.venue_id },
      message: "You now have manager access to this venue!",
    });
  } catch (error) {
    console.error("[VenueInviteAccept] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

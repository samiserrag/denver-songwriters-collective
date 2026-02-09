/**
 * Event Invite Accept API - Phase 4.94
 *
 * POST: Accept an invite token and gain event access
 *
 * Uses service role client for token lookup (bypasses RLS).
 * Validates: token → exists → not revoked → not accepted → not expired → email restriction → role rules.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser }, error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
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
    const tokenHashPrefix = tokenHash.slice(0, 8);

    // Use service role client for lookup (bypasses RLS)
    const serviceClient = createServiceRoleClient();

    // Find the invite
    const { data: invite, error: findError } = await serviceClient
      .from("event_invites")
      .select(
        "id, event_id, email_restriction, role_to_grant, expires_at, accepted_at, revoked_at, created_by"
      )
      .eq("token_hash", tokenHash)
      .single();

    if (findError || !invite) {
      console.error(
        `[EventInviteAccept] Token not found, tokenHashPrefix=${tokenHashPrefix}`
      );
      return NextResponse.json(
        { error: "Invalid or expired invite" },
        { status: 404 }
      );
    }

    // Check if revoked
    if (invite.revoked_at) {
      console.log(
        `[EventInviteAccept] Revoked invite attempted, tokenHashPrefix=${tokenHashPrefix}`
      );
      return NextResponse.json(
        { error: "This invite has been revoked" },
        { status: 400 }
      );
    }

    // Check if already accepted
    if (invite.accepted_at) {
      console.log(
        `[EventInviteAccept] Already used invite attempted, tokenHashPrefix=${tokenHashPrefix}`
      );
      return NextResponse.json(
        { error: "This invite has already been used" },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      console.log(
        `[EventInviteAccept] Expired invite attempted, tokenHashPrefix=${tokenHashPrefix}`
      );
      return NextResponse.json(
        { error: "This invite has expired" },
        { status: 400 }
      );
    }

    // Check email restriction if set
    if (invite.email_restriction) {
      const userEmail = sessionUser.email?.toLowerCase();
      if (userEmail !== invite.email_restriction.toLowerCase()) {
        console.log(
          `[EventInviteAccept] Email mismatch, expected=${invite.email_restriction}, got=${userEmail}, tokenHashPrefix=${tokenHashPrefix}`
        );
        return NextResponse.json(
          { error: "This invite is restricted to a different email address" },
          { status: 403 }
        );
      }
    }

    // Verify event exists and get details
    const { data: event, error: eventError } = await serviceClient
      .from("events")
      .select("id, title, slug, host_id")
      .eq("id", invite.event_id)
      .single();

    if (eventError || !event) {
      console.error(
        `[EventInviteAccept] Event not found for invite, eventId=${invite.event_id}`
      );
      return NextResponse.json(
        { error: "This event no longer exists" },
        { status: 404 }
      );
    }

    // Check if user already has access
    const { data: existingHost } = await serviceClient
      .from("event_hosts")
      .select("id")
      .eq("event_id", invite.event_id)
      .eq("user_id", sessionUser.id)
      .maybeSingle();

    if (existingHost) {
      console.log(
        `[EventInviteAccept] User already has access, userId=${sessionUser.id}, eventId=${invite.event_id}`
      );
      return NextResponse.json(
        { error: "You already have access to this event" },
        { status: 409 }
      );
    }

    // Handle role-specific grant logic
    const roleToGrant = invite.role_to_grant;

    if (roleToGrant === "host") {
      // Host invite: only succeeds if events.host_id IS NULL
      if (event.host_id !== null) {
        console.log(
          `[EventInviteAccept] Host invite rejected - event already has primary host, eventId=${invite.event_id}`
        );
        return NextResponse.json(
          { error: "This event already has a primary host" },
          { status: 409 }
        );
      }

      // Set primary owner
      const { error: updateEventError } = await serviceClient
        .from("events")
        .update({ host_id: sessionUser.id })
        .eq("id", invite.event_id);

      if (updateEventError) {
        console.error(
          "[EventInviteAccept] Failed to set host_id:",
          updateEventError
        );
        return NextResponse.json(
          { error: "Failed to grant host access" },
          { status: 500 }
        );
      }
    }

    // Insert event_hosts row (for both host and cohost)
    const { error: grantError } = await serviceClient.from("event_hosts").insert({
      event_id: invite.event_id,
      user_id: sessionUser.id,
      role: roleToGrant,
      invitation_status: "accepted",
      invited_by: invite.created_by,
      invited_at: new Date().toISOString(),
      responded_at: new Date().toISOString(),
    });

    if (grantError) {
      console.error("[EventInviteAccept] Grant error:", grantError);

      // Rollback host_id if we set it
      if (roleToGrant === "host") {
        await serviceClient
          .from("events")
          .update({ host_id: null })
          .eq("id", invite.event_id);
      }

      return NextResponse.json(
        { error: "Failed to grant event access" },
        { status: 500 }
      );
    }

    // Mark invite as accepted
    const { error: acceptError } = await serviceClient
      .from("event_invites")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: sessionUser.id,
      })
      .eq("id", invite.id);

    if (acceptError) {
      console.error("[EventInviteAccept] Accept error:", acceptError);
      // Don't fail the request - the grant was successful
    }

    // Fetch acceptor's profile for notification
    const { data: acceptorProfile } = await serviceClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", sessionUser.id)
      .single();

    const acceptorName =
      acceptorProfile?.full_name ||
      acceptorProfile?.email ||
      sessionUser.email ||
      "Someone";

    const eventTitle = event.title || "the event";
    const roleLabel = roleToGrant === "host" ? "host" : "co-host";

    // Notify invite creator
    if (invite.created_by) {
      await serviceClient.rpc("create_user_notification", {
        p_user_id: invite.created_by,
        p_type: "event_invite_accepted",
        p_title: "Event invite accepted",
        p_message: `${acceptorName} accepted your invite and is now a ${roleLabel} of "${eventTitle}".`,
        p_link: `/dashboard/my-events/${invite.event_id}`,
      });
    }

    console.log(
      `[EventInviteAccept] Successfully accepted invite, userId=${sessionUser.id}, eventId=${invite.event_id}, role=${roleToGrant}`
    );

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
      },
      roleGranted: roleToGrant,
      message: `You are now a ${roleLabel} of this event!`,
    });
  } catch (error) {
    console.error("[EventInviteAccept] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

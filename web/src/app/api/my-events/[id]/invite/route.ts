/**
 * Event Invite API - Phase 4.94
 *
 * POST: Generate an invite link for an event
 * GET: List active invites for an event
 *
 * Authorization: Admin OR primary host (events.host_id === auth.uid())
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { SITE_URL } from "@/lib/email/render";
import crypto from "crypto";

/**
 * Check if user is authorized to manage invites for this event
 * Returns { authorized: boolean, event?: { id, title, host_id } }
 */
async function checkInviteAuthorization(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
  userId: string
): Promise<{ authorized: boolean; event?: { id: string; title: string; host_id: string | null } }> {
  const isAdmin = await checkAdminRole(supabase, userId);

  // Fetch event to check ownership
  const { data: event, error } = await supabase
    .from("events")
    .select("id, title, host_id")
    .eq("id", eventId)
    .single();

  if (error || !event) {
    return { authorized: false };
  }

  // Admin or primary host can manage invites
  if (isAdmin || event.host_id === userId) {
    return { authorized: true, event };
  }

  return { authorized: false, event };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check authorization
    const { authorized, event } = await checkInviteAuthorization(
      supabase,
      eventId,
      session.user.id
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "Only admins or the primary host can create invites" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const roleToGrant = body.role_to_grant || "cohost";
    const emailRestriction = body.email_restriction?.trim().toLowerCase() || null;
    const expiresInDays = body.expires_in_days || 7;

    // Validate role_to_grant
    if (!["host", "cohost"].includes(roleToGrant)) {
      return NextResponse.json(
        { error: "role_to_grant must be 'host' or 'cohost'" },
        { status: 400 }
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create invite
    const { data: invite, error: insertError } = await supabase
      .from("event_invites")
      .insert({
        event_id: eventId,
        token_hash: tokenHash,
        email_restriction: emailRestriction,
        role_to_grant: roleToGrant,
        expires_at: expiresAt.toISOString(),
        created_by: session.user.id,
      })
      .select("id")
      .single();

    if (insertError || !invite) {
      console.error("[EventInviteCreate] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create invite" },
        { status: 500 }
      );
    }

    // Build the invite URL (token shown only once)
    const inviteUrl = `${SITE_URL}/event-invite?token=${token}`;

    console.log(
      `[EventInviteCreate] Created invite for event ${eventId}, role=${roleToGrant}, tokenHashPrefix=${tokenHash.slice(0, 8)}`
    );

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
      inviteUrl,
      expiresAt: expiresAt.toISOString(),
      emailRestriction,
      roleToGrant,
      message:
        "Invite created. Share this link with the intended recipient. The token will not be shown again.",
    });
  } catch (error) {
    console.error("[EventInviteCreate] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check authorization
    const { authorized, event } = await checkInviteAuthorization(
      supabase,
      eventId,
      session.user.id
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "Only admins or the primary host can view invites" },
        { status: 403 }
      );
    }

    // Fetch all invites for this event (most recent first)
    const { data: invites, error } = await supabase
      .from("event_invites")
      .select(
        "id, role_to_grant, email_restriction, expires_at, created_at, created_by, accepted_at, accepted_by, revoked_at"
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[EventInviteList] Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch invites" },
        { status: 500 }
      );
    }

    // Compute status for each invite
    const now = new Date();
    const invitesWithStatus = (invites || []).map((invite) => {
      let status: "pending" | "accepted" | "expired" | "revoked";
      if (invite.revoked_at) {
        status = "revoked";
      } else if (invite.accepted_at) {
        status = "accepted";
      } else if (new Date(invite.expires_at) < now) {
        status = "expired";
      } else {
        status = "pending";
      }
      return { ...invite, status };
    });

    return NextResponse.json({ invites: invitesWithStatus });
  } catch (error) {
    console.error("[EventInviteList] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

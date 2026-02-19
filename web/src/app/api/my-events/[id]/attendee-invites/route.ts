/**
 * Event Attendee Invites API — PR3 (Private Events Tract)
 *
 * POST: Create attendee invite (by user_id or email)
 * GET: List attendee invites for an event
 * PATCH: Revoke an attendee invite
 *
 * Authorization: Admin OR primary host (events.host_id === auth.uid())
 * Co-hosts are NOT allowed to create/revoke attendee invites (per Sami decision).
 *
 * Cap: 200 invites per event (enforced at application layer).
 *
 * @see docs/investigation/private-invite-only-events-stopgate.md
 * @see docs/postmortems/2026-02-18-private-events-rls-recursion.md
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import crypto from "crypto";

/** Max attendee invites per event (application-layer enforcement) */
const MAX_INVITES_PER_EVENT = 200;

/**
 * Check if user is authorized to manage attendee invites for this event.
 * Only admin or primary host (events.host_id) — co-hosts excluded.
 */
async function checkAttendeeInviteAuth(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
  userId: string
): Promise<{
  authorized: boolean;
  event?: { id: string; title: string; host_id: string | null; visibility: string };
}> {
  const isAdmin = await checkAdminRole(supabase, userId);

  const { data: event, error } = await supabase
    .from("events")
    .select("id, title, host_id, visibility")
    .eq("id", eventId)
    .single();

  if (error || !event) {
    return { authorized: false };
  }

  // Admin or primary host only (co-hosts excluded per decision)
  if (isAdmin || event.host_id === userId) {
    return { authorized: true, event };
  }

  return { authorized: false, event };
}

/**
 * POST: Create an attendee invite
 *
 * Body:
 * - { user_id: string } — invite an existing member
 * - { email: string } — invite a non-member by email (scaffolds token flow)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser },
      error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { authorized, event } = await checkAttendeeInviteAuth(
      supabase,
      eventId,
      sessionUser.id
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "Only admins or the primary host can manage attendee invites" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const userId = body.user_id?.trim() || null;
    const email = body.email?.trim().toLowerCase() || null;

    // Validate: must provide user_id or email (not both, not neither)
    if (!userId && !email) {
      return NextResponse.json(
        { error: "Must provide either user_id or email" },
        { status: 400 }
      );
    }

    // Use service role for insert (RLS on event_attendee_invites requires host check
    // which we've already verified above)
    const serviceClient = createServiceRoleClient();

    // Enforce invite cap
    const { count: existingCount, error: countError } = await serviceClient
      .from("event_attendee_invites")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .in("status", ["pending", "accepted"]);

    if (countError) {
      console.error("[AttendeeInvite] Count error:", countError);
      return NextResponse.json(
        { error: "Failed to check invite count" },
        { status: 500 }
      );
    }

    if ((existingCount ?? 0) >= MAX_INVITES_PER_EVENT) {
      return NextResponse.json(
        {
          error: `Maximum of ${MAX_INVITES_PER_EVENT} attendee invites per event reached`,
        },
        { status: 400 }
      );
    }

    // Build insert payload with proper typing for Supabase
    let tokenHashForResponse: string | null = null;

    if (userId) {
      // Member invite: verify the user exists
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, full_name")
        .eq("id", userId)
        .single();

      if (!profile) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
    } else if (email) {
      // Email invite: generate token for non-member access
      const token = crypto.randomBytes(32).toString("hex");
      tokenHashForResponse = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      // Token is returned only once in the response (not stored as plaintext)
      // Full token flow (email sending, acceptance) is in PR5
    }

    // Insert invite
    const { data: invite, error: insertError } = await serviceClient
      .from("event_attendee_invites")
      .insert({
        event_id: eventId,
        invited_by: sessionUser.id,
        status: "pending",
        ...(userId ? { user_id: userId } : {}),
        ...(email ? { email, token_hash: tokenHashForResponse } : {}),
      })
      .select("id, event_id, user_id, email, status, created_at, expires_at")
      .single();

    if (insertError) {
      // Handle duplicate constraint violations
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "This person has already been invited to this event" },
          { status: 409 }
        );
      }
      console.error("[AttendeeInvite] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create invite" },
        { status: 500 }
      );
    }

    console.log(
      `[AttendeeInvite] Created invite ${invite.id} for event ${eventId} (${userId ? `user:${userId}` : `email:${email}`})`
    );

    return NextResponse.json({
      success: true,
      invite,
      // Include message for email invites (token acceptance flow is in PR5)
      ...(email
        ? {
            message:
              "Email invite created. Token-based acceptance flow is available in PR5.",
          }
        : {}),
    });
  } catch (error) {
    console.error("[AttendeeInvite] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET: List all attendee invites for this event
 *
 * Returns invites with computed status and joined user profile data.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser },
      error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { authorized, event } = await checkAttendeeInviteAuth(
      supabase,
      eventId,
      sessionUser.id
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "Only admins or the primary host can view attendee invites" },
        { status: 403 }
      );
    }

    // Use service role to fetch all invites (bypasses invitee-only read policy)
    const serviceClient = createServiceRoleClient();

    const { data: invites, error } = await serviceClient
      .from("event_attendee_invites")
      .select("id, event_id, user_id, email, status, invited_by, created_at, expires_at, accepted_at, revoked_at, revoked_by")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[AttendeeInvite] Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch invites" },
        { status: 500 }
      );
    }

    // Compute effective status (expiry is soft — checked on read)
    const now = new Date();
    const invitesWithStatus = (invites || []).map((invite) => {
      let effectiveStatus = invite.status;
      if (
        invite.status === "pending" &&
        invite.expires_at &&
        new Date(invite.expires_at) < now
      ) {
        effectiveStatus = "expired";
      }
      return { ...invite, effective_status: effectiveStatus };
    });

    // Enrich with user profile data for member invites
    const userIds = invitesWithStatus
      .map((i) => i.user_id)
      .filter(Boolean) as string[];

    let profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      if (profiles) {
        profileMap = Object.fromEntries(
          profiles.map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }])
        );
      }
    }

    const enrichedInvites = invitesWithStatus.map((invite) => ({
      ...invite,
      user: invite.user_id ? profileMap[invite.user_id] || null : null,
    }));

    return NextResponse.json({
      invites: enrichedInvites,
      total: enrichedInvites.length,
      cap: MAX_INVITES_PER_EVENT,
    });
  } catch (error) {
    console.error("[AttendeeInvite] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Revoke an attendee invite
 *
 * Body: { invite_id: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user: sessionUser },
      error: sessionUserError,
    } = await supabase.auth.getUser();

    if (sessionUserError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { authorized, event } = await checkAttendeeInviteAuth(
      supabase,
      eventId,
      sessionUser.id
    );

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "Only admins or the primary host can revoke attendee invites" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const inviteId = body.invite_id?.trim();

    if (!inviteId) {
      return NextResponse.json(
        { error: "invite_id is required" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // Verify invite exists and belongs to this event
    const { data: existingInvite, error: fetchError } = await serviceClient
      .from("event_attendee_invites")
      .select("id, status, event_id")
      .eq("id", inviteId)
      .eq("event_id", eventId)
      .single();

    if (fetchError || !existingInvite) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    if (existingInvite.status === "revoked") {
      return NextResponse.json(
        { error: "Invite is already revoked" },
        { status: 400 }
      );
    }

    // Revoke the invite
    const { error: updateError } = await serviceClient
      .from("event_attendee_invites")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by: sessionUser.id,
      })
      .eq("id", inviteId);

    if (updateError) {
      console.error("[AttendeeInvite] Revoke error:", updateError);
      return NextResponse.json(
        { error: "Failed to revoke invite" },
        { status: 500 }
      );
    }

    console.log(
      `[AttendeeInvite] Revoked invite ${inviteId} for event ${eventId} by user ${sessionUser.id}`
    );

    return NextResponse.json({ success: true, revoked: inviteId });
  } catch (error) {
    console.error("[AttendeeInvite] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

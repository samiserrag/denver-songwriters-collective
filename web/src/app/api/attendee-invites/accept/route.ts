/**
 * PR5: Member Attendee Invite Accept API
 *
 * POST: Authenticated member accepts an attendee invite by invite_id.
 * No token required — uses user session to match user_id on the invite.
 *
 * Service-role used only for:
 * - Fetching invite (bypasses RLS since invitee_read_own policy may not cover pre-accept state)
 * - Updating invite status
 *
 * User identity comes from auth session (user-scoped), not service-role.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user (user-scoped — no service role)
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: sessionUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await request.json().catch(() => ({}));
    const inviteId = body.invite_id?.trim();

    if (!inviteId) {
      return NextResponse.json(
        { error: "invite_id is required" },
        { status: 400 }
      );
    }

    // 3. Fetch invite (service-role for lookup — user_id verified against session)
    const serviceClient = createServiceRoleClient();
    const { data: invite, error: findError } = await serviceClient
      .from("event_attendee_invites")
      .select("id, event_id, user_id, status, expires_at")
      .eq("id", inviteId)
      .single();

    if (findError || !invite) {
      // 404-not-403: don't leak invite existence
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    // 4. Verify invite belongs to this user (user-scoped ownership check)
    if (invite.user_id !== sessionUser.id) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    // 5. Validate status
    if (invite.status === "accepted") {
      // Idempotent: already accepted
      const { data: event } = await serviceClient
        .from("events")
        .select("id, title, slug")
        .eq("id", invite.event_id)
        .single();

      return NextResponse.json({
        success: true,
        already_accepted: true,
        event: event
          ? { id: event.id, title: event.title, slug: event.slug }
          : { id: invite.event_id },
      });
    }

    if (invite.status === "revoked") {
      return NextResponse.json(
        { error: "This invite has been revoked" },
        { status: 404 }
      );
    }

    if (invite.status === "declined") {
      return NextResponse.json(
        { error: "This invite was declined" },
        { status: 400 }
      );
    }

    if (invite.status === "expired" || isExpired(invite.expires_at)) {
      return NextResponse.json(
        { error: "This invite has expired" },
        { status: 404 }
      );
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    // 6. Accept the invite (service-role for update)
    const { error: updateError } = await serviceClient
      .from("event_attendee_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id)
      .eq("user_id", sessionUser.id); // Double-check ownership in WHERE clause

    if (updateError) {
      console.error("[AttendeeAccept] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to accept invite" },
        { status: 500 }
      );
    }

    // 7. Fetch event info for response
    const { data: event } = await serviceClient
      .from("events")
      .select("id, title, slug")
      .eq("id", invite.event_id)
      .single();

    return NextResponse.json({
      success: true,
      event: event
        ? { id: event.id, title: event.title, slug: event.slug }
        : { id: invite.event_id },
    });
  } catch (error) {
    console.error("[AttendeeAccept] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

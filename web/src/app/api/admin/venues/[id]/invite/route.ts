/**
 * Admin Venue Invite API - ABC8
 *
 * POST: Generate an invite link for a venue
 * GET: List active invites for a venue
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { SITE_URL } from "@/lib/email/render";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: venueId } = await params;
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

    const body = await request.json();
    const emailRestriction = body.email?.trim().toLowerCase() || null;
    const expiresInDays = body.expiresInDays || 7;

    // Verify venue exists
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("id, name")
      .eq("id", venueId)
      .single();

    if (venueError || !venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create invite
    const { data: invite, error: insertError } = await supabase
      .from("venue_invites")
      .insert({
        venue_id: venueId,
        token_hash: tokenHash,
        email_restriction: emailRestriction,
        expires_at: expiresAt.toISOString(),
        created_by: session.user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[VenueInvite] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create invite" },
        { status: 500 }
      );
    }

    // Build the invite URL (token shown only once)
    const inviteUrl = `${SITE_URL}/venue-invite?token=${token}`;

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
      inviteUrl,
      expiresAt: expiresAt.toISOString(),
      emailRestriction,
      message: "Invite created. Share this link with the intended recipient. The token will not be shown again.",
    });
  } catch (error) {
    console.error("[VenueInvite] Unexpected error:", error);
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
    const { id: venueId } = await params;
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

    // Fetch active invites (not accepted, not revoked, not expired)
    const { data: invites, error } = await supabase
      .from("venue_invites")
      .select("id, email_restriction, expires_at, created_at, created_by")
      .eq("venue_id", venueId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[VenueInvite] Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch invites" },
        { status: 500 }
      );
    }

    return NextResponse.json({ invites: invites || [] });
  } catch (error) {
    console.error("[VenueInvite] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

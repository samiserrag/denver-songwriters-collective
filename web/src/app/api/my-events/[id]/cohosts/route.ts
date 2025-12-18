import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";

// POST - Invite a co-host
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is primary host or admin (using profiles.role, not app_metadata)
  const isAdmin = await checkAdminRole(supabase, session.user.id);

  if (!isAdmin) {
    const { data: hostEntry } = await supabase
      .from("event_hosts")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", session.user.id)
      .eq("invitation_status", "accepted")
      .eq("role", "host")
      .maybeSingle();

    if (!hostEntry) {
      return NextResponse.json({
        error: "Only primary hosts can invite co-hosts"
      }, { status: 403 });
    }
  }

  const { user_id, search_name } = await request.json();

  // Find user by ID or exact name match (case-insensitive for UX, but exact for security)
  let targetUserId = user_id;

  if (!targetUserId && search_name) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("full_name", search_name.trim())
      .maybeSingle();

    if (profile) {
      targetUserId = profile.id;
    }
  }

  if (!targetUserId) {
    return NextResponse.json({
      error: "User not found. Please enter their exact display name."
    }, { status: 404 });
  }

  // Prevent inviting yourself
  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 });
  }

  // Check if already a host
  const { data: existing } = await supabase
    .from("event_hosts")
    .select("id, invitation_status")
    .eq("event_id", eventId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      error: "User is already a host or has a pending invitation"
    }, { status: 400 });
  }

  // Create invitation
  const { data: invitation, error } = await supabase
    .from("event_hosts")
    .insert({
      event_id: eventId,
      user_id: targetUserId,
      role: "cohost",
      invitation_status: "pending",
      invited_by: session.user.id
    })
    .select(`
      *,
      user:profiles(id, full_name, avatar_url)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send notification to invited user
  const { error: notifyError } = await supabase.rpc("create_user_notification", {
    p_user_id: targetUserId,
    p_type: "cohost_invitation",
    p_title: "Co-host Invitation",
    p_message: "You've been invited to co-host an event",
    p_link: `/dashboard/invitations`
  });

  if (notifyError) {
    // Log the error but don't fail the request - the invitation was created successfully
    console.error("Failed to send co-host invitation notification:", notifyError);
  }

  return NextResponse.json(invitation);
}

// DELETE - Remove a co-host
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user_id } = await request.json();

  // Check if user is primary host or admin (using profiles.role, not app_metadata)
  const isAdmin = await checkAdminRole(supabase, session.user.id);

  if (!isAdmin) {
    const { data: hostEntry } = await supabase
      .from("event_hosts")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", session.user.id)
      .eq("invitation_status", "accepted")
      .eq("role", "host")
      .maybeSingle();

    if (!hostEntry) {
      return NextResponse.json({
        error: "Only primary hosts can remove co-hosts"
      }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("event_hosts")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user_id)
    .eq("role", "cohost");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

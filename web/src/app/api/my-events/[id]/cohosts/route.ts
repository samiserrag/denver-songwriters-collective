import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextResponse } from "next/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { sendEmail, isEmailConfigured, getCohostInvitationEmail } from "@/lib/email";

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

  // Find user by ID or name search
  let targetUserId = user_id;

  if (!targetUserId && search_name) {
    // Use service role client to bypass RLS for member search
    // This allows finding members even if they don't have identity flags set yet
    const serviceClient = createServiceRoleClient();

    // Search for partial name match (case-insensitive)
    const searchTerm = `%${search_name.trim()}%`;
    const { data: profiles, error: searchError } = await serviceClient
      .from("profiles")
      .select("id, full_name")
      .ilike("full_name", searchTerm)
      .limit(10);

    if (searchError) {
      console.error("Profile search error:", searchError);
      return NextResponse.json({
        error: "Failed to search members. Please try again."
      }, { status: 500 });
    }

    if (profiles && profiles.length === 1) {
      // Single match found
      targetUserId = profiles[0].id;
    } else if (profiles && profiles.length > 1) {
      // Multiple matches - return them so user can select or be more specific
      return NextResponse.json({
        multiple_matches: profiles.map(p => ({ id: p.id, name: p.full_name })),
        error: `Multiple members found. Please select one or be more specific.`
      }, { status: 400 });
    }
  }

  if (!targetUserId) {
    return NextResponse.json({
      error: "No member found with that name. They may need to join the site first."
    }, { status: 404 });
  }

  // Prevent inviting yourself
  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 });
  }

  // Use service role client for operations that might be blocked by RLS
  // We've already verified authorization above (user is admin or primary host)
  const serviceClient = createServiceRoleClient();

  // Check if already a host
  const { data: existing } = await serviceClient
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

  // Create invitation using service role client
  // RLS policy requires approved_hosts membership, but we've already verified
  // the user is authorized (admin or primary host) at the API level
  const { data: invitation, error } = await serviceClient
    .from("event_hosts")
    .insert({
      event_id: eventId,
      user_id: targetUserId,
      role: "cohost",
      invitation_status: "pending",
      invited_by: session.user.id
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch event details for notification and email
  const { data: event } = await serviceClient
    .from("events")
    .select("title, slug, venue_name, start_time")
    .eq("id", eventId)
    .single();

  // Fetch inviter profile
  const { data: inviter } = await serviceClient
    .from("profiles")
    .select("full_name")
    .eq("id", session.user.id)
    .single();

  // Fetch invited user profile for email
  const { data: invitedUser } = await serviceClient
    .from("profiles")
    .select("full_name, email")
    .eq("id", targetUserId)
    .single();

  const eventTitle = event?.title || "an event";
  const inviterName = inviter?.full_name || "Someone";

  // Send notification to invited user with event details
  const { error: notifyError } = await supabase.rpc("create_user_notification", {
    p_user_id: targetUserId,
    p_type: "cohost_invitation",
    p_title: `Co-host Invitation: ${eventTitle}`,
    p_message: `${inviterName} invited you to co-host "${eventTitle}"`,
    p_link: `/dashboard/invitations`
  });

  if (notifyError) {
    // Log the error but don't fail the request - the invitation was created successfully
    console.error("Failed to send co-host invitation notification:", notifyError);
  }

  // Send email to invited user
  if (invitedUser?.email && isEmailConfigured()) {
    const emailContent = getCohostInvitationEmail({
      inviteeName: invitedUser.full_name || "there",
      inviterName,
      eventTitle,
      eventSlug: event?.slug,
      eventId,
      venueName: event?.venue_name,
      startTime: event?.start_time,
    });

    try {
      await sendEmail({
        to: invitedUser.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
      console.log(`Sent co-host invitation email to ${invitedUser.email}`);
    } catch (emailErr) {
      // Log but don't fail - the invitation was created successfully
      console.error("Failed to send co-host invitation email:", emailErr);
    }
  }

  return NextResponse.json(invitation);
}

// DELETE - Remove a co-host or cancel a pending invitation
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

  // Use service role client to bypass RLS
  // We've already verified authorization above (user is admin or primary host)
  const serviceClient = createServiceRoleClient();

  const { error } = await serviceClient
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

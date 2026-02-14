/**
 * POST /api/gallery-albums/[id]/notify-collaborators
 *
 * Creates pending collaboration invites, in-app notifications, and
 * preference-gated emails for newly invited gallery album collaborators.
 * Called by AlbumManager after successful save.
 *
 * Auth: caller must be album.created_by or admin.
 *
 * Collaborators must accept the invite before the album appears on their profile.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getCollaboratorInvitedEmail } from "@/lib/email/templates/collaboratorInvited";

// ---------------------------------------------------------------------------
// Local helper: resolve invitee email address
// ---------------------------------------------------------------------------

/**
 * Resolves the email address for an invitee profile.
 *
 * Resolution order:
 * 1. Supabase Auth (auth.admin.getUserById) — canonical, always has the login email
 * 2. profiles.email — fallback if Auth lookup fails or returns no email
 * 3. null — no email available
 *
 * profiles.id == auth.users.id in this schema.
 */
async function resolveInviteeEmail(
  serviceClient: ReturnType<typeof getServiceRoleClient>,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string
): Promise<{ email: string | null; source: "auth" | "profiles" | "none" }> {
  // 1. Try Supabase Auth first (preferred — always has the login email)
  const { data: authData, error: authError } = await serviceClient.auth.admin.getUserById(profileId);
  const authEmail = authData?.user?.email?.trim() || null;

  if (authError) {
    console.warn(`[resolveInviteeEmail] Auth lookup failed for ${profileId}: ${authError.message}`);
  }

  if (authEmail) {
    return { email: authEmail, source: "auth" };
  }

  // 2. Fallback: check profiles.email
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", profileId)
    .single();

  const profileEmail = (profile?.email as string | null)?.trim() || null;

  if (profileEmail) {
    return { email: profileEmail, source: "profiles" };
  }

  // 3. No email available
  return { email: null, source: "none" };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: albumId } = await params;
  const supabase = await createSupabaseServerClient();

  // 1. Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  const body = await request.json().catch(() => null);
  if (
    !body ||
    !Array.isArray(body.added_user_ids) ||
    body.added_user_ids.length === 0 ||
    typeof body.album_name !== "string" ||
    typeof body.album_slug !== "string"
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { added_user_ids, album_name, album_slug } = body as {
    added_user_ids: string[];
    album_name: string;
    album_slug: string;
  };

  // 2b. Validate UUID format and enforce length limit to prevent abuse
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (added_user_ids.length > 10) {
    return NextResponse.json(
      { error: "Too many collaborators (max 10 per request)" },
      { status: 400 }
    );
  }
  if (!added_user_ids.every((id) => typeof id === "string" && UUID_RE.test(id))) {
    return NextResponse.json(
      { error: "Invalid user ID format" },
      { status: 400 }
    );
  }

  // 3. Load album and verify ownership
  const { data: album, error: albumError } = await supabase
    .from("gallery_albums")
    .select("created_by")
    .eq("id", albumId)
    .single();

  if (albumError || !album) {
    return NextResponse.json({ error: "Album not found" }, { status: 404 });
  }

  const isAdmin = user.app_metadata?.role === "admin";
  if (album.created_by !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Derive actor display name from session user
  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const actorName = actorProfile?.full_name || user.email || "Someone";

  // 5. Create pending invites + notifications + emails for each collaborator
  const albumLink = `/gallery/${album_slug}?albumId=${albumId}`;
  const serviceClient = getServiceRoleClient();
  const results: Array<{ userId: string; success: boolean; error?: string }> = [];

  for (const userId of added_user_ids) {
    // 5a. Create or update the invite row (pending status)
    //     If a previous invite exists (e.g. declined), reset to pending for re-invite
    const { error: inviteError } = await (serviceClient as any)
      .from("gallery_collaboration_invites")
      .upsert({
        album_id: albumId,
        invitee_id: userId,
        invited_by: user.id,
        status: "pending",
        responded_at: null,
        created_at: new Date().toISOString(),
      }, { onConflict: "album_id,invitee_id" });

    if (inviteError) {
      console.error(`[notify-collaborators] Invite creation failed for ${userId}:`, inviteError.message);
      results.push({ userId, success: false, error: "invite_creation_failed" });
      continue;
    }

    // 5b. Fetch collaborator profile name and resolve email
    const { data: collabProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    const collabName = collabProfile?.full_name || "there";
    const { email: collabEmail, source: emailSource } = await resolveInviteeEmail(serviceClient, supabase, userId);

    // Diagnostic logging for email delivery debugging
    const maskedEmail = collabEmail
      ? `${collabEmail[0]}***@${collabEmail.split("@")[1] || "?"}`
      : "NONE";
    console.log(`[notify-collaborators] user=${userId} email=${maskedEmail} source=${emailSource}`);

    const notifMessage = `${actorName} invited you to collaborate on the album "${album_name}".`;

    // 5c. Build email content with Accept/Decline/Preview links (only if we have an email)
    let emailPayload: {
      to: string;
      subject: string;
      html: string;
      text: string;
      templateName: string;
    } | undefined;

    if (collabEmail) {
      const emailData = getCollaboratorInvitedEmail({
        inviteeName: collabName,
        actorName,
        albumName: album_name,
        albumSlug: album_slug,
        albumId,
      });

      emailPayload = {
        to: collabEmail,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        templateName: "collaboratorInvited",
      };
    } else {
      console.log(`[notify-collaborators] No email for user ${userId}, skipping email (notification only)`);
    }

    // 5d. Send notification (always) + preference-gated email (only if we have a payload)
    if (emailPayload) {
      const { notificationCreated, skipReason } = await sendEmailWithPreferences({
        supabase,
        userId,
        templateKey: "collaboratorInvited",
        payload: emailPayload,
        notification: {
          type: "gallery_collaborator_invite",
          title: "Collaboration invite",
          message: notifMessage,
          link: albumLink,
        },
      });

      if (!notificationCreated) {
        console.error(`[notify-collaborators] Notification failed for user ${userId}`);
        results.push({ userId, success: false, error: "notification_failed" });
      } else {
        if (skipReason) {
          console.log(`[notify-collaborators] Email skipped for ${userId}: ${skipReason}`);
        } else {
          console.log(`[notify-collaborators] Email sent for ${userId}`);
        }
        results.push({ userId, success: true });
      }
    } else {
      // No email address — just create the in-app notification
      const { error: notifError } = await supabase.rpc("create_user_notification", {
        p_user_id: userId,
        p_type: "gallery_collaborator_invite",
        p_title: "Collaboration invite",
        p_message: notifMessage,
        p_link: albumLink,
      });

      if (notifError) {
        console.error(`[notify-collaborators] Notification-only failed for user ${userId}:`, notifError.message);
        results.push({ userId, success: false, error: "notification_failed" });
      } else {
        results.push({ userId, success: true });
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}

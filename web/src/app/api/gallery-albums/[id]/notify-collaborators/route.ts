/**
 * POST /api/gallery-albums/[id]/notify-collaborators
 *
 * Creates in-app dashboard notifications and sends preference-gated emails
 * for newly added gallery album collaborators.
 * Called by AlbumManager after successful save + reconcile.
 *
 * Auth: caller must be album.created_by or admin.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getCollaboratorAddedEmail } from "@/lib/email/templates/collaboratorAdded";

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

  // 5. Send in-app notification + preference-gated email for each collaborator
  const albumLink = `/gallery/${album_slug}?albumId=${albumId}`;
  const serviceClient = getServiceRoleClient();
  const results: Array<{ userId: string; success: boolean; error?: string }> = [];

  for (const userId of added_user_ids) {
    // Fetch collaborator profile name and email for email sending
    const { data: collabProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    const { data: collabAuth } = await serviceClient.auth.admin.getUserById(userId);
    const collabEmail = collabAuth?.user?.email;
    const collabName = collabProfile?.full_name || "there";

    const notifMessage = `${actorName} added you as a collaborator on the album "${album_name}".`;

    // Build email content
    const emailData = getCollaboratorAddedEmail({
      collaboratorName: collabName,
      albumName: album_name,
      albumSlug: album_slug,
    });

    const { notificationCreated, emailSent, skipReason } = await sendEmailWithPreferences({
      supabase,
      userId,
      templateKey: "collaboratorAdded",
      payload: collabEmail ? {
        to: collabEmail,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        templateName: "collaboratorAdded",
      } : {
        to: "",
        subject: "",
        html: "",
        text: "",
      },
      notification: {
        type: "gallery_collaborator_added",
        title: "Added as a collaborator",
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
      }
      results.push({ userId, success: true });
    }
  }

  return NextResponse.json({ ok: true, results });
}

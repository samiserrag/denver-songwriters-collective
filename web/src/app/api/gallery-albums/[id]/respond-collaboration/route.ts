/**
 * POST /api/gallery-albums/[id]/respond-collaboration
 *
 * Allows an invited collaborator to accept or decline a gallery album
 * collaboration invite.
 *
 * Accept: marks invite as accepted + creates gallery_album_links row
 * Decline: marks invite as declined, no link row created
 *
 * Auth: requires authenticated user who is the invitee.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/serviceRoleClient";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: albumId } = await params;

  // 1. Validate album ID
  if (!UUID_RE.test(albumId)) {
    return NextResponse.json({ error: "Invalid album ID" }, { status: 400 });
  }

  // 2. Authenticate
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parse response from body
  const body = await request.json().catch(() => null);
  const response = body?.response;

  if (!response || !["accepted", "declined"].includes(response)) {
    return NextResponse.json(
      { error: "Invalid response. Must be 'accepted' or 'declined'." },
      { status: 400 }
    );
  }

  // 4. Find the pending invite for this user and album
  const serviceClient = getServiceRoleClient();

  const { data: invite, error: findError } = await (serviceClient as any)
    .from("gallery_collaboration_invites")
    .select("id, status")
    .eq("album_id", albumId)
    .eq("invitee_id", user.id)
    .single();

  if (findError || !invite) {
    return NextResponse.json(
      { error: "No collaboration invite found for this album" },
      { status: 404 }
    );
  }

  if (invite.status !== "pending") {
    return NextResponse.json(
      { error: `Invite already ${invite.status}` },
      { status: 409 }
    );
  }

  // 5. Update invite status
  const { error: updateError } = await (serviceClient as any)
    .from("gallery_collaboration_invites")
    .update({
      status: response,
      responded_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (updateError) {
    console.error("[respond-collaboration] Update error:", updateError.message);
    return NextResponse.json(
      { error: "Failed to update invite" },
      { status: 500 }
    );
  }

  // 6. If accepted, create the gallery_album_links row
  if (response === "accepted") {
    const { error: linkError } = await (serviceClient as any)
      .from("gallery_album_links")
      .insert({
        album_id: albumId,
        target_type: "profile",
        target_id: user.id,
        link_role: "collaborator",
      });

    if (linkError) {
      // If link already exists (e.g. race condition), that's fine
      if (!linkError.message?.includes("duplicate key")) {
        console.error("[respond-collaboration] Link creation error:", linkError.message);
        return NextResponse.json(
          { error: "Failed to create collaboration link" },
          { status: 500 }
        );
      }
    }

    // 7. Transition the invite notification to "collaborator_added" so "Remove myself" is available
    //    Match on user_id + type + link containing the albumId
    const { error: notifError } = await (serviceClient as any)
      .from("notifications")
      .update({
        type: "gallery_collaborator_added",
        title: "Collaboration accepted",
      })
      .eq("user_id", user.id)
      .eq("type", "gallery_collaborator_invite")
      .like("link", `%${albumId}%`);

    if (notifError) {
      console.warn("[respond-collaboration] Notification transition failed:", notifError.message);
      // Non-blocking — the accept still succeeded
    }
  }

  return NextResponse.json({ ok: true, status: response });
}

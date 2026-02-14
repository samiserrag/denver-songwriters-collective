/**
 * POST /api/gallery-albums/[id]/remove-collaborator
 *
 * Allows the album owner or admin to remove a collaborator.
 * Deletes the gallery_album_links row and marks the invite as declined.
 *
 * Auth: caller must be album.created_by or admin.
 * Body: { invitee_id: string }
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

  // 3. Parse body
  const body = await request.json().catch(() => null);
  const inviteeId = body?.invitee_id;

  if (!inviteeId || typeof inviteeId !== "string" || !UUID_RE.test(inviteeId)) {
    return NextResponse.json({ error: "Invalid invitee_id" }, { status: 400 });
  }

  // 4. Verify ownership
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

  const serviceClient = getServiceRoleClient();

  // 5. Delete the collaborator link row (if it exists)
  await (serviceClient as any)
    .from("gallery_album_links")
    .delete()
    .eq("album_id", albumId)
    .eq("target_type", "profile")
    .eq("target_id", inviteeId)
    .eq("link_role", "collaborator");

  // 6. Mark invite as declined (or delete it)
  await (serviceClient as any)
    .from("gallery_collaboration_invites")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("album_id", albumId)
    .eq("invitee_id", inviteeId);

  return NextResponse.json({ ok: true });
}

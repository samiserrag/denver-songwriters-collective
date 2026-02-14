/**
 * POST /api/gallery-albums/[id]/leave-collaboration
 *
 * Allows an accepted collaborator to remove themselves from a gallery album.
 * Deletes the gallery_album_links row and marks the invite as declined.
 * Only removes 'collaborator' role rows — does not affect creator/owner links.
 *
 * Auth: requires authenticated user.
 */

import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: albumId } = await params;

  // 1. Validate album ID format
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

  const serviceClient = getServiceRoleClient();

  // 3. Delete the collaborator link row
  const { data, error } = await (serviceClient as any)
    .from("gallery_album_links")
    .delete()
    .eq("album_id", albumId)
    .eq("target_type", "profile")
    .eq("target_id", user.id)
    .eq("link_role", "collaborator")
    .select("id");

  if (error) {
    console.error("[leave-collaboration] Delete error:", error.message);
    return NextResponse.json(
      { error: "Failed to remove collaboration" },
      { status: 500 }
    );
  }

  // 4. Mark the invite as declined (for audit and re-invite tracking)
  await (serviceClient as any)
    .from("gallery_collaboration_invites")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("album_id", albumId)
    .eq("invitee_id", user.id);

  const removed = (data?.length ?? 0) > 0;
  return NextResponse.json({ removed });
}

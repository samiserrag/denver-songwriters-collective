/**
 * POST /api/gallery-albums/[id]/notify-collaborators
 *
 * Creates in-app dashboard notifications for newly added gallery album
 * collaborators. Called by AlbumManager after successful save + reconcile.
 *
 * Auth: caller must be album.created_by or admin.
 * No email in this route — in-app notification only.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  // 4. Send in-app notification for each added collaborator
  const albumLink = `/gallery/${album_slug}`;
  const results: Array<{ userId: string; success: boolean; error?: string }> = [];

  for (const userId of added_user_ids) {
    const { error: notifError } = await supabase.rpc("create_user_notification", {
      p_user_id: userId,
      p_type: "gallery_collaborator_added",
      p_title: "Added as a collaborator",
      p_message: `You were added as a collaborator on the album "${album_name}".`,
      p_link: albumLink,
    });

    if (notifError) {
      console.error(`[notify-collaborators] Failed for user ${userId}:`, notifError.message);
      results.push({ userId, success: false, error: notifError.message });
    } else {
      results.push({ userId, success: true });
    }
  }

  return NextResponse.json({ ok: true, results });
}

/**
 * POST /api/gallery-albums/[id]/collaborator-edit
 *
 * Allows an accepted collaborator to update a limited set of album fields.
 * Allowed fields: description, youtube_url, spotify_url.
 * All other fields are rejected.
 *
 * Auth: caller must be accepted collaborator (via gallery_album_links) or admin.
 * Album owners should use the direct supabase update or admin route instead.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/serviceRoleClient";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_FIELDS = new Set([
  "description",
  "youtube_url",
  "spotify_url",
]);

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

  // 3. Parse body and validate fields
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Reject any disallowed fields
  const disallowedFields = Object.keys(body).filter((k) => !ALLOWED_FIELDS.has(k));
  if (disallowedFields.length > 0) {
    return NextResponse.json(
      { error: `Disallowed fields: ${disallowedFields.join(", ")}` },
      { status: 403 }
    );
  }

  // Must have at least one field to update
  const updateFields: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      updateFields[field] = body[field];
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // 4. Verify caller is accepted collaborator or admin
  const isAdmin = user.app_metadata?.role === "admin";

  if (!isAdmin) {
    const { data: collabLink } = await supabase
      .from("gallery_album_links")
      .select("album_id")
      .eq("album_id", albumId)
      .eq("target_type", "profile")
      .eq("target_id", user.id)
      .eq("link_role", "collaborator")
      .maybeSingle();

    if (!collabLink) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // 5. Update album (use service client to bypass owner-only RLS UPDATE policy)
  const serviceClient = getServiceRoleClient();
  const { data: updated, error: updateError } = await serviceClient
    .from("gallery_albums")
    .update(updateFields)
    .eq("id", albumId)
    .select("id, name, slug, description, cover_image_url, youtube_url, spotify_url")
    .single();

  if (updateError) {
    console.error("[collaborator-edit] Update error:", updateError.message);
    return NextResponse.json(
      { error: "Failed to update album" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, album: updated });
}

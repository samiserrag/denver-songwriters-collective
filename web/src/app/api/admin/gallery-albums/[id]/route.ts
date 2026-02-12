import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MediaEmbedValidationError, normalizeMediaEmbedUrl } from "@/lib/mediaEmbeds";
import { upsertMediaEmbeds } from "@/lib/mediaEmbedsServer";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return { supabase, user };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Validation failed", fieldErrors: { name: "Album name is required." } }, { status: 400 });
    }
    if (!slug) {
      return NextResponse.json({ error: "Validation failed", fieldErrors: { slug: "Album slug is required." } }, { status: 400 });
    }

    let youtube_url: string | null;
    let spotify_url: string | null;
    try {
      youtube_url = normalizeMediaEmbedUrl(typeof body.youtube_url === "string" ? body.youtube_url : null, {
        expectedProvider: "youtube",
        field: "youtube_url",
      })?.normalized_url ?? null;
      spotify_url = normalizeMediaEmbedUrl(typeof body.spotify_url === "string" ? body.spotify_url : null, {
        expectedProvider: "spotify",
        field: "spotify_url",
      })?.normalized_url ?? null;
    } catch (error) {
      if (error instanceof MediaEmbedValidationError && error.field) {
        return NextResponse.json(
          { error: "Validation failed", fieldErrors: { [error.field]: error.message } },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Invalid media URL" }, { status: 400 });
    }

    const { error: updateError } = await auth.supabase
      .from("gallery_albums")
      .update({
        name,
        slug,
        description: typeof body.description === "string" ? body.description.trim() || null : null,
        youtube_url,
        spotify_url,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Upsert ordered media embeds
    if (Array.isArray(body.media_embed_urls)) {
      try {
        await upsertMediaEmbeds(
          auth.supabase,
          { type: "gallery_album", id },
          body.media_embed_urls as string[],
          auth.user.id
        );
      } catch (err) {
        console.error("[PATCH /api/admin/gallery-albums/[id]] Media embed upsert error:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/gallery-albums/[id] failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

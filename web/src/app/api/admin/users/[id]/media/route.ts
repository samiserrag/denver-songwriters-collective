import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MediaEmbedValidationError, normalizeMediaEmbedUrl } from "@/lib/mediaEmbeds";

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

  return { supabase };
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
      .from("profiles")
      .update({ youtube_url, spotify_url })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/admin/users/[id]/media failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

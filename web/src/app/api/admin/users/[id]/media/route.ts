import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

/** Trim, convert blanks to null, optionally validate against allowed hosts. */
function sanitizeSocialUrl(raw: unknown, allowedHosts?: string[]): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    if (allowedHosts) {
      if (trimmed.includes(".")) {
        return sanitizeSocialUrl(`https://${trimmed}`, allowedHosts);
      }
      return null;
    }
    return trimmed;
  }

  if (allowedHosts) {
    try {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (!allowedHosts.includes(host)) return null;
    } catch {
      return null;
    }
  }
  return trimmed;
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
    const youtube_url = sanitizeSocialUrl(body.youtube_url, ["youtube.com", "youtu.be"]);
    const spotify_url = sanitizeSocialUrl(body.spotify_url, ["open.spotify.com", "spotify.com"]);

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

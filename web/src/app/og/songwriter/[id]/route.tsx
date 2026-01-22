import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderOgCard, type OgChip } from "../../_shared/ogCard";

export const runtime = "edge";

// Check if string is a valid UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Query profile by slug or UUID
  const { data: profile } = isUUID(id)
    ? await supabase
        .from("profiles")
        .select("full_name, bio, avatar_url, city, state, genres, is_songwriter, is_host")
        .eq("id", id)
        .single()
    : await supabase
        .from("profiles")
        .select("full_name, bio, avatar_url, city, state, genres, is_songwriter, is_host")
        .eq("slug", id)
        .single();

  const name = profile?.full_name ?? "Songwriter";
  const location = profile ? [profile.city, profile.state].filter(Boolean).join(", ") : "";
  const genres = profile?.genres?.slice(0, 3) ?? [];
  const avatarUrl = profile?.avatar_url;

  // Determine role label
  const isSongwriter = profile?.is_songwriter ?? true;
  const isHost = profile?.is_host ?? false;
  let kindLabel = "Songwriter";
  if (isSongwriter && isHost) {
    kindLabel = "Songwriter & Host";
  } else if (isHost) {
    kindLabel = "Host";
  }

  // Build chips: genres + location if available
  const chips: OgChip[] = genres.map((genre: string) => ({
    label: genre,
    variant: "gold" as const,
  }));

  // Build subtitle from location
  const subtitle = location || undefined;

  return new ImageResponse(
    renderOgCard({
      title: name,
      subtitle,
      chips,
      imageUrl: avatarUrl,
      fallbackEmoji: "🎤",
      kindLabel,
      kindVariant: isSongwriter ? "gold" : "emerald",
    }),
    {
      width: 1200,
      height: 630,
    }
  );
}

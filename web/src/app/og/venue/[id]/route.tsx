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

  // Query venue by slug or UUID
  const { data: venue } = isUUID(id)
    ? await supabase
        .from("venues")
        .select("name, city, state, neighborhood, cover_image_url")
        .eq("id", id)
        .single()
    : await supabase
        .from("venues")
        .select("name, city, state, neighborhood, cover_image_url")
        .eq("slug", id)
        .single();

  const name = venue?.name ?? "Venue";
  const location = venue ? [venue.city, venue.state].filter(Boolean).join(", ") : "";
  const neighborhood = venue?.neighborhood;
  const coverImage = venue?.cover_image_url;

  // Build subtitle from location and neighborhood
  const subtitleParts = [location, neighborhood].filter(Boolean);
  const subtitle = subtitleParts.join(" · ") || undefined;

  // Build chips
  const chips: OgChip[] = [];

  // Venue type chip
  chips.push({
    label: "Venue",
    variant: "gold",
  });

  return new ImageResponse(
    renderOgCard({
      title: name,
      subtitle,
      chips,
      imageUrl: coverImage,
      fallbackEmoji: "📍",
      kindLabel: "Venue",
      kindVariant: "gold",
      imageFit: "contain",
    }),
    {
      width: 1200,
      height: 630,
    }
  );
}

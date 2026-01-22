import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderOgCard, type OgChip } from "../../_shared/ogCard";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  // Query album by slug
  const { data: album } = await supabase
    .from("gallery_albums")
    .select(`
      name,
      description,
      cover_image_url,
      event:events(title),
      venue:venues(name)
    `)
    .eq("slug", slug)
    .single();

  const name = album?.name ?? "Photo Album";
  const description = album?.description;
  const coverImage = album?.cover_image_url;
  const eventTitle = (album?.event as { title?: string } | null)?.title;
  const venueName = (album?.venue as { name?: string } | null)?.name;

  // Build subtitle from event and venue
  const subtitleParts: string[] = [];
  if (eventTitle) subtitleParts.push(eventTitle);
  if (venueName) subtitleParts.push(`📍 ${venueName}`);
  const subtitle = subtitleParts.join(" — ") || description || undefined;

  // Build chips
  const chips: OgChip[] = [];

  // Gallery type chip
  chips.push({
    label: "Photo Album",
    variant: "gold",
  });

  return new ImageResponse(
    renderOgCard({
      title: name,
      subtitle,
      chips,
      imageUrl: coverImage,
      fallbackEmoji: "📸",
      kindLabel: "Gallery",
      kindVariant: "gold",
    }),
    {
      width: 1200,
      height: 630,
    }
  );
}

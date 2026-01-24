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

  // Query album by slug with related data
  const { data: album } = await supabase
    .from("gallery_albums")
    .select(`
      name,
      description,
      cover_image_url,
      event:events(title),
      venue:venues(name, city),
      creator:profiles!gallery_albums_created_by_fkey(full_name)
    `)
    .eq("slug", slug)
    .single();

  const name = album?.name ?? "Photo Album";
  const description = album?.description;
  const coverImage = album?.cover_image_url;
  const eventTitle = (album?.event as { title?: string } | null)?.title;
  const venueData = album?.venue as { name?: string; city?: string } | null;
  const venueName = venueData?.name;
  const venueCity = venueData?.city;
  const creatorName = (album?.creator as { full_name?: string } | null)?.full_name;

  // Build subtitle from event, venue, and city
  const subtitleParts: string[] = [];
  if (eventTitle) subtitleParts.push(eventTitle);
  if (venueName) {
    const venueStr = venueCity ? `${venueName}, ${venueCity}` : venueName;
    subtitleParts.push(`📍 ${venueStr}`);
  }
  const subtitle = subtitleParts.join(" — ") || description || undefined;

  // Build chips
  const chips: OgChip[] = [];

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
      author: creatorName ? { name: `by ${creatorName}` } : undefined,
    }),
    {
      width: 1200,
      height: 630,
    }
  );
}

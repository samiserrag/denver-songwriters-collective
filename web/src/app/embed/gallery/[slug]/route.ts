import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isExternalEmbedsEnabled } from "@/lib/featureFlags";
import { getSiteUrl } from "@/lib/siteUrl";
import {
  escapeHtml,
  formatDenverDate,
  isSafeHttpUrl,
  parseShow,
  parseTheme,
  parseView,
  renderEmbedCard,
  renderEmbedPage,
  renderStatusCard,
  truncateText,
} from "@/app/embed/_lib/shared";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

type AlbumRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
};

type AlbumImageRecord = {
  image_url: string;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  if (!isExternalEmbedsEnabled()) {
    return renderStatusCard(
      "Embeds temporarily unavailable",
      "External embeds are currently disabled.",
      503
    );
  }

  const { slug: rawSlug } = await context.params;
  const slug = decodeURIComponent(rawSlug);
  const url = new URL(request.url);
  const theme = parseTheme(url.searchParams.get("theme"));
  const view = parseView(url.searchParams.get("view"));
  const show = parseShow(url.searchParams.get("show"));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gallery_albums")
    .select("id, slug, name, description, cover_image_url, created_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("is_hidden", false)
    .single();

  if (error || !data) {
    return renderStatusCard("Album not found", "This gallery album is unavailable.", 404);
  }

  const album = data as AlbumRecord;
  const coverImageUrl = isSafeHttpUrl(album.cover_image_url) ? album.cover_image_url : null;
  const { count: publishedImageCount } = await supabase
    .from("gallery_images")
    .select("id", { count: "exact", head: true })
    .eq("album_id", album.id)
    .eq("is_published", true)
    .eq("is_hidden", false);

  let compactStripHtml = "";
  if (view === "compact") {
    const { data: stripImages } = await supabase
      .from("gallery_images")
      .select("image_url")
      .eq("album_id", album.id)
      .eq("is_published", true)
      .eq("is_hidden", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(3);

    const safeStrip = (stripImages ?? [])
      .map((image) => image as AlbumImageRecord)
      .map((image) => image.image_url)
      .filter((imageUrl) => isSafeHttpUrl(imageUrl));

    if (safeStrip.length > 0) {
      const cells = safeStrip
        .map(
          (imageUrl) =>
            `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(album.name)}" loading="lazy" style="width: 100%; height: 56px; object-fit: contain; border-radius: 8px; background: rgba(255,255,255,0.08);" />`
        )
        .join("");

      compactStripHtml = `<div style="display: grid; grid-template-columns: repeat(${safeStrip.length}, minmax(0, 1fr)); gap: 6px; margin: 0 0 10px;">${cells}</div>`;
    }
  }

  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/gallery/${album.slug}`;
  const createdLabel = formatDenverDate(album.created_at);
  const summary = album.description
    ? truncateText(album.description, view === "compact" ? 130 : 210)
    : "Explore this gallery album on The Colorado Songwriters Collective.";

  const body = renderEmbedCard({
    title: album.name,
    theme,
    view,
    imageUrl: coverImageUrl,
    imageAlt: album.name,
    imagePlaceholder: "Gallery cover unavailable",
    kicker: "CSC Gallery",
    badges: show.has("badges")
      ? [
          "Gallery Album",
          typeof publishedImageCount === "number"
            ? `${publishedImageCount} photo${publishedImageCount === 1 ? "" : "s"}`
            : "",
        ].filter(Boolean)
      : [],
    meta: show.has("meta") ? [createdLabel ? `Created ${createdLabel}` : "Gallery album"] : [],
    summary,
    extraBodyHtml: compactStripHtml,
    ctaHref: show.has("cta") ? canonicalUrl : null,
    ctaLabel: show.has("cta") ? "View on The Colorado Songwriters Collective" : undefined,
  });

  return renderEmbedPage({
    title: `${album.name} - Gallery Embed`,
    body,
    cacheControl: "no-store",
  });
}

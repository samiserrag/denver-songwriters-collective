import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isExternalEmbedsEnabled } from "@/lib/featureFlags";
import { getSiteUrl } from "@/lib/siteUrl";
import {
  escapeHtml,
  isSafeHttpUrl,
  isUuid,
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
  params: Promise<{ id: string }>;
}

type VenueRecord = {
  id: string;
  slug: string | null;
  name: string;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  cover_image_url: string | null;
  website_url: string | null;
  google_maps_url: string | null;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  if (!isExternalEmbedsEnabled()) {
    return renderStatusCard(
      "Embeds temporarily unavailable",
      "External embeds are currently disabled.",
      503
    );
  }

  const { id: rawId } = await context.params;
  const identifier = decodeURIComponent(rawId);
  const url = new URL(request.url);
  const theme = parseTheme(url.searchParams.get("theme"));
  const view = parseView(url.searchParams.get("view"));
  const show = parseShow(url.searchParams.get("show"));

  const supabase = await createSupabaseServerClient();
  const query = supabase
    .from("venues")
    .select("id, slug, name, city, state, neighborhood, cover_image_url, website_url, google_maps_url");

  const { data, error } = isUuid(identifier)
    ? await query.eq("id", identifier).single()
    : await query.eq("slug", identifier).single();

  if (error || !data) {
    return renderStatusCard("Venue not found", "This venue is unavailable or no longer public.", 404);
  }

  const venue = data as VenueRecord;
  const siteUrl = getSiteUrl();
  const canonicalPath = `/venues/${venue.slug || venue.id}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const imageUrl = isSafeHttpUrl(venue.cover_image_url) ? venue.cover_image_url : null;
  const websiteUrl = isSafeHttpUrl(venue.website_url) ? venue.website_url : null;
  const mapsUrl = isSafeHttpUrl(venue.google_maps_url) ? venue.google_maps_url : null;
  const location = [venue.city, venue.state].filter(Boolean).join(", ");

  const badges = show.has("badges")
    ? ["Venue", venue.neighborhood ? `Neighborhood: ${venue.neighborhood}` : ""].filter(Boolean)
    : [];

  const meta = show.has("meta")
    ? [location || "Colorado", venue.neighborhood || ""].filter(Boolean)
    : [];

  const body = renderEmbedCard({
    title: venue.name,
    theme,
    view,
    imageUrl,
    imageAlt: venue.name,
    imagePlaceholder: "Venue image unavailable",
    kicker: "CSC Venue",
    titleHref: websiteUrl,
    badges,
    meta,
    summary: truncateText(
      location
        ? `${venue.name} in ${location}. Browse details and upcoming happenings on The Colorado Songwriters Collective.`
        : `${venue.name} on The Colorado Songwriters Collective.`,
      view === "compact" ? 120 : 190
    ),
    ctaHref: show.has("cta") ? canonicalUrl : null,
    ctaLabel: show.has("cta") ? "View on The Colorado Songwriters Collective" : undefined,
    extraLinks: [
      ...(mapsUrl ? [{ label: "Open map", href: mapsUrl, external: true }] : []),
      ...(websiteUrl ? [{ label: "Visit venue website", href: websiteUrl, external: true }] : []),
    ],
  });

  return renderEmbedPage({
    title: `${escapeHtml(venue.name)} - Venue Embed`,
    body,
    cacheControl: "no-store",
  });
}

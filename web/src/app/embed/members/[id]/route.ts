import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isExternalEmbedsEnabled } from "@/lib/featureFlags";
import { getSiteUrl } from "@/lib/siteUrl";
import {
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

type MemberRecord = {
  id: string;
  slug: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  instruments: string[] | null;
  genres: string[] | null;
  is_songwriter: boolean | null;
  is_host: boolean | null;
  is_studio: boolean | null;
  is_fan: boolean | null;
  is_public: boolean;
};

function getProfilePath(member: MemberRecord): string {
  const identifier = member.slug || member.id;
  if (member.is_studio) return `/studios/${identifier}`;
  if (member.is_songwriter || member.is_host) return `/songwriters/${identifier}`;
  return `/members/${identifier}`;
}

function getIdentityBadges(member: MemberRecord): string[] {
  const badges: string[] = [];
  if (member.is_songwriter) badges.push("Songwriter");
  if (member.is_host) badges.push("Host");
  if (member.is_studio) badges.push("Studio");
  if (member.is_fan) badges.push("Fan");
  if (badges.length === 0) badges.push("Member");
  return badges;
}

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
    .from("profiles")
    .select("id, slug, full_name, bio, avatar_url, city, instruments, genres, is_songwriter, is_host, is_studio, is_fan, is_public")
    .eq("is_public", true);

  const { data, error } = isUuid(identifier)
    ? await query.eq("id", identifier).single()
    : await query.eq("slug", identifier).single();

  if (error || !data) {
    return renderStatusCard("Member not found", "This member is unavailable or not public.", 404);
  }

  const member = data as MemberRecord;
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}${getProfilePath(member)}`;
  const displayName = member.full_name || "Community Member";
  const avatarUrl = isSafeHttpUrl(member.avatar_url) ? member.avatar_url : null;

  const badges = show.has("badges")
    ? [
        ...getIdentityBadges(member),
        ...(member.genres?.slice(0, 2) ?? []),
      ]
    : [];

  const meta = show.has("meta")
    ? [
        member.city || "Colorado",
        ...(member.instruments?.slice(0, 2) ?? []),
      ]
    : [];

  const summarySource =
    member.bio ||
    (member.genres?.length
      ? `Genres: ${member.genres.slice(0, 4).join(", ")}`
      : "Explore this member profile on The Colorado Songwriters Collective.");

  const body = renderEmbedCard({
    title: displayName,
    theme,
    view,
    imageUrl: avatarUrl,
    imageAlt: displayName,
    imagePlaceholder: "Member photo unavailable",
    kicker: "CSC Member",
    badges,
    meta,
    summary: truncateText(summarySource, view === "compact" ? 130 : 210),
    ctaHref: show.has("cta") ? canonicalUrl : null,
    ctaLabel: show.has("cta") ? "View on The Colorado Songwriters Collective" : undefined,
  });

  return renderEmbedPage({
    title: `${displayName} - Member Embed`,
    body,
    cacheControl: "no-store",
  });
}

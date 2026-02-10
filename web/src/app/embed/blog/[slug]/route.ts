import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isExternalEmbedsEnabled } from "@/lib/featureFlags";
import { getSiteUrl } from "@/lib/siteUrl";
import {
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

type BlogRecord = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
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
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_image_url, published_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("is_approved", true)
    .single();

  if (error || !data) {
    return renderStatusCard("Post not found", "This blog post is unavailable.", 404);
  }

  const post = data as BlogRecord;
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/blog/${post.slug}`;
  const coverImageUrl = isSafeHttpUrl(post.cover_image_url) ? post.cover_image_url : null;
  const publishedLabel = formatDenverDate(post.published_at);
  const summary = post.excerpt
    ? truncateText(post.excerpt, view === "compact" ? 140 : 230)
    : "Read this post on The Colorado Songwriters Collective blog.";

  const body = renderEmbedCard({
    title: post.title,
    theme,
    view,
    imageUrl: coverImageUrl,
    imageAlt: post.title,
    imagePlaceholder: "Blog cover unavailable",
    kicker: "CSC Blog",
    badges: show.has("badges") ? ["Blog Post"] : [],
    meta: show.has("meta") ? [publishedLabel || "Published post"] : [],
    summary,
    ctaHref: show.has("cta") ? canonicalUrl : null,
    ctaLabel: show.has("cta") ? "Read on The Colorado Songwriters Collective" : undefined,
  });

  return renderEmbedPage({
    title: `${post.title} - Blog Embed`,
    body,
    cacheControl: "no-store",
  });
}

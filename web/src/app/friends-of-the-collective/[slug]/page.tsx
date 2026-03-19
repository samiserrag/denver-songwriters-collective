import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HeroSection, PageContainer } from "@/components/layout";
import { Button } from "@/components/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { getFriendsOfCollective } from "@/lib/friends-of-the-collective";
import {
  toFriendView,
  type OrganizationContentLinkRecord,
  type OrganizationMemberTagProfile,
  type OrganizationMemberTagRecord,
  type OrganizationRecord,
} from "@/lib/organizations";

const FRIENDS_PAGE_PUBLIC = process.env.NEXT_PUBLIC_FRIENDS_PAGE_PUBLIC === "true";

export const metadata: Metadata = {
  title: "Friend Profile | The Colorado Songwriters Collective",
  description: "Organization profile from Friends of the Collective.",
  robots: "noindex, nofollow",
};

type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
};

type GalleryAlbumSummary = {
  id: string;
  slug: string;
  name: string;
};

type SeriesEventSummary = {
  id: string;
  slug: string | null;
  title: string;
  event_date: string | null;
  event_type: string[] | null;
};

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CSC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getFriendImageUrl(friend: {
  coverImageUrl?: string;
  logoImageUrl?: string;
  websiteUrl: string;
}): string | null {
  if (friend.coverImageUrl) return friend.coverImageUrl;
  if (friend.logoImageUrl) return friend.logoImageUrl;
  try {
    return `https://www.google.com/s2/favicons?sz=256&domain_url=${encodeURIComponent(friend.websiteUrl)}`;
  } catch {
    return null;
  }
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function eventDetailHref(event: SeriesEventSummary): string {
  const identifier = event.slug || event.id;
  const types = Array.isArray(event.event_type) ? event.event_type : [];
  if (types.includes("open_mic")) {
    return `/open-mics/${identifier}`;
  }
  return `/events/${identifier}`;
}

function normalizeProfileRelation(value: unknown): OrganizationMemberTagProfile | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    if (!first || typeof first !== "object") return null;
    return first as OrganizationMemberTagProfile;
  }
  if (typeof value !== "object") return null;
  return value as OrganizationMemberTagProfile;
}

export const dynamic = "force-dynamic";

async function enforcePrivateAccessUntilLaunch() {
  if (FRIENDS_PAGE_PUBLIC) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") notFound();
}

async function loadFriendBySlug(slug: string, isPublicMode: boolean) {
  const serviceClient = createServiceRoleClient();

  let query = (serviceClient as any)
    .from("organizations")
    .select(
      "id, slug, name, website_url, city, organization_type, short_blurb, why_it_matters, tags, featured, is_active, visibility, logo_image_url, cover_image_url, gallery_image_urls, fun_note, sort_order"
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .limit(1);

  if (isPublicMode) {
    query = query.in("visibility", ["public", "unlisted"]);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("Friend profile organization query failed:", error);
    return null;
  }

  if (!data) {
    const fallback = getFriendsOfCollective().find((friend) => friend.id === slug || friend.slug === slug);
    return fallback || null;
  }

  const organization = data as OrganizationRecord;

  const [tagResult, contentLinkResult] = await Promise.all([
    (serviceClient as any)
      .from("organization_member_tags")
      .select(
        "id, organization_id, profile_id, sort_order, tag_reason, created_at, profiles(id, slug, full_name, avatar_url, role, is_public, is_songwriter, is_host, is_studio, is_fan)"
      )
      .eq("organization_id", organization.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    (serviceClient as any)
      .from("organization_content_links")
      .select("id, organization_id, link_type, target_id, sort_order, label_override, created_at")
      .eq("organization_id", organization.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const { data: tagRows } = tagResult;
  const { data: contentLinkRows } = contentLinkResult;

  const memberTags = ((tagRows || []) as Array<Record<string, unknown>>).reduce<
    OrganizationMemberTagRecord[]
  >((acc, raw) => {
      const profile = normalizeProfileRelation(raw.profiles);
      if (!profile) return acc;
      if (isPublicMode && !profile.is_public) return acc;
      acc.push({
        id: String(raw.id),
        organization_id: String(raw.organization_id),
        profile_id: String(raw.profile_id),
        sort_order: Number(raw.sort_order) || 0,
        tag_reason: typeof raw.tag_reason === "string" ? raw.tag_reason : null,
        profile,
      });
      return acc;
    }, []);

  const contentLinks = ((contentLinkRows || []) as Array<Record<string, unknown>>).reduce<
    OrganizationContentLinkRecord[]
  >((acc, raw) => {
      const linkType = raw.link_type;
      const targetId = raw.target_id;
      if (
        (linkType !== "blog_post" && linkType !== "gallery_album" && linkType !== "event_series") ||
        typeof targetId !== "string" ||
        targetId.length === 0
      ) {
        return acc;
      }
      acc.push({
        id: String(raw.id),
        organization_id: String(raw.organization_id),
        link_type: linkType,
        target_id: targetId,
        sort_order: Number(raw.sort_order) || 0,
        label_override: typeof raw.label_override === "string" ? raw.label_override : null,
      });
      return acc;
    }, []);

  const blogIds = Array.from(
    new Set(
      contentLinks
        .filter((link) => link.link_type === "blog_post")
        .map((link) => link.target_id)
        .filter(isUuidLike)
    )
  );
  const galleryIds = Array.from(
    new Set(
      contentLinks
        .filter((link) => link.link_type === "gallery_album")
        .map((link) => link.target_id)
        .filter(isUuidLike)
    )
  );
  const seriesIds = Array.from(
    new Set(
      contentLinks
        .filter((link) => link.link_type === "event_series")
        .map((link) => link.target_id)
        .filter(isUuidLike)
    )
  );

  const [blogResult, galleryResult, seriesEventResult] = await Promise.all([
    blogIds.length > 0
      ? (async () => {
          let blogQuery = (serviceClient as any)
            .from("blog_posts")
            .select("id, slug, title, is_published")
            .in("id", blogIds);
          if (isPublicMode) blogQuery = blogQuery.eq("is_published", true);
          return blogQuery;
        })()
      : Promise.resolve({ data: [], error: null }),
    galleryIds.length > 0
      ? (async () => {
          let galleryQuery = (serviceClient as any)
            .from("gallery_albums")
            .select("id, slug, name, is_published, is_hidden")
            .in("id", galleryIds);
          if (isPublicMode) {
            galleryQuery = galleryQuery.eq("is_published", true).eq("is_hidden", false);
          }
          return galleryQuery;
        })()
      : Promise.resolve({ data: [], error: null }),
    seriesIds.length > 0
      ? (async () => {
          let seriesQuery = (serviceClient as any)
            .from("events")
            .select("id, slug, series_id, title, event_date, event_type, is_published, visibility")
            .in("series_id", seriesIds);
          if (isPublicMode) {
            seriesQuery = seriesQuery.eq("is_published", true).eq("visibility", "public");
          }
          return seriesQuery;
        })()
      : Promise.resolve({ data: [], error: null }),
  ]);

  const blogById = new Map<string, BlogPostSummary>();
  for (const row of ((blogResult.data || []) as Array<Record<string, unknown>>)) {
    const id = typeof row.id === "string" ? row.id : null;
    const rowSlug = typeof row.slug === "string" ? row.slug : null;
    const title = typeof row.title === "string" ? row.title : null;
    if (!id || !rowSlug || !title) continue;
    blogById.set(id, { id, slug: rowSlug, title });
  }

  const galleryById = new Map<string, GalleryAlbumSummary>();
  for (const row of ((galleryResult.data || []) as Array<Record<string, unknown>>)) {
    const id = typeof row.id === "string" ? row.id : null;
    const rowSlug = typeof row.slug === "string" ? row.slug : null;
    const name = typeof row.name === "string" ? row.name : null;
    if (!id || !rowSlug || !name) continue;
    galleryById.set(id, { id, slug: rowSlug, name });
  }

  const eventsBySeries = new Map<string, SeriesEventSummary[]>();
  for (const row of ((seriesEventResult.data || []) as Array<Record<string, unknown>>)) {
    const seriesId = typeof row.series_id === "string" ? row.series_id : null;
    const id = typeof row.id === "string" ? row.id : null;
    const title = typeof row.title === "string" ? row.title : null;
    if (!seriesId || !id || !title) continue;

    const event: SeriesEventSummary = {
      id,
      slug: typeof row.slug === "string" ? row.slug : null,
      title,
      event_date: typeof row.event_date === "string" ? row.event_date : null,
      event_type: Array.isArray(row.event_type)
        ? row.event_type.filter((item): item is string => typeof item === "string")
        : null,
    };

    const list = eventsBySeries.get(seriesId) || [];
    list.push(event);
    eventsBySeries.set(seriesId, list);
  }

  const todayDateKey = new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });
  for (const [seriesId, list] of eventsBySeries.entries()) {
    eventsBySeries.set(
      seriesId,
      [...list].sort((a, b) => {
        if (!a.event_date && !b.event_date) return 0;
        if (!a.event_date) return 1;
        if (!b.event_date) return -1;
        return a.event_date.localeCompare(b.event_date);
      })
    );
  }

  const base = toFriendView({
    ...organization,
    member_tags: memberTags,
    content_links: contentLinks,
  });

  const relatedBlogPosts = contentLinks
    .filter((link) => link.link_type === "blog_post")
    .map((link) => {
      const blog = blogById.get(link.target_id);
      if (!blog) return null;
      return {
        id: blog.id,
        title: link.label_override || blog.title,
        href: `/blog/${blog.slug}`,
      };
    })
    .filter((item): item is { id: string; title: string; href: string } => item !== null);

  const relatedGalleryAlbums = contentLinks
    .filter((link) => link.link_type === "gallery_album")
    .map((link) => {
      const gallery = galleryById.get(link.target_id);
      if (!gallery) return null;
      return {
        id: gallery.id,
        name: link.label_override || gallery.name,
        href: `/gallery/${gallery.slug}`,
      };
    })
    .filter((item): item is { id: string; name: string; href: string } => item !== null);

  const relatedEventSeries = contentLinks
    .filter((link) => link.link_type === "event_series")
    .map((link) => {
      const seriesEvents = eventsBySeries.get(link.target_id) || [];
      if (seriesEvents.length === 0) return null;
      const nextUpcoming =
        seriesEvents.find((event) => event.event_date && event.event_date >= todayDateKey) || seriesEvents[0];
      return {
        seriesId: link.target_id,
        title: link.label_override || nextUpcoming.title,
        href: eventDetailHref(nextUpcoming),
        nextDate: nextUpcoming.event_date || undefined,
      };
    })
    .filter(
      (item): item is { seriesId: string; title: string; href: string; nextDate: string | undefined } =>
        item !== null
    );

  return {
    ...base,
    relatedBlogPosts,
    relatedGalleryAlbums,
    relatedEventSeries,
  };
}

export default async function FriendOrganizationProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await enforcePrivateAccessUntilLaunch();

  const { slug } = await params;
  const friend = await loadFriendBySlug(slug, FRIENDS_PAGE_PUBLIC);
  if (!friend) notFound();

  const imageUrl = getFriendImageUrl(friend);

  return (
    <>
      <HeroSection minHeight="sm" showVignette showBottomFade>
        <div className="text-center px-6 py-8">
          <p className="text-xs uppercase tracking-wide text-white/80 mb-2">Friends of the Collective</p>
          <h1 className="font-[var(--font-family-display)] font-bold text-4xl md:text-5xl text-white tracking-tight mb-3 drop-shadow-lg">
            {friend.name}
          </h1>
          <p className="text-base md:text-lg text-white/85 max-w-3xl mx-auto">
            {friend.organizationType || "Community Organization"}
            {friend.city ? ` • ${friend.city}` : ""}
          </p>
        </div>
      </HeroSection>

      <PageContainer>
        <div className="py-10 space-y-8 max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="secondary" size="sm">
              <Link href="/friends-of-the-collective">Back to Directory</Link>
            </Button>
            <span className="text-xs text-[var(--color-text-tertiary)]">{hostnameFromUrl(friend.websiteUrl)}</span>
          </div>

          <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6">
            <div className="lg:col-span-2">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={`${friend.name} cover`}
                  className="w-full h-56 object-cover rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-56 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                  <span className="text-sm text-[var(--color-text-tertiary)]">Image coming soon</span>
                </div>
              )}
            </div>
            <div className="lg:col-span-3 space-y-4">
              <p className="text-[var(--color-text-secondary)] leading-relaxed">{friend.shortBlurb}</p>
              <p className="text-[var(--color-text-primary)] leading-relaxed">{friend.whyItMatters}</p>
              {friend.funNote && (
                <p className="text-sm italic text-[var(--color-text-secondary)]">{friend.funNote}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="primary" size="sm">
                  <a href={friend.websiteUrl} target="_blank" rel="noopener noreferrer">
                    Visit Organization Site
                  </a>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/my-organizations">
                    Claim or update this organization profile
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {friend.tags && friend.tags.length > 0 && (
            <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-3">
              <h2 className="text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                Focus Areas
              </h2>
              <div className="flex flex-wrap gap-2">
                {friend.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full text-xs border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {friend.memberTags && friend.memberTags.length > 0 && (
            <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-4">
              <h2 className="text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                Connected Members
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {friend.memberTags.map((tag) => (
                  <Link
                    key={`${friend.id}-${tag.profileId}`}
                    href={tag.profileUrl}
                    className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] p-3 hover:border-[var(--color-border-accent)]"
                  >
                    <div className="flex items-center gap-3">
                      {tag.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tag.avatarUrl}
                          alt={tag.name}
                          className="h-10 w-10 rounded-full object-cover border border-[var(--color-border-default)]"
                          loading="lazy"
                        />
                      ) : (
                        <span className="h-10 w-10 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-text-secondary)] flex items-center justify-center">
                          {getInitials(tag.name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{tag.name}</p>
                        {tag.tagReason && (
                          <p className="text-xs text-[var(--color-text-secondary)] truncate">{tag.tagReason}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {!!(
            (friend.relatedBlogPosts && friend.relatedBlogPosts.length > 0) ||
            (friend.relatedGalleryAlbums && friend.relatedGalleryAlbums.length > 0) ||
            (friend.relatedEventSeries && friend.relatedEventSeries.length > 0)
          ) && (
            <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-5">
              <h2 className="text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                Related on CSC
              </h2>

              {friend.relatedBlogPosts && friend.relatedBlogPosts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Blog Posts</p>
                  <div className="flex flex-wrap gap-2">
                    {friend.relatedBlogPosts.map((post) => (
                      <Link
                        key={`${friend.id}-blog-${post.id}`}
                        href={post.href}
                        className="inline-flex items-center px-2.5 py-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)]"
                      >
                        {post.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {friend.relatedGalleryAlbums && friend.relatedGalleryAlbums.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">Gallery Albums</p>
                  <div className="flex flex-wrap gap-2">
                    {friend.relatedGalleryAlbums.map((album) => (
                      <Link
                        key={`${friend.id}-gallery-${album.id}`}
                        href={album.href}
                        className="inline-flex items-center px-2.5 py-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)]"
                      >
                        {album.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {friend.relatedEventSeries && friend.relatedEventSeries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    Hosted Happenings Series
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {friend.relatedEventSeries.map((series) => (
                      <Link
                        key={`${friend.id}-series-${series.seriesId}`}
                        href={series.href}
                        className="inline-flex items-center px-2.5 py-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)]"
                      >
                        {series.title}
                        {series.nextDate ? ` · ${series.nextDate}` : ""}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {friend.galleryImageUrls && friend.galleryImageUrls.length > 0 && (
            <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-4">
              <h2 className="text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                Gallery
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {friend.galleryImageUrls.map((url, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${friend.id}-gallery-image-${index}`}
                    src={url}
                    alt={`${friend.name} gallery image ${index + 1}`}
                    className="w-full h-36 object-cover rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
                    loading="lazy"
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </PageContainer>
    </>
  );
}

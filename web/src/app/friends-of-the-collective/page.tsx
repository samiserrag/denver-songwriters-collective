import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFriendsOfCollective } from "@/lib/friends-of-the-collective";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import {
  toFriendView,
  type OrganizationContentLinkRecord,
  type OrganizationRecord,
  type OrganizationMemberTagRecord,
  type OrganizationMemberTagProfile,
} from "@/lib/organizations";

const FRIENDS_PAGE_PUBLIC = process.env.NEXT_PUBLIC_FRIENDS_PAGE_PUBLIC === "true";

export const metadata: Metadata = {
  title: "Friends of the Collective | The Colorado Songwriters Collective",
  description:
    "A growing directory of Colorado organizations, collectives, and community spaces that support songwriters.",
  robots: "noindex, nofollow",
};

type FeaturedHostMember = {
  id: string;
  slug: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  host_spotlight_reason: string | null;
  role: string | null;
  is_songwriter: boolean | null;
  is_host: boolean | null;
  is_studio: boolean | null;
  is_fan: boolean | null;
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
  series_id: string | null;
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

function friendProfileHref(friend: { slug?: string; id: string }): string {
  return `/friends-of-the-collective/${friend.slug || friend.id}`;
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

function profileHref(profile: {
  id: string;
  slug: string | null;
  role: string | null;
  is_songwriter: boolean | null;
  is_host: boolean | null;
  is_studio: boolean | null;
}): string {
  const identifier = profile.slug || profile.id;
  if (profile.is_studio || profile.role === "studio") return `/studios/${identifier}`;
  if (profile.is_songwriter || profile.is_host || profile.role === "performer" || profile.role === "host") {
    return `/songwriters/${identifier}`;
  }
  return `/members/${identifier}`;
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

async function loadFeaturedHostMembers(): Promise<FeaturedHostMember[]> {
  const serviceClient = createServiceRoleClient();
  const { data, error } = await (serviceClient as any)
    .from("profiles")
    .select(
      "id, slug, full_name, avatar_url, bio, host_spotlight_reason, role, is_songwriter, is_host, is_studio, is_fan"
    )
    .eq("is_featured", true)
    .eq("spotlight_type", "host")
    .eq("is_public", true)
    .order("featured_rank", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Featured host members query failed:", error);
    return [];
  }

  return (data || []) as FeaturedHostMember[];
}

async function loadOrganizationsForPage(isPublicMode: boolean) {
  const serviceClient = createServiceRoleClient();
  let query = (serviceClient as any)
    .from("organizations")
    .select(
      "id, slug, name, website_url, city, organization_type, short_blurb, why_it_matters, tags, featured, is_active, visibility, logo_image_url, cover_image_url, gallery_image_urls, fun_note, sort_order"
    )
    .eq("is_active", true)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (isPublicMode) {
    query = query.eq("visibility", "public");
  }

  const { data: organizationRows, error: organizationError } = await query;
  if (organizationError) {
    console.error("Friends organizations query failed, using fallback:", organizationError);
    return getFriendsOfCollective();
  }

  const organizations = (organizationRows || []) as OrganizationRecord[];
  if (organizations.length === 0) return [];

  const organizationIds = organizations.map((row) => row.id);
  const [tagResult, contentLinkResult] = await Promise.all([
    (serviceClient as any)
      .from("organization_member_tags")
      .select(
        "id, organization_id, profile_id, sort_order, tag_reason, created_at, profiles(id, slug, full_name, avatar_url, role, is_public, is_songwriter, is_host, is_studio, is_fan)"
      )
      .in("organization_id", organizationIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    (serviceClient as any)
      .from("organization_content_links")
      .select("id, organization_id, link_type, target_id, sort_order, label_override, created_at")
      .in("organization_id", organizationIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const { data: tagRows, error: tagError } = tagResult;
  const { data: contentLinkRows, error: contentLinkError } = contentLinkResult;

  if (tagError) console.error("Organization member tags query failed:", tagError);
  if (contentLinkError) console.error("Organization content links query failed:", contentLinkError);

  const tagsByOrganization = new Map<string, OrganizationMemberTagRecord[]>();
  for (const raw of ((tagRows || []) as Array<Record<string, unknown>>)) {
    const organizationId = raw.organization_id;
    if (typeof organizationId !== "string") continue;

    const profile = normalizeProfileRelation(raw.profiles);
    if (!profile) continue;
    if (isPublicMode && !profile.is_public) continue;

    const tag: OrganizationMemberTagRecord = {
      id: String(raw.id),
      organization_id: organizationId,
      profile_id: String(raw.profile_id),
      sort_order: Number(raw.sort_order) || 0,
      tag_reason: typeof raw.tag_reason === "string" ? raw.tag_reason : null,
      profile,
    };

    const list = tagsByOrganization.get(organizationId) || [];
    list.push(tag);
    tagsByOrganization.set(organizationId, list);
  }

  const contentLinksByOrganization = new Map<string, OrganizationContentLinkRecord[]>();
  for (const raw of ((contentLinkRows || []) as Array<Record<string, unknown>>)) {
    const organizationId = raw.organization_id;
    if (typeof organizationId !== "string") continue;

    const linkType = raw.link_type;
    const targetId = raw.target_id;
    if (
      (linkType !== "blog_post" && linkType !== "gallery_album" && linkType !== "event_series") ||
      typeof targetId !== "string" ||
      targetId.length === 0
    ) {
      continue;
    }

    const link: OrganizationContentLinkRecord = {
      id: String(raw.id),
      organization_id: organizationId,
      link_type: linkType,
      target_id: targetId,
      sort_order: Number(raw.sort_order) || 0,
      label_override: typeof raw.label_override === "string" ? raw.label_override : null,
    };

    const list = contentLinksByOrganization.get(organizationId) || [];
    list.push(link);
    contentLinksByOrganization.set(organizationId, list);
  }

  const withTags = organizations.map((organization) => ({
    ...organization,
    member_tags: tagsByOrganization.get(organization.id) || [],
    content_links: contentLinksByOrganization.get(organization.id) || [],
  }));

  const allContentLinks = withTags.flatMap((organization) => organization.content_links || []);
  const blogIds = Array.from(
    new Set(
      allContentLinks
        .filter((link) => link.link_type === "blog_post")
        .map((link) => link.target_id)
        .filter(isUuidLike)
    )
  );
  const galleryIds = Array.from(
    new Set(
      allContentLinks
        .filter((link) => link.link_type === "gallery_album")
        .map((link) => link.target_id)
        .filter(isUuidLike)
    )
  );
  const seriesIds = Array.from(
    new Set(
      allContentLinks
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

  if (blogResult.error) console.error("Organization linked blog posts query failed:", blogResult.error);
  if (galleryResult.error) console.error("Organization linked gallery query failed:", galleryResult.error);
  if (seriesEventResult.error) {
    console.error("Organization linked series query failed:", seriesEventResult.error);
  }

  const blogById = new Map<string, BlogPostSummary>();
  for (const row of ((blogResult.data || []) as Array<Record<string, unknown>>)) {
    const id = typeof row.id === "string" ? row.id : null;
    const slug = typeof row.slug === "string" ? row.slug : null;
    const title = typeof row.title === "string" ? row.title : null;
    if (!id || !slug || !title) continue;
    blogById.set(id, { id, slug, title });
  }

  const galleryById = new Map<string, GalleryAlbumSummary>();
  for (const row of ((galleryResult.data || []) as Array<Record<string, unknown>>)) {
    const id = typeof row.id === "string" ? row.id : null;
    const slug = typeof row.slug === "string" ? row.slug : null;
    const name = typeof row.name === "string" ? row.name : null;
    if (!id || !slug || !name) continue;
    galleryById.set(id, { id, slug, name });
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
      series_id: seriesId,
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

  return withTags.map((organization) => {
    const base = toFriendView(organization);
    const contentLinks = [...(organization.content_links || [])].sort(
      (a, b) => a.sort_order - b.sort_order
    );

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
          seriesEvents.find((event) => event.event_date && event.event_date >= todayDateKey) ||
          seriesEvents[0];
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
  });
}

export default async function FriendsOfTheCollectivePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await enforcePrivateAccessUntilLaunch();

  const resolvedSearchParams = await searchParams;
  const currentView = resolvedSearchParams.view === "card" ? "card" : "list";

  const [friends, featuredHosts] = await Promise.all([
    loadOrganizationsForPage(FRIENDS_PAGE_PUBLIC),
    loadFeaturedHostMembers(),
  ]);

  const alphabetical = [...friends].sort((a, b) => a.name.localeCompare(b.name));
  const featured = friends.filter((friend) => friend.featured);
  const standard = friends.filter((friend) => !friend.featured);

  function renderFriendCard(friend: (typeof friends)[number], isFeatured: boolean) {
    const imageUrl = getFriendImageUrl(friend);

    return (
      <article
        key={friend.id}
        className={`rounded-2xl border bg-[var(--color-bg-secondary)] p-6 space-y-4 ${
          isFeatured
            ? "border-[var(--color-border-accent)]/40"
            : "border-[var(--color-border-default)]"
        }`}
      >
        <div className="space-y-1">
          <h3 className="text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
            {friend.name}
          </h3>
          <p className="text-xs tracking-wide uppercase text-[var(--color-text-tertiary)]">
            {friend.organizationType || "Community Organization"}
            {friend.city ? ` • ${friend.city}` : ""}
          </p>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{friend.shortBlurb}</p>

        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`${friend.name} cover`}
            className="w-full h-36 object-cover rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-36 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] flex items-center justify-center">
            <span className="text-sm text-[var(--color-text-tertiary)]">Image coming soon</span>
          </div>
        )}

        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{friend.whyItMatters}</p>

        {friend.funNote && (
          <p className="text-sm italic text-[var(--color-text-secondary)]">{friend.funNote}</p>
        )}

        {friend.tags && friend.tags.length > 0 && (
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
        )}

        {friend.memberTags && friend.memberTags.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Connected Members
            </p>
            <div className="flex flex-wrap gap-2">
              {friend.memberTags.map((tag) => (
                <Link
                  key={`${friend.id}-${tag.profileId}`}
                  href={tag.profileUrl}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-accent)]"
                  title={tag.tagReason || tag.name}
                >
                  {tag.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tag.avatarUrl}
                      alt={tag.name}
                      className="h-5 w-5 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="h-5 w-5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[10px] font-semibold text-[var(--color-text-secondary)] flex items-center justify-center">
                      {getInitials(tag.name)}
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-text-secondary)]">{tag.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!!(
          (friend.relatedBlogPosts && friend.relatedBlogPosts.length > 0) ||
          (friend.relatedGalleryAlbums && friend.relatedGalleryAlbums.length > 0) ||
          (friend.relatedEventSeries && friend.relatedEventSeries.length > 0)
        ) && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Related on CSC
            </p>

            {friend.relatedBlogPosts && friend.relatedBlogPosts.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Blog Posts
                </p>
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
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Gallery Albums
                </p>
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
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
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
          </div>
        )}

        <div className="pt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={friendProfileHref(friend)}
              className="text-sm text-[var(--color-text-accent)] hover:underline"
            >
              View Profile
            </Link>
            <a
              href={friend.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--color-text-accent)] hover:underline"
            >
              Visit Site
            </a>
          </div>
          <span className="text-xs text-[var(--color-text-tertiary)]">{hostnameFromUrl(friend.websiteUrl)}</span>
        </div>

        <div className="pt-1">
          <Link
            href="/dashboard/my-organizations"
            className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-accent)] underline-offset-2 hover:underline"
          >
            Represent this organization? Claim or update this profile.
          </Link>
        </div>
      </article>
    );
  }

  return (
    <>
      <HeroSection minHeight="sm" showVignette showBottomFade>
        <div className="text-center px-6 py-8">
          <h1 className="font-[var(--font-family-display)] font-bold text-4xl md:text-5xl lg:text-6xl text-white tracking-tight mb-3 drop-shadow-lg">
            Friends of the Collective
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-2 max-w-3xl mx-auto drop-shadow">
            A living list of Colorado organizations and communities that help songwriters grow, connect, and stay visible.
          </p>
          <p className="text-sm md:text-base text-white/80 max-w-3xl mx-auto">
            This page celebrates collaborators. It is not a ranking.
          </p>
        </div>
      </HeroSection>

      <PageContainer>
        <div className="py-10 space-y-10 max-w-6xl mx-auto">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5">
              <h2 className="text-lg font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] mb-2">
                Why This Exists
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Songwriters need an ecosystem, not just one stage. We want to recognize the people and organizations doing that work across Colorado.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5">
              <h2 className="text-lg font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] mb-2">
                How We Curate
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                We prioritize organizations that consistently create opportunities, education, connection, and real support for songwriters.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5">
              <h2 className="text-lg font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] mb-2">
                Suggest an Addition
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">
                Know an organization we should include? Send it to us and we will review it.
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link href="/feedback">Suggest an Organization</Link>
              </Button>
            </div>
          </section>

          {featuredHosts.length > 0 && (
            <section className="space-y-5">
              <h2 className="text-2xl md:text-3xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                Featured Host Members
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {featuredHosts.map((host) => {
                  const name = host.full_name || "Host Member";
                  const reason =
                    host.host_spotlight_reason?.trim() ||
                    host.bio?.trim() ||
                    "Featured for contributing meaningful hosting and community support.";
                  const href = profileHref(host);
                  return (
                    <article
                      key={host.id}
                      className="rounded-2xl border border-[var(--color-border-accent)]/40 bg-[var(--color-bg-secondary)] p-6 space-y-4"
                    >
                      <div className="flex items-center gap-3">
                        {host.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={host.avatar_url}
                            alt={name}
                            className="h-14 w-14 rounded-full object-cover border border-[var(--color-border-default)]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] flex items-center justify-center text-sm font-semibold text-[var(--color-text-secondary)]">
                            {getInitials(name)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                            {name}
                          </h3>
                          <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                            Host Spotlight
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
                          Why Featured
                        </p>
                        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{reason}</p>
                      </div>

                      <div className="pt-1">
                        <Link href={href} className="text-sm text-[var(--color-text-accent)] hover:underline">
                          View Profile
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-4 md:p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl md:text-2xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                  Community Directory
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Default is alphabetical list view. Switch to cards when you want visual browsing.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-default)] p-1 bg-[var(--color-bg-tertiary)]">
                <Button asChild size="sm" variant={currentView === "list" ? "primary" : "ghost"}>
                  <Link href="/friends-of-the-collective">List</Link>
                </Button>
                <Button asChild size="sm" variant={currentView === "card" ? "primary" : "ghost"}>
                  <Link href="/friends-of-the-collective?view=card">Cards</Link>
                </Button>
              </div>
            </div>
          </section>

          {friends.length === 0 ? (
            <section className="rounded-3xl border border-[var(--color-border-accent)]/40 bg-[var(--color-bg-secondary)] p-8 text-center">
              <h2 className="text-2xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] mb-3">
                Directory Coming Online
              </h2>
              <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-6">
                We are assembling this list now. If you already have organizations in mind, send them through feedback and we will start publishing them.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild variant="primary" size="lg">
                  <Link href="/feedback">Submit Recommendations</Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/partners">Partnership Opportunities</Link>
                </Button>
              </div>
            </section>
          ) : currentView === "list" ? (
            <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] overflow-hidden">
              <ul className="divide-y divide-[var(--color-border-subtle)]">
                {alphabetical.map((friend) => {
                  const relatedCount =
                    (friend.relatedBlogPosts?.length || 0) +
                    (friend.relatedGalleryAlbums?.length || 0) +
                    (friend.relatedEventSeries?.length || 0);
                  return (
                    <li key={friend.id} className="p-4 md:p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={friendProfileHref(friend)}
                              className="text-lg font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]"
                            >
                              {friend.name}
                            </Link>
                            {friend.featured && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border border-[var(--color-border-accent)] text-[var(--color-text-accent)]">
                                Featured
                              </span>
                            )}
                          </div>
                          <p className="text-xs tracking-wide uppercase text-[var(--color-text-tertiary)]">
                            {friend.organizationType || "Community Organization"}
                            {friend.city ? ` • ${friend.city}` : ""}
                          </p>
                          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                            {friend.shortBlurb}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
                          <span className="px-2 py-1 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]">
                            {friend.memberTags?.length || 0} members
                          </span>
                          <span className="px-2 py-1 rounded-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)]">
                            {relatedCount} related items
                          </span>
                        </div>
                        <div className="flex items-center gap-3 lg:justify-end">
                          <Link
                            href={friendProfileHref(friend)}
                            className="text-sm text-[var(--color-text-accent)] hover:underline"
                          >
                            View Profile
                          </Link>
                          <a
                            href={friend.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[var(--color-text-accent)] hover:underline"
                          >
                            Visit Site
                          </a>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : (
            <>
              {featured.length > 0 && (
                <section className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-2xl md:text-3xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                      Featured Friends
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {featured.map((friend) => renderFriendCard(friend, true))}
                  </div>
                </section>
              )}

              {standard.length > 0 && (
                <section className="space-y-5">
                  <h2 className="text-2xl md:text-3xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                    Community Directory
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {standard.map((friend) => renderFriendCard(friend, false))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </>
  );
}

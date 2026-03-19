import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { HeroSection, PageContainer } from "@/components/layout";
import { Button } from "@/components/ui";
import { SeriesCard, type SeriesEvent } from "@/components/happenings/SeriesCard";
import { addDaysDenver, getTodayDenver, groupEventsAsSeriesView, type SeriesEntry } from "@/lib/events/nextOccurrence";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { getFriendsOfCollective } from "@/lib/friends-of-the-collective";
import {
  toFriendView,
  type OrganizationContentLinkRecord,
  type OrganizationMemberTagProfile,
  type OrganizationMemberTagRecord,
  type OrganizationRecord,
} from "@/lib/organizations";

export const metadata: Metadata = {
  title: "Friend Profile | The Colorado Songwriters Collective",
  description: "Organization profile from Friends of the Collective.",
  robots: "index, follow",
};

type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  tags: string[];
};

type GalleryAlbumSummary = {
  id: string;
  slug: string;
  name: string;
  cover_image_url: string | null;
  created_at: string | null;
};

type SeriesEventSummary = SeriesEvent & {
  series_id: string | null;
  visibility: string | null;
  is_published: boolean;
  is_recurring: boolean;
  is_free: boolean;
};

type FriendProfileView = Omit<
  ReturnType<typeof toFriendView>,
  "relatedBlogPosts" | "relatedGalleryAlbums" | "relatedEventSeries"
> & {
  relatedBlogPosts: Array<{
    id: string;
    title: string;
    href: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    publishedAt: string | null;
    tags: string[];
  }>;
  relatedGalleryAlbums: Array<{
    id: string;
    name: string;
    href: string;
    coverImageUrl: string | null;
    createdAt: string | null;
  }>;
  relatedEventSeries: Array<{ seriesId: string; title: string; href: string; nextDate: string | undefined }>;
  relatedEventSeriesEntries: Array<SeriesEntry<SeriesEvent>>;
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

function claimFeedbackHref(friend: { slug?: string; id: string; name: string }): string {
  const profilePath = `/friends-of-the-collective/${friend.slug || friend.id}`;
  const params = new URLSearchParams({
    category: "feature",
    subject: `Claim or update organization profile: ${friend.name}`,
    pageUrl: profilePath,
  });
  return `/feedback?${params.toString()}`;
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

async function loadFriendBySlug(slug: string, isPublicMode: boolean): Promise<FriendProfileView | null> {
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
    query = query.eq("visibility", "public");
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("Friend profile organization query failed:", error);
    return null;
  }

  if (!data) {
    if (isPublicMode) return null;
    const fallback = getFriendsOfCollective().find((friend) => friend.id === slug || friend.slug === slug);
    if (!fallback) return null;
    return {
      ...fallback,
      relatedBlogPosts: (fallback.relatedBlogPosts || []).map((post) => ({
        ...post,
        excerpt: null,
        coverImageUrl: null,
        publishedAt: null,
        tags: [],
      })),
      relatedGalleryAlbums: (fallback.relatedGalleryAlbums || []).map((album) => ({
        ...album,
        coverImageUrl: null,
        createdAt: null,
      })),
      relatedEventSeries: (fallback.relatedEventSeries || []).map((series) => ({
        ...series,
        nextDate: series.nextDate || undefined,
      })),
      relatedEventSeriesEntries: [],
    };
  }

  const organization = data as OrganizationRecord;

  const [tagResult, contentLinkResult] = await Promise.all([
    (serviceClient as any)
      .from("organization_member_tags")
      .select(
        "id, organization_id, profile_id, sort_order, tag_reason, created_at, profiles!organization_member_tags_profile_id_fkey(id, slug, full_name, avatar_url, role, is_public, is_songwriter, is_host, is_studio, is_fan)"
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
        (linkType !== "blog_post" &&
          linkType !== "gallery_album" &&
          linkType !== "event_series" &&
          linkType !== "event") ||
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
  const eventIds = Array.from(
    new Set(
      contentLinks
        .filter((link) => link.link_type === "event")
        .map((link) => link.target_id)
        .filter(isUuidLike)
    )
  );

  const [blogResult, galleryResult, eventResult, seriesEventResult] = await Promise.all([
    blogIds.length > 0
      ? (async () => {
          let blogQuery = (serviceClient as any)
            .from("blog_posts")
            .select("id, slug, title, excerpt, cover_image_url, published_at, tags, is_published")
            .in("id", blogIds);
          if (isPublicMode) blogQuery = blogQuery.eq("is_published", true);
          return blogQuery;
        })()
      : Promise.resolve({ data: [], error: null }),
    galleryIds.length > 0
      ? (async () => {
          let galleryQuery = (serviceClient as any)
            .from("gallery_albums")
            .select("id, slug, name, cover_image_url, created_at, is_published, is_hidden")
            .in("id", galleryIds);
          if (isPublicMode) {
            galleryQuery = galleryQuery.eq("is_published", true).eq("is_hidden", false);
          }
          return galleryQuery;
        })()
      : Promise.resolve({ data: [], error: null }),
    eventIds.length > 0
      ? (async () => {
          let eventQuery = (serviceClient as any)
            .from("events")
            .select(
              "id, slug, series_id, title, event_date, event_type, day_of_week, start_time, end_time, recurrence_rule, max_occurrences, custom_dates, is_recurring, status, cover_image_url, is_dsc_event, is_free, last_verified_at, verified_by, source, host_id, location_mode, venue_id, venue_name, venue_address, is_published, visibility"
            )
            .in("id", eventIds);
          if (isPublicMode) {
            eventQuery = eventQuery.eq("is_published", true);
          }
          return eventQuery;
        })()
      : Promise.resolve({ data: [], error: null }),
    seriesIds.length > 0
      ? (async () => {
          let seriesQuery = (serviceClient as any)
            .from("events")
            .select(
              "id, slug, series_id, title, event_date, event_type, day_of_week, start_time, end_time, recurrence_rule, max_occurrences, custom_dates, is_recurring, status, cover_image_url, is_dsc_event, is_free, last_verified_at, verified_by, source, host_id, location_mode, venue_id, venue_name, venue_address, is_published, visibility"
            )
            .in("series_id", seriesIds);
          if (isPublicMode) {
            seriesQuery = seriesQuery.eq("is_published", true);
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
    blogById.set(id, {
      id,
      slug: rowSlug,
      title,
      excerpt: typeof row.excerpt === "string" ? row.excerpt : null,
      cover_image_url: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
      published_at: typeof row.published_at === "string" ? row.published_at : null,
      tags: Array.isArray(row.tags) ? row.tags.filter((item): item is string => typeof item === "string") : [],
    });
  }

  const galleryById = new Map<string, GalleryAlbumSummary>();
  for (const row of ((galleryResult.data || []) as Array<Record<string, unknown>>)) {
    const id = typeof row.id === "string" ? row.id : null;
    const rowSlug = typeof row.slug === "string" ? row.slug : null;
    const name = typeof row.name === "string" ? row.name : null;
    if (!id || !rowSlug || !name) continue;
    galleryById.set(id, {
      id,
      slug: rowSlug,
      name,
      cover_image_url: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
    });
  }

  const galleryIdsNeedingCover = Array.from(galleryById.values())
    .filter((gallery) => !gallery.cover_image_url)
    .map((gallery) => gallery.id);
  const galleryFallbackCoverById = new Map<string, string>();
  if (galleryIdsNeedingCover.length > 0) {
    const { data: galleryImageRows } = await (serviceClient as any)
      .from("gallery_images")
      .select("album_id, image_url, sort_order, created_at")
      .in("album_id", galleryIdsNeedingCover)
      .eq("is_approved", true)
      .eq("is_hidden", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    for (const row of ((galleryImageRows || []) as Array<Record<string, unknown>>)) {
      const albumId = typeof row.album_id === "string" ? row.album_id : null;
      const imageUrl = typeof row.image_url === "string" ? row.image_url : null;
      if (!albumId || !imageUrl) continue;
      if (!galleryFallbackCoverById.has(albumId)) {
        galleryFallbackCoverById.set(albumId, imageUrl);
      }
    }
  }

  const eventById = new Map<string, SeriesEventSummary>();
  for (const row of ((eventResult.data || []) as Array<Record<string, unknown>>)) {
    const id = typeof row.id === "string" ? row.id : null;
    const title = typeof row.title === "string" ? row.title : null;
    if (!id || !title) continue;

    eventById.set(id, {
      id,
      slug: typeof row.slug === "string" ? row.slug : null,
      series_id: typeof row.series_id === "string" ? row.series_id : null,
      title,
      event_date: typeof row.event_date === "string" ? row.event_date : null,
      event_type: Array.isArray(row.event_type)
        ? row.event_type.filter((item): item is string => typeof item === "string")
        : [],
      day_of_week: typeof row.day_of_week === "string" ? row.day_of_week : null,
      start_time: typeof row.start_time === "string" ? row.start_time : null,
      recurrence_rule: typeof row.recurrence_rule === "string" ? row.recurrence_rule : null,
      max_occurrences: typeof row.max_occurrences === "number" ? row.max_occurrences : null,
      custom_dates: Array.isArray(row.custom_dates)
        ? row.custom_dates.filter((item): item is string => typeof item === "string")
        : null,
      is_recurring: row.is_recurring === true,
      status: typeof row.status === "string" ? row.status : null,
      cover_image_url: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
      is_dsc_event: row.is_dsc_event === true,
      is_free: row.is_free === true,
      last_verified_at: typeof row.last_verified_at === "string" ? row.last_verified_at : null,
      verified_by: typeof row.verified_by === "string" ? row.verified_by : null,
      source: typeof row.source === "string" ? row.source : null,
      host_id: typeof row.host_id === "string" ? row.host_id : null,
      location_mode:
        row.location_mode === "venue" ||
        row.location_mode === "online" ||
        row.location_mode === "hybrid"
          ? row.location_mode
          : null,
      venue_id: typeof row.venue_id === "string" ? row.venue_id : null,
      venue_name: typeof row.venue_name === "string" ? row.venue_name : null,
      venue_address: typeof row.venue_address === "string" ? row.venue_address : null,
      is_published: row.is_published === true,
      visibility: typeof row.visibility === "string" ? row.visibility : null,
    });
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
        : [],
      day_of_week: typeof row.day_of_week === "string" ? row.day_of_week : null,
      start_time: typeof row.start_time === "string" ? row.start_time : null,
      recurrence_rule: typeof row.recurrence_rule === "string" ? row.recurrence_rule : null,
      max_occurrences: typeof row.max_occurrences === "number" ? row.max_occurrences : null,
      custom_dates: Array.isArray(row.custom_dates)
        ? row.custom_dates.filter((item): item is string => typeof item === "string")
        : null,
      is_recurring: row.is_recurring === true,
      status: typeof row.status === "string" ? row.status : null,
      cover_image_url: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
      is_dsc_event: row.is_dsc_event === true,
      is_free: row.is_free === true,
      last_verified_at: typeof row.last_verified_at === "string" ? row.last_verified_at : null,
      verified_by: typeof row.verified_by === "string" ? row.verified_by : null,
      source: typeof row.source === "string" ? row.source : null,
      host_id: typeof row.host_id === "string" ? row.host_id : null,
      location_mode:
        row.location_mode === "venue" ||
        row.location_mode === "online" ||
        row.location_mode === "hybrid"
          ? row.location_mode
          : null,
      venue_id: typeof row.venue_id === "string" ? row.venue_id : null,
      venue_name: typeof row.venue_name === "string" ? row.venue_name : null,
      venue_address: typeof row.venue_address === "string" ? row.venue_address : null,
      is_published: row.is_published === true,
      visibility: typeof row.visibility === "string" ? row.visibility : null,
    };

    const list = eventsBySeries.get(seriesId) || [];
    list.push(event);
    eventsBySeries.set(seriesId, list);
  }

  const todayDateKey = getTodayDenver();
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
        title: blog.title,
        href: `/blog/${blog.slug}`,
        excerpt: blog.excerpt,
        coverImageUrl: blog.cover_image_url,
        publishedAt: blog.published_at,
        tags: blog.tags,
      };
    })
    .filter(
      (item): item is {
        id: string;
        title: string;
        href: string;
        excerpt: string | null;
        coverImageUrl: string | null;
        publishedAt: string | null;
        tags: string[];
      } => item !== null
    );

  const relatedGalleryAlbums = contentLinks
    .filter((link) => link.link_type === "gallery_album")
    .map((link) => {
      const gallery = galleryById.get(link.target_id);
      if (!gallery) return null;
      return {
        id: gallery.id,
        name: gallery.name,
        href: `/gallery/${gallery.slug}`,
        coverImageUrl: gallery.cover_image_url || galleryFallbackCoverById.get(gallery.id) || null,
        createdAt: gallery.created_at,
      };
    })
    .filter(
      (item): item is {
        id: string;
        name: string;
        href: string;
        coverImageUrl: string | null;
        createdAt: string | null;
      } => item !== null
    );

  const selectedEventsForCards: SeriesEvent[] = [];
  const selectedEventIds = new Set<string>();
  const relatedEventSeries = contentLinks
    .filter((link) => link.link_type === "event_series" || link.link_type === "event")
    .map((link) => {
      if (link.link_type === "event") {
        const event = eventById.get(link.target_id);
        if (!event) return null;
        if (!selectedEventIds.has(event.id)) {
          selectedEventIds.add(event.id);
          selectedEventsForCards.push(event);
        }
        return {
          seriesId: event.id,
          title: event.title,
          href: eventDetailHref(event),
          nextDate: event.event_date || undefined,
        };
      }

      const seriesEvents = eventsBySeries.get(link.target_id) || [];
      if (seriesEvents.length === 0) return null;
      const nextUpcoming =
        seriesEvents.find((event) => event.event_date && event.event_date >= todayDateKey) || seriesEvents[0];
      if (!selectedEventIds.has(nextUpcoming.id)) {
        selectedEventIds.add(nextUpcoming.id);
        selectedEventsForCards.push(nextUpcoming);
      }
      return {
        seriesId: link.target_id,
        title: nextUpcoming.title,
        href: eventDetailHref(nextUpcoming),
        nextDate: nextUpcoming.event_date || undefined,
      };
    })
    .filter(
      (item): item is { seriesId: string; title: string; href: string; nextDate: string | undefined } =>
        item !== null
    );
  const { series: relatedEventSeriesEntries } = groupEventsAsSeriesView(selectedEventsForCards, {
    startKey: todayDateKey,
    endKey: addDaysDenver(todayDateKey, 90),
  });

  return {
    ...base,
    relatedBlogPosts,
    relatedGalleryAlbums,
    relatedEventSeries,
    relatedEventSeriesEntries,
  };
}

export default async function FriendOrganizationProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const friend = await loadFriendBySlug(slug, true);
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
                  className="w-full h-56 object-contain rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
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
                  <Link href={claimFeedbackHref(friend)}>
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
            (friend.relatedEventSeriesEntries && friend.relatedEventSeriesEntries.length > 0)
          ) && (
            <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-8">
              <h2 className="text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                Related on CSC
              </h2>

              {friend.relatedEventSeriesEntries && friend.relatedEventSeriesEntries.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-3">Hosted Happenings</h3>
                  <div className="space-y-3">
                    {friend.relatedEventSeriesEntries.map((entry) => (
                      <SeriesCard key={`${friend.id}-series-card-${entry.event.id}`} series={entry} />
                    ))}
                  </div>
                </div>
              )}

              {friend.relatedGalleryAlbums && friend.relatedGalleryAlbums.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-3">Gallery Albums</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {friend.relatedGalleryAlbums.map((album) => (
                      <Link
                        key={`${friend.id}-gallery-${album.id}`}
                        href={album.href}
                        className="group block rounded-lg overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] transition-colors"
                      >
                        <div className="relative aspect-[4/3] w-full bg-[var(--color-bg-tertiary)]">
                          {album.coverImageUrl ? (
                            <Image
                              src={album.coverImageUrl}
                              alt={album.name}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg
                                className="w-10 h-10 text-[var(--color-text-tertiary)]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors truncate">
                            {album.name}
                          </h4>
                          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                            {album.createdAt
                              ? new Date(album.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Published album"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {friend.relatedBlogPosts && friend.relatedBlogPosts.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-3">Blog Posts</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {friend.relatedBlogPosts.map((post) => (
                      <Link
                        key={`${friend.id}-blog-${post.id}`}
                        href={post.href}
                        className="block group focus-visible:outline-none"
                      >
                        <article className="h-full overflow-hidden card-spotlight transition-shadow transition-colors duration-200 ease-out hover:shadow-md hover:border-[var(--color-accent-primary)]/30 group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-accent-primary)]/30 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--color-bg-primary)]">
                          <div className="relative aspect-[4/3] overflow-hidden">
                            {post.coverImageUrl ? (
                              <Image
                                src={post.coverImageUrl}
                                alt={post.title}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-[var(--color-accent-primary)]/20 to-[var(--color-bg-tertiary)] flex items-center justify-center">
                                <svg
                                  className="w-12 h-12 text-[var(--color-text-accent)]/50"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                                  />
                                </svg>
                              </div>
                            )}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                          </div>

                          <div className="p-4 space-y-2 text-center">
                            {post.tags.length > 0 && (
                              <div className="flex flex-wrap justify-center gap-1.5">
                                {post.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={`${post.id}-tag-${tag}`}
                                    className="text-sm tracking-wide px-2 py-0.5 rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)]"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <h4 className="text-lg font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-text-accent)] transition-colors line-clamp-2">
                              {post.title}
                            </h4>
                            {post.excerpt && (
                              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                                {post.excerpt}
                              </p>
                            )}
                            <p className="text-xs text-[var(--color-text-tertiary)] pt-1">
                              {post.publishedAt
                                ? new Date(post.publishedAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "Published post"}
                            </p>
                          </div>
                        </article>
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

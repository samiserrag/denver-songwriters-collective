/**
 * Digest Editorial — Per-Week Editorial Content for Happenings Digest
 *
 * CRUD helpers for the `digest_editorial` table.
 * Used by:
 * - Cron handler (fetch editorial when sending)
 * - Admin control panel (create/edit/delete editorial per week)
 * - Preview API (render editorial in preview)
 *
 * Phase: GTM-3
 * GTM-3.1: Added slug/URL normalization for member and venue spotlights
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Check if a string is a valid UUID format.
 */
export function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

const CANONICAL_HOST = "denversongwriterscollective.org";
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
const ALLOWED_HOSTS = new Set([
  CANONICAL_HOST,
  `www.${CANONICAL_HOST}`,
]);

const EDITORIAL_URL_PREFIXES = {
  member_spotlight_ref: "/songwriters/",
  venue_spotlight_ref: "/venues/",
  blog_feature_ref: "/blog/",
  gallery_feature_ref: "/gallery/",
  featured_happenings_refs: "/events/",
} as const;

type EditorialUrlField = keyof typeof EDITORIAL_URL_PREFIXES;

function stripQueryAndHash(value: string): string {
  return value.split("?")[0].split("#")[0];
}

function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

function coerceToAbsoluteUrl(input: string): string | null {
  if (input.startsWith("/")) {
    return `${CANONICAL_ORIGIN}${input}`;
  }
  if (input.startsWith("www.")) {
    return `https://${input}`;
  }
  if (input.startsWith(CANONICAL_HOST)) {
    return `https://${input}`;
  }
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }
  return null;
}

function extractSlugFromPath(pathname: string, expectedPrefix: string): string | null {
  const normalizedPath = stripTrailingSlash(pathname);
  const lowerPath = normalizedPath.toLowerCase();
  const lowerPrefix = expectedPrefix.toLowerCase();
  if (!lowerPath.startsWith(lowerPrefix)) return null;
  const slug = normalizedPath.slice(expectedPrefix.length);
  if (!slug || slug.includes("/")) return null;
  return slug;
}

export interface EditorialUrlResult {
  value: string | null;
  slug?: string;
  error?: "invalid_url" | "unsupported_domain" | "unsupported_path";
}

export function normalizeEditorialUrl(
  input: string | null | undefined,
  expectedPrefix: string
): EditorialUrlResult {
  if (!input) return { value: null };

  const trimmed = input.trim();
  if (!trimmed) return { value: null };

  const stripped = stripQueryAndHash(trimmed);
  const absolute = coerceToAbsoluteUrl(stripped);
  if (!absolute) {
    return { value: null, error: "invalid_url" };
  }

  try {
    const url = new URL(absolute);
    if (!ALLOWED_HOSTS.has(url.hostname)) {
      return { value: null, error: "unsupported_domain" };
    }

    const slug = extractSlugFromPath(url.pathname, expectedPrefix);
    if (!slug) {
      return { value: null, error: "unsupported_path" };
    }

    const canonicalUrl = `${CANONICAL_ORIGIN}${expectedPrefix}${slug}`;
    return { value: canonicalUrl, slug };
  } catch {
    return { value: null, error: "invalid_url" };
  }
}

export interface EditorialUrlsResult {
  value: string[] | null;
  error?: EditorialUrlResult["error"];
  index?: number;
}

export function normalizeEditorialUrls(
  input: string[] | null | undefined,
  expectedPrefix: string
): EditorialUrlsResult {
  if (!input || input.length === 0) return { value: null };

  const results: string[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const result = normalizeEditorialUrl(input[i], expectedPrefix);
    if (result.error) {
      return { value: null, error: result.error, index: i };
    }
    if (result.value) {
      results.push(result.value);
    }
  }

  return { value: results.length > 0 ? results : null };
}

function parseEditorialUrlToSlug(
  input: string,
  expectedPrefix: string
): { slug: string | null; error?: EditorialUrlResult["error"]; canonicalUrl?: string; legacy?: boolean } {
  const trimmed = input.trim();
  if (!trimmed) return { slug: null };

  const likelyLegacy = !trimmed.includes("/") && !trimmed.includes(".");
  if (likelyLegacy) {
    return { slug: trimmed, legacy: true };
  }

  const normalized = normalizeEditorialUrl(trimmed, expectedPrefix);
  if (normalized.error || !normalized.value || !normalized.slug) {
    return { slug: null, error: normalized.error || "invalid_url" };
  }
  return { slug: normalized.slug, canonicalUrl: normalized.value };
}

export function getEditorialUrlPrefix(field: EditorialUrlField): string {
  return EDITORIAL_URL_PREFIXES[field];
}

export interface DigestEditorial {
  id: string;
  week_key: string;
  digest_type: string;
  subject_override: string | null;
  intro_note: string | null;
  featured_happening_ids: string[] | null;
  member_spotlight_id: string | null;
  venue_spotlight_id: string | null;
  blog_feature_slug: string | null;
  gallery_feature_slug: string | null;
  featured_happenings_refs: string[] | null;
  member_spotlight_ref: string | null;
  venue_spotlight_ref: string | null;
  blog_feature_ref: string | null;
  gallery_feature_ref: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Resolved editorial data ready for template rendering.
 * All references (IDs/slugs) have been fetched and expanded.
 */
export interface ResolvedEditorial {
  subjectOverride?: string;
  introNote?: string;
  featuredHappenings?: Array<{
    title: string;
    url: string;
    venue?: string;
    venueUrl?: string;
    date?: string;
    time?: string;
    emoji?: string;
    coverUrl?: string;
  }>;
  memberSpotlight?: {
    name: string;
    url: string;
    avatarUrl?: string;
    bio?: string;
  };
  venueSpotlight?: {
    name: string;
    url: string;
    coverUrl?: string;
    city?: string;
    websiteUrl?: string;
  };
  blogFeature?: {
    title: string;
    url: string;
    excerpt?: string;
  };
  galleryFeature?: {
    title: string;
    url?: string;
    coverUrl?: string;
  };
}

export interface EditorialUnresolved {
  field:
    | "featured_happenings_refs"
    | "member_spotlight_ref"
    | "venue_spotlight_ref"
    | "blog_feature_ref"
    | "gallery_feature_ref";
  url: string;
  reason: "invalid_url" | "unsupported_domain" | "unsupported_path" | "not_found";
  index?: number;
}

export interface ResolvedEditorialDiagnostics {
  resolved: ResolvedEditorial;
  unresolved: EditorialUnresolved[];
}

/**
 * Fetch editorial content for a specific week and digest type.
 *
 * Returns null if no editorial exists for that week.
 */
export async function getEditorial(
  supabase: SupabaseClient,
  weekKey: string,
  digestType: string
): Promise<DigestEditorial | null> {
  const { data, error } = await supabase
    .from("digest_editorial" as string)
    .select("*")
    .eq("week_key", weekKey)
    .eq("digest_type", digestType)
    .maybeSingle();

  if (error) {
    console.error(
      `[DigestEditorial] Error fetching editorial for ${weekKey}/${digestType}:`,
      error
    );
    return null;
  }

  return data as DigestEditorial | null;
}

/**
 * Create or update editorial content for a specific week.
 *
 * Uses upsert on (week_key, digest_type) unique constraint.
 */
export async function upsertEditorial(
  supabase: SupabaseClient,
  weekKey: string,
  digestType: string,
  data: Partial<
    Omit<DigestEditorial, "id" | "week_key" | "digest_type" | "created_at" | "updated_at">
  >,
  updatedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from("digest_editorial" as string)
    .upsert(
      {
        week_key: weekKey,
        digest_type: digestType,
        ...data,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "week_key,digest_type" }
    );

  if (error) {
    console.error(
      `[DigestEditorial] Error upserting editorial for ${weekKey}/${digestType}:`,
      error
    );
    return false;
  }

  return true;
}

/**
 * Delete editorial content for a specific week.
 */
export async function deleteEditorial(
  supabase: SupabaseClient,
  weekKey: string,
  digestType: string
): Promise<boolean> {
  const { error } = await supabase
    .from("digest_editorial" as string)
    .delete()
    .eq("week_key", weekKey)
    .eq("digest_type", digestType);

  if (error) {
    console.error(
      `[DigestEditorial] Error deleting editorial for ${weekKey}/${digestType}:`,
      error
    );
    return false;
  }

  return true;
}

/**
 * Resolve editorial references into renderable data.
 *
 * Fetches all referenced entities (events, profiles, venues, blogs, galleries)
 * and builds a ResolvedEditorial ready for template injection.
 *
 * Silently skips any references that can't be resolved (missing/deleted entities).
 */
async function resolveEditorialInternal(
  supabase: SupabaseClient,
  editorial: DigestEditorial
): Promise<ResolvedEditorialDiagnostics> {
  const resolved: ResolvedEditorial = {};
  const unresolved: EditorialUnresolved[] = [];

  const SITE_URL =
    process.env.PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    CANONICAL_ORIGIN;

  // Subject override
  if (editorial.subject_override) {
    resolved.subjectOverride = editorial.subject_override;
  }

  // Intro note
  if (editorial.intro_note) {
    resolved.introNote = editorial.intro_note;
  }

  // Featured happenings (URL refs first, UUID fallback)
  const featuredRefUrls = editorial.featured_happenings_refs?.filter(Boolean) ?? [];
  const featuredEntries = featuredRefUrls
    .map((ref, index) => {
      const parsed = parseEditorialUrlToSlug(
        ref,
        getEditorialUrlPrefix("featured_happenings_refs")
      );
      if (!parsed.slug) {
        unresolved.push({
          field: "featured_happenings_refs",
          url: parsed.canonicalUrl || (parsed.legacy ? "" : ref),
          reason: parsed.error || "invalid_url",
          index,
        });
        return null;
      }
      return {
        slug: parsed.slug,
        url: parsed.canonicalUrl || ref,
        index,
      };
    })
    .filter(Boolean) as Array<{ slug: string; url: string; index: number }>;

  const featuredFallbackIds = editorial.featured_happening_ids?.filter(Boolean) ?? [];
  const featuredRefs = featuredEntries.length > 0
    ? featuredEntries.map((entry) => entry.slug)
    : featuredFallbackIds;

  const fetchFeaturedEvents = async (refs: string[]) => {
    type EventRow = {
      id: string;
      title: string;
      slug: string | null;
      event_date: string | null;
      start_time: string | null;
      event_type: string;
      cover_image_url: string | null;
      venues: { id: string; name: string; slug: string | null; website_url: string | null } | {
        id: string;
        name: string;
        slug: string | null;
        website_url: string | null;
      }[] | null;
    };

    const eventSelect =
      "id, title, slug, event_date, start_time, event_type, cover_image_url, venues!left(id, name, slug, website_url)";

    const uuidRefs = refs.filter((ref) => isUUID(ref));
    const slugRefs = refs.filter((ref) => !isUUID(ref));
    const eventsById = new Map<string, EventRow>();
    const eventsBySlug = new Map<string, EventRow>();

    let events: EventRow[] = [];

    if (uuidRefs.length > 0) {
      const { data } = await supabase
        .from("events")
        .select(eventSelect)
        .in("id", uuidRefs);
      events = events.concat((data || []) as EventRow[]);
    }

    if (slugRefs.length > 0) {
      const { data } = await supabase
        .from("events")
        .select(eventSelect)
        .in("slug", slugRefs);
      events = events.concat((data || []) as EventRow[]);
    }

    for (const event of events) {
      eventsById.set(event.id, event);
      if (event.slug) {
        eventsBySlug.set(event.slug, event);
      }
    }

    return { eventsById, eventsBySlug };
  };

  const EVENT_TYPE_EMOJI: Record<string, string> = {
    open_mic: "🎤",
    song_circle: "🎵",
    workshop: "🎓",
    showcase: "🌟",
    meetup: "🤝",
    gig: "🎶",
    kindred_group: "💛",
    jam_session: "🎸",
    other: "📅",
  };

  if (featuredRefs.length > 0) {
    const { eventsById, eventsBySlug } = await fetchFeaturedEvents(featuredRefs);
    const orderedEvents: Array<{
      entry: { slug: string; url: string };
      event: { id: string; title: string; slug: string | null; event_date: string | null; start_time: string | null; event_type: string; cover_image_url: string | null; venues: { id: string; name: string; slug: string | null; website_url: string | null } | { id: string; name: string; slug: string | null; website_url: string | null }[] | null };
    }> = [];

    if (featuredEntries.length > 0) {
      for (const entry of featuredEntries) {
        const event = isUUID(entry.slug)
          ? eventsById.get(entry.slug) || null
          : eventsBySlug.get(entry.slug) || eventsById.get(entry.slug) || null;
        if (!event) {
          unresolved.push({
            field: "featured_happenings_refs",
            url: entry.url,
            reason: "not_found",
          });
          continue;
        }
        orderedEvents.push({ entry, event });
      }
    } else {
      for (const id of featuredFallbackIds) {
        const event = eventsById.get(id);
        if (event) {
          orderedEvents.push({
            entry: { slug: id, url: "" },
            event,
          });
        }
      }
    }

    if (orderedEvents.length > 0) {
      resolved.featuredHappenings = orderedEvents.map(({ event }) => {
        const venue = Array.isArray(event.venues) ? event.venues[0] : event.venues;
        const venueSlugOrId = venue?.slug || venue?.id || null;
        const venueInternalUrl = venueSlugOrId
          ? `${SITE_URL}/venues/${venueSlugOrId}`
          : undefined;
        const venueUrl = venue?.website_url || venueInternalUrl;
        return {
          title: event.title,
          url: `${SITE_URL}/events/${event.slug || event.id}`,
          venue: venue?.name || undefined,
          venueUrl: venueUrl || undefined,
          date: event.event_date || undefined,
          time: event.start_time || undefined,
          emoji: EVENT_TYPE_EMOJI[event.event_type] || "📅",
          coverUrl: event.cover_image_url || undefined,
        };
      });
    }
  }

  // Member spotlight — URL ref first, UUID fallback
  if (editorial.member_spotlight_ref) {
    const parsed = parseEditorialUrlToSlug(
      editorial.member_spotlight_ref,
      getEditorialUrlPrefix("member_spotlight_ref")
    );
    if (!parsed.slug) {
      unresolved.push({
        field: "member_spotlight_ref",
        url: parsed.canonicalUrl || (parsed.legacy ? "" : editorial.member_spotlight_ref),
        reason: parsed.error || "invalid_url",
      });
    } else {
      const memberQuery = supabase
        .from("profiles")
        .select("id, full_name, slug, avatar_url, bio");
      const { data: profile } = isUUID(parsed.slug)
        ? await memberQuery.eq("id", parsed.slug).maybeSingle()
        : await memberQuery.eq("slug", parsed.slug).maybeSingle();

      if (profile) {
        resolved.memberSpotlight = {
          name: profile.full_name || "Community Member",
          url: `${SITE_URL}/songwriters/${profile.slug || profile.id}`,
          avatarUrl: profile.avatar_url || undefined,
          bio: profile.bio
            ? profile.bio.length > 150
              ? profile.bio.substring(0, 147) + "..."
              : profile.bio
            : undefined,
        };
      } else {
        unresolved.push({
          field: "member_spotlight_ref",
          url: parsed.canonicalUrl || "",
          reason: "not_found",
        });
      }
    }
  } else if (editorial.member_spotlight_id) {
    const memberQuery = supabase
      .from("profiles")
      .select("id, full_name, slug, avatar_url, bio");
    const { data: profile } = await memberQuery
      .eq("id", editorial.member_spotlight_id)
      .maybeSingle();
    if (profile) {
      resolved.memberSpotlight = {
        name: profile.full_name || "Community Member",
        url: `${SITE_URL}/songwriters/${profile.slug || profile.id}`,
        avatarUrl: profile.avatar_url || undefined,
        bio: profile.bio
          ? profile.bio.length > 150
            ? profile.bio.substring(0, 147) + "..."
            : profile.bio
          : undefined,
      };
    }
  }

  // Venue spotlight — URL ref first, UUID fallback
  if (editorial.venue_spotlight_ref) {
    const parsed = parseEditorialUrlToSlug(
      editorial.venue_spotlight_ref,
      getEditorialUrlPrefix("venue_spotlight_ref")
    );
    if (!parsed.slug) {
      unresolved.push({
        field: "venue_spotlight_ref",
        url: parsed.canonicalUrl || (parsed.legacy ? "" : editorial.venue_spotlight_ref),
        reason: parsed.error || "invalid_url",
      });
    } else {
      const venueQuery = supabase
        .from("venues")
        .select("id, name, slug, cover_image_url, city, state, website_url");
      const { data: venue } = isUUID(parsed.slug)
        ? await venueQuery.eq("id", parsed.slug).maybeSingle()
        : await venueQuery.eq("slug", parsed.slug).maybeSingle();

      if (venue) {
        resolved.venueSpotlight = {
          name: venue.name,
          url: `${SITE_URL}/venues/${venue.slug || venue.id}`,
          coverUrl: venue.cover_image_url || undefined,
          city: [venue.city, venue.state].filter(Boolean).join(", ") || undefined,
          websiteUrl: venue.website_url || undefined,
        };
      } else {
        unresolved.push({
          field: "venue_spotlight_ref",
          url: parsed.canonicalUrl || "",
          reason: "not_found",
        });
      }
    }
  } else if (editorial.venue_spotlight_id) {
    const venueQuery = supabase
      .from("venues")
      .select("id, name, slug, cover_image_url, city, state, website_url");
    const { data: venue } = await venueQuery
      .eq("id", editorial.venue_spotlight_id)
      .maybeSingle();
    if (venue) {
      resolved.venueSpotlight = {
        name: venue.name,
        url: `${SITE_URL}/venues/${venue.slug || venue.id}`,
        coverUrl: venue.cover_image_url || undefined,
        city: [venue.city, venue.state].filter(Boolean).join(", ") || undefined,
        websiteUrl: venue.website_url || undefined,
      };
    }
  }

  // Blog feature — URL ref first, slug fallback
  if (editorial.blog_feature_ref) {
    const parsed = parseEditorialUrlToSlug(
      editorial.blog_feature_ref,
      getEditorialUrlPrefix("blog_feature_ref")
    );
    if (!parsed.slug) {
      unresolved.push({
        field: "blog_feature_ref",
        url: parsed.canonicalUrl || (parsed.legacy ? "" : editorial.blog_feature_ref),
        reason: parsed.error || "invalid_url",
      });
    } else {
      const { data: post } = await supabase
        .from("blog_posts")
        .select("slug, title, excerpt")
        .eq("slug", parsed.slug)
        .eq("is_published", true)
        .maybeSingle();
      if (post) {
        resolved.blogFeature = {
          title: post.title,
          url: `${SITE_URL}/blog/${post.slug}`,
          excerpt: post.excerpt || undefined,
        };
      } else {
        unresolved.push({
          field: "blog_feature_ref",
          url: parsed.canonicalUrl || "",
          reason: "not_found",
        });
      }
    }
  } else if (editorial.blog_feature_slug) {
    const { data: post } = await supabase
      .from("blog_posts")
      .select("slug, title, excerpt")
      .eq("slug", editorial.blog_feature_slug)
      .eq("is_published", true)
      .maybeSingle();
    if (post) {
      resolved.blogFeature = {
        title: post.title,
        url: `${SITE_URL}/blog/${post.slug}`,
        excerpt: post.excerpt || undefined,
      };
    }
  }

  // Gallery feature — URL ref first, slug fallback
  if (editorial.gallery_feature_ref) {
    const parsed = parseEditorialUrlToSlug(
      editorial.gallery_feature_ref,
      getEditorialUrlPrefix("gallery_feature_ref")
    );
    if (!parsed.slug) {
      unresolved.push({
        field: "gallery_feature_ref",
        url: parsed.canonicalUrl || (parsed.legacy ? "" : editorial.gallery_feature_ref),
        reason: parsed.error || "invalid_url",
      });
    } else {
      const { data: album } = await supabase
        .from("gallery_albums")
        .select("slug, name, cover_image_url")
        .eq("slug", parsed.slug)
        .eq("is_published", true)
        .maybeSingle();
      if (album) {
        resolved.galleryFeature = {
          title: album.name,
          url: `${SITE_URL}/gallery/${album.slug}`,
          coverUrl: album.cover_image_url || undefined,
        };
      } else {
        unresolved.push({
          field: "gallery_feature_ref",
          url: parsed.canonicalUrl || "",
          reason: "not_found",
        });
      }
    }
  } else if (editorial.gallery_feature_slug) {
    const { data: album } = await supabase
      .from("gallery_albums")
      .select("slug, name, cover_image_url")
      .eq("slug", editorial.gallery_feature_slug)
      .eq("is_published", true)
      .maybeSingle();
    if (album) {
      resolved.galleryFeature = {
        title: album.name,
        url: `${SITE_URL}/gallery/${album.slug}`,
        coverUrl: album.cover_image_url || undefined,
      };
    }
  }

  return { resolved, unresolved };
}

export async function resolveEditorial(
  supabase: SupabaseClient,
  editorial: DigestEditorial
): Promise<ResolvedEditorial> {
  const { resolved } = await resolveEditorialInternal(supabase, editorial);
  return resolved;
}

export async function resolveEditorialWithDiagnostics(
  supabase: SupabaseClient,
  editorial: DigestEditorial
): Promise<ResolvedEditorialDiagnostics> {
  return resolveEditorialInternal(supabase, editorial);
}

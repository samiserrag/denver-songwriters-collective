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

const INTERNAL_HOSTS = new Set([
  "denversongwriterscollective.org",
  "www.denversongwriterscollective.org",
]);

const EDITORIAL_ROUTE_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "songwriters", regex: /^\/songwriters\/([^/?#]+)/i },
  { label: "venues", regex: /^\/venues\/([^/?#]+)/i },
  { label: "events", regex: /^\/events\/([^/?#]+)/i },
  { label: "open-mics", regex: /^\/open-mics\/([^/?#]+)/i },
  { label: "blog", regex: /^\/blog\/([^/?#]+)/i },
  { label: "gallery", regex: /^\/gallery\/([^/?#]+)/i },
];

function stripQueryAndHash(value: string): string {
  return value.split("?")[0].split("#")[0];
}

function extractSlugFromPath(pathname: string): string | null {
  for (const pattern of EDITORIAL_ROUTE_PATTERNS) {
    const match = pathname.match(pattern.regex);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

export interface EditorialRefResult {
  value: string | null;
  error?: "invalid_url" | "unsupported_domain" | "unsupported_path" | "invalid_path";
}

/**
 * Normalize a slug or DSC URL into a stable ref string.
 *
 * Rules:
 * - Bare slugs/UUIDs are accepted as-is.
 * - Full URLs are accepted only for DSC domains (strict).
 * - Query strings and hashes are stripped.
 * - Path must match a known DSC route pattern.
 */
export function normalizeEditorialRef(input: string | null | undefined): EditorialRefResult {
  if (!input) return { value: null };

  const trimmed = input.trim();
  if (!trimmed) return { value: null };

  const stripped = stripQueryAndHash(trimmed);

  if (!stripped.includes("/")) {
    return { value: stripped };
  }

  if (stripped.startsWith("http://") || stripped.startsWith("https://")) {
    try {
      const url = new URL(stripped);
      if (!INTERNAL_HOSTS.has(url.hostname)) {
        return { value: null, error: "unsupported_domain" };
      }
      const slug = extractSlugFromPath(url.pathname);
      if (!slug) {
        return { value: null, error: "unsupported_path" };
      }
      return { value: slug };
    } catch {
      return { value: null, error: "invalid_url" };
    }
  }

  if (stripped.startsWith("/")) {
    const slug = extractSlugFromPath(stripped);
    if (!slug) {
      return { value: null, error: "unsupported_path" };
    }
    return { value: slug };
  }

  return { value: null, error: "invalid_path" };
}

export interface EditorialRefsResult {
  value: string[] | null;
  error?: EditorialRefResult["error"];
  index?: number;
}

export function normalizeEditorialRefs(
  input: string[] | null | undefined
): EditorialRefsResult {
  if (!input || input.length === 0) return { value: null };

  const results: string[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const result = normalizeEditorialRef(input[i]);
    if (result.error) {
      return { value: null, error: result.error, index: i };
    }
    if (result.value) {
      results.push(result.value);
    }
  }

  return { value: results.length > 0 ? results : null };
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
    url: string;
    coverUrl?: string;
  };
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
export async function resolveEditorial(
  supabase: SupabaseClient,
  editorial: DigestEditorial
): Promise<ResolvedEditorial> {
  const resolved: ResolvedEditorial = {};

  const SITE_URL =
    process.env.PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://denversongwriterscollective.org";

  // Subject override
  if (editorial.subject_override) {
    resolved.subjectOverride = editorial.subject_override;
  }

  // Intro note
  if (editorial.intro_note) {
    resolved.introNote = editorial.intro_note;
  }

  // Featured happenings (ref-first, UUID fallback)
  const featuredRefs = editorial.featured_happenings_refs?.filter(Boolean) ?? [];
  const featuredIds = editorial.featured_happening_ids?.filter(Boolean) ?? [];

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

    const ordered = refs
      .map((ref) => {
        if (isUUID(ref)) {
          return eventsById.get(ref) || null;
        }
        return eventsBySlug.get(ref) || eventsById.get(ref) || null;
      })
      .filter(Boolean) as EventRow[];

    return ordered;
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

  const featuredEvents =
    featuredRefs.length > 0
      ? await fetchFeaturedEvents(featuredRefs)
      : featuredIds.length > 0
        ? await fetchFeaturedEvents(featuredIds)
        : [];

  if (featuredEvents.length > 0) {
    resolved.featuredHappenings = featuredEvents.map((e) => {
      const venue = Array.isArray(e.venues) ? e.venues[0] : e.venues;
      const venueSlugOrId = venue?.slug || venue?.id || null;
      const venueInternalUrl = venueSlugOrId
        ? `${SITE_URL}/venues/${venueSlugOrId}`
        : undefined;
      const venueUrl = venue?.website_url || venueInternalUrl;
      return {
        title: e.title,
        url: `${SITE_URL}/events/${e.slug || e.id}`,
        venue: venue?.name || undefined,
        venueUrl: venueUrl || undefined,
        date: e.event_date || undefined,
        time: e.start_time || undefined,
        emoji: EVENT_TYPE_EMOJI[e.event_type] || "📅",
        coverUrl: e.cover_image_url || undefined,
      };
    });
  }

  // Member spotlight — supports both UUID and slug lookups
  const memberRef = editorial.member_spotlight_ref || editorial.member_spotlight_id;
  if (memberRef) {
    const memberQuery = supabase
      .from("profiles")
      .select("id, full_name, slug, avatar_url, bio");

    // Query by id if UUID, otherwise by slug
    const { data: profile } = isUUID(memberRef)
      ? await memberQuery.eq("id", memberRef).maybeSingle()
      : await memberQuery.eq("slug", memberRef).maybeSingle();

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

  // Venue spotlight — supports both UUID and slug lookups
  const venueRef = editorial.venue_spotlight_ref || editorial.venue_spotlight_id;
  if (venueRef) {
    const venueQuery = supabase
      .from("venues")
      .select("id, name, slug, cover_image_url, city, state, website_url");

    // Query by id if UUID, otherwise by slug
    const { data: venue } = isUUID(venueRef)
      ? await venueQuery.eq("id", venueRef).maybeSingle()
      : await venueQuery.eq("slug", venueRef).maybeSingle();

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

  // Blog feature
  const blogRef = editorial.blog_feature_ref || editorial.blog_feature_slug;
  if (blogRef) {
    const { data: post } = await supabase
      .from("blog_posts")
      .select("slug, title, excerpt")
      .eq("slug", blogRef)
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

  // Gallery feature
  const galleryRef = editorial.gallery_feature_ref || editorial.gallery_feature_slug;
  if (galleryRef) {
    const { data: album } = await supabase
      .from("gallery_albums")
      .select("slug, title, cover_image_url")
      .eq("slug", galleryRef)
      .eq("is_published", true)
      .maybeSingle();

    if (album) {
      resolved.galleryFeature = {
        title: album.title,
        url: `${SITE_URL}/gallery/${album.slug}`,
        coverUrl: album.cover_image_url || undefined,
      };
    }
  }

  return resolved;
}

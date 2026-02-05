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
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Extract slug from a full URL or return the input if it's already a slug/UUID.
 *
 * Supported URL patterns:
 * - /songwriters/{slug}
 * - /venues/{slug}
 * - /events/{slug}
 * - /blog/{slug}
 * - /gallery/{slug}
 *
 * Examples:
 * - "https://denversongwriterscollective.org/songwriters/sami-serrag" → "sami-serrag"
 * - "/venues/brewery-rickoli" → "brewery-rickoli"
 * - "sami-serrag" → "sami-serrag" (already a slug)
 * - "a1b2c3d4-..." → "a1b2c3d4-..." (UUID passthrough)
 */
export function normalizeEditorialSlug(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Known route prefixes to strip
  const routePatterns = [
    /^(?:https?:\/\/[^/]+)?\/songwriters\/([^/?#]+)/i,
    /^(?:https?:\/\/[^/]+)?\/venues\/([^/?#]+)/i,
    /^(?:https?:\/\/[^/]+)?\/events\/([^/?#]+)/i,
    /^(?:https?:\/\/[^/]+)?\/blog\/([^/?#]+)/i,
    /^(?:https?:\/\/[^/]+)?\/gallery\/([^/?#]+)/i,
  ];

  for (const pattern of routePatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // No pattern matched — return as-is (already a slug or UUID)
  return trimmed;
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

  // Featured happenings
  if (
    editorial.featured_happening_ids &&
    editorial.featured_happening_ids.length > 0
  ) {
    const { data: events } = await supabase
      .from("events")
      .select("id, title, slug, event_date, start_time, event_type, cover_image_url, venues!left(name)")
      .in("id", editorial.featured_happening_ids);

    if (events && events.length > 0) {
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

      resolved.featuredHappenings = events.map((e) => {
        const venue = Array.isArray(e.venues) ? e.venues[0] : e.venues;
        return {
          title: e.title,
          url: `${SITE_URL}/events/${e.slug || e.id}`,
          venue: venue?.name || undefined,
          date: e.event_date || undefined,
          time: e.start_time || undefined,
          emoji: EVENT_TYPE_EMOJI[e.event_type] || "📅",
          coverUrl: e.cover_image_url || undefined,
        };
      });
    }
  }

  // Member spotlight — supports both UUID and slug lookups
  if (editorial.member_spotlight_id) {
    const memberRef = editorial.member_spotlight_id;
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
  if (editorial.venue_spotlight_id) {
    const venueRef = editorial.venue_spotlight_id;
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
  if (editorial.blog_feature_slug) {
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

  // Gallery feature
  if (editorial.gallery_feature_slug) {
    const { data: album } = await supabase
      .from("gallery_albums")
      .select("slug, title, cover_image_url")
      .eq("slug", editorial.gallery_feature_slug)
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

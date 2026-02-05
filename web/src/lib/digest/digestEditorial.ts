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
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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
      .select("id, title, slug, event_date, start_time, event_type, venues!left(name)")
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
        };
      });
    }
  }

  // Member spotlight
  if (editorial.member_spotlight_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, slug, avatar_url, bio")
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

  // Venue spotlight
  if (editorial.venue_spotlight_id) {
    const { data: venue } = await supabase
      .from("venues")
      .select("id, name, slug, cover_image_url, city, state")
      .eq("id", editorial.venue_spotlight_id)
      .maybeSingle();

    if (venue) {
      resolved.venueSpotlight = {
        name: venue.name,
        url: `${SITE_URL}/venues/${venue.slug || venue.id}`,
        coverUrl: venue.cover_image_url || undefined,
        city: [venue.city, venue.state].filter(Boolean).join(", ") || undefined,
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

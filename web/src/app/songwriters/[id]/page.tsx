import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { SongwriterAvatar } from "@/components/songwriters";
import { SocialIcon, TipIcon, buildSocialLinks, buildTipLinks, PhotoGallery } from "@/components/profile";
import { ProfileComments } from "@/components/comments";
import { RoleBadges } from "@/components/members";
import { SeriesCard, type SeriesEvent } from "@/components/happenings/SeriesCard";
import {
  getTodayDenver,
  addDaysDenver,
  groupEventsAsSeriesView,
  buildOverrideMap,
} from "@/lib/events/nextOccurrence";
import type { Database } from "@/lib/supabase/database.types";
import Link from "next/link";
import Image from "next/image";
export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

interface SongwriterDetailPageProps {
  params: Promise<{ id: string }>;
}

// Check if string is a valid UUID
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export default async function SongwriterDetailPage({ params }: SongwriterDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Support both UUID and slug lookups
  // First try to find a profile with is_songwriter or legacy performer/host role
  // This accommodates both the new identity flags and old role system
  const { data: profile, error } = isUUID(id)
    ? await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .or("is_songwriter.eq.true,is_host.eq.true,role.in.(performer,host)")
        .single()
    : await supabase
        .from("profiles")
        .select("*")
        .eq("slug", id)
        .or("is_songwriter.eq.true,is_host.eq.true,role.in.(performer,host)")
        .single();

  if (error || !profile) {
    notFound();
  }

  // Phase 4.38: Canonical slug redirect - if accessed by UUID and profile has slug, redirect to canonical
  if (isUUID(id) && profile.slug) {
    redirect(`/songwriters/${profile.slug}`);
  }

  const songwriter = profile as DBProfile;

  // Fetch profile images for public display (only non-deleted images)
  const { data: profileImages } = await supabase
    .from("profile_images")
    .select("id, image_url")
    .eq("user_id", songwriter.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Build social and tip links using shared helpers
  const socialLinks = buildSocialLinks(songwriter);
  const tipLinks = buildTipLinks(songwriter);

  // Check if user is a venue manager (has active, non-revoked venue_managers entry)
  const { data: venueManagerData } = await supabase
    .from("venue_managers")
    .select("id")
    .eq("user_id", songwriter.id)
    .is("revoked_at", null)
    .limit(1);
  const isVenueManager = (venueManagerData?.length ?? 0) > 0;

  // Query hosted happenings - events where this profile is host OR co-host
  const today = getTodayDenver();
  const windowEnd = addDaysDenver(today, 90);

  // First, get event IDs where this user is a co-host (via event_hosts)
  const { data: coHostEntries } = await supabase
    .from("event_hosts")
    .select("event_id")
    .eq("user_id", songwriter.id)
    .eq("invitation_status", "accepted");

  const coHostedEventIds = (coHostEntries ?? []).map((e) => e.event_id);

  // Query events where user is primary host OR co-host
  // Use .or() to combine: host_id matches OR id is in co-hosted list
  let hostedEventsQuery = supabase
    .from("events")
    .select(`
      id,
      slug,
      title,
      event_type,
      event_date,
      day_of_week,
      start_time,
      end_time,
      recurrence_rule,
      is_recurring,
      status,
      cover_image_url,
      is_dsc_event,
      is_free,
      last_verified_at,
      verified_by,
      source,
      host_id,
      location_mode,
      venue_id,
      venue_name,
      venue_address
    `)
    .eq("is_published", true)
    .in("status", ["active", "needs_verification", "unverified"]);

  // Add the OR condition for host_id or co-hosted event IDs
  if (coHostedEventIds.length > 0) {
    hostedEventsQuery = hostedEventsQuery.or(`host_id.eq.${songwriter.id},id.in.(${coHostedEventIds.join(",")})`);
  } else {
    hostedEventsQuery = hostedEventsQuery.eq("host_id", songwriter.id);
  }

  const { data: hostedEvents } = await hostedEventsQuery;

  // Get event IDs for override query
  const eventIds = (hostedEvents ?? []).map((e) => e.id);

  // Query occurrence overrides for hosted events
  const { data: overridesData } = eventIds.length > 0
    ? await supabase
        .from("occurrence_overrides")
        .select("event_id, date_key, status, override_start_time, override_cover_image_url, override_notes")
        .in("event_id", eventIds)
        .gte("date_key", today)
        .lte("date_key", windowEnd)
    : { data: [] };

  const overrideMap = buildOverrideMap(
    (overridesData || []).map((o) => ({
      event_id: o.event_id,
      date_key: o.date_key,
      status: o.status as "normal" | "cancelled",
      override_start_time: o.override_start_time,
      override_cover_image_url: o.override_cover_image_url,
      override_notes: o.override_notes,
    }))
  );

  // Map to SeriesEvent format
  const eventsForSeries: SeriesEvent[] = (hostedEvents ?? []).map((event) => ({
    ...event,
    venue: null, // Not joining venue data for profile pages
  }));

  // Group events as series view with occurrence expansion
  const { series: hostedSeries } = groupEventsAsSeriesView(eventsForSeries, {
    startKey: today,
    endKey: windowEnd,
    overrideMap,
  });

  // Cap visible series to 3
  const visibleHostedSeries = hostedSeries.slice(0, 3);
  const hasMoreHostedEvents = hostedSeries.length > 3;

  // Query galleries created by this member (published + not hidden)
  const { data: galleriesData } = await supabase
    .from("gallery_albums")
    .select("id, name, slug, cover_image_url, created_at")
    .eq("created_by", songwriter.id)
    .eq("is_published", true)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });
  const galleries = galleriesData ?? [];

  // Query blog posts written by this member (published + approved)
  const { data: blogPostsData } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_image_url, published_at, tags")
    .eq("author_id", songwriter.id)
    .eq("is_published", true)
    .eq("is_approved", true)
    .order("published_at", { ascending: false, nullsFirst: false });
  const blogPosts = blogPostsData ?? [];

  // Check if viewer is the profile owner (for private sections)
  const { data: { session } } = await supabase.auth.getSession();
  const isOwner = session?.user?.id === songwriter.id;

  // Private sections: Only query if viewer is the owner
  let myRsvps: Array<{
    event_id: string;
    date_key: string | null;
    created_at: string;
    event: { id: string; title: string; slug: string | null; start_time: string | null; status: string } | null;
  }> = [];
  let myPerformances: Array<{
    id: string;
    timeslot: {
      id: string;
      date_key: string | null;
      slot_start_time: string | null;
      event: { id: string; title: string; slug: string | null; status: string } | null;
    } | null;
  }> = [];

  if (isOwner) {
    // Fetch RSVPs for this user
    const { data: rsvpsData } = await supabase
      .from("event_rsvps")
      .select(`
        event_id,
        date_key,
        created_at,
        event:events!event_rsvps_event_id_fkey(id, title, slug, start_time, status)
      `)
      .eq("user_id", songwriter.id)
      .order("date_key", { ascending: true, nullsFirst: false });
    myRsvps = (rsvpsData ?? []) as unknown as typeof myRsvps;

    // Fetch timeslot claims for this user
    const { data: claimsData } = await supabase
      .from("timeslot_claims")
      .select(`
        id,
        timeslot:event_timeslots!timeslot_claims_timeslot_id_fkey(
          id,
          date_key,
          slot_start_time,
          event:events!event_timeslots_event_id_fkey(id, title, slug, status)
        )
      `)
      .eq("member_id", songwriter.id)
      .eq("status", "confirmed");
    myPerformances = (claimsData ?? []) as unknown as typeof myPerformances;
  }

  // Process RSVPs: separate upcoming and past
  const processedRsvps = myRsvps
    .filter((r) => r.event)
    .map((r) => {
      const dateKey = r.date_key || r.event?.start_time?.split("T")[0] || today;
      const isUpcoming = dateKey >= today;
      return {
        eventId: r.event_id,
        eventTitle: r.event!.title,
        eventSlug: r.event!.slug || r.event!.id,
        dateKey,
        isUpcoming,
        status: r.event!.status,
      };
    })
    .sort((a, b) => {
      // Upcoming first (asc), then past (desc)
      if (a.isUpcoming && !b.isUpcoming) return -1;
      if (!a.isUpcoming && b.isUpcoming) return 1;
      if (a.isUpcoming) return a.dateKey.localeCompare(b.dateKey);
      return b.dateKey.localeCompare(a.dateKey);
    });

  // Process Performances: separate upcoming and past (client-side filter on date_key)
  const processedPerformances = myPerformances
    .filter((p) => p.timeslot?.event)
    .map((p) => {
      const dateKey = p.timeslot!.date_key || today;
      const isUpcoming = dateKey >= today;
      return {
        eventId: p.timeslot!.event!.id,
        eventTitle: p.timeslot!.event!.title,
        eventSlug: p.timeslot!.event!.slug || p.timeslot!.event!.id,
        dateKey,
        slotTime: p.timeslot!.slot_start_time,
        isUpcoming,
        status: p.timeslot!.event!.status,
      };
    })
    .sort((a, b) => {
      // Upcoming first (asc), then past (desc)
      if (a.isUpcoming && !b.isUpcoming) return -1;
      if (!a.isUpcoming && b.isUpcoming) return 1;
      if (a.isUpcoming) return a.dateKey.localeCompare(b.dateKey);
      return b.dateKey.localeCompare(a.dateKey);
    });

  // Build role badge flags for shared component
  const roleBadgeFlags = {
    isSongwriter: songwriter.is_songwriter ?? false,
    isHost: songwriter.is_host ?? false,
    isVenueManager,
    isFan: songwriter.is_fan ?? false,
    role: songwriter.role ?? undefined,
  };

  return (
    <>
      <HeroSection minHeight="auto">
        <PageContainer>
          {/* Profile Header - Centered layout with large avatar */}
          <div className="flex flex-col items-center text-center pt-8 pb-4">
            {/* Large Avatar */}
            <div className="mb-8">
              <SongwriterAvatar
                src={songwriter.avatar_url ?? undefined}
                alt={songwriter.full_name ?? "Songwriter"}
                size="2xl"
                className="ring-4 ring-[var(--color-accent-primary)]/30 shadow-2xl"
              />
            </div>

            {/* Name */}
            <h1 className="text-[var(--color-text-accent)] text-4xl md:text-5xl lg:text-6xl font-[var(--font-family-serif)] italic mb-6">
              {songwriter.full_name ?? "Anonymous Songwriter"}
            </h1>

            {/* Identity badges - consistent order: Songwriter → Happenings Host → Venue Manager → Fan */}
            <RoleBadges flags={roleBadgeFlags} mode="row" size="md" className="justify-center mb-4" />

            {/* Social Links - only render section if links exist */}
            {socialLinks.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mb-6">
                {socialLinks.map((link) => (
                  <Link
                    key={link.type}
                    href={link.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-accent-muted)] hover:bg-[var(--color-border-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                    title={link.label}
                  >
                    <SocialIcon type={link.type} />
                    <span className="text-sm font-medium">{link.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-12 max-w-4xl mx-auto">
          {/* 1. Bio Section - always show with empty state */}
          <section className="mb-12" data-testid="bio-section">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">About</h2>
            <p className="text-[var(--color-text-secondary)] leading-relaxed text-lg">
              {songwriter.bio || <span className="text-[var(--color-text-tertiary)]">No bio yet.</span>}
            </p>
          </section>

          {/* Profile Photo Gallery - only show if photos exist */}
          {profileImages && profileImages.length > 0 && (
            <section className="mb-12" data-testid="photos-section">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Photos</h2>
              <PhotoGallery images={profileImages} />
            </section>
          )}

          {/* 2. Instruments & Genres - always show with empty states */}
          <div className="grid md:grid-cols-2 gap-8 mb-12" data-testid="instruments-genres-section">
            {/* Instruments Section */}
            <section data-testid="instruments-section">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Instruments & Skills</h2>
              {songwriter.instruments && songwriter.instruments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {songwriter.instruments.map((instrument) => (
                    <span
                      key={instrument}
                      className="px-4 py-2 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-text-secondary)] text-sm font-medium"
                    >
                      {instrument}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--color-text-tertiary)]">No instruments listed.</p>
              )}
            </section>

            {/* Genres Section */}
            <section data-testid="genres-section">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Genres</h2>
              {songwriter.genres && songwriter.genres.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {songwriter.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-4 py-2 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--color-text-tertiary)]">No genres listed.</p>
              )}
            </section>
          </div>

          {/* 3. Collaboration Section - songwriters/hosts always have this */}
          <section className="mb-12" data-testid="collaboration-section">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Collaboration</h2>
            <div className="flex flex-wrap gap-2">
              {songwriter.open_to_collabs && (
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Open to Collaborations
                </span>
              )}
              {songwriter.interested_in_cowriting && (
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-purple-500/20 text-purple-400 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Interested in Co-writing
                </span>
              )}
              {songwriter.available_for_hire && (
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Available for Hire
                </span>
              )}
              {!songwriter.open_to_collabs && !songwriter.interested_in_cowriting && !songwriter.available_for_hire && (
                <p className="text-[var(--color-text-tertiary)]">No collaboration preferences set.</p>
              )}
            </div>
          </section>

          {/* Specialties Section - only show if has content */}
          {songwriter.specialties && songwriter.specialties.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Specialties</h2>
              <div className="flex flex-wrap gap-2">
                {songwriter.specialties.map((specialty) => (
                  <span
                    key={specialty}
                    className="px-3 py-1.5 rounded-full bg-[var(--color-accent-muted)] text-[var(--color-text-secondary)] text-sm"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Favorite Open Mic */}
          {songwriter.favorite_open_mic && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Favorite Open Mic</h2>
              <p className="text-[var(--color-text-secondary)]">{songwriter.favorite_open_mic}</p>
            </section>
          )}

          {/* Song Links Section */}
          {songwriter.song_links && songwriter.song_links.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Listen to My Music</h2>
              <div className="grid gap-3 max-w-xl">
                {songwriter.song_links.map((link, index) => {
                  // Determine the platform icon based on URL
                  const getPlatformInfo = (url: string) => {
                    if (url.includes("spotify")) return { name: "Spotify", color: "bg-[#1DB954]" };
                    if (url.includes("soundcloud")) return { name: "SoundCloud", color: "bg-[#FF5500]" };
                    if (url.includes("youtube") || url.includes("youtu.be")) return { name: "YouTube", color: "bg-[#FF0000]" };
                    if (url.includes("bandcamp")) return { name: "Bandcamp", color: "bg-[#1DA0C3]" };
                    if (url.includes("apple")) return { name: "Apple Music", color: "bg-[#FA2D48]" };
                    return { name: "Listen", color: "bg-[var(--color-accent-muted)]" };
                  };
                  const platform = getPlatformInfo(link);
                  return (
                    <Link
                      key={index}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg ${platform.color} hover:opacity-90 text-white transition-opacity`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <span className="font-medium">{platform.name}</span>
                      <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tip/Support Section */}
          {tipLinks.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Support This Songwriter</h2>
              <p className="text-[var(--color-text-tertiary)] mb-4">Show your appreciation with a tip!</p>
              <div className="flex flex-wrap gap-3">
                {tipLinks.map((tip) => (
                  <Link
                    key={tip.type}
                    href={tip.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg ${tip.color} hover:opacity-90 text-white transition-opacity`}
                  >
                    <TipIcon type={tip.type} />
                    <span className="font-medium">{tip.label}</span>
                    {tip.handle && <span className="text-white/80">{tip.handle}</span>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Hosted Happenings Section */}
          <section className="mb-12" data-testid="hosted-happenings-section">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Hosted Happenings</h2>
            {visibleHostedSeries.length > 0 ? (
              <div className="space-y-3">
                {visibleHostedSeries.map((entry) => (
                  <SeriesCard key={entry.event.id} series={entry} />
                ))}
                {hasMoreHostedEvents && (
                  <p className="text-sm text-[var(--color-text-secondary)] mt-4">
                    Showing 3 of {hostedSeries.length} happenings.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[var(--color-text-tertiary)]">No hosted happenings yet.</p>
            )}
          </section>

          {/* Galleries Created Section */}
          <section className="mb-12" data-testid="galleries-created-section">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Galleries Created</h2>
            {galleries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {galleries.map((album) => (
                  <Link
                    key={album.id}
                    href={`/gallery/${album.slug}`}
                    className="group block rounded-lg overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] transition-colors"
                  >
                    <div className="relative aspect-[4/3] w-full bg-[var(--color-bg-tertiary)]">
                      {album.cover_image_url ? (
                        <Image
                          src={album.cover_image_url}
                          alt={album.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-10 h-10 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors truncate">
                        {album.name}
                      </h3>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                        {new Date(album.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-[var(--color-text-tertiary)]">No published galleries yet.</p>
            )}
          </section>

          {/* Blogs Written Section */}
          <section className="mb-12" data-testid="blogs-written-section">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Blogs Written</h2>
            {blogPosts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {blogPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="block group focus-visible:outline-none"
                  >
                    <article className="h-full overflow-hidden card-spotlight transition-shadow transition-colors duration-200 ease-out hover:shadow-md hover:border-[var(--color-accent-primary)]/30 group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-accent-primary)]/30 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--color-bg-primary)]">
                      {/* Image Section - aspect-[4/3] */}
                      <div className="relative aspect-[4/3] overflow-hidden">
                        {post.cover_image_url ? (
                          <Image
                            src={post.cover_image_url}
                            alt={post.title}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[var(--color-accent-primary)]/20 to-[var(--color-bg-tertiary)] flex items-center justify-center">
                            <svg className="w-12 h-12 text-[var(--color-text-accent)]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                          </div>
                        )}
                        {/* Gradient overlay */}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      </div>

                      {/* Content Section */}
                      <div className="p-4 space-y-2 text-center">
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {post.tags.slice(0, 2).map((tag: string) => (
                              <span
                                key={tag}
                                className="text-sm tracking-wide px-2 py-0.5 rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <h3 className="text-lg font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-text-accent)] transition-colors line-clamp-2">
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                            {post.excerpt}
                          </p>
                        )}
                        <p className="text-xs text-[var(--color-text-tertiary)] pt-1">
                          {post.published_at
                            ? new Date(post.published_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Draft"}
                        </p>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-[var(--color-text-tertiary)]">No published blog posts yet.</p>
            )}
          </section>

          {/* PRIVATE SECTIONS - Only visible to profile owner */}
          {isOwner && (
            <>
              {/* My RSVPs Section */}
              <section className="mb-12" data-testid="my-rsvps-section">
                <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-1">My RSVPs</h2>
                <p className="text-sm text-[var(--color-text-tertiary)] mb-4">Only you can see this.</p>
                {processedRsvps.length > 0 ? (
                  <div className="space-y-2">
                    {processedRsvps.map((rsvp) => (
                      <Link
                        key={`${rsvp.eventId}-${rsvp.dateKey}`}
                        href={`/events/${rsvp.eventSlug}?date=${rsvp.dateKey}`}
                        className="flex items-center justify-between gap-4 p-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-[var(--color-text-primary)] truncate">
                            {rsvp.eventTitle}
                          </h3>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {new Date(rsvp.dateKey + "T12:00:00Z").toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              timeZone: "America/Denver",
                            })}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
                            rsvp.isUpcoming
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-[var(--color-accent-muted)] text-[var(--color-text-tertiary)]"
                          }`}
                        >
                          {rsvp.isUpcoming ? "Upcoming" : "Past"}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-[var(--color-text-tertiary)]">You haven&apos;t RSVPed to any happenings yet.</p>
                )}
              </section>

              {/* My Performances Section */}
              <section className="mb-12" data-testid="my-performances-section">
                <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-1">My Performances</h2>
                <p className="text-sm text-[var(--color-text-tertiary)] mb-4">Only you can see this.</p>
                {processedPerformances.length > 0 ? (
                  <div className="space-y-2">
                    {processedPerformances.map((perf) => (
                      <Link
                        key={`${perf.eventId}-${perf.dateKey}`}
                        href={`/events/${perf.eventSlug}?date=${perf.dateKey}`}
                        className="flex items-center justify-between gap-4 p-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-[var(--color-text-primary)] truncate">
                            {perf.eventTitle}
                          </h3>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {new Date(perf.dateKey + "T12:00:00Z").toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              timeZone: "America/Denver",
                            })}
                            {perf.slotTime && ` at ${perf.slotTime}`}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
                            perf.isUpcoming
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-[var(--color-accent-muted)] text-[var(--color-text-tertiary)]"
                          }`}
                        >
                          {perf.isUpcoming ? "Upcoming" : "Past"}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-[var(--color-text-tertiary)]">You haven&apos;t claimed any performance slots yet.</p>
                )}
              </section>
            </>
          )}

          {/* Profile Comments Section */}
          <ProfileComments profileId={songwriter.id} profileOwnerId={songwriter.id} />
        </div>
      </PageContainer>
    </>
  );
}

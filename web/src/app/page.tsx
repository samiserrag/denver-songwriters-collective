import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HeroSection } from "@/components/layout";
import { EventGrid } from "@/components/events";
import { MemberCard } from "@/components/members/MemberCard";
import { OpenMicGrid, type SpotlightOpenMic } from "@/components/open-mics";
import { HappeningsCard } from "@/components/happenings";
// Button removed - not currently used on homepage
import { LazyIframe, CLSLogger } from "@/components/home";
import { NewsletterSection } from "@/components/navigation/NewsletterSection";
import { ThemePicker } from "@/components/ui/ThemePicker";
import {
  getTodayDenver,
  expandAndGroupEvents,
  EXPANSION_CAPS,
} from "@/lib/events/nextOccurrence";
import type { Database } from "@/lib/supabase/database.types";
import type { Event, Member, MemberRole } from "@/types";

export const dynamic = "force-dynamic";

type DBEvent = Database["public"]["Tables"]["events"]["Row"];
type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

function mapDBEventToEvent(dbEvent: DBEvent & { rsvp_count?: number; claimed_slots?: number }): Event {
  // For timeslot events, use total_slots as capacity and claimed_slots as rsvp_count
  const effectiveCapacity = dbEvent.has_timeslots ? dbEvent.total_slots : dbEvent.capacity;
  const effectiveRsvpCount = dbEvent.has_timeslots ? (dbEvent.claimed_slots ?? 0) : (dbEvent.rsvp_count ?? 0);

  return {
    id: dbEvent.id,
    slug: dbEvent.slug,
    title: dbEvent.title,
    description: dbEvent.description ?? undefined,
    date: dbEvent.event_date,
    event_date: dbEvent.event_date,
    time: dbEvent.start_time,
    start_time: dbEvent.start_time,
    end_time: dbEvent.end_time,
    // Recurrence fields - critical for HappeningCard schedule computation
    day_of_week: dbEvent.day_of_week,
    recurrence_rule: dbEvent.recurrence_rule,
    venue: dbEvent.venue_name ?? "TBA",
    venue_address: dbEvent.venue_address ?? undefined,
    location: dbEvent.venue_address ?? undefined,
    capacity: effectiveCapacity,
    rsvp_count: effectiveRsvpCount,
    is_dsc_event: dbEvent.is_dsc_event,
    imageUrl: dbEvent.cover_image_url ?? undefined,
  };
}

function mapDBProfileToMember(profile: DBProfile): Member {
  return {
    id: profile.id,
    name: profile.full_name ?? "Anonymous Member",
    role: (profile.role as MemberRole) ?? "fan",
    bio: profile.bio ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    isSpotlight: profile.is_featured ?? false,
    genres: profile.genres ?? undefined,
    instruments: profile.instruments ?? undefined,
    specialties: profile.specialties ?? undefined,
    availableForHire: profile.available_for_hire ?? undefined,
    interestedInCowriting: profile.interested_in_cowriting ?? undefined,
    openToCollabs: profile.open_to_collabs ?? undefined,
  };
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  // Session available for future auth-aware features
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    data: { session: _session },
  } = await supabase.auth.getSession();

  // Get today's date for filtering past events
  const today = getTodayDenver();

  const [upcomingEventsRes, tonightsHappeningsRes, spotlightHappeningsRes, featuredMembersRes, spotlightOpenMicsRes, featuredBlogRes, latestBlogRes, highlightsRes, spotlightOpenMicEventsRes] = await Promise.all([
    // Single events query - upcoming DSC events (published only)
    // Filter: one-time events must be today or future, OR recurring events (have recurrence_rule)
    supabase
      .from("events")
      .select("*")
      .eq("is_dsc_event", true)
      .eq("is_published", true)
      .eq("status", "active")
      .or(`event_date.gte.${today},recurrence_rule.not.is.null`)
      .order("event_date", { ascending: true })
      .limit(6),
    // Tonight's happenings - all event types, published only
    // Limit to MAX_EVENTS to prevent performance issues
    supabase
      .from("events")
      .select(`
        *,
        venues!left(name, address, city, state)
      `)
      .eq("is_published", true)
      .in("status", ["active", "needs_verification"])
      .limit(EXPANSION_CAPS.MAX_EVENTS),
    // Spotlight happenings - admin-selected featured events
    supabase
      .from("events")
      .select(`
        *,
        venues!left(name, address, city, state)
      `)
      .eq("is_spotlight", true)
      .eq("is_published", true)
      .eq("status", "active")
      .order("event_date", { ascending: true })
      .limit(6),
    // Featured members of any role - only spotlighted members
    supabase
      .from("profiles")
      .select("*")
      .eq("is_featured", true)
      .eq("is_public", true)
      .order("featured_rank", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(8),
    // Spotlight Open Mics - featured open mics from the directory
    supabase
      .from("events")
      .select(`
        id,
        slug,
        title,
        description,
        day_of_week,
        start_time,
        signup_time,
        venue_name,
        is_featured,
        venues(name, city)
      `)
      .eq("event_type", "open_mic")
      .eq("status", "active")
      .eq("is_featured", true)
      .order("featured_rank", { ascending: true })
      .order("day_of_week", { ascending: true })
      .limit(6),
    // Featured blog post (if any)
    supabase
      .from("blog_posts")
      .select(`
        id,
        slug,
        title,
        excerpt,
        cover_image_url,
        published_at,
        tags,
        is_featured,
        author:profiles!blog_posts_author_id_fkey(full_name, avatar_url)
      `)
      .eq("is_published", true)
      .eq("is_approved", true)
      .eq("is_featured", true)
      .limit(1)
      .maybeSingle(),
    // Latest non-featured blog posts
    supabase
      .from("blog_posts")
      .select(`
        id,
        slug,
        title,
        excerpt,
        cover_image_url,
        published_at,
        tags,
        is_featured,
        author:profiles!blog_posts_author_id_fkey(full_name, avatar_url)
      `)
      .eq("is_published", true)
      .eq("is_approved", true)
      .neq("is_featured", true)
      .order("published_at", { ascending: false })
      .limit(2),
    // Monthly highlights for the homepage
    supabase
      .from("monthly_highlights")
      .select("*")
      .eq("is_active", true)
      .lte("start_date", new Date().toISOString().split("T")[0])
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split("T")[0]}`)
      .order("display_order", { ascending: true })
      .limit(4),
    // Spotlight Open Mic Events - admin-selected open mics using is_spotlight flag
    supabase
      .from("events")
      .select(`
        *,
        venues!left(name, address, city, state)
      `)
      .eq("event_type", "open_mic")
      .eq("is_spotlight", true)
      .eq("is_published", true)
      .eq("status", "active")
      .order("event_date", { ascending: true })
      .limit(6),
  ]);

  // Fetch RSVP counts or claimed slots for DSC events
  const eventsData = upcomingEventsRes.data ?? [];
  const upcomingEvents: Event[] = await Promise.all(
    eventsData.map(async (dbEvent) => {
      let rsvpCount = 0;
      let claimedSlots = 0;

      if (dbEvent.is_dsc_event) {
        if (dbEvent.has_timeslots) {
          // For timeslot events, count claimed slots via join through event_timeslots
          const { count } = await supabase
            .from("timeslot_claims")
            .select("*, event_timeslots!inner(event_id)", { count: "exact", head: true })
            .eq("event_timeslots.event_id", dbEvent.id)
            .eq("status", "confirmed");
          claimedSlots = count || 0;
        } else {
          // For RSVP events, count confirmed RSVPs
          const { count } = await supabase
            .from("event_rsvps")
            .select("*", { count: "exact", head: true })
            .eq("event_id", dbEvent.id)
            .eq("status", "confirmed");
          rsvpCount = count || 0;
        }
      }
      return mapDBEventToEvent({ ...dbEvent, rsvp_count: rsvpCount, claimed_slots: claimedSlots });
    })
  );
  const featuredMembers: Member[] = (featuredMembersRes.data ?? []).map(mapDBProfileToMember);

  // Map spotlight open mics
  const spotlightOpenMics: SpotlightOpenMic[] = (spotlightOpenMicsRes.data ?? []).map((om: any) => ({
    id: om.id,
    slug: om.slug,
    title: om.title,
    description: om.description,
    day_of_week: om.day_of_week,
    start_time: om.start_time,
    signup_time: om.signup_time,
    venue_name: om.venues?.name ?? om.venue_name,
    venue_city: om.venues?.city,
    is_featured: om.is_featured,
  }));

  // Get tonight's happenings using occurrence expansion
  const allEventsForTonight = (tonightsHappeningsRes.data ?? []) as any[];
  const { groupedEvents, metrics } = expandAndGroupEvents(allEventsForTonight, {
    startKey: today,
    endKey: today,
  });
  const tonightsHappenings = groupedEvents.get(today) ?? [];

  // Log performance metrics when caps are hit (server-side only, grepable)
  if (metrics.wasCapped) {
    console.log(
      `[PERF:homepage] tonights_happenings: ${allEventsForTonight.length} events, ` +
      `${metrics.eventsProcessed} processed, ${metrics.totalOccurrences} occurrences, ` +
      `capped=${metrics.wasCapped}`
    );
  }

  // Featured blog post (single, may be null)
  const featuredBlogPost = featuredBlogRes.data;

  // Latest non-featured blog posts (array of up to 2)
  const latestBlogPosts = latestBlogRes.data ?? [];

  // Combine: featured first (if any), then latest non-featured
  const allBlogPosts = featuredBlogPost
    ? [featuredBlogPost, ...latestBlogPosts]
    : latestBlogPosts;

  // Helper to get author from a blog post
  type BlogPost = NonNullable<typeof featuredBlogPost>;
  const getBlogAuthor = (post: BlogPost) => {
    if (!post?.author) return null;
    return Array.isArray(post.author) ? post.author[0] : post.author;
  };

  // Monthly highlights
  interface Highlight {
    id: string;
    title: string;
    description: string | null;
    highlight_type: string;
    image_url: string | null;
    link_url: string | null;
    link_text: string | null;
  }
  const highlights: Highlight[] = highlightsRes.data ?? [];

  // Spotlight happenings (admin-selected)
  const spotlightHappenings = (spotlightHappeningsRes.data ?? []) as any[];

  // Spotlight open mic events (admin-selected open mics using is_spotlight)
  const spotlightOpenMicEvents = (spotlightOpenMicEventsRes.data ?? []) as any[];

  const hasUpcomingEvents = upcomingEvents.length > 0;
  const hasTonightsHappenings = tonightsHappenings.length > 0;
  const hasSpotlightHappenings = spotlightHappenings.length > 0;
  const hasFeaturedMembers = featuredMembers.length > 0;
  const hasSpotlightOpenMics = spotlightOpenMics.length > 0;
  const hasLatestBlog = allBlogPosts.length > 0;
  const hasHighlights = highlights.length > 0;
  const hasSpotlightOpenMicEvents = spotlightOpenMicEvents.length > 0;

  return (
    <>
      <CLSLogger />
      {/* Hero with background image and main headline */}
      <HeroSection minHeight="lg" showVignette showBottomFade>
        <div className="text-center px-6 py-8">
          <h1 className="font-[var(--font-family-display)] font-bold text-5xl md:text-6xl lg:text-7xl text-white tracking-tight mb-2 drop-shadow-lg">
            Denver Songwriters Collective
          </h1>
          <p className="text-xl md:text-2xl text-white/95 mb-2 font-medium drop-shadow">
            A shared space for Denver-area songwriters and music fans
          </p>
          <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto drop-shadow">
            Find open mics, connect with other musicians, and discover what&apos;s happening in the local music community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/happenings"
              className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-semibold rounded-full hover:bg-[var(--color-accent-hover)] transition-colors shadow-lg"
            >
              See All Happenings
            </Link>
            <Link
              href="/happenings?type=open_mic"
              className="inline-flex items-center justify-center px-6 py-3 bg-white/20 backdrop-blur text-white font-semibold rounded-full hover:bg-white/30 transition-colors border border-white/30"
            >
              See Open Mics
            </Link>
          </div>
        </div>
      </HeroSection>

      {/* Join Us If... Strip */}
      <section className="py-10 px-6 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border-default)]">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-[var(--font-family-serif)] font-semibold text-2xl md:text-3xl text-[var(--color-text-primary)] tracking-tight mb-8">
            <Link href="/signup" className="hover:text-[var(--color-accent-primary)] transition-colors cursor-pointer">Join us if you&apos;re…</Link>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="text-lg font-medium text-[var(--color-text-primary)]">🎸 a songwriter looking to play, improve, or connect</div>
            <div className="text-lg font-medium text-[var(--color-text-primary)]">🎤 an open mic host or live music venue</div>
            <div className="text-lg font-medium text-[var(--color-text-primary)]">🎶 a songwriting group or collective</div>
            <div className="text-lg font-medium text-[var(--color-text-primary)]">🎭 a showcase or event promoter</div>
            <div className="text-lg font-medium text-[var(--color-text-primary)]">🌀 a fan of songs and songwriters</div>
          </div>
        </div>
      </section>

      {/* Collective Happenings - Hero Feature */}
      <section className="py-10 px-6 bg-[var(--color-bg-secondary)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="font-[var(--font-family-serif)] font-semibold text-3xl md:text-4xl lg:text-5xl text-[var(--color-text-primary)] tracking-tight mb-4">
              Explore and contribute to our collective happenings
            </h2>
            <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl mx-auto">
              The best open mic list on the Front Range, plus showcases, song circles, and community events. See what&apos;s happening or add your own.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/happenings"
              className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-semibold rounded-full hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              See All Happenings
            </Link>
            <Link
              href="/happenings?type=open_mic"
              className="inline-flex items-center justify-center px-6 py-3 border border-[var(--color-border-accent)] text-[var(--color-text-accent)] font-medium rounded-full hover:bg-[var(--color-accent-primary)]/10 transition-colors"
            >
              See Open Mics
            </Link>
          </div>
        </div>
      </section>

      {/* Monthly Highlights */}
      {hasHighlights && (
        <section className="py-10 px-6 border-t border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 text-center">
              <h2 className="font-[var(--font-family-serif)] font-semibold text-3xl md:text-4xl text-[var(--color-text-primary)] tracking-tight mb-2">
                This Month&apos;s Highlights
              </h2>
              <p className="text-[var(--color-text-secondary)]">
                Featured news and announcements from the community.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className="p-6 card-base border border-[var(--color-border-accent)]/20 rounded-xl hover:border-[var(--color-border-accent)]/50 transition-all"
                >
                  {highlight.image_url && (
                    <div className="relative h-40 mb-4 rounded-lg overflow-hidden">
                      <Image
                        src={highlight.image_url}
                        alt={highlight.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <span className="text-sm tracking-wide px-2 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] mb-3 inline-block">
                    {highlight.highlight_type === "event" && "Featured Event"}
                    {highlight.highlight_type === "performer" && "Featured Songwriter"}
                    {highlight.highlight_type === "venue" && "Featured Venue"}
                    {highlight.highlight_type === "custom" && "Announcement"}
                  </span>
                  <h3 className="text-lg md:text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight mb-2">
                    {highlight.title}
                  </h3>
                  {highlight.description && (
                    <p className="text-[var(--color-text-secondary)] text-base mb-4 line-clamp-3">
                      {highlight.description}
                    </p>
                  )}
                  {highlight.link_url && (
                    <Link
                      href={highlight.link_url}
                      className="inline-flex items-center gap-2 text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors text-base font-medium"
                    >
                      {highlight.link_text || "Learn More"}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DSC Happenings - Sponsored happenings only */}
      <section className="py-10 px-6 border-t border-[var(--color-border-default)]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="font-[var(--font-family-serif)] font-semibold text-3xl md:text-4xl text-[var(--color-text-primary)] tracking-tight mb-2">
                DSC Happenings
              </h2>
              <p className="text-[var(--color-text-secondary)]">
                Song circles, showcases, and gatherings sponsored by Denver Songwriters Collective.
              </p>
            </div>
            <Link
              href="/happenings?dsc=1"
              className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              See all DSC happenings
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          {hasUpcomingEvents ? (
            <EventGrid events={upcomingEvents} compact />
          ) : (
            <div className="text-center py-12 px-6 card-base rounded-xl border border-[var(--color-border-default)]">
              <p className="text-[var(--color-text-secondary)] mb-4">
                No DSC events on the calendar yet. Check back soon!
              </p>
              <Link
                href="/happenings"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-medium rounded-full hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                See all happenings
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Tonight's Happenings - All types */}
      <section className="py-10 px-6 border-t border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="font-[var(--font-family-serif)] font-semibold text-3xl md:text-4xl text-[var(--color-text-primary)] tracking-tight mb-2">
                Tonight&apos;s Happenings
              </h2>
              <p className="text-[var(--color-text-secondary)]">
                Open mics, showcases, and events happening today in Denver.
              </p>
            </div>
            <Link
              href="/happenings"
              className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              See all happenings
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          {hasTonightsHappenings ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tonightsHappenings.slice(0, 6).map((entry) => (
                <HappeningsCard
                  key={`${entry.event.id}-${entry.dateKey}`}
                  event={entry.event}
                  occurrence={{
                    date: entry.dateKey,
                    isToday: true,
                    isTomorrow: false,
                    isConfident: entry.isConfident,
                  }}
                  todayKey={today}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 px-6 card-base rounded-xl border border-[var(--color-border-default)]">
              <p className="text-[var(--color-text-secondary)] mb-4">
                Nothing scheduled for tonight. Check out what&apos;s coming up!
              </p>
              <Link
                href="/happenings"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-medium rounded-full hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                See upcoming happenings
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Spotlight Happenings - Admin-selected featured events */}
      {hasSpotlightHappenings && (
        <section className="py-10 px-6 border-t border-[var(--color-border-default)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-[var(--font-family-serif)] font-semibold text-3xl md:text-4xl text-[var(--color-text-primary)] tracking-tight mb-2">
                  <span className="text-[var(--color-accent-primary)]">✨</span> Spotlight
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Special happenings we think you should check out.
                </p>
              </div>
              <Link
                href="/happenings"
                className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                See all happenings
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {spotlightHappenings.slice(0, 6).map((event: any) => (
                <HappeningsCard
                  key={event.id}
                  event={event}
                  occurrence={{
                    date: event.event_date || today,
                    isToday: event.event_date === today,
                    isTomorrow: false,
                    isConfident: true,
                  }}
                  todayKey={today}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Playlists */}
      <section className="py-10 px-6 border-t border-[var(--color-border-default)]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 text-center">
            <h2 className="font-[var(--font-family-serif)] font-semibold text-3xl md:text-4xl text-[var(--color-text-primary)] tracking-tight mb-2">
              Featured Playlists
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Some folks you might want to listen to.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Spotify Playlist - Lazy loaded to prevent LCP blocking */}
            <LazyIframe
              src="https://open.spotify.com/embed/playlist/6LohBdSSOxypGZeI4hIGqK?utm_source=generator"
              title="Denver Songwriters Collective Spotify Playlist - Community music from local songwriters"
              height="352px"
              className="rounded-xl overflow-hidden"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
            {/* YouTube Playlist - Lazy loaded to prevent LCP blocking */}
            <LazyIframe
              src="https://www.youtube.com/embed/videoseries?si=JA6QrSYIVBwpfOi1&list=PL0HB-8-Ot_s5KVdniord-fsKK3rPz3O7e"
              title="Denver Songwriters Collective YouTube Playlist - Live performances and music videos"
              height="352px"
              className="rounded-xl overflow-hidden"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* Featured Members - Single unified section for all spotlighted members */}
      {hasFeaturedMembers && (
        <section className="py-10 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-[var(--font-family-serif)] font-semibold text-3xl md:text-4xl text-[var(--color-text-primary)] tracking-tight mb-2">
                  Featured Members
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Spotlighted songwriters, hosts, and studios from the Denver community.
                </p>
              </div>
              <Link
                href="/members"
                className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                See members
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featuredMembers.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Open Mics */}
      {hasSpotlightOpenMics && (
        <section className="py-10 px-6 border-t border-[var(--color-border-default)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-[var(--font-family-serif)] font-semibold text-3xl md:text-4xl text-[var(--color-text-primary)] tracking-tight mb-2">
                  Featured Open Mics
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Popular stages around Denver for songwriters to share their music.
                </p>
              </div>
              <Link
                href="/happenings?type=open_mic"
                className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                See open mics
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <OpenMicGrid openMics={spotlightOpenMics} />
          </div>
        </section>
      )}

      {/* Latest from the Blog */}
      {hasLatestBlog && (
        <section className="py-10 px-6 border-t border-[var(--color-border-default)]">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-baseline justify-between gap-4 mb-6">
              <div>
                <h2 className="font-[var(--font-family-serif)] font-semibold text-3xl md:text-4xl text-[var(--color-text-primary)] tracking-tight mb-2">
                  Latest from the Blog
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Stories from the local songwriting scene. <Link href="/dashboard/blog" className="text-[var(--color-text-accent)] hover:underline">Share your own!</Link>
                </p>
              </div>
              <Link
                href="/blog"
                className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                See blog
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Blog Cards + Share Your Story CTA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Blog Posts (featured first if any, then latest) */}
              {allBlogPosts.map((post) => {
                const author = getBlogAuthor(post);
                const isFeatured = post.is_featured;
                return (
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
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[var(--color-accent-primary)]/20 to-[var(--color-bg-tertiary)] flex items-center justify-center">
                            <svg className="w-16 h-16 text-[var(--color-text-accent)]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                          </div>
                        )}
                        {/* Featured badge */}
                        {isFeatured && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-purple-600 text-white text-xs font-medium">
                            ★ Featured
                          </div>
                        )}
                        {/* Gradient overlay */}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      </div>

                      {/* Content Section */}
                      <div className="p-5 space-y-3 text-center">
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap justify-center gap-2">
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
                        <h3 className="text-lg md:text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-text-accent)] transition-colors">
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 text-left mx-auto max-w-prose">
                            {post.excerpt}
                          </p>
                        )}
                        <div className="flex items-center justify-center gap-2 pt-2">
                          {author?.avatar_url ? (
                            <Image
                              src={author.avatar_url}
                              alt={author.full_name ?? "Author"}
                              width={24}
                              height={24}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                              <span className="text-[var(--color-text-accent)] text-sm">
                                {author?.full_name?.[0] ?? "?"}
                              </span>
                            </div>
                          )}
                          <p className="text-sm text-[var(--color-text-tertiary)]">
                            {author?.full_name ?? "Anonymous"}
                          </p>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}

              {/* Share Your Story CTA Card */}
              <Link
                href="/dashboard/blog"
                className="block group focus-visible:outline-none"
              >
                <article className="h-full overflow-hidden card-spotlight transition-shadow transition-colors duration-200 ease-out hover:shadow-md hover:border-[var(--color-accent-primary)]/30 group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-accent-primary)]/30 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[var(--color-bg-primary)] flex flex-col">
                  {/* Icon Section - same aspect ratio as blog image */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[var(--color-accent-primary)]/20 to-[var(--color-bg-tertiary)] flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto text-[var(--color-text-accent)]/70 group-hover:text-[var(--color-text-accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    {/* Gradient overlay */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  </div>

                  {/* Content Section */}
                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-center text-center">
                    <h3 className="text-lg md:text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-text-accent)] transition-colors">
                      Share Your Story
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                      Got advice, insights, or a journey to share? Add your voice to the community.
                    </p>
                    <span className="inline-flex items-center justify-center gap-1 text-[var(--color-text-accent)] text-sm font-medium">
                      Write a post
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </article>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Open Mic Spotlight - Admin-selected open mics below the blog */}
      {hasSpotlightOpenMicEvents && (
        <section className="py-10 px-6 border-t border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-[var(--font-family-serif)] font-semibold text-3xl md:text-4xl text-[var(--color-text-primary)] tracking-tight mb-2">
                  <span className="text-[var(--color-accent-primary)]">🎤</span> Open Mic Spotlight
                </h2>
                <p className="text-[var(--color-text-secondary)]">
                  Featured open mics from the Denver songwriting scene.
                </p>
              </div>
              <Link
                href="/happenings?type=open_mic"
                className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-primary)] transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                See all open mics
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {spotlightOpenMicEvents.slice(0, 6).map((event: any) => (
                <HappeningsCard
                  key={event.id}
                  event={event}
                  occurrence={{
                    date: event.event_date || today,
                    isToday: event.event_date === today,
                    isTomorrow: false,
                    isConfident: true,
                  }}
                  todayKey={today}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Theme Picker */}
      <section className="py-8 px-6 border-t border-[var(--color-border-default)]">
        <div className="max-w-xl mx-auto">
          <ThemePicker />
        </div>
      </section>

      {/* Early Contributors CTA */}
      <section className="py-10 px-6 border-t border-[var(--color-border-default)]">
        <div className="max-w-2xl mx-auto">
          <article className="card-spotlight p-6 md:p-8 text-center">
            <h2 className="font-[var(--font-family-serif)] font-semibold text-2xl md:text-3xl text-[var(--color-text-primary)] tracking-tight mb-4">
              Early Contributors
            </h2>
            <p className="text-[var(--color-text-secondary)] text-base md:text-lg mb-2">
              Help shape the Denver Songwriters Collective.
              Explore the site and tell us what worked, what didn&apos;t, and what would make you share it.
            </p>
            <p className="text-sm text-[var(--color-text-tertiary)] mb-6">
              For songwriters, hosts, venues, and curious first-timers.
            </p>
            <Link
              href="/early-contributors"
              className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-semibold rounded-full hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Become an Early Contributor
            </Link>
          </article>
        </div>
      </section>

      {/* Newsletter Signup */}
      <NewsletterSection />
    </>
  );
}
